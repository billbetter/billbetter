// Single source of truth for billing values.
//
// Pricing renders these and Checkout charges against them, so a price ID that
// drifts between the two would take payment for the wrong plan. Everything
// marketing-facing (feature bullets, taglines, icons) stays in Pricing.jsx --
// only what Stripe needs lives here.
//
// Price IDs belong to the BillBetter Stripe account (acct_1TdLSn...).

export const PLAN_BILLING = {
  core: {
    name: "Core",
    monthlyPrice: 24,
    yearlyPrice: 240,
    monthlyPriceId: "price_1U60o4LvDc7eLOdr2Ef6lHeV",
    yearlyPriceId: "price_1U60o5LvDc7eLOdrxxJCo8zS",
    transactions: 30,
  },
  essential: {
    name: "Essential",
    monthlyPrice: 39,
    yearlyPrice: 390,
    monthlyPriceId: "price_1U60o5LvDc7eLOdrLhZMY6BP",
    yearlyPriceId: "price_1U60o5LvDc7eLOdr2ZLowIZ7",
    transactions: 75,
  },
  professional: {
    name: "Professional",
    monthlyPrice: 79,
    yearlyPrice: 790,
    monthlyPriceId: "price_1U60o6LvDc7eLOdrfLz6yk99",
    yearlyPriceId: "price_1U60o6LvDc7eLOdri6HlnG3Z",
    transactions: 250,
  },
  enterprise: {
    name: "Enterprise",
    monthlyPrice: 99,
    yearlyPrice: 990,
    monthlyPriceId: "price_1U60o6LvDc7eLOdrgUBd793l",
    yearlyPriceId: "price_1U60o7LvDc7eLOdrlrzvmXhb",
    transactions: 500,
  },
};

export const TRIAL_DAYS = 7;
export const CURRENCY = "CAD";

export function getPlan(planId) {
  return PLAN_BILLING[String(planId || "").toLowerCase()] || null;
}

export function getPriceId(planId, cycle) {
  const plan = getPlan(planId);
  if (!plan) return null;
  return cycle === "yearly" ? plan.yearlyPriceId : plan.monthlyPriceId;
}

export function getAmount(planId, cycle) {
  const plan = getPlan(planId);
  if (!plan) return null;
  return cycle === "yearly" ? plan.yearlyPrice : plan.monthlyPrice;
}
