/**
 * Plan-based feature access control system
 * 5-tier model: free → core → essential → professional → enterprise
 */

export const PLAN_FEATURES = {
  free: {
    name: "Free",
    entities: ["Client", "Invoice", "Quote", "BusinessSettings"],
    payment_processing_fee: 0,
    transaction_limit: 10,
    features: {
      basic_invoicing: true,
      quotes: true,
      client_management: true,
      pdf_export: true, // Single template only
      email_sending: true,
      sms_sending: false,
      ai_assistance: false, // NO AI
      online_payments: false, // Stripe disabled
      jobs: false,
      expenses: false,
      recurring_invoices: false,
      receipt_checker: false,
      analytics_dashboard: false,
      smart_insights: false,
      crew_management: false,
      employee_profiles: false,
      task_management: false,
      custom_templates: false,
      branding: false,
      google_calendar: false,
      multi_user: false,
      priority_support: false,
      excel_export: false,
      client_approvals: false,
      client_reviews: false,
      material_assistant: false,
      price_comparison: false,
      automations: false,
    },
  },
  core: {
    name: "Core",
    entities: [
      "Client",
      "Invoice",
      "Quote",
      "BusinessSettings",
      "Job",
      "JobPhoto",
    ],
    payment_processing_fee: 1,
    transaction_limit: 30,
    features: {
      basic_invoicing: true,
      quotes: true,
      client_management: true,
      pdf_export: true,
      email_sending: true,
      sms_sending: true,
      ai_assistance: true, // AI Invoice/Quote generation enabled
      online_payments: true, // Stripe enabled
      jobs: true, // Basic job tracking
      expenses: false,
      recurring_invoices: false,
      receipt_checker: false,
      analytics_dashboard: false,
      smart_insights: false,
      crew_management: false,
      employee_profiles: false,
      task_management: false,
      custom_templates: false,
      branding: false,
      google_calendar: false,
      multi_user: false,
      priority_support: false,
      excel_export: false,
      client_approvals: true,
      client_reviews: true,
      material_assistant: false,
      price_comparison: false,
      automations: false,
    },
  },
  // Legacy alias for 'starter' → treated as 'core'
  starter: {
    name: "Core",
    entities: [
      "Client",
      "Invoice",
      "Quote",
      "BusinessSettings",
      "Job",
      "JobPhoto",
    ],
    payment_processing_fee: 1,
    transaction_limit: 30,
    features: {
      basic_invoicing: true,
      quotes: true,
      client_management: true,
      pdf_export: true,
      email_sending: true,
      sms_sending: true,
      ai_assistance: true,
      online_payments: true,
      jobs: true,
      expenses: false,
      recurring_invoices: false,
      receipt_checker: false,
      analytics_dashboard: false,
      smart_insights: false,
      crew_management: false,
      employee_profiles: false,
      task_management: false,
      custom_templates: false,
      branding: false,
      google_calendar: false,
      multi_user: false,
      priority_support: false,
      excel_export: false,
      client_approvals: true,
      client_reviews: true,
      material_assistant: false,
      price_comparison: false,
      automations: false,
    },
  },
  essential: {
    name: "Essential",
    entities: [
      "Client",
      "Invoice",
      "Quote",
      "BusinessSettings",
      "RecurringInvoice",
      "Receipt",
      "Job",
      "JobMaterial",
      "JobPhoto",
      "JobNote",
    ],
    payment_processing_fee: 1,
    transaction_limit: 75,
    features: {
      basic_invoicing: true,
      quotes: true,
      client_management: true,
      pdf_export: true,
      email_sending: true,
      sms_sending: true,
      ai_assistance: true,
      online_payments: true,
      jobs: true, // Full job tracking
      expenses: true,
      recurring_invoices: true,
      receipt_checker: true,
      analytics_dashboard: true,
      smart_insights: false,
      crew_management: false,
      employee_profiles: false,
      task_management: false,
      custom_templates: false,
      branding: false,
      google_calendar: false,
      multi_user: false,
      priority_support: false,
      excel_export: true,
      client_approvals: true,
      client_reviews: true,
      material_assistant: false,
      price_comparison: false,
      automations: true,
    },
  },
  professional: {
    name: "Professional",
    entities: [
      "Client",
      "Invoice",
      "Quote",
      "BusinessSettings",
      "Receipt",
      "PriceComparison",
      "Job",
      "JobMaterial",
      "JobPhoto",
      "JobNote",
      "InvoiceTemplate",
      "RecurringInvoice",
    ],
    payment_processing_fee: 1,
    transaction_limit: 250,
    features: {
      basic_invoicing: true,
      quotes: true,
      client_management: true,
      pdf_export: true,
      email_sending: true,
      sms_sending: true,
      ai_assistance: true,
      online_payments: true,
      jobs: true,
      expenses: true,
      recurring_invoices: true,
      receipt_checker: true,
      analytics_dashboard: true,
      smart_insights: true, // AI-driven analytics
      crew_management: true,
      employee_profiles: true,
      task_management: true,
      custom_templates: true,
      branding: true, // Logo, colors, footer
      google_calendar: true,
      multi_user: true,
      priority_support: true,
      excel_export: true,
      client_approvals: true,
      client_reviews: true,
      material_assistant: true,
      price_comparison: true,
      automations: true,
    },
  },
  enterprise: {
    name: "Enterprise",
    entities: [
      "Client",
      "Invoice",
      "Quote",
      "BusinessSettings",
      "Receipt",
      "PriceComparison",
      "Job",
      "JobMaterial",
      "JobPhoto",
      "JobNote",
      "InvoiceTemplate",
      "RecurringInvoice",
      "Subscription",
    ],
    payment_processing_fee: 0.75,
    transaction_limit: 500,
    features: {
      basic_invoicing: true,
      quotes: true,
      client_management: true,
      pdf_export: true,
      email_sending: true,
      sms_sending: true,
      ai_assistance: true,
      online_payments: true,
      jobs: true,
      expenses: true,
      recurring_invoices: true,
      receipt_checker: true,
      analytics_dashboard: true,
      smart_insights: true,
      crew_management: true,
      employee_profiles: true,
      task_management: true,
      custom_templates: true,
      branding: true,
      google_calendar: true,
      multi_user: true,
      priority_support: true,
      excel_export: true,
      client_approvals: true,
      client_reviews: true,
      material_assistant: true,
      price_comparison: true,
      automations: true,
    },
  },
  custom: {
    name: "Custom",
    entities: [
      "Client",
      "Invoice",
      "Quote",
      "BusinessSettings",
      "Receipt",
      "PriceComparison",
      "Job",
      "JobMaterial",
      "JobPhoto",
      "JobNote",
      "InvoiceTemplate",
      "RecurringInvoice",
      "Subscription",
    ],
    payment_processing_fee: 0.6,
    transaction_limit: -1,
    features: {
      basic_invoicing: true,
      quotes: true,
      client_management: true,
      pdf_export: true,
      email_sending: true,
      sms_sending: true,
      ai_assistance: true,
      online_payments: true,
      jobs: true,
      expenses: true,
      recurring_invoices: true,
      receipt_checker: true,
      analytics_dashboard: true,
      smart_insights: true,
      crew_management: true,
      employee_profiles: true,
      task_management: true,
      custom_templates: true,
      branding: true,
      google_calendar: true,
      multi_user: true,
      priority_support: true,
      excel_export: true,
      client_approvals: true,
      client_reviews: true,
      material_assistant: true,
      price_comparison: true,
      automations: true,
    },
  },
  trial: {
    name: "Trial",
    entities: [
      "Client",
      "Invoice",
      "Quote",
      "BusinessSettings",
      "RecurringInvoice",
      "Receipt",
      "PriceComparison",
      "Job",
      "JobMaterial",
      "JobPhoto",
      "JobNote",
      "InvoiceTemplate",
    ],
    payment_processing_fee: 1,
    transaction_limit: 100,
    features: {
      basic_invoicing: true,
      quotes: true,
      client_management: true,
      pdf_export: true,
      email_sending: true,
      sms_sending: true,
      ai_assistance: true,
      online_payments: true,
      jobs: true,
      expenses: true,
      recurring_invoices: true,
      receipt_checker: true,
      analytics_dashboard: true,
      smart_insights: true,
      crew_management: false,
      employee_profiles: false,
      task_management: false,
      custom_templates: true,
      branding: true,
      google_calendar: true,
      multi_user: false,
      priority_support: false,
      excel_export: true,
      client_approvals: true,
      client_reviews: true,
      material_assistant: true,
      price_comparison: true,
      automations: true,
    },
  },
};

/**
 * Plan upgrade path
 */
export const PLAN_UPGRADE_PATH = {
  free: "core",
  core: "essential",
  starter: "essential",
  essential: "professional",
  professional: "enterprise",
  enterprise: "custom",
  trial: "core",
};

/**
 * Human-readable next plan name for upgrade CTAs
 */
export const NEXT_PLAN_LABELS = {
  free: "Core",
  core: "Essential",
  starter: "Essential",
  essential: "Professional",
  professional: "Enterprise",
  enterprise: "Custom",
  trial: "Core",
};

/**
 * Check if a user's subscription plan has access to a specific entity
 */
export function canAccessEntity(subscription, entityName) {
  if (!subscription) return false;
  const planName = subscription.plan_name?.toLowerCase() || "free";
  const plan = PLAN_FEATURES[planName] || PLAN_FEATURES.free;
  return plan.entities.includes(entityName);
}

/**
 * Check if a user's subscription plan has access to a specific feature
 */
export function canAccessFeature(subscription, featureName) {
  if (!subscription) return false;
  const planName = subscription.plan_name?.toLowerCase() || "free";
  const plan = PLAN_FEATURES[planName] || PLAN_FEATURES.free;
  // Support legacy feature keys
  if (featureName === "excel_export")
    return plan.features.excel_export === true;
  return plan.features[featureName] === true;
}

/**
 * Get the user's current plan details
 */
export function getUserPlan(subscription) {
  if (!subscription) return PLAN_FEATURES.free;
  const planName = subscription.plan_name?.toLowerCase() || "free";
  return PLAN_FEATURES[planName] || PLAN_FEATURES.free;
}

/**
 * Get upgrade message for a specific feature
 */
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
  };
  return featureMessages[featureName] || "This feature";
}

/**
 * Get the minimum plan required for a feature
 */
export function getMinimumPlanForFeature(featureName) {
  const planHierarchy = [
    "free",
    "core",
    "essential",
    "professional",
    "enterprise",
  ];
  for (const planName of planHierarchy) {
    const plan = PLAN_FEATURES[planName];
    if (plan?.features[featureName]) {
      return plan.name;
    }
  }
  return "Enterprise";
}

/**
 * Get the next plan name for upgrade CTA
 */
export function getNextPlanName(subscription) {
  const planName = subscription?.plan_name?.toLowerCase() || "free";
  return NEXT_PLAN_LABELS[planName] || "Core";
}

/**
 * Check if user has reached free plan document limit
 */
export function hasReachedFreeLimit(subscription) {
  if (!subscription || subscription.plan_name !== "free") return false;
  return (subscription.lifetime_documents_created || 0) >= 10;
}

/**
 * Check if user is on free plan
 */
export function isFreePlan(subscription) {
  return subscription && subscription.plan_name === "free";
}
