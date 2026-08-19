import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { PLAN_BILLING } from "@/config/plans";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Check,
  Sparkles,
  TrendingUp,
  Zap,
  Crown,
  ArrowRight,
  X,
  Loader2,
  Clock,
  Gift,
  CheckCircle,
  Building2,
  Shield,
  CreditCard,
  Mail,
  HelpCircle,
  Star,
} from "lucide-react";
import { sdk } from "@/api/sdk";
import { format } from "date-fns";
import SEO from "@/components/seo/SEO";

export default function Pricing() {
  const navigate = useNavigate();
  const [billingCycle, setBillingCycle] = useState("monthly");
  const [loading, setLoading] = useState(null);
  const [showTrialModal, setShowTrialModal] = useState(false);
  const [selectedPlanForTrial, setSelectedPlanForTrial] = useState(null);
  const [currentSubscription, setCurrentSubscription] = useState(null);
  const [user, setUser] = useState(null);
  const [termsAccepted, setTermsAccepted] = useState(false);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
    loadUserAndSubscription();
  }, []);

  const loadUserAndSubscription = async () => {
    try {
      const currentUser = await sdk.auth.me();
      setUser(currentUser);
      const subscriptions = await sdk.entities.Subscription.filter({
        user_id: currentUser.id,
      });
      if (subscriptions.length > 0) {
        setCurrentSubscription(subscriptions[0]);
      }
    } catch (error) {
      setUser(null);
      setCurrentSubscription(null);
    }
  };

  // A plan Stripe is actively billing. Mirrors REPLACEABLE in
  // stripe-create-subscription -- switching between these is a paid swap that
  // refunds and cancels the old one; dropping to free is not.
  const holdsPaidPlan = Boolean(
    currentSubscription &&
      ["active", "trial", "trialing", "past_due"].includes(
        currentSubscription.status,
      ) &&
      currentSubscription.stripe_subscription_id,
  );

  const handleActivateFreePlan = async () => {
    setLoading("free");
    try {
      if (!user) {
        localStorage.setItem("pending_plan_selection", "free");
        await sdk.auth.redirectToLogin(window.location.pathname);
        return;
      }

      // Dropping to free while Stripe is still billing a plan would show the
      // user a free account and charge them for a paid one. Cancelling a live
      // subscription is a server job, so send them there instead of writing a
      // free row over the top of it.
      if (holdsPaidPlan) {
        alert(
          "You're on a paid plan. Cancel it from Settings before switching to the free plan.",
        );
        return;
      }

      const freePlan = {
        user_id: user.id,
        plan_name: "free",
        billing_cycle: "monthly",
        status: "free",
        monthly_transaction_limit: 10,
        transactions_used_this_month: 0,
        invoices_used_this_month: 0,
        quotes_used_this_month: 0,
        payment_processing_fee: 0,
        overage_fee_per_invoice: 0,
      };

      // One subscription row per user -- creating a second one leaves the app
      // reading whichever it finds first.
      if (currentSubscription) {
        await sdk.entities.Subscription.update(currentSubscription.id, freePlan);
      } else {
        await sdk.entities.Subscription.create({
          ...freePlan,
          lifetime_documents_created: 0,
        });
      }
      localStorage.removeItem("pending_plan_selection");
      navigate(createPageUrl("Dashboard"));
    } catch (error) {
      alert("Failed to activate free plan. Please try again.");
    } finally {
      setLoading(null);
    }
  };

  const handleCheckout = async (plan, cycle) => {
    if (plan.id === "custom") {
      navigate(createPageUrl("Contact"));
      return;
    }
    if (plan.id === "free") {
      await handleActivateFreePlan();
      return;
    }
    setLoading(plan.id);
    try {
      if (!user) {
        await sdk.auth.redirectToLogin(window.location.pathname);
        return;
      }
      // On-site checkout: card details are collected on our own branded page
      // rather than redirecting out to Stripe's hosted flow.
      navigate(
        `${createPageUrl("Checkout")}?plan=${encodeURIComponent(plan.id)}&cycle=${encodeURIComponent(cycle)}`,
      );
    } catch (error) {
      alert(error.message || "Failed to start subscription. Please try again.");
    } finally {
      setLoading(null);
    }
  };

  const handleStartTrial = async (plan, cycle) => {
    setSelectedPlanForTrial({ plan, cycle });
    setTermsAccepted(false);
    setShowTrialModal(true);
  };

  const confirmTrial = async () => {
    if (!selectedPlanForTrial) return;
    if (!termsAccepted) {
      alert("Please accept the Terms of Service to continue.");
      return;
    }
    setLoading(selectedPlanForTrial.plan.id);
    try {
      if (!user) {
        await sdk.auth.redirectToLogin(window.location.pathname);
        return;
      }
      // Trial eligibility is decided server-side in stripe-create-subscription;
      // this page only carries the intent through to checkout.
      setShowTrialModal(false);
      navigate(
        `${createPageUrl("Checkout")}?plan=${encodeURIComponent(
          selectedPlanForTrial.plan.id,
        )}&cycle=${encodeURIComponent(selectedPlanForTrial.cycle)}&trial=1`,
      );
    } catch (error) {
      alert(error.message || "Failed to start trial. Please try again.");
    } finally {
      setLoading(null);
      setShowTrialModal(false);
    }
  };

  const plans = [
    // Free tier removed: access now requires a live subscription (see Layout.jsx).
    {
      id: "core",
      name: "Core",
      icon: Sparkles,
      monthlyPrice: 24,
      yearlyPrice: 240,
      monthlyPriceId: PLAN_BILLING.core.monthlyPriceId,
      yearlyPriceId: PLAN_BILLING.core.yearlyPriceId,
      transactions: 30,
      description: "For solo contractors",
      valueLine: "Accept payments and automate your workflow",
      features: [
        "30 transactions/month",
        "AI invoice & quote generation",
        "Online payments via Stripe",
        "Basic job tracking & photos",
        "SMS notifications",
        "Everything in Free",
      ],
      notIncluded: ["Recurring invoices", "Expenses", "Analytics"],
      cta: "Start Free Trial",
      popular: false,
    },
    {
      id: "essential",
      name: "Essential",
      icon: TrendingUp,
      monthlyPrice: 39,
      yearlyPrice: 390,
      monthlyPriceId: PLAN_BILLING.essential.monthlyPriceId,
      yearlyPriceId: PLAN_BILLING.essential.yearlyPriceId,
      transactions: 75,
      description: "Best value for small businesses",
      valueLine: "Save time with automation and expense tracking",
      features: [
        "75 transactions/month",
        "Recurring invoices",
        "Expense tracking + AI receipt scanner",
        "Analytics dashboard",
        "Full job tracking (status, cost, location)",
        "Job notes",
        "Everything in Core",
      ],
      notIncluded: ["Crew management", "Custom templates", "Smart Insights"],
      cta: "Start Free Trial",
      popular: false,
    },
    {
      id: "professional",
      name: "Professional",
      icon: Zap,
      monthlyPrice: 79,
      yearlyPrice: 790,
      monthlyPriceId: PLAN_BILLING.professional.monthlyPriceId,
      yearlyPriceId: PLAN_BILLING.professional.yearlyPriceId,
      transactions: 250,
      description: "For growing businesses",
      valueLine: "Run your entire business in one place",
      features: [
        "250 transactions/month",
        "Crew management (roles & permissions)",
        "Smart Insights (AI analytics)",
        "Custom PDF templates & branding",
        "Google Calendar integration",
        "Priority support",
        "Everything in Essential",
      ],
      notIncluded: [],
      cta: "Start Free Trial",
      popular: true,
    },
    {
      id: "enterprise",
      name: "Enterprise",
      icon: Crown,
      monthlyPrice: 99,
      yearlyPrice: 990,
      monthlyPriceId: PLAN_BILLING.enterprise.monthlyPriceId,
      yearlyPriceId: PLAN_BILLING.enterprise.yearlyPriceId,
      transactions: 500,
      description: "For larger operations",
      valueLine: "Scale your operations with full control",
      features: [
        "500 transactions/month",
        "White-label options",
        "Dedicated support",
        "Advanced granular permissions",
        "Everything in Professional",
      ],
      notIncluded: [],
      cta: "Start Free Trial",
      popular: false,
    },
    {
      id: "custom",
      name: "Custom",
      icon: Building2,
      monthlyPrice: null,
      yearlyPrice: null,
      monthlyPriceId: null,
      yearlyPriceId: null,
      transactions: -1,
      description: "Tailored solutions for large enterprises",
      valueLine: "Custom pricing for custom needs",
      features: [
        "Unlimited transactions",
        "Custom features",
        "Website design",
        "24/7 support",
        "Enhanced AI features",
        "No Invoicium branding",
        "+ More (just ask!)",
      ],
      notIncluded: [],
      cta: "Contact Sales",
      popular: false,
    },
  ];

  return (
    <>
      <SEO
        title="Pricing for Contractor Invoicing Software"
        description="Affordable invoicing plans for electricians, plumbers, HVAC contractors. AI invoicing, recurring billing, quotes. Plans from $24/month with 7-day free trial."
      />

      <div className="min-h-screen bg-surface">
        {/* ── HERO ─────────────────────────────────────────────── */}
        <section className="relative border-b border-line overflow-hidden">
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[900px] h-[600px] bg-brand-300/25 rounded-full blur-[160px]" />
          </div>
          <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24 text-center">
            <div className="inline-flex items-center gap-2 bg-brand-50 border border-brand-200 text-brand-700 px-4 py-2 rounded-full text-sm font-bold mb-8">
              <Star className="w-4 h-4 flex-shrink-0 fill-current" />
              Simple, Transparent Pricing
            </div>
            <h1 className="text-[clamp(2.5rem,7vw,4.5rem)] font-black text-content leading-[0.9] mb-6 tracking-tight">
              Choose Your Plan.
              <br />
              <span className="text-brand-700">Start Free.</span>
            </h1>
            <p className="text-lg sm:text-xl text-content-body max-w-2xl mx-auto leading-relaxed">
              Start free, scale as you grow. All paid plans include a 7-day free
              trial with no credit card required.
            </p>
            <div className="flex flex-wrap justify-center gap-5 mt-8 text-sm">
              {[
                "No credit card required",
                "No contracts",
                "Cancel anytime",
              ].map((t) => (
                <div
                  key={t}
                  className="flex items-center gap-2 text-success-600 font-semibold"
                >
                  <CheckCircle className="w-4 h-4 flex-shrink-0" /> {t}
                </div>
              ))}
            </div>
          </div>
        </section>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16 space-y-12 sm:space-y-16">
          {/* Current Subscription Banner */}
          {currentSubscription && (
            <div
              className={`rounded-2xl p-6 border ${
                currentSubscription.status === "trial"
                  ? "bg-brand-50 border-brand-200"
                  : "bg-success-50 border-success-200"
              }`}
            >
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div
                    className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
                      currentSubscription.status === "trial"
                        ? "bg-brand-100"
                        : "bg-success-100"
                    }`}
                  >
                    {currentSubscription.status === "trial" ? (
                      <Clock className="w-6 h-6 text-brand-700" />
                    ) : (
                      <Crown className="w-6 h-6 text-success-600" />
                    )}
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-content">
                      {currentSubscription.status === "trial"
                        ? "Free Trial Active"
                        : "Current Subscription"}
                    </h3>
                    <p className="text-content-body text-sm">
                      {currentSubscription.status === "trial"
                        ? `Trial ends ${
                            currentSubscription.trial_end_date
                              ? format(
                                  new Date(currentSubscription.trial_end_date),
                                  "MMMM d, yyyy",
                                )
                              : "soon"
                          }`
                        : `${
                            currentSubscription.plan_name
                              .charAt(0)
                              .toUpperCase() +
                            currentSubscription.plan_name.slice(1)
                          } Plan • ${
                            currentSubscription.billing_cycle === "yearly"
                              ? "Billed Yearly"
                              : "Billed Monthly"
                          }`}
                    </p>
                  </div>
                </div>

                {currentSubscription.status === "trial" &&
                  currentSubscription.trial_end_date && (
                    <div className="px-4 py-2 rounded-full text-sm font-bold bg-brand-100 text-brand-700 border border-brand-200">
                      {Math.max(
                        0,
                        Math.ceil(
                          (new Date(currentSubscription.trial_end_date) -
                            new Date()) /
                            (1000 * 60 * 60 * 24),
                        ),
                      )}{" "}
                      days remaining
                    </div>
                  )}
              </div>
            </div>
          )}

          {/* Billing Toggle */}
          <div className="flex justify-center">
            <div className="p-1 rounded-xl inline-flex w-full max-w-xs sm:w-auto bg-ink-100 border border-line">
              <button
                onClick={() => setBillingCycle("monthly")}
                className={`flex-1 sm:flex-none px-6 sm:px-8 py-2.5 sm:py-3 rounded-lg font-bold text-sm transition-colors ${
                  billingCycle === "monthly"
                    ? "bg-brand text-content-inverted shadow-sm"
                    : "text-content-muted hover:text-content"
                }`}
              >
                Monthly
              </button>
              <button
                onClick={() => setBillingCycle("yearly")}
                className={`flex-1 sm:flex-none px-6 sm:px-8 py-2.5 sm:py-3 rounded-lg font-bold text-sm transition-colors flex items-center justify-center gap-2 ${
                  billingCycle === "yearly"
                    ? "bg-brand text-content-inverted shadow-sm"
                    : "text-content-muted hover:text-content"
                }`}
              >
                Yearly
                <span
                  className={`text-xs px-2 py-0.5 rounded-full font-bold whitespace-nowrap border ${
                    billingCycle === "yearly"
                      ? "bg-success-500 text-content-inverted border-success-400"
                      : "bg-success-50 text-success-600 border-success-200"
                  }`}
                >
                  Save 17%
                </span>
              </button>
            </div>
          </div>

          {/* Pricing Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6 pt-3">
            {plans.map((plan) => {
              const isCurrentPlan =
                currentSubscription?.plan_name === plan.id &&
                currentSubscription?.billing_cycle === billingCycle;
              const price =
                billingCycle === "yearly"
                  ? plan.yearlyPrice
                  : plan.monthlyPrice;
              const isLoading = loading === plan.id;

              return (
                <div
                  key={plan.id}
                  className={`relative flex flex-col rounded-2xl bg-surface transition-all duration-300 hover:-translate-y-1 ${
                    plan.popular
                      ? "ring-2 ring-brand-600 shadow-2xl shadow-brand-600/15"
                      : "border border-line hover:border-line-strong shadow-sm hover:shadow-md"
                  }`}
                >
                  {/* Popular badge */}
                  {plan.popular && (
                    <div className="absolute -top-0 left-1/2 -translate-x-1/2 -translate-y-1/2">
                      <div className="px-4 py-1.5 rounded-full text-xs font-bold text-content-inverted bg-brand flex items-center gap-1.5 whitespace-nowrap">
                        <Star className="w-3.5 h-3.5 fill-current" />
                        MOST POPULAR
                      </div>
                    </div>
                  )}

                  {isCurrentPlan && (
                    <div className="absolute top-4 right-4">
                      <div className="px-3 py-1 rounded-full text-xs font-bold text-success-700 bg-success-50 border border-success-200">
                        Current Plan
                      </div>
                    </div>
                  )}

                  {/* Card Header */}
                  <div className="p-6 pb-4">
                    <div className="flex items-center gap-3 mb-4">
                      <div
                        className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${
                          plan.popular ? "bg-brand-100" : "bg-ink-100"
                        }`}
                      >
                        <plan.icon
                          className={`w-5 h-5 ${
                            plan.popular
                              ? "text-brand-700"
                              : "text-content-body"
                          }`}
                        />
                      </div>
                      <div>
                        <h3 className="text-xl font-black text-content">
                          {plan.name}
                        </h3>
                        <p className="text-sm text-content-muted">
                          {plan.description}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4">
                      {price !== null ? (
                        <div className="flex items-baseline gap-1">
                          <span
                            className={`text-4xl font-black ${
                              plan.popular ? "text-brand-700" : "text-content"
                            }`}
                          >
                            ${price}
                          </span>
                          <span className="font-medium text-content-muted">
                            /{billingCycle === "yearly" ? "year" : "mo"}
                          </span>
                        </div>
                      ) : (
                        <span className="text-3xl font-black text-content">
                          Custom
                        </span>
                      )}

                      {billingCycle === "yearly" && price > 0 && (
                        <p className="text-sm font-semibold mt-1 text-success-600">
                          ${(price / 12).toFixed(2)}/month billed annually
                        </p>
                      )}

                      {plan.valueLine && (
                        <p className="text-sm mt-2 text-content-muted">
                          {plan.valueLine}
                        </p>
                      )}

                      {plan.id !== "free" && plan.id !== "custom" && (
                        <div className="mt-4 flex items-center gap-2 text-sm rounded-lg px-3 py-2 bg-success-50 border border-success-200 text-success-700 font-semibold">
                          <CheckCircle className="w-4 h-4 flex-shrink-0" />
                          <span>{plan.transactions} transactions/month</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Features */}
                  <div className="flex-1 px-6 py-4">
                    <div className="space-y-4">
                      <div className="space-y-3">
                        <p className="text-xs font-bold uppercase tracking-widest text-content-subtle">
                          Included features
                        </p>
                        {plan.features.map((feature, idx) => (
                          <div key={idx} className="flex items-start gap-3">
                            <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 bg-success-50 border border-success-200">
                              <Check className="w-3 h-3 text-success-600" />
                            </div>
                            <span className="text-sm text-ink-700">
                              {feature}
                            </span>
                          </div>
                        ))}
                      </div>

                      {plan.notIncluded.length > 0 && (
                        <div className="space-y-3 pt-4 border-t border-line-subtle">
                          <p className="text-xs font-bold uppercase tracking-widest text-content-subtle">
                            Not included
                          </p>
                          {plan.notIncluded.map((feature, idx) => (
                            <div key={idx} className="flex items-start gap-3">
                              <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 bg-surface-sunken border border-line">
                                <X className="w-3 h-3 text-content-subtle" />
                              </div>
                              <span className="text-sm line-through text-content-subtle">
                                {feature}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* CTA */}
                  <div className="p-6 pt-4 border-t border-line-subtle">
                    {plan.id === "free" ? (
                      <button
                        onClick={() => handleCheckout(plan, billingCycle)}
                        disabled={
                          isLoading || currentSubscription?.plan_name === "free"
                        }
                        className="w-full h-12 rounded-lg font-bold text-content-inverted bg-surface-inverted hover:bg-ink-800 transition-colors disabled:opacity-50"
                      >
                        {isLoading ? (
                          <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                        ) : currentSubscription?.plan_name === "free" ? (
                          "Current Plan"
                        ) : (
                          plan.cta
                        )}
                      </button>
                    ) : plan.id === "custom" ? (
                      <button
                        onClick={() => handleCheckout(plan, billingCycle)}
                        disabled={isLoading}
                        className="w-full h-12 rounded-lg font-semibold border border-line bg-surface text-content-body hover:bg-surface-sunken hover:text-content transition-colors"
                      >
                        {isLoading ? (
                          <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                        ) : (
                          plan.cta
                        )}
                      </button>
                    ) : !currentSubscription ||
                      currentSubscription.status === "trial" ? (
                      <div className="space-y-3">
                        <button
                          onClick={() => handleStartTrial(plan, billingCycle)}
                          disabled={isLoading}
                          className={`w-full h-12 rounded-lg font-bold text-content-inverted transition-colors flex items-center justify-center gap-2 ${
                            plan.popular
                              ? "bg-brand hover:bg-brand-hover"
                              : "bg-surface-inverted hover:bg-ink-800"
                          }`}
                        >
                          {isLoading ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                          ) : (
                            <>
                              <Sparkles className="w-4 h-4" />
                              Start 7-Day Free Trial
                            </>
                          )}
                        </button>
                        <button
                          onClick={() => handleCheckout(plan, billingCycle)}
                          disabled={isLoading}
                          className="w-full h-10 rounded-lg text-sm font-medium transition-colors text-content-muted hover:text-content"
                        >
                          or buy now
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => handleCheckout(plan, billingCycle)}
                        disabled={isLoading || isCurrentPlan}
                        className={`w-full h-12 rounded-lg font-bold text-content-inverted transition-colors disabled:opacity-50 ${
                          plan.popular
                            ? "bg-brand hover:bg-brand-hover"
                            : "bg-surface-inverted hover:bg-ink-800"
                        }`}
                      >
                        {isLoading ? (
                          <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                        ) : isCurrentPlan ? (
                          "Current Plan"
                        ) : (
                          "Switch to This Plan"
                        )}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Trust Indicators */}
          <div className="grid grid-cols-3 gap-3 sm:gap-6 max-w-4xl mx-auto">
            {[
              { icon: Shield, text: "SSL Secure Checkout" },
              { icon: CreditCard, text: "Cancel Anytime" },
              { icon: CheckCircle, text: "7-Day Free Trial" },
            ].map((item, idx) => (
              <div
                key={idx}
                className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-3 p-4 rounded-xl bg-surface-sunken border border-line text-center sm:text-left"
              >
                <item.icon className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0 text-success-600" />
                <span className="font-semibold text-xs sm:text-sm text-ink-700">
                  {item.text}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* ── FAQ ──────────────────────────────────────────────── */}
        <section className="py-16 sm:py-24 bg-brand-50 border-y border-line relative overflow-hidden">
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-0 right-0 w-[600px] h-[400px] bg-brand-200/30 rounded-full blur-[120px]" />
          </div>
          <div className="relative max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-10 sm:mb-14">
              <p className="text-brand-700 font-bold text-sm uppercase tracking-widest mb-4">
                Questions
              </p>
              <h2 className="text-3xl sm:text-5xl font-black text-content">
                Frequently Asked
              </h2>
            </div>
            <div className="space-y-3 sm:space-y-4">
              {[
                {
                  q: "What counts as a transaction?",
                  a: "Each invoice or quote you create counts as one transaction. For example, if you send 50 invoices and 25 quotes in a month, that's 75 transactions total.",
                },
                {
                  q: "Can I change plans at any time?",
                  a: "Absolutely! You can upgrade or downgrade your plan at any time. When upgrading, you'll get immediate access to new features. When downgrading, changes take effect at your next billing cycle.",
                },
                {
                  q: "What happens if I exceed my transaction limit?",
                  a: "When you reach your monthly transaction limit, you'll need to upgrade to a higher plan to continue creating invoices and quotes. You cannot purchase extra transactions — simply upgrade your plan.",
                },
                {
                  q: "Is there a setup fee or hidden costs?",
                  a: "No setup fees, no hidden costs, no overage fees. You only pay your subscription fee. When you accept payments through Stripe, there's a 1% platform fee plus Stripe's standard processing fees (2.9% + $0.30 per transaction).",
                },
                {
                  q: "Do you offer refunds?",
                  a: "We offer a 7-day free trial so you can test everything risk-free. After subscribing, you can cancel anytime and won't be charged for future billing periods.",
                },
              ].map((faq, idx) => (
                <div
                  key={idx}
                  className="rounded-2xl p-5 sm:p-6 bg-surface border border-line hover:border-brand-300 shadow-sm hover:shadow-md transition-all"
                >
                  <h3 className="text-base sm:text-lg font-black mb-2 flex items-start gap-2.5 text-content">
                    <HelpCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-brand-700" />
                    {faq.q}
                  </h3>
                  <p className="pl-8 text-sm sm:text-base text-content-body leading-relaxed">
                    {faq.a}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── SUPPORT CTA ──────────────────────────────────────── */}
        <section className="relative py-20 sm:py-28 bg-surface-inverted overflow-hidden">
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[800px] h-[300px] bg-success-500/10 rounded-full blur-[100px]" />
          </div>
          <div className="relative max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="text-3xl sm:text-5xl font-black mb-4 text-content-inverted leading-tight">
              Questions about pricing?
            </h2>
            <p className="mb-8 max-w-xl mx-auto text-base sm:text-lg text-ink-300">
              Our team is here to help you find the perfect plan for your
              business.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center">
              <button
                onClick={() =>
                  (window.location.href = "mailto:sales@invoicium.ca")
                }
                className="w-full sm:w-auto px-8 h-14 rounded-2xl font-bold transition-colors border border-ink-700 bg-ink-800 text-ink-200 hover:bg-ink-700 hover:text-content-inverted flex items-center justify-center"
              >
                <Mail className="w-4 h-4 mr-2 flex-shrink-0" />
                Email Sales
              </button>
              <button
                onClick={() => navigate(createPageUrl("Dashboard"))}
                className="w-full sm:w-auto px-10 h-14 rounded-2xl font-black text-content transition-all flex items-center justify-center bg-brand-500 shadow-2xl shadow-brand-500/30 hover:scale-[1.02] active:scale-[0.98]"
              >
                Start Free Trial
                <ArrowRight className="w-5 h-5 ml-2 flex-shrink-0" />
              </button>
            </div>
          </div>
        </section>

        {/* Trial Modal */}
        <Dialog open={showTrialModal} onOpenChange={setShowTrialModal}>
          <DialogContent className="sm:max-w-md p-0 overflow-hidden bg-surface border border-line">
            <div className="p-6 border-b border-line bg-surface-sunken">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-xl font-black text-content">
                  <Sparkles className="w-5 h-5 text-brand-700" />
                  Start Your Free Trial
                </DialogTitle>
              </DialogHeader>
            </div>

            <div className="p-6 space-y-5">
              <div className="rounded-xl p-4 bg-success-50 border border-success-200">
                <p className="font-bold mb-3 text-success-700">You'll get:</p>
                <ul className="space-y-2">
                  {[
                    "7 days completely free",
                    "Full access to all plan features",
                    "Cancel anytime, no questions asked",
                    "No charges until trial ends",
                  ].map((item, i) => (
                    <li
                      key={i}
                      className="flex items-center gap-2 text-sm text-success-700"
                    >
                      <CheckCircle className="w-4 h-4 flex-shrink-0 text-success-600" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="rounded-xl p-4 bg-warning-50 border border-warning-200">
                <div className="flex items-start gap-3">
                  <Gift className="w-5 h-5 flex-shrink-0 mt-0.5 text-warning-600" />
                  <div>
                    <p className="font-bold text-sm text-warning-800">
                      Bonus: 7 Extra Days
                    </p>
                    <p className="text-xs mt-1 text-warning-700">
                      When you subscribe after your trial, we'll add 7
                      complimentary days to your first billing period.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3 p-4 rounded-lg bg-surface-sunken border border-line">
                <input
                  type="checkbox"
                  id="terms-checkbox"
                  checked={termsAccepted}
                  onChange={(e) => setTermsAccepted(e.target.checked)}
                  className="mt-1 w-4 h-4 rounded"
                  style={{ accentColor: "rgb(var(--brand-700))" }}
                />
                <label
                  htmlFor="terms-checkbox"
                  className="text-sm cursor-pointer text-content-body"
                >
                  I agree to the{" "}
                  <a
                    href={createPageUrl("TermsOfService")}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-semibold underline text-brand-700 hover:text-brand-800"
                    onClick={(e) => e.stopPropagation()}
                  >
                    Terms of Service
                  </a>
                </label>
              </div>

              <div className="flex gap-3 pt-1">
                <button
                  onClick={() => setShowTrialModal(false)}
                  className="flex-1 h-11 rounded-lg font-semibold transition-colors border border-line bg-surface text-content-body hover:bg-surface-sunken hover:text-content"
                >
                  Maybe Later
                </button>
                <button
                  onClick={confirmTrial}
                  disabled={
                    loading === selectedPlanForTrial?.plan.id || !termsAccepted
                  }
                  className="flex-1 h-11 rounded-lg font-bold text-content-inverted transition-colors disabled:opacity-50 bg-brand hover:bg-brand-hover"
                >
                  {loading === selectedPlanForTrial?.plan.id ? (
                    <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                  ) : (
                    "Start Free Trial"
                  )}
                </button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </>
  );
}
