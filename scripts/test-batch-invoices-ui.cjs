/**
 * Drive the batch/import screen in a real browser.
 *
 * -- Why this exists alongside test-import-brand.cjs ----------------------
 *
 * That suite proves the rules. This proves a brand-new page renders and wires
 * them up, which unit tests and `npm run build` are both blind to -- a
 * component used without importing it throws only at the moment it renders,
 * and this codebase has already shipped one of those.
 *
 * It also checks the thing the unit tests cannot: that the PATCH bodies that
 * leave the browser carry drafts, distinct invoice numbers and the right
 * totals.
 *
 * -- Nothing real is written ----------------------------------------------
 *
 * Every PostgREST read is answered with fixtures and every write is captured
 * rather than forwarded. A run that actually wrote would create six invoices on
 * a live account, and there is no batch delete.
 *
 * Usage: node scripts/test-batch-invoices-ui.cjs <origin> <sessionJson> <outDir>
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
  else { failed++; console.log(`  FAIL  ${label}${detail !== undefined ? ` -- ${detail}` : ""}`); }
}

/** Wait for a phrase to appear on the page. Swallows the timeout so the check
 *  that follows reports what was actually on screen. */
const waitForText = (page, needle, timeout = 20000) =>
  page
    .waitForFunction((n) => document.body.innerText.includes(n), { timeout }, needle)
    .catch(() => {});

const USER_ID = "55555555-5555-4555-8555-555555555555";

// Distinct names and amounts throughout, so an assertion cannot pass by
// reading the wrong row and landing on the right answer.
const CLIENTS = [
  { id: "cl-dana", user_id: USER_ID, name: "Dana Reyes", email: "dana@example.com" },
  { id: "cl-ruth", user_id: USER_ID, name: "Ruth Okafor", email: "ruth@example.com" },
  { id: "cl-sam", user_id: USER_ID, name: "Sam Vega", email: "sam@example.com" },
];
const SETTINGS = [{ id: "bs-1", user_id: USER_ID, business_name: "Miller Construction", tax_rate: 10, invoice_prefix: "MC" }];
// `status: "active"` is load-bearing, not decoration: hasAppAccess() in
// src/lib/access.js gates the whole app on it, and a fixture without it lands
// on "Invoicium needs an active plan" instead of the screen under test.
const SUBSCRIPTION = [{
  id: "sub-1", user_id: USER_ID, plan_name: "core", status: "active",
  transactions_used_this_month: 4, invoices_used_this_month: 4,
}];
const INVOICES = [{ id: "inv-old", user_id: USER_ID, invoice_number: "MC-000001", status: "paid", total: 10 }];

const CSV = [
  "client,email,description,qty,rate,due date",
  "Dana Reyes,dana@example.com,Site visit,2,150,2026-04-30",
  "Dana Reyes,dana@example.com,Materials,1,320,2026-04-30",
  "Ruth Okafor,ruth@example.com,Repair,1,90,2026-05-15",
  "Brand New Ltd,new@example.com,Consultation,1,200,2026-05-20",
].join("\n");

async function main() {
  fs.mkdirSync(outDir, { recursive: true });
  const sessionJson = fs.readFileSync(sessionPath, "utf8");
  const browser = await puppeteer.launch({
    executablePath: CHROME, headless: "new",
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1400, height: 1400, deviceScaleFactor: 2 });

  const pageErrors = [];
  page.on("pageerror", (e) => pageErrors.push(String(e.message)));

  // Allow-Headers is ECHOED, not listed: supabase-js sends different header
  // sets to PostgREST and to the functions endpoint, and one missing name
  // blocks the request while the page renders nothing -- which looks exactly
  // like the feature being broken.
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
      if (req.method() !== "GET") {
        let body = null;
        try { body = JSON.parse(req.postData() || "null"); } catch { body = req.postData(); }
        // supabase-js posts an ARRAY even for a single insert. Recording the
        // array meant every field read as null and the assertions reported an
        // empty invoice -- which looks exactly like the feature not working.
        const row = Array.isArray(body) ? body[0] : body;
        writes.push({ table, method: req.method(), body: row, raw: body });
        // Answered with a row carrying an id, because the creation path checks
        // for one before counting an invoice as created.
        //
        // The SHAPE matters. localDataEngine.create() ends in `.select().single()`,
        // which asks PostgREST for `application/vnd.pgrst.object+json` and gets a
        // bare object back -- not an array. A stub that always answered with an
        // array made every create look like it had failed, and the screen
        // honestly reported "0 drafts created" for two invoices it had just
        // posted. The bug was in the stub; the app was right.
        const made = (Array.isArray(body) ? body : [body]).map((b, i) => ({
          id: `made-${writes.length}-${i}`,
          ...(b || {}),
        }));
        const wantsObject = /pgrst\.object/.test(req.headers().accept || "");
        return req.respond({
          status: 200, contentType: "application/json", headers: cors,
          body: JSON.stringify(wantsObject ? made[0] : made),
        });
      }
      const rows =
        table === "Client" ? CLIENTS
        : table === "BusinessSettings" ? SETTINGS
        : table === "Subscription" ? SUBSCRIPTION
        : table === "Invoice" ? INVOICES
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

    // ---- Picking clients -------------------------------------------------
    console.log("\nbilling several clients at once\n");

    // Waits for the screen rather than for a guessed number of milliseconds.
    // A fixed sleep was long enough unattended and not long enough with request
    // interception in the way, and the symptom -- an empty body -- reads as
    // "the page is broken" rather than "the test was early".
    await page.goto(`${origin}/BatchInvoices`, { waitUntil: "networkidle2" });
    await waitForText(page, "Batch invoices");
    await waitForText(page, "Dana Reyes");

    let text = await page.evaluate(() => document.body.innerText);
    await page.screenshot({ path: path.join(outDir, "batch-source.png"), fullPage: true });

    check("the page renders at all", /Batch invoices/.test(text), text.slice(0, 160));
    check("both doors are offered", /Pick clients/.test(text) && /Import a spreadsheet/.test(text));
    check("the clients are listed", /Dana Reyes/.test(text) && /Ruth Okafor/.test(text));
    check("no NaN or undefined on it", !/NaN/.test(text) && !/\bundefined\b/.test(text));

    // Tick two clients.
    const ticked = await page.evaluate(() => {
      const labels = [...document.querySelectorAll("label")];
      let n = 0;
      for (const name of ["Dana Reyes", "Ruth Okafor"]) {
        const l = labels.find((x) => x.innerText.includes(name));
        const box = l?.querySelector("button[role=checkbox], input[type=checkbox]");
        if (box) { box.click(); n++; }
      }
      return n;
    });
    check("two clients can be selected", ticked === 2, `${ticked} ticked`);
    await new Promise((r) => setTimeout(r, 400));

    await page.evaluate(() => {
      const setVal = (el, v) => {
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
        setter.call(el, v);
        el.dispatchEvent(new Event("input", { bubbles: true }));
      };
      const inputs = [...document.querySelectorAll("input")];
      setVal(inputs.find((i) => i.placeholder === "Description"), "Monthly maintenance");
      setVal(inputs.find((i) => i.placeholder === "Rate"), "450");
    });
    await new Promise((r) => setTimeout(r, 500));
    text = await page.evaluate(() => document.body.innerText);
    check("the review button counts what will be made", /Review 2 invoices/.test(text),
      (text.match(/Review \d+ invoices?/) || ["none"])[0]);

    await page.evaluate(() => {
      [...document.querySelectorAll("button")].find((b) => /^Review \d+/.test(b.innerText.trim()))?.click();
    });
    await new Promise((r) => setTimeout(r, 800));
    text = await page.evaluate(() => document.body.innerText);
    await page.screenshot({ path: path.join(outDir, "batch-review.png"), fullPage: true });

    check("the review lists both invoices", /Dana Reyes/.test(text) && /Ruth Okafor/.test(text));
    check("both are ready", /2 ready/.test(text), (text.match(/\d+ ready/) || ["none"])[0]);
    check(
      "each carries the business tax rate: 450 + 10% = 495.00",
      /\$495\.00/.test(text),
      (text.match(/\$[\d,]+\.\d\d/g) || []).join(" "),
    );
    check("and the batch total is both of them", /\$990\.00/.test(text));

    writes = [];
    await page.evaluate(() => {
      [...document.querySelectorAll("button")].find((b) => /^Create \d+ draft/.test(b.innerText.trim()))?.click();
    });
    await waitForText(page, "drafts created");
    text = await page.evaluate(() => document.body.innerText);
    await page.screenshot({ path: path.join(outDir, "batch-done.png"), fullPage: true });

    check("it reports what it made", /2 drafts created/.test(text),
      (text.match(/\d+ drafts? created/) || ["none"])[0]);
    check("and says nothing was sent", /Nothing has been sent/.test(text));

    const created = writes.filter((w) => w.table === "Invoice" && w.method === "POST");
    check("two invoices were posted", created.length === 2, JSON.stringify(writes.map((w) => `${w.method} ${w.table}`)));
    check(
      "EVERY ONE IS A DRAFT",
      created.every((w) => w.body?.status === "draft"),
      JSON.stringify(created.map((w) => w.body?.status)),
    );
    const numbers = created.map((w) => w.body?.invoice_number);
    check(
      "EACH GETS ITS OWN NUMBER",
      new Set(numbers).size === 2 && numbers.every(Boolean),
      JSON.stringify(numbers),
    );
    check("using the business prefix", numbers.every((n) => String(n).startsWith("MC-")), JSON.stringify(numbers));
    check(
      "and not the number already on an existing invoice",
      !numbers.includes("MC-000001"),
      JSON.stringify(numbers),
    );
    check("the totals are what the review showed",
      created.every((w) => w.body?.total === 495), JSON.stringify(created.map((w) => w.body?.total)));
    check("each is attached to the client that was picked",
      new Set(created.map((w) => w.body?.client_id)).size === 2,
      JSON.stringify(created.map((w) => w.body?.client_id)));

    const usage = writes.find((w) => w.table === "Subscription");
    check(
      "usage is counted, so a batch is not a free way past the allowance",
      usage?.body?.invoices_used_this_month === 6,
      JSON.stringify(usage?.body),
    );

    // ---- Importing a spreadsheet ----------------------------------------
    console.log("\nimporting a spreadsheet\n");

    await page.goto(`${origin}/BatchInvoices`, { waitUntil: "networkidle2" });
    await waitForText(page, "Import a spreadsheet");
    await page.evaluate(() => {
      [...document.querySelectorAll("button")].find((b) => /Import a spreadsheet/.test(b.innerText))?.click();
    });
    await new Promise((r) => setTimeout(r, 500));

    await page.evaluate((csv) => {
      const ta = [...document.querySelectorAll("textarea")].find((t) => /client,description/.test(t.placeholder || ""));
      const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value").set;
      setter.call(ta, csv);
      ta.dispatchEvent(new Event("input", { bubbles: true }));
    }, CSV);
    await new Promise((r) => setTimeout(r, 900));
    text = await page.evaluate(() => document.body.innerText);
    await page.screenshot({ path: path.join(outDir, "import-mapping.png"), fullPage: true });

    check("it reads the rows", /4 rows of data/.test(text), (text.match(/\d+ rows? of data/) || ["none"])[0]);
    check("and offers the column mapping", /Which column is which/.test(text));
    check("nothing required is still missing", !/Still needed/.test(text), text.slice(0, 300));
    check("the review button counts INVOICES, not rows", /Review 3 invoices/.test(text),
      (text.match(/Review \d+ invoices?/) || ["none"])[0]);

    await page.evaluate(() => {
      [...document.querySelectorAll("button")].find((b) => /^Review \d+/.test(b.innerText.trim()))?.click();
    });
    await new Promise((r) => setTimeout(r, 800));
    text = await page.evaluate(() => document.body.innerText);
    await page.screenshot({ path: path.join(outDir, "import-review.png"), fullPage: true });

    check(
      "DANA'S TWO ROWS ARE ONE INVOICE, NOT TWO",
      /2 lines/.test(text),
      "one invoice per row would email her twice for one job",
    );
    check("with both lines added up: 300 + 320 = 620, +10% = 682.00",
      /\$682\.00/.test(text), (text.match(/\$[\d,]+\.\d\d/g) || []).join(" "));
    check("the unknown client is flagged as new, not as an error",
      /new client/.test(text) && /3 ready/.test(text), (text.match(/\d+ ready/) || ["none"])[0]);
    check("and creating them is offered as an explicit opt-in",
      /client.? that do not exist yet/i.test(text));
    check("the source rows are named so a bad one can be found",
      /rows 2, 3/.test(text), (text.match(/rows? [\d, ]+/g) || []).join(" | "));

    writes = [];
    await page.evaluate(() => {
      [...document.querySelectorAll("button")].find((b) => /^Create \d+ draft/.test(b.innerText.trim()))?.click();
    });
    await waitForText(page, "drafts created");
    text = await page.evaluate(() => document.body.innerText);
    await page.screenshot({ path: path.join(outDir, "import-done.png"), fullPage: true });

    const madeInvoices = writes.filter((w) => w.table === "Invoice" && w.method === "POST");
    const madeClients = writes.filter((w) => w.table === "Client" && w.method === "POST");
    check("three invoices were created", madeInvoices.length === 3, JSON.stringify(madeInvoices.map((w) => w.body?.client_name)));
    check("and one new client alongside them", madeClients.length === 1, JSON.stringify(madeClients.map((w) => w.body?.name)));
    check("the new client keeps the name and email from the file",
      madeClients[0]?.body?.name === "Brand New Ltd" && madeClients[0]?.body?.email === "new@example.com",
      JSON.stringify(madeClients[0]?.body));
    check("Dana's invoice carries both of her lines",
      madeInvoices.find((w) => w.body?.client_name === "Dana Reyes")?.body?.items?.length === 2,
      JSON.stringify(madeInvoices.map((w) => [w.body?.client_name, w.body?.items?.length])));
    check("the due date from the file is carried",
      madeInvoices.find((w) => w.body?.client_name === "Dana Reyes")?.body?.due_date === "2026-04-30",
      JSON.stringify(madeInvoices.map((w) => w.body?.due_date)));
    check("all three are drafts", madeInvoices.every((w) => w.body?.status === "draft"));
    check("with three distinct numbers",
      new Set(madeInvoices.map((w) => w.body?.invoice_number)).size === 3,
      JSON.stringify(madeInvoices.map((w) => w.body?.invoice_number)));

    check("nothing threw while any of that happened", pageErrors.length === 0, pageErrors.slice(0, 2).join(" | "));
    console.log(`\n  screenshots -> ${outDir}`);
  } finally {
    await browser.close();
  }

  console.log(`\n${failed === 0 ? "ALL PASS" : "FAILURES ABOVE"} -- ${passed} passed, ${failed} failed`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
