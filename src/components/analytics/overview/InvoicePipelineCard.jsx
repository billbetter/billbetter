import React from "react";
import { CheckCircle2, Receipt } from "lucide-react";
import FadeIn from "@/components/analytics/FadeIn";
import StatusPill from "@/components/analytics/StatusPill";
import { motion } from "framer-motion";

/** Paid, pending and overdue invoices: a proportional bar and a pill for each. */
export default function InvoicePipelineCard({
  collectionRate,
  overdueAmount,
  overdueInvoices,
  paidInvoices,
  pendingAmount,
  pendingInvoices,
  totalRevenue,
}) {
  return (
    <FadeIn delay={0.15}>
      <div className="rounded-2xl border border-line/60 dark:border-ink-800 bg-surface dark:bg-surface-inverted p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent-500/10 dark:bg-accent-500/20">
              <Receipt className="h-4 w-4 text-accent-600 dark:text-accent-400" />
            </div>
            <div>
              <h3 className="text-sm font-black text-content dark:text-content-inverted">
                Invoice Pipeline
              </h3>
              <p className="text-xs text-content-subtle dark:text-content-muted">
                Current status breakdown
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 rounded-full bg-surface-sunken dark:bg-ink-800 border border-line-subtle dark:border-ink-700 px-3 py-1.5">
            <CheckCircle2 className="h-3.5 w-3.5 text-success-500 dark:text-success-400" />
            <span className="text-xs font-bold text-ink-700 dark:text-ink-300 tabular-nums">
              {collectionRate}%
            </span>
            <span className="text-xs text-content-subtle dark:text-content-muted">
              collected
            </span>
          </div>
        </div>

        {/* Pipeline bar */}
        <div className="mb-4 flex h-2.5 w-full overflow-hidden rounded-full bg-ink-100 dark:bg-ink-800">
          {totalRevenue + pendingAmount + overdueAmount > 0 ? (
            <>
              <motion.div
                initial={{ width: 0 }}
                animate={{
                  width: `${(totalRevenue / (totalRevenue + pendingAmount + overdueAmount)) * 100}%`,
                }}
                transition={{ duration: 0.8, delay: 0.2 }}
                className="h-full bg-success-500"
              />

              <motion.div
                initial={{ width: 0 }}
                animate={{
                  width: `${(pendingAmount / (totalRevenue + pendingAmount + overdueAmount)) * 100}%`,
                }}
                transition={{ duration: 0.8, delay: 0.4 }}
                className="h-full bg-warning-400"
              />

              <motion.div
                initial={{ width: 0 }}
                animate={{
                  width: `${(overdueAmount / (totalRevenue + pendingAmount + overdueAmount)) * 100}%`,
                }}
                transition={{ duration: 0.8, delay: 0.6 }}
                className="h-full bg-danger-400"
              />
            </>
          ) : (
            <div className="h-full w-full bg-ink-100 dark:bg-ink-800" />
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <StatusPill
            label="Paid"
            count={paidInvoices.length}
            amount={totalRevenue}
            color="bg-success-100 dark:bg-success-900/40 border border-success-200 dark:border-success-800/50"
          />
          <StatusPill
            label="Pending"
            count={pendingInvoices.length}
            amount={pendingAmount}
            color="bg-brand-100 dark:bg-brand-900/40 border border-info-200 dark:border-info-800/50"
          />
          <StatusPill
            label="Overdue"
            count={overdueInvoices.length}
            amount={overdueAmount}
            color="bg-blush-100 dark:bg-blush-900/40 border border-blush-200 dark:border-blush-800/50"
          />
        </div>
      </div>
    </FadeIn>
  );
}
