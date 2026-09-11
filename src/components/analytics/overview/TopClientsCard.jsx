import React from "react";
import FadeIn from "@/components/analytics/FadeIn";
import { Users } from "lucide-react";
import { motion } from "framer-motion";

/** The five clients who have paid the most in the period. */
export default function TopClientsCard({
  revenueByClient,
}) {
  return (
    <FadeIn delay={0.35}>
      <div className="rounded-2xl border border-line/60 dark:border-ink-800 bg-surface dark:bg-surface-inverted p-5 sm:p-6">
        <div className="flex items-center gap-2.5 mb-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-success-500/10 dark:bg-success-500/20">
            <Users className="h-4 w-4 text-success-600 dark:text-success-400" />
          </div>
          <div>
            <h3 className="text-sm font-black text-content dark:text-content-inverted">
              Top Clients
            </h3>
            <p className="text-xs text-content-subtle dark:text-content-muted">
              Highest revenue customers
            </p>
          </div>
        </div>
        <div className="space-y-1">
          {revenueByClient.map((client, idx) => {
            const maxRev = revenueByClient[0]?.revenue || 1;
            const pct = Math.round((client.revenue / maxRev) * 100);
            const avatarColors = [
              "bg-success-100 text-success-700 dark:bg-success-900/30 dark:text-success-400",
              "bg-accent-100 text-accent-700 dark:bg-accent-900/30 dark:text-accent-400",
              "bg-success-100 text-success-800 dark:bg-success-900/30 dark:text-success-300",
              "bg-accent-100 text-accent-800 dark:bg-accent-900/30 dark:text-accent-300",
              "bg-positive-100 text-positive-700 dark:bg-positive-900/30 dark:text-positive-400",
            ];

            return (
              <motion.div
                key={client.name}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: 0.4 + idx * 0.06 }}
                className="group flex items-center gap-3 rounded-xl px-3 py-3 transition-all hover:bg-surface-sunken dark:hover:bg-ink-800"
              >
                <span className="text-[11px] font-bold text-ink-300 dark:text-content-body w-3 text-right tabular-nums dark:dark:text-ink-300">
                  {idx + 1}
                </span>
                <div
                  className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                    avatarColors[idx % avatarColors.length]
                  }`}
                >
                  {client.name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink-800 dark:text-ink-200">
                    {client.name}
                  </p>
                  <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-ink-100 dark:bg-ink-800">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{
                        duration: 0.6,
                        delay: 0.5 + idx * 0.06,
                      }}
                      className="h-full rounded-full bg-ink-300 dark:bg-ink-600 group-hover:bg-success-300 dark:group-hover:bg-success-500 transition-colors"
                    />
                  </div>
                </div>
                <span className="flex-shrink-0 text-sm font-bold text-content dark:text-content-inverted tabular-nums">
                  ${client.revenue.toLocaleString()}
                </span>
              </motion.div>
            );
          })}
          {revenueByClient.length === 0 && (
            <div className="flex flex-col items-center justify-center py-10 text-content-subtle dark:text-content-muted">
              <Users className="h-8 w-8 mb-2 opacity-30" />
              <p className="text-sm">No client revenue data yet</p>
            </div>
          )}
        </div>
      </div>
    </FadeIn>
  );
}
