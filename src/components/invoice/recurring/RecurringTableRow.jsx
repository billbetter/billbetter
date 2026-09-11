import React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertCircle, Calendar, Loader2, Pause, Play, Trash2 } from "lucide-react";
import { TableCell, TableRow } from "@/components/ui/table";
import { formatCalendarDay } from "@/lib/calendarDate";
import { getEndLabel, getFrequencyLabel, statusConfig } from "./recurringStatus";

/** One recurring invoice in the desktop table, with pause/resume and delete. */
export default function RecurringTableRow({
  handleToggleStatus,
  recurring,
  setDeleteDialog,
  updatingStatus,
}) {
  const StatusIcon =
    statusConfig[recurring.status]?.icon || AlertCircle;

  return (
    <TableRow
      className="border-b border-line-subtle dark:border-ink-700 hover:bg-surface-sunken/50 dark:hover:bg-ink-700/50 transition-colors group"
    >
      <TableCell className="py-4 px-6">
        <div className="flex items-center gap-3">
          <div
            className={`w-1 h-8 rounded-full ${statusConfig[recurring.status]?.indicator || "bg-ink-300"}`}
          />
          <div className="flex flex-col">
            <span className="font-bold text-content dark:text-content-inverted text-sm">
              {recurring.client_name}
            </span>
            {recurring.template_name && (
              <span className="text-xs text-content-muted dark:text-content-subtle truncate max-w-[180px]">
                {recurring.template_name}
              </span>
            )}
          </div>
        </div>
      </TableCell>

      <TableCell className="py-4 px-6">
        <Badge
          variant="outline"
          className="text-xs font-bold border-line dark:border-ink-700 text-ink-700 dark:text-ink-300 bg-surface dark:bg-ink-800 px-2.5 py-1"
        >
          {getFrequencyLabel(recurring.frequency)}
        </Badge>
        <p className="text-xs text-content-subtle dark:text-content-muted mt-1.5 font-medium">
          {getEndLabel(recurring)}
        </p>
      </TableCell>

      <TableCell className="py-4 px-6 text-right">
        <span className="font-bold text-success-600 dark:text-success-400 text-base">
          ${recurring.total.toFixed(2)}
        </span>
      </TableCell>

      <TableCell className="py-4 px-6">
        {recurring.next_generation_date ? (
          <div className="flex items-center gap-2 text-sm text-ink-700 dark:text-ink-300">
            <Calendar className="w-4 h-4 text-content-subtle dark:text-content-muted" />
            {formatCalendarDay(
              recurring.next_generation_date,
              "MMM d, yyyy",
            )}
          </div>
        ) : (
          <span className="text-content-subtle dark:text-content-muted text-sm">
            -
          </span>
        )}
      </TableCell>

      <TableCell className="py-4 px-6">
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${statusConfig[recurring.status]?.color || statusConfig.cancelled.color}`}
        >
          <StatusIcon className="w-3.5 h-3.5" />
          {statusConfig[recurring.status]?.label ||
            recurring.status}
        </span>
      </TableCell>

      <TableCell className="text-right py-4 px-6">
        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            variant="outline"
            size="icon"
            onClick={() => handleToggleStatus(recurring)}
            disabled={updatingStatus === recurring.id}
            className="h-8 w-8 border-line dark:border-ink-700 bg-surface dark:bg-ink-800 hover:bg-surface-sunken dark:hover:bg-ink-700 rounded-lg"
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
            onClick={() =>
              setDeleteDialog({
                open: true,
                invoice: recurring,
              })
            }
            className="h-8 w-8 border-line dark:border-ink-700 bg-surface dark:bg-ink-800 hover:bg-danger-50 dark:hover:bg-danger-900/30 hover:border-danger-200 dark:hover:border-danger-800 rounded-lg"
          >
            <Trash2 className="w-4 h-4 text-content-body dark:text-content-subtle hover:text-danger-600 dark:hover:text-danger-400" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}
