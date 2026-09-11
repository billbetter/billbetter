import React from "react";
import { Button } from "@/components/ui/button";
import { MoreVertical, PlusCircle, RefreshCw, RotateCcw } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import RecurringMobileStats from "@/components/invoice/recurring/RecurringMobileStats";

/** Phone layout's top of the recurring-invoice list: title, refresh, the four
 * headline figures and the New button. */
export default function RecurringMobileHeader({
  loadRecurringInvoices,
  refreshing,
  stats,
}) {
  return (
    <div className="lg:hidden">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-success-600 flex items-center justify-center shadow-lg shadow-success-200 dark:shadow-success-900/30">
            <RefreshCw className="w-5 h-5 text-content-inverted" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-content dark:text-content-inverted tracking-tight">
              Recurring
            </h1>
            <p className="text-sm text-content-muted dark:text-content-subtle font-medium">
              {stats.total} invoices
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => loadRecurringInvoices(true)}
            variant="outline"
            size="icon"
            disabled={refreshing}
            className="h-10 w-10 rounded-xl border-line dark:border-ink-700 bg-surface dark:bg-ink-800 shadow-sm active:scale-95 transition-all hover:bg-surface-sunken dark:hover:bg-ink-700"
          >
            <RefreshCw
              className={`w-4 h-4 text-content-body dark:text-content-subtle ${refreshing ? "animate-spin" : ""}`}
            />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="h-10 w-10 rounded-xl border-line dark:border-ink-700 bg-surface dark:bg-ink-800 shadow-sm active:scale-95 transition-all hover:bg-surface-sunken dark:hover:bg-ink-700"
              >
                <MoreVertical className="w-4 h-4 text-content-body dark:text-content-subtle" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="w-48 rounded-xl shadow-lg dark:bg-ink-800 dark:border-ink-700"
            >
              <DropdownMenuItem
                onClick={() => loadRecurringInvoices(true)}
                className="rounded-lg dark:text-ink-300 dark:focus:bg-ink-700"
              >
                <RotateCcw className="w-4 h-4 mr-2 text-content-body dark:text-content-subtle" />
                Refresh
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <RecurringMobileStats
        stats={stats}
      />

      <Link
        to={createPageUrl("CreateInvoice")}
        state={{ isRecurring: true }}
        className="block mb-6"
      >
        <Button className="w-full h-12 bg-brand hover:bg-brand-hover dark:bg-brand dark:hover:bg-brand-hover text-content-inverted rounded-xl font-semibold shadow-sm active:scale-[0.98] transition-all">
          <PlusCircle className="w-5 h-5 mr-2" />
          Create Recurring
        </Button>
      </Link>
    </div>
  );
}
