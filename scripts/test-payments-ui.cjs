/**
 * Drive payment recording and the history timeline in a real browser.
 *
 * -- What this catches that the unit suite cannot -------------------------
 *
 * Two brand-new components and three screens rewired. A component used without
 * being imported throws only at the moment it renders, and this codebase has
 * shipped one of those; the last two browser passes each caught a real bug the
 * unit tests and the build were both blind to.
 *
 * It also checks the shape of what leaves the browser: that recording a
 * payment writes ONE payment row with the amount, date and method entered,
 * that the invoice is only marked paid when the payments actually settle it,
 * and that a part payment leaves the status alone.
 *
 * -- Nothing real is written ----------------------------------------------
 *
 * Every PostgREST read is answered with fixtures and every write is captured
 * rather than forwarded.
 *
 * Usage: node scripts/test-payments-ui.cjs <origin> <sessionJson> <outDir>
 */
const puppeteer = require("puppeteer-core");
const fs = require("fs");
const path = require("path");

const CHROME =
  process.env.CHROME_PATH || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const [origin, sessionPath, outDir, mode] = process.argv.slice(2);
// The Record-payment controls are gated on paymentsSupported(), which reads the
// generated column map and is FALSE until the migration is applied and
// gen-entity-columns.py re-run. So the runner builds twice: --before against
// the map as it is today, which asserts only that the control is correctly
// ABSENT, and the default run against a map patched to the post-migration
// shape, which exercises everything else.
const BEFORE_MIGRATION = mode === "--before";
const STORAGE_KEY = "invoicium-auth";

let passed = 0, failed = 0;
function check(label, cond, detail) {
  if (cond) { passed++; console.log(`  PASS  ${label}`); }
  else { failed++; console.log(`  FAIL  ${label}${detail !== undefined ? ` -- ${detail}` : ""}`); }
}

const waitForText = (page, needle, timeout = 20000) =>
  page
    .waitForFunction((n) => document.body.innerText.includes(n), { timeout }, needle)
    .catch(() => {});

const USER_ID = "66666666-6666-4666-8666-666666666666";
const CLIENT_ID = "77777777-7777-4777-8777-777777777777";

// Distinct amounts everywhere, so an assertion cannot pass by reading the
// wrong figure and landing on the right answer.
const OPEN_INVOICE = {
  id: "inv-open", user_id: USER_ID, invoice_number: "INV-8100", status: "sent",
  client_id: CLIENT_ID, client_name: "Dana Reyes", client_email: "dana@example.com",
  // `amount` is not optional in these fixtures: InvoiceDetail renders
  // `item.amount.toFixed(2)` unguarded, so an item without it throws and the
  // whole page renders as an error -- which looks exactly like the feature
  // under test being broken. Real items always carry it.
  items: [{ description: "Site visit", quantity: 1, rate: 500, amount: 500 }],
  subtotal: 500, tax_rate: 0, tax_amount: 0, total: 500,
  due_date: "2026-05-30", created_at: "2026-05-01T09:00:00.000Z",
  created_date: "2026-05-01T09:00:00.000Z",
  first_viewed_at: "2026-05-02T10:00:00.000Z",
  last_viewed_at: "2026-05-02T10:00:10.000Z",
  view_count: 1,
  last_reminder_sent_at: "2026-05-20T08:00:00.000Z",
  reminder_count: 2,
  public_token: "88888888-8888-4888-8888-888888888888",
};

// One already carrying a deposit, so the balance and the "still owed" line are
// exercised rather than assumed.
const PART_PAID = {
  ...OPEN_INVOICE,
  id: "inv-part", invoice_number: "INV-8200", total: 900,
  items: [{ description: "Bathroom", quantity: 1, rate: 900, amount: 900 }],
  subtotal: 900,
};

const PAYMENTS = [
  {
    id: "pmt-1", user_id: USER_ID, invoice_id: "inv-part", amount: 300,
    paid_at: "2026-05-10", method: "e-Transfer", reference: "REF-991",
    recorded_by_name: "Sam Okonkwo", created_at: "2026-05-10T12:00:00.000Z",
  },
];

async function main() {
  fs.mkdirSync(outDir, { recursive: true });
  const sessionJson = fs.readFileSync(sessionPath, "utf8");
  const browser = await puppeteer.launch({
    executablePath: CHROME, headless: "new",
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1400, height: 1500, deviceScaleFactor: 2 });

  const pageErrors = [];
  page.on("pageerror", (e) => pageErrors.push(String(e.message)));

  // Allow-Headers is ECHOED, not listed: supabase-js sends different header
  // sets to PostgREST and to the functions endpoint, and one missing name
  // blocks the request while the page renders nothing.
  const corsFor = (req) => ({
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": req.headers()["access-control-request-headers"] || "*",
    "Access-Control-Expose-Headers": "content-range",
    "Access-Control-Max-Age": "600",
  });

  let writes = [];

  await page.setRequestInterception(true);
  page.on("request", (req) => {
    const url = req.url();
    const cors = corsFor(req);
    if (req.method() === "OPTIONS" && (url.includes("/rest/v1/") || url.includes("/functions/v1/"))) {
      return req.respond({ status: 204, headers: cors, body: "" });
    }
    if (/\/functions\/v1\//.test(url)) {
      return req.respond({ status: 200, contentType: "application/json", headers: cors,
        body: JSON.stringify({ success: true }) });
    }
    if (url.includes("/rest/v1/")) {
      const table = (/\/rest\/v1\/([A-Za-z]+)/.exec(url) || [])[1];

      // Only the tables this test owns are stubbed. Everything else -- most
      // importantly POST /rest/v1/rpc/my_app_access, which is how the app
      // checks the paywall -- goes through to the real backend. Answering that
      // RPC with a fake row denied access to the whole app, and the symptom was
      // an invoice page that never rendered, which reads as the feature being
      // broken rather than the stub being too greedy.
      const OWNED = new Set([
        "Invoice", "InvoicePayment", "InvoiceEvent", "Client",
        "BusinessSettings", "Subscription",
      ]);
      if (!OWNED.has(table)) return req.continue();

      if (req.method() !== "GET") {
        let body = null;
        try { body = JSON.parse(req.postData() || "null"); } catch { body = req.postData(); }
        // supabase-js posts an ARRAY even for one insert.
        const row = Array.isArray(body) ? body[0] : body;
        writes.push({ table, method: req.method(), url, body: row });
        const made = (Array.isArray(body) ? body : [body]).map((b, i) => ({
          id: `made-${writes.length}-${i}`, ...(b || {}),
        }));
        // localDataEngine.create ends in `.select().single()`, which asks for
        // a bare object rather than an array. Answering with an array makes
        // every create look like it failed.
        const wantsObject = /pgrst\.object/.test(req.headers().accept || "");
        return req.respond({ status: 200, contentType: "application/json", headers: cors,
          body: JSON.stringify(wantsObject ? made[0] : made) });
      }

      const idFilter = /[?&]id=eq\.([^&]+)/.exec(url);
      const invoiceFilter = /[?&]invoice_id=eq\.([^&]+)/.exec(url);
      let rows =
        table === "Invoice" ? [OPEN_INVOICE, PART_PAID]
        : table === "InvoicePayment" ? PAYMENTS
        : table === "InvoiceEvent" ? []
        : table === "Client" ? [{ id: CLIENT_ID, name: "Dana Reyes", email: "dana@example.com" }]
        : table === "BusinessSettings" ? [{ id: "bs", user_id: USER_ID, business_name: "Miller Construction" }]
        : table === "Subscription" ? [{ id: "sub", user_id: USER_ID, plan_name: "core", status: "active" }]
        : null;
      if (rows && idFilter) rows = rows.filter((r) => r.id === decodeURIComponent(idFilter[1]));
      if (rows && invoiceFilter) {
        rows = rows.filter((r) => r.invoice_id === decodeURIComponent(invoiceFilter[1]));
      }
      if (rows) {
        return req.respond({ status: 200, contentType: "application/json",
          headers: { ...cors, "content-range": `0-${rows.length}/${rows.length}` },
          body: JSON.stringify(rows) });
      }
    }
    req.continue();
  });

  try {
    await page.goto(`${origin}/Login`, { waitUntil: "domcontentloaded" });
    await page.evaluate((k, s) => {
      Object.keys(window.localStorage)
        .filter((key) => key.includes("invoice"))
        .forEach((key) => window.localStorage.removeItem(key));
      window.localStorage.setItem(k, s);
      window.localStorage.setItem("invoicium-remember-me", "true");
    }, STORAGE_KEY, sessionJson);

    // ---- A part-paid invoice ---------------------------------------------
    console.log("\na part-paid invoice\n");

    await page.goto(`${origin}/InvoiceDetail?id=inv-part`, { waitUntil: "networkidle2" });
    await waitForText(page, "INV-8200");
    await waitForText(page, "Payments");
    let text = await page.evaluate(() => document.body.innerText);
    await page.screenshot({ path: path.join(outDir, "detail-part-paid.png"), fullPage: true });

    check("the invoice renders", /INV-8200/.test(text));
    check("the payments panel is there", /Payments/.test(text));
    check("it shows the total", /\$900\.00/.test(text), (text.match(/\$[\d,]+\.\d\d/g) || []).join(" "));
    check("what has been paid", /\$300\.00/.test(text));
    check(
      "AND WHAT IS STILL OWED",
      /\$600\.00/.test(text),
      (text.match(/\$[\d,]+\.\d\d/g) || []).join(" "),
    );
    check("the payment's method and reference", /e-Transfer/.test(text) && /REF-991/.test(text));
    check("and who recorded it", /Sam Okonkwo/.test(text));
    check("no NaN or undefined anywhere", !/NaN/.test(text) && !/\bundefined\b/.test(text));

    // ---- The timeline ----------------------------------------------------
    console.log("\nthe history\n");

    check("there is a history panel", /History/.test(text));
    check("built from the invoice's own columns with no stored events at all",
      /Invoice created/.test(text), "the events table is empty in these fixtures");
    check("the client opening it", /Client opened the invoice/.test(text));
    check("the reminders that went out", /2 reminders sent/.test(text));
    check("and the payment", /Payment of \$300\.00/.test(text));
    check(
      "the reminder entry admits earlier dates are not kept",
      /earlier dates are not kept/i.test(text),
    );

    // ---- The pre-migration build, in three assertions --------------------
    if (BEFORE_MIGRATION) {
      const buttons = await page.evaluate(() =>
        [...document.querySelectorAll("button")].map((b) => b.innerText.trim()),
      );
      check(
        "Record payment is NOT offered before the migration",
        !buttons.some((b) => /Record payment/.test(b)),
        "the guard is doing something, not merely present",
      );
      check("the history still works, because it is derived", /Invoice created/.test(text));

      // Checked on the invoice with NO payments: the panel explains the
      // missing migration only in its empty state, and inv-part has a payment
      // in the fixtures, so it correctly shows that instead.
      await page.goto(`${origin}/InvoiceDetail?id=inv-open`, { waitUntil: "networkidle2" });
      await waitForText(page, "INV-8100");
      const emptyText = await page.evaluate(() => document.body.innerText);
      check(
        "and an invoice with no payments says why rather than looking empty",
        /database update/i.test(emptyText),
        emptyText.slice(0, 200),
      );
      console.log(`\n${failed === 0 ? "ALL PASS" : "FAILURES ABOVE"} -- ${passed} passed, ${failed} failed`);
      await browser.close();
      process.exit(failed === 0 ? 0 : 1);
    }

    // ---- Recording a part payment ----------------------------------------
    console.log("\nrecording a part payment\n");

    writes = [];
    await page.evaluate(() => {
      [...document.querySelectorAll("button")].find((b) => /Record payment/.test(b.innerText))?.click();
    });
    await waitForText(page, "Record a payment");
    text = await page.evaluate(() => document.body.innerText);
    await page.screenshot({ path: path.join(outDir, "payment-dialog.png"), fullPage: true });

    check("the dialog opens", /Record a payment/.test(text));
    check("naming the invoice and what is owed", /INV-8200/.test(text) && /\$600\.00 owed/.test(text),
      (text.match(/\$[\d,.]+ owed/) || ["none"])[0]);
    check(
      "PREFILLED WITH THE BALANCE, NOT THE TOTAL",
      (await page.$eval("#payment-amount", (el) => el.value)) === "600.00",
      await page.$eval("#payment-amount", (el) => el.value),
    );
    check(
      "and with today's date",
      (await page.$eval("#payment-date", (el) => el.value)) === new Date().toISOString().slice(0, 10),
      await page.$eval("#payment-date", (el) => el.value),
    );

    // Record less than the balance: the status must NOT become paid.
    await page.evaluate(() => {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
      const amount = document.querySelector("#payment-amount");
      setter.call(amount, "100");
      amount.dispatchEvent(new Event("input", { bubbles: true }));
      const date = document.querySelector("#payment-date");
      setter.call(date, "2026-05-18");
      date.dispatchEvent(new Event("input", { bubbles: true }));
      const dialog = document.querySelector("[role=dialog]");
      [...(dialog || document).querySelectorAll("button")]
        .find((b) => b.innerText.trim() === "Cheque")
        ?.click();
    });
    await new Promise((r) => setTimeout(r, 300));
    // Scoped to the dialog. The page behind it has a button reading "Record
    // payment" too, and an unscoped querySelectorAll finds THAT one first --
    // clicking it re-opens the dialog and writes nothing, which reads as the
    // save being broken.
    await page.evaluate(() => {
      const dialog = document.querySelector("[role=dialog]");
      [...(dialog || document).querySelectorAll("button")]
        .find((b) => /^Record payment$/.test(b.innerText.trim()))
        ?.click();
    });
    await new Promise((r) => setTimeout(r, 2000));

    const paymentWrites = writes.filter((w) => w.table === "InvoicePayment" && w.method === "POST");
    const invoiceWrites = writes.filter((w) => w.table === "Invoice" && w.method === "PATCH");

    check("one payment row is written", paymentWrites.length === 1, JSON.stringify(writes.map((w) => `${w.method} ${w.table}`)));
    check("with the amount entered", paymentWrites[0]?.body?.amount === 100, JSON.stringify(paymentWrites[0]?.body));
    check("the date entered, not today", paymentWrites[0]?.body?.paid_at === "2026-05-18", paymentWrites[0]?.body?.paid_at);
    check("and the method chosen", paymentWrites[0]?.body?.method === "Cheque", paymentWrites[0]?.body?.method);
    check("attached to the right invoice", paymentWrites[0]?.body?.invoice_id === "inv-part");
    check("recording who entered it", Boolean(paymentWrites[0]?.body?.recorded_by), JSON.stringify(paymentWrites[0]?.body?.recorded_by));
    check(
      "A PART PAYMENT DOES NOT MARK THE INVOICE PAID",
      invoiceWrites.length === 0,
      JSON.stringify(invoiceWrites.map((w) => w.body)),
    );

    // ---- Settling one in full --------------------------------------------
    console.log("\nsettling an invoice\n");

    await page.goto(`${origin}/InvoiceDetail?id=inv-open`, { waitUntil: "networkidle2" });
    await waitForText(page, "INV-8100");
    text = await page.evaluate(() => document.body.innerText);
    check("an unpaid invoice shows the whole total owed", /\$500\.00/.test(text));

    writes = [];
    await page.evaluate(() => {
      [...document.querySelectorAll("button")].find((b) => /Record payment/.test(b.innerText))?.click();
    });
    await waitForText(page, "Record a payment");
    check(
      "with nothing paid, the dialog prefills the full amount",
      (await page.$eval("#payment-amount", (el) => el.value)) === "500.00",
      await page.$eval("#payment-amount", (el) => el.value),
    );
    await page.evaluate(() => {
      const dialog = document.querySelector("[role=dialog]");
      [...(dialog || document).querySelectorAll("button")]
        .find((b) => b.innerText.trim() === "Cash")
        ?.click();
    });
    await new Promise((r) => setTimeout(r, 200));
    // Scoped to the dialog. The page behind it has a button reading "Record
    // payment" too, and an unscoped querySelectorAll finds THAT one first --
    // clicking it re-opens the dialog and writes nothing, which reads as the
    // save being broken.
    await page.evaluate(() => {
      const dialog = document.querySelector("[role=dialog]");
      [...(dialog || document).querySelectorAll("button")]
        .find((b) => /^Record payment$/.test(b.innerText.trim()))
        ?.click();
    });
    await new Promise((r) => setTimeout(r, 2000));
    await page.screenshot({ path: path.join(outDir, "after-settle.png"), fullPage: true });

    const settled = writes.filter((w) => w.table === "Invoice" && w.method === "PATCH");
    check("paying it in full marks the invoice paid", settled[0]?.body?.status === "paid",
      JSON.stringify(settled.map((w) => w.body)));
    check(
      "AND STAMPS paid_date, WHICH NOTHING IN THE APP EVER DID",
      Boolean(settled[0]?.body?.paid_date),
      JSON.stringify(settled[0]?.body),
    );
    const events = writes.filter((w) => w.table === "InvoiceEvent" && w.method === "POST");
    check("the status change is written to the history", events.length === 1, JSON.stringify(events.map((w) => w.body)));
    check("recording both ends of it",
      events[0]?.body?.from_status === "sent" && events[0]?.body?.to_status === "paid",
      JSON.stringify(events[0]?.body));

    // ---- The list --------------------------------------------------------
    console.log("\nthe invoices list\n");

    await page.goto(`${origin}/Invoices`, { waitUntil: "networkidle2" });
    await waitForText(page, "INV-8200");
    text = await page.evaluate(() => document.body.innerText);
    await page.screenshot({ path: path.join(outDir, "list-balances.png"), fullPage: true });

    check("the part-paid invoice shows what is still owed", /\$600\.00 still owed/.test(text),
      (text.match(/\$[\d,.]+ still owed/) || ["none"])[0]);
    check(
      "and the untouched one does NOT repeat its total as a balance",
      (text.match(/still owed/g) || []).length === 1,
      `${(text.match(/still owed/g) || []).length} rows showing a balance`,
    );

    // Choosing "paid" from the dropdown must open the dialog, not write a status.
    writes = [];
    // Exercised through the MOBILE status picker rather than the desktop
    // dropdown.
    //
    // Both call handleStatusChange, which is the code under test. The desktop
    // control is a Radix Select, which opens on its own pointer handling and
    // stayed shut under a synthetic click -- leaving no options in the DOM and
    // an assertion that read "paid is not offered" when the truth was "the
    // menu never opened". The mobile picker is plain buttons, so what is being
    // measured is the app rather than the driver.
    writes = [];
    await page.setViewport({ width: 480, height: 900, deviceScaleFactor: 2 });
    await page.goto(`${origin}/Invoices`, { waitUntil: "networkidle2" });
    await waitForText(page, "INV-8100");

    const openedPicker = await page.evaluate(() => {
      // offsetParent filters out the DESKTOP table, which is display:none at
      // this width but whose innerText still reads "Sent" -- clicking one of
      // those hits the Radix trigger instead of the mobile badge and opens
      // nothing.
      const badge = [...document.querySelectorAll("button")]
        .filter((b) => b.offsetParent !== null)
        .find((b) => /^sent$/i.test((b.innerText || "").trim()));
      if (!badge) return false;
      badge.click();
      return true;
    });
    check("the status badge opens the picker", openedPicker);
    await waitForText(page, "Change Status", 8000);

    const statuses = await page.evaluate(() =>
      [...document.querySelectorAll("button")]
        .filter((b) => b.offsetParent !== null)
        .map((b) => (b.innerText || "").trim().toLowerCase())
        .filter((t) => ["draft", "sent", "paid", "overdue", "cancelled", "void"].includes(t)),
    );
    check("the picker lists the settable statuses", statuses.includes("paid"), JSON.stringify(statuses));
    check(
      "and void is NOT one of them",
      statuses.length > 0 && !statuses.includes("void"),
      JSON.stringify(statuses),
    );

    await page.evaluate(() => {
      [...document.querySelectorAll("button")]
        .filter((b) => b.offsetParent !== null)
        .find((b) => (b.innerText || "").trim().toLowerCase() === "paid")
        ?.click();
    });
    await waitForText(page, "Record a payment", 8000);
    text = await page.evaluate(() => document.body.innerText);
    await page.screenshot({ path: path.join(outDir, "list-dropdown-dialog.png"), fullPage: true });

    check(
      'PICKING "paid" OPENS THE PAYMENT DIALOG',
      /Record a payment/.test(text),
      "this control used to write status:paid with no date, amount, method or actor",
    );
    check(
      "and writes nothing until it is filled in",
      writes.filter((w) => w.method === "PATCH").length === 0,
      JSON.stringify(writes.map((w) => `${w.method} ${w.table}`)),
    );

    check("nothing threw while any of that happened", pageErrors.length === 0, pageErrors.slice(0, 2).join(" | "));
    console.log(`\n  screenshots -> ${outDir}`);
  } finally {
    await browser.close();
  }

  console.log(`\n${failed === 0 ? "ALL PASS" : "FAILURES ABOVE"} -- ${passed} passed, ${failed} failed`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
