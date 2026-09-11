import React from "react";
import { ArrowDownRight, ArrowUpRight, DollarSign } from "lucide-react";
import FadeIn from "@/components/analytics/FadeIn";

/** Revenue this month against last, in words. */
export default function RevenueInsightCard({
  growthRate,
}) {
  return (
    <FadeIn delay={0.1}>
      <div className="rounded-2xl border border-success-200/60 dark:border-success-800/60 bg-success-50/30 dark:bg-success-900/20 p-5">
        <div className="flex items-center gap-2 mb-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-success-500/10 dark:bg-success-500/20">
            <DollarSign className="h-4 w-4 text-success-600 dark:text-success-400" />
          </div>
          <span className="text-xs font-semibold uppercase tracking-wider text-content-subtle dark:text-content-muted">
            Revenue
          </span>
        </div>
        <p className="text-sm text-ink-700 dark:text-ink-300 leading-relaxed">
          {growthRate > 0
            ? `Revenue grew ${Math.abs(growthRate).toFixed(1)}% this month. ${
                growthRate > 20
                  ? "Exceptional growth — keep this momentum going."
                  : "Steady upward trajectory."
              }`
            : growthRate < 0
              ? `Revenue declined ${Math.abs(growthRate).toFixed(1)}% this month. Consider following up on pending invoices or increasing outreach.`
              : "Revenue has been stable. Look for opportunities to upsell existing clients."}
        </p>
        <div className="mt-3 flex items-center gap-1.5">
          <span
            className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[11px] font-bold ${
              growthRate >= 0
                ? "bg-success-50 dark:bg-success-900/50 text-success-700 dark:text-success-300"
                : "bg-danger-50 dark:bg-danger-900/50 text-danger-600 dark:text-danger-300"
            }`}
          >
            {growthRate >= 0 ? (
              <ArrowUpRight className="h-3 w-3" />
            ) : (
              <ArrowDownRight className="h-3 w-3" />
            )}
            {Math.abs(growthRate).toFixed(1)}% vs last month
          </span>
        </div>
      </div>
    </FadeIn>
  );
}
