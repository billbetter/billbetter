/**
 * Render CancelSubscription in a real browser, in every state it has.
 *
 * -- Why this is separate from test-cancel-subscription.cjs ----------------
 *
 * That one proves the edge function returns the right facts. This proves the
 * page SAYS them. They are different failures: a correct access_until that the
 * page never prints, or prints as "Invalid Date", looks identical from the
 * server side.
 *
 * The edge-function call is intercepted and answered here, so this needs
 * nothing deployed and, more importantly, never touches the real Stripe
 * subscription. A UI check that could cancel the owner's live plan would be a
 * bad trade for a screenshot.
 *
 * The null-date case is the one to look at. It is not hypothetical -- Stripe
 * moved current_period_end onto the subscription item in 2025-04-30.basil, and
 * a direct read on this account's version may not carry it. The page has to
 * read as a finished sentence with no date in it.
 *
 * Usage: node scripts/test-cancel-page-ui.cjs <origin> <sessionJson> <outDir>
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

const ACCESS_UNTIL = "2026-09-30T12:00:00.000Z";

// The page formats with toLocaleDateString(undefined, ...) -- the VIEWER's
// locale, which is the right call for a product sold in Canada where both
// "September 30, 2026" and "30 September 2026" are normal. So the assertion
// checks the three parts are on the page, not the order they appear in.
// Asserting one format would have been asserting something the page does not
// promise, and it failed first time round purely because headless Chrome here
// defaults to en-GB.
const showsDate = (t) => /September/.test(t) && /\b30\b/.test(t) && /2026/.test(t);

const SCENARIOS = [
  {
    name: "decide",
    title: "the decision, with a real end date",
    reply: { success: true, state: {
      plan_name: "pro", status: "active", cancel_at_period_end: false,
      access_until: ACCESS_UNTIL, amount: 29, currency: "CAD", interval: "month",
    } },
    expect: (t) => [
      ["names the plan in the heading", /Cancel Pro plan\?/i.test(t)],
      ["prints the end date, in whatever order the locale puts it", showsDate(t)],
      ["states the price", /\$29/.test(t) && /a month/.test(t)],
      ["promises no further charges", /No more charges/i.test(t)],
      ["says nothing is deleted", /nothing is deleted/i.test(t)],
      ["offers keeping the plan", /Keep my plan/i.test(t)],
      ["no Invalid Date anywhere", !/Invalid Date/.test(t)],
      ["no literal null or undefined leaked into copy", !/\bnull\b|\bundefined\b/.test(t)],
    ],
  },
  {
    name: "decide-no-date",
    title: "the decision when Stripe gave us no date",
    reply: { success: true, state: {
      plan_name: "pro", status: "active", cancel_at_period_end: false,
      access_until: null, amount: 29, currency: "CAD", interval: "month",
    } },
    expect: (t) => [
      ["still a finished sentence with no date", /until the end of this period/i.test(t)],
      ["no Invalid Date", !/Invalid Date/.test(t)],
      ["did not fall back to 1970", !/1970/.test(t)],
      ["no literal null or undefined leaked into copy", !/\bnull\b|\bundefined\b/.test(t)],
    ],
  },
  {
    name: "scheduled",
    title: "already scheduled to cancel",
    reply: { success: true, state: {
      plan_name: "pro", status: "active", cancel_at_period_end: true,
      access_until: ACCESS_UNTIL, amount: 29, currency: "CAD", interval: "month",
    } },
    expect: (t) => [
      ["says it is already set to cancel", /already set to cancel/i.test(t)],
      ["repeats the end date", showsDate(t)],
      ["offers the undo", /Keep my plan/i.test(t)],
      ["tells them to download while they still can", /download them now/i.test(t)],
      ["no Invalid Date", !/Invalid Date/.test(t)],
    ],
  },
  {
    name: "error",
    title: "no Stripe subscription behind the plan",
    status: 400,
    reply: { success: false, error: "no_stripe_subscription",
      message: "This plan is not billed through Stripe, so there is nothing to cancel here. Contact support@invoicium.ca and we will sort it out." },
    expect: (t) => [
      ["explains rather than showing a blank page", /couldn.t open your plan/i.test(t)],
      ["passes the server's own message through", /not billed through Stripe/i.test(t)],
      ["gives a way back", /Back to Settings/i.test(t)],
      ["does not render the cancel buttons", !/Cancel Pro plan/i.test(t)],
    ],
  },
];

async function main() {
  fs.mkdirSync(outDir, { recursive: true });
  const sessionJson = fs.readFileSync(sessionPath, "utf8");
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: "new",
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });

  try {
    for (const s of SCENARIOS) {
      const page = await browser.newPage();
      await page.setViewport({ width: 1280, height: 1400, deviceScaleFactor: 2 });

      let intercepted = 0;
      await page.setRequestInterception(true);
      page.on("request", (req) => {
        if (req.url().includes("/functions/v1/stripe-cancel-subscription")) {
          // The preflight has to be answered as a preflight. supabase-js sends
          // Authorization, apikey and x-client-info, so a stub that returns
          // only Allow-Origin gets the real POST blocked -- and the page then
          // shows its error card for every scenario, which looks exactly like
          // the page being broken. It cost a debugging round the first time;
          // the headers below are why it will not cost another.
          const cors = {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers":
              "authorization, apikey, content-type, x-client-info, x-supabase-api-version",
          };
          if (req.method() === "OPTIONS") {
            req.respond({ status: 204, headers: cors, body: "" });
            return;
          }
          intercepted++;
          req.respond({
            status: s.status || 200,
            contentType: "application/json",
            headers: cors,
            body: JSON.stringify(s.reply),
          });
          return;
        }
        req.continue();
      });

      await page.goto(`${origin}/Login`, { waitUntil: "domcontentloaded" });
      await page.evaluate((key, sess) => {
        window.localStorage.setItem(key, sess);
        window.localStorage.setItem("invoicium-remember-me", "true");
      }, STORAGE_KEY, sessionJson);

      await page.goto(`${origin}/CancelSubscription`, { waitUntil: "networkidle2" });
      await new Promise((r) => setTimeout(r, 1200));

      const text = await page.evaluate(() => document.body.innerText);
      const shot = path.join(outDir, `cancel-${s.name}.png`);
      await page.screenshot({ path: shot, fullPage: true });

      console.log(`\n${s.title}\n`);
      check("the page called the edge function", intercepted > 0, `${intercepted} calls`);
      for (const [label, cond] of s.expect(text)) check(label, cond);
      console.log(`  -> ${shot}`);

      await page.close();
    }
  } finally {
    await browser.close();
  }

  console.log(`\n${failed === 0 ? "ALL PASS" : "FAILURES ABOVE"} -- ${passed} passed, ${failed} failed`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
