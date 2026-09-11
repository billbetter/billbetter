import React from "react";
import { Loader2 } from "lucide-react";

/** Full-page spinner a list page shows before its first rows arrive. */
export default function ListLoadingState({
  label,
  spinnerClassName = "text-brand-700 dark:text-brand-400",
}) {
  return (
    <div className="flex items-center justify-center min-h-screen bg-surface-sunken dark:bg-surface-inverted-deep">
      <div className="flex flex-col items-center gap-4">
        <div className="w-16 h-16 rounded-2xl bg-surface dark:bg-ink-800 shadow-lg flex items-center justify-center border border-line-subtle dark:border-ink-700">
          <Loader2 className={`w-8 h-8 animate-spin ${spinnerClassName}`} />
        </div>
        <div className="text-center">
          <p className="text-content dark:text-content-inverted font-semibold text-base">
            {label}
          </p>
          <p className="text-content-muted dark:text-content-subtle text-sm mt-1">
            Please wait a moment...
          </p>
        </div>
      </div>
    </div>
  );
}
