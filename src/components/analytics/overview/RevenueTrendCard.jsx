import React from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ArrowDownRight, ArrowUpRight, TrendingUp } from "lucide-react";
import ChartTooltip from "@/components/analytics/ChartTooltip";
import FadeIn from "@/components/analytics/FadeIn";
import { formatMoneyTick, moneyChartAxis, moneyChartGrid } from "@/components/analytics/moneyChart";
import { token } from "@/lib/tokens";

/** Six-month revenue area chart, with this month against last. */
export default function RevenueTrendCard({
  currentMonthRevenue,
  growthRate,
  lastMonthRevenue,
  revenueTrendData,
}) {
  return (
    <FadeIn delay={0.2} className="lg:col-span-2">
      <div className="h-full rounded-2xl border border-line/60 dark:border-ink-800 bg-surface dark:bg-surface-inverted p-5 sm:p-6">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-success-500/10 dark:bg-success-500/20">
              <TrendingUp className="h-4 w-4 text-success-600 dark:text-success-400" />
            </div>
            <div>
              <h3 className="text-sm font-black text-content dark:text-content-inverted">
                Revenue Trend
              </h3>
              <p className="text-xs text-content-subtle dark:text-content-muted">
                Last 6 months performance
              </p>
            </div>
          </div>
          <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full bg-surface-sunken dark:bg-ink-800 border border-line-subtle dark:border-ink-700 px-2.5 py-1 text-[11px] font-medium text-content-muted dark:text-content-subtle">
            <TrendingUp className="h-3 w-3" />
            6-month view
          </span>
        </div>

        {/* Summary row */}
        <div className="flex items-center gap-4 mt-3 mb-4 pb-4 border-b border-line-subtle dark:border-ink-800">
          <div>
            <p className="text-lg sm:text-xl font-bold text-content dark:text-content-inverted tabular-nums">
              ${currentMonthRevenue.toLocaleString()}
            </p>
            <p className="text-[11px] text-content-subtle dark:text-content-muted">
              This month
            </p>
          </div>
          <div className="h-8 w-px bg-ink-100 dark:bg-ink-800" />
          <div>
            <p className="text-lg sm:text-xl font-bold text-content-subtle dark:text-content-muted tabular-nums">
              ${lastMonthRevenue.toLocaleString()}
            </p>
            <p className="text-[11px] text-content-subtle dark:text-content-muted">
              Last month
            </p>
          </div>
          <div className="ml-auto">
            <span
              className={`inline-flex items-center gap-0.5 text-sm font-bold ${
                growthRate >= 0
                  ? "text-success-600 dark:text-success-400"
                  : "text-danger-500 dark:text-danger-400"
              }`}
            >
              {growthRate >= 0 ? (
                <ArrowUpRight className="h-4 w-4" />
              ) : (
                <ArrowDownRight className="h-4 w-4" />
              )}
              {Math.abs(growthRate).toFixed(1)}%
            </span>
          </div>
        </div>

        <div className="h-48 sm:h-56">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={revenueTrendData}>
              <CartesianGrid {...moneyChartGrid()} />
              <XAxis dataKey="month" {...moneyChartAxis()} />
              <YAxis
                tickFormatter={formatMoneyTick}
                width={48}
                {...moneyChartAxis()}
              />

              <Tooltip content={<ChartTooltip />} />
              <Area
                type="monotone"
                dataKey="revenue"
                stroke={token("success-500")}
                strokeWidth={2.5}
                fill={token("success-500")}
                fillOpacity={0.08}
                dot={false}
                activeDot={{
                  r: 5,
                  fill: token("success-500"),
                  strokeWidth: 2,
                  stroke: "#fff",
                }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </FadeIn>
  );
}
