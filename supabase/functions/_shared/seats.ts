// Seat limits per plan.
//
// Mirrors `seats` in src/config/plans.js. Deno cannot import that file (it is
// bundled for the browser and reaches for import.meta.env), so the numbers are
// restated here -- but the client is not the enforcement point either way. A
// seat check that only runs in the browser is a suggestion; this is the copy
// that actually decides, because it is the one holding the service role.
//
// Keep the two in step. If they ever drift, this file wins.
//
// That is no longer left to goodwill: check-plan-parity.cjs compares this table
// against config/plans.js and fails the build if they disagree. Two other
// copies of plan data drifted while carrying a comment just like this one, and
// the result was live accounts charged double the advertised fee.

const SEATS: Record<string, number> = {
  core: 1,
  starter: 1, // legacy alias
  essential: 1,
  professional: 5,
  custom: -1, // negotiated; -1 means unlimited
  trial: 3, // enough to demo the feature, not to run a business on
};

const ALIASES: Record<string, string> = {
  starter: 'core',
  enterprise: 'professional', // tier retired; see config/plans.js
  basic: 'core',
  pro: 'professional',
  business: 'professional',
};

/**
 * Total seats including the owner. A `core` business has 1 seat: the owner
 * alone, so its crew limit is zero.
 */
export function seatsForPlan(planName?: string | null, status?: string | null): number {
  if (status === 'trial' || status === 'trialing') return SEATS.trial;
  const key = String(planName || '').toLowerCase();
  const resolved = ALIASES[key] || key;
  return SEATS[resolved] ?? SEATS.core;
}

/** Seats available to people other than the owner. -1 means unlimited. */
export function crewSeatsForPlan(planName?: string | null, status?: string | null): number {
  const total = seatsForPlan(planName, status);
  return total === -1 ? -1 : Math.max(0, total - 1);
}
