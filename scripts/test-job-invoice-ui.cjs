/**
 * Render both new invoicing features in a real browser.
 *
 * -- Why this exists alongside test-job-invoice-batch.cjs ------------------
 *
 * That suite proves the arithmetic. This proves the wiring, which is a
 * different class of bug and invisible to it: a prop spelled wrong, a
 * component used without importing it, a navigation that drops its state. One
 * of those was already caught by hand during this work -- CreateInvoice used
 * <Info> without importing it, which lint did not flag and the build did not
 * fail on, and which would have thrown at the moment the banner rendered.
 *
 * -- Nothing real is written or sent ---------------------------------------
 *
 * The job and its materials are injected by intercepting the PostgREST reads,
 * because the only real Job on this account has no hours and no rate, so it
 * exercises the "nothing to prefill" path and nothing else. Seeding a row
 * would mean writing test data into a live account.
 *
 * The two send functions are intercepted for the same reason, harder: a batch
 * test that actually ran would email real invoices to a real client.
 *
 * Usage: node scripts/test-job-invoice-ui.cjs <origin> <sessionJson> <outDir>
 */
const puppeteer = require("puppeteer-core");
const fs = require("fs");
const path = require("path");

const CHROME =
  process.env.CHROME_PATH ||
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

const [origin, sessionPath, outDir] = process.argv.slice(2);
const STORAGE_KEY = "invoicium-auth";

let passed = 0, failed = 0;
function check(label, cond, detail) {
  if (cond) { passed++; console.log(`  PASS  ${label}`); }
  else { failed++; console.log(`  FAIL  ${label}${detail ? ` -- ${detail}` : ""}`); }
}

const JOB_ID = "11111111-1111-4111-8111-111111111111";
const CLIENT_ID = "22222222-2222-4222-8222-222222222222";

const JOB = {
  id: JOB_ID, user_id: "u", job_title: "Kitchen remodel", client_id: CLIENT_ID,
  client_name: "Dana Reyes", status: "completed", description: "Full strip and refit",
  location: "12 Elm St", estimated_hours: 8, actual_hours: 12, hourly_rate: 85,
  linked_quote_id: null, linked_invoice_id: null, created_at: new Date().toISOString(),
};
const MATERIALS = [
  { id: "m1", job_id: JOB_ID, item_name: "2x4 lumber", quantity: 20, unit: "ea", price_estimate: 6 },
  { id: "m2", job_id: JOB_ID, item_name: "Paint", quantity: 3, price_estimate: 45 },
];

// Two drafts and one overdue, so the bar has a re-send to warn about. One of
// the three is made to fail, because "every send worked" is the easy case and
// the partial failure is the one a contractor has to act on.
const INVOICES = [
  { id: "inv-a", user_id: "u", invoice_number: "INV-0041", status: "draft",
    client_id: CLIENT_ID, client_name: "Dana Reyes", client_email: "dana@example.com",
    items: [], subtotal: 840, total: 840, created_at: new Date().toISOString() },
  { id: "inv-b", user_id: "u", invoice_number: "INV-0042", status: "draft",
    client_id: CLIENT_ID, client_name: "Sam Vega", client_email: "bounce@example.com",
    items: [], subtotal: 1275, total: 1275, created_at: new Date().toISOString() },
  { id: "inv-c", user_id: "u", invoice_number: "INV-0039", status: "overdue",
    client_id: CLIENT_ID, client_name: "Ruth Okafor", client_email: "ruth@example.com",
    items: [], subtotal: 520, total: 520, created_at: new Date().toISOString() },
  { id: "inv-d", user_id: "u", invoice_number: "INV-0035", status: "paid",
    client_id: CLIENT_ID, client_name: "Paid Co", client_email: "paid@example.com",
    items: [], subtotal: 300, total: 300, created_at: new Date().toISOString() },
];

const sends = [];

function stubFor(url) {
  // PostgREST reads, matched on the table segment.
  const m = /\/rest\/v1\/([A-Za-z]+)/.exec(url);
  if (m) {
    const table = m[1];
    if (table === "Job") return [JOB];
    if (table === "JobMaterial") return MATERIALS;
    if (table === "Invoice") return INVOICES;
    if (table === "Client") return [{ id: CLIENT_ID, name: "Dana Reyes", email: "dana@example.com", phone: "+15145550123", address: "12 Elm St" }];
  }
  return null;
}

async function main() {
  fs.mkdirSync(outDir, { recursive: true });
  const sessionJson = fs.readFileSync(sessionPath, "utf8");
  const browser = await puppeteer.launch({
    executablePath: CHROME, headless: "new",
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1400, height: 1200, deviceScaleFactor: 2 });

  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PATCH, OPTIONS",
    "Access-Control-Allow-Headers":
      "authorization, apikey, content-type, x-client-info, prefer, x-supabase-api-version",
    "Access-Control-Expose-Headers": "content-range",
  };

  await page.setRequestInterception(true);
  page.on("request", (req) => {
    const url = req.url();

    if (/\/functions\/v1\/send-invoice-(email|sms)/.test(url)) {
      if (req.method() === "OPTIONS") return req.respond({ status: 204, headers: cors, body: "" });
      const body = JSON.parse(req.postData() || "{}");
      sends.push({ url, body });
      // Sam's address fails, so the results dialog has something to report.
      const ok = body.client_email !== "bounce@example.com";
      return req.respond({
        status: ok ? 200 : 400, contentType: "application/json", headers: cors,
        body: JSON.stringify(ok ? { success: true } : { success: false, error: "Recipient rejected" }),
      });
    }

    if (url.includes("/rest/v1/") && req.method() === "GET") {
      const stub = stubFor(url);
      if (stub) {
        return req.respond({
          status: 200, contentType: "application/json",
          headers: { ...cors, "content-range": `0-${stub.length}/${stub.length}` },
          body: JSON.stringify(stub),
        });
      }
    }
    // Status writes after a batch: accept without touching anything real.
    if (url.includes("/rest/v1/Invoice") && req.method() === "PATCH") {
      return req.respond({ status: 200, contentType: "application/json", headers: cors, body: "[]" });
    }
    req.continue();
  });

  try {
    await page.goto(`${origin}/Login`, { waitUntil: "domcontentloaded" });
    await page.evaluate((k, s) => {
      window.localStorage.setItem(k, s);
      window.localStorage.setItem("invoicium-remember-me", "true");
      // The invoice form remembers a draft in localStorage; clear it so this
      // run measures the prefill and not a leftover.
      Object.keys(window.localStorage)
        .filter((key) => key.includes("invoice"))
        .forEach((key) => window.localStorage.removeItem(key));
      window.localStorage.setItem(k, s);
    }, STORAGE_KEY, sessionJson);

    // ---- Feature 1: a job becomes a prefilled invoice --------------------
    console.log("\na completed job becomes a prefilled invoice\n");

    await page.goto(`${origin}/JobPhotos`, { waitUntil: "networkidle2" });
    await new Promise((r) => setTimeout(r, 1500));

    const openedJob = await page.evaluate((title) => {
      const el = [...document.querySelectorAll("*")].find(
        (e) => e.children.length === 0 && (e.textContent || "").trim() === title);
      if (!el) return false;
      let n = el;
      for (let i = 0; i < 8 && n; i++) {
        if (n.tagName === "BUTTON" || n.onclick || n.getAttribute?.("role") === "button") { n.click(); return true; }
        n = n.parentElement;
      }
      el.click();
      return true;
    }, JOB.job_title);
    check("the job opens from the jobs list", openedJob);
    await new Promise((r) => setTimeout(r, 1200));

    const clickedCreate = await page.evaluate(() => {
      const b = [...document.querySelectorAll("button")].find((x) => /create invoice/i.test(x.innerText));
      if (!b) return false;
      b.click();
      return true;
    });
    check("the job screen offers Create Invoice", clickedCreate);
    await new Promise((r) => setTimeout(r, 2500));

    const text = await page.evaluate(() => document.body.innerText);
    await page.screenshot({ path: path.join(outDir, "job-to-invoice.png"), fullPage: true });

    check("it navigated to the invoice form", /\/CreateInvoice/.test(page.url()), page.url());
    check("the labour line is there, named after the job",
          /Labour — Kitchen remodel/.test(text) || /Labour .{0,3} Kitchen remodel/.test(text));
    check("12 hours, not the 8-hour estimate", /\b12\b/.test(text));
    check("at the job's own rate of 85", /85/.test(text));
    check("materials came across too", /2x4 lumber/.test(text) && /Paint/.test(text));
    check("the client came from the Client row", /Dana Reyes/.test(text));
    check("it says where the figures came from",
          /hours and materials/i.test(text), "banner missing");
    check("no NaN reached the form", !/NaN/.test(text));
    check("no literal undefined in the copy", !/\bundefined\b/.test(text));

    // ---- Feature 2: batch send ------------------------------------------
    console.log("\nsending several invoices at once\n");

    await page.goto(`${origin}/Invoices`, { waitUntil: "networkidle2" });
    await new Promise((r) => setTimeout(r, 1800));

    const enteredSelect = await page.evaluate(() => {
      const b = [...document.querySelectorAll("button")].find((x) => /select invoices/i.test(x.innerText));
      if (!b) return false;
      b.click();
      return true;
    });
    check("the page offers batch selection", enteredSelect);
    await new Promise((r) => setTimeout(r, 600));

    const boxes = await page.evaluate(() => {
      const all = [...document.querySelectorAll('[role="checkbox"]')];
      return { total: all.length, disabled: all.filter((b) => b.getAttribute("data-disabled") !== null || b.disabled).length };
    });
    check("checkboxes appeared", boxes.total > 0, JSON.stringify(boxes));

    const selectedAll = await page.evaluate(() => {
      const b = [...document.querySelectorAll("button")].find((x) => /select all/i.test(x.innerText));
      if (!b) return false;
      b.click();
      return true;
    });
    check("select-all is offered", selectedAll);
    await new Promise((r) => setTimeout(r, 600));

    const barText = await page.evaluate(() => document.body.innerText);
    await page.screenshot({ path: path.join(outDir, "batch-selected.png"), fullPage: true });

    check("the paid invoice is excluded from the count",
          /Send 3\b/.test(barText), (barText.match(/Send \d+/) || ["none"])[0]);
    check("it warns that one is a re-send",
          /already been sent/i.test(barText) && /second copy/i.test(barText));
    check("it is honest that no PDF is attached", /No PDF is attached/i.test(barText));

    await page.evaluate(() => {
      const b = [...document.querySelectorAll("button")].find((x) => /^Send \d+/.test(x.innerText.trim()));
      b?.click();
    });
    await new Promise((r) => setTimeout(r, 3500));

    const resultText = await page.evaluate(() => document.body.innerText);
    await page.screenshot({ path: path.join(outDir, "batch-result.png"), fullPage: true });

    check("three invoices were actually attempted, not four",
          sends.length === 3, `${sends.length} sends: ${sends.map((s) => s.body.invoice_number).join(",")}`);
    check("the PAID invoice was never contacted",
          !sends.some((s) => s.body.invoice_number === "INV-0035"),
          sends.map((s) => s.body.invoice_number).join(","));
    check("the results name the failure rather than a bare count",
          /INV-0042/.test(resultText) && /Recipient rejected/i.test(resultText));
    check("and report 2 of 3", /Sent 2 of 3/.test(resultText),
          (resultText.match(/Sent \d+( of \d+)?/) || ["none"])[0]);

    console.log(`\n  screenshots -> ${outDir}`);
  } finally {
    await browser.close();
  }

  console.log(`\n${failed === 0 ? "ALL PASS" : "FAILURES ABOVE"} -- ${passed} passed, ${failed} failed`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
