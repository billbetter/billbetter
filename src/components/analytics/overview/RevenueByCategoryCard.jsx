import React from "react";
import FadeIn from "@/components/analytics/FadeIn";
import { PieChart } from "lucide-react";
import { motion } from "framer-motion";

/** Paid revenue by job category, from job titles and descriptions. */
export default function RevenueByCategoryCard({
  catColors,
  revenueByJobTypeWithPercent,
}) {
  return (
    <FadeIn delay={0.25}>
      <div className="h-full rounded-2xl border border-line/60 dark:border-ink-800 bg-surface dark:bg-surface-inverted p-5 sm:p-6">
        <div className="flex items-center gap-2.5 mb-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent-500/10 dark:bg-accent-500/20">
            <PieChart className="h-4 w-4 text-accent-600 dark:text-accent-400" />
          </div>
          <div>
            <h3 className="text-sm font-black text-content dark:text-content-inverted">
              Revenue by Category
            </h3>
            <p className="text-xs text-content-subtle dark:text-content-muted">
              Job type breakdown
            </p>
          </div>
        </div>
        <div className="space-y-3.5">
          {revenueByJobTypeWithPercent.length > 0 ? (
            revenueByJobTypeWithPercent.slice(0, 5).map((item, idx) => (
              <div key={item.type}>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 rounded-full flex-shrink-0"
                      style={{
                        backgroundColor:
                          catColors[idx % catColors.length],
                      }}
                    />

                    <span className="text-sm font-medium text-ink-700 dark:text-ink-300">
                      {item.type}
                    </span>
                  </div>
                  <span className="text-sm font-bold text-content dark:text-content-inverted tabular-nums">
                    ${(item.revenue / 1000).toFixed(1)}k
                  </span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-ink-100 dark:bg-ink-800">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${item.percentage}%` }}
                    transition={{
                      duration: 0.8,
                      delay: 0.3 + idx * 0.1,
                    }}
                    className="h-full rounded-full"
                    style={{
                      backgroundColor:
                        catColors[idx % catColors.length],
                    }}
                  />
                </div>
                <p className="text-[11px] text-content-subtle dark:text-content-muted mt-0.5">
                  {item.percentage}% of total
                </p>
              </div>
            ))
          ) : (
            <div className="flex flex-col items-center justify-center py-10 text-content-subtle dark:text-content-muted">
              <PieChart className="h-8 w-8 mb-2 opacity-30" />
              <p className="text-sm">No job data yet</p>
              <p className="text-xs mt-1">
                Link jobs to invoices to see breakdowns
              </p>
            </div>
          )}
        </div>
      </div>
    </FadeIn>
  );
}
