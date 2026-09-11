import { AlertCircle, Ban, CheckCircle2, Clock, FileText, X } from "lucide-react";
import { VOID_STATUS } from "@/lib/invoiceVoid";

/** How each invoice status looks in the list: badge colours, icon, row stripe. */
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
  paid: {
    color:
      "bg-success-50 text-success-700 dark:bg-success-900/30 dark:text-success-400",
    icon: CheckCircle2,
    indicator: "bg-success-500",
  },
  overdue: {
    color:
      "bg-danger-50 text-danger-700 dark:bg-danger-900/30 dark:text-danger-400",
    icon: AlertCircle,
    indicator: "bg-danger-500",
  },
  cancelled: {
    color:
      "bg-ink-100 text-content-body dark:bg-ink-800/50 dark:text-content-muted",
    icon: X,
    indicator: "bg-ink-400 dark:bg-ink-600",
  },
  // Display only. SETTABLE_STATUSES below is what the per-row dropdown
  // offers, and `void` is deliberately not in it: voiding has to record who,
  // when and why, and a dropdown records none of those. It is reachable only
  // from the Void dialog on InvoiceDetail, and there is no way back.
  void: {
    color:
      "bg-ink-200 text-ink-700 line-through dark:bg-ink-700 dark:text-ink-200",
    icon: Ban,
    indicator: "bg-ink-500 dark:bg-ink-500",
  },
};

/**
 * The statuses the per-row dropdown may set.
 *
 * Built by subtraction from statusConfig rather than as its own list, so a
 * status added to the map for display does not become settable by accident
 * -- which is exactly how `void` would have leaked in.
 */
export const SETTABLE_STATUSES = Object.keys(statusConfig).filter(
  (s) => s !== VOID_STATUS,
);
