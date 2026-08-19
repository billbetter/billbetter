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

function CheckoutForm({ planId, cycle, isTrial }) {
  const stripe = useStripe();
  const elements = useElements();
  const navigate = useNavigate();

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const amount = getAmount(planId, cycle);

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
      });

      const data = response?.data || {};
      if (data.success === false || data.error) {
        throw new Error(data.error || "Could not start checkout.");
      }

      const clientSecret = data.client_secret;
      const subscriptionId = data.subscription_id;
      if (!clientSecret) throw new Error("Could not start checkout.");

      const card = elements.getElement(CardNumberElement);

      // A trial charges nothing today, so the card is saved through a
      // SetupIntent instead. Both calls present any 3DS challenge themselves.
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
      // access -- this page's word for it is never enough.
      const activation = await sdk.functions.invoke("confirmAndActivate", {
        subscription_id: subscriptionId,
      });
      if (activation?.data?.error) throw new Error(activation.data.error);

      navigate(
        `${createPageUrl("PaymentSuccess")}?plan=${encodeURIComponent(
          planId,
        )}&cycle=${encodeURIComponent(cycle)}`,
      );
    } catch (err) {
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
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
            {isTrial
              ? `Start ${TRIAL_DAYS}-day trial`
              : `Subscribe — $${amount} ${CURRENCY}/${
                  cycle === "yearly" ? "yr" : "mo"
                }`}
          </>
        )}
      </button>

      <p className="text-center text-xs text-ink-500 dark:text-ink-400">
        {isTrial
          ? `You will not be charged until your ${TRIAL_DAYS}-day trial ends. Cancel anytime before then.`
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
        if (active) setUser(me);
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
            <div className="mt-4 flex items-baseline gap-1">
              <span className="text-4xl font-bold text-brand-700 dark:text-brand-400">
                ${amount}
              </span>
              <span className="text-ink-500 dark:text-ink-400">
                {CURRENCY} {perLabel}
              </span>
            </div>

            {isTrial && (
              <div className="mt-4 rounded-lg bg-brand-50 px-4 py-3 text-sm font-medium text-brand-800 dark:bg-brand-950/40 dark:text-brand-200">
                {TRIAL_DAYS} days free, then ${amount} {CURRENCY} {perLabel}
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
              <CheckoutForm planId={planId} cycle={cycle} isTrial={isTrial} />
            </Elements>
          </section>
        </div>
      </div>
    </div>
  );
}
