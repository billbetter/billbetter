import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Lock, CreditCard, AlertTriangle, Clock, LogOut } from "lucide-react";
import { createPageUrl } from "@/utils";
import { sdk } from "@/api/sdk";
import { supabase } from "@/api/supabaseClient";
import { Button } from "@/components/ui/button";
import { accessState, hasAppAccess } from "@/lib/access";

/**
 * The billing screen shown to every blocked user.
 *
 * This used to be a per-feature upsell ("X needs a higher plan"). There is no
 * free tier and no partial access any more, so it is now the whole blocked
 * experience: what happened, and the one action that fixes it.
 *
 * Deliberately shows NO business data -- no invoice counts, no client names,
 * no dashboard figures. A blocked account is closed, not previewed. Layout
 * renders this page without the app shell for the same reason: the sidebar
 * would be a list of things they cannot open.
 */

const COPY = {
  trial_expired: {
    icon: Clock,
    tone: "warning",
    title: "Your free trial has ended",
    body: "Your trial period is over. Choose a plan to pick up exactly where you left off — your invoices, clients and settings are all still here.",
    cta: "Choose a plan",
  },
  past_due: {
    icon: AlertTriangle,
    tone: "danger",
    title: "Your last payment didn't go through",
    body: "We couldn't charge your card. Update your payment details and access comes back straight away. Nothing has been deleted.",
    cta: "Update payment method",
  },
  canceled: {
    icon: Lock,
    tone: "ink",
    title: "Your subscription was cancelled",
    body: "Your account is closed for now. Your data is still safe — resubscribe any time and everything comes back as it was.",
    cta: "Resubscribe",
  },
  no_subscription: {
    icon: CreditCard,
    tone: "brand",
    title: "Choose a plan to get started",
    body: "Invoicium needs an active plan to use. Pick one below and you'll be invoicing in a couple of minutes.",
    cta: "See plans",
  },
};

const TONES = {
  warning:
    "bg-warning-100 text-warning-700 dark:bg-warning-900/30 dark:text-warning-300",
  danger:
    "bg-danger-100 text-danger-700 dark:bg-danger-900/30 dark:text-danger-300",
  ink: "bg-ink-100 text-ink-700 dark:bg-ink-800 dark:text-ink-200",
  brand: "bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300",
};

export default function UpgradeRequired() {
  const navigate = useNavigate();
  const [state, setState] = useState(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const user = await sdk.auth.me();
        if (!user) {
          sdk.auth.redirectToLogin("/UpgradeRequired");
          return;
        }
        const rows = await sdk.entities.Subscription.filter({
          user_id: user.id,
        });
        const sub = rows.length ? rows[0] : null;
        if (cancelled) return;

        // Paid while this page was open, or landed here by mistake.
        if (hasAppAccess(sub)) {
          navigate(createPageUrl("Dashboard"), { replace: true });
          return;
        }
        setState(accessState(sub));
      } catch {
        // Reading the subscription is the only thing this page needs. If that
        // fails, still show the paywall rather than a broken screen.
        if (!cancelled) setState("no_subscription");
      } finally {
        if (!cancelled) setChecking(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  if (checking) {
    return (
      <div className="min-h-screen bg-surface-sunken dark:bg-surface-inverted-deep flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-line dark:border-ink-700 border-t-brand rounded-full animate-spin" />
      </div>
    );
  }

  const copy = COPY[state] || COPY.no_subscription;
  const Icon = copy.icon;

  return (
    <div className="min-h-screen bg-surface-sunken dark:bg-surface-inverted-deep flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <div className="flex items-center justify-center gap-2.5 mb-8">
          <img src="/logo-icon.png" alt="" className="h-9 w-9 object-contain" />
          <span className="text-lg font-black tracking-tight text-content dark:text-content-inverted">
            Invoicium
          </span>
        </div>

        <div className="bg-surface dark:bg-surface-inverted border border-line dark:border-ink-700 rounded-2xl shadow-xl p-8 sm:p-10 text-center">
          <div
            className={`w-16 h-16 mx-auto mb-6 rounded-2xl flex items-center justify-center ${TONES[copy.tone]}`}
          >
            <Icon className="w-8 h-8" />
          </div>

          <h1 className="text-2xl sm:text-3xl font-black text-content dark:text-content-inverted mb-3 tracking-tight">
            {copy.title}
          </h1>
          <p className="text-content-body dark:text-ink-300 leading-relaxed mb-8">
            {copy.body}
          </p>

          <Button
            onClick={() => navigate(createPageUrl("Pricing"))}
            className="w-full h-12 rounded-xl bg-brand hover:bg-brand-hover text-content-inverted font-bold shadow-lg shadow-brand-600/20"
          >
            {copy.cta}
          </Button>

          <button
            type="button"
            onClick={async () => {
              await supabase.auth.signOut();
              window.location.href = "/";
            }}
            className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-content-muted dark:text-content-subtle hover:text-content dark:hover:text-content-inverted transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sign out
          </button>
        </div>

        <p className="text-center text-xs text-content-muted dark:text-content-subtle mt-6">
          Questions?{" "}
          <a
            href="mailto:support@invoicium.ca"
            className="text-brand-700 dark:text-brand-300 hover:underline font-semibold"
          >
            support@invoicium.ca
          </a>
        </p>
      </div>
    </div>
  );
}
