import React from "react";
import { Button } from "@/components/ui/button";
import { MoreVertical, PlusCircle, RefreshCw, RotateCcw } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import PageHeader from "@/components/layout/PageHeader";
import RecurringMobileStats from "@/components/invoice/recurring/RecurringMobileStats";

/** Phone layout's top of the recurring-invoice list: title, refresh, the four
 * headline figures and the New button. */
export default function RecurringMobileHeader({
  loadRecurringInvoices,
  refreshing,
  stats,
}) {
  return (
    <div className="lg:hidden mb-6 space-y-4">
      <PageHeader
        className="flex-row items-center sm:items-center"
        title="Recurring"
        description={`${stats.total} invoices`}
        actions={
          <>
            <Button
              onClick={() => loadRecurringInvoices(true)}
              variant="outline"
              size="icon"
              disabled={refreshing}
              aria-label="Refresh"
            >
              <RefreshCw className={refreshing ? "animate-spin" : ""} />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" aria-label="More">
                  <MoreVertical />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={() => loadRecurringInvoices(true)}>
                  <RotateCcw />
                  Refresh
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        }
      />

      <RecurringMobileStats stats={stats} />

      <Button asChild size="lg" className="w-full">
        <Link to={createPageUrl("CreateInvoice")} state={{ isRecurring: true }}>
          <PlusCircle />
          Create Recurring
        </Link>
      </Button>
    </div>
  );
}
