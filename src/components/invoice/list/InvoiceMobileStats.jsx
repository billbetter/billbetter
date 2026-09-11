import React from "react";
import { AlertCircle, CheckCircle2, Clock, DollarSign } from "lucide-react";
import { MobileStatTile } from "@/components/documentList/StatTiles";

// The invoice list's tile surface. The quote list uses a different one --
// see StatTiles.
const MOBILE_TILE =
  "bg-surface dark:bg-surface-inverted rounded-2xl border border-line-subtle dark:border-ink-800 p-4 shadow-sm";

/** The four headline figures in the phone layout: value, overdue, paid, pending. */
export default function InvoiceMobileStats({
  stats,
}) {
  return (
    <div className="grid grid-cols-2 gap-3 mb-6">
      <MobileStatTile
        className={MOBILE_TILE}
        icon={DollarSign}
        chipClassName="bg-info-50 dark:bg-info-900/30"
        iconClassName="text-brand-700 dark:text-brand-400"
        label="Total Value"
        valueClassName="text-content dark:text-content-inverted"
      >
        $
        {stats.totalValue.toLocaleString(undefined, {
          maximumFractionDigits: 0,
        })}
      </MobileStatTile>
      <MobileStatTile
        className={MOBILE_TILE}
        icon={AlertCircle}
        chipClassName="bg-danger-50 dark:bg-danger-900/30"
        iconClassName="text-danger-600 dark:text-danger-400"
        label="Overdue"
        valueClassName={
          stats.overdue > 0
            ? "text-danger-600 dark:text-danger-400"
            : "text-content dark:text-content-inverted"
        }
      >
        {stats.overdue}
      </MobileStatTile>
      <MobileStatTile
        className={MOBILE_TILE}
        icon={CheckCircle2}
        chipClassName="bg-success-50 dark:bg-success-900/30"
        iconClassName="text-success-600 dark:text-success-400"
        label="Paid"
        valueClassName="text-success-600 dark:text-success-400"
      >
        {stats.paid}
      </MobileStatTile>
      <MobileStatTile
        className={MOBILE_TILE}
        icon={Clock}
        chipClassName="bg-info-50 dark:bg-info-900/30"
        iconClassName="text-brand-700 dark:text-brand-400"
        label="Pending"
        valueClassName="text-brand-700 dark:text-brand-400"
      >
        {stats.pending}
      </MobileStatTile>
    </div>
  );
}
