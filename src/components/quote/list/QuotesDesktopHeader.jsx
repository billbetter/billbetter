import React from "react";
import { Button } from "@/components/ui/button";
import { ClipboardList, MoreVertical, PlusCircle, RefreshCw } from "lucide-react";
import { DropdownMenu, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import QuoteDesktopStats from "@/components/quote/list/QuoteDesktopStats";
import QuoteActionsMenuContent from "@/components/quote/list/QuoteActionsMenuContent";

/** Desktop top of the quote list: title, Refresh / Actions / New Quote, and
 * the five headline figures. */
export default function QuotesDesktopHeader({
  exporting,
  handleExportToExcel,
  loadData,
  refreshing,
  stats,
}) {
  return (
    <div className="hidden lg:block">
      <div className="bg-surface dark:bg-ink-800 rounded-2xl border border-line dark:border-ink-700 p-6 shadow-sm">
        <div className="flex items-start justify-between mb-8">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-brand flex items-center justify-center shadow-lg shadow-brand-200 dark:shadow-brand-900/30">
              <ClipboardList className="w-6 h-6 text-content-inverted" />
            </div>
            <div>
              <h1 className="text-3xl font-black text-content dark:text-content-inverted tracking-tight">
                Quotes & Estimates
              </h1>
              <p className="text-sm text-content-muted dark:text-content-subtle mt-1 font-medium">
                Create and manage professional quotes
              </p>
            </div>
          </div>

          <div className="flex gap-3">
            <Button
              onClick={() => loadData(true)}
              variant="outline"
              disabled={refreshing}
              className="h-10 px-4 rounded-xl border-line dark:border-ink-700 text-sm font-medium shadow-sm hover:bg-surface-sunken dark:hover:bg-ink-700 active:scale-95 transition-all dark:bg-ink-800 dark:text-ink-300"
            >
              <RefreshCw
                className={`w-4 h-4 mr-2 ${refreshing ? "animate-spin" : ""}`}
              />
              Refresh
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  className="h-10 px-4 rounded-xl border-line dark:border-ink-700 text-sm font-medium shadow-sm hover:bg-surface-sunken dark:hover:bg-ink-700 active:scale-95 transition-all dark:bg-ink-800 dark:text-ink-300"
                >
                  <MoreVertical className="w-4 h-4 mr-2" />
                  Actions
                </Button>
              </DropdownMenuTrigger>
              <QuoteActionsMenuContent
                exporting={exporting}
                handleExportToExcel={handleExportToExcel}
              />
            </DropdownMenu>

            <Link to={createPageUrl("CreateQuote")}>
              <Button className="bg-brand hover:bg-brand-hover dark:bg-brand dark:hover:bg-brand-hover text-content-inverted h-10 px-5 text-sm font-semibold rounded-xl shadow-sm active:scale-95 transition-all">
                <PlusCircle className="w-4 h-4 mr-2" />
                New Quote
              </Button>
            </Link>
          </div>
        </div>

        <QuoteDesktopStats
          stats={stats}
        />
      </div>
    </div>
  );
}
