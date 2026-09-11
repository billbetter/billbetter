import React from "react";

/** A status with its count and amount, for the invoice pipeline. */
const StatusPill = ({ label, count, amount, color }) => (
  <div
    className={`flex items-center justify-between rounded-xl px-3 py-2.5 sm:px-4 sm:py-3 ${color}`}
  >
    <div className="flex items-center gap-2 min-w-0">
      <span className="text-ink-800 dark:text-ink-200 text-sm font-semibold">
        {label}
      </span>
      <span className="rounded-full bg-surface/80 dark:bg-black/20 px-2 py-0.5 text-xs font-bold text-ink-700 dark:text-ink-200 flex-shrink-0">
        {count}
      </span>
    </div>
    <span className="text-sm font-bold text-content dark:text-content-inverted tabular-nums flex-shrink-0 ml-2">
      ${amount.toLocaleString()}
    </span>
  </div>
);

export default StatusPill;
