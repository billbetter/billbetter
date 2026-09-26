import React from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { ArrowRight, Sparkles, Zap, AlertCircle } from "lucide-react";
import { formatMoney } from "@/lib/money";

/**
 * Premium upgrade-style banner promoting the Chase Invoice feature.
 * Variants tune copy + accent for different placement contexts.
 */
export default function ChaseInvoiceBanner({
  variant = "default",
  currency,
  overdueCount = 0,
  outstandingAmount = 0,
  className = "",
  compact = false,
}) {
  const formattedAmount = formatMoney(outstandingAmount, currency, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });

  const copy =
    variant === "urgent"
      ? {
          eyebrow: `${overdueCount} OVERDUE INVOICE${overdueCount === 1 ? "" : "S"}`,
          title: "Recover Overdue Cash Faster",
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
              body: "Invoicium writes the follow-up for you — friendly, professional or firm — ready to send by email or SMS in one tap.",
              cta: "Try It Now",
            };

  if (compact) {
    return (
      <Link
        to={createPageUrl("ChaseInvoice")}
        className={`group block ${className}`}
      >
        <div className="rounded-xl border bg-card surface-gradient p-4 text-card-foreground shadow-sm transition-shadow group-hover:shadow-md sm:p-5">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="flex size-10 flex-shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Zap className="size-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                {copy.eyebrow}
              </p>
              <p className="mt-0.5 truncate text-sm font-semibold leading-tight sm:text-base">
                {copy.title}
              </p>
            </div>
            <ArrowRight className="size-5 flex-shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1" />
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
      <div className="rounded-xl border bg-card surface-gradient p-5 text-card-foreground shadow-sm transition-shadow group-hover:shadow-md sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 flex-1 items-start gap-4">
            <div
              className={`flex size-10 flex-shrink-0 items-center justify-center rounded-lg ${
                variant === "urgent"
                  ? "bg-destructive/10 text-destructive"
                  : "bg-primary text-primary-foreground"
              }`}
            >
              {variant === "urgent" ? <AlertCircle className="size-5" /> : <Sparkles className="size-5" />}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                {copy.eyebrow}
              </p>
              <h3 className="mt-1 text-base font-semibold leading-tight tracking-tight sm:text-lg">
                {copy.title}
              </h3>
              <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-muted-foreground">
                {copy.body}
              </p>
            </div>
          </div>

          <div className="flex sm:flex-shrink-0">
            <span className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow-sm transition-colors group-hover:bg-primary/90 sm:w-auto">
              {copy.cta}
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}
