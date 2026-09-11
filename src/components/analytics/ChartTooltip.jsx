import React from "react";

/** The dollar tooltip the revenue charts share. */
const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-line-subtle dark:border-ink-800 bg-surface/95 dark:bg-surface-inverted/95 px-4 py-3 shadow-xl backdrop-blur-sm">
      <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-content-subtle dark:text-content-muted">
        {label}
      </p>
      {payload.map((entry, i) => (
        <div key={i} className="flex items-center gap-2">
          <span
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: entry.color }}
          />

          <span className="text-sm font-bold text-ink-800 dark:text-content-inverted tabular-nums">
            ${entry.value.toLocaleString()}
          </span>
          <span className="text-xs text-content-subtle dark:text-content-muted capitalize">
            {entry.dataKey}
          </span>
        </div>
      ))}
    </div>
  );
};

export default ChartTooltip;
