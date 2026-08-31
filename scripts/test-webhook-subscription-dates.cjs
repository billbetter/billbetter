/**
 * Prove stripe-webhook reports the RIGHT DATE, without a Stripe key and without
 * a network.
 *
 * -- Why this exists --------------------------------------------------------
 *
 * scripts/test-cancel-subscription.cjs already guards this date on the cancel
 * page. The webhook had the same bug and no test at all, and it fails worse:
 *
 *   - `next_billing_date` is what Settings prints. When the read went dead the
 *     field simply stopped being written, so the row kept whatever date it last
 *     had -- an old date, not a missing one, so nothing looked broken.
 *   - the cancellation email's `effectiveDate` fell through to `endedAt`, which
 *     is `new Date()`. Every cancellation email told the customer their access
 *     ended TODAY, when they had weeks left. Confidently, and in writing.
 *
 * Both are silent. Neither throws, neither 500s, and a smoke test that only
 * checks the webhook returns 200 passes straight through both.
 *
 * The cause is the API version. Stripe moved current_period_start/end OFF the
 * subscription and onto each subscription ITEM in 2025-04-30.basil, and this
 * account is on 2026-04-22.dahlia. Webhook events are delivered at the version
 * pinned on the ENDPOINT, though, which is not the account default and not ours
 * to assume -- so both shapes below are real and both must keep working.
 *
 * It runs the real handler, not a copy: index.ts is flattened exactly the way
 * scripts/deploy-functions.py flattens it, Deno.serve is captured instead of
 * called, the signature is genuinely signed, and fetch is stubbed. The event
 * dispatch, the row lookup, the patch and the email are all shipped code.
 *
 * Usage: node scripts/test-webhook-subscription-dates.cjs
 */
const fs = require("fs");
const os = require("os");
const path = require("path");
const crypto = require("crypto");
const esbuild = require("esbuild");
// The one mirror of deploy-functions.py's flattening, shared with the other
// edge-function suites so a second copy cannot drift from what we deploy.
const { inlineShared } = require("./_inline-shared.cjs");

const ROOT = path.join(__dirname, "..");
const FN = path.join(ROOT, "supabase", "functions", "stripe-webhook", "index.ts");
const SHARED = path.join(ROOT, "supabase", "functions", "_shared");

const SECRET = "whsec_test_secret";

let passed = 0, failed = 0;
function check(label, cond, detail) {
  if (cond) { passed++; console.log(`  PASS  ${label}`); }
  else { failed++; console.log(`  FAIL  ${label}${detail !== undefined ? ` -- ${detail}` : ""}`); }
}

// ---------------------------------------------------------------------------
// Distinct dates on purpose: if a read went to the wrong field the assertions
// would still be comparing against a different date, so they discriminate
// instead of agreeing by coincidence.
// ---------------------------------------------------------------------------
const ITEM_END = 1789000000;   // 2026-09-08 -- on the item (post-basil)
const TOP_END = 1786000000;    // 2026-08-04 -- top level (pre-basil endpoint)
const CANCEL_AT = 1780000000;  // 2026-05-27 -- cancel_at fallback

const iso = (s) => new Date(s * 1000).toISOString();
// niceDate() from _shared/notification-layout.ts, which is what actually lands
// in the email body. Recomputed rather than hardcoded so the assertion does not
// depend on the timezone the test happens to run in.
const nice = (isoStr) => new Date(isoStr).toLocaleDateString("en-US", {
  year: "numeric", month: "long", day: "numeric",
});

const PRICE = { id: "price_1", unit_amount: 2900, currency: "cad", recurring: { interval: "month" } };
const withItemEnd = (end) => ({ data: [{ current_period_end: end, price: PRICE }] });
const withoutEnd = () => ({ data: [{ price: PRICE }] });

async function main() {
  let ts = inlineShared(fs.readFileSync(FN, "utf8"), SHARED);
  // Capture the handler rather than starting a server.
  ts = ts.replace(/Deno\.serve\(/, "export const __handler = (");
  const { code } = await esbuild.transform(ts, { loader: "ts", format: "esm", target: "es2022" });
  const tmp = path.join(os.tmpdir(), `webhook-dates-under-test-${process.pid}.mjs`);
  fs.writeFileSync(tmp, code);

  globalThis.Deno = {
    env: { get: (k) => ({
      SUPABASE_URL: "https://stub.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "stub-service-role",
      STRIPE_SECRET_KEY: "sk_test_placeholder_not_a_real_key",
      STRIPE_WEBHOOK_SECRET: SECRET,
      RESEND_API_KEY: "re_stub",
      RESEND_FROM_EMAIL: "billing@invoicium.ca",
      APP_BASE_URL: "https://www.invoicium.ca",
    }[k]) },
  };

  // World state the stub answers from.
  const world = { row: null, productName: "Invoicium Essential" };
  let patches = [];
  let emails = [];

  globalThis.fetch = async (url, init = {}) => {
    const u = String(url);
    const method = init.method || "GET";
    const ok = (body, status = 200) => ({
      ok: status >= 200 && status < 300, status,
      json: async () => body, text: async () => JSON.stringify(body),
    });
    if (u.includes("/auth/v1/admin/users/")) {
      return ok({ email: "contractor@example.com", user_metadata: { full_name: "Sam" } });
    }
    if (u.includes("/rest/v1/Subscription")) {
      if (method === "PATCH") { patches.push(JSON.parse(init.body)); return ok([]); }
      return ok(world.row ? [world.row] : []);
    }
    if (u.includes("api.stripe.com")) {
      return ok({ id: "price_1", product: { name: world.productName } });
    }
    if (u.includes("api.resend.com")) {
      emails.push(JSON.parse(init.body));
      return ok({ id: "email_1" });
    }
    throw new Error(`unexpected fetch to ${u}`);
  };

  const mod = await import("file://" + tmp.replace(/\\/g, "/"));

  // Genuinely signed, the way verifySignature checks it: HMAC-SHA256 hex over
  // `${timestamp}.${payload}`. A test that bypassed this would not be running
  // the handler's real entry path.
  const send = async (event, { secret = SECRET } = {}) => {
    patches = []; emails = [];
    const raw = JSON.stringify(event);
    const t = Math.floor(Date.now() / 1000);
    const v1 = crypto.createHmac("sha256", secret).update(`${t}.${raw}`).digest("hex");
    const res = await mod.__handler(new Request("https://fn.local/stripe-webhook", {
      method: "POST",
      headers: { "stripe-signature": `t=${t},v1=${v1}`, "Content-Type": "application/json" },
      body: raw,
    }));
    // Several handlers patch the row more than once; the merged view is what
    // the row ends up looking like.
    return { status: res.status, patch: Object.assign({}, ...patches), email: emails[0] || null };
  };

  const updated = (sub) => ({ type: "customer.subscription.updated", data: { object: sub } });
  const deleted = (sub) => ({ type: "customer.subscription.deleted", data: { object: sub } });
  const SUB_ID = "sub_1";
  const base = { id: SUB_ID, customer: "cus_1", metadata: { user_id: "user-1" } };

  const ROW = (over = {}) => ({
    id: "row-1", user_id: "user-1", plan_name: "essential", status: "active",
    stripe_customer_id: "cus_1", stripe_subscription_id: SUB_ID,
    next_billing_date: iso(TOP_END), ...over,
  });

  console.log("\nnext_billing_date, across the Stripe API version change\n");

  world.row = ROW();
  let r = await send(updated({ ...base, status: "active", items: withItemEnd(ITEM_END) }));
  check("reads current_period_end off the ITEM (2025-04-30.basil and later)",
        r.patch.next_billing_date === iso(ITEM_END), r.patch.next_billing_date);

  r = await send(updated({
    ...base, status: "active", current_period_end: TOP_END, items: withoutEnd(),
  }));
  check("still reads the TOP-LEVEL field, which a pinned endpoint still sends",
        r.patch.next_billing_date === iso(TOP_END), r.patch.next_billing_date);

  r = await send(updated({ ...base, status: "active", items: withoutEnd() }));
  check("writes NO date when Stripe sends none, rather than blanking the row",
        !("next_billing_date" in r.patch), JSON.stringify(r.patch));

  r = await send(updated({
    ...base, status: "trialing", trial_end: ITEM_END, items: withoutEnd(),
  }));
  check("falls back to trial_end while trialing",
        r.patch.next_billing_date === iso(ITEM_END), r.patch.next_billing_date);

  console.log("\nthe cancellation email, which used to say access ends today\n");

  const today = nice(new Date().toISOString());

  world.row = ROW();
  r = await send(deleted({
    ...base, status: "canceled", cancel_at_period_end: true, items: withItemEnd(ITEM_END),
  }));
  check("an email is sent at all", !!r.email, JSON.stringify(r.email));
  check("it names the end of the PAID PERIOD",
        r.email && r.email.html.includes(nice(iso(ITEM_END))), nice(iso(ITEM_END)));
  check("and does NOT say access ended today",
        r.email && !r.email.html.includes(today), today);
  check("the row is dropped to free and dated",
        r.patch.status === "canceled" && r.patch.plan_name === "free" && !!r.patch.subscription_end_date,
        JSON.stringify(r.patch));

  r = await send(deleted({
    ...base, status: "canceled", cancel_at_period_end: true, cancel_at: CANCEL_AT, items: withoutEnd(),
  }));
  check("cancel_at carries the date when no period end is present",
        r.email && r.email.html.includes(nice(iso(CANCEL_AT))), nice(iso(CANCEL_AT)));

  // The one case where today IS the honest answer: an immediate cancellation
  // that Stripe gave no future date for. The fallback has to stay.
  r = await send(deleted({ ...base, status: "canceled", items: withoutEnd() }));
  check("an immediate cancel with no date anywhere still falls back to today",
        r.email && r.email.html.includes(today), today);

  console.log("\nthe plan-change and status-change emails read the same date\n");

  world.row = ROW({ plan_name: "core" });
  world.productName = "Invoicium Professional";
  r = await send(updated({ ...base, status: "active", items: withItemEnd(ITEM_END) }));
  check("an upgrade email is dated from the item-level period end",
        r.email && r.email.html.includes(nice(iso(ITEM_END))), r.email && r.email.subject);
  check("and the plan is written through", r.patch.plan_name === "professional", r.patch.plan_name);

  world.row = ROW({ status: "past_due" });
  world.productName = "Invoicium Essential";
  r = await send(updated({ ...base, status: "active", items: withItemEnd(ITEM_END) }));
  check("a recovery from past_due is dated the same way",
        r.email && r.email.html.includes(nice(iso(ITEM_END))), r.email && r.email.subject);
  check("and none of these dates is a disguised epoch",
        r.email && !r.email.html.includes("1970") && !r.email.html.includes("Invalid Date"));

  console.log("\nthe signature is still the gate\n");

  world.row = ROW();
  r = await send(updated({ ...base, status: "active", items: withItemEnd(ITEM_END) }),
                 { secret: "whsec_wrong" });
  check("an event signed with the wrong secret is rejected", r.status === 400, r.status);
  check("and writes nothing", Object.keys(r.patch).length === 0, JSON.stringify(r.patch));

  fs.unlinkSync(tmp);
  console.log(`\n${failed === 0 ? "ALL PASS" : "FAILURES ABOVE"} -- ${passed} passed, ${failed} failed`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
