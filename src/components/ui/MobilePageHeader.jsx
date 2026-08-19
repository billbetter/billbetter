import React from "react";

/**
 * Unified mobile page header used across all app pages.
 * Shows on mobile only (hidden lg:hidden).
 * Provides consistent title + subtitle + optional right actions.
 */
export default function MobilePageHeader({
  icon: Icon,
  iconColor = "bg-success-600",
  title,
  subtitle,
  actions,
}) {
  return (
    <div className="lg:hidden flex items-center justify-between mb-5">
      <div className="flex items-center gap-3 min-w-0 flex-1">
        {Icon && (
          <div
            className={`w-10 h-10 rounded-xl ${iconColor} flex items-center justify-center shadow-lg flex-shrink-0`}
          >
            <Icon className="w-5 h-5 text-content-inverted" />
          </div>
        )}
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-content dark:text-content-inverted tracking-tight truncate">
            {title}
          </h1>
          {subtitle && (
            <p className="text-xs text-content-muted dark:text-content-subtle font-medium truncate">
              {subtitle}
            </p>
          )}
        </div>
      </div>
      {actions && (
        <div className="flex items-center gap-2 flex-shrink-0 ml-3">
          {actions}
        </div>
      )}
    </div>
  );
}
