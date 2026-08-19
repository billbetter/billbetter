/**
 * The single client-side definition of "may this user use the app?".
 *
 * There is no free tier. A user is either paying, inside an unexpired trial, or
 * blocked -- there is no degraded middle state.
 *
 * This mirrors public.has_app_access(uuid) in
 * supabase/migrations/20260819160000_hard_paywall_rls.sql. The database is the
 * real enforcement point; this exists so the UI can redirect before rendering a
 * screen that would come back empty. If the two ever disagree, the database
 * wins and the user sees an empty app -- so keep them in step.
 *
 * Previously this logic was inlined in four places with two different
 * definitions: Layout accepted active|trial|trialing, while Home.jsx line 116
 * accepted only active|trialing and bounced trial users to Pricing.
 */

/** Statuses that can grant access, before the trial-expiry test. */
const LIVE_STATUSES = new Set(["active", "trial", "trialing"]);

/** Statuses that are explicitly blocked. Anything unknown is blocked too. */
export const BLOCKED_STATUSES = new Set([
  "past_due",
  "canceled",
  "cancelled",
  "unpaid",
  "incomplete",
  "incomplete_expired",
  "trial_expired",
  "free",
]);

/**
 * True when the subscription grants access to the core app.
 *
 * A trial is live only until its end date. Nothing else in the app expired a
 * trial -- `trial_end_date` was written and then only ever read for display --
 * so an unconverted trial kept full access indefinitely if Stripe's event was
 * missed. The date is now authoritative.
 */
export function hasAppAccess(subscription) {
  if (!subscription || !LIVE_STATUSES.has(subscription.status)) return false;
  if (subscription.status === "active") return true;

  // trial / trialing: require a real end date in the future. A trial with no
  // end date is treated as expired rather than as unlimited.
  const endsAt = subscription.trial_end_date;
  if (!endsAt) return false;
  const end = new Date(endsAt);
  return !isNaN(end.getTime()) && end.getTime() > Date.now();
}

/**
 * Why a user is blocked, for the billing screen's copy. Never used to decide
 * access -- only to explain it.
 */
export function accessState(subscription) {
  if (!subscription) return "no_subscription";
  if (hasAppAccess(subscription)) {
    return subscription.status === "active" ? "active" : "trialing";
  }
  if (subscription.status === "past_due" || subscription.status === "unpaid") {
    return "past_due";
  }
  if (LIVE_STATUSES.has(subscription.status)) return "trial_expired";
  if (
    subscription.status === "canceled" ||
    subscription.status === "cancelled"
  ) {
    return "canceled";
  }
  return "no_subscription";
}
