/**
 * Render the new homepage hero and the demo form in a real browser.
 *
 * -- Why a browser and not a unit test -------------------------------------
 *
 * Everything this checks is invisible to eslint and to `vite build`. A hero
 * image whose path is wrong still builds; it just renders as a broken icon at
 * the top of the page most visitors will ever see. A component used without
 * being imported builds too, and throws at the moment it renders. And the
 * email handoff spans two pages and a query string -- there is no single unit
 * to test it in.
 *
 * The homepage is public, so unlike the other UI passes in this directory this
 * one needs no session and writes nothing.
 *
 * Usage: node scripts/test-home-hero-ui.cjs <origin>
 *   e.g. npx vite preview --port 4173 &  node scripts/test-home-hero-ui.cjs http://localhost:4173
 */
const puppeteer = require("puppeteer-core");

const CHROME =
  process.env.CHROME_PATH ||
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const origin = (process.argv[2] || "http://localhost:4173").replace(/\/$/, "");

let passed = 0,
  failed = 0;
function check(label, cond, detail) {
  if (cond) {
    passed++;
    console.log(`  PASS  ${label}`);
  } else {
    failed++;
    console.log(`  FAIL  ${label}${detail !== undefined ? ` -- ${detail}` : ""}`);
  }
}

const squash = (s) => String(s || "").replace(/\s+/g, " ").trim();

async function main() {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: "new",
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 1000 });

  const consoleErrors = [];
  page.on("console", (m) => {
    if (m.type() === "error") consoleErrors.push(squash(m.text()));
  });
  page.on("pageerror", (e) => consoleErrors.push("pageerror: " + squash(e.message)));

  const failedRequests = [];
  page.on("requestfailed", (r) => failedRequests.push(r.url()));
  page.on("response", (r) => {
    if (r.status() >= 400) failedRequests.push(`${r.status()} ${r.url()}`);
  });

  // ---- The hero ----------------------------------------------------------
  console.log("\nthe hero says the new thing");
  await page.goto(`${origin}/`, { waitUntil: "networkidle2", timeout: 60000 });
  await page.waitForSelector("h1", { timeout: 20000 });

  const h1 = squash(await page.$eval("h1", (el) => el.innerText));
  check(
    "the headline is the new one",
    h1 === "Paperwork done in minutes. Not hours.",
    h1,
  );
  // The copy it replaced, in case a merge ever puts it back.
  check("the old GET PAID TODAY headline is gone", !/GET PAID/i.test(h1), h1);

  const body = squash(await page.$eval("body", (el) => el.innerText));
  check(
    "the subheading is present",
    body.includes(
      "Invoicium turns a job into a paid invoice in under 2 minutes, from any device.",
    ),
  );
  check(
    "the CTA line is present",
    body.includes("Get access to your new invoicing all-in-one."),
  );
  check("the start microcopy is present", body.includes("Press start to begin."));

  // ---- The hero image ----------------------------------------------------
  //
  // naturalWidth is the check that matters. A wrong path still renders an <img>
  // with the right alt text and the right box; only the decoded size tells you
  // whether any pixels arrived.
  console.log("\nthe invoice image actually loaded");
  const img = await page.evaluate(() => {
    const el = document.querySelector('img[alt*="Invoicium invoice"]');
    if (!el) return null;
    return {
      complete: el.complete,
      naturalWidth: el.naturalWidth,
      naturalHeight: el.naturalHeight,
      currentSrc: el.currentSrc,
      width: el.getAttribute("width"),
      height: el.getAttribute("height"),
      loading: el.getAttribute("loading"),
    };
  });
  check("the hero image is on the page", Boolean(img));
  check("it decoded to real pixels", (img?.naturalWidth || 0) > 100, JSON.stringify(img));
  check(
    "the browser picked the WebP source",
    /\.webp$/.test(img?.currentSrc || ""),
    img?.currentSrc,
  );
  // Without intrinsic dimensions the largest element above the fold pops in and
  // shoves the whole hero down as it lands.
  check("it declares intrinsic width and height", Boolean(img?.width && img?.height));
  check("it is eager, being above the fold", img?.loading === "eager");

  // ---- The CTA -----------------------------------------------------------
  console.log("\none field, then Start");
  const field = await page.evaluate(() => {
    const el = document.querySelector('input[type="email"]');
    if (!el) return null;
    return {
      required: el.required,
      autocomplete: el.getAttribute("autocomplete"),
      label: el.getAttribute("aria-label"),
      inForm: Boolean(el.closest("form")),
    };
  });
  check("there is an email field", Boolean(field));
  check("it is required", field?.required === true);
  check("it is inside a real form, so Enter works", field?.inForm === true);
  check("it is labelled for screen readers", Boolean(field?.label));
  check("it offers the browser's saved address", field?.autocomplete === "email");

  // Exactly one thing is asked for. An extra box here is the difference
  // between starting and thinking about starting.
  const inputCount = await page.evaluate(
    () =>
      document.querySelectorAll(
        'form input:not([type="hidden"]), form select, form textarea',
      ).length,
  );
  check("the hero form asks for one thing and nothing else", inputCount === 1, inputCount);

  // ---- The handoff -------------------------------------------------------
  console.log("\nthe email carries over to signup");
  await page.type('input[type="email"]', "dave@whelanelectric.ca");
  await Promise.all([
    page.waitForNavigation({ waitUntil: "networkidle2", timeout: 30000 }).catch(() => {}),
    page.evaluate(() => document.querySelector("form").requestSubmit()),
  ]);
  await page.waitForSelector('input[type="email"]', { timeout: 20000 });

  const url = page.url();
  check("Start lands on the signup page", /\/Register/.test(url), url);
  check(
    "the address is carried in the URL",
    url.includes("email=dave%40whelanelectric.ca"),
    url,
  );
  const prefilled = await page.$eval('input[type="email"]', (el) => el.value);
  check(
    "and the signup form is already filled in",
    prefilled === "dave@whelanelectric.ca",
    prefilled,
  );

  // ---- The demo form -----------------------------------------------------
  console.log("\nthe demo asks four questions");
  await page.goto(`${origin}/BookDemo`, { waitUntil: "networkidle2", timeout: 60000 });
  await page.waitForSelector("#demo-form form", { timeout: 20000 });

  const demo = await page.evaluate(() => {
    const form = document.querySelector("#demo-form form");
    const fields = [...form.querySelectorAll("input, select")];
    return {
      ids: fields.map((f) => f.id),
      required: fields.filter((f) => f.required).length,
      trades: [...form.querySelectorAll("#demo-trade option")].map((o) => o.value),
      teamButtons: [...form.querySelectorAll('button[aria-pressed]')].length,
      submitDisabled: form.querySelector('button[type="submit"]').disabled,
      // Email is deliberately NOT asked here: Google takes it at the booking
      // step, and a phone number is the one a trade actually answers.
      hasEmail: Boolean(form.querySelector('input[type="email"]')),
    };
  });
  check(
    "name, phone and trade are the three typed fields",
    demo.ids.includes("demo-name") &&
      demo.ids.includes("demo-phone") &&
      demo.ids.includes("demo-trade"),
    JSON.stringify(demo.ids),
  );
  check("all three are required", demo.required === 3, demo.required);
  check("team size is two one-click buttons", demo.teamButtons === 2, demo.teamButtons);
  check("it does not also ask for an email", demo.hasEmail === false);
  check(
    "the trade list has the trades plus an escape hatch",
    demo.trades.includes("Electrical") && demo.trades.includes("Other"),
    JSON.stringify(demo.trades),
  );
  // Team size has no native `required`, so without this the form would submit
  // with the one answer that decides which plan the demo should show missing.
  check("submit is blocked until team size is answered", demo.submitDisabled === true);

  // Clicked and then WAITED for. Reading `disabled` in the same evaluate as the
  // click returns the value from before React has re-rendered, so the assertion
  // would fail against working code -- a test that cries wolf is worse than no
  // test, because the next person deletes it.
  await page.click('#demo-form form button[aria-pressed]');
  const unblocked = await page
    .waitForFunction(
      () =>
        document.querySelector('#demo-form form button[type="submit"]')
          ?.disabled === false,
      { timeout: 5000 },
    )
    .then(() => true)
    .catch(() => false);
  check("and unblocked once it is", unblocked === true);

  // ---- Nothing broke on the way ------------------------------------------
  console.log("\nno noise in the console");
  const realErrors = consoleErrors.filter(
    (e) => !/favicon|manifest|third-party cookie/i.test(e),
  );
  check("no console errors", realErrors.length === 0, realErrors.slice(0, 3).join(" | "));
  const realFailures = failedRequests.filter((u) => !/favicon|supabase|manifest/i.test(u));
  check(
    "no failed asset requests",
    realFailures.length === 0,
    realFailures.slice(0, 3).join(" | "),
  );

  await browser.close();
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
