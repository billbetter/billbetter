import React from "react";
import FadeIn from "@/components/analytics/FadeIn";
import { FileText } from "lucide-react";

/**
 * The funnel's figures. NOTE: "won" is "accepted" or "converted", but quotes
 * are marked "approved" everywhere else in the app -- see docs/issues/10.
 */
function quoteFunnel(quotes) {
  const total = quotes.length;
  const accepted = quotes.filter(
    (q) => q.status === "accepted" || q.status === "converted",
  ).length;
  const pending = quotes.filter(
    (q) =>
      q.status === "sent" ||
      q.status === "pending" ||
      q.status === "viewed",
  ).length;
  const declined = quotes.filter(
    (q) => q.status === "declined" || q.status === "rejected",
  ).length;
  const conversionRate =
    total > 0 ? Math.round((accepted / total) * 100) : 0;

  const stages = [
    {
      label: "Total Sent",
      count: total,
      color: "bg-ink-200 dark:bg-ink-700",
      textColor: "text-content-body dark:text-content-subtle",
    },
    {
      label: "Pending",
      count: pending,
      color: "bg-warning-400",
      textColor: "text-warning-700 dark:text-warning-500",
    },
    {
      label: "Accepted",
      count: accepted,
      color: "bg-success-500",
      textColor: "text-success-700 dark:text-success-400",
    },
    {
      label: "Declined",
      count: declined,
      color: "bg-danger-400",
      textColor: "text-danger-600 dark:text-danger-400",
    },
  ];
  return { total, conversionRate, stages };
}

/** Quotes by stage, and the share that became work. */
export default function QuoteFunnelCard({
  quotes,
}) {
  const { total, conversionRate, stages } = quoteFunnel(quotes);
  return (
    <FadeIn delay={0.28}>
      <div className="rounded-2xl border border-line/60 dark:border-ink-800 bg-surface dark:bg-surface-inverted p-5 sm:p-6">
        <div className="flex items-center gap-2.5 mb-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-success-500/10 dark:bg-success-500/20">
            <FileText className="h-4 w-4 text-success-600 dark:text-success-400" />
          </div>
          <div>
            <h3 className="text-sm font-black text-content dark:text-content-inverted">
              Quote Funnel
            </h3>
            <p className="text-xs text-content-subtle dark:text-content-muted">
              Conversion pipeline
            </p>
          </div>
        </div>

        {total === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-content-subtle dark:text-content-muted">
            <FileText className="h-8 w-8 mb-2 opacity-30" />
            <p className="text-sm">No quotes yet</p>
            <p className="text-xs mt-1">
              Create quotes to track conversions
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Conversion rate highlight */}
            <div className="text-center py-3 rounded-xl bg-surface-sunken dark:bg-ink-800 border border-line-subtle dark:border-ink-700">
              <p className="text-2xl font-bold text-content dark:text-content-inverted tabular-nums">
                {conversionRate}%
              </p>
              <p className="text-[11px] font-medium text-content-subtle dark:text-content-muted uppercase tracking-wider">
                Conversion Rate
              </p>
            </div>

            {/* Funnel stages */}
            <div className="space-y-2">
              {stages.map((stage) => (
                <div
                  key={stage.label}
                  className="flex items-center gap-3"
                >
                  <div
                    className={`h-2 w-2 rounded-full flex-shrink-0 ${stage.color}`}
                  />
                  <span className="text-xs font-medium text-content-body dark:text-content-subtle flex-1">
                    {stage.label}
                  </span>
                  <span
                    className={`text-xs font-bold tabular-nums ${stage.textColor}`}
                  >
                    {stage.count}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </FadeIn>
  );
}
