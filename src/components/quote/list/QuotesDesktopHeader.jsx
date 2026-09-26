import React from "react";
import { Button } from "@/components/ui/button";
import { MoreVertical, PlusCircle, RefreshCw } from "lucide-react";
import { DropdownMenu, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import PageHeader from "@/components/layout/PageHeader";
import QuoteDesktopStats from "@/components/quote/list/QuoteDesktopStats";
import QuoteActionsMenuContent from "@/components/quote/list/QuoteActionsMenuContent";

/** Desktop top of the quote list: title, Refresh / Actions / New Quote, and
 * the five headline figures. */
export default function QuotesDesktopHeader({
  handleExportQuotes,
  loadData,
  refreshing,
  stats,
}) {
  return (
    <div className="hidden lg:block space-y-4">
      <PageHeader
        title="Quotes & Estimates"
        description="Create and manage professional quotes"
        actions={
          <>
            <Button onClick={() => loadData(true)} variant="outline" disabled={refreshing}>
              <RefreshCw className={refreshing ? "animate-spin" : ""} />
              Refresh
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">
                  <MoreVertical />
                  Actions
                </Button>
              </DropdownMenuTrigger>
              <QuoteActionsMenuContent handleExportQuotes={handleExportQuotes} />
            </DropdownMenu>

            <Button asChild>
              <Link to={createPageUrl("CreateQuote")}>
                <PlusCircle />
                New Quote
              </Link>
            </Button>
          </>
        }
      />

      <QuoteDesktopStats stats={stats} />
    </div>
  );
}
