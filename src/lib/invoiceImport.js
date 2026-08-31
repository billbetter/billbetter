/**
 * Making many invoices at once: from a spreadsheet, or from a list of clients.
 *
 * -- Two ways in, one plan -------------------------------------------------
 *
 * Both entry points produce the same `plan` -- an array of prospective invoices
 * with their line items, their resolved client, and their own errors. The
 * review table renders a plan; createInvoiceBatch consumes a plan. Neither
 * knows or cares which door the rows came through, which is what keeps the
 * validation from existing twice and disagreeing with itself.
 *
 * -- Why the parser is written here rather than installed ------------------
 *
 * A CSV parser is sixty lines and the interesting cases are all in RFC 4180:
 * quoted fields, commas and newlines INSIDE quotes, "" as an escaped quote, a
 * BOM that Excel writes and nothing warns you about. Those are exactly the
 * cases a naive `text.split(",")` gets wrong, and it gets them wrong quietly --
 * a client called "Reyes, Dana" silently becomes two columns and every field
 * after it shifts by one, so the rate lands in the notes and the invoice is
 * created for nothing.
 *
 * .xlsx is deliberately not supported. Reading a real workbook means a
 * dependency; every spreadsheet application exports CSV in two clicks.
 *
 * -- The two things that would quietly bill the wrong amount ---------------
 *
 *   Dates. 03/04/2026 is March 4th to a US export and April 3rd to a Canadian
 *   one, and nothing in the file says which. See inferDateOrder: the file is
 *   asked, not guessed at.
 *
 *   Grouping. A spreadsheet of line items has one row per LINE, not per
 *   invoice. Creating one invoice per row turns a three-line job into three
 *   invoices, and the client gets three emails. Rows are grouped -- see
 *   groupKey.
 */

// ---- Delimited text ------------------------------------------------------

/** Strip the BOM Excel writes at the head of a UTF-8 CSV. */
function stripBom(text) {
  return typeof text === "string" && text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

/**
 * Work out what separates the columns.
 *
 * Counts candidates on the header line only, OUTSIDE quotes. Counting over the
 * whole file lets a body full of commas inside quoted descriptions outvote a
 * genuine tab, and counting inside quotes is the same mistake in miniature.
 */
export function detectDelimiter(text) {
  const firstLine = stripBom(String(text || "")).split(/\r?\n/, 1)[0] || "";
  const candidates = [",", "\t", ";", "|"];
  let best = ",";
  let bestCount = 0;

  for (const d of candidates) {
    let count = 0;
    let inQuotes = false;
    for (let i = 0; i < firstLine.length; i++) {
      const ch = firstLine[i];
      if (ch === '"') inQuotes = !inQuotes;
      else if (ch === d && !inQuotes) count++;
    }
    if (count > bestCount) {
      best = d;
      bestCount = count;
    }
  }
  return best;
}

/**
 * Parse delimited text into rows of strings. RFC 4180.
 *
 * Handles quoted fields, delimiters and newlines inside quotes, "" as a literal
 * quote, CRLF and LF, and a trailing newline. Never throws: malformed input
 * yields the best reading available rather than an exception, because the
 * review table is a better place to notice a bad file than a stack trace.
 *
 * @returns {string[][]} rows; ragged rows are NOT padded -- the caller reads by
 *   column index and a short row simply has no value there, which is different
 *   from an empty string and is reported differently.
 */
export function parseDelimited(text, delimiter) {
  const src = stripBom(String(text || ""));
  const d = delimiter || detectDelimiter(src);

  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  let fieldWasQuoted = false;

  const endField = () => {
    // An unquoted field is trimmed; a quoted one is not. Somebody who wrapped
    // a value in quotes meant the spaces.
    row.push(fieldWasQuoted ? field : field.trim());
    field = "";
    fieldWasQuoted = false;
  };
  const endRow = () => {
    endField();
    // A line that is entirely empty is a blank line, not a row of one empty
    // field. Spreadsheets leave these at the end of a file constantly.
    if (row.length > 1 || row[0] !== "") rows.push(row);
    row = [];
  };

  for (let i = 0; i < src.length; i++) {
    const ch = src[i];

    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
      fieldWasQuoted = true;
      continue;
    }
    if (ch === d) {
      endField();
      continue;
    }
    if (ch === "\r") {
      // CRLF: the \n does the work. A lone \r (old Mac) ends the row too.
      if (src[i + 1] === "\n") i++;
      endRow();
      continue;
    }
    if (ch === "\n") {
      endRow();
      continue;
    }
    field += ch;
  }

  // Whatever is left when the text runs out is a final row, unless the file
  // ended cleanly on a newline and left nothing behind.
  if (field !== "" || row.length) endRow();

  return rows;
}

// ---- Columns -------------------------------------------------------------

/**
 * The fields an import can fill, and the header names that mean each one.
 *
 * Aliases are matched loosely (lowercased, non-alphanumerics stripped) so
 * "Client Name", "client_name" and "CLIENT NAME" all land in the same place.
 */
export const IMPORT_FIELDS = [
  {
    key: "client",
    label: "Client",
    required: true,
    hint: "Matched against your existing clients by name.",
    aliases: ["client", "clientname", "customer", "customername", "name", "billto", "company"],
  },
  {
    key: "email",
    label: "Client email",
    hint: "Used to match a client before the name is, and to send the invoice.",
    aliases: ["email", "clientemail", "customeremail", "emailaddress"],
  },
  {
    key: "description",
    label: "Description",
    required: true,
    hint: "One line item per row.",
    aliases: ["description", "item", "lineitem", "service", "work", "details", "product"],
  },
  {
    key: "quantity",
    label: "Quantity",
    hint: "Defaults to 1 when the column is missing or blank.",
    aliases: ["quantity", "qty", "hours", "units", "amountofunits"],
  },
  {
    key: "rate",
    label: "Rate",
    required: true,
    hint: "Price per unit, before tax.",
    aliases: ["rate", "price", "unitprice", "cost", "unitcost", "amount", "total"],
  },
  {
    key: "reference",
    label: "Invoice reference",
    hint: "Rows sharing a reference become ONE invoice. Without it, rows are grouped by client.",
    aliases: ["reference", "ref", "invoice", "invoiceref", "invoicenumber", "job", "jobref", "po", "ponumber"],
  },
  {
    key: "due_date",
    label: "Due date",
    aliases: ["duedate", "due", "datedue", "paymentdue"],
  },
  {
    key: "tax_rate",
    label: "Tax rate %",
    hint: "Defaults to your business tax rate.",
    aliases: ["taxrate", "tax", "vat", "gst", "hst", "salestax"],
  },
  {
    key: "notes",
    label: "Notes",
    aliases: ["notes", "note", "memo", "comment", "comments", "message"],
  },
];

const normaliseHeader = (h) => String(h || "").toLowerCase().replace(/[^a-z0-9]/g, "");

/**
 * Guess which column is which from the header row.
 *
 * Exact alias match only -- no fuzzy scoring. A wrong guess here puts the rate
 * in the quantity column and bills a client 450 units of $1, which is a worse
 * outcome than asking them to pick from a dropdown. Unmatched fields come back
 * absent, and the UI makes the user choose.
 *
 * @returns {Record<string, number>} field key -> column index
 */
export function guessColumnMapping(headers = []) {
  const normalised = headers.map(normaliseHeader);
  const mapping = {};
  const used = new Set();

  for (const field of IMPORT_FIELDS) {
    for (const alias of field.aliases) {
      const idx = normalised.indexOf(alias);
      // First-come: "amount" is an alias of `rate`, and a file with both an
      // "amount" and a "rate" column should use the one named rate. Fields are
      // declared in priority order and a column is claimed once.
      if (idx !== -1 && !used.has(idx)) {
        mapping[field.key] = idx;
        used.add(idx);
        break;
      }
    }
  }
  return mapping;
}

/** Whether a header row looks like headers rather than data. */
export function looksLikeHeaderRow(row = []) {
  if (!row.length) return false;
  const matched = Object.keys(guessColumnMapping(row)).length;
  if (matched >= 2) return true;
  // No recognised names, but nothing numeric either -- still more likely a
  // header than a data row, and treating data as a header loses one invoice
  // while the reverse creates a junk one.
  return row.every((cell) => cell === "" || !isFinite(Number(cell)));
}

// ---- Values --------------------------------------------------------------

/**
 * Read a number out of whatever a spreadsheet produced.
 *
 * Handles "$1,234.56", "1 234,56", "(45.00)" for negatives, and a bare number.
 * Returns null rather than 0 when it cannot tell -- billing 0 for an
 * unparseable rate is the failure this exists to prevent.
 */
export function parseMoney(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  let raw = String(value ?? "").trim();
  if (!raw) return null;

  // Accounting negatives.
  let negative = false;
  if (/^\(.*\)$/.test(raw)) {
    negative = true;
    raw = raw.slice(1, -1);
  }

  // Strip currency symbols, letters and spaces (including non-breaking ones,
  // which is what Excel puts in a formatted number).
  raw = raw.replace(/[^\d.,\-+]/g, "");
  if (!raw) return null;
  if (raw.startsWith("-")) negative = !negative;
  raw = raw.replace(/[+\-]/g, "");

  const lastComma = raw.lastIndexOf(",");
  const lastDot = raw.lastIndexOf(".");

  if (lastComma !== -1 && lastDot !== -1) {
    // Whichever comes last is the decimal separator; the other groups
    // thousands. "1.234,56" and "1,234.56" both resolve correctly.
    const decimalAt = Math.max(lastComma, lastDot);
    const groupChar = decimalAt === lastComma ? "." : ",";
    raw = raw.split(groupChar).join("");
    raw = raw.replace(",", ".");
  } else if (lastComma !== -1) {
    // Only commas. Two digits after the last one means it is a decimal
    // separator ("1234,56"); anything else means thousands ("1,234", "1,234,567").
    raw = raw.length - lastComma - 1 === 2 ? raw.replace(",", ".") : raw.split(",").join("");
  } else if (lastDot !== -1) {
    // Only dots. Same reasoning inverted: "1.234" with three trailing digits is
    // a European thousands group, not 1.234 dollars.
    const after = raw.length - lastDot - 1;
    if (after === 3 && raw.indexOf(".") !== lastDot) raw = raw.split(".").join("");
  }

  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  return negative ? -n : n;
}

const MONTHS = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12,
};

/**
 * Work out whether the FILE writes dates day-first or month-first.
 *
 * 03/04/2026 is March 4th to a US export and April 3rd to a Canadian one, and
 * nothing in the file says which. Guessing wrong sets every ambiguous due date
 * up to eleven months out, which is silent: the invoice looks fine and simply
 * is not chased.
 *
 * So the file is asked rather than guessed at. Any date whose first number is
 * above 12 can only be day-first; any whose second number is above 12 can only
 * be month-first. One such row settles the whole file, and real exports almost
 * always contain one. When none does, the caller's explicit choice is used and
 * the UI says which reading it took.
 *
 * @returns {'dmy'|'mdy'|null} null when the file cannot settle it
 */
export function inferDateOrder(values = []) {
  let dmy = 0;
  let mdy = 0;
  for (const v of values) {
    const m = /^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{2,4})$/.exec(String(v || "").trim());
    if (!m) continue;
    const a = Number(m[1]);
    const b = Number(m[2]);
    if (a > 12 && b <= 12) dmy++;
    else if (b > 12 && a <= 12) mdy++;
  }
  if (dmy && !mdy) return "dmy";
  if (mdy && !dmy) return "mdy";
  // Both present means the file is internally inconsistent. Refusing to decide
  // is right: half its dates would be wrong whichever way we went.
  return null;
}

/**
 * Parse a date to "yyyy-MM-dd", the shape the rest of the app stores.
 *
 * @param {string} value
 * @param {'dmy'|'mdy'} order  how to read an ambiguous slash date
 * @returns {string|null}
 */
export function parseImportDate(value, order = "dmy") {
  const raw = String(value ?? "").trim();
  if (!raw) return null;

  // ISO first, and unambiguous by construction.
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(raw);
  if (iso) return isoOrNull(Number(iso[1]), Number(iso[2]), Number(iso[3]));

  // "12 Mar 2026" / "Mar 12, 2026" -- a named month cannot be ambiguous.
  const named = /^(\d{1,2})\s+([a-z]+)\.?,?\s+(\d{4})$/i.exec(raw);
  if (named) {
    const month = MONTHS[named[2].toLowerCase().slice(0, 4)] || MONTHS[named[2].toLowerCase().slice(0, 3)];
    return month ? isoOrNull(Number(named[3]), month, Number(named[1])) : null;
  }
  const named2 = /^([a-z]+)\.?\s+(\d{1,2}),?\s+(\d{4})$/i.exec(raw);
  if (named2) {
    const month = MONTHS[named2[1].toLowerCase().slice(0, 4)] || MONTHS[named2[1].toLowerCase().slice(0, 3)];
    return month ? isoOrNull(Number(named2[3]), month, Number(named2[2])) : null;
  }

  const slash = /^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{2,4})$/.exec(raw);
  if (slash) {
    const a = Number(slash[1]);
    const b = Number(slash[2]);
    let year = Number(slash[3]);
    if (year < 100) year += year < 70 ? 2000 : 1900;

    // An unambiguous row overrules the file-level order: whatever the rest of
    // the file does, 25/12 can only be the 25th.
    let day;
    let month;
    if (a > 12 && b <= 12) {
      day = a;
      month = b;
    } else if (b > 12 && a <= 12) {
      day = b;
      month = a;
    } else {
      day = order === "mdy" ? b : a;
      month = order === "mdy" ? a : b;
    }
    return isoOrNull(year, month, day);
  }

  return null;
}

function isoOrNull(year, month, day) {
  if (!year || !month || !day) return null;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const d = new Date(Date.UTC(year, month - 1, day));
  // Round-tripped, so 31 February is rejected rather than rolled into March.
  if (d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day) return null;
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Two decimal places, matching the rounding used everywhere else. */
function money(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

const normaliseName = (s) => String(s || "").trim().replace(/\s+/g, " ").toLowerCase();

// ---- The plan ------------------------------------------------------------

/**
 * Match a spreadsheet row to an existing client.
 *
 * Email first: it is unique in practice and a person can be "Dana Reyes" in
 * one row and "Reyes, Dana" in another. Name second, normalised for case and
 * runs of whitespace. Never fuzzy -- a near-match that picks the wrong client
 * invoices the wrong company, and the person importing has no reason to
 * re-read a row that looked right.
 */
export function matchClient(row, clients = []) {
  const email = String(row.email || "").trim().toLowerCase();
  if (email) {
    const byEmail = clients.find((c) => String(c.email || "").trim().toLowerCase() === email);
    if (byEmail) return byEmail;
  }
  const name = normaliseName(row.client);
  if (name) {
    const byName = clients.filter((c) => normaliseName(c.name) === name);
    // Two clients with the same name is not a match, it is a question. Picking
    // one silently bills whichever happens to be first in the list.
    if (byName.length === 1) return byName[0];
    if (byName.length > 1) return { ambiguous: true, count: byName.length };
  }
  return null;
}

/**
 * Turn parsed rows into a plan of prospective invoices.
 *
 * @param {string[][]} rows       data rows, header already removed
 * @param {Record<string,number>} mapping  field key -> column index
 * @param {object} opts { clients, settings, dateOrder, defaultDueDate }
 * @returns {{ invoices: Array, dateOrder: string, ambiguousDates: boolean,
 *             counts: { ok: number, blocked: number, newClients: number } }}
 */
export function buildImportPlan(rows = [], mapping = {}, opts = {}) {
  const { clients = [], settings = {}, defaultDueDate = null } = opts;

  const cell = (row, key) => {
    const idx = mapping[key];
    if (idx === undefined || idx === null) return "";
    return row[idx] === undefined ? "" : String(row[idx]);
  };

  // Settled once for the whole file, from the file itself where it can be.
  const dateColumn = rows.map((r) => cell(r, "due_date")).filter(Boolean);
  const inferred = inferDateOrder(dateColumn);
  const dateOrder = inferred || opts.dateOrder || "dmy";
  const ambiguousDates = Boolean(dateColumn.length) && !inferred;

  const groups = new Map();

  rows.forEach((row, i) => {
    const lineNumber = i + 2; // 1-based, plus the header the caller removed.
    const raw = {
      client: cell(row, "client"),
      email: cell(row, "email"),
      description: cell(row, "description"),
      quantity: cell(row, "quantity"),
      rate: cell(row, "rate"),
      reference: cell(row, "reference"),
      due_date: cell(row, "due_date"),
      tax_rate: cell(row, "tax_rate"),
      notes: cell(row, "notes"),
    };

    // A row with nothing in it at all is skipped rather than reported: a
    // spreadsheet with a gap between two blocks is normal, and an error per
    // blank line buries the real ones.
    if (!Object.values(raw).some((v) => String(v).trim())) return;

    // Rows sharing a reference are ONE invoice; without one, rows are grouped
    // by client. A file of line items would otherwise become one invoice per
    // line, and a three-line job would send a client three emails.
    const key = raw.reference.trim()
      ? `ref:${raw.reference.trim().toLowerCase()}`
      : `client:${normaliseName(raw.client)}|${String(raw.email).trim().toLowerCase()}`;

    if (!groups.has(key)) {
      groups.set(key, {
        key,
        reference: raw.reference.trim() || null,
        clientName: raw.client.trim(),
        clientEmail: raw.email.trim(),
        items: [],
        notes: [],
        due_date: null,
        tax_rate: null,
        lines: [],
        errors: [],
        warnings: [],
      });
    }
    const group = groups.get(key);
    group.lines.push(lineNumber);
    // The first non-empty value wins for the invoice-level fields. Later rows
    // in the same group are line items, not a chance to change the client.
    if (!group.clientName && raw.client.trim()) group.clientName = raw.client.trim();
    if (!group.clientEmail && raw.email.trim()) group.clientEmail = raw.email.trim();

    const description = raw.description.trim();
    const quantity = raw.quantity.trim() ? parseMoney(raw.quantity) : 1;
    const rate = parseMoney(raw.rate);

    if (!description) {
      group.errors.push(`Line ${lineNumber}: no description`);
    } else if (rate === null) {
      group.errors.push(`Line ${lineNumber}: could not read a rate from "${raw.rate}"`);
    } else if (quantity === null) {
      group.errors.push(`Line ${lineNumber}: could not read a quantity from "${raw.quantity}"`);
    } else {
      group.items.push({
        description,
        quantity: money(quantity),
        rate: money(rate),
        amount: money(quantity * rate),
      });
    }

    if (raw.notes.trim()) group.notes.push(raw.notes.trim());

    if (raw.due_date.trim() && !group.due_date) {
      const parsed = parseImportDate(raw.due_date, dateOrder);
      if (parsed) group.due_date = parsed;
      else group.errors.push(`Line ${lineNumber}: could not read the date "${raw.due_date}"`);
    }

    if (raw.tax_rate.trim() && group.tax_rate === null) {
      const t = parseMoney(raw.tax_rate);
      if (t !== null) group.tax_rate = t;
    }
  });

  const invoices = Array.from(groups.values()).map((group) => {
    const match = matchClient({ client: group.clientName, email: group.clientEmail }, clients);
    const ambiguous = match && match.ambiguous;
    const client = ambiguous ? null : match;

    const errors = [...group.errors];
    if (!group.clientName && !group.clientEmail) {
      errors.push("No client on any of these rows");
    }
    if (ambiguous) {
      errors.push(`${match.count} of your clients are called "${group.clientName}" — pick one by email instead`);
    }
    if (!group.items.length) {
      errors.push("Nothing to bill on this invoice");
    }

    const subtotal = money(group.items.reduce((sum, i) => sum + i.amount, 0));
    const taxRate = group.tax_rate ?? Number(settings?.tax_rate) ?? 0;
    const tax_amount = money((subtotal * (Number(taxRate) || 0)) / 100);
    const total = money(subtotal + tax_amount);

    if (!errors.length && total <= 0) {
      errors.push("This invoice comes to $0.00");
    }

    // A client that does not exist yet is NOT an error. It is the ordinary
    // case for a first import, and the review screen offers to create them --
    // explicitly, with a count, because silently creating clients from a
    // spreadsheet is how an account fills with typo'd duplicates.
    const isNewClient = !client && Boolean(group.clientName);

    return {
      key: group.key,
      reference: group.reference,
      lines: group.lines,
      client,
      clientId: client?.id || null,
      clientName: client?.name || group.clientName,
      clientEmail: client?.email || group.clientEmail || "",
      isNewClient,
      items: group.items,
      subtotal,
      tax_rate: Number(taxRate) || 0,
      tax_amount,
      total,
      due_date: group.due_date || defaultDueDate || null,
      notes: group.notes.join("\n"),
      errors,
      warnings: group.warnings,
      ok: errors.length === 0,
    };
  });

  return {
    invoices,
    dateOrder,
    ambiguousDates,
    counts: {
      ok: invoices.filter((i) => i.ok).length,
      blocked: invoices.filter((i) => !i.ok).length,
      newClients: invoices.filter((i) => i.ok && i.isNewClient).length,
    },
  };
}

/**
 * The other door: the same invoice for several clients at once.
 *
 * Retainers, a monthly maintenance line, the same call-out across a block of
 * units. Produces the identical plan shape, so the review table and the
 * creation path do not know which door was used.
 */
export function buildPlanFromClients(clients = [], template = {}, opts = {}) {
  const { settings = {} } = opts;
  const rawItems = Array.isArray(template.items) ? template.items : [];

  const items = rawItems
    .filter((i) => String(i?.description || "").trim())
    .map((i) => {
      const quantity = Number(i.quantity) || 0;
      const rate = Number(i.rate) || 0;
      return {
        description: String(i.description).trim(),
        quantity: money(quantity),
        rate: money(rate),
        amount: money(quantity * rate),
      };
    });

  const subtotal = money(items.reduce((sum, i) => sum + i.amount, 0));
  const taxRate = Number(template.tax_rate ?? settings?.tax_rate ?? 0) || 0;
  const tax_amount = money((subtotal * taxRate) / 100);
  const total = money(subtotal + tax_amount);

  const invoices = clients.map((client) => {
    const errors = [];
    if (!items.length) errors.push("Nothing to bill on this invoice");
    else if (total <= 0) errors.push("This invoice comes to $0.00");

    return {
      key: `client:${client.id}`,
      reference: null,
      lines: [],
      client,
      clientId: client.id,
      clientName: client.name || "",
      clientEmail: client.email || "",
      // These already exist -- that is how they were picked.
      isNewClient: false,
      items,
      subtotal,
      tax_rate: taxRate,
      tax_amount,
      total,
      due_date: template.due_date || null,
      notes: String(template.notes || ""),
      errors,
      warnings: [],
      ok: errors.length === 0,
    };
  });

  return {
    invoices,
    dateOrder: "dmy",
    ambiguousDates: false,
    counts: {
      ok: invoices.filter((i) => i.ok).length,
      blocked: invoices.filter((i) => !i.ok).length,
      newClients: 0,
    },
  };
}

// ---- Numbering -----------------------------------------------------------

/**
 * Allocate `count` invoice numbers that do not collide.
 *
 * The app's existing scheme is `${prefix}-${Date.now().toString().slice(-6)}`,
 * evaluated per invoice. In a loop that creates thirty invoices, the whole
 * batch can land inside the same millisecond and every one of them gets the
 * SAME number -- thirty invoices a contractor cannot tell apart, in an audit
 * trail that depends on the number being unique.
 *
 * So a batch allocates up front: one timestamp seed, then consecutive numbers,
 * skipping anything already taken. Sequential within a batch is also more
 * useful than random -- an import of thirty invoices reads as a run.
 *
 * (The per-invoice scheme has a smaller version of the same problem: the last
 * six digits of a millisecond timestamp repeat every 16m40s. That is not fixed
 * here, but this batch will not add to it -- `taken` is checked.)
 *
 * @param {string} prefix
 * @param {number} count
 * @param {Iterable<string>} taken  invoice numbers already in use
 */
export function allocateInvoiceNumbers(prefix, count, taken = [], now = Date.now()) {
  const used = new Set(Array.from(taken, (t) => String(t || "").trim().toUpperCase()));
  const p = String(prefix || "INV").trim() || "INV";
  const out = [];

  let n = Number(String(now).slice(-6));
  if (!Number.isFinite(n)) n = 0;

  let guard = 0;
  while (out.length < count && guard < 1_000_000) {
    const candidate = `${p}-${String(n % 1_000_000).padStart(6, "0")}`;
    n = (n + 1) % 1_000_000;
    guard++;
    if (used.has(candidate.toUpperCase())) continue;
    used.add(candidate.toUpperCase());
    out.push(candidate);
  }
  return out;
}

// ---- Creating ------------------------------------------------------------

/**
 * Create every invoice in a plan, one at a time, reporting as it goes.
 *
 * Sequential and never throwing, for the same reasons sendInvoiceBatch is:
 * a run that dies half way and reports nothing leaves the contractor unable to
 * tell which invoices exist, and retrying blind duplicates the ones that
 * worked.
 *
 * Everything is created as a DRAFT. Nothing is sent -- the batch send that
 * already exists is the next step, deliberately a separate decision, because
 * "create thirty invoices" and "email thirty clients" should not be one button.
 *
 * Dependencies are injected rather than imported so this runs without a
 * browser or a network in tests.
 *
 * @param {object} plan  from buildImportPlan or buildPlanFromClients
 * @param {object} deps  { createInvoice, createClient, userId, invoiceNumbers,
 *                         createMissingClients }
 * @param {Function} [onProgress] (doneCount, result)
 */
export async function createInvoiceBatch(plan, deps, onProgress) {
  const {
    createInvoice,
    createClient,
    userId,
    invoiceNumbers = [],
    createMissingClients = false,
  } = deps || {};

  const rows = (plan?.invoices || []).filter((i) => i.ok);
  const results = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const invoice_number = invoiceNumbers[i] || null;
    const result = {
      key: row.key,
      clientName: row.clientName,
      invoice_number,
      created: false,
      createdClient: false,
      id: null,
      error: null,
    };

    try {
      let clientId = row.clientId;

      if (!clientId && row.isNewClient) {
        if (!createMissingClients) {
          // Not an error: the plan said this client is new, and the operator
          // chose not to create clients. Skipped and reported, so the count
          // adds up.
          result.error = "Client does not exist yet";
          results.push(result);
          if (onProgress) onProgress(results.length, result);
          continue;
        }
        const created = await createClient({
          user_id: userId,
          name: row.clientName,
          email: row.clientEmail || null,
        });
        clientId = created?.id || null;
        result.createdClient = Boolean(clientId);
      }

      const invoice = await createInvoice({
        user_id: userId,
        invoice_number,
        client_id: clientId,
        client_name: row.clientName,
        client_email: row.clientEmail || null,
        items: row.items,
        subtotal: row.subtotal,
        tax_rate: row.tax_rate,
        tax_amount: row.tax_amount,
        total: row.total,
        // Draft, always. Creating and sending are two decisions.
        status: "draft",
        due_date: row.due_date || null,
        notes: row.notes || "",
      });

      result.created = Boolean(invoice?.id);
      result.id = invoice?.id || null;
      if (!result.created) result.error = "The invoice was not created";
    } catch (err) {
      result.error = err?.message || "Could not create this invoice";
    }

    results.push(result);
    if (onProgress) onProgress(results.length, result);
  }

  const created = results.filter((r) => r.created);
  return {
    results,
    created: created.length,
    failed: results.length - created.length,
    total: results.length,
    clientsCreated: results.filter((r) => r.createdClient).length,
  };
}
