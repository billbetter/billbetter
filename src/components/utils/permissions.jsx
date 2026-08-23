/**
 * Plan-based feature access control.
 *
 * 4-tier model: core -> essential -> professional -> enterprise, plus a
 * negotiated `custom` tier above and a `trial` pseudo-plan alongside.
 *
 * There is no free tier. Reaching any of this already requires a live
 * subscription (RLS + the Layout gate), so these functions differentiate
 * between PAID plans only -- they are not an access check. For "may this user
 * open the app at all?", see lib/access.js.
 *
 * -- Why this file looks the way it does ----------------------------------
 *
 * It used to be seven near-identical literal objects, one per plan, each
 * listing all 28 feature booleans by hand. Adding a feature meant editing
 * seven places, and the ones that got missed became silent bugs -- which is
 * exactly what happened to Enterprise: its flags were byte-identical to
 * Professional's, so "White-label options" and "Advanced granular
 * permissions" were sold on the pricing page and enforced nowhere.
 *
 * Now each feature is declared ONCE, next to the lowest plan that unlocks it,
 * and the per-plan tables are generated from that. A feature cannot be on at
 * one tier and off at a higher one, and getMinimumPlanForFeature is exact by
 * construction rather than by a hopeful scan.
 *
 * Prices, transaction limits and processing fees come from config/plans.js.
 * That file must never import this one.
 */

import {
  PLANS,
  PLAN_ORDER,
  TRIAL_TRANSACTIONS,
  getPlanRank,
  resolvePlanId,
} from "@/config/plans";

/**
 * The lowest plan that unlocks each feature.
 *
 * The tier stories these encode:
 *   core         "Get paid."          One person. Invoice, quote, take a card.
 *   essential    "Stop doing admin."  Recurring, expenses, analytics, calendar,
 *                                     and your own logo on the PDF.
 *   professional "Run a crew."        People, permissions, custom templates,
 *                                     material pricing, AI insights.
 *   enterprise   "Scale it."          White-label, API, granular permissions,
 *                                     a human who knows your name.
 */
export const FEATURE_MINIMUM_PLAN = {
  // -- Core: the things that make it worth paying for at all ---------------
  basic_invoicing: "core",
  quotes: "core",
  client_management: "core",
  pdf_export: "core",
  email_sending: "core",
  sms_sending: "core",
  online_payments: "core",
  client_approvals: "core",
  client_reviews: "core",
  jobs: "core",
  // AI drafting is the hook, not the upsell. Gating it would mean the
  // cheapest plan never sees the one thing that makes this different from a
  // PDF template.
  ai_assistance: "core",
  // Chasing overdue invoices is the product's whole promise. A solo
  // contractor is the person who needs it most and can least afford $49.
  automations: "core",

  // -- Essential: the admin disappears -------------------------------------
  recurring_invoices: "essential",
  expenses: "essential",
  receipt_checker: "essential",
  analytics_dashboard: "essential",
  excel_export: "essential",
  // Moved down from professional. Scheduling is not an enterprise concern --
  // a one-van business lives in its calendar, and it makes the $24 -> $49
  // step feel like a different product rather than a bigger bucket.
  google_calendar: "essential",
  // Also moved down. "My logo on my invoice" is table stakes for anyone
  // paying anything. Building a bespoke LAYOUT is the premium bit, and that
  // stays at professional as custom_templates.
  branding: "essential",

  // -- Professional: other people are involved -----------------------------
  crew_management: "professional",
  employee_profiles: "professional",
  task_management: "professional",
  multi_user: "professional",
  custom_templates: "professional",
  smart_insights: "professional",
  priority_support: "professional",
  public_booking: "professional",
  // SerpAPI-backed, so these carry a real per-lookup cost to us. They belong
  // above the volume tiers that can absorb it.
  material_assistant: "professional",
  price_comparison: "professional",

  // -- Enterprise: the tier that finally means something --------------------
  white_label: "enterprise",
  advanced_permissions: "enterprise",
  dedicated_support: "enterprise",
  api_access: "enterprise",
};

/** The lowest plan that may touch each entity. */
export const ENTITY_MINIMUM_PLAN = {
  Client: "core",
  Invoice: "core",
  Quote: "core",
  BusinessSettings: "core",
  Subscription: "core", // every screen reads the user's own subscription
  Job: "core",
  JobPhoto: "core",
  RecurringInvoice: "essential",
  Receipt: "essential",
  JobMaterial: "essential",
  JobNote: "essential",
  InvoiceTemplate: "professional",
  PriceComparison: "professional",
};

const ALL_FEATURES = Object.keys(FEATURE_MINIMUM_PLAN);
const ALL_ENTITIES = Object.keys(ENTITY_MINIMUM_PLAN);

/** Every real plan id, ranked lowest first. */
const RANKED_PLANS = [...PLAN_ORDER, "custom"];

function featuresAtOrAbove(planId) {
  const rank = getPlanRank(planId);
  return ALL_FEATURES.reduce((acc, key) => {
    acc[key] = rank >= getPlanRank(FEATURE_MINIMUM_PLAN[key]);
    return acc;
  }, {});
}

function entitiesAtOrAbove(planId) {
  const rank = getPlanRank(planId);
  return ALL_ENTITIES.filter(
    (name) => rank >= getPlanRank(ENTITY_MINIMUM_PLAN[name]),
  );
}

function buildPlan(planId) {
  const billing = PLANS[planId];
  return {
    name: billing.name,
    entities: entitiesAtOrAbove(planId),
    payment_processing_fee: billing.processingFee,
    transaction_limit: billing.transactions,
    features: featuresAtOrAbove(planId),
  };
}

export const PLAN_FEATURES = RANKED_PLANS.reduce((acc, id) => {
  acc[id] = buildPlan(id);
  return acc;
}, {});

/**
 * The trial. Professional's feature set minus the crew tooling -- there is
 * nothing to demonstrate about roles and permissions to someone evaluating
 * the product alone on day one -- and a transaction cap between Core and
 * Essential, so a genuinely busy trialist still has a reason to subscribe.
 */
PLAN_FEATURES.trial = {
  name: "Trial",
  entities: entitiesAtOrAbove("professional"),
  payment_processing_fee: PLANS.core.processingFee,
  transaction_limit: TRIAL_TRANSACTIONS,
  features: {
    ...featuresAtOrAbove("professional"),
    crew_management: false,
    employee_profiles: false,
    task_management: false,
    multi_user: false,
    priority_support: false,
  },
};

/** Legacy plan_name still on old rows. Kept so those users do not lose access. */
PLAN_FEATURES.starter = PLAN_FEATURES.core;

/** Where "upgrade" sends someone standing on each plan. */
export const PLAN_UPGRADE_PATH = RANKED_PLANS.reduce(
  (acc, id, i) => {
    acc[id] = RANKED_PLANS[i + 1] || "custom";
    return acc;
  },
  { trial: "core", starter: "essential" },
);

/** Human-readable next plan name for upgrade CTAs. */
export const NEXT_PLAN_LABELS = Object.entries(PLAN_UPGRADE_PATH).reduce(
  (acc, [from, to]) => {
    acc[from] = PLANS[to]?.name || "Custom";
    return acc;
  },
  {},
);

// -- Lookups --------------------------------------------------------------

/**
 * The plan table for a subscription row. Unknown or missing plan names fall
 * back to Core -- the least generous paid tier, so a malformed row never
 * grants more than it should.
 */
export function getUserPlan(subscription) {
  if (!subscription) return PLAN_FEATURES.core;
  const planName = resolvePlanId(subscription.plan_name) || "core";
  return PLAN_FEATURES[planName] || PLAN_FEATURES.core;
}

/** Whether the subscription's plan may touch an entity. */
export function canAccessEntity(subscription, entityName) {
  if (!subscription) return false;
  return getUserPlan(subscription).entities.includes(entityName);
}

/** Whether the subscription's plan has a feature. */
export function canAccessFeature(subscription, featureName) {
  if (!subscription) return false;
  return getUserPlan(subscription).features[featureName] === true;
}

/**
 * This month's transaction allowance. -1 means unlimited.
 *
 * The subscription row carries `monthly_transaction_limit`, written by the
 * Stripe webhook at checkout. When the ladder is rebalanced those stored
 * values go stale -- an Essential subscriber's row still says 75 after the
 * tier moved to 100 -- and nothing rewrites them until that user next
 * changes plan. So for a named tier the plan definition wins.
 *
 * Custom is the exception: its allowance is negotiated per contract and only
 * ever exists on the row, so the row wins there.
 */
export function getTransactionAllowance(subscription) {
  if (!subscription) return PLANS.core.transactions;

  const stored = subscription.monthly_transaction_limit;
  const planId = resolvePlanId(subscription.plan_name);

  if (planId === "custom" || !PLAN_FEATURES[planId]) {
    if (stored === -1 || stored === null || stored === undefined) return -1;
    return Number(stored);
  }

  const fromPlan = PLAN_FEATURES[planId].transaction_limit;
  if (fromPlan === -1 || stored === -1) return -1;
  // Never take capacity away from someone who was already granted more.
  return Math.max(Number(fromPlan) || 0, Number(stored) || 0);
}

/** Our platform fee on a payment, as a percentage. */
export function getProcessingFeePercent(subscription) {
  return getUserPlan(subscription).payment_processing_fee;
}

/** Display name for a feature, used in upgrade prompts. */
export function getUpgradeMessage(featureName) {
  const featureMessages = {
    analytics_dashboard: "Analytics Dashboard",
    excel_export: "Excel Export",
    receipt_checker: "AI Receipt Scanner",
    custom_templates: "Custom PDF Templates",
    material_assistant: "Material Assistant",
    price_comparison: "Price Comparison",
    recurring_invoices: "Recurring Invoices",
    multi_user: "Multi-user Access",
    crew_management: "Crew Management",
    employee_profiles: "Employee Profiles",
    task_management: "Task Management",
    smart_insights: "Smart Insights (AI Analytics)",
    branding: "Custom Branding",
    google_calendar: "Google Calendar Integration",
    ai_assistance: "AI Assistance",
    online_payments: "Online Payments",
    jobs: "Job Tracking",
    expenses: "Expense Tracking",
    sms_sending: "SMS Notifications",
    client_reviews: "Client Reviews",
    public_booking: "Public Booking Page",
    white_label: "White-label Branding",
    advanced_permissions: "Advanced Permissions",
    dedicated_support: "Dedicated Support",
    api_access: "API Access",
    automations: "Automated Follow-ups",
  };
  return featureMessages[featureName] || "This feature";
}

/** The cheapest plan that includes a feature, by display name. */
export function getMinimumPlanForFeature(featureName) {
  const planId = FEATURE_MINIMUM_PLAN[featureName];
  return PLANS[planId]?.name || "Enterprise";
}

/** The next plan up from the user's current one, by display name. */
export function getNextPlanName(subscription) {
  const planName = resolvePlanId(subscription?.plan_name) || "core";
  return NEXT_PLAN_LABELS[planName] || "Core";
}
