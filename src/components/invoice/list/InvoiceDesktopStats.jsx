import React from "react";
import { AlertCircle, CheckCircle2, Clock, Receipt, Wallet } from "lucide-react";
import { DesktopStatTile } from "@/components/documentList/StatTiles";

/** The five headline figures across the desktop header. */
export default function InvoiceDesktopStats({
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
        icon={Receipt}
        iconClassName="text-content-subtle dark:text-content-muted"
        label="Total"
        valueClassName="text-content dark:text-content-inverted"
      >
        {stats.total}
      </DesktopStatTile>
      <DesktopStatTile
        divided
        icon={CheckCircle2}
        iconClassName="text-success-400 dark:text-success-500"
        label="Paid"
        valueClassName="text-success-600 dark:text-success-400"
      >
        {stats.paid}
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
        icon={AlertCircle}
        iconClassName="text-danger-400 dark:text-danger-500"
        label="Overdue"
        valueClassName={
          stats.overdue > 0
            ? "text-danger-600 dark:text-danger-400"
            : "text-content dark:text-content-inverted"
        }
      >
        {stats.overdue}
      </DesktopStatTile>
    </div>
  );
}
