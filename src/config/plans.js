// Single source of truth for the plan ladder.
//
// Everything about a tier lives here: what Stripe charges, how many
// transactions it buys, what the platform takes on a payment, and the
// marketing copy Pricing.jsx and Home.jsx render. Those two pages used to keep
// their own hardcoded copies of the same numbers, which is how Home ended up
// still advertising a Free tier months after the hard paywall landed.
//
// Feature BOOLEANS are not here -- they live in components/utils/permissions.jsx,
// which imports `transactions` and `processingFee` from this file so the two
// can never disagree. Nothing in this file may import permissions.jsx.
//
// -- The ladder -----------------------------------------------------------
//
//   Tier          $/mo    Txn    $/txn   Fee     Story
//   Core          $24      30    $0.80   1%      One person, get paid online
//   Essential     $49     100    $0.49   1%      Stop doing admin
//   Professional  $99     300    $0.33   0.75%   Run a crew
//   Custom        --       --      --    0.5%-   Negotiated
//
// Price roughly doubles each step while the cost per transaction falls
// monotonically, so upgrading always gets cheaper per unit of work -- the
// upgrade argues for itself.
//
// -- Why Enterprise was retired -------------------------------------------
//
// It sold three software differentiators -- white-label, granular permissions
// and API access -- and an audit found all three unimplemented (see
// docs/feature-audit.md). What $199 actually bought over $99 was a higher
// transaction cap, which was being written wrong, and a lower platform fee,
// which was not being applied. There was nothing left to sell.
//
// Removed rather than fixed because a tier justified entirely by unbuilt
// features is a tier we had no evidence anyone wanted, and there were zero
// paying subscribers on it -- the cheapest this decision will ever be. Anyone
// who genuinely needs white-label goes through Custom and talks to a human,
// which is what we would want at that deal size anyway.
//
// Existing rows are aliased to Professional and keep their stored allowance.
//
// Price IDs belong to the Invoicium Stripe account (acct_1TdLSn...).

// -- STRIPE MIGRATION SWITCH ----------------------------------------------
//
// The ids under `legacy*` are live and bill the OLD amounts. The new ladder
// cannot charge correctly until matching Prices exist in Stripe.
//
// While this is false the app shows AND charges the legacy amounts, so the
// price on the card can never disagree with the card that gets charged. The
// new transaction limits and feature split are live either way -- those only
// ever give existing subscribers more, never less.
//
// TO GO LIVE:
//   1. In the Stripe dashboard create these FOUR recurring CAD Prices:
//        Essential     $49/mo    $490/yr
//        Professional  $99/mo    $990/yr
//      Was six: retiring Enterprise dropped its $199/$1990 pair, and Core is
//      unchanged at $24/$240, so only these four are new. Yearly is 10x
//      monthly = the "Save 17%" the Pricing page advertises.
//   2. Paste each id into `monthlyPriceId` / `yearlyPriceId` below.
//   3. Flip this to true.
//   4. Existing subscribers are untouched -- Stripe keeps billing them at the
//      Price their subscription already points at. Only new checkouts and
//      plan switches use the new Prices.
export const STRIPE_PRICES_UPDATED = false;

import {
  DORMANT_PLAN_BULLETS,
  withoutDormantBullets,
} from "@/config/dormantFeatures";

/** Order matters: it drives the hierarchy, the upgrade path and the card order. */
export const PLAN_ORDER = ["core", "essential", "professional"];

export const PLANS = {
  core: {
    id: "core",
    name: "Core",
    icon: "Sparkles",
    description: "For solo contractors",
    valueLine: "Invoice, quote and get paid online",
    monthlyPrice: 24,
    yearlyPrice: 240,
    monthlyPriceId: "price_1U60o4LvDc7eLOdr2Ef6lHeV", // unchanged -- $24 is staying
    yearlyPriceId: "price_1U60o5LvDc7eLOdrxxJCo8zS", // unchanged -- $240 is staying
    legacyMonthlyPrice: 24,
    legacyYearlyPrice: 240,
    legacyMonthlyPriceId: "price_1U60o4LvDc7eLOdr2Ef6lHeV",
    legacyYearlyPriceId: "price_1U60o5LvDc7eLOdrxxJCo8zS",
    transactions: 30,
    processingFee: 1,
    seats: 1, // the owner, alone
    popular: false,
    features: [
      "30 invoices or quotes/month",
      "AI invoice & quote generation",
      "Voice-to-invoice dictation",
      "Online card payments via Stripe",
      "Job tracking with before/after photos",
      "Email & SMS delivery",
      "One-tap overdue reminders (friendly → firm)",
    ],
    notIncluded: [
      "Expense tracking",
      "Analytics",
      "Time tracking",
      "Crew members",
    ],
  },

  essential: {
    id: "essential",
    name: "Essential",
    icon: "TrendingUp",
    description: "For a busy one-van business",
    valueLine: "Put the admin on autopilot",
    monthlyPrice: 49,
    yearlyPrice: 490,
    monthlyPriceId: null, // TODO: create the $49/mo CAD Price, paste its id here
    yearlyPriceId: null, // TODO: create the $490/yr CAD Price, paste its id here
    legacyMonthlyPrice: 39,
    legacyYearlyPrice: 390,
    legacyMonthlyPriceId: "price_1U60o5LvDc7eLOdrLhZMY6BP",
    legacyYearlyPriceId: "price_1U60o5LvDc7eLOdr2ZLowIZ7",
    transactions: 100,
    processingFee: 1,
    seats: 1,
    // With three tiers you highlight the middle one.
    popular: true,
    features: [
      "100 invoices or quotes/month",
      "Expense tracking + AI receipt scanner",
      "Time tracking & job costing",
      "Analytics dashboard & profit per job",
      "Full job tracking (status, cost, location)",
      "Your logo & colours on every PDF",
      "Google Calendar two-way sync",
      "Everything in Core",
    ],
    notIncluded: ["Crew management", "Custom PDF templates", "Smart Insights"],
  },

  professional: {
    id: "professional",
    name: "Professional",
    icon: "Zap",
    description: "For a growing crew",
    valueLine: "Run the whole operation in one place",
    monthlyPrice: 99,
    yearlyPrice: 990,
    monthlyPriceId: null, // TODO: create the $99/mo CAD Price, paste its id here
    yearlyPriceId: null, // TODO: create the $990/yr CAD Price, paste its id here
    legacyMonthlyPrice: 79,
    legacyYearlyPrice: 790,
    legacyMonthlyPriceId: "price_1U60o6LvDc7eLOdrfLz6yk99",
    legacyYearlyPriceId: "price_1U60o6LvDc7eLOdri6HlnG3Z",
    transactions: 300,
    processingFee: 0.75,
    seats: 5, // owner + 4 crew
    popular: false,
    features: [
      "300 invoices or quotes/month",
      "0.75% platform fee (down from 1%)",
      "Crew management, roles & permissions",
      "Up to 4 crew members on your account",
      "Smart Insights (AI analytics)",
      "Custom PDF templates",
      "Priority support",
      "Everything in Essential",
    ],
    // Nothing above Professional but Custom, which is negotiated rather than
    // listed, so there is no "you do not get" to show here.
    notIncluded: [],
  },

  custom: {
    id: "custom",
    name: "Custom",
    icon: "Building2",
    description: "For franchises and large enterprises",
    valueLine: "Custom pricing for custom needs",
    monthlyPrice: null,
    yearlyPrice: null,
    monthlyPriceId: null,
    yearlyPriceId: null,
    legacyMonthlyPrice: null,
    legacyYearlyPrice: null,
    legacyMonthlyPriceId: null,
    legacyYearlyPriceId: null,
    transactions: -1, // unlimited
    processingFee: 0.5, // floor; negotiated per contract
    seats: -1, // unlimited
    popular: false,
    features: [
      "Unlimited invoices & quotes",
      "Negotiated platform fee",
      "Custom feature development",
      "Website design",
      "24/7 support",
      "Enhanced AI features",
      "+ More (just ask!)",
    ],
    notIncluded: [],
  },
};

// -- Dormant features -----------------------------------------------------
//
// Crew and time tracking are switched off (config/dormantFeatures.js), so the
// pricing page must stop selling them. Filtering here rather than at the six
// places that render these lists is what keeps them consistent: Home.jsx takes
// `.slice(0, 4)` and `.slice(0, 2)` of `features`, so a bullet removed at the
// render site would still have counted toward the slice and silently shortened
// the list.
//
// Mutating in place keeps the exported object identity, so every existing
// importer sees the filtered lists without changing how it imports.
const bulletsBeforeFiltering = new Set();
for (const plan of Object.values(PLANS)) {
  for (const b of [...plan.features, ...plan.notIncluded]) {
    bulletsBeforeFiltering.add(b);
  }
  plan.features = withoutDormantBullets(plan.features);
  plan.notIncluded = withoutDormantBullets(plan.notIncluded);
}

// The failure mode worth catching is a bullet that was REWORDED: it stops
// matching, so nothing is stripped and the pricing page quietly goes back to
// advertising a feature with no way in. An entry matching nothing is the
// signal, so check against the pre-filter lists.
if (typeof import.meta !== "undefined" && import.meta.env?.DEV) {
  const neverMatched = DORMANT_PLAN_BULLETS.filter(
    (b) => !bulletsBeforeFiltering.has(b),
  );
  if (neverMatched.length) {
    console.warn(
      `[plans] These dormant bullets matched nothing, so they are no longer ` +
        `being stripped -- check whether the real bullet was reworded: ` +
        neverMatched.join(", "),
    );
  }
}

/**
 * The trial. Generous enough to prove the product, capped below Essential so
 * a heavy user still has a reason to subscribe. It exposes the Professional
 * feature set minus the crew tooling -- the part that only means anything
 * once you actually have employees.
 */
export const TRIAL_DAYS = 7;
export const TRIAL_TRANSACTIONS = 50;
export const TRIAL_SEATS = 3;
export const CURRENCY = "CAD";

/** Stripe's own cut, quoted alongside our platform fee so the FAQ stays honest. */
export const STRIPE_PROCESSING = "2.9% + $0.30";

// -- Accessors ------------------------------------------------------------

const norm = (planId) => String(planId || "").toLowerCase();

/** Legacy plan_name values still present on old subscription rows. */
const PLAN_ALIASES = {
  starter: "core",
  // Enterprise was retired: its three software differentiators (white-label,
  // granular permissions, API access) were all unimplemented, so the tier sold
  // nothing over Professional but a transaction cap and a lower fee. Anyone
  // genuinely needing white-label goes through Custom and talks to a human.
  //
  // Existing rows keep working. getTransactionAllowance() takes
  // max(plan, stored), so a row storing 500 keeps 500 rather than dropping to
  // Professional's 300 -- capacity already granted is never taken away.
  enterprise: "professional",
  basic: "core",
  pro: "professional",
  business: "professional",
};

export function resolvePlanId(planId) {
  const key = norm(planId);
  return PLAN_ALIASES[key] || key;
}

export function getPlan(planId) {
  return PLANS[resolvePlanId(planId)] || null;
}

/**
 * The price the user is shown AND the price Stripe will charge -- the same
 * number by construction, whichever side of the migration we are on.
 */
export function getAmount(planId, cycle) {
  const plan = getPlan(planId);
  if (!plan) return null;
  if (STRIPE_PRICES_UPDATED) {
    return cycle === "yearly" ? plan.yearlyPrice : plan.monthlyPrice;
  }
  return cycle === "yearly" ? plan.legacyYearlyPrice : plan.legacyMonthlyPrice;
}

export function getPriceId(planId, cycle) {
  const plan = getPlan(planId);
  if (!plan) return null;
  if (STRIPE_PRICES_UPDATED) {
    return cycle === "yearly" ? plan.yearlyPriceId : plan.monthlyPriceId;
  }
  return cycle === "yearly"
    ? plan.legacyYearlyPriceId
    : plan.legacyMonthlyPriceId;
}

/** Monthly transaction allowance. -1 means unlimited. */
export function getTransactionLimit(planId) {
  const plan = getPlan(planId);
  return plan ? plan.transactions : PLANS.core.transactions;
}

/** Our platform fee on a payment, as a percentage. */
export function getProcessingFee(planId) {
  const plan = getPlan(planId);
  return plan ? plan.processingFee : PLANS.core.processingFee;
}

/**
 * Total seats on the plan, INCLUDING the owner. -1 means unlimited.
 *
 * A trial gets 3 so the crew feature can actually be evaluated -- a feature you
 * cannot try is a feature you will not buy -- but not enough to run a real
 * business on and skip subscribing.
 */
export function getSeatLimit(planId, status) {
  if (status === "trial" || status === "trialing") return TRIAL_SEATS;
  const plan = getPlan(planId);
  return plan ? plan.seats : PLANS.core.seats;
}

/** Seats available to people other than the owner. -1 means unlimited. */
export function getCrewSeatLimit(planId, status) {
  const total = getSeatLimit(planId, status);
  return total === -1 ? -1 : Math.max(0, total - 1);
}

/** Position in the ladder. Custom sits above everything; unknown plans below. */
export function getPlanRank(planId) {
  const key = resolvePlanId(planId);
  if (key === "custom") return PLAN_ORDER.length;
  const idx = PLAN_ORDER.indexOf(key);
  return idx === -1 ? -1 : idx;
}

/** True when `planId` sits at or above `minimumPlanId` on the ladder. */
export function planMeets(planId, minimumPlanId) {
  const rank = getPlanRank(planId);
  const need = getPlanRank(minimumPlanId);
  return rank >= 0 && need >= 0 && rank >= need;
}

/** Cards in display order, Custom last. */
export function listPlans() {
  return [...PLAN_ORDER.map((id) => PLANS[id]), PLANS.custom];
}

/** Yearly saving as a whole percent, for the billing toggle badge. */
export function yearlySavingPercent() {
  const monthly = getAmount("professional", "monthly");
  const yearly = getAmount("professional", "yearly");
  const full = monthly * 12;
  if (!full || !yearly) return 0;
  return Math.round(((full - yearly) / full) * 100);
}

// -- Backward compatibility -----------------------------------------------
//
// PLAN_BILLING was the old export shape. Anything still importing it keeps
// working and automatically follows the migration switch.
export const PLAN_BILLING = PLAN_ORDER.reduce((acc, id) => {
  const plan = PLANS[id];
  acc[id] = {
    name: plan.name,
    monthlyPrice: getAmount(id, "monthly"),
    yearlyPrice: getAmount(id, "yearly"),
    monthlyPriceId: getPriceId(id, "monthly"),
    yearlyPriceId: getPriceId(id, "yearly"),
    transactions: plan.transactions,
  };
  return acc;
}, {});

// -- Dev-time guard -------------------------------------------------------
//
// A missing price id means checkout throws "That plan is no longer available"
// at the worst possible moment, so shout about it during development rather
// than finding out from a failed sale.
if (typeof import.meta !== "undefined" && import.meta.env?.DEV) {
  const broken = PLAN_ORDER.filter(
    (id) => !getPriceId(id, "monthly") || !getPriceId(id, "yearly"),
  );
  if (broken.length) {
    console.warn(
      `[plans] No usable Stripe price id for: ${broken.join(", ")}. ` +
        "Checkout will fail for those plans. " +
        (STRIPE_PRICES_UPDATED
          ? "STRIPE_PRICES_UPDATED is true but the new ids are still null."
          : "Set the new ids and flip STRIPE_PRICES_UPDATED in src/config/plans.js."),
    );
  } else if (!STRIPE_PRICES_UPDATED) {
    console.info(
      "[plans] Billing the LEGACY prices ($24/$39/$79/$99). Create the new " +
        "Stripe Prices and flip STRIPE_PRICES_UPDATED to ship the $24/$49/$99/$199 ladder.",
    );
  }
}
