import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { RefreshCw } from "lucide-react";

/** Switches the form between a one-off invoice and a recurring schedule. */
export default function RecurringToggleCard({
  isRecurring,
  setIsRecurring,
}) {
  return (
    <Card className="border-0 shadow-lg bg-surface dark:bg-surface-inverted overflow-hidden ring-1 ring-ink-200 dark:ring-ink-700">
      <CardContent className="p-4 sm:p-6">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 sm:gap-4 min-w-0">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-brand flex items-center justify-center shadow-lg shrink-0">
              <RefreshCw className="w-5 h-5 sm:w-6 sm:h-6 text-content-inverted" />
            </div>
            <div className="min-w-0">
              <h3 className="text-base sm:text-lg font-black text-content dark:text-ink-50 truncate">
                Recurring Billing
              </h3>
              <p className="text-xs sm:text-sm text-content-muted dark:text-content-subtle truncate">
                For maintenance contracts & retainers
              </p>
            </div>
          </div>
          <label className="relative inline-flex items-center cursor-pointer shrink-0">
            <input
              type="checkbox"
              checked={isRecurring}
              onChange={(e) => setIsRecurring(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-12 sm:w-14 h-6 sm:h-7 bg-ink-200 dark:bg-ink-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-info-300 dark:peer-focus:ring-info-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-content-inverted after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-surface after:border-line-strong dark:after:border-ink-600 after:border after:rounded-full after:h-5 sm:after:h-6 after:w-5 sm:after:w-6 after:transition-all peer-checked:bg-info-600 dark:after:bg-surface-inverted"></div>
          </label>
        </div>
      </CardContent>
    </Card>
  );
}
