import React from "react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import FadeIn from "@/components/analytics/FadeIn";

/** SVG polyline points for the last six months' revenue, or null with too few. */
function heroSparklinePoints(monthlyData) {
  const data = monthlyData.slice(-6).map((m) => m.paid);
  if (data.length < 2) return null;
  const max = Math.max(...data) || 1;
  const min = Math.min(...data);
  const range = max - min || 1;
  const w = 140;
  const h = 48;
  return data
    .map(
      (v, i) =>
        `${(i / (data.length - 1)) * w},${h - 4 - ((v - min) / range) * (h - 8)}`,
    )
    .join(" ");
}

/** Total revenue, growth against last month, and a six-month sparkline. */
export default function RevenueHeroBanner({
  growthRate,
  monthlyData,
  paidInvoices,
  totalRevenue,
}) {
  const sparkline = heroSparklinePoints(monthlyData);
  return (
    <FadeIn>
      <div className="relative overflow-hidden rounded-2xl bg-success-600 p-4 sm:p-7">
        <div className="absolute -top-8 -right-8 h-40 w-40 rounded-full bg-surface/10 blur-sm dark:bg-surface-inverted/10" />
        <div className="absolute -bottom-12 -left-6 h-32 w-32 rounded-full bg-surface/5 dark:bg-surface-inverted/5" />

        <div className="relative flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 sm:gap-4">
          <div className="min-w-0">
            <p className="text-success-100 text-xs font-semibold uppercase tracking-widest mb-1">
              Total Revenue
            </p>
            <p className="text-2xl sm:text-4xl lg:text-5xl font-bold text-content-inverted tracking-tight">
              ${totalRevenue.toLocaleString()}
            </p>
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <span className="inline-flex items-center gap-1 rounded-full bg-surface/20 backdrop-blur-sm px-2.5 py-1 text-xs font-bold text-content-inverted whitespace-nowrap dark:bg-surface-inverted/20">
                {growthRate >= 0 ? (
                  <ArrowUpRight className="h-3 w-3" />
                ) : (
                  <ArrowDownRight className="h-3 w-3" />
                )}
                {Math.abs(growthRate).toFixed(1)}% vs last month
              </span>
              <span className="text-xs text-success-100 whitespace-nowrap">
                {paidInvoices.length} invoices collected
              </span>
            </div>
          </div>

          {/* Mini monthly sparkline on desktop */}
          <div className="hidden sm:block flex-shrink-0">
            <svg width="140" height="48" className="opacity-60">
              {sparkline && (
                <polyline
                  points={sparkline}
                  fill="none"
                  stroke="rgba(255,255,255,0.8)"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}
            </svg>
            <p className="text-[10px] text-success-200 mt-0.5 text-right">
              Last 6 months
            </p>
          </div>
        </div>
      </div>
    </FadeIn>
  );
}
