import React, { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  ArrowLeft,
  CalendarClock,
  CheckCircle,
  Download,
  Loader2,
  Lock,
  RotateCcw,
} from "lucide-react";
import { createPageUrl } from "@/utils";
import { sdk } from "@/api/sdk";
import { Button } from "@/components/ui/button";

/**
 * Cancelling a plan, on our own page.
 *
 * This used to happen entirely on Stripe's hosted billing portal: the customer
 * left Invoicium at the exact moment they were least sure about it, and read
 * what happens next in somebody else's words. Everything factual here comes
 * from stripe-cancel-subscription, which reads the live subscription rather
 * than our copy of it.
 *
 * Two rules this page holds itself to:
 *
 *   1. No date is printed that could not be sourced. The edge function returns
 *      access_until as null when Stripe did not give it one, and every place
 *      the date appears is written to read correctly without it. A confidently
 *      wrong end date is the single worst thing this page could do -- it is
 *      the one fact somebody plans around.
 *
 *   2. No pressure. There is no discount offer, no "are you sure?" second
 *      dialog, no reason-for-leaving form standing between the person and the
 *      button. Keeping the plan is the default-styled action because it is the
 *      reversible one, not to make cancelling awkward -- cancelling is one
 *      click from here and the confirmation says how to undo it.
 */

/** @param {string | null} iso */
function formatDate(iso) {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formatMoney(amount, currency) {
  if (typeof amount !== "number") return null;
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currency || "CAD",
      minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
    }).format(amount);
  } catch {
    // An unexpected currency code should not take the page down.
    return `${amount} ${currency || ""}`.trim();
  }
}

/**
 * No logo lockup in here, deliberately.
 *
 * UpgradeRequired renders its own, and has to: Layout drops the app shell for
 * a blocked account, so without it that page carries no branding at all. This
 * page is the opposite case -- it sits INSIDE the shell, which already shows
 * the mark in the sidebar on desktop and in the header on mobile. Adding a
 * second centred lockup stacked one above the other is what it looked like the
 * first time it was rendered.
 */
function Shell({ children }) {
  return (
    <div className="min-h-screen bg-surface-sunken dark:bg-surface-inverted-deep px-4 py-8 sm:py-12">
      <div className="mx-auto w-full max-w-xl">{children}</div>
    </div>
  );
}

function Card({ children }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-6 shadow-xl dark:border-ink-700 dark:bg-surface-inverted sm:p-8">
      {children}
    </div>
  );
}

export default function CancelSubscription() {
  const navigate = useNavigate();
  const [state, setState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState(null);
  const [justCancelled, setJustCancelled] = useState(false);

  const call = useCallback(async (action) => {
    const { data } = await sdk.functions.invoke("cancelSubscription", {
      action,
    });
    if (!data?.success) {
      throw new Error(
        data?.message ||
          (data?.not_implemented
            ? "Cancelling from here is not available on this deployment yet."
            : data?.error) ||
          "Something went wrong.",
      );
    }
    return data;
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await call("preview");
        if (!cancelled) setState(data.state);
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [call]);

  const act = async (action) => {
    setWorking(true);
    setError(null);
    try {
      const data = await call(action);
      setState(data.state);
      setJustCancelled(action === "cancel");
    } catch (err) {
      setError(err.message);
    } finally {
      setWorking(false);
    }
  };

  if (loading) {
    return (
      <Shell>
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-content-muted dark:text-content-subtle" />
        </div>
      </Shell>
    );
  }

  // Nothing to cancel, or Stripe would not tell us about it. Say what happened
  // and give the one route that still works.
  if (error && !state) {
    return (
      <Shell>
        <Card>
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-warning-100 text-warning-700 dark:bg-warning-900/30 dark:text-warning-300">
            <AlertTriangle className="h-8 w-8" />
          </div>
          <h1 className="mb-3 text-center text-2xl font-black tracking-tight text-content dark:text-content-inverted">
            We couldn&apos;t open your plan
          </h1>
          <p className="mb-8 text-center leading-relaxed text-content-body dark:text-ink-300">
            {error}
          </p>
          <Button
            onClick={() => navigate(createPageUrl("Settings"))}
            className="h-12 w-full rounded-xl bg-brand font-bold text-content-inverted hover:bg-brand-hover"
          >
            Back to Settings
          </Button>
        </Card>
      </Shell>
    );
  }

  const endsOn = formatDate(state?.access_until);
  const price = formatMoney(state?.amount, state?.currency);
  const planName = state?.plan_name
    ? `${state.plan_name.charAt(0).toUpperCase()}${state.plan_name.slice(1)}`
    : "your";
  const scheduled = state?.cancel_at_period_end;

  // ---- Already cancelled, or cancelled a moment ago ----------------------
  if (scheduled) {
    return (
      <Shell>
        <Card>
          <div
            className={`mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl ${
              justCancelled
                ? "bg-success-100 text-success-700 dark:bg-success-900/30 dark:text-success-300"
                : "bg-ink-100 text-ink-700 dark:bg-ink-800 dark:text-ink-200"
            }`}
          >
            {justCancelled ? (
              <CheckCircle className="h-8 w-8" />
            ) : (
              <CalendarClock className="h-8 w-8" />
            )}
          </div>

          <h1 className="mb-3 text-center text-2xl font-black tracking-tight text-content dark:text-content-inverted sm:text-3xl">
            {justCancelled
              ? "Your plan is cancelled"
              : "Your plan is already set to cancel"}
          </h1>

          <p className="mb-8 text-center leading-relaxed text-content-body dark:text-ink-300">
            {endsOn ? (
              <>
                You keep full access until{" "}
                <span className="font-bold text-content dark:text-content-inverted">
                  {endsOn}
                </span>
                . You won&apos;t be charged again.
              </>
            ) : (
              <>
                You keep full access until the end of the period you have
                already paid for. You won&apos;t be charged again.
              </>
            )}
          </p>

          {/* The genuinely useful thing to say here. A cancelled account cannot
              open its own invoices -- that is what the paywall does -- so the
              time to download anything is now, while the plan is still live. */}
          <div className="mb-8 flex items-start gap-3 rounded-xl border border-line bg-surface-sunken p-4 dark:border-ink-700 dark:bg-ink-800/50">
            <Download className="mt-0.5 h-4 w-4 flex-shrink-0 text-content-body dark:text-content-subtle" />
            <p className="text-sm leading-relaxed text-content-body dark:text-content-subtle">
              Nothing is deleted, but you won&apos;t be able to open your
              invoices once the plan ends. If you need PDFs of anything,{" "}
              <Link
                to={createPageUrl("Invoices")}
                className="font-semibold text-brand-700 underline dark:text-brand-300"
              >
                download them now
              </Link>
              .
            </p>
          </div>

          {error ? (
            <p className="mb-4 text-center text-sm font-medium text-danger-600 dark:text-danger-400">
              {error}
            </p>
          ) : null}

          <Button
            onClick={() => act("resume")}
            disabled={working}
            className="h-12 w-full rounded-xl bg-brand font-bold text-content-inverted shadow-lg shadow-brand-600/20 hover:bg-brand-hover"
          >
            {working ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RotateCcw className="mr-2 h-4 w-4" />
            )}
            Changed your mind? Keep my plan
          </Button>

          <button
            type="button"
            onClick={() => navigate(createPageUrl("Settings"))}
            className="mt-4 w-full text-sm font-medium text-content-muted transition-colors hover:text-content dark:text-content-subtle dark:hover:text-content-inverted"
          >
            Back to Settings
          </button>
        </Card>

        <p className="mt-6 text-center text-xs text-content-muted dark:text-content-subtle">
          Something not right?{" "}
          <a
            href="mailto:support@invoicium.ca"
            className="font-semibold text-brand-700 hover:underline dark:text-brand-300"
          >
            support@invoicium.ca
          </a>
        </p>
      </Shell>
    );
  }

  // ---- The decision -------------------------------------------------------
  return (
    <Shell>
      <Link
        to={createPageUrl("Settings")}
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-content-muted transition-colors hover:text-content dark:text-content-subtle dark:hover:text-content-inverted"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Settings
      </Link>

      <Card>
        <h1 className="mb-3 text-2xl font-black tracking-tight text-content dark:text-content-inverted sm:text-3xl">
          Cancel {planName} plan?
        </h1>
        <p className="mb-6 leading-relaxed text-content-body dark:text-ink-300">
          {price && state?.interval
            ? `You're on ${planName} at ${price} a ${state.interval}. Here's exactly what happens if you cancel.`
            : "Here's exactly what happens if you cancel."}
        </p>

        <ul className="mb-8 space-y-4">
          <li className="flex items-start gap-3">
            <span className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-success-100 text-success-700 dark:bg-success-900/30 dark:text-success-300">
              <CalendarClock className="h-4 w-4" />
            </span>
            <div>
              <p className="font-semibold text-content dark:text-content-inverted">
                {endsOn ? `You keep using Invoicium until ${endsOn}` : "You keep using Invoicium until the end of this period"}
              </p>
              <p className="text-sm text-content-body dark:text-content-subtle">
                You&apos;ve paid for it, so you keep it. Nothing changes today.
              </p>
            </div>
          </li>
          <li className="flex items-start gap-3">
            <span className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-success-100 text-success-700 dark:bg-success-900/30 dark:text-success-300">
              <CheckCircle className="h-4 w-4" />
            </span>
            <div>
              <p className="font-semibold text-content dark:text-content-inverted">
                No more charges
              </p>
              <p className="text-sm text-content-body dark:text-content-subtle">
                That&apos;s the last payment. We won&apos;t bill the card again.
              </p>
            </div>
          </li>
          <li className="flex items-start gap-3">
            <span className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-ink-100 text-ink-700 dark:bg-ink-800 dark:text-ink-200">
              <Lock className="h-4 w-4" />
            </span>
            <div>
              <p className="font-semibold text-content dark:text-content-inverted">
                After that, the app locks — but nothing is deleted
              </p>
              <p className="text-sm text-content-body dark:text-content-subtle">
                Your invoices, clients, quotes and job photos stay exactly as
                they are. Resubscribe any time and they all come back. Download
                anything you need before then.
              </p>
            </div>
          </li>
        </ul>

        {error ? (
          <p className="mb-4 text-sm font-medium text-danger-600 dark:text-danger-400">
            {error}
          </p>
        ) : null}

        <div className="flex flex-col gap-3">
          <Button
            onClick={() => navigate(createPageUrl("Settings"))}
            disabled={working}
            className="h-12 w-full rounded-xl bg-brand font-bold text-content-inverted shadow-lg shadow-brand-600/20 hover:bg-brand-hover"
          >
            Keep my plan
          </Button>
          <Button
            variant="outline"
            onClick={() => act("cancel")}
            disabled={working}
            className="h-12 w-full rounded-xl border-line font-semibold text-content-body hover:bg-surface-sunken dark:border-ink-700 dark:text-ink-300 dark:hover:bg-ink-800"
          >
            {working ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Cancel {planName} plan
          </Button>
        </div>
      </Card>

      <p className="mt-6 text-center text-xs text-content-muted dark:text-content-subtle">
        Cancelling for a reason we could fix?{" "}
        <a
          href="mailto:support@invoicium.ca"
          className="font-semibold text-brand-700 hover:underline dark:text-brand-300"
        >
          Tell us
        </a>{" "}
        — no obligation either way.
      </p>
    </Shell>
  );
}
