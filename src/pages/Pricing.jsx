import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import {
  listPlans,
  getAmount,
  yearlySavingPercent,
  TRIAL_DAYS,
  STRIPE_PROCESSING,
} from "@/config/plans";
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

  const handleCheckout = async (plan, cycle) => {
    if (plan.id === "custom") {
      navigate(createPageUrl("Contact"));
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

  // Cards are generated from config/plans.js. This page used to keep its own
  // copy of every price, limit and bullet, which is how it drifted out of step
  // with what Stripe actually charged. The only thing added here is the icon
  // component, since the config stores an icon by name to stay dependency-free.
  const ICONS = { Sparkles, TrendingUp, Zap, Crown, Building2 };

  const plans = listPlans().map((plan) => ({
    ...plan,
    icon: ICONS[plan.icon] || Sparkles,
    monthlyPrice: getAmount(plan.id, "monthly"),
    yearlyPrice: getAmount(plan.id, "yearly"),
    cta: plan.id === "custom" ? "Contact Sales" : "Start Free Trial",
  }));

  const savingPercent = yearlySavingPercent();

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
              Start small, scale as you grow. Every plan includes a {TRIAL_DAYS}-day
              free trial with no credit card required.
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
                  Save {savingPercent}%
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
                          <span>
                            {plan.transactions === -1
                              ? "Unlimited transactions"
                              : `${plan.transactions} transactions/month`}
                          </span>
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
                    {!currentSubscription ||
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
                              Start {TRIAL_DAYS}-Day Free Trial
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
              { icon: CheckCircle, text: `${TRIAL_DAYS}-Day Free Trial` },
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
                  a: "Each invoice or quote you create counts as one transaction. For example, if you send 70 invoices and 30 quotes in a month, that's 100 transactions total. Reminders, payments and job photos don't count.",
                },
                {
                  q: "How do I know which plan I need?",
                  a: "Count the invoices and quotes you send in a typical month. Core covers 30, Essential 100, Professional 300, Enterprise 750. If you're on the boundary, start lower — upgrading takes effect immediately and the cost per transaction drops every time you move up.",
                },
                {
                  q: "Can I change plans at any time?",
                  a: "Absolutely. You can upgrade or downgrade at any time. When upgrading, you get immediate access to the new features and limits. When downgrading, changes take effect at your next billing cycle.",
                },
                {
                  q: "What happens if I exceed my transaction limit?",
                  a: "When you reach your monthly limit you'll need to move up a plan to keep creating invoices and quotes. There are no overage charges and no way to accidentally run up a bill — you simply upgrade.",
                },
                {
                  q: "What's the platform fee?",
                  a: `When a client pays you through Stripe we take a small platform fee on top of Stripe's own processing (${STRIPE_PROCESSING} per transaction). That fee is 1% on Core and Essential, 0.75% on Professional and 0.5% on Enterprise — so the more you process, the less we take.`,
                },
                {
                  q: "Is there a setup fee or hidden costs?",
                  a: "No setup fees, no hidden costs, no overage fees. You pay your subscription, plus the platform and Stripe fees above only when you actually get paid online.",
                },
                {
                  q: "Do you offer refunds?",
                  a: `We offer a ${TRIAL_DAYS}-day free trial so you can test everything risk-free. After subscribing you can cancel anytime and won't be charged for future billing periods.`,
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
                    `${TRIAL_DAYS} days completely free`,
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
