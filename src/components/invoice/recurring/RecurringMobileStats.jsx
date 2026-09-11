import React from "react";
import { CheckCircle2, DollarSign, Pause, Receipt } from "lucide-react";
import { MobileStatTile } from "@/components/documentList/StatTiles";

const RECURRING_TILE =
  "bg-surface dark:bg-ink-800 rounded-2xl border border-line dark:border-ink-700 p-4 shadow-sm";

/** The four headline figures in the phone layout. */
export default function RecurringMobileStats({
  stats,
}) {
  return (
    <div className="grid grid-cols-2 gap-3 mb-6">
      <MobileStatTile
        className={RECURRING_TILE}
        icon={DollarSign}
        chipClassName="bg-success-50 dark:bg-success-900/30"
        iconClassName="text-success-600 dark:text-success-400"
        label="Monthly"
        valueClassName="text-content dark:text-content-inverted"
      >
        $
        {stats.monthlyRevenue.toLocaleString(undefined, {
          maximumFractionDigits: 0,
        })}
      </MobileStatTile>
      <MobileStatTile
        className={RECURRING_TILE}
        icon={Pause}
        chipClassName="bg-warning-50 dark:bg-warning-900/30"
        iconClassName="text-warning-600 dark:text-warning-400"
        label="Paused"
        valueClassName={
          stats.paused > 0
            ? "text-warning-600 dark:text-warning-400"
            : "text-content dark:text-content-inverted"
        }
      >
        {stats.paused}
      </MobileStatTile>
      <MobileStatTile
        className={RECURRING_TILE}
        icon={CheckCircle2}
        chipClassName="bg-success-50 dark:bg-success-900/30"
        iconClassName="text-success-600 dark:text-success-400"
        label="Active"
        valueClassName="text-success-600 dark:text-success-400"
      >
        {stats.active}
      </MobileStatTile>
      <MobileStatTile
        className={RECURRING_TILE}
        icon={Receipt}
        chipClassName="bg-info-50 dark:bg-info-900/30"
        iconClassName="text-brand-700 dark:text-brand-400"
        label="Total"
        valueClassName="text-brand-700 dark:text-brand-400"
      >
        {stats.total}
      </MobileStatTile>
    </div>
  );
}
