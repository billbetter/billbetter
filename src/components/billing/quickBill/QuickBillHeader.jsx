import React from "react";
import { ArrowLeft } from "lucide-react";

/** Back, the step dots, and what this flow is building. */
export default function QuickBillHeader({
  goBack,
  step,
}) {
  return (
    <div
      className="flex items-center justify-between px-5 pb-3"
      style={{ paddingTop: "max(env(safe-area-inset-top), 1.25rem)" }}
    >
      <button
        onClick={goBack}
        className="w-11 h-11 rounded-full flex items-center justify-center bg-surface dark:bg-surface-inverted border border-line/80 dark:border-ink-800 shadow-sm active:scale-95 transition-transform"
        aria-label="Back"
      >
        <ArrowLeft className="w-5 h-5 text-ink-700 dark:text-ink-300" />
      </button>

      <div className="flex items-center gap-1.5">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className={`h-1.5 rounded-full transition-all duration-300 ${
              i === step
                ? "w-7 bg-success-500"
                : i < step
                  ? "w-1.5 bg-success-500"
                  : "w-1.5 bg-ink-300 dark:bg-ink-700"
            }`}
          />
        ))}
      </div>

      <div className="w-11" />
    </div>
  );
}
