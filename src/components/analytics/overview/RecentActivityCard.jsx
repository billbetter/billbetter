import React from "react";
import { Clock } from "lucide-react";
import FadeIn from "@/components/analytics/FadeIn";
import { format } from "date-fns";
import { motion } from "framer-motion";

const STATUS_STYLES = {
  paid: {
    dot: "bg-success-500",
    label: "Paid",
    text: "text-success-700 dark:text-success-400",
  },
  sent: {
    dot: "bg-info-400",
    label: "Sent",
    text: "text-info-700 dark:text-info-400",
  },
  pending: {
    dot: "bg-warning-400",
    label: "Pending",
    text: "text-warning-700 dark:text-warning-400",
  },
  overdue: {
    dot: "bg-danger-400",
    label: "Overdue",
    text: "text-danger-600 dark:text-danger-400",
  },
  draft: {
    dot: "bg-ink-300 dark:bg-ink-600",
    label: "Draft",
    text: "text-content-muted dark:text-content-subtle",
  },
  completed: {
    dot: "bg-success-500",
    label: "Completed",
    text: "text-success-700 dark:text-success-400",
  },
  in_progress: {
    dot: "bg-info-400",
    label: "In Progress",
    text: "text-info-700 dark:text-info-400",
  },
  scheduled: {
    dot: "bg-brand-400",
    label: "Scheduled",
    text: "text-brand-700 dark:text-brand-400",
  },
};

/** The newest invoices and jobs, merged into one feed of at most six. */
function recentActivity(invoices, jobs) {
  return [
    ...invoices.slice(0, 5).map((inv) => ({
      type: "invoice",
      title: inv.client_name || "Invoice",
      amount: inv.total,
      status: inv.status,
      date: inv.created_date,
    })),
    ...jobs.slice(0, 3).map((job) => ({
      type: "job",
      title: job.job_title || job.client_name || "Job",
      status: job.status,
      date: job.created_date,
    })),
  ]
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 6);
}

/** "Sep 4", or nothing for a missing or unreadable date. */
function activityDate(date) {
  try {
    const d = new Date(date);
    return format(d, "MMM d");
  } catch {
    return "";
  }
}

/** The latest invoice and job updates. */
export default function RecentActivityCard({
  invoices,
  jobs,
}) {
  const activities = recentActivity(invoices, jobs);
  return (
    <FadeIn delay={0.4}>
      <div className="rounded-2xl border border-line/60 dark:border-ink-800 bg-surface dark:bg-surface-inverted p-5 sm:p-6">
        <div className="flex items-center gap-2.5 mb-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-ink-100 dark:bg-ink-800">
            <Clock className="h-4 w-4 text-content-body dark:text-content-subtle" />
          </div>
          <div>
            <h3 className="text-sm font-black text-content dark:text-content-inverted">
              Recent Activity
            </h3>
            <p className="text-xs text-content-subtle dark:text-content-muted">
              Latest invoice & job updates
            </p>
          </div>
        </div>

        <div className="space-y-0.5">
          {activities.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-content-subtle dark:text-content-muted">
              <Clock className="h-8 w-8 mb-2 opacity-30" />
              <p className="text-sm">No recent activity</p>
            </div>
          ) : (
            activities.map((act, idx) => {
              const s = STATUS_STYLES[act.status] || STATUS_STYLES.draft;
              return (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.45 + idx * 0.05 }}
                  className="flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-surface-sunken dark:hover:bg-ink-800 transition-colors"
                >
                  <div
                    className={`h-2 w-2 rounded-full flex-shrink-0 ${s.dot}`}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-ink-800 dark:text-ink-200 truncate">
                      {act.title}
                    </p>
                    <p className="text-[11px] text-content-subtle dark:text-content-muted">
                      {act.type === "invoice" ? "Invoice" : "Job"} ·{" "}
                      {activityDate(act.date)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {act.amount && (
                      <span className="text-sm font-bold text-content dark:text-content-inverted tabular-nums">
                        ${act.amount.toLocaleString()}
                      </span>
                    )}
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${s.text} bg-surface-sunken dark:bg-ink-800`}
                    >
                      {s.label}
                    </span>
                  </div>
                </motion.div>
              );
            })
          )}
        </div>
      </div>
    </FadeIn>
  );
}
