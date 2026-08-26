/**
 * Plan transaction allowances and platform fee rates, for the Deno runtime.
 *
 * -- Why this file exists -------------------------------------------------
 *
 * These numbers used to be declared twice, in stripe-webhook and again in
 * confirm-and-activate, and both copies were stale after the pricing
 * rebalance. They were not drifting slowly -- they were being written wrong on
 * every plan change:
 *
 *     plan          was written        should be
 *     essential     75 txn, 1%         100 txn, 1%
 *     professional  250 txn, 1%        300 txn, 0.75%
 *     enterprise    500 txn, 1%        750 txn, 0.5%
 *
 * The effect on live accounts was a cap 250 invoices short of what was sold and
 * a platform fee of double the advertised Enterprise rate. Every payment taken
 * was overcharged.
 *
 * -- Why it is a copy at all ----------------------------------------------
 *
 * src/config/plans.js is the source of truth, but it is a .js module resolved
 * through Vite's `@/` alias. Edge functions run in Deno, which resolves neither.
 * So this is a deliberate third copy, following the precedent set in
 * _shared/require-access.ts:
 *
 *   "Three copies is two too many, but each runs in a different runtime; keep
 *    them in step."
 *
 * "Keep them in step" is not left to goodwill here. supabase/tests/plan-limits
 * parses both files and fails if they disagree, and it runs in `npm run check`,
 * which the Vercel build command gates deploys on. A console warning was the
 * other option and was rejected: nobody reads warnings in CI.
 *
 * If you change a number here, change it in src/config/plans.js in the same
 * commit, or the build stops.
 */

export interface PlanLimits {
  /** Invoices + quotes per month. -1 means unlimited. */
  transactions: number;
  /** Platform application fee, as a percentage of the charge. */
  fee: number;
}

export const PLAN_LIMITS: Record<string, PlanLimits> = {
  // Retained for rows written before the hard paywall. No checkout produces it
  // any more, but a stored subscription may still say 'free', and falling back
  // to Core's allowance would hand it more than it ever had.
  free: { transactions: 10, fee: 0 },
  core: { transactions: 30, fee: 1 },
  essential: { transactions: 100, fee: 1 },
  professional: { transactions: 300, fee: 0.75 },
  enterprise: { transactions: 750, fee: 0.5 },
  // Negotiated per contract. The row carries the real values; these are only
  // what gets written if a custom subscription arrives with nothing set.
  custom: { transactions: -1, fee: 0.5 },
};

/** Legacy plan_name still present on old rows. */
const PLAN_ALIASES: Record<string, string> = {
  starter: "core",
};

/**
 * Limits for a plan name, however it is spelled on the row.
 *
 * Falls back to Core rather than to the most generous tier: an unrecognised
 * plan name must never grant more than the cheapest paid plan.
 */
export function limitsForPlan(planName: unknown): PlanLimits {
  const key = String(planName || "").toLowerCase().trim();
  const resolved = PLAN_ALIASES[key] || key;
  return PLAN_LIMITS[resolved] || PLAN_LIMITS.core;
}

/**
 * The fee rate to apply to a payment, given the subscription row.
 *
 * Deliberately tolerant of a missing or lapsed subscription: the public payment
 * path lets a lapsed contractor's client still pay, and that path must resolve
 * to a real rate rather than throwing. Core's rate is the floor in that case --
 * it is the rate they are certainly entitled to.
 *
 * NOTE: for an invoice sent after platform_fee_percent was introduced, the rate
 * stamped on the invoice wins over this. This is the fallback for invoices sent
 * before that column existed.
 */
export function feePercentForSubscription(
  sub: Record<string, unknown> | null | undefined,
): number {
  if (!sub) return PLAN_LIMITS.core.fee;
  const status = String(sub.status || "").toLowerCase();
  const live = status === "active" || status === "trialing";
  if (!live) return PLAN_LIMITS.core.fee;
  return limitsForPlan(sub.plan_name).fee;
}
