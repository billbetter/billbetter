import React from "react";
import { AlertTriangle } from "lucide-react";

/**
 * Automatic generation does not exist. A RecurringInvoice row is
 * created, listed, edited and deleted, and NOTHING anywhere converts one
 * into an Invoice -- no edge function, no cron job, no client path.
 *
 * Saying so, rather than quietly accepting a schedule and ignoring it.
 * A page that takes a weekly billing cycle and never bills is worse than
 * one that admits it, because the contractor stops chasing that money
 * themselves.
 *
 * The templates are still worth keeping: they hold the client, the line
 * items and the cadence, so they become real the moment the scheduler
 * lands. Remove this notice then.
 *
 */
export default function SchedulerNotRunningNotice() {
  return (
    <div className="rounded-xl border border-warning-300 bg-warning-50 p-4 dark:border-warning-800/50 dark:bg-warning-900/20">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-warning-600 dark:text-warning-400" />
        <div>
          <p className="text-sm font-semibold text-warning-900 dark:text-warning-200">
            Automatic billing isn&apos;t running yet
          </p>
          <p className="mt-1 text-sm text-warning-800 dark:text-warning-300">
            These are saved templates. They hold the client, the line items
            and the schedule, but nothing sends them on its own yet &mdash;
            create each invoice from a template when it is due, and keep
            your own reminder of the date.
          </p>
        </div>
      </div>
    </div>
  );
}
