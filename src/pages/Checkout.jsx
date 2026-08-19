import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  CardNumberElement,
  CardExpiryElement,
  CardCvcElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import {
  Loader2,
  Lock,
  ShieldCheck,
  ArrowLeft,
  CheckCircle2,
  RefreshCw,
  Tag,
  X,
} from "lucide-react";
import { sdk } from "@/api/sdk";
import { createPageUrl } from "@/utils";
import {
  getPlan,
  getPriceId,
  getAmount,
  TRIAL_DAYS,
  CURRENCY,
} from "@/config/plans";

const publishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;

// Memoised outside the component so a re-render never refetches Stripe.js.
// A missing key would throw inside loadStripe, so guard it and let the page
// render a configuration error rather than a blank screen.
const stripePromise = publishableKey ? loadStripe(publishableKey) : null;

// Statuses that mean the user is holding a plan right now. Buying another one
// replaces it -- one plan per account -- so checkout has to say so up front.
// Mirrors REPLACEABLE in stripe-create-subscription.
const REPLACEABLE = ["active", "trial", "trialing", "past_due"];

// Card fields are Stripe-hosted iframes and cannot inherit the page's CSS.
// These mirror the tokens in index.css: ink-900 text, ink-500 placeholder,
// danger red for invalid input.
const ELEMENT_STYLE = {
  base: {
    color: "rgb(15 23 42)",
    fontFamily:
      'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
    fontSize: "16px",
    fontSmoothing: "antialiased",
    "::placeholder": { color: "rgb(100 116 139)" },
  },
  invalid: {
    color: "rgb(220 38 38)",
    iconColor: "rgb(220 38 38)",
  },
};

const titleCase = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : "");

function discountLabel(promo) {
  const off = promo.percent_off
    ? `${promo.percent_off}% off`
    : `$${promo.amount_off} ${promo.currency} off`;

  if (promo.duration === "forever") return `${off} every payment`;
  if (promo.duration === "repeating" && promo.duration_in_months) {
    return `${off} for ${promo.duration_in_months} months`;
  }
  return `${off} your first payment`;
}

const FieldShell = ({ label, htmlFor, children }) => (
  <div className="space-y-1.5">
    <label
      htmlFor={htmlFor}
      className="block text-sm font-medium text-ink-700 dark:text-ink-200"
    >
      {label}
    </label>
    <div className="rounded-lg border border-ink-200 bg-white px-3 py-3 transition focus-within:border-brand-600 focus-within:ring-2 focus-within:ring-brand-600/20 dark:border-ink-700 dark:bg-ink-900">
      {children}
    </div>
  </div>
);

function PromoField({ amount, promo, onApply, onRemove, disabled }) {
  const [code, setCode] = useState("");
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState(null);

  const check = async () => {
    if (!code.trim() || checking) return;
    setChecking(true);
    setError(null);
    try {
      // Validated server-side: the discount that actually bills is resolved
      // again from this code when the subscription is created, so what the page
      // shows here can never differ from what Stripe charges.
      const response = await sdk.functions.invoke("stripeValidatePromo", {
        code: code.trim(),
        amount,
        currency: CURRENCY,
      });
      const data = response?.data || {};
      if (data.success === false || data.error) {
        throw new Error(data.error || "Could not check that code.");
      }
      if (!data.valid) {
        setError(data.reason || "That promo code is not valid.");
        return;
      }
      onApply(data);
      setCode("");
    } catch (err) {
      setError(err.message || "Could not check that code.");
    } finally {
      setChecking(false);
    }
  };

  if (promo) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-lg border border-success-200 bg-success-50 px-4 py-3 dark:border-success-800 dark:bg-success-950/40">
        <div className="flex items-center gap-2 text-sm">
          <Tag className="h-4 w-4 flex-shrink-0 text-success-600" />
          <span className="font-semibold text-success-800 dark:text-success-200">
            {promo.code}
          </span>
          <span className="text-success-700 dark:text-success-300">
            — {discountLabel(promo)}
          </span>
        </div>
        <button
          type="button"
          onClick={onRemove}
          disabled={disabled}
          aria-label={`Remove promo code ${promo.code}`}
          className="rounded p-1 text-success-700 transition hover:bg-success-100 disabled:opacity-50 dark:text-success-300 dark:hover:bg-success-900/40"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <label
        htmlFor="promo-code"
        className="block text-sm font-medium text-ink-700 dark:text-ink-200"
      >
        Promo code <span className="font-normal text-ink-500">(optional)</span>
      </label>
      <div className="flex gap-2">
        <input
          id="promo-code"
          type="text"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          value={code}
          disabled={disabled}
          onChange={(e) => {
            setCode(e.target.value);
            if (error) setError(null);
          }}
          // Enter would otherwise submit the card form before the discount is
          // applied, charging full price.
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              check();
            }
          }}
          placeholder="Enter code"
          className="flex-1 rounded-lg border border-ink-200 bg-white px-3 py-3 text-base uppercase text-ink-900 placeholder:normal-case placeholder:text-ink-500 transition focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-600/20 disabled:opacity-60 dark:border-ink-700 dark:bg-ink-900 dark:text-white"
        />
        <button
          type="button"
          onClick={check}
          disabled={disabled || checking || !code.trim()}
          className="rounded-lg border border-ink-200 px-4 py-3 text-sm font-semibold text-ink-700 transition hover:bg-ink-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-ink-700 dark:text-ink-200 dark:hover:bg-ink-800"
        >
          {checking ? <Loader2 className="h-4 w-4 animate-spin" /> : "Apply"}
        </button>
      </div>
      {error && (
        <p role="alert" className="text-sm text-danger-600 dark:text-danger-400">
          {error}
        </p>
      )}
    </div>
  );
}

function CheckoutForm({ planId, cycle, isTrial, promo, onApplyPromo, onRemovePromo, replacing }) {
  const stripe = useStripe();
  const elements = useElements();
  const navigate = useNavigate();

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const listPrice = getAmount(planId, cycle);
  const dueToday =
    promo && promo.discounted_amount != null ? promo.discounted_amount : listPrice;

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!stripe || !elements || submitting) return;

    setSubmitting(true);
    setError(null);

    try {
      const priceId = getPriceId(planId, cycle);
      if (!priceId) throw new Error("That plan is no longer available.");

      const response = await sdk.functions.invoke("stripeCreateSubscription", {
        price_id: priceId,
        plan_name: planId,
        billing_cycle: cycle,
        is_trial: isTrial,
        promo_code: promo?.code || null,
      });

      const data = response?.data || {};
      if (data.success === false || data.error) {
        throw new Error(data.error || "Could not start checkout.");
      }

      const clientSecret = data.client_secret;
      const subscriptionId = data.subscription_id;
      if (!clientSecret) throw new Error("Could not start checkout.");

      const card = elements.getElement(CardNumberElement);

      // Nothing due today -- a trial, or a discount that covers the whole first
      // invoice -- means the card is saved through a SetupIntent instead, so it
      // is on file when the subscription bills for real. Both calls present any
      // 3DS challenge themselves.
      const result =
        data.mode === "setup"
          ? await stripe.confirmCardSetup(clientSecret, {
              payment_method: { card },
            })
          : await stripe.confirmCardPayment(clientSecret, {
              payment_method: { card },
            });

      if (result.error) {
        throw new Error(result.error.message || "Your card was declined.");
      }

      // Stripe is satisfied. Have the server re-read the subscription and grant
      // access -- this page's word for it is never enough. The same call
      // refunds and cancels the plan being replaced, once this one is paid.
      const activation = await sdk.functions.invoke("confirmAndActivate", {
        subscription_id: subscriptionId,
      });
      if (activation?.data?.error) throw new Error(activation.data.error);

      // Straight to the dashboard. PaymentSuccess exists to confirm a hosted
      // Checkout session, and by this point activation has already happened
      // above -- landing there would only show a countdown, and without a
      // session_id in the URL it reports "No session ID found" as an error on
      // a payment that succeeded.
      //
      // from=payment tells Layout this is a post-purchase load, so it retries
      // the subscription lookup if replication has not caught up yet.
      navigate(`${createPageUrl("Dashboard")}?from=payment`);
    } catch (err) {
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const buttonLabel = () => {
    if (isTrial) return `Start ${TRIAL_DAYS}-day trial`;
    if (dueToday === 0) return "Complete signup — $0 today";
    return `Subscribe — $${dueToday} ${CURRENCY}${
      promo ? " today" : `/${cycle === "yearly" ? "yr" : "mo"}`
    }`;
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <FieldShell label="Card number" htmlFor="card-number">
        <CardNumberElement
          id="card-number"
          options={{ style: ELEMENT_STYLE, showIcon: true }}
        />
      </FieldShell>

      <div className="grid grid-cols-2 gap-4">
        <FieldShell label="Expiry" htmlFor="card-expiry">
          <CardExpiryElement
            id="card-expiry"
            options={{ style: ELEMENT_STYLE }}
          />
        </FieldShell>
        <FieldShell label="CVC" htmlFor="card-cvc">
          <CardCvcElement id="card-cvc" options={{ style: ELEMENT_STYLE }} />
        </FieldShell>
      </div>

      <PromoField
        amount={listPrice}
        promo={promo}
        onApply={onApplyPromo}
        onRemove={onRemovePromo}
        disabled={submitting}
      />

      {error && (
        <div
          role="alert"
          className="rounded-lg border border-danger-200 bg-danger-50 px-4 py-3 text-sm text-danger-700 dark:border-danger-800 dark:bg-danger-950/40 dark:text-danger-300"
        >
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={!stripe || submitting}
        className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-brand-700 px-5 py-3.5 text-base font-semibold text-white shadow-sm transition hover:bg-brand-800 focus:outline-none focus:ring-2 focus:ring-brand-600 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {submitting ? (
          <>
            <Loader2 className="h-5 w-5 animate-spin" />
            Processing...
          </>
        ) : (
          <>
            <Lock className="h-4 w-4" />
            {buttonLabel()}
          </>
        )}
      </button>

      <p className="text-center text-xs text-ink-500 dark:text-ink-400">
        {isTrial
          ? `You will not be charged until your ${TRIAL_DAYS}-day trial ends. Cancel anytime before then.`
          : replacing
            ? `Your ${titleCase(replacing.plan_name)} plan is refunded and cancelled as soon as this payment goes through.`
            : "You can cancel anytime from Settings."}{" "}
        Payments are processed securely by Stripe.
      </p>
      <p className="sr-only" aria-live="polite">
        {submitting ? "Processing your payment" : ""}
      </p>
    </form>
  );
}

export default function Checkout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState(null);
  const [currentSub, setCurrentSub] = useState(null);
  const [promo, setPromo] = useState(null);
  const [checkingUser, setCheckingUser] = useState(true);

  const params = new URLSearchParams(location.search);
  const planId = (params.get("plan") || "").toLowerCase();
  const cycle = params.get("cycle") === "yearly" ? "yearly" : "monthly";
  const isTrial = params.get("trial") === "1";

  const plan = useMemo(() => getPlan(planId), [planId]);
  const amount = getAmount(planId, cycle);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const me = await sdk.auth.me();
        if (!active) return;
        setUser(me);

        // Checkout has to know what plan is being replaced before the card is
        // entered, not after -- a switch refunds and cancels the old one.
        const rows = await sdk.entities.Subscription.filter({ user_id: me.id });
        if (active) setCurrentSub(rows?.[0] || null);
      } catch {
        // Checkout needs an account to attach the subscription to.
        await sdk.auth.redirectToLogin(location.pathname + location.search);
        return;
      } finally {
        if (active) setCheckingUser(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [location.pathname, location.search]);

  const heldPlan =
    currentSub &&
    REPLACEABLE.includes(currentSub.status) &&
    currentSub.stripe_subscription_id
      ? currentSub
      : null;
  const isSamePlan =
    heldPlan &&
    heldPlan.plan_name === planId &&
    heldPlan.billing_cycle === cycle;
  const replacing = heldPlan && !isSamePlan ? heldPlan : null;

  const dueToday = promo && promo.discounted_amount != null ? promo.discounted_amount : amount;

  if (!plan) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center px-4">
        <div className="space-y-4 text-center">
          <h1 className="text-2xl font-semibold text-ink-900 dark:text-white">
            Plan not found
          </h1>
          <p className="text-ink-600 dark:text-ink-300">
            That plan is no longer available. Pick one from our pricing page.
          </p>
          <button
            onClick={() => navigate(createPageUrl("Pricing"))}
            className="inline-flex items-center gap-2 rounded-lg bg-brand-700 px-5 py-2.5 font-semibold text-white hover:bg-brand-800"
          >
            View plans
          </button>
        </div>
      </div>
    );
  }

  if (!stripePromise) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center px-4">
        <div
          role="alert"
          className="max-w-md rounded-xl border border-danger-200 bg-danger-50 p-6 text-center dark:border-danger-800 dark:bg-danger-950/40"
        >
          <h1 className="text-lg font-semibold text-danger-800 dark:text-danger-200">
            Checkout unavailable
          </h1>
          <p className="mt-2 text-sm text-danger-700 dark:text-danger-300">
            Payments are not configured for this environment. Please contact
            support so we can get you set up.
          </p>
        </div>
      </div>
    );
  }

  if (checkingUser || !user) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-brand-700" />
      </div>
    );
  }

  const perLabel = cycle === "yearly" ? "per year" : "per month";

  // Paying again for the plan you are already on would take money for nothing,
  // so this stops before the card form rather than at the server's 409.
  if (isSamePlan) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center px-4">
        <div className="max-w-md space-y-4 text-center">
          <CheckCircle2 className="mx-auto h-10 w-10 text-success-600" />
          <h1 className="text-2xl font-semibold text-ink-900 dark:text-white">
            You are already on {plan.name}
          </h1>
          <p className="text-ink-600 dark:text-ink-300">
            This is your current plan, billed {cycle}. Pick a different plan if
            you want to switch, or manage this one from Settings.
          </p>
          <div className="flex justify-center gap-3">
            <button
              onClick={() => navigate(createPageUrl("Pricing"))}
              className="inline-flex items-center gap-2 rounded-lg bg-brand-700 px-5 py-2.5 font-semibold text-white hover:bg-brand-800"
            >
              View plans
            </button>
            <button
              onClick={() => navigate(createPageUrl("Settings"))}
              className="inline-flex items-center gap-2 rounded-lg border border-ink-200 px-5 py-2.5 font-semibold text-ink-700 hover:bg-ink-50 dark:border-ink-700 dark:text-ink-200 dark:hover:bg-ink-800"
            >
              Manage subscription
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[70vh] px-4 py-10">
      <div className="mx-auto max-w-4xl">
        <button
          onClick={() => navigate(createPageUrl("Pricing"))}
          className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-ink-600 transition hover:text-brand-700 dark:text-ink-300"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to plans
        </button>

        <div className="grid gap-6 lg:grid-cols-5">
          <aside className="rounded-2xl border border-ink-200 bg-white p-6 shadow-sm lg:col-span-2 dark:border-ink-800 dark:bg-ink-900">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-500 dark:text-ink-400">
              Your plan
            </h2>
            <div className="mt-3 text-2xl font-bold text-ink-900 dark:text-white">
              {plan.name}
            </div>
            <div className="mt-4 flex items-baseline gap-2">
              {promo && dueToday !== amount && (
                <span className="text-xl font-semibold text-ink-400 line-through dark:text-ink-500">
                  ${amount}
                </span>
              )}
              <span className="text-4xl font-bold text-brand-700 dark:text-brand-400">
                ${dueToday}
              </span>
              <span className="text-ink-500 dark:text-ink-400">
                {/* A trial charges nothing today, so a discount there applies
                    to the first real invoice, not to "today". */}
                {CURRENCY} {promo && !isTrial ? "today" : perLabel}
              </span>
            </div>

            {promo && (
              <p className="mt-2 text-sm font-medium text-success-700 dark:text-success-300">
                {promo.code} — {discountLabel(promo)}
                {promo.duration !== "forever" && (
                  <span className="block font-normal text-ink-500 dark:text-ink-400">
                    Then ${amount} {CURRENCY} {perLabel}.
                  </span>
                )}
              </p>
            )}

            {isTrial && (
              <div className="mt-4 rounded-lg bg-brand-50 px-4 py-3 text-sm font-medium text-brand-800 dark:bg-brand-950/40 dark:text-brand-200">
                {TRIAL_DAYS} days free, then ${dueToday} {CURRENCY} {perLabel}
              </div>
            )}

            {replacing && (
              <div className="mt-4 rounded-lg border border-brand-200 bg-brand-50 px-4 py-3 dark:border-brand-800 dark:bg-brand-950/40">
                <div className="flex items-center gap-2 text-sm font-semibold text-brand-800 dark:text-brand-200">
                  <RefreshCw className="h-4 w-4 flex-shrink-0" />
                  Replacing {titleCase(replacing.plan_name)}
                </div>
                <p className="mt-1.5 text-sm text-brand-700 dark:text-brand-300">
                  You can only hold one plan at a time. Once this payment goes
                  through, your {titleCase(replacing.plan_name)} plan is
                  cancelled and your last payment for it is refunded.
                </p>
              </div>
            )}

            <ul className="mt-6 space-y-2.5 text-sm text-ink-700 dark:text-ink-300">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-success-600" />
                {plan.transactions} transactions per month
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-success-600" />
                Cancel anytime
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-success-600" />
                Billed in {CURRENCY}
              </li>
            </ul>
          </aside>

          <section className="rounded-2xl border border-ink-200 bg-white p-6 shadow-sm sm:p-8 lg:col-span-3 dark:border-ink-800 dark:bg-ink-900">
            <div className="mb-6">
              <h1 className="text-xl font-bold text-ink-900 dark:text-white">
                Payment details
              </h1>
              <p className="mt-1 flex items-center gap-1.5 text-sm text-ink-500 dark:text-ink-400">
                <ShieldCheck className="h-4 w-4 text-success-600" />
                Encrypted and processed by Stripe. We never see your card
                number.
              </p>
            </div>

            <Elements stripe={stripePromise}>
              <CheckoutForm
                planId={planId}
                cycle={cycle}
                isTrial={isTrial}
                promo={promo}
                onApplyPromo={setPromo}
                onRemovePromo={() => setPromo(null)}
                replacing={replacing}
              />
            </Elements>
          </section>
        </div>
      </div>
    </div>
  );
}
