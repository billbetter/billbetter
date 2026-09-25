import React from "react";
import { Button } from "@/components/ui/button";
import { MoreVertical, PlusCircle, RefreshCw } from "lucide-react";
import { DropdownMenu, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import PageHeader from "@/components/layout/PageHeader";
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
    <div className="lg:hidden mb-6 space-y-4">
      <PageHeader
        className="flex-row items-center sm:items-center"
        title="Quotes"
        description={`${stats.total} quotes`}
        actions={
          <>
            <Button
              onClick={() => loadData(true)}
              variant="outline"
              size="icon"
              disabled={refreshing}
              aria-label="Refresh"
            >
              <RefreshCw className={refreshing ? "animate-spin" : ""} />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" aria-label="Actions">
                  <MoreVertical />
                </Button>
              </DropdownMenuTrigger>
              <QuoteActionsMenuContent handleExportQuotes={handleExportQuotes} />
            </DropdownMenu>
          </>
        }
      />

      <QuoteMobileStats stats={stats} />

      <Button asChild size="lg" className="w-full">
        <Link to={createPageUrl("CreateQuote")}>
          <PlusCircle />
          Create New Quote
        </Link>
      </Button>
    </div>
  );
}
