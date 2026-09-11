import React from "react";
import FadeIn from "@/components/analytics/FadeIn";
import { Users } from "lucide-react";

/** Client count and average revenue per client. */
export default function ClientInsightCard({
  clients,
  revenueByClient,
}) {
  return (
    <FadeIn delay={0.2}>
      <div className="rounded-2xl border border-success-200/60 dark:border-success-800/60 bg-success-50/30 dark:bg-success-900/20 p-5">
        <div className="flex items-center gap-2 mb-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-success-500/10 dark:bg-success-500/20">
            <Users className="h-4 w-4 text-success-600 dark:text-success-400" />
          </div>
          <span className="text-xs font-semibold uppercase tracking-wider text-content-subtle dark:text-content-muted">
            Clients
          </span>
        </div>
        <p className="text-sm text-ink-700 dark:text-ink-300 leading-relaxed">
          {clients.length === 0
            ? "No clients yet. Start by adding your first client to begin tracking revenue."
            : clients.length <= 3
              ? `You have ${clients.length} active client${clients.length > 1 ? "s" : ""}. ${
                  revenueByClient.length > 0
                    ? `${revenueByClient[0].name} is your top earner at $${revenueByClient[0].revenue.toLocaleString()}.`
                    : "Focus on building recurring relationships."
                }`
              : `${clients.length} active clients. ${
                  revenueByClient.length > 0
                    ? `Top client contributes $${revenueByClient[0].revenue.toLocaleString()} in revenue.`
                    : ""
                } Good diversification.`}
        </p>
        <div className="mt-3 flex items-center gap-1.5">
          <span className="inline-flex items-center gap-1 rounded-full bg-success-50 dark:bg-success-900/50 px-2 py-0.5 text-[11px] font-bold text-success-700 dark:text-success-300">
            <Users className="h-3 w-3" />
            {clients.length} active
          </span>
        </div>
      </div>
    </FadeIn>
  );
}
