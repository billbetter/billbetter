#!/usr/bin/env node
/**
 * Fail the build if the Deno plan table disagrees with src/config/plans.js.
 *
 * WHY
 *
 * src/config/plans.js is the source of truth for transaction allowances and
 * platform fees, but it is a Vite module using the `@/` alias, and edge
 * functions run in Deno, which resolves neither. So the numbers exist twice, in
 * supabase/functions/_shared/plan-limits.ts.
 *
 * They were previously duplicated in stripe-webhook AND confirm-and-activate,
 * and both copies were wrong after the pricing rebalance -- essential 75 vs 100,
 * professional 250/1% vs 300/0.75%, enterprise 500/1% vs 750/0.5%. The webhook
 * wrote those numbers onto the subscription row on every plan change, so live
 * accounts were capped 250 invoices short and charged double the advertised
 * Enterprise fee on every payment.
 *
 * The comment in _shared/require-access.ts asks the next person to "keep them in
 * step". That is exactly the kind of instruction that gets missed, so this
 * enforces it instead of asking.
 *
 * A console warning was considered and rejected: nobody reads warnings in CI.
 * This exits non-zero, and `npm run check` gates the Vercel build.
 *
 * Parsed rather than imported because plans.js is ESM with `@/` imports and this
 * runs as CommonJS in a bare Node process. Parsing is uglier but it means the
 * check has no build step of its own and cannot be broken by one.
 */
const fs = require("fs");

const PLANS_JS = "src/config/plans.js";
const LIMITS_TS = "supabase/functions/_shared/plan-limits.ts";

/** Every plan id -> { transactions, fee } from src/config/plans.js. */
function readPlansJs() {
  const src = fs.readFileSync(PLANS_JS, "utf8");
  const start = src.indexOf("export const PLANS = {");
  if (start === -1) throw new Error(`Could not find PLANS in ${PLANS_JS}`);

  const out = {};
  // Each plan block starts `id: "core",` and runs to the next one.
  const idRe = /id:\s*"(\w+)"/g;
  const ids = [...src.slice(start).matchAll(idRe)];
  for (let i = 0; i < ids.length; i++) {
    const from = start + ids[i].index;
    const to = i + 1 < ids.length ? start + ids[i + 1].index : src.length;
    const block = src.slice(from, to);
    const txn = block.match(/\btransactions:\s*(-?\d+)/);
    const fee = block.match(/\bprocessingFee:\s*([\d.]+)/);
    if (txn && fee) {
      out[ids[i][1]] = { transactions: Number(txn[1]), fee: Number(fee[1]) };
    }
  }
  return out;
}

/** Every plan id -> { transactions, fee } from the Deno table. */
function readLimitsTs() {
  const src = fs.readFileSync(LIMITS_TS, "utf8");
  const start = src.indexOf("export const PLAN_LIMITS");
  if (start === -1) throw new Error(`Could not find PLAN_LIMITS in ${LIMITS_TS}`);
  const body = src.slice(start, src.indexOf("};", start));
  const out = {};
  for (const m of body.matchAll(
    /(\w+):\s*\{\s*transactions:\s*(-?\d+),\s*fee:\s*([\d.]+)\s*\}/g,
  )) {
    out[m[1]] = { transactions: Number(m[2]), fee: Number(m[3]) };
  }
  return out;
}

const plans = readPlansJs();
const limits = readLimitsTs();

const problems = [];

// Every plan the pricing page sells must exist in the Deno table with the same
// numbers. `free` is allowed to exist only on the Deno side -- no checkout
// produces it any more, but old rows still carry it.
for (const [id, p] of Object.entries(plans)) {
  const l = limits[id];
  if (!l) {
    problems.push(`"${id}" is in ${PLANS_JS} but missing from ${LIMITS_TS}`);
    continue;
  }
  if (l.transactions !== p.transactions) {
    problems.push(
      `"${id}" transactions disagree: ${PLANS_JS} says ${p.transactions}, ` +
        `${LIMITS_TS} says ${l.transactions}`,
    );
  }
  if (l.fee !== p.fee) {
    problems.push(
      `"${id}" fee disagrees: ${PLANS_JS} says ${p.fee}%, ` +
        `${LIMITS_TS} says ${l.fee}%`,
    );
  }
}

for (const id of Object.keys(limits)) {
  if (!plans[id] && id !== "free") {
    problems.push(`"${id}" is in ${LIMITS_TS} but not in ${PLANS_JS}`);
  }
}

const count = Object.keys(plans).length;
if (problems.length) {
  console.error(`Plan tables disagree (${count} plans checked):\n`);
  for (const p of problems) console.error(`  MISMATCH  ${p}`);
  console.error(
    `\nBoth files must change together. ${PLANS_JS} is the source of truth;\n` +
      `${LIMITS_TS} exists only because Deno cannot import it.`,
  );
  process.exit(1);
}
console.log(
  `Plan parity OK: ${count} plans agree between plans.js and plan-limits.ts.`,
);
