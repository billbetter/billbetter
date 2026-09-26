import React from "react";
import { Button } from "@/components/ui/button";
import { PlusCircle, RefreshCw } from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import PageHeader from "@/components/layout/PageHeader";
import RecurringDesktopStats from "@/components/invoice/recurring/RecurringDesktopStats";

/** Desktop top of the recurring-invoice list: title, actions and the five
 * headline figures. */
export default function RecurringDesktopHeader({
  loadRecurringInvoices,
  refreshing,
  stats,
}) {
  return (
    <div className="hidden lg:block space-y-4">
      <PageHeader
        title="Recurring Invoices"
        description="Automate your repeat billing"
        actions={
          <>
            <Button onClick={() => loadRecurringInvoices(true)} variant="outline" disabled={refreshing}>
              <RefreshCw className={refreshing ? "animate-spin" : ""} />
              Refresh
            </Button>

            <Button asChild>
              <Link to={createPageUrl("CreateInvoice")} state={{ isRecurring: true }}>
                <PlusCircle />
                New Recurring
              </Link>
            </Button>
          </>
        }
      />

      <RecurringDesktopStats stats={stats} />
    </div>
  );
}
