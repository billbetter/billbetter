import { Ban, CheckCircle2, Pause } from "lucide-react";
import { formatCalendarDay } from "@/lib/calendarDate";

/** How each recurring-invoice status looks: badge colours, icon, stripe, label. */
export const statusConfig = {
  active: {
    color:
      "bg-success-50 text-success-700 dark:bg-success-900/30 dark:text-success-400 border-success-200 dark:border-success-800",
    icon: CheckCircle2,
    indicator: "bg-success-500",
    label: "Active",
  },
  paused: {
    color:
      "bg-warning-50 text-warning-700 dark:bg-warning-900/30 dark:text-warning-400 border-warning-200 dark:border-warning-800",
    icon: Pause,
    indicator: "bg-warning-500",
    label: "Paused",
  },
  completed: {
    color:
      "bg-info-50 text-info-700 dark:bg-info-900/30 dark:text-info-400 border-info-200 dark:border-info-800",
    icon: CheckCircle2,
    indicator: "bg-brand-600",
    label: "Completed",
  },
  cancelled: {
    color:
      "bg-ink-100 text-ink-700 dark:bg-ink-800 dark:text-content-subtle border-line-strong dark:border-ink-700",
    icon: Ban,
    indicator: "bg-ink-400 dark:bg-ink-600",
    label: "Cancelled",
  },
};

/** "monthly" -> "Monthly"; unknown values pass through. */
export const getFrequencyLabel = (frequency) => {
  const labels = {
    weekly: "Weekly",
    biweekly: "Bi-weekly",
    monthly: "Monthly",
    quarterly: "Quarterly",
    yearly: "Yearly",
  };
  return labels[frequency] || frequency;
};

/** How a schedule ends, for display. */
export const getEndLabel = (recurring) => {
  if (recurring.end_type === "never") return "Never ends";
  if (recurring.end_type === "after")
    return `After ${recurring.occurrences} invoices`;
  if (recurring.end_type === "on_date")
    return `Ends ${formatCalendarDay(recurring.end_date, "MMM d, yyyy")}`;
  return "N/A";
};
