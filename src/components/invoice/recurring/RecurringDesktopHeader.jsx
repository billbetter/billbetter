import React from "react";
import { Button } from "@/components/ui/button";
import { PlusCircle, RefreshCw } from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import RecurringDesktopStats from "@/components/invoice/recurring/RecurringDesktopStats";

/** Desktop top of the recurring-invoice list: title, actions and the five
 * headline figures. */
export default function RecurringDesktopHeader({
  loadRecurringInvoices,
  refreshing,
  stats,
}) {
  return (
    <div className="hidden lg:block">
      <div className="bg-surface dark:bg-ink-800 rounded-2xl border border-line dark:border-ink-700 p-6 shadow-sm">
        <div className="flex items-start justify-between mb-8">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-success-600 flex items-center justify-center shadow-lg shadow-success-200 dark:shadow-success-900/30">
              <RefreshCw className="w-6 h-6 text-content-inverted" />
            </div>
            <div>
              <h1 className="text-3xl font-black text-content dark:text-content-inverted tracking-tight">
                Recurring Invoices
              </h1>
              <p className="text-sm text-content-muted dark:text-content-subtle mt-1 font-medium">
                Automate your repeat billing
              </p>
            </div>
          </div>

          <div className="flex gap-3">
            <Button
              onClick={() => loadRecurringInvoices(true)}
              variant="outline"
              disabled={refreshing}
              className="h-10 px-4 rounded-xl border-line dark:border-ink-700 text-sm font-medium shadow-sm hover:bg-surface-sunken dark:hover:bg-ink-700 active:scale-95 transition-all dark:bg-ink-800 dark:text-ink-300"
            >
              <RefreshCw
                className={`w-4 h-4 mr-2 ${refreshing ? "animate-spin" : ""}`}
              />
              Refresh
            </Button>

            <Link
              to={createPageUrl("CreateInvoice")}
              state={{ isRecurring: true }}
            >
              <Button className="bg-brand hover:bg-brand-hover text-content-inverted h-10 px-5 text-sm font-semibold rounded-xl shadow-sm active:scale-95 transition-all">
                <PlusCircle className="w-4 h-4 mr-2" />
                New Recurring
              </Button>
            </Link>
          </div>
        </div>

        <RecurringDesktopStats
          stats={stats}
        />
      </div>
    </div>
  );
}
