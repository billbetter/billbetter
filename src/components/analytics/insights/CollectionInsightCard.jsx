import React from "react";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import FadeIn from "@/components/analytics/FadeIn";

/** How much of what was invoiced has been collected. */
export default function CollectionInsightCard({
  collectionRate,
  overdueAmount,
  overdueInvoices,
  pendingInvoices,
}) {
  return (
    <FadeIn delay={0.15}>
      <div className="rounded-2xl border border-accent-200/60 dark:border-accent-800/60 bg-accent-50/30 dark:bg-accent-900/20 p-5">
        <div className="flex items-center gap-2 mb-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent-500/10 dark:bg-accent-500/20">
            <CheckCircle2 className="h-4 w-4 text-accent-600 dark:text-accent-400" />
          </div>
          <span className="text-xs font-semibold uppercase tracking-wider text-content-subtle dark:text-content-muted">
            Collections
          </span>
        </div>
        <p className="text-sm text-ink-700 dark:text-ink-300 leading-relaxed">
          {collectionRate >= 80
            ? `Excellent collection rate at ${collectionRate}%. Your invoicing process is working well.`
            : collectionRate >= 50
              ? `Collection rate is ${collectionRate}%. ${pendingInvoices.length} invoices are still pending — consider sending reminders.`
              : `Collection rate is ${collectionRate}%. ${pendingInvoices.length + overdueInvoices.length} invoices need attention. Send a reminder from Get Paid.`}
        </p>
        {overdueAmount > 0 && (
          <div className="mt-3 flex items-center gap-1.5">
            <span className="inline-flex items-center gap-1 rounded-full bg-danger-50 dark:bg-danger-900/50 px-2 py-0.5 text-[11px] font-bold text-danger-700 dark:text-danger-300">
              <AlertCircle className="h-3 w-3" />$
              {overdueAmount.toLocaleString()} overdue
            </span>
          </div>
        )}
        {overdueAmount === 0 && (
          <div className="mt-3 flex items-center gap-1.5">
            <span className="inline-flex items-center gap-1 rounded-full bg-success-50 dark:bg-success-900/50 px-2 py-0.5 text-[11px] font-bold text-success-700 dark:text-success-300">
              <CheckCircle2 className="h-3 w-3" />
              No overdue invoices
            </span>
          </div>
        )}
      </div>
    </FadeIn>
  );
}
