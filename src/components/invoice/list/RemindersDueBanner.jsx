import React from "react";
import { Button } from "@/components/ui/button";
import { Send } from "lucide-react";

/**
 * Reminders that are due today.
 *
 * Nothing sends on its own -- this only says which invoices the ladder thinks
 * are ready, and hands them to the same batch send the contractor already
 * uses. Reviewing means selecting exactly these and nothing else, so the
 * decision to mail a client is always a click someone made.
 */
export default function RemindersDueBanner({
  remindersDue,
  selectMode,
  setSelectMode,
  setSelectedIds,
}) {
  return <>
    {remindersDue.length > 0 && !selectMode && (
      <div className="rounded-xl border border-caution-200 bg-caution-50 p-4 shadow-sm dark:border-caution-800 dark:bg-caution-900/20">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-bold text-caution-900 dark:text-caution-200">
              {remindersDue.length}{" "}
              {remindersDue.length === 1 ? "reminder is" : "reminders are"}{" "}
              due
            </p>
            <p className="mt-1 text-sm text-caution-800 dark:text-caution-300">
              {remindersDue
                .slice(0, 3)
                .map(
                  (r) =>
                    `${r.invoice.invoice_number || "Invoice"} · ${r.invoice.client_name || "client"} · ${r.status.daysOverdue} days over`,
                )
                .join(" — ")}
              {remindersDue.length > 3
                ? ` — and ${remindersDue.length - 3} more`
                : ""}
            </p>
          </div>
          <Button
            onClick={() => {
              setSelectedIds(new Set(remindersDue.map((r) => r.invoice.id)));
              setSelectMode(true);
            }}
            className="flex-shrink-0 bg-brand hover:bg-brand-hover text-content-inverted"
          >
            <Send className="mr-2 h-4 w-4" />
            Review {remindersDue.length}
          </Button>
        </div>
      </div>
    )}
    </>;
}
