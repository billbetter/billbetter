import React from "react";
import { AlertCircle, CheckCircle2, Clock, FileText, TrendingUp, Users, Zap } from "lucide-react";
import FadeIn from "@/components/analytics/FadeIn";
import { motion } from "framer-motion";

const PRIORITY_COLORS = {
  red: {
    bg: "bg-danger-50 dark:bg-danger-900/20",
    border: "border-danger-100 dark:border-danger-800/60",
    badge:
      "bg-danger-100 dark:bg-danger-900/50 text-danger-700 dark:text-danger-300",
    icon: "text-danger-500 dark:text-danger-400",
  },
  amber: {
    bg: "bg-warning-50 dark:bg-warning-900/20",
    border: "border-warning-100 dark:border-warning-800/60",
    badge:
      "bg-warning-100 dark:bg-warning-900/50 text-warning-700 dark:text-warning-300",
    icon: "text-warning-500 dark:text-warning-400",
  },
  violet: {
    bg: "bg-accent-50 dark:bg-accent-900/20",
    border: "border-accent-100 dark:border-accent-800/60",
    badge:
      "bg-accent-100 dark:bg-accent-900/50 text-accent-700 dark:text-accent-300",
    icon: "text-accent-500 dark:text-accent-400",
  },
  blue: {
    bg: "bg-success-50 dark:bg-success-900/20",
    border: "border-success-100 dark:border-success-800/60",
    badge:
      "bg-success-100 dark:bg-success-900/50 text-success-700 dark:text-success-300",
    icon: "text-success-500 dark:text-success-400",
  },
  emerald: {
    bg: "bg-success-50 dark:bg-success-900/20",
    border: "border-success-100 dark:border-success-800/60",
    badge:
      "bg-success-100 dark:bg-success-900/50 text-success-700 dark:text-success-300",
    icon: "text-success-500 dark:text-success-400",
  },
};

/**
 * What to do next, most urgent first; "Everything looks great!" when nothing
 * applies. NOTE: an "approved" quote counts as unconverted -- docs/issues/10.
 */
function recommendedActions({
  clients,
  growthRate,
  overdueAmount,
  overdueInvoices,
  pendingAmount,
  pendingInvoices,
  quotes,
}) {
  const actions = [];

  if (overdueInvoices.length > 0) {
    actions.push({
      priority: "high",
      icon: AlertCircle,
      title: `Follow up on ${overdueInvoices.length} overdue invoice${overdueInvoices.length > 1 ? "s" : ""}`,
      description: `$${overdueAmount.toLocaleString()} is past due. Send payment reminders to recover this revenue.`,
      color: "red",
    });
  }

  if (pendingInvoices.length > 3) {
    actions.push({
      priority: "medium",
      icon: Clock,
      title: `${pendingInvoices.length} invoices awaiting payment`,
      description: `$${pendingAmount.toLocaleString()} pending. Consider offering early payment discounts.`,
      color: "amber",
    });
  }

  if (clients.length < 5) {
    actions.push({
      priority: "medium",
      icon: Users,
      title: "Expand your client base",
      description:
        "Having fewer than 5 clients increases revenue concentration risk. Diversify with outreach.",
      color: "violet",
    });
  }

  if (growthRate < 0) {
    actions.push({
      priority: "medium",
      icon: TrendingUp,
      title: "Revenue is declining",
      description:
        "Consider upselling current clients, raising rates, or increasing marketing efforts.",
      color: "blue",
    });
  }

  if (quotes.length > 0) {
    const unconverted = quotes.filter(
      (q) =>
        q.status !== "accepted" && q.status !== "converted",
    );
    if (unconverted.length > 0) {
      actions.push({
        priority: "low",
        icon: FileText,
        title: `${unconverted.length} quote${unconverted.length > 1 ? "s" : ""} need follow-up`,
        description:
          "Unconverted quotes represent potential revenue. Reach out to close these deals.",
        color: "blue",
      });
    }
  }

  if (actions.length === 0) {
    actions.push({
      priority: "low",
      icon: CheckCircle2,
      title: "Everything looks great!",
      description:
        "No urgent actions needed. Keep up the good work and continue monitoring your metrics.",
      color: "emerald",
    });
  }
  return actions;
}

/** Prioritised steps to improve the business. */
export default function RecommendationsCard(props) {
  const actions = recommendedActions(props);
  return (
    <FadeIn delay={0.25}>
      <div className="rounded-2xl border border-line/60 dark:border-ink-800 bg-surface dark:bg-surface-inverted p-5 sm:p-6">
        <div className="flex items-center gap-2 mb-5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent-500/10 dark:bg-accent-500/20">
            <Zap className="h-4 w-4 text-accent-600 dark:text-accent-400" />
          </div>
          <div>
            <h3 className="text-sm font-black text-content dark:text-content-inverted">
              Recommended Actions
            </h3>
            <p className="text-xs text-content-subtle dark:text-content-muted">
              Prioritized steps to improve your business
            </p>
          </div>
        </div>

        <div className="space-y-3">
          {actions.map((action, idx) => {
            const c = PRIORITY_COLORS[action.color];
            const ActionIcon = action.icon;
            return (
              <motion.div
                key={idx}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.4, delay: 0.3 + idx * 0.08 }}
                className={`flex items-start gap-3 rounded-xl ${c.bg} border ${c.border} px-4 py-3.5`}
              >
                <ActionIcon
                  className={`h-4 w-4 mt-0.5 flex-shrink-0 ${c.icon}`}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-ink-800 dark:text-ink-200">
                    {action.title}
                  </p>
                  <p className="text-xs text-content-muted dark:text-content-subtle mt-0.5 leading-relaxed">
                    {action.description}
                  </p>
                </div>
                <span
                  className={`flex-shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${c.badge}`}
                >
                  {action.priority}
                </span>
              </motion.div>
            );
          })}
        </div>
      </div>
    </FadeIn>
  );
}
