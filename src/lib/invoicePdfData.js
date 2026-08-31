// Maps real Supabase rows onto the InvoiceData shape InvoiceDocument.jsx expects.
//
// Source tables (see supabase/schema.sql -- note the quoted PascalCase names):
//
//   "Invoice"          items jsonb, subtotal, tax_rate, tax_amount, total,
//                      client_name/email/phone/address (denormalised onto the
//                      row), client_id -> "Client", payment_terms, notes,
//                      due_date, created_at
//   "BusinessSettings" business_name, email, phone, address, website,
//                      tax_rate, payment_terms
//   "Client"           name, email, phone, address  (optional fallback only --
//                      the Invoice row normally carries its own copy, which is
//                      the one that was true when the invoice was issued)
//
// There is no separate line-items table: line items are the `items` jsonb array
// on the invoice, shaped { description, quantity, rate, total }.

import { format, isValid, parseISO } from "date-fns";
import { resolveInvoiceTheme } from "@/lib/invoiceTheme";
import { resolveBrand } from "@/lib/invoiceBrand";

/**
 * Format a timestamptz / ISO string the way the template wants it: "Aug 20, 2026".
 *
 * Due dates are entered as a plain "yyyy-MM-dd" (CreateInvoice.jsx:426) and land
 * in a timestamptz column, so they come back as midnight UTC. Formatting that in
 * local time west of Greenwich -- i.e. everywhere in Canada -- renders the day
 * before, so an invoice due Sep 19 prints "Sep 18". Anything sitting exactly on
 * midnight UTC is therefore treated as a calendar date and read off its UTC
 * parts; real timestamps (created_at) still format in local time.
 */
function formatDate(value) {
  if (!value) return "—";

  if (typeof value === "string") {
    const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
    if (dateOnly) {
      const [, y, m, day] = dateOnly;
      return format(new Date(Number(y), Number(m) - 1, Number(day)), "MMM d, yyyy");
    }
  }

  const d = typeof value === "string" ? parseISO(value) : new Date(value);
  if (!isValid(d)) return "—";

  const isCalendarDate =
    d.getUTCHours() === 0 &&
    d.getUTCMinutes() === 0 &&
    d.getUTCSeconds() === 0 &&
    d.getUTCMilliseconds() === 0;

  if (isCalendarDate) {
    return format(
      new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
      "MMM d, yyyy",
    );
  }

  return format(d, "MMM d, yyyy");
}

/** Join the non-empty parts of a contact line with a bullet separator. */
function contactLine(parts) {
  return parts.filter((p) => p && String(p).trim()).join(" • ");
}

/**
 * The DB stores tax_rate as a PERCENT (13 means 13% HST); the PDF template
 * wants a FRACTION (0.13). Getting this wrong renders 1300%.
 *
 * Uses ?? rather than || throughout so a deliberate 0 -- a tax-exempt or
 * out-of-province client -- survives instead of falling through to the
 * business default. taxRate 0 makes the template omit the tax row entirely.
 */
export function resolveTaxRate(invoice = {}, settings = {}) {
  const percent = invoice.tax_rate ?? settings.tax_rate ?? 0;
  const n = Number(percent);
  return Number.isFinite(n) ? n / 100 : 0;
}

/**
 * @param {object}  invoice    a row from public."Invoice"
 * @param {object}  settings   a row from public."BusinessSettings"
 * @param {object} [options]
 * @param {object} [options.client]  a row from public."Client", used only to
 *                                   fill gaps the invoice row does not carry
 * @param {object} [options.job]     a row from public."Job", for jobLocation
 * @param {string} [options.paymentDetails]  e.g. an e-transfer address or the
 *                                   Stripe payment link, if you want it printed
 * @returns {import("@/components/invoice/InvoiceDocument").InvoiceData}
 */
export function mapInvoiceToPdfData(invoice = {}, settings = {}, options = {}) {
  const { client = null, job = null, paymentDetails } = options;

  // `items` is jsonb; PostgREST hands it back parsed, but seeded/local rows have
  // been seen as a JSON string, so tolerate both.
  let rawItems = invoice.items ?? [];
  if (typeof rawItems === "string") {
    try {
      rawItems = JSON.parse(rawItems || "[]");
    } catch {
      rawItems = [];
    }
  }
  if (!Array.isArray(rawItems)) rawItems = [];

  const lineItems = rawItems.map((item) => ({
    description: String(item?.description ?? ""),
    // The DB calls it `quantity`; the template calls it `qty`.
    qty: Number(item?.quantity ?? item?.qty ?? 0),
    rate: Number(item?.rate ?? 0),
    // Neither is written today -- nothing in CreateInvoice.jsx produces them --
    // but both are carried through so the Complex template's grouping and unit
    // column light up on their own if the item shape ever grows them, rather
    // than needing this mapper changed again.
    category: item?.category ?? item?.section ?? undefined,
    unit: item?.unit ?? undefined,
  }));

  return {
    // Everything from the branding settings that is not colour: the logo, the
    // font, the footer line, and whether our name appears at all. resolveBrand
    // also supplies businessName, which the Professional template used to
    // print in 9pt grey under a hardcoded 17pt "INVOICIUM".
    ...resolveBrand(settings, { logo: options.logo }),

    // What kind of document this is. Defaulted here rather than inside each
    // template, so a quote reuses all three layouts by overriding four strings
    // -- see mapQuoteToPdfData below.
    documentTitle: "INVOICE",
    documentLabel: "Invoice",
    dueDateLabel: "Due",
    totalLabel: "Total Due",

    // businessName deliberately NOT repeated here -- resolveBrand above owns
    // it. Two lines computing the same name is how one of them gets changed.
    businessAddress: settings.address || "",
    businessContact: contactLine([
      settings.phone,
      settings.email,
      settings.website,
    ]),

    invoiceNumber: String(invoice.invoice_number ?? ""),
    invoiceDate: formatDate(invoice.created_at),
    dueDate: formatDate(invoice.due_date),

    clientName: invoice.client_name || client?.name || "Client",
    // "Client" has no company column; left undefined unless a caller adds one.
    clientCompany: undefined,
    clientAddress: invoice.client_address || client?.address || undefined,
    clientContact:
      contactLine([
        invoice.client_phone || client?.phone,
        invoice.client_email || client?.email,
      ]) || undefined,

    jobLocation: job?.location || undefined,
    terms:
      invoice.payment_terms || settings.payment_terms || "Due on receipt",

    lineItems,
    taxRate: resolveTaxRate(invoice, settings),

    paymentDetails: paymentDetails || undefined,
    notes: invoice.notes || undefined,

    // Per-business colours. resolveInvoiceTheme fills anything unset from the
    // default, so a business that never opened the branding settings renders
    // exactly as it did before theming existed.
    theme: resolveInvoiceTheme(settings),
  };
}

/**
 * Map the same rows onto the RICHER shape InvoiceDocumentComplex.jsx expects.
 *
 * The Complex layout was designed for data this schema does not carry yet:
 *
 *   sections   "Invoice".items is a flat array with no category, so items are
 *              grouped by an optional `category`/`section` field if one is ever
 *              written, and otherwise land in a single untitled-by-default
 *              section. No item is dropped either way.
 *   taxes      there is one `tax_rate` column, so this emits at most one tax
 *              line. Separate GST/PST needs two columns before it can be real.
 *   discount   there is no discount column -- omitted entirely rather than
 *              printing a zero line that implies one was applied.
 *
 * Fields with no home in the schema (businessNumber, poNumber, jobReference,
 * projectManager) are accepted through `options` so a caller can supply them,
 * and render as an em dash otherwise.
 *
 * @param {object}  invoice   a row from public."Invoice"
 * @param {object}  settings  a row from public."BusinessSettings"
 * @param {object} [options]  everything mapInvoiceToPdfData takes, plus
 *                            { sectionTitle, poNumber, jobReference,
 *                              projectManager, businessNumber, requireSignature }
 * @returns {import("@/components/invoice/InvoiceDocumentComplex").ComplexInvoiceData}
 */
export function mapInvoiceToComplexPdfData(invoice = {}, settings = {}, options = {}) {
  const base = mapInvoiceToPdfData(invoice, settings, options);
  const {
    sectionTitle = "Services",
    poNumber,
    jobReference,
    projectManager,
    businessNumber,
    requireSignature = false,
  } = options;

  // Preserve the order categories first appear in, so the PDF matches the order
  // the contractor entered the work rather than an alphabetical reshuffle.
  const grouped = new Map();
  for (const li of base.lineItems) {
    const title = li.category || li.section || sectionTitle;
    if (!grouped.has(title)) grouped.set(title, []);
    grouped.get(title).push({
      description: li.description,
      qty: li.qty,
      unit: li.unit,
      rate: li.rate,
    });
  }

  const taxRate = base.taxRate;

  return {
    ...base,
    businessNumber: businessNumber || undefined,
    poNumber: poNumber || undefined,
    jobReference: jobReference || undefined,
    projectManager: projectManager || undefined,

    sections: grouped.size
      ? Array.from(grouped, ([title, lineItems]) => ({ title, lineItems }))
      : [{ title: sectionTitle, lineItems: [] }],

    taxes: taxRate
      ? [{ label: `HST / Tax (${Math.round(taxRate * 100)}%)`, rate: taxRate }]
      : [],

    // One detail per line; the template renders each as its own row.
    bankDetails: base.paymentDetails
      ? String(base.paymentDetails).split("\n").filter(Boolean)
      : undefined,
    terms: base.terms,
    requireSignature: Boolean(requireSignature),
  };
}


/**
 * Map a "Quote" row onto the same shape, so quotes render through the same
 * three templates as invoices.
 *
 * -- Why a quote is mapped THROUGH the invoice mapper ----------------------
 *
 * Quote PDFs were built separately: a pdf-lib renderer in the
 * generate-quote-pdf Edge Function, with its colours hardcoded as
 * rgb(0.06, 0.72, 0.51) -- #10b981, this app's RETIRED brand green. So a
 * contractor who set their brand colour, uploaded a logo and chose a layout got
 * all of it on their invoices and none of it on their quotes, which went out in
 * a green nobody had chosen since the rebrand.
 *
 * Rather than port the theming into a second renderer, a quote is reshaped into
 * the fields the invoice mapper already understands and delegated. Every rule
 * that matters -- the jsonb items that might be a string, tax_rate as a percent
 * not a fraction, the midnight-UTC date that renders a day early west of
 * Greenwich -- is written once and applies to both. A second implementation is
 * a second place for those to be got wrong.
 *
 * The four document strings are the entire difference.
 *
 * @param {object}  quote     a row from public."Quote"
 * @param {object}  settings  a row from public."BusinessSettings"
 * @param {object} [options]  as mapInvoiceToPdfData, plus { logo }
 */
export function mapQuoteToPdfData(quote = {}, settings = {}, options = {}) {
  const { client = null } = options;

  const asInvoice = {
    items: quote.items,
    tax_rate: quote.tax_rate,
    invoice_number: quote.quote_number,
    // A quote's issue date is its own column; created_at is the fallback for
    // rows written before date_issued was set.
    created_at: quote.date_issued || quote.created_at,
    due_date: quote.expiry_date,
    client_name: quote.client_name,
    client_email: quote.client_email,
    // "Quote" carries no client_phone or client_address columns -- unlike
    // "Invoice", which denormalises both onto the row. They can only come from
    // the Client, so a caller that does not pass one gets a quote with a name
    // and an email, which is what the old renderer produced too.
    client_phone: client?.phone,
    client_address: client?.address,
    notes: quote.notes,
  };

  return {
    ...mapInvoiceToPdfData(asInvoice, settings, options),
    documentTitle: "QUOTE",
    documentLabel: "Quote",
    // Not "Due". A quote has an expiry, and telling a client that a quote is
    // "due" on a date invites them to think they owe money for it.
    dueDateLabel: "Valid until",
    totalLabel: "Quote Total",
  };
}

/** The Complex layout, for a quote. Same delegation, same four overrides. */
export function mapQuoteToComplexPdfData(quote = {}, settings = {}, options = {}) {
  const flat = mapQuoteToPdfData(quote, settings, options);
  const complex = mapInvoiceToComplexPdfData(
    { items: quote.items, tax_rate: quote.tax_rate },
    settings,
    options,
  );
  return { ...complex, ...flat, sections: complex.sections, taxes: complex.taxes };
}

export default mapInvoiceToPdfData;
