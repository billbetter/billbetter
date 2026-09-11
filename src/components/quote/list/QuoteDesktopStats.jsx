import React from "react";
import { CheckCircle2, ClipboardList, Clock, Wallet, XCircle } from "lucide-react";
import { DesktopStatTile } from "@/components/documentList/StatTiles";

/** The five headline figures across the desktop header. */
export default function QuoteDesktopStats({
  stats,
}) {
  return (
    <div className="grid grid-cols-5 gap-8">
      <DesktopStatTile
        divided
        icon={Wallet}
        iconClassName="text-content-subtle dark:text-content-muted"
        label="Total Value"
        valueClassName="text-content dark:text-content-inverted"
      >
        $
        {stats.totalValue.toLocaleString(undefined, {
          maximumFractionDigits: 0,
        })}
      </DesktopStatTile>
      <DesktopStatTile
        divided
        icon={ClipboardList}
        iconClassName="text-content-subtle dark:text-content-muted"
        label="Total"
        valueClassName="text-content dark:text-content-inverted"
      >
        {stats.total}
      </DesktopStatTile>
      <DesktopStatTile
        divided
        icon={Clock}
        iconClassName="text-info-400 dark:text-brand-600"
        label="Pending"
        valueClassName="text-brand-700 dark:text-brand-400"
      >
        {stats.pending}
      </DesktopStatTile>
      <DesktopStatTile
        divided
        icon={CheckCircle2}
        iconClassName="text-success-400 dark:text-success-500"
        label="Approved"
        valueClassName="text-success-600 dark:text-success-400"
      >
        {stats.approved}
      </DesktopStatTile>
      <DesktopStatTile
        icon={XCircle}
        iconClassName="text-danger-400 dark:text-danger-500"
        label="Declined"
        valueClassName={
          stats.declined > 0
            ? "text-danger-600 dark:text-danger-400"
            : "text-content dark:text-content-inverted"
        }
      >
        {stats.declined}
      </DesktopStatTile>
    </div>
  );
}
