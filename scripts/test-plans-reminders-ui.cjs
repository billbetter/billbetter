/**
 * Render the payment-plan screen and the reminder queue in a real browser.
 *
 * Companion to test-plans-reminders.cjs, which proves the rules. This proves
 * they reach the screen -- a different failure, and one the unit tests and the
 * build are both blind to. The last time this pass was run against new work it
 * caught a component used without being imported, which throws only at the
 * moment it renders.
 *
 * The PaymentPlan table does not exist until the migration is applied, so its
 * reads are stubbed here. Nothing is written, and no invoice is sent.
 *
 * Usage: node scripts/test-plans-reminders-ui.cjs <origin> <sessionJson> <outDir>
 */
const puppeteer = require("puppeteer-core");
const fs = require("fs");
const path = require("path");

const CHROME =
  process.env.CHROME_PATH || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const [origin, sessionPath, outDir] = process.argv.slice(2);
const STORAGE_KEY = "invoicium-auth";

let passed = 0, failed = 0;
function check(label, cond, detail) {
  if (cond) { passed++; console.log(`  PASS  ${label}`); }
  else { failed++; console.log(`  FAIL  ${label}${detail ? ` -- ${detail}` : ""}`); }
}

const DAY = 24 * 60 * 60 * 1000;
const daysAgo = (n) => new Date(Date.now() - n * DAY).toISOString();
const CLIENT_ID = "22222222-2222-4222-8222-222222222222";

const PLAN = {
  id: "plan-1", user_id: "u", client_id: CLIENT_ID, client_name: "Dana Reyes",
  title: "Kitchen remodel", total_amount: 12000, tax_rate: 0, notes: "",
  status: "active", created_at: new Date().toISOString(),
  stages: [
    { id: "stg_1", label: "Deposit", percent: 30, amount: 3600, due_date: null,
      invoice_id: "inv-1", released_at: daysAgo(10) },
    { id: "stg_2", label: "Work in progress", percent: 40, amount: 4800, due_date: null,
      invoice_id: null, released_at: null },
    { id: "stg_3", label: "On completion", percent: 30, amount: 3600, due_date: null,
      invoice_id: null, released_at: null },
  ],
};

// One invoice well past its due date and never reminded -> the ladder says a
// first reminder is due. One paid invoice equally late, which must not appear.
const INVOICES = [
  { id: "inv-late", user_id: "u", invoice_number: "INV-0039", status: "overdue",
    client_id: CLIENT_ID, client_name: "Ruth Okafor", client_email: "ruth@example.com",
    items: [], subtotal: 520, total: 520, due_date: daysAgo(14),
    reminder_count: 0, last_reminder_sent_at: null, created_at: daysAgo(40) },
  { id: "inv-paid", user_id: "u", invoice_number: "INV-0035", status: "paid",
    client_id: CLIENT_ID, client_name: "Paid Co", client_email: "paid@example.com",
    items: [], subtotal: 300, total: 300, due_date: daysAgo(30),
    reminder_count: 0, created_at: daysAgo(50) },
  { id: "inv-fresh", user_id: "u", invoice_number: "INV-0044", status: "overdue",
    client_id: CLIENT_ID, client_name: "Sam Vega", client_email: "sam@example.com",
    items: [], subtotal: 900, total: 900, due_date: daysAgo(1),
    reminder_count: 0, created_at: daysAgo(10) },
];

async function main() {
  fs.mkdirSync(outDir, { recursive: true });
  const sessionJson = fs.readFileSync(sessionPath, "utf8");
  const browser = await puppeteer.launch({
    executablePath: CHROME, headless: "new",
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1400, height: 1300, deviceScaleFactor: 2 });

  /**
   * CORS headers for a stubbed cross-origin response.
   *
   * Allow-Headers is ECHOED from the preflight rather than listed. Listing it
   * was tried and failed: supabase-js sends different header sets to the
   * functions endpoint and to PostgREST -- accept-profile, prefer, range,
   * x-client-info -- and one missing name blocks the real request while the
   * page shows nothing at all, which looks exactly like the feature being
   * broken. Echoing cannot go out of date.
   */
  const corsFor = (req) => ({
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers":
      req.headers()["access-control-request-headers"] || "*",
    "Access-Control-Expose-Headers": "content-range",
    "Access-Control-Max-Age": "600",
  });
  const writes = [];

  await page.setRequestInterception(true);
  page.on("request", (req) => {
    const url = req.url();
    const cors = corsFor(req);
    if (
      req.method() === "OPTIONS" &&
      (url.includes("/rest/v1/") || url.includes("/functions/v1/"))
    ) {
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
        writes.push({ table, method: req.method(), body: req.postData() });
        return req.respond({ status: 200, contentType: "application/json", headers: cors, body: "[]" });
      }
      const rows =
        table === "PaymentPlan" ? [PLAN]
        : table === "Invoice" ? INVOICES
        : table === "Client" ? [{ id: CLIENT_ID, name: "Dana Reyes", email: "dana@example.com" }]
        : null;
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

    // ---- Payment plans --------------------------------------------------
    console.log("\nthe payment plan screen\n");

    await page.goto(`${origin}/PaymentPlans`, { waitUntil: "networkidle2" });
    await new Promise((r) => setTimeout(r, 1800));
    let text = await page.evaluate(() => document.body.innerText);
    await page.screenshot({ path: path.join(outDir, "plans-list.png"), fullPage: true });

    check("the page renders at all", /Payment plans/i.test(text));
    check("the plan is listed with its client and total",
          /Kitchen remodel/.test(text) && /Dana Reyes/.test(text) && /12,000/.test(text));
    check("it names the next stage rather than a bare status",
          /Next: Work in progress/.test(text), text.slice(0, 200));

    const opened = await page.evaluate(() => {
      const b = [...document.querySelectorAll("button")].find((x) => /Kitchen remodel/.test(x.innerText));
      if (!b) return false; b.click(); return true;
    });
    check("a plan opens", opened);
    await new Promise((r) => setTimeout(r, 1000));
    text = await page.evaluate(() => document.body.innerText);
    await page.screenshot({ path: path.join(outDir, "plan-detail.png"), fullPage: true });

    check("progress shows what has been invoiced", /3,600.*invoiced|invoiced/i.test(text));
    check("the released stage is marked", /Released/.test(text));
    check("only the NEXT stage offers Release",
          (text.match(/\bRelease\b/g) || []).length === 1,
          `${(text.match(/\bRelease\b/g) || []).length} Release buttons`);
    check("later stages say they are waiting",
          /Waiting on earlier stages/.test(text));
    check("no NaN or undefined in the figures",
          !/NaN/.test(text) && !/\bundefined\b/.test(text));

    const released = await page.evaluate(() => {
      const b = [...document.querySelectorAll("button")].find((x) => /^Release$/.test(x.innerText.trim()));
      if (!b) return false; b.click(); return true;
    });
    check("Release is clickable", released);
    await new Promise((r) => setTimeout(r, 2500));
    text = await page.evaluate(() => document.body.innerText);
    await page.screenshot({ path: path.join(outDir, "plan-release.png"), fullPage: true });

    check("it opens the invoice form", /\/CreateInvoice/.test(page.url()), page.url());
    check("billing the STAGE, not the contract total",
          /4,?800/.test(text) && !/12,?000/.test(text), "amounts on screen");
    check("the line explains where it sits in the plan",
          /Work in progress \(40% of Kitchen remodel\)/.test(text));
    check("and says it is one stage of a plan",
          /stage of a payment plan/i.test(text));

    // ---- Reminder queue -------------------------------------------------
    console.log("\nthe reminder queue\n");

    await page.goto(`${origin}/Invoices`, { waitUntil: "networkidle2" });
    await new Promise((r) => setTimeout(r, 1800));
    text = await page.evaluate(() => document.body.innerText);
    await page.screenshot({ path: path.join(outDir, "reminders-due.png"), fullPage: true });

    check("it says a reminder is due", /1 reminder is due/.test(text),
          (text.match(/\d+ reminders? (is|are) due/) || ["none"])[0]);
    check("naming the invoice and how late it is",
          /INV-0039/.test(text) && /14 days over/.test(text));
    check("the PAID invoice is not queued", !/INV-0035 ·/.test(text));
    check("the barely-late one is not queued either", !/INV-0044 ·/.test(text));

    const reviewed = await page.evaluate(() => {
      const b = [...document.querySelectorAll("button")].find((x) => /^Review \d+/.test(x.innerText.trim()));
      if (!b) return false; b.click(); return true;
    });
    check("Review hands them to the batch send", reviewed);
    await new Promise((r) => setTimeout(r, 900));
    text = await page.evaluate(() => document.body.innerText);
    check("with exactly the due ones preselected", /Send 1\b/.test(text),
          (text.match(/Send \d+/) || ["none"])[0]);
    check("and it is flagged as a re-send", /already been sent/i.test(text));

    console.log(`\n  screenshots -> ${outDir}`);
  } finally {
    await browser.close();
  }

  console.log(`\n${failed === 0 ? "ALL PASS" : "FAILURES ABOVE"} -- ${passed} passed, ${failed} failed`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
