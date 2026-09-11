import React from "react";
import { CheckCircle2, Pause, Receipt, TrendingUp, Wallet } from "lucide-react";
import { DesktopStatTile } from "@/components/documentList/StatTiles";

/** The five headline figures across the desktop header. */
export default function RecurringDesktopStats({
  stats,
}) {
  return (
    <div className="grid grid-cols-5 gap-8">
      <DesktopStatTile
        divided
        icon={Wallet}
        iconClassName="text-content-subtle dark:text-content-muted"
        label="Monthly Rev"
        valueClassName="text-content dark:text-content-inverted"
      >
        $
        {stats.monthlyRevenue.toLocaleString(undefined, {
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
        label="Active"
        valueClassName="text-success-600 dark:text-success-400"
      >
        {stats.active}
      </DesktopStatTile>
      <DesktopStatTile
        divided
        icon={Pause}
        iconClassName="text-warning-400 dark:text-warning-500"
        label="Paused"
        valueClassName={
          stats.paused > 0
            ? "text-warning-600 dark:text-warning-400"
            : "text-content dark:text-content-inverted"
        }
      >
        {stats.paused}
      </DesktopStatTile>
      <DesktopStatTile
        icon={TrendingUp}
        iconClassName="text-info-400 dark:text-brand-600"
        label="Frequency"
        valueClassName="text-brand-700 dark:text-brand-400"
      >
        Auto
      </DesktopStatTile>
    </div>
  );
}
