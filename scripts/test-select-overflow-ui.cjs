/**
 * Prove the status dropdown is not clipped by the table it sits in.
 *
 * -- The bug ---------------------------------------------------------------
 *
 * SelectContent was an absolutely-positioned sibling of its trigger, so any
 * ancestor with `overflow: hidden|auto|scroll` clipped it. Both the invoice and
 * quote tables are wrapped in `overflow-hidden ... overflow-x-auto`, so opening
 * the status dropdown on a row near the bottom showed the first option or two
 * and cut the rest off at the card's edge, unreachable.
 *
 * It carried `z-[9999]`, which cannot help: z-index orders what is painted, and
 * a clipped element is not painted outside its scroll container at all.
 *
 * -- Why this test measures hit-testing, not the DOM -----------------------
 *
 * Asserting the options EXIST proves nothing -- they existed before the fix
 * too; they were just invisible and unclickable. So each option's centre point
 * is fed to document.elementFromPoint, and the option only counts if what is
 * actually on screen at that point is the option itself. That is the same
 * question the browser asks when the user clicks, and it is false for a clipped
 * element.
 *
 * Usage: node scripts/test-select-overflow-ui.cjs <origin> <sessionJson> <outDir>
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

const waitForText = (page, needle, timeout = 20000) =>
  page
    .waitForFunction((n) => document.body.innerText.includes(n), { timeout }, needle)
    .catch(() => {});

const USER_ID = "99999999-9999-4999-8999-999999999999";
const CLIENT_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

// Enough rows that the LAST one sits near the bottom of the card, which is
// where the clipping bit. Distinct numbers so a row cannot be confused.
const INVOICES = Array.from({ length: 8 }, (_, i) => ({
  id: `inv-${i}`,
  user_id: USER_ID,
  invoice_number: `INV-90${i}0`,
  status: "sent",
  client_id: CLIENT_ID,
  client_name: `Client ${i}`,
  client_email: `c${i}@example.com`,
  items: [{ description: "Work", quantity: 1, rate: 100 + i, amount: 100 + i }],
  subtotal: 100 + i, tax_rate: 0, tax_amount: 0, total: 100 + i,
  due_date: "2026-06-30",
  created_at: "2026-05-01T09:00:00.000Z",
  created_date: "2026-05-01T09:00:00.000Z",
  public_token: `bbbbbbbb-bbbb-4bbb-8bbb-${String(i).padStart(12, "0")}`,
}));

const QUOTES = Array.from({ length: 8 }, (_, i) => ({
  id: `q-${i}`,
  user_id: USER_ID,
  quote_number: `QUO-70${i}0`,
  status: "draft",
  client_id: CLIENT_ID,
  client_name: `Client ${i}`,
  client_email: `c${i}@example.com`,
  items: [{ description: "Work", quantity: 1, rate: 200 + i, amount: 200 + i }],
  subtotal: 200 + i, tax_rate: 0, tax_amount: 0, total: 200 + i,
  date_issued: "2026-05-01", expiry_date: "2026-06-01",
  created_at: "2026-05-01T09:00:00.000Z",
  created_date: "2026-05-01T09:00:00.000Z",
}));

/**
 * Open the status control on the LAST visible row and report whether every
 * option is genuinely on screen and hittable.
 */
async function openLastStatusAndMeasure(page, currentLabel) {
  const marked = await page.evaluate((label) => {
    const triggers = [...document.querySelectorAll("button")]
      .filter((b) => b.offsetParent !== null)
      .filter((b) => new RegExp(`^${label}$`, "i").test((b.innerText || "").trim()));
    if (!triggers.length) return { ok: false, count: 0 };
    const last = triggers[triggers.length - 1];
    last.setAttribute("data-test-status", "1");
    last.scrollIntoView({ block: "center" });
    return { ok: true, count: triggers.length };
  }, currentLabel);

  if (!marked.ok) return { opened: false, options: [] };

  await page.click("[data-test-status]");
  await new Promise((r) => setTimeout(r, 400));

  return page.evaluate(() => {
    const items = [...document.querySelectorAll("[data-select-item-value]")];
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    return {
      opened: items.length > 0,
      options: items.map((el) => {
        const r = el.getBoundingClientRect();
        const cx = r.left + r.width / 2;
        const cy = r.top + r.height / 2;
        const hit = document.elementFromPoint(cx, cy);
        return {
          value: el.getAttribute("data-select-item-value"),
          inViewport: r.top >= 0 && r.bottom <= vh && r.left >= 0 && r.right <= vw,
          hasSize: r.width > 0 && r.height > 0,
          // The decisive one: is this option what the browser would actually
          // hand a click at its own centre?
          hittable: Boolean(hit && (el === hit || el.contains(hit) || hit.contains(el))),
        };
      }),
    };
  });
}

async function main() {
  fs.mkdirSync(outDir, { recursive: true });
  const sessionJson = fs.readFileSync(sessionPath, "utf8");
  const browser = await puppeteer.launch({
    executablePath: CHROME, headless: "new",
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  const page = await browser.newPage();
  const pageErrors = [];
  page.on("pageerror", (e) => pageErrors.push(String(e.message)));

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
      // Anything not stubbed here -- rpc/my_app_access above all -- goes to the
      // real backend, or the paywall denies the whole app.
      const OWNED = new Set([
        "Invoice", "Quote", "InvoicePayment", "InvoiceEvent",
        "Client", "BusinessSettings", "Subscription",
      ]);
      if (!OWNED.has(table)) return req.continue();

      if (req.method() !== "GET") {
        let body = null;
        try { body = JSON.parse(req.postData() || "null"); } catch { body = req.postData(); }
        const row = Array.isArray(body) ? body[0] : body;
        writes.push({ table, method: req.method(), body: row });
        const made = (Array.isArray(body) ? body : [body]).map((b, i) => ({
          id: `made-${writes.length}-${i}`, ...(b || {}),
        }));
        const wantsObject = /pgrst\.object/.test(req.headers().accept || "");
        return req.respond({ status: 200, contentType: "application/json", headers: cors,
          body: JSON.stringify(wantsObject ? made[0] : made) });
      }

      const rows =
        table === "Invoice" ? INVOICES
        : table === "Quote" ? QUOTES
        : table === "InvoicePayment" || table === "InvoiceEvent" ? []
        : table === "Client" ? [{ id: CLIENT_ID, name: "Client 0", email: "c0@example.com" }]
        : table === "BusinessSettings" ? [{ id: "bs", user_id: USER_ID, business_name: "Miller Construction" }]
        : table === "Subscription" ? [{ id: "sub", user_id: USER_ID, plan_name: "core", status: "active" }]
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

    // A short viewport on purpose: it puts the last row hard against the
    // bottom, which is the situation that was broken.
    for (const [w, h] of [[1400, 700], [1400, 520]]) {
      console.log(`\ninvoices table at ${w}x${h}\n`);
      await page.setViewport({ width: w, height: h, deviceScaleFactor: 1 });
      await page.goto(`${origin}/Invoices`, { waitUntil: "networkidle2" });
      await waitForText(page, "INV-9070");

      const res = await openLastStatusAndMeasure(page, "sent");
      await page.screenshot({ path: path.join(outDir, `invoices-${h}.png`) });

      check(`the dropdown opens (${h}px tall)`, res.opened, JSON.stringify(res));
      check(
        `every option is inside the viewport (${h}px tall)`,
        res.options.length > 0 && res.options.every((o) => o.inViewport),
        JSON.stringify(res.options),
      );
      check(
        `EVERY OPTION IS ACTUALLY CLICKABLE (${h}px tall)`,
        res.options.length > 0 && res.options.every((o) => o.hittable && o.hasSize),
        JSON.stringify(res.options.filter((o) => !o.hittable)),
      );
      check(
        `all five statuses are reachable, not just the first few (${h}px tall)`,
        res.options.length === 5,
        JSON.stringify(res.options.map((o) => o.value)),
      );
    }

    // ---- Selecting still works ------------------------------------------
    console.log("\nselecting an option\n");

    writes = [];
    await page.setViewport({ width: 1400, height: 520, deviceScaleFactor: 1 });
    await page.goto(`${origin}/Invoices`, { waitUntil: "networkidle2" });
    await waitForText(page, "INV-9070");
    await openLastStatusAndMeasure(page, "sent");

    // Clicked with the REAL mouse, at the option's own coordinates.
    //
    // element.click() dispatches only a click event -- no mousedown -- so the
    // document-level close-on-mousedown-outside handler never runs and the
    // click always lands. That made this check pass even with the click-outside
    // guard removed, i.e. it did not test the thing it is named after.
    // Measured: it survived a mutation run until this used page.mouse.
    const point = await page.evaluate(() => {
      const el = document.querySelector('[data-select-item-value="overdue"]');
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    });
    check("the overdue option is on screen", Boolean(point), JSON.stringify(point));
    if (point) await page.mouse.click(point.x, point.y);
    await new Promise((r) => setTimeout(r, 1200));

    const patches = writes.filter((w) => w.table === "Invoice" && w.method === "PATCH");
    check(
      "AND THE CLICK ACTUALLY CHANGES THE STATUS",
      patches.some((p) => p.body?.status === "overdue"),
      // The portal moves the menu OUT of the trigger's subtree, so a
      // click-outside handler that only checked the trigger would close the
      // menu on mousedown and the option's click would never land. This is the
      // check that catches that.
      JSON.stringify(patches.map((p) => p.body?.status)),
    );

    const closed = await page.evaluate(
      () => document.querySelectorAll("[data-select-item-value]").length === 0,
    );
    check("and the menu closes afterwards", closed);

    // ---- Quotes ----------------------------------------------------------
    console.log("\nquotes table\n");

    await page.goto(`${origin}/Quotes`, { waitUntil: "networkidle2" });
    await waitForText(page, "QUO-7070");
    const qres = await openLastStatusAndMeasure(page, "draft");
    await page.screenshot({ path: path.join(outDir, "quotes.png") });

    check("the quote dropdown opens", qres.opened, JSON.stringify(qres).slice(0, 200));
    check(
      "every quote option is clickable too",
      qres.options.length > 0 && qres.options.every((o) => o.hittable),
      JSON.stringify(qres.options.filter((o) => !o.hittable)),
    );

    // ---- It follows the trigger when the page scrolls --------------------
    console.log("\nscrolling with the menu open\n");

    const moved = await page.evaluate(async () => {
      const before = document
        .querySelector("[data-select-item-value]")
        ?.getBoundingClientRect().top;
      window.scrollBy(0, 120);
      await new Promise((r) => setTimeout(r, 250));
      const after = document
        .querySelector("[data-select-item-value]")
        ?.getBoundingClientRect().top;
      return { before, after, scrolled: window.scrollY };
    });
    check(
      "a fixed menu is repositioned rather than left floating",
      moved.before === undefined ||
        moved.after === undefined ||
        moved.scrolled === 0 ||
        Math.abs(moved.before - moved.after) > 1,
      JSON.stringify(moved),
    );

    check("nothing threw", pageErrors.length === 0, pageErrors.slice(0, 2).join(" | "));
    console.log(`\n  screenshots -> ${outDir}`);
  } finally {
    await browser.close();
  }

  console.log(`\n${failed === 0 ? "ALL PASS" : "FAILURES ABOVE"} -- ${passed} passed, ${failed} failed`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
