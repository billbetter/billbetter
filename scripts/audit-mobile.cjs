/**
 * Browser half of audit-mobile.py -- see that file for why this exists.
 *
 * For every page, at two phone widths, measures:
 *   - horizontal overflow: documentElement.scrollWidth beyond the viewport,
 *     plus the outermost elements responsible for it;
 *   - text fields whose computed font-size is under 16px (the iOS zoom rule);
 *   - whether the emulated device matches (any-pointer: coarse), since the
 *     fix keys on it and an emulator that did not would make this vacuous.
 *
 * Plus one desktop pass that fails on nothing but overflow: it writes every
 * field's computed size to desktop-fields.json, so two runs (before and after
 * a CSS change) can be diffed to show exactly which desktop fields moved.
 *
 * Exits non-zero if any phone page overflows or has a field under 16px, or
 * the desktop pass overflows.
 *
 * Usage: node scripts/audit-mobile.cjs <origin> <configJson> <outDir>
 */
const puppeteer = require("puppeteer-core");
const fs = require("fs");
const path = require("path");

const CHROME =
  process.env.CHROME_PATH ||
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const [origin, configPath, outDir] = process.argv.slice(2);
const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
const STORAGE_KEY = "invoicium-auth";

// The narrowest phone in common use, and a current iPhone. 360 is the one
// that overflows first; 390 is the one screenshotted.
const PROFILES = [
  { name: "iphone-390", width: 390, height: 844, dpr: 2, shots: true },
  { name: "android-360", width: 360, height: 780, dpr: 2, shots: false },
  { name: "desktop-1440", width: 1440, height: 900, dpr: 1, shots: false, desktop: true },
];
const IPHONE_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 " +
  "(KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";

const q = (s) => encodeURIComponent(s || "");
const PUBLIC_ROUTES = [
  "/",
  "/Pricing",
  "/Features",
  "/BookDemo",
  "/Contact",
  "/Login",
  "/Register",
  "/TermsOfService",
  "/PrivacyPolicy",
  // What a contractor's CLIENT sees -- on a phone far more often than not.
  // Opt-in (--public-links): each load logs a rate-limiter row. preview=1 so
  // the server declines to record a view (see audit-mobile.py).
  config.publicLinks && config.invoiceToken && `/i/${q(config.invoiceToken)}?preview=1`,
  config.publicLinks && config.quotePublicId &&
    `/PublicQuote?id=${q(config.quotePublicId)}&preview=1`,
].filter(Boolean);

const APP_ROUTES = [
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

// ---- Nothing leaves the browser that could change anything ---------------
const READ_RPCS = new Set(["audit_verify", "my_app_access", "paper_trail_summary"]);
const READ_FUNCTIONS = new Set([
  "get-public-invoice",
  "get-public-quote",
  "get-billing-history",
]);
const blocked = new Map();

function guard(req) {
  const url = req.url();
  const method = req.method();
  const note = (why) => {
    blocked.set(why, (blocked.get(why) || 0) + 1);
    return req.abort("blockedbyclient");
  };
  if (/\/functions\/v1\//.test(url)) {
    if (method === "OPTIONS") return req.continue();
    const name = url.split("/functions/v1/")[1].split(/[?/]/)[0];
    if (!READ_FUNCTIONS.has(name)) return note(`function ${name}`);
    // The one read function that can also write: a view record. Aborted here
    // even though preview=1 already stops the server recording it.
    if (/record_view/.test(req.postData() || "")) return note(`${name} record_view`);
    return req.continue();
  }
  if (/\/rest\/v1\/rpc\//.test(url)) {
    const name = url.split("/rest/v1/rpc/")[1].split("?")[0];
    return READ_RPCS.has(name) ? req.continue() : note(`rpc ${name}`);
  }
  if (/\/(rest|storage)\/v1\//.test(url) && !["GET", "HEAD", "OPTIONS"].includes(method)) {
    return note(`${method} ${url.split("/v1/")[1].split("?")[0]}`);
  }
  if (/api\.stripe\.com/.test(url) && method !== "GET") return note("stripe write");
  return req.continue();
}

// ---- The measurement ------------------------------------------------------
function measure() {
  const vw = document.documentElement.clientWidth;
  const sw = document.documentElement.scrollWidth;

  const isFixedOrInside = (el) => {
    for (let n = el; n && n !== document.documentElement; n = n.parentElement) {
      if (getComputedStyle(n).position === "fixed") return true;
    }
    return false;
  };
  const describe = (el) => {
    const cls = typeof el.className === "string" ? el.className : "";
    const text = (el.innerText || el.value || "").replace(/\s+/g, " ").trim();
    return `<${el.tagName.toLowerCase()}${el.id ? "#" + el.id : ""}> ` +
      `"${text.slice(0, 40)}" [${cls.slice(0, 90)}]`;
  };

  // Everything that pokes past either edge and is not contained by a
  // clipping/scrolling ancestor that itself fits. Stops at <body> on purpose:
  // overflow-x:hidden on body does not stop iOS zooming out to show it.
  const offenders = [];
  for (const el of document.body.querySelectorAll("*")) {
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) continue;
    if (r.right <= vw + 1 && r.left >= -1) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === "hidden" || cs.display === "none") continue;
    if (isFixedOrInside(el)) continue;
    let contained = false;
    for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
      if (getComputedStyle(p).overflowX !== "visible") {
        const pr = p.getBoundingClientRect();
        // A zero-size clipping ancestor (an empty <svg>) contains its children.
        contained = !pr.width || !pr.height || (pr.right <= vw + 1 && pr.left >= -1);
        break;
      }
    }
    if (!contained) offenders.push(el);
  }
  const outermost = offenders.filter(
    (el) => !offenders.some((o) => o !== el && o.contains(el)),
  );

  const NOT_TEXT = /^(checkbox|radio|file|hidden|range|color|submit|button|reset|image)$/i;
  const fields = [
    ...document.querySelectorAll(
      'input, textarea, select, [contenteditable=""], [contenteditable="true"]',
    ),
  ]
    .filter((el) => !(el.tagName === "INPUT" && NOT_TEXT.test(el.type)))
    .filter((el) => {
      const cs = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      return cs.display !== "none" && cs.visibility !== "hidden" && r.width && r.height;
    })
    .map((el) => ({
      size: parseFloat(getComputedStyle(el).fontSize),
      what:
        `<${el.tagName.toLowerCase()}${el.type ? " type=" + el.type : ""}> ` +
        (el.id || el.name || el.placeholder || el.getAttribute("aria-label") || "").slice(0, 40),
    }));
  const smallFields = fields.filter((f) => f.size < 16);

  // Text the 16px floor pushed out of its box: fits at 14px, cut off at the
  // size it renders at now. A narrow Qty or Rate cell is where raising the
  // font could cost something, so this is the regression check for the fix.
  const ctx = document.createElement("canvas").getContext("2d");
  const textWidth = (cs, px, text) => {
    ctx.font = `${cs.fontStyle} ${cs.fontWeight} ${px}px ${cs.fontFamily}`;
    return ctx.measureText(text).width;
  };
  const squeezed = [];
  for (const el of document.querySelectorAll("input, textarea")) {
    if (el.tagName === "INPUT" && NOT_TEXT.test(el.type)) continue;
    if (el.tagName === "TEXTAREA") continue; // wraps rather than clips
    const cs = getComputedStyle(el);
    if (cs.display === "none" || !el.clientWidth) continue;
    const text = el.value || el.placeholder || "";
    if (!text) continue;
    const room = el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    const now = textWidth(cs, parseFloat(cs.fontSize), text);
    if (now > room + 1 && textWidth(cs, 14, text) <= room + 1) {
      squeezed.push(`"${text.slice(0, 36)}" needs ${Math.round(now)}px, has ${Math.round(room)}px`);
    }
  }

  return {
    url: location.pathname + location.search,
    coarse: matchMedia("(any-pointer: coarse)").matches,
    overflowPx: sw - vw,
    offenders: outermost.slice(0, 6).map((el) => {
      const r = el.getBoundingClientRect();
      return `${describe(el)} left=${Math.round(r.left)} right=${Math.round(r.right)}`;
    }),
    smallFields,
    fields,
    squeezed,
  };
}

async function auditRoute(context, profile, route, results) {
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
  page.on("request", guard);
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message.slice(0, 120)));

  try {
    await page.goto(origin + route, { waitUntil: "networkidle2", timeout: 60000 });
  } catch (e) {
    errors.push("goto: " + e.message.slice(0, 80));
  }
  // Entrance animations (framer-motion slide-ins) translate content in from
  // off-screen; measuring mid-flight reports overflow that is not there.
  await new Promise((r) => setTimeout(r, 1800));

  const m = await page.evaluate(measure).catch((e) => ({ error: e.message }));
  m.route = route;
  m.errors = errors;
  if (profile.shots) {
    const file = route.replace(/[^a-z0-9]+/gi, "_").replace(/^_|_$/g, "").slice(0, 40) || "home";
    await page
      .screenshot({ path: path.join(outDir, `${profile.name}-${file}.png`), fullPage: true })
      .catch(() => {});
  }
  results.push(m);
  await page.close();
}

async function main() {
  fs.mkdirSync(outDir, { recursive: true });
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: "new",
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });

  let bad = 0;
  for (const profile of PROFILES) {
    const results = [];

    // Public pages in a context with no session: a signed-in visitor to "/"
    // is sent to the dashboard, and would audit the wrong page.
    const anon = await browser.createBrowserContext();
    for (const r of PUBLIC_ROUTES) await auditRoute(anon, profile, r, results);
    await anon.close();

    const authed = await browser.createBrowserContext();
    const seed = await authed.newPage();
    await seed.goto(origin + "/Login", { waitUntil: "domcontentloaded" });
    await seed.evaluate(
      (k, s) => {
        localStorage.setItem(k, s);
        localStorage.setItem("invoicium-remember-me", "true");
      },
      STORAGE_KEY,
      JSON.stringify(config.session),
    );
    await seed.close();
    for (const r of APP_ROUTES) await auditRoute(authed, profile, r, results);
    await authed.close();

    if (profile.desktop) {
      const dump = Object.fromEntries(results.map((m) => [m.route, m.fields || []]));
      fs.writeFileSync(path.join(outDir, "desktop-fields.json"), JSON.stringify(dump, null, 1));
    }

    console.log(`\n=== ${profile.name} (${profile.width}px) ===`);
    for (const m of results) {
      const over = m.overflowPx > 0;
      // Desktop keeps 14px fields on purpose; only overflow fails there.
      const small = profile.desktop ? 0 : (m.smallFields || []).length;
      const landed = m.url && !m.route.startsWith(m.url.split("?")[0]) ? `  -> landed on ${m.url}` : "";
      const flag = over || small || m.error ? "FAIL" : " ok ";
      if (flag === "FAIL") bad++;
      console.log(
        `  ${flag}  ${m.route.slice(0, 44).padEnd(44)} overflow=${String(m.overflowPx ?? "?").padStart(4)}px  smallFields=${small}${m.coarse === !!profile.desktop ? `  (coarse=${m.coarse}: emulation wrong)` : ""}${landed}`,
      );
      if (m.error) console.log(`          error: ${m.error}`);
      for (const o of m.offenders || []) console.log(`          wide: ${o}`);
      if (!profile.desktop) {
        for (const q of m.squeezed || []) console.log(`          squeezed by 16px: ${q}`);
      }
      const seen = new Set();
      for (const f of profile.desktop ? [] : m.smallFields || []) {
        const key = `${f.size}px ${f.what}`;
        if (seen.has(key)) continue;
        seen.add(key);
        if (seen.size <= 5) console.log(`          field: ${key}`);
      }
      if (seen.size > 5) console.log(`          ...and ${seen.size - 5} more distinct fields`);
      for (const e of (m.errors || []).slice(0, 2)) console.log(`          pageerror: ${e}`);
    }
  }

  console.log(
    config.publicLinks
      ? "\nrequests aborted (the public-link loads each logged one rate-limit row):"
      : "\nrequests aborted (no application data written):",
  );
  for (const [why, n] of [...blocked.entries()].sort()) console.log(`  ${String(n).padStart(3)}  ${why}`);
  console.log(`\n${bad === 0 ? "CLEAN" : `${bad} page checks failed`} -- screenshots in ${outDir}`);
  await browser.close();
  process.exit(bad === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
