import React from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { BarChart3 } from "lucide-react";
import ChartTooltip from "@/components/analytics/ChartTooltip";
import FadeIn from "@/components/analytics/FadeIn";
import { formatMoneyTick, moneyChartAxis, moneyChartGrid } from "@/components/analytics/moneyChart";
import { token } from "@/lib/tokens";

/** Twelve months of paid against pending, as bars. */
export default function MonthlyRevenueCard({
  monthlyData,
}) {
  return (
    <FadeIn delay={0.3} className="lg:col-span-2">
      <div className="rounded-2xl border border-line/60 dark:border-ink-800 bg-surface dark:bg-surface-inverted p-5 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent-500/10 dark:bg-accent-500/20">
              <BarChart3 className="h-4 w-4 text-accent-600 dark:text-accent-400" />
            </div>
            <div>
              <h3 className="text-sm font-black text-content dark:text-content-inverted">
                Monthly Overview
              </h3>
              <p className="text-xs text-content-subtle dark:text-content-muted">
                12-month revenue comparison
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5 text-xs text-content-muted dark:text-content-subtle">
              <span className="h-2 w-2 rounded-full bg-success-500" />
              Paid
            </span>
            <span className="flex items-center gap-1.5 text-xs text-content-muted">
              <span className="h-2 w-2 rounded-full bg-warning-400" />
              Pending
            </span>
          </div>
        </div>
        <div className="h-48 sm:h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={monthlyData} barGap={2}>
              <CartesianGrid {...moneyChartGrid()} />
              <XAxis dataKey="month" {...moneyChartAxis()} />
              <YAxis
                tickFormatter={formatMoneyTick}
                width={48}
                {...moneyChartAxis()}
              />

              <Tooltip content={<ChartTooltip />} />
              <Bar
                dataKey="paid"
                fill={token("success-500")}
                radius={[4, 4, 0, 0]}
                maxBarSize={24}
              />
              <Bar
                dataKey="pending"
                fill={token("warning-400")}
                radius={[4, 4, 0, 0]}
                maxBarSize={24}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </FadeIn>
  );
}
