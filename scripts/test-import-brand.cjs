/**
 * The rules behind bulk invoice creation and PDF branding.
 *
 * -- What is actually at risk ----------------------------------------------
 *
 * Bulk creation fails quietly and expensively. A CSV parser that splits on
 * commas turns a client called "Reyes, Dana" into two columns and shifts every
 * field after it, so the rate lands in the notes. A date read month-first
 * instead of day-first sets a due date up to eleven months out, and the invoice
 * simply never gets chased. One row per line item instead of one invoice per
 * job sends a client three emails for one job. And thirty invoices created in a
 * loop all take `Date.now().toString().slice(-6)` inside the same millisecond
 * and come out with the SAME number.
 *
 * None of those throw. Every one of them produces a plausible-looking invoice
 * for the wrong amount, the wrong date, or the wrong number of clients.
 *
 * The branding half has one check that matters more than the rest:
 * showsPoweredBy must be false for an unset column. The checkbox read
 * `!== false` while nothing rendered the line, so honouring it as written would
 * have printed our name on every existing customer's invoices without anyone
 * choosing it.
 *
 * Usage: node scripts/test-import-brand.cjs
 */
const fs = require("fs");
const os = require("os");
const path = require("path");
const esbuild = require("esbuild");

const ROOT = path.join(__dirname, "..");

let passed = 0, failed = 0;
function check(label, cond, detail) {
  if (cond) { passed++; console.log(`  PASS  ${label}`); }
  else { failed++; console.log(`  FAIL  ${label}${detail !== undefined ? ` -- ${detail}` : ""}`); }
}

/** Bundled, so `@/` imports resolve the way vite resolves them. */
async function load(rel) {
  const result = await esbuild.build({
    entryPoints: [path.join(ROOT, rel)],
    bundle: true,
    write: false,
    format: "esm",
    platform: "neutral",
    target: "es2022",
    plugins: [{
      name: "vite-alias",
      setup(build) {
        build.onResolve({ filter: /^@\// }, (args) => ({
          path: path.join(ROOT, "src", args.path.slice(2)) + ".js",
        }));
      },
    }],
  });
  const tmp = path.join(os.tmpdir(), `${path.basename(rel)}-${process.pid}.mjs`);
  fs.writeFileSync(tmp, result.outputFiles[0].text);
  const mod = await import("file://" + tmp.replace(/\\/g, "/"));
  fs.unlinkSync(tmp);
  return mod;
}

const j = JSON.stringify;

async function main() {
  const I = await load("src/lib/invoiceImport.js");
  const B = await load("src/lib/invoiceBrand.js");

  // ---- Reading the file ------------------------------------------------
  console.log("\nreading a spreadsheet\n");

  check("plain rows", j(I.parseDelimited("a,b\n1,2")) === j([["a", "b"], ["1", "2"]]));

  check(
    "A COMMA INSIDE QUOTES IS NOT A COLUMN BREAK",
    j(I.parseDelimited('client,rate\n"Reyes, Dana",450')) ===
      j([["client", "rate"], ["Reyes, Dana", "450"]]),
    "split(',') shifts every field after it and bills the wrong number",
  );
  check(
    "a newline inside quotes is not a row break",
    j(I.parseDelimited('a,b\n"line one\nline two",5')) ===
      j([["a", "b"], ["line one\nline two", "5"]]),
  );
  check(
    'an escaped "" is one literal quote',
    j(I.parseDelimited('a\n"say ""hi"""')) === j([["a"], ['say "hi"']]),
  );
  check("CRLF is handled", j(I.parseDelimited("a,b\r\n1,2\r\n")) === j([["a", "b"], ["1", "2"]]));
  check(
    "Excel's UTF-8 BOM does not become part of the first header",
    I.parseDelimited("﻿client,rate\nx,1")[0][0] === "client",
    j(I.parseDelimited("﻿client,rate\nx,1")[0][0]),
  );
  check("blank lines are skipped", I.parseDelimited("a,b\n\n1,2\n\n").length === 2);
  check(
    "an unquoted field is trimmed but a quoted one is not",
    j(I.parseDelimited('a,b\n  x  ,"  y  "')) === j([["a", "b"], ["x", "  y  "]]),
  );
  check("a ragged row keeps its own length", I.parseDelimited("a,b,c\n1,2")[1].length === 2);

  check("tabs are detected", I.detectDelimiter("a\tb\tc\n1\t2\t3") === "\t");
  check("semicolons are detected", I.detectDelimiter("a;b;c") === ";");
  check("commas by default", I.detectDelimiter("a,b,c") === ",");
  check(
    "a comma inside a quoted HEADER does not outvote the real delimiter",
    I.detectDelimiter('"a,b"\tc') === "\t",
    j(I.detectDelimiter('"a,b"\tc')),
  );

  // ---- Reading a number ------------------------------------------------
  console.log("\nreading an amount\n");

  check("$1,234.56", I.parseMoney("$1,234.56") === 1234.56, I.parseMoney("$1,234.56"));
  check("1.234,56 (European)", I.parseMoney("1.234,56") === 1234.56, I.parseMoney("1.234,56"));
  check("1234,56 (comma decimal)", I.parseMoney("1234,56") === 1234.56, I.parseMoney("1234,56"));
  check("1,234 (thousands)", I.parseMoney("1,234") === 1234, I.parseMoney("1,234"));
  check("1.234 stays 1.234, not 1234", I.parseMoney("1.234") === 1.234, I.parseMoney("1.234"));
  check("1.234.567 is thousands", I.parseMoney("1.234.567") === 1234567, I.parseMoney("1.234.567"));
  check("(45.00) is negative", I.parseMoney("(45.00)") === -45, I.parseMoney("(45.00)"));
  check("-12.5", I.parseMoney("-12.5") === -12.5);
  check("a plain number passes through", I.parseMoney(87) === 87);
  check("zero is zero, not null", I.parseMoney("$0.00") === 0);
  check(
    "UNREADABLE IS NULL, NOT ZERO",
    I.parseMoney("ask Dave") === null && I.parseMoney("") === null,
    "billing $0 for a rate nobody could read is the failure this prevents",
  );
  check(
    "and still null when it is digits that do not make a number",
    I.parseMoney("1.2.3") === null && I.parseMoney("..") === null,
    // "ask Dave" is stripped to nothing and returns early, so it never reaches
    // the final Number() at all. Without a case that gets that far, replacing
    // that last `return null` with `return 0` passes every other check here --
    // measured, not assumed: it survived a mutation run.
    `1.2.3 -> ${I.parseMoney("1.2.3")}`,
  );

  // ---- Reading a date --------------------------------------------------
  console.log("\nreading a date\n");

  check("a file with 25/12 in it is day-first", I.inferDateOrder(["03/04/2026", "25/12/2026"]) === "dmy");
  check("a file with 12/25 in it is month-first", I.inferDateOrder(["03/04/2026", "12/25/2026"]) === "mdy");
  check(
    "a file containing both refuses to decide",
    I.inferDateOrder(["25/12/2026", "12/25/2026"]) === null,
    "half its dates would be wrong either way",
  );
  check("a file with nothing to go on refuses too", I.inferDateOrder(["03/04/2026"]) === null);

  check("ISO is read as ISO", I.parseImportDate("2026-03-04") === "2026-03-04");
  check("03/04/2026 day-first is 4 March", I.parseImportDate("03/04/2026", "dmy") === "2026-04-03");
  check("03/04/2026 month-first is 4 March", I.parseImportDate("03/04/2026", "mdy") === "2026-03-04");
  check(
    "an unambiguous row overrules the file's order",
    I.parseImportDate("25/12/2026", "mdy") === "2026-12-25",
    I.parseImportDate("25/12/2026", "mdy"),
  );
  check("12 Mar 2026", I.parseImportDate("12 Mar 2026") === "2026-03-12");
  check("Mar 12, 2026", I.parseImportDate("Mar 12, 2026") === "2026-03-12");
  check("a two-digit year", I.parseImportDate("04/03/26", "dmy") === "2026-03-04");
  check(
    "31 February is refused rather than rolled into March",
    I.parseImportDate("2026-02-31") === null,
  );
  check("nonsense is null", I.parseImportDate("next Tuesday") === null);

  // ---- Matching the columns --------------------------------------------
  console.log("\nmatching the columns\n");

  const guessed = I.guessColumnMapping([
    "Client Name", "Email", "Description", "Qty", "Rate", "Due Date",
  ]);
  check("headers are recognised however they are written",
    guessed.client === 0 && guessed.email === 1 && guessed.description === 2 &&
    guessed.quantity === 3 && guessed.rate === 4 && guessed.due_date === 5, j(guessed));
  check(
    "a column is claimed once, so Rate wins over Amount",
    I.guessColumnMapping(["Amount", "Rate"]).rate === 1,
    j(I.guessColumnMapping(["Amount", "Rate"])),
  );
  check("an unrecognised header maps to nothing",
    I.guessColumnMapping(["widget", "sprocket"]).client === undefined);
  check("a header row is recognised", I.looksLikeHeaderRow(["Client", "Rate"]));
  check(
    "a row with a real amount in it is data, not a header",
    I.looksLikeHeaderRow(["Dana Reyes", "450"]) === false,
    j(I.looksLikeHeaderRow(["Dana Reyes", "450"])),
  );
  check("a numeric row is not a header", !I.looksLikeHeaderRow(["1", "2", "3"]));

  // ---- Building the plan -----------------------------------------------
  console.log("\nbuilding the invoices\n");

  const clients = [
    { id: "c-dana", name: "Dana Reyes", email: "dana@example.com" },
    { id: "c-ruth", name: "Ruth Okafor", email: "ruth@example.com" },
    { id: "c-twin-a", name: "Twin Co", email: "a@twin.example" },
    { id: "c-twin-b", name: "Twin Co", email: "b@twin.example" },
  ];
  const settings = { tax_rate: 13, invoice_prefix: "INV" };

  const csv = [
    "client,email,description,qty,rate,due date",
    "Dana Reyes,dana@example.com,Site visit,2,150,2026-04-30",
    "Dana Reyes,dana@example.com,Materials,1,320,2026-04-30",
    "Ruth Okafor,ruth@example.com,Repair,1,90,2026-05-15",
  ].join("\n");
  const rows = I.parseDelimited(csv);
  const mapping = I.guessColumnMapping(rows[0]);
  const plan = I.buildImportPlan(rows.slice(1), mapping, { clients, settings });

  check(
    "THREE ROWS FOR TWO CLIENTS BECOME TWO INVOICES, NOT THREE",
    plan.invoices.length === 2,
    `${plan.invoices.length} invoices -- one per row would mail Dana twice for one job`,
  );
  const dana = plan.invoices.find((i) => i.clientId === "c-dana");
  check("Dana's two lines are on one invoice", dana.items.length === 2);
  check("with the right subtotal", dana.subtotal === 620, dana.subtotal);
  check("tax from the business settings", dana.tax_rate === 13 && dana.tax_amount === 80.6, j([dana.tax_rate, dana.tax_amount]));
  check("and a total that adds up", dana.total === 700.6, dana.total);
  check("the due date is carried", dana.due_date === "2026-04-30", dana.due_date);
  check("the client is matched to a real row", dana.client?.id === "c-dana");
  check("every invoice is clean", plan.counts.ok === 2 && plan.counts.blocked === 0, j(plan.counts));

  // Grouping by an explicit reference, across what would otherwise be groups.
  const refPlan = I.buildImportPlan(
    [["Dana Reyes", "", "A", "1", "10", "JOB-1"], ["Dana Reyes", "", "B", "1", "20", "JOB-2"]],
    { client: 0, email: 1, description: 2, quantity: 3, rate: 4, reference: 5 },
    { clients, settings: {} },
  );
  check(
    "two references for one client are two invoices",
    refPlan.invoices.length === 2,
    "a reference column is how one client gets separate jobs billed separately",
  );

  // Errors.
  const bad = I.buildImportPlan(
    [
      ["Dana Reyes", "dana@example.com", "", "1", "10"],
      ["Ruth Okafor", "ruth@example.com", "Work", "1", "ask Dave"],
      ["", "", "Orphan", "1", "10"],
      ["Twin Co", "", "Work", "1", "10"],
      ["Nobody Ltd", "new@example.com", "Work", "1", "10"],
    ],
    { client: 0, email: 1, description: 2, quantity: 3, rate: 4 },
    { clients, settings: {} },
  );
  const byName = (n) => bad.invoices.find((i) => i.clientName === n);
  check("a row with no description is reported", /no description/.test(byName("Dana Reyes").errors.join()));
  check("an unreadable rate is reported with the text that failed",
    /ask Dave/.test(byName("Ruth Okafor").errors.join()), j(byName("Ruth Okafor").errors));
  check("a row with no client at all is blocked",
    bad.invoices.some((i) => /No client/.test(i.errors.join())));
  check(
    "TWO CLIENTS WITH THE SAME NAME IS A QUESTION, NOT A MATCH",
    /2 of your clients are called/.test(byName("Twin Co").errors.join()),
    "picking the first would bill whichever happens to sort first",
  );
  check("an unknown client is NOT an error, it is a new client",
    byName("Nobody Ltd").isNewClient === true && byName("Nobody Ltd").ok === true);
  check("and is counted so the operator can opt in", bad.counts.newClients === 1, j(bad.counts));

  check(
    "email matches before name does",
    I.matchClient({ client: "Totally Different", email: "ruth@example.com" }, clients)?.id === "c-ruth",
  );
  check(
    "name matching ignores case and extra spaces",
    I.matchClient({ client: "  dana   reyes ", email: "" }, clients)?.id === "c-dana",
  );
  check("no match is null", I.matchClient({ client: "Nobody", email: "" }, clients) === null);

  const zero = I.buildImportPlan(
    [["Dana Reyes", "", "Free advice", "1", "0"]],
    { client: 0, email: 1, description: 2, quantity: 3, rate: 4 },
    { clients, settings: {} },
  );
  check("a $0 invoice is blocked rather than created", !zero.invoices[0].ok, j(zero.invoices[0].errors));

  const blank = I.buildImportPlan(
    [["", "", "", "", ""], ["Dana Reyes", "", "Work", "1", "10"]],
    { client: 0, email: 1, description: 2, quantity: 3, rate: 4 },
    { clients, settings: {} },
  );
  check("an entirely blank row is skipped silently", blank.invoices.length === 1);

  const noQty = I.buildImportPlan(
    [["Dana Reyes", "", "Work", "", "45"]],
    { client: 0, email: 1, description: 2, quantity: 3, rate: 4 },
    { clients, settings: {} },
  );
  check("a missing quantity defaults to 1", noQty.invoices[0].total === 45, noQty.invoices[0].total);

  const ambiguousFile = I.buildImportPlan(
    [["Dana Reyes", "", "Work", "1", "10", "03/04/2026"]],
    { client: 0, email: 1, description: 2, quantity: 3, rate: 4, due_date: 5 },
    { clients, settings: {} },
  );
  check(
    "a file whose dates could go either way says so",
    ambiguousFile.ambiguousDates === true,
    "the UI has to show which reading it took",
  );

  // ---- The other door --------------------------------------------------
  console.log("\nthe same invoice for several clients\n");

  const fromClients = I.buildPlanFromClients(
    [clients[0], clients[1]],
    { items: [{ description: "Monthly maintenance", quantity: 1, rate: 450 }], tax_rate: 5 },
    { settings },
  );
  check("one invoice per client", fromClients.invoices.length === 2);
  check("each with the shared line", fromClients.invoices[0].items[0].description === "Monthly maintenance");
  check("the template tax rate beats the business default",
    fromClients.invoices[0].tax_rate === 5 && fromClients.invoices[0].total === 472.5,
    j([fromClients.invoices[0].tax_rate, fromClients.invoices[0].total]));
  check("nobody is a new client -- they were picked from the list",
    fromClients.counts.newClients === 0);
  check(
    "an empty template blocks every row rather than creating empties",
    I.buildPlanFromClients([clients[0]], { items: [] }, {}).counts.ok === 0,
  );

  // ---- Numbering -------------------------------------------------------
  console.log("\ninvoice numbers\n");

  const nums = I.allocateInvoiceNumbers("INV", 30, [], 1_700_000_123_456);
  check("one per invoice", nums.length === 30);
  check(
    "THIRTY INVOICES GET THIRTY DIFFERENT NUMBERS",
    new Set(nums).size === 30,
    "Date.now().slice(-6) per invoice gives a tight loop the same number every time",
  );
  check("they use the prefix", nums.every((n) => n.startsWith("INV-")), nums[0]);
  check("and are consecutive", nums[1] === "INV-123457", `${nums[0]} then ${nums[1]}`);
  check(
    "a number already in use is skipped",
    !I.allocateInvoiceNumbers("INV", 3, ["INV-123457"], 1_700_000_123_456).includes("INV-123457"),
  );
  check("matching is case-insensitive",
    !I.allocateInvoiceNumbers("INV", 3, ["inv-123456"], 1_700_000_123_456).includes("INV-123456"));
  check("it wraps rather than running past six digits",
    I.allocateInvoiceNumbers("INV", 3, [], 1_700_000_999_999)[1] === "INV-000000",
    j(I.allocateInvoiceNumbers("INV", 3, [], 1_700_000_999_999)));
  check("a blank prefix falls back to INV",
    I.allocateInvoiceNumbers("  ", 1, [], 1_700_000_123_456)[0] === "INV-123456");

  // ---- Creating --------------------------------------------------------
  console.log("\ncreating them\n");

  const made = [];
  const madeClients = [];
  const deps = (over = {}) => ({
    userId: "u1",
    invoiceNumbers: I.allocateInvoiceNumbers("INV", 10, [], 1_700_000_123_456),
    createInvoice: async (payload) => {
      made.push(payload);
      return { id: `inv-${made.length}` };
    },
    createClient: async (payload) => {
      madeClients.push(payload);
      return { id: `cli-${madeClients.length}` };
    },
    ...over,
  });

  made.length = 0; madeClients.length = 0;
  let out = await I.createInvoiceBatch(plan, deps());
  check("every clean invoice is created", out.created === 2 && out.failed === 0, j(out));
  check("EVERY ONE IS A DRAFT -- creating and sending are two decisions",
    made.every((m) => m.status === "draft"));
  check("each gets its own number", new Set(made.map((m) => m.invoice_number)).size === 2);
  check("the totals are carried, not recomputed downstream",
    made.some((m) => m.total === 700.6), j(made.map((m) => m.total)));

  made.length = 0; madeClients.length = 0;
  out = await I.createInvoiceBatch(bad, deps());
  check(
    "a new client is skipped when creating clients was not asked for",
    out.created === 0 && /does not exist/.test(out.results[0]?.error || ""),
    j(out.results),
  );

  made.length = 0; madeClients.length = 0;
  out = await I.createInvoiceBatch(bad, deps({ createMissingClients: true }));
  check("and created when it was", out.created === 1 && out.clientsCreated === 1, j(out));
  check("with the name and email from the file",
    madeClients[0]?.name === "Nobody Ltd" && madeClients[0]?.email === "new@example.com",
    j(madeClients[0]));

  made.length = 0;
  let calls = 0;
  out = await I.createInvoiceBatch(plan, deps({
    createInvoice: async (p) => {
      calls++;
      if (calls === 1) throw new Error("network went away");
      made.push(p);
      return { id: "inv-x" };
    },
  }));
  check(
    "ONE FAILURE DOES NOT STOP THE REST",
    out.created === 1 && out.failed === 1 && out.total === 2,
    j(out.results.map((r) => r.error)),
  );
  check("and the failure is named, not swallowed",
    /network went away/.test(out.results[0].error), j(out.results[0]));

  // ---- Branding --------------------------------------------------------
  console.log("\nbranding\n");

  check("no font set renders as Inter -- today's look",
    B.resolvePdfFont({}).family === "Inter" && B.resolvePdfFont({}).id === "helvetica");
  check("times is a real serif", B.resolvePdfFont({ font_family: "times" }).family === "Times-Roman");
  check("courier is monospace", B.resolvePdfFont({ font_family: "courier" }).family === "Courier");
  check("a retired option still resolves: georgia -> times",
    B.resolvePdfFont({ font_family: "georgia" }).id === "times");
  check("and arial -> the sans default", B.resolvePdfFont({ font_family: "arial" }).id === "helvetica");
  check("something unrecognised falls back rather than breaking the render",
    B.resolvePdfFont({ font_family: "comic sans" }).family === "Inter");

  check("a footer is trimmed", B.resolveFooterText({ pdf_footer_text: "  Thanks!  " }) === "Thanks!");
  check("an empty footer is null, not an empty line",
    B.resolveFooterText({ pdf_footer_text: "   " }) === null);
  check("a runaway footer is capped",
    B.resolveFooterText({ pdf_footer_text: "x".repeat(400) }).length === 300);

  check(
    "AN UNSET show_pdf_branding DOES NOT PRINT OUR NAME",
    B.showsPoweredBy({}) === false && B.showsPoweredBy({ show_pdf_branding: null }) === false,
    "the checkbox read !== false, so honouring it would have branded every existing account",
  );
  check("an explicit false does not either", B.showsPoweredBy({ show_pdf_branding: false }) === false);
  check("only an explicit true does", B.showsPoweredBy({ show_pdf_branding: true }) === true);
  check("and a truthy non-true does not",
    B.showsPoweredBy({ show_pdf_branding: "yes" }) === false,
    "a string from a form must not count as consent");

  check("the heading is the contractor's name",
    B.brandHeading({ business_name: "Miller Construction" }) === "Miller Construction");
  check("falling back only when they have not set one",
    B.brandHeading({}) === "Invoicium" && B.brandHeading({ business_name: "   " }) === "Invoicium");

  // ---- The logo --------------------------------------------------------
  console.log("\nthe logo\n");

  const png = (bytes = 10) =>
    new Blob([new Uint8Array(bytes)], { type: "image/png" });
  const ok = (blob) => ({ ok: true, blob: async () => blob });

  check("nothing in, nothing out", (await B.loadLogoDataUrl("")) === null);
  check("a relative path is not fetched", (await B.loadLogoDataUrl("/logo.png")) === null);
  check("a blob: URL from a file picker is not usable in a PDF",
    (await B.loadLogoDataUrl("blob:http://localhost/abc")) === null);
  check("an inline PNG passes straight through",
    (await B.loadLogoDataUrl("data:image/png;base64,AAAA")) === "data:image/png;base64,AAAA");
  check(
    "AN INLINE SVG IS REFUSED -- react-pdf cannot embed one and throws mid-render",
    (await B.loadLogoDataUrl("data:image/svg+xml;base64,AAAA")) === null,
    "that throw fails the whole invoice, not just the logo",
  );

  let fetched = 0;
  const good = await B.loadLogoDataUrl("https://cdn.example/a.png", {
    fetchImpl: async () => { fetched++; return ok(png()); },
  });
  check("a real PNG comes back inline", String(good).startsWith("data:image/png;base64,"), String(good).slice(0, 40));
  await B.loadLogoDataUrl("https://cdn.example/a.png", {
    fetchImpl: async () => { fetched++; return ok(png()); },
  });
  check("and is cached, so a batch of thirty fetches it once", fetched === 1, `${fetched} fetches`);

  check("a 404 is not a crash",
    (await B.loadLogoDataUrl("https://cdn.example/missing.png", {
      fetchImpl: async () => ({ ok: false }),
    })) === null);
  check("a WebP is refused",
    (await B.loadLogoDataUrl("https://cdn.example/w.webp", {
      fetchImpl: async () => ok(new Blob([new Uint8Array(4)], { type: "image/webp" })),
    })) === null);
  check("a 5MB photo is refused",
    (await B.loadLogoDataUrl("https://cdn.example/big.png", {
      fetchImpl: async () => ok(png(5 * 1024 * 1024)),
    })) === null);
  check(
    "A THROWN FETCH RETURNS null RATHER THAN REJECTING",
    (await B.loadLogoDataUrl("https://cdn.example/dns-fail.png", {
      fetchImpl: async () => { throw new Error("getaddrinfo ENOTFOUND"); },
    })) === null,
    "an unbranded invoice beats no invoice",
  );
  check("a hung request gives up rather than hanging the render",
    (await B.loadLogoDataUrl("https://cdn.example/slow.png", {
      timeoutMs: 30,
      fetchImpl: (url, init) => new Promise((_, reject) => {
        init?.signal?.addEventListener("abort", () => reject(new Error("aborted")));
      }),
    })) === null);

  const brand = B.resolveBrand(
    { business_name: "Miller Construction", font_family: "times", pdf_footer_text: "Thanks!", show_pdf_branding: true },
    { logo: "data:image/png;base64,AAAA" },
  );
  check("resolveBrand hands a template everything at once",
    brand.businessName === "Miller Construction" && brand.fontFamily === "Times-Roman" &&
    brand.footerText === "Thanks!" && brand.showPoweredBy === true && brand.logo === "data:image/png;base64,AAAA",
    j(brand));
  check("and a bare settings row still yields a renderable brand",
    B.resolveBrand({}).fontFamily === "Inter" && B.resolveBrand({}).logo === null);

  console.log(`\n${failed === 0 ? "ALL PASS" : "FAILURES ABOVE"} -- ${passed} passed, ${failed} failed`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
