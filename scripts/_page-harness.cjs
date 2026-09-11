/**
 * Browser half of _page_harness.py: load any page as the owner, with every
 * write blocked. Used by audit-mobile.cjs and snapshot-pages.cjs.
 *
 * -- What is blocked -------------------------------------------------------
 *
 * Every write to Supabase (anything but GET/HEAD on /rest and /storage), every
 * RPC except three reads, every edge function except the three reads a page
 * needs to render, and any non-GET to Stripe. `record_view` on the client
 * links is aborted by name even though ?preview=1 already stops the server
 * recording it -- a stray view would be sealed into the append-only paper
 * trail. See audit-mobile.py for what the client links do still write.
 *
 * -- Mocks ------------------------------------------------------------------
 *
 * openPage() can be given `mocks`:
 *   { match: RegExp, body }  a GET to /rest/v1/ whose path+query matches
 *   { fn: "name", body }     a call to edge function `name` (and its preflight)
 * Either is answered locally with `body` and never reaches Supabase. That is
 * how a page is shown states the account has no data for -- a job with
 * photos, a client's invoice link -- without writing a single row. A mocked
 * client link needs no real token, so it logs no rate-limit hit either.
 */
const puppeteer = require("puppeteer-core");
const fs = require("fs");

const CHROME =
  process.env.CHROME_PATH ||
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const STORAGE_KEY = "invoicium-auth";
const IPHONE_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 " +
  "(KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";

const READ_RPCS = new Set(["audit_verify", "my_app_access", "paper_trail_summary"]);
const READ_FUNCTIONS = new Set([
  "get-public-invoice",
  "get-public-quote",
  "get-billing-history",
]);

function readConfig(configPath) {
  return JSON.parse(fs.readFileSync(configPath, "utf8"));
}

const q = (s) => encodeURIComponent(s || "");

/** Pages anyone can load. The client links only with --public-links. */
function publicRoutes(config) {
  return [
    "/",
    "/Pricing",
    "/Features",
    "/BookDemo",
    "/Contact",
    "/Login",
    "/Register",
    "/TermsOfService",
    "/PrivacyPolicy",
    config.publicLinks && config.invoiceToken && `/i/${q(config.invoiceToken)}?preview=1`,
    config.publicLinks && config.quotePublicId &&
      `/PublicQuote?id=${q(config.quotePublicId)}&preview=1`,
  ].filter(Boolean);
}

/** Pages behind sign-in. */
function appRoutes(config) {
  return [
    "/Dashboard",
    "/Invoices",
    "/CreateInvoice",
    config.invoiceId && `/InvoiceDetail?id=${q(config.invoiceId)}`,
    "/Quotes",
    "/CreateQuote",
    config.quoteId && `/QuoteDetail?id=${q(config.quoteId)}`,
    "/QuickInvoice",
    "/QuickQuote",
    "/Clients",
    "/Calendar",
    "/ChaseInvoice",
    "/PaperTrail",
    "/RecurringInvoices",
    "/BatchInvoices",
    "/JobPhotos",
    "/Analytics",
    "/PaymentPlans",
    "/Settings",
  ].filter(Boolean);
}

/** Tally of what was stopped, keyed by reason, across every page. */
const blocked = new Map();

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "*",
  "access-control-expose-headers": "content-range",
};

function guard(req, mocks = []) {
  const url = req.url();
  const method = req.method();
  if (method === "GET" && url.includes("/rest/v1/")) {
    const target = url.split("/rest/v1/")[1];
    const mock = mocks.find((m) => m.match && m.match.test(target));
    if (mock) {
      const n = Array.isArray(mock.body) ? mock.body.length : 1;
      return req.respond({
        status: 200,
        contentType: "application/json",
        headers: { ...CORS, "content-range": `0-${Math.max(n - 1, 0)}/${n}` },
        body: JSON.stringify(mock.body),
      });
    }
  }
  const block = (why) => {
    blocked.set(why, (blocked.get(why) || 0) + 1);
    return req.abort("blockedbyclient");
  };
  if (/\/functions\/v1\//.test(url)) {
    const name = url.split("/functions/v1/")[1].split(/[?/]/)[0];
    const fnMock = mocks.find((m) => m.fn === name);
    if (fnMock) {
      const headers = { ...CORS, "access-control-allow-methods": "POST, OPTIONS" };
      if (method === "OPTIONS") return req.respond({ status: 204, headers, body: "" });
      if (/record_view/.test(req.postData() || "")) return block(`${name} record_view`);
      return req.respond({
        status: 200,
        contentType: "application/json",
        headers,
        body: JSON.stringify(fnMock.body),
      });
    }
    if (method === "OPTIONS") return req.continue();
    if (!READ_FUNCTIONS.has(name)) return block(`function ${name}`);
    if (/record_view/.test(req.postData() || "")) return block(`${name} record_view`);
    return req.continue();
  }
  if (/\/rest\/v1\/rpc\//.test(url)) {
    const name = url.split("/rest/v1/rpc/")[1].split("?")[0];
    return READ_RPCS.has(name) ? req.continue() : block(`rpc ${name}`);
  }
  if (/\/(rest|storage)\/v1\//.test(url) && !["GET", "HEAD", "OPTIONS"].includes(method)) {
    return block(`${method} ${url.split("/v1/")[1].split("?")[0]}`);
  }
  if (/api\.stripe\.com/.test(url) && method !== "GET") return block("stripe write");
  return req.continue();
}

async function launch() {
  return puppeteer.launch({
    executablePath: CHROME,
    headless: "new",
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
}

/** A browser context with the owner's session already in localStorage. */
async function signedInContext(browser, origin, session) {
  const context = await browser.createBrowserContext();
  const seed = await context.newPage();
  await seed.goto(origin + "/Login", { waitUntil: "domcontentloaded" });
  await seed.evaluate(
    (key, value) => {
      localStorage.setItem(key, value);
      localStorage.setItem("invoicium-remember-me", "true");
    },
    STORAGE_KEY,
    JSON.stringify(session),
  );
  await seed.close();
  return context;
}

/**
 * Open `route` in `context` at `profile` size, guarded, and let it settle.
 * `beforeLoad(page)` runs before navigation (e.g. to freeze the clock);
 * `mocks` answers matching reads locally (see "Mocks" above).
 * Returns { page, errors }; the caller closes the page.
 */
async function openPage(context, origin, profile, route, beforeLoad, mocks = []) {
  const page = await context.newPage();
  if (!profile.desktop) await page.setUserAgent(IPHONE_UA);
  await page.setViewport({
    width: profile.width,
    height: profile.height,
    deviceScaleFactor: profile.dpr,
    isMobile: !profile.desktop,
    hasTouch: !profile.desktop,
  });
  await page.setRequestInterception(true);
  page.on("request", (req) => guard(req, mocks));
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message.slice(0, 160)));
  // An alert() or confirm() blocks the page until someone answers it, which
  // hangs the run. Dismiss them -- for confirm() that is "Cancel", the answer
  // that can never start something destructive -- and record the text.
  page.on("dialog", async (d) => {
    errors.push(`${d.type()}: ${d.message().slice(0, 140)}`);
    await d.dismiss().catch(() => {});
  });
  if (beforeLoad) await beforeLoad(page);

  try {
    await page.goto(origin + route, { waitUntil: "networkidle2", timeout: 60000 });
  } catch (e) {
    errors.push("goto: " + e.message.slice(0, 80));
  }
  // Entrance animations (framer-motion slide-ins) translate content in from
  // off-screen; measuring mid-flight reports states that are not there.
  await new Promise((r) => setTimeout(r, 1800));
  return { page, errors };
}

function printBlocked(config) {
  console.log(
    config.publicLinks
      ? "\nrequests aborted (the public-link loads each logged one rate-limit row):"
      : "\nrequests aborted (no application data written):",
  );
  for (const [why, n] of [...blocked.entries()].sort()) {
    console.log(`  ${String(n).padStart(3)}  ${why}`);
  }
}

module.exports = {
  readConfig,
  publicRoutes,
  appRoutes,
  launch,
  signedInContext,
  openPage,
  printBlocked,
};
