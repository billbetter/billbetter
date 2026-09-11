import { daysUntilDay } from "@/lib/calendarDate";
import { CheckCircle2, Clock, FileCheck, FileText, XCircle } from "lucide-react";

/** How each quote status looks in the list: badge colours, icon, row stripe. */
export const statusConfig = {
  draft: {
    color: "bg-ink-100 text-ink-700 dark:bg-ink-800 dark:text-ink-300",
    icon: FileText,
    indicator: "bg-ink-400 dark:bg-ink-600",
  },
  sent: {
    color: "bg-info-50 text-info-700 dark:bg-info-900/30 dark:text-info-400",
    icon: Clock,
    indicator: "bg-brand-600",
  },
  approved: {
    color:
      "bg-success-50 text-success-700 dark:bg-success-900/30 dark:text-success-400",
    icon: CheckCircle2,
    indicator: "bg-success-500",
  },
  declined: {
    color:
      "bg-danger-50 text-danger-700 dark:bg-danger-900/30 dark:text-danger-400",
    icon: XCircle,
    indicator: "bg-danger-500",
  },
  converted: {
    color:
      "bg-accent-50 text-accent-700 dark:bg-accent-900/30 dark:text-accent-400",
    icon: FileCheck,
    indicator: "bg-accent-500",
  },
};

/**
 * Who responded to this quote, for the list.
 *
 * Returns null unless a CLIENT responded through the public link -- the name
 * columns are written by nothing else. A quote the contractor marked approved
 * from the dropdown here keeps its badge and nothing more, which is correct:
 * there is no client assertion to report, and inventing a line that looked
 * like one would make the two indistinguishable at a glance.
 */
export const respondedBy = (quote) => {
  if (quote.status === "approved" && quote.approved_by_name) {
    return { verb: "Approved by", who: quote.approved_by_name };
  }
  if (
    (quote.status === "declined" || quote.status === "rejected") &&
    quote.declined_by_name
  ) {
    return { verb: "Declined by", who: quote.declined_by_name };
  }
  return null;
};

/** The expiry badge for a quote: label and colours by days remaining. */
export const getExpiryStatus = (expiryDate) => {
  const days = daysUntilDay(expiryDate);
  if (days === null)
    return {
      text: "No expiry",
      color: "text-content-body dark:text-content-subtle",
      bgColor: "bg-ink-100 dark:bg-ink-800",
      indicator: "bg-ink-400",
    };
  if (days < 0)
    return {
      text: "Expired",
      color: "text-danger-600 dark:text-danger-400",
      bgColor: "bg-danger-50 dark:bg-danger-900/30",
      indicator: "bg-danger-500",
    };
  if (days <= 7)
    return {
      text: `${days}d left`,
      color: "text-alert-600 dark:text-alert-400",
      bgColor: "bg-alert-50 dark:bg-alert-900/30",
      indicator: "bg-alert-500",
    };
  return {
    text: `${days}d left`,
    color: "text-content-body dark:text-content-subtle",
    bgColor: "bg-ink-100 dark:bg-ink-800",
    indicator: "bg-ink-400",
  };
};
