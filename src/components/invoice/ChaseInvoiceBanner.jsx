import React from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { ArrowRight, Sparkles, Zap, AlertCircle } from "lucide-react";

/**
 * Premium upgrade-style banner promoting the Chase Invoice feature.
 * Variants tune copy + accent for different placement contexts.
 */
export default function ChaseInvoiceBanner({
  variant = "default",
  overdueCount = 0,
  outstandingAmount = 0,
  className = "",
  compact = false,
}) {
  const formattedAmount = Number(outstandingAmount || 0).toLocaleString(
    "en-US",
    {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    },
  );

  const copy =
    variant === "urgent"
      ? {
          eyebrow: `${overdueCount} OVERDUE INVOICE${overdueCount === 1 ? "" : "S"}`,
          title: "Recover Overdue Cash Automatically",
          body:
            outstandingAmount > 0
              ? `You have ${formattedAmount} sitting in unpaid invoices. Invoicium AI sends polite, effective reminders so you don't have to.`
              : "Invoicium AI follows up on unpaid invoices for you - polite, persistent, and proven to get you paid.",
          cta: "Start Chasing Now",
        }
      : variant === "analytics"
        ? {
            eyebrow: "CASH FLOW BOOSTER",
            title: "Turn Outstanding Invoices Into Cash",
            body: "See exactly who owes you, run a one-click reminder, and watch overdue dollars come back into your account.",
            cta: "Open Chase Center",
          }
        : variant === "compact"
          ? {
              eyebrow: "GET PAID FASTER",
              title: "Stop Chasing Invoices Manually",
              body: "Let Invoicium AI follow up for you.",
              cta: "Try Chase",
            }
          : {
              eyebrow: "NEW / AI POWERED",
              title: "Get Paid Faster with Chase Invoice",
              body: "Invoicium AI writes polite follow-ups, schedules reminder sequences, and sends them by email + SMS automatically.",
              cta: "Try It Now",
            };

  if (compact) {
    return (
      <Link
        to={createPageUrl("ChaseInvoice")}
        className={`group block ${className}`}
      >
        <div className="relative overflow-hidden rounded-2xl bg-success-700 p-4 sm:p-5 text-content-inverted shadow-lg shadow-success-200/50 dark:shadow-success-900/30 transition-all hover:shadow-xl hover:-translate-y-0.5">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="flex h-10 w-10 sm:h-11 sm:w-11 flex-shrink-0 items-center justify-center rounded-xl bg-surface/15 backdrop-blur-sm ring-1 ring-content-inverted/20 dark:bg-surface-inverted/15">
              <Zap className="h-5 w-5 text-content-inverted" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-widest text-success-100">
                {copy.eyebrow}
              </p>
              <p className="mt-0.5 text-sm sm:text-base font-bold leading-tight truncate">
                {copy.title}
              </p>
            </div>
            <ArrowRight className="h-5 w-5 flex-shrink-0 text-content-inverted transition-transform group-hover:translate-x-1" />
          </div>
        </div>
      </Link>
    );
  }

  return (
    <Link
      to={createPageUrl("ChaseInvoice")}
      className={`group block ${className}`}
      aria-label="Open Chase Invoice"
    >
      <div className="relative overflow-hidden rounded-2xl bg-success-700 p-5 sm:p-7 text-content-inverted shadow-lg shadow-success-200/40 dark:shadow-success-900/30 transition-all hover:shadow-xl hover:-translate-y-0.5">
        {/* Decorative glow */}
        <div className="pointer-events-none absolute -right-12 -top-12 h-48 w-48 rounded-full bg-surface/10 blur-3xl transition-transform duration-500 group-hover:scale-125 dark:bg-surface-inverted/10" />
        <div className="pointer-events-none absolute -bottom-16 -left-12 h-40 w-40 rounded-full bg-accent-300/20 blur-3xl" />

        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-4 min-w-0 flex-1">
            <div className="flex h-11 w-11 sm:h-12 sm:w-12 flex-shrink-0 items-center justify-center rounded-xl bg-surface/15 backdrop-blur-sm ring-1 ring-content-inverted/20 dark:bg-surface-inverted/15">
              {variant === "urgent" ? (
                <AlertCircle className="h-5 w-5 sm:h-6 sm:w-6 text-content-inverted" />
              ) : (
                <Sparkles className="h-5 w-5 sm:h-6 sm:w-6 text-content-inverted" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-bold uppercase tracking-widest text-success-100">
                {copy.eyebrow}
              </p>
              <h3 className="mt-1 text-lg sm:text-xl font-bold tracking-tight leading-tight">
                {copy.title}
              </h3>
              <p className="mt-1.5 text-sm text-success-50/90 leading-relaxed max-w-xl">
                {copy.body}
              </p>
            </div>
          </div>

          <div className="flex sm:flex-shrink-0">
            <span className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-surface px-5 text-sm font-bold text-success-700 shadow-md ring-1 ring-content-inverted/30 transition-all group-hover:bg-success-50 group-hover:shadow-lg w-full sm:w-auto dark:bg-surface-inverted dark:text-success-400 dark:group-hover:bg-success-900/20">
              {copy.cta}
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}
