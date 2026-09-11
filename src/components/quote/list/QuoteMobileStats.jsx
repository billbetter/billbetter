import React from "react";
import { CheckCircle2, Clock, Wallet, XCircle } from "lucide-react";
import { MobileStatTile } from "@/components/documentList/StatTiles";

// The quote list's tile surface. The invoice list uses a different one --
// see StatTiles.
const QUOTE_TILE =
  "bg-surface dark:bg-ink-800 rounded-2xl border border-line dark:border-ink-700 p-4 shadow-sm";

/** The four headline figures in the phone layout: value, pending, approved,
 * declined. */
export default function QuoteMobileStats({
  stats,
}) {
  return (
    <div className="grid grid-cols-2 gap-3 mb-6">
      <MobileStatTile
        className={QUOTE_TILE}
        icon={Wallet}
        chipClassName="bg-accent-50 dark:bg-accent-900/30"
        iconClassName="text-accent-600 dark:text-accent-400"
        label="Total Value"
        valueClassName="text-content dark:text-content-inverted"
      >
        $
        {stats.totalValue.toLocaleString(undefined, {
          maximumFractionDigits: 0,
        })}
      </MobileStatTile>
      <MobileStatTile
        className={QUOTE_TILE}
        icon={Clock}
        chipClassName="bg-info-50 dark:bg-info-900/30"
        iconClassName="text-brand-700 dark:text-brand-400"
        label="Pending"
        valueClassName="text-brand-700 dark:text-brand-400"
      >
        {stats.pending}
      </MobileStatTile>
      <MobileStatTile
        className={QUOTE_TILE}
        icon={CheckCircle2}
        chipClassName="bg-success-50 dark:bg-success-900/30"
        iconClassName="text-success-600 dark:text-success-400"
        label="Approved"
        valueClassName="text-success-600 dark:text-success-400"
      >
        {stats.approved}
      </MobileStatTile>
      <MobileStatTile
        className={QUOTE_TILE}
        icon={XCircle}
        chipClassName="bg-danger-50 dark:bg-danger-900/30"
        iconClassName="text-danger-600 dark:text-danger-400"
        label="Declined"
        valueClassName={
          stats.declined > 0
            ? "text-danger-600 dark:text-danger-400"
            : "text-content dark:text-content-inverted"
        }
      >
        {stats.declined}
      </MobileStatTile>
    </div>
  );
}
