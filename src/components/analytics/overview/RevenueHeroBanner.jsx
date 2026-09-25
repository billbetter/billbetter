import React from "react";
import { TrendingDown, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
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

/** Total revenue, growth against last month, and a six-month sparkline --
 * the headline card at the top of the overview. */
export default function RevenueHeroBanner({
  growthRate,
  monthlyData,
  paidInvoices,
  totalRevenue,
}) {
  const sparkline = heroSparklinePoints(monthlyData);
  const Trend = growthRate >= 0 ? TrendingUp : TrendingDown;
  return (
    <FadeIn>
      <Card className="bg-gradient-to-t from-primary/5 to-card p-4 shadow-sm sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
          <div className="min-w-0">
            <p className="mb-1 text-sm text-muted-foreground">Total Revenue</p>
            <p className="text-3xl font-semibold tabular-nums tracking-tight sm:text-4xl">
              ${totalRevenue.toLocaleString()}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Badge
                variant="outline"
                className={growthRate >= 0 ? "text-success-700 dark:text-success-400" : "text-danger-600 dark:text-danger-400"}
              >
                <Trend />
                {Math.abs(growthRate).toFixed(1)}% vs last month
              </Badge>
              <span className="whitespace-nowrap text-xs text-muted-foreground">
                {paidInvoices.length} invoices collected
              </span>
            </div>
          </div>

          {/* Mini monthly sparkline on desktop */}
          <div className="hidden flex-shrink-0 text-primary sm:block">
            <svg width="140" height="48">
              {sparkline && (
                <polyline
                  points={sparkline}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}
            </svg>
            <p className="mt-0.5 text-right text-[10px] text-muted-foreground">Last 6 months</p>
          </div>
        </div>
      </Card>
    </FadeIn>
  );
}
