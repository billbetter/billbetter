import React from "react";
import { Button } from "@/components/ui/button";
import { ClipboardList, MoreVertical, PlusCircle, RefreshCw } from "lucide-react";
import { DropdownMenu, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import QuoteMobileStats from "@/components/quote/list/QuoteMobileStats";
import QuoteActionsMenuContent from "@/components/quote/list/QuoteActionsMenuContent";

/** Phone layout's top of the quote list: title, actions menu, the four
 * headline figures and the New Quote button. */
export default function QuotesMobileHeader({
  handleExportQuotes,
  loadData,
  refreshing,
  stats,
}) {
  return (
    <div className="lg:hidden">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand flex items-center justify-center shadow-lg shadow-brand-200 dark:shadow-brand-900/30">
            <ClipboardList className="w-5 h-5 text-content-inverted" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-content dark:text-content-inverted tracking-tight">
              Quotes
            </h1>
            <p className="text-sm text-content-muted dark:text-content-subtle font-medium">
              {stats.total} quotes
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => loadData(true)}
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
            <QuoteActionsMenuContent
              handleExportQuotes={handleExportQuotes}
            />
          </DropdownMenu>
        </div>
      </div>

      <QuoteMobileStats
        stats={stats}
      />

      <Link to={createPageUrl("CreateQuote")} className="block mb-6">
        <Button className="w-full h-12 bg-brand hover:bg-brand-hover dark:bg-brand dark:hover:bg-brand-hover text-content-inverted rounded-xl font-semibold shadow-sm active:scale-[0.98] transition-all">
          <PlusCircle className="w-5 h-5 mr-2" />
          Create New Quote
        </Button>
      </Link>
    </div>
  );
}
