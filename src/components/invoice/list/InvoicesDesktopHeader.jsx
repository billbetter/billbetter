import React from "react";
import { MoreVertical, PlusCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import PageHeader from "@/components/layout/PageHeader";
import InvoiceActionsMenuContent from "./InvoiceActionsMenuContent";
import InvoiceDesktopStats from "@/components/invoice/list/InvoiceDesktopStats";

/** Desktop top of the invoice list: title, Refresh / Actions / New Invoice,
 * and the five headline figures. */
export default function InvoicesDesktopHeader({
  checkingOverdue,
  handleCheckOverdue,
  handleExportInvoices,
  loadData,
  refreshing,
  stats,
}) {
  return (
    <div className="hidden lg:block space-y-4">
      <PageHeader
        title="Invoices"
        description="Manage and track your billing"
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
              <InvoiceActionsMenuContent
                checkingOverdue={checkingOverdue}
                handleCheckOverdue={handleCheckOverdue}
                handleExportInvoices={handleExportInvoices}
                withBatchImport
              />
            </DropdownMenu>

            <Button asChild>
              <Link to={createPageUrl("CreateInvoice")}>
                <PlusCircle />
                New Invoice
              </Link>
            </Button>
          </>
        }
      />

      <InvoiceDesktopStats stats={stats} />
    </div>
  );
}
