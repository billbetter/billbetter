import React from "react";

/*
 * The figures across the top of a document list page (Invoices, Quotes).
 *
 * Colours are passed in rather than chosen here: each page tints its tiles
 * differently, and the two pages' tile backgrounds are not even the same
 * surface token -- so the container class is the caller's too. What is shared
 * is the layout.
 */

/** One figure in the phone layout's 2x2 grid. `children` is the value. */
export function MobileStatTile({
  className,
  icon: Icon,
  chipClassName,
  iconClassName,
  label,
  valueClassName,
  children,
}) {
  return (
    <div className={className}>
      <div className="flex items-center gap-2 mb-2">
        <div
          className={`w-8 h-8 rounded-lg ${chipClassName} flex items-center justify-center`}
        >
          <Icon className={`w-4 h-4 ${iconClassName}`} />
        </div>
        <p className="text-xs font-semibold text-content-subtle dark:text-content-muted uppercase tracking-wider">
          {label}
        </p>
      </div>
      <p className={`text-xl font-bold ${valueClassName}`}>{children}</p>
    </div>
  );
}

/**
 * One figure in the desktop header's row. Every figure but the last is
 * `divided` from the next by a rule.
 */
export function DesktopStatTile({
  divided,
  icon: Icon,
  iconClassName,
  label,
  valueClassName,
  children,
}) {
  return (
    <div
      className={
        divided ? "border-r border-line-subtle dark:border-ink-700 pr-8" : undefined
      }
    >
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`w-4 h-4 ${iconClassName}`} />
        <p className="text-xs font-bold text-content-subtle dark:text-content-muted uppercase tracking-wider">
          {label}
        </p>
      </div>
      <p className={`text-3xl font-bold ${valueClassName}`}>{children}</p>
    </div>
  );
}
