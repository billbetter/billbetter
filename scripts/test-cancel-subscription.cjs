/**
 * Prove stripe-cancel-subscription behaves, without a Stripe key and without a
 * network.
 *
 * -- Why this exists --------------------------------------------------------
 *
 * One bug in this function is much worse than the others: printing the wrong
 * date. Everything else fails loudly -- a broken cancel throws, a broken auth
 * check 401s -- but a wrong "you keep access until..." is silent, plausible,
 * and it is the single fact the customer plans around.
 *
 * That failure has a specific cause waiting for it. Stripe moved
 * current_period_start/end OFF the subscription and onto each subscription ITEM
 * in API version 2025-04-30.basil, and this account is on 2026-04-22.dahlia.
 * stripe-webhook still reads the top-level field and is right to -- webhook
 * events arrive at the version pinned on the endpoint -- but a direct read does
 * not get that guarantee. So the shapes below are the real ones: pre-basil
 * (top level), post-basil (on the item), and the case where neither is there,
 * which must produce NO date rather than a guess.
 *
 * It runs the real handler, not a copy of it: index.ts is flattened exactly the
 * way scripts/deploy-functions.py flattens it, Deno.serve is captured instead
 * of called, and fetch is stubbed. So the auth check, the row lookup and the
 * Stripe calls are all the shipped code.
 *
 * Usage: node scripts/test-cancel-subscription.cjs
 */
const fs = require("fs");
const os = require("os");
const path = require("path");
const esbuild = require("esbuild");

const ROOT = path.join(__dirname, "..");
const FN = path.join(ROOT, "supabase", "functions", "stripe-cancel-subscription", "index.ts");
const SHARED = path.join(ROOT, "supabase", "functions", "_shared");

let passed = 0, failed = 0;
function check(label, cond, detail) {
  if (cond) { passed++; console.log(`  PASS  ${label}`); }
  else { failed++; console.log(`  FAIL  ${label}${detail !== undefined ? ` -- ${detail}` : ""}`); }
}

// Mirrors deploy-functions.py inline_shared: same import shape, same recursion,
// same "already inlined" skip. If that script's rule changes, this stops
// matching and the test is testing a bundle we do not ship.
const IMPORT_RE = /^import\s+(?:type\s+)?\{[^}]+\}\s+from\s+['"](?:\.\.\/_shared|\.)\/([^'"]+)['"]\s*;?\s*$/;
function inlineShared(source, visited = new Set()) {
  return source.split("\n").map((line) => {
    const m = IMPORT_RE.exec(line.trim());
    if (!m) return line;
    if (visited.has(m[1])) return "";
    visited.add(m[1]);
    const p = path.join(SHARED, m[1]);
    if (!fs.existsSync(p)) return line;
    return inlineShared(fs.readFileSync(p, "utf8"), visited);
  }).join("\n");
}

// ---------------------------------------------------------------------------
// Stripe subscription fixtures.
//
// Distinct period-end values on purpose: if the resolver read the wrong field
// the assertions would still be comparing against a different date, so they
// discriminate instead of agreeing by coincidence.
// ---------------------------------------------------------------------------
const ITEM_END = 1789000000;      // 2026-09-08 -- on the item (post-basil)
const TOP_END = 1786000000;       // 2026-08-04 -- top level (pre-basil)
const CANCEL_AT = 1780000000;     // 2026-05-27 -- cancel_at fallback

const item = (end) => ({
  data: [{
    current_period_end: end,
    price: { unit_amount: 2900, currency: "cad", recurring: { interval: "month" } },
  }],
});

const SUBS = {
  postBasil: { id: "sub_1", status: "active", cancel_at_period_end: false, items: item(ITEM_END) },
  preBasil: {
    id: "sub_2", status: "active", cancel_at_period_end: false,
    current_period_end: TOP_END,
    items: { data: [{ price: { unit_amount: 2900, currency: "cad", recurring: { interval: "month" } } }] },
  },
  cancelAtOnly: {
    id: "sub_3", status: "active", cancel_at_period_end: true, cancel_at: CANCEL_AT,
    items: { data: [{ price: { unit_amount: 2900, currency: "cad", recurring: { interval: "month" } } }] },
  },
  noDateAnywhere: {
    id: "sub_4", status: "active", cancel_at_period_end: false,
    items: { data: [{ price: { unit_amount: 2900, currency: "cad", recurring: { interval: "month" } } }] },
  },
  alreadyCanceled: { id: "sub_5", status: "canceled", cancel_at_period_end: false, items: item(ITEM_END) },
  scheduled: { id: "sub_6", status: "active", cancel_at_period_end: true, items: item(ITEM_END) },
};

const iso = (s) => new Date(s * 1000).toISOString();

async function main() {
  let ts = inlineShared(fs.readFileSync(FN, "utf8"));
  // Capture the handler rather than starting a server.
  ts = ts.replace(/Deno\.serve\(/, "export const __handler = (");
  const { code } = await esbuild.transform(ts, { loader: "ts", format: "esm", target: "es2022" });
  const tmp = path.join(os.tmpdir(), `cancel-sub-under-test-${process.pid}.mjs`);
  fs.writeFileSync(tmp, code);

  globalThis.Deno = {
    env: { get: (k) => ({
      SUPABASE_URL: "https://stub.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "stub-service-role",
      STRIPE_SECRET_KEY: "sk_test_placeholder_not_a_real_key",
      APP_BASE_URL: "https://www.invoicium.ca",
    }[k]) },
  };

  // World state the stub answers from.
  const world = { user: { id: "user-1", email: "c@example.com" }, row: null, sub: null, stripeError: null };
  const stripeCalls = [];

  globalThis.fetch = async (url, init = {}) => {
    const u = String(url);
    const ok = (body, status = 200) => ({
      ok: status >= 200 && status < 300, status,
      json: async () => body, text: async () => JSON.stringify(body),
    });
    if (u.includes("/auth/v1/user")) {
      return world.user ? ok(world.user) : ok({}, 401);
    }
    if (u.includes("/rest/v1/Subscription")) {
      return ok(world.row ? [world.row] : []);
    }
    if (u.includes("api.stripe.com")) {
      stripeCalls.push({ url: u, method: init.method || "GET", body: init.body || null });
      if (world.stripeError) return ok({ error: { message: world.stripeError } }, 400);
      if (init.method === "POST") {
        const params = new URLSearchParams(String(init.body));
        world.sub = { ...world.sub, cancel_at_period_end: params.get("cancel_at_period_end") === "true" };
      }
      return ok(world.sub);
    }
    throw new Error(`unexpected fetch to ${u}`);
  };

  const mod = await import("file://" + tmp.replace(/\\/g, "/"));
  const call = async (action, { auth = true } = {}) => {
    const req = new Request("https://fn.local/stripe-cancel-subscription", {
      method: "POST",
      headers: auth ? { Authorization: "Bearer user-token", "Content-Type": "application/json" } : { "Content-Type": "application/json" },
      body: JSON.stringify(action ? { action } : {}),
    });
    const res = await mod.__handler(req);
    return { status: res.status, body: await res.json() };
  };

  console.log("\nthe date, across the Stripe API version change\n");

  world.row = { id: "row-1", user_id: "user-1", plan_name: "pro", stripe_subscription_id: "sub_1" };
  world.sub = SUBS.postBasil;
  let r = await call("preview");
  check("reads current_period_end off the ITEM (2025-04-30.basil and later)",
        r.body.state.access_until === iso(ITEM_END), r.body.state.access_until);

  world.sub = SUBS.preBasil;
  r = await call("preview");
  check("still reads the TOP-LEVEL field when that is where it is",
        r.body.state.access_until === iso(TOP_END), r.body.state.access_until);

  world.sub = SUBS.cancelAtOnly;
  r = await call("preview");
  check("falls back to cancel_at when neither period end is present",
        r.body.state.access_until === iso(CANCEL_AT), r.body.state.access_until);

  world.sub = SUBS.noDateAnywhere;
  r = await call("preview");
  check("returns NULL rather than inventing a date when Stripe gives none",
        r.body.state.access_until === null, r.body.state.access_until);

  // The point of the null above: the page must be able to tell "no date" from
  // "the epoch". A resolver that fell through to `new Date(undefined * 1000)`
  // would hand the page an Invalid Date, and a resolver that used `|| 0` would
  // confidently promise access until January 1970.
  check("and that null is not a disguised epoch or Invalid Date",
        !String(r.body.state.access_until).includes("1970") &&
        String(r.body.state.access_until) !== "Invalid Date", r.body.state.access_until);

  console.log("\nthe money it reports\n");

  world.sub = SUBS.postBasil;
  r = await call("preview");
  check("unit_amount is converted from cents", r.body.state.amount === 29, r.body.state.amount);
  check("currency is upper-cased for Intl", r.body.state.currency === "CAD", r.body.state.currency);
  check("interval comes through", r.body.state.interval === "month", r.body.state.interval);
  check("plan name comes from OUR row, not Stripe's price nickname",
        r.body.state.plan_name === "pro", r.body.state.plan_name);

  console.log("\ncancelling never means immediately\n");

  world.sub = { ...SUBS.postBasil };
  stripeCalls.length = 0;
  r = await call("cancel");
  const post = stripeCalls.find((c) => c.method === "POST");
  check("cancel POSTs cancel_at_period_end=true", post && /cancel_at_period_end=true/.test(post.body), post && post.body);
  check("and never calls DELETE /subscriptions, which would end it today",
        !stripeCalls.some((c) => c.method === "DELETE"), stripeCalls.map((c) => c.method).join(","));
  check("the reply says the cancellation is scheduled", r.body.state.cancel_at_period_end === true);
  check("access_until survives the cancel", r.body.state.access_until === iso(ITEM_END), r.body.state.access_until);

  console.log("\nresume, and the no-op paths a double click produces\n");

  r = await call("resume");
  check("resume clears the schedule", r.body.state.cancel_at_period_end === false);

  world.sub = { ...SUBS.scheduled };
  stripeCalls.length = 0;
  r = await call("cancel");
  check("cancelling an already-scheduled cancel is a no-op, not an error",
        r.status === 200 && r.body.success === true && r.body.unchanged === true, JSON.stringify(r.body));
  check("and sends no POST to Stripe", !stripeCalls.some((c) => c.method === "POST"));

  world.sub = { ...SUBS.postBasil };
  stripeCalls.length = 0;
  r = await call("resume");
  check("resuming something never cancelled is also a no-op",
        r.body.unchanged === true && !stripeCalls.some((c) => c.method === "POST"), JSON.stringify(r.body));

  console.log("\nan unknown action cannot do anything\n");

  world.sub = { ...SUBS.postBasil };
  stripeCalls.length = 0;
  r = await call("delete_everything");
  check("an unrecognised action falls back to preview", r.body.success === true && r.body.state !== undefined);
  check("and writes nothing", !stripeCalls.some((c) => c.method === "POST"));

  console.log("\nthe states that are not a bug\n");

  world.sub = SUBS.alreadyCanceled;
  r = await call("preview");
  check("an already-ended subscription reports already_ended, not an error",
        r.status === 200 && r.body.already_ended === true, JSON.stringify(r.body));

  world.row = { id: "row-1", user_id: "user-1", plan_name: "pro", stripe_subscription_id: null };
  r = await call("preview");
  check("a plan with no Stripe subscription explains itself",
        r.status === 400 && r.body.error === "no_stripe_subscription" && /support@invoicium\.ca/.test(r.body.message),
        JSON.stringify(r.body));

  world.row = null;
  r = await call("preview");
  check("no subscription row at all says so plainly",
        r.status === 400 && /do not have a subscription/i.test(r.body.message), JSON.stringify(r.body));

  world.row = { id: "row-1", user_id: "user-1", plan_name: "pro", stripe_subscription_id: "sub_gone" };
  world.stripeError = "No such subscription: 'sub_gone'";
  r = await call("preview");
  check("a stale subscription id is reported as not found, not as a 500",
        r.status === 404 && r.body.error === "subscription_not_found", JSON.stringify(r.body));
  world.stripeError = null;

  console.log("\nthe access rule\n");

  world.row = { id: "row-1", user_id: "user-1", plan_name: "pro", stripe_subscription_id: "sub_1" };
  world.sub = SUBS.postBasil;
  world.user = null;
  r = await call("cancel");
  check("an unauthenticated caller is refused", r.status === 401, r.status);

  world.user = { id: "user-1" };
  stripeCalls.length = 0;
  const forged = new Request("https://fn.local/stripe-cancel-subscription", {
    method: "POST",
    headers: { Authorization: "Bearer user-token", "Content-Type": "application/json" },
    body: JSON.stringify({ action: "cancel", subscription_id: "sub_SOMEONE_ELSE", stripe_subscription_id: "sub_SOMEONE_ELSE" }),
  });
  await (await mod.__handler(forged)).json();
  const touched = stripeCalls.map((c) => c.url).join(" ");
  check("a subscription id in the request body is ignored entirely",
        !touched.includes("sub_SOMEONE_ELSE") && touched.includes("sub_1"), touched);

  fs.unlinkSync(tmp);
  console.log(`\n${failed === 0 ? "ALL PASS" : "FAILURES ABOVE"} -- ${passed} passed, ${failed} failed`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
