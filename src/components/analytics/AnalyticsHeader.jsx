import React from "react";
import { BarChart3 } from "lucide-react";
import DateRangeFilter from "@/components/analytics/DateRangeFilter";
import FadeIn from "@/components/analytics/FadeIn";

/** Title block and the date-range picker. */
export default function AnalyticsHeader({
  dateRange,
  setDateRange,
}) {
  return (
    <FadeIn>
      <div className="bg-surface dark:bg-surface-inverted rounded-2xl p-4 sm:p-6 shadow-sm mb-4 sm:mb-6 border border-line-subtle dark:border-ink-800">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-success-600 flex items-center justify-center flex-shrink-0 shadow-lg">
              <BarChart3 className="w-5 h-5 text-content-inverted" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-black tracking-tight sm:text-2xl lg:text-3xl text-content dark:text-content-inverted">
                  Analytics
                </h1>
                <span className="inline-flex items-center gap-1 rounded-full bg-success-500/10 dark:bg-success-500/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-success-600 dark:text-success-400 border border-success-500/20 dark:border-success-500/30 flex-shrink-0">
                  <span className="h-1.5 w-1.5 rounded-full bg-success-500 dark:bg-success-400 animate-pulse" />
                  Live
                </span>
              </div>
              <p className="text-xs sm:text-sm text-content-muted dark:text-content-subtle">
                Track revenue & performance
              </p>
            </div>
          </div>
          <div className="flex-shrink-0">
            <DateRangeFilter
              dateRange={dateRange}
              setDateRange={setDateRange}
            />
          </div>
        </div>
      </div>
    </FadeIn>
  );
}
