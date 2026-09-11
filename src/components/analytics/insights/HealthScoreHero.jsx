import React from "react";
import FadeIn from "@/components/analytics/FadeIn";
import { Sparkles } from "lucide-react";
import { healthHeadline } from "@/components/analytics/analyticsModel";
import { motion } from "framer-motion";
import { token } from "@/lib/tokens";

/** The business health score ring, its verdict and the four inputs behind it. */
export default function HealthScoreHero({
  clients,
  collectionRate,
  growthRate,
  healthScore,
  jobsCompletedThisMonth,
}) {
  return (
    <FadeIn>
      <div className="relative overflow-hidden rounded-2xl bg-surface-inverted p-5 sm:p-8">
        {/* Decorative elements */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-success-500/15 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-accent-500/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/4" />

        <div className="relative flex flex-col sm:flex-row sm:items-center gap-6 sm:gap-8">
          {/* Score Ring */}
          <div className="flex-shrink-0 flex items-center justify-center">
            <div className="relative h-28 w-28 sm:h-32 sm:w-32">
              <svg
                className="h-full w-full -rotate-90"
                viewBox="0 0 120 120"
              >
                <circle
                  cx="60"
                  cy="60"
                  r="52"
                  fill="none"
                  stroke="rgba(255,255,255,0.08)"
                  strokeWidth="8"
                />
                <circle
                  cx="60"
                  cy="60"
                  r="52"
                  fill="none"
                  stroke={healthScore >= 70 ? token("success-500") : healthScore >= 40 ? token("accent-500") : token("danger-500")}
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeDasharray={`${(healthScore / 100) * 327} 327`}
                  style={{ transition: "stroke-dasharray 1.5s ease" }}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-3xl sm:text-4xl font-bold text-content-inverted tabular-nums">
                  {healthScore}
                </span>
                <span className="text-[10px] font-semibold uppercase tracking-widest text-content-subtle">
                  Score
                </span>
              </div>
            </div>
          </div>

          {/* Score Details */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="h-4 w-4 text-success-400" />
              <span className="text-[11px] font-semibold uppercase tracking-widest text-success-400">
                Business Health
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-content-inverted mb-2">
              {healthHeadline(healthScore)}
            </h2>
            <p className="text-sm text-content-subtle leading-relaxed max-w-lg">
              Based on your collection rate, revenue growth, client base,
              and job completion metrics over the selected period.
            </p>

            {/* Score breakdown mini-bars */}
            <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2">
              {[
                {
                  label: "Collections",
                  value: collectionRate,
                  max: 100,
                  color: token("success-500"),
                },
                {
                  label: "Growth",
                  value: Math.min(Math.max(growthRate, 0), 100),
                  max: 100,
                  color: token("accent-500"),
                },
                {
                  label: "Client Base",
                  value: Math.min(clients.length * 10, 100),
                  max: 100,
                  color: token("success-600"),
                },
                {
                  label: "Activity",
                  value: jobsCompletedThisMonth > 0 ? 75 : 10,
                  max: 100,
                  color: token("accent-600"),
                },
              ].map((metric) => (
                <div key={metric.label}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] font-medium text-content-muted">
                      {metric.label}
                    </span>
                    <span className="text-[11px] font-bold text-ink-300 tabular-nums">
                      {Math.round(metric.value)}%
                    </span>
                  </div>
                  <div className="h-1 w-full overflow-hidden rounded-full bg-surface/10 dark:bg-surface-inverted/10">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${metric.value}%` }}
                      transition={{ duration: 1, delay: 0.5 }}
                      className="h-full rounded-full"
                      style={{ backgroundColor: metric.color }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </FadeIn>
  );
}
