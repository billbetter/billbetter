/**
 * Render voiding and the "needs invoicing" flag in a real browser.
 *
 * -- Why this exists alongside test-void-job-billing.cjs -------------------
 *
 * That suite proves the rules. This proves they reach the screen, which is a
 * different class of bug and invisible to unit tests and to the build alike --
 * a component used without importing it throws only at the moment it renders,
 * and both `npm run build` and eslint have already let one through on this
 * codebase.
 *
 * -- The build this runs against ------------------------------------------
 *
 * The Void controls are gated on voidSupported(), which reads the generated
 * column map and is FALSE until the migration is applied and
 * scripts/gen-entity-columns.py is re-run. So the runner builds twice:
 *
 *   --after   src/api/entityColumns.js patched to include the four void
 *             columns, which is what the map looks like once the migration
 *             has run. Everything below is checked against this.
 *   --before  the map as it is today. Only one thing is asserted: that the
 *             Void button is correctly ABSENT, so the guard is shown to be
 *             doing something rather than merely present.
 *
 * -- Nothing real is written, sent or voided -------------------------------
 *
 * Every PostgREST read is intercepted and answered with fixtures, and every
 * write is captured rather than forwarded. A test that actually voided
 * something would void a real invoice on a live account.
 *
 * Usage: node scripts/test-void-job-billing-ui.cjs <origin> <sessionJson> <outDir> [--before]
 */
const puppeteer = require("puppeteer-core");
const fs = require("fs");
const path = require("path");

const CHROME =
  process.env.CHROME_PATH || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const [origin, sessionPath, outDir, mode] = process.argv.slice(2);
const BEFORE_MIGRATION = mode === "--before";
const STORAGE_KEY = "invoicium-auth";

let passed = 0, failed = 0;
function check(label, cond, detail) {
  if (cond) { passed++; console.log(`  PASS  ${label}`); }
  else { failed++; console.log(`  FAIL  ${label}${detail !== undefined ? ` -- ${detail}` : ""}`); }
}

const DAY = 24 * 60 * 60 * 1000;
const daysAgo = (n) => new Date(Date.now() - n * DAY).toISOString();
const CLIENT_ID = "33333333-3333-4333-8333-333333333333";
const USER_ID = "44444444-4444-4444-8444-444444444444";

// Distinct amounts throughout, so an assertion cannot pass by reading the
// wrong row and landing on the right number by luck.
const INVOICES = [
  {
    id: "inv-live", user_id: USER_ID, invoice_number: "INV-701", status: "sent",
    client_id: CLIENT_ID, client_name: "Dana Reyes", client_email: "dana@example.com",
    items: [{ description: "Kitchen fit", quantity: 1, rate: 1450, amount: 1450 }],
    subtotal: 1450, tax_rate: 0, tax_amount: 0, total: 1450,
    due_date: daysAgo(-7), created_at: daysAgo(3),
    public_token: "11111111-1111-4111-8111-111111111111",
  },
  {
    id: "inv-dead", user_id: USER_ID, invoice_number: "INV-702", status: "void",
    client_id: CLIENT_ID, client_name: "Ruth Okafor", client_email: "ruth@example.com",
    items: [{ description: "Bathroom tiling", quantity: 1, rate: 2310, amount: 2310 }],
    subtotal: 2310, tax_rate: 0, tax_amount: 0, total: 2310,
    due_date: daysAgo(2), created_at: daysAgo(20),
    public_token: "22222222-2222-4222-8222-222222222222",
    public_link_revoked_at: daysAgo(1),
    voided_at: daysAgo(1), void_reason: "Duplicate of INV-701",
    voided_by_name: "Sam Okonkwo",
  },
];

// Four jobs covering every billing state the flag distinguishes.
const JOBS = [
  { id: "job-unbilled", user_id: USER_ID, job_title: "Deck rebuild", client_id: CLIENT_ID,
    client_name: "Dana Reyes", status: "completed", completion_date: daysAgo(11),
    estimated_cost: 5200, actual_cost: 5400, linked_invoice_id: null,
    created_at: daysAgo(40), created_date: daysAgo(40) },
  { id: "job-revoked", user_id: USER_ID, job_title: "Bathroom tiling", client_id: CLIENT_ID,
    client_name: "Ruth Okafor", status: "completed", completion_date: daysAgo(6),
    estimated_cost: 2300, actual_cost: 2310, linked_invoice_id: "inv-dead",
    created_at: daysAgo(30), created_date: daysAgo(30) },
  { id: "job-billed", user_id: USER_ID, job_title: "Kitchen fit", client_id: CLIENT_ID,
    client_name: "Dana Reyes", status: "completed", completion_date: daysAgo(3),
    estimated_cost: 1400, actual_cost: 1450, linked_invoice_id: "inv-live",
    created_at: daysAgo(20), created_date: daysAgo(20) },
  { id: "job-running", user_id: USER_ID, job_title: "Loft conversion", client_id: CLIENT_ID,
    client_name: "Dana Reyes", status: "in_progress", completion_date: null,
    estimated_cost: 9900, actual_cost: 0, linked_invoice_id: null,
    created_at: daysAgo(10), created_date: daysAgo(10) },
];

async function main() {
  fs.mkdirSync(outDir, { recursive: true });
  const sessionJson = fs.readFileSync(sessionPath, "utf8");
  const browser = await puppeteer.launch({
    executablePath: CHROME, headless: "new",
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1400, height: 1400, deviceScaleFactor: 2 });

  /**
   * Allow-Headers is ECHOED rather than listed. Listing it was tried twice on
   * this codebase and failed twice: supabase-js sends different header sets to
   * the functions endpoint and to PostgREST (accept-profile, prefer, range,
   * x-client-info), and one missing name blocks the real request while the
   * page renders nothing -- which looks exactly like the feature being broken.
   */
  const corsFor = (req) => ({
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": req.headers()["access-control-request-headers"] || "*",
    "Access-Control-Expose-Headers": "content-range",
    "Access-Control-Max-Age": "600",
  });

  const writes = [];

  await page.setRequestInterception(true);
  page.on("request", (req) => {
    const url = req.url();
    const cors = corsFor(req);
    if (req.method() === "OPTIONS" && (url.includes("/rest/v1/") || url.includes("/functions/v1/"))) {
      return req.respond({ status: 204, headers: cors, body: "" });
    }
    if (/\/functions\/v1\//.test(url)) {
      writes.push({ url, body: req.postData() });
      return req.respond({ status: 200, contentType: "application/json", headers: cors,
        body: JSON.stringify({ success: true }) });
    }
    if (url.includes("/rest/v1/")) {
      const table = (/\/rest\/v1\/([A-Za-z]+)/.exec(url) || [])[1];
      if (req.method() !== "GET") {
        writes.push({ table, method: req.method(), url, body: req.postData() });
        return req.respond({ status: 200, contentType: "application/json", headers: cors, body: "[]" });
      }
      // A read filtered by one id answers with that row only -- the detail
      // pages fetch that way, and answering with the whole table would let a
      // page render the wrong invoice and still look right.
      const idFilter = /[?&]id=eq\.([^&]+)/.exec(url);
      let rows =
        table === "Invoice" ? INVOICES
        : table === "Job" ? JOBS
        : table === "Client" ? [{ id: CLIENT_ID, name: "Dana Reyes", email: "dana@example.com" }]
        : table === "JobPhoto" || table === "JobMaterial" || table === "JobExpense" ? []
        : null;
      if (rows && idFilter) rows = rows.filter((r) => r.id === decodeURIComponent(idFilter[1]));
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

    // ---- The pre-migration build, in one assertion ----------------------
    if (BEFORE_MIGRATION) {
      await page.goto(`${origin}/InvoiceDetail?id=inv-live`, { waitUntil: "networkidle2" });
      await new Promise((r) => setTimeout(r, 1800));
      const text = await page.evaluate(() => document.body.innerText);
      await page.screenshot({ path: path.join(outDir, "before-migration.png"), fullPage: true });

      check("the invoice still renders", /INV-701/.test(text));
      check(
        "and Void is NOT offered, because the audit columns do not exist yet",
        !/\bVoid\b/.test(text),
        "the guard is doing something, not merely present",
      );
      console.log(`\n${failed === 0 ? "ALL PASS" : "FAILURES ABOVE"} -- ${passed} passed, ${failed} failed`);
      await browser.close();
      process.exit(failed === 0 ? 0 : 1);
    }

    // ---- Jobs that need invoicing ---------------------------------------
    console.log("\njobs that need invoicing\n");

    await page.goto(`${origin}/JobPhotos`, { waitUntil: "networkidle2" });
    await new Promise((r) => setTimeout(r, 2000));
    let text = await page.evaluate(() => document.body.innerText);
    await page.screenshot({ path: path.join(outDir, "jobs-flagged.png"), fullPage: true });

    check("the page renders at all", /Deck rebuild/.test(text));
    check(
      "it says how many finished jobs are unbilled",
      /2 finished jobs have not been invoiced/.test(text),
      (text.match(/\d+ finished jobs? ha(?:ve|s) not been invoiced/) || ["none"])[0],
    );
    check(
      "and roughly what they are worth",
      /About \$7,710/.test(text),
      (text.match(/About \$[\d,]+/) || ["none"])[0],
    );
    check(
      "the unbilled job carries the flag",
      /Deck rebuild[\s\S]{0,400}?Needs invoicing|Needs invoicing[\s\S]{0,400}?Deck rebuild/.test(text),
    );
    check("no NaN or undefined anywhere on it", !/NaN/.test(text) && !/\bundefined\b/.test(text));

    // The innermost element whose whole text is the label. Not `children.length
    // === 0` -- the badge wraps an icon, so it has a child and its own text is
    // still exactly the label. That first version counted 0 and would have
    // reported a working feature as broken.
    const flagCount = await page.evaluate(() =>
      [...document.querySelectorAll("*")].filter(
        (el) =>
          el.textContent.trim() === "Needs invoicing" &&
          ![...el.children].some((c) => c.textContent.trim() === "Needs invoicing"),
      ).length,
    );
    check(
      "exactly two jobs are flagged, not the invoiced or running ones",
      flagCount === 2,
      `${flagCount} flags`,
    );

    // The filter.
    const filtered = await page.evaluate(() => {
      const b = [...document.querySelectorAll("button")].find((x) => /^Show 2$/.test(x.innerText.trim()));
      if (!b) return false; b.click(); return true;
    });
    check("the banner offers to show them", filtered);
    await new Promise((r) => setTimeout(r, 1200));
    text = await page.evaluate(() => document.body.innerText);
    await page.screenshot({ path: path.join(outDir, "jobs-filtered.png"), fullPage: true });

    check("filtering keeps the two unbilled jobs", /Deck rebuild/.test(text) && /Bathroom tiling/.test(text));
    check("and drops the invoiced one", !/Kitchen fit/.test(text));
    check("and the one still running", !/Loft conversion/.test(text));

    // The job whose invoice was voided -- the interlock between the features.
    const opened = await page.evaluate(() => {
      const el = [...document.querySelectorAll("h3")].find((x) => /Bathroom tiling/.test(x.innerText));
      if (!el) return false;
      el.click();
      return true;
    });
    check("a flagged job opens", opened);
    await new Promise((r) => setTimeout(r, 1800));
    text = await page.evaluate(() => document.body.innerText);
    await page.screenshot({ path: path.join(outDir, "job-detail.png"), fullPage: true });

    check("the job screen agrees it needs invoicing", /Needs invoicing/.test(text));
    check(
      "and explains that its invoice was VOIDED rather than never raised",
      /INV-702 was voided/.test(text),
      (text.match(/.{0,60}voided.{0,60}/i) || ["none"])[0],
    );
    check("saying how long it has been waiting", /Finished 6 days ago/.test(text), text.slice(0, 120));

    // ---- A voided invoice ------------------------------------------------
    console.log("\na voided invoice\n");

    await page.goto(`${origin}/InvoiceDetail?id=inv-dead`, { waitUntil: "networkidle2" });
    await new Promise((r) => setTimeout(r, 1800));
    text = await page.evaluate(() => document.body.innerText);
    await page.screenshot({ path: path.join(outDir, "invoice-voided.png"), fullPage: true });

    check("it says plainly that it is voided", /This invoice has been voided/.test(text));
    check(
      "with the audit trail: when, who and why",
      /by Sam Okonkwo/.test(text) && /Duplicate of INV-701/.test(text),
      (text.match(/Voided on[^\n]*/) || ["none"])[0],
    );
    check("it keeps its number", /INV-702/.test(text));
    check("Resend is gone", !/Resend/.test(text));
    check("the payment link card is gone", !/Payment Link/.test(text));
    check("and the client link says it was switched off", /Switched off when this invoice was voided/.test(text));

    const deadButtons = await page.evaluate(() =>
      [...document.querySelectorAll("button")].map((b) => b.innerText.trim()).filter(Boolean),
    );
    check(
      "there is no Void button on something already voided",
      !deadButtons.some((b) => /^Void/.test(b)),
      JSON.stringify(deadButtons),
    );

    // ---- Voiding a live one ---------------------------------------------
    console.log("\nvoiding a live invoice\n");

    await page.goto(`${origin}/InvoiceDetail?id=inv-live`, { waitUntil: "networkidle2" });
    await new Promise((r) => setTimeout(r, 1800));
    text = await page.evaluate(() => document.body.innerText);

    check("a live invoice offers Void", /\bVoid\b/.test(text));
    check("and is not wearing the voided banner", !/This invoice has been voided/.test(text));

    // The delete dialog should steer towards voiding.
    const openedDelete = await page.evaluate(() => {
      const b = [...document.querySelectorAll("button")].find(
        (x) => x.querySelector("svg.lucide-trash-2, svg.lucide-trash2") && !x.innerText.trim(),
      );
      if (!b) return false; b.click(); return true;
    });
    if (openedDelete) {
      await new Promise((r) => setTimeout(r, 700));
      text = await page.evaluate(() => document.body.innerText);
      await page.screenshot({ path: path.join(outDir, "delete-nudge.png"), fullPage: true });
      check("deleting a SENT invoice warns what disappears", /leaves nothing to point at/.test(text));
      check("and offers to void it instead", /Void it instead/.test(text), text.slice(-300));

      const switched = await page.evaluate(() => {
        const b = [...document.querySelectorAll("button")].find((x) => /Void it instead/.test(x.innerText));
        if (!b) return false; b.click(); return true;
      });
      check("which opens the void dialog", switched);
    } else {
      check("the delete button was found", false, "could not locate the trash button");
    }

    await new Promise((r) => setTimeout(r, 800));
    text = await page.evaluate(() => document.body.innerText);
    await page.screenshot({ path: path.join(outDir, "void-dialog.png"), fullPage: true });

    check("the dialog names the invoice", /Void invoice INV-701\?/.test(text));
    check("says the link dies immediately", /payment link stops working immediately/.test(text));
    check("says there is no undo", /no undo/i.test(text));
    check("and that the client is not told", /client is not told/i.test(text));

    // Type a reason and void. The PATCH is captured, never forwarded.
    await page.type("#void-reason", "Wrong client");
    const voided = await page.evaluate(() => {
      const b = [...document.querySelectorAll("button")].find((x) => /^Void invoice$/.test(x.innerText.trim()));
      if (!b) return false; b.click(); return true;
    });
    check("Void invoice is clickable", voided);
    await new Promise((r) => setTimeout(r, 1500));

    const patch = writes.find(
      (w) => w.table === "Invoice" && w.method === "PATCH" && /inv-live/.test(w.url || ""),
    );
    check("it sends a PATCH for that invoice", Boolean(patch), JSON.stringify(writes.slice(-2)));
    if (patch) {
      const body = JSON.parse(patch.body || "{}");
      check("setting the status to void", body.status === "void", body.status);
      check("stamping when", Boolean(body.voided_at), body.voided_at);
      check("recording the reason typed in", body.void_reason === "Wrong client", body.void_reason);
      check("naming who did it", Boolean(body.voided_by), JSON.stringify(body.voided_by));
      check(
        "AND REVOKING THE PUBLIC LINK, so the client cannot pay it",
        Boolean(body.public_link_revoked_at),
        JSON.stringify(body),
      );
    }

    // ---- The invoices list ----------------------------------------------
    console.log("\nthe invoices list\n");

    await page.goto(`${origin}/Invoices`, { waitUntil: "networkidle2" });
    await new Promise((r) => setTimeout(r, 2000));
    text = await page.evaluate(() => document.body.innerText);
    await page.screenshot({ path: path.join(outDir, "invoices-list.png"), fullPage: true });

    check("the voided invoice is listed, not hidden", /INV-702/.test(text));
    check("wearing its status", /void/i.test(text));
    check(
      "its status control is frozen",
      await page.evaluate(() => {
        const trigger = [...document.querySelectorAll("button,[role=combobox]")].find((el) =>
          /void/i.test(el.innerText || ""),
        );
        return Boolean(trigger && (trigger.disabled || trigger.getAttribute("data-disabled") !== null));
      }),
      "a dropdown would let one click undo a recorded void",
    );

    console.log(`\n  screenshots -> ${outDir}`);
  } finally {
    await browser.close();
  }

  console.log(`\n${failed === 0 ? "ALL PASS" : "FAILURES ABOVE"} -- ${passed} passed, ${failed} failed`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
