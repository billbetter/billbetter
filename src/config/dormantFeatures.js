/**
 * Features that are built but switched off.
 *
 * Dormant is not deleted. Every page, entity, migration, RLS policy and helper
 * behind these features stays exactly where it is and keeps working; this file
 * only decides whether a regular user is ever shown a way in. Flip a key out of
 * DORMANT_FEATURES and the feature comes back everywhere at once -- nav, routes,
 * onboarding tour, pricing bullets and the marketing page all read from here.
 *
 * Why a separate module rather than a flag on PLANS: the pricing tables in
 * config/plans.js must not import components/utils/permissions.jsx (there is a
 * comment there saying so, and it would be a cycle). Both of them can import
 * this, because it imports nothing.
 *
 * -- What is dormant right now ---------------------------------------------
 *
 *   crew_management   the Team page, crew invites, per-member permissions
 *   time_tracking     the Timesheet page and the running-clock TimeEntry work
 *
 * Nothing is stranded by this. At the time it was switched off the database
 * held zero EmployeeProfile rows, zero CrewInvite rows, zero CrewMemberSettings
 * rows and zero TimeEntry rows, so no crew member loses access and no timesheet
 * becomes unreachable.
 */

/** Feature keys from FEATURE_MINIMUM_PLAN that are switched off. */
export const DORMANT_FEATURES = new Set(["crew_management", "time_tracking"]);

/**
 * Page names from pages.config.js that are switched off.
 *
 * These are dropped from the router, so the URL falls through to the catch-all
 * and renders the 404 rather than an empty shell. AcceptCrewInvite is in here
 * because an invite cannot be sent while crew is dormant, so the only way to
 * reach it is by guessing the URL.
 */
export const DORMANT_PAGES = new Set(["Team", "Timesheet", "AcceptCrewInvite"]);

/**
 * Exact plan bullets to drop from config/plans.js while the features are off.
 *
 * Matched exactly rather than by keyword: a fuzzy match on "crew" would also
 * eat "For a growing crew", and a plan that silently loses the wrong bullet is
 * worse than one that keeps an extra. A dev-time guard in plans.js shouts if
 * any of these stops matching, so a reworded bullet gets noticed instead of
 * quietly reappearing on the pricing page.
 */
export const DORMANT_PLAN_BULLETS = [
  "Time tracking",
  "Time tracking & job costing",
  "Crew members",
  "Crew management",
  "Crew management, roles & permissions",
  "Up to 4 crew members on your account",
  "Up to 19 crew members on your account",
  "Advanced granular permissions",
];

/** Card titles to drop from the marketing Features page. */
export const DORMANT_FEATURE_CARDS = new Set([
  "Crew Management & Permissions",
  "Time Tracking & Job Costing",
]);

/**
 * Escape hatch for looking at a dormant feature without publishing it.
 *
 * In the browser console:  localStorage.setItem("invoicium-preview-dormant", "true")
 * and reload. Per-device and per-browser, so it cannot leak to customers -- it
 * is a way for you to check the Team page still works, not a beta programme.
 */
const PREVIEW_KEY = "invoicium-preview-dormant";

/** Whether this device is previewing dormant features. */
export function isDormancyLifted() {
  try {
    return window.localStorage.getItem(PREVIEW_KEY) === "true";
  } catch {
    // Private mode, storage disabled, or no window at all. Staying dormant is
    // the safe answer: the failure mode is "you cannot preview", not "every
    // customer sees an unfinished feature".
    return false;
  }
}

/** Whether a feature key is switched off for this viewer. */
export function isFeatureDormant(key) {
  if (!key) return false;
  return DORMANT_FEATURES.has(key) && !isDormancyLifted();
}

/** Whether a page name is switched off for this viewer. */
export function isPageDormant(name) {
  return DORMANT_PAGES.has(name) && !isDormancyLifted();
}

/**
 * Strip dormant bullets from a plan's `features` / `notIncluded` list.
 *
 * Deliberately NOT gated on isDormancyLifted(): the pricing page is what a
 * customer is charged against, and previewing a hidden feature on your own
 * device must never change what the page offers to sell.
 */
export function withoutDormantBullets(bullets) {
  if (!Array.isArray(bullets)) return bullets;
  return bullets.filter((b) => !DORMANT_PLAN_BULLETS.includes(b));
}
