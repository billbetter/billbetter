import React from "react";
import { Wrench } from "lucide-react";

/** The builder's title block, and the trade it prices for. */
export default function DocumentBuilderHeader({
  Icon,
  subtitle,
  title,
  userSpecialty,
}) {
  return (
    <div className="mb-4 sm:mb-6 lg:mb-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-ink-800 flex items-center justify-center shadow-lg ring-1 ring-ink-900/10 dark:ring-content-inverted/10 shrink-0">
            <Icon className="w-5 h-5 sm:w-6 sm:h-6 text-content-inverted" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-black text-content dark:text-ink-50 tracking-tight truncate">
              {title}
            </h1>
            <p className="text-content-body dark:text-content-subtle text-xs sm:text-sm mt-0.5 truncate">
              {subtitle}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex items-center gap-2 px-3 py-1.5 sm:px-4 sm:py-2 bg-surface dark:bg-surface-inverted rounded-xl border border-line dark:border-ink-700 shadow-sm">
            <Wrench className="w-4 h-4 text-brand-700 dark:text-brand-400" />
            <span className="text-xs sm:text-sm font-medium text-ink-700 dark:text-ink-300 capitalize truncate max-w-[100px] sm:max-w-[150px]">
              {userSpecialty.replace("_", " ")}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
