import React from "react";
import { Button } from "@/components/ui/button";
import { AlertCircle, Loader2, MoreVertical, Pause, Play } from "lucide-react";
import { getEndLabel, getFrequencyLabel, statusConfig } from "./recurringStatus";

/** One recurring invoice in the phone layout, with pause/resume and the menu. */
export default function RecurringCard({
  handleToggleStatus,
  recurring,
  setMobileMenuOpen,
  updatingStatus,
}) {
  const StatusIcon =
    statusConfig[recurring.status]?.icon || AlertCircle;

  return (
    <div
      className="bg-surface dark:bg-ink-800 rounded-xl border border-line dark:border-ink-700 overflow-hidden shadow-sm active:scale-[0.99] transition-transform"
    >
      <div
        className={`h-1 ${statusConfig[recurring.status]?.indicator || "bg-ink-300"}`}
      />
      <div className="p-4">
        <div className="flex justify-between items-start mb-3">
          <div className="flex-1 min-w-0 pr-4">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-bold text-content dark:text-content-inverted text-sm">
                {recurring.client_name}
              </span>
            </div>
            {recurring.template_name && (
              <p className="text-xs text-content-muted dark:text-content-subtle truncate mb-1">
                {recurring.template_name}
              </p>
            )}
            <p className="text-xs text-content-subtle dark:text-content-muted font-medium">
              {getFrequencyLabel(recurring.frequency)} •{" "}
              {getEndLabel(recurring)}
            </p>
          </div>
          <div className="text-right">
            <p className="font-bold text-success-600 dark:text-success-400 text-lg">
              ${recurring.total.toFixed(2)}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between pt-3 border-t border-ink-50 dark:border-ink-700">
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${statusConfig[recurring.status]?.color || "bg-ink-100"}`}
          >
            <StatusIcon className="w-3 h-3" />
            <span className="capitalize">
              {recurring.status}
            </span>
          </span>

          <div className="flex gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() => handleToggleStatus(recurring)}
              disabled={updatingStatus === recurring.id}
              className="h-9 w-9 border-line dark:border-ink-700 dark:bg-ink-800 rounded-lg active:scale-95 hover:bg-surface-sunken dark:hover:bg-ink-700"
            >
              {updatingStatus === recurring.id ? (
                <Loader2 className="w-4 h-4 animate-spin text-content-body dark:text-content-subtle" />
              ) : recurring.status === "active" ? (
                <Pause className="w-4 h-4 text-warning-600 dark:text-warning-400" />
              ) : (
                <Play className="w-4 h-4 text-success-600 dark:text-success-400" />
              )}
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-9 w-9 border-line dark:border-ink-700 dark:bg-ink-800 rounded-lg active:scale-95 hover:bg-surface-sunken dark:hover:bg-ink-700"
              onClick={() => setMobileMenuOpen(recurring.id)}
            >
              <MoreVertical className="w-4 h-4 text-content-body dark:text-content-subtle" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
