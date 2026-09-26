import React from "react";
import { MoreVertical, PlusCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import PageHeader from "@/components/layout/PageHeader";
import InvoiceActionsMenuContent from "./InvoiceActionsMenuContent";
import InvoiceMobileStats from "@/components/invoice/list/InvoiceMobileStats";

/** Phone layout's top of the invoice list: title, actions menu, the four
 * headline figures and the New Invoice button. */
export default function InvoicesMobileHeader({
  checkingOverdue,
  handleCheckOverdue,
  handleExportInvoices,
  loadData,
  refreshing,
  stats,
}) {
  return (
    <div className="lg:hidden mb-6 space-y-4">
      <PageHeader
        className="flex-row items-center sm:items-center"
        title="Invoices"
        description={`${stats.total} invoices`}
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
              <InvoiceActionsMenuContent
                checkingOverdue={checkingOverdue}
                handleCheckOverdue={handleCheckOverdue}
                handleExportInvoices={handleExportInvoices}
              />
            </DropdownMenu>
          </>
        }
      />

      <InvoiceMobileStats stats={stats} />

      <Button asChild size="lg" className="w-full">
        <Link to={createPageUrl("CreateInvoice")}>
          <PlusCircle />
          Create New Invoice
        </Link>
      </Button>
    </div>
  );
}
