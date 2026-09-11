import React from "react";
import { Clock, DollarSign, FileText, PlusCircle, TrendingUp, UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Link } from "react-router-dom";
import { Table, TableBody, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { createPageUrl } from "@/utils";
import InvoiceTableRow from "@/components/invoice/list/InvoiceTableRow";

/** The desktop invoice table: one row per invoice with status, amounts,
 * paid-so-far, read receipt and a per-row actions menu. */
export default function InvoiceTable({
  allSelectableChosen,
  batchRunning,
  eligibility,
  filteredInvoices,
  handleStatusChange,
  paymentsByInvoice,
  searchTerm,
  selectMode,
  selectedIds,
  setDeleteDialog,
  setNotificationDialog,
  statusFilter,
  toggleAll,
  toggleOne,
  updatingStatus,
}) {
  return (
    <div className="hidden lg:block bg-surface dark:bg-surface-inverted rounded-xl border border-line-subtle dark:border-ink-800 overflow-hidden shadow-sm">
      {filteredInvoices.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-16 h-16 rounded-full bg-ink-100 dark:bg-ink-700 flex items-center justify-center mx-auto mb-4">
            <FileText className="w-8 h-8 text-content-subtle dark:text-content-muted" />
          </div>
          <h3 className="text-lg font-black text-content dark:text-content-inverted mb-2">
            {searchTerm || statusFilter !== "all"
              ? "No invoices found"
              : "No invoices yet"}
          </h3>
          <p className="text-sm text-content-muted dark:text-content-subtle mb-6">
            {searchTerm || statusFilter !== "all"
              ? "Try adjusting your search"
              : "Create your first invoice to get started"}
          </p>
          {!searchTerm && statusFilter === "all" && (
            <Link to={createPageUrl("CreateInvoice")}>
              <Button className="h-11 px-6 bg-brand hover:bg-brand-hover text-content-inverted rounded-xl font-semibold">
                <PlusCircle className="w-5 h-5 mr-2" />
                Create Invoice
              </Button>
            </Link>
          )}
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow className="bg-surface-sunken/50 dark:bg-ink-800/50 border-b border-line dark:border-ink-700">
              {selectMode && (
                <TableHead className="h-12 w-[52px] pl-6 pr-0">
                  <Checkbox
                    checked={allSelectableChosen}
                    onCheckedChange={toggleAll}
                    disabled={batchRunning}
                    aria-label="Select all sendable invoices"
                  />
                </TableHead>
              )}
              <TableHead className="h-12 px-6 text-xs font-bold text-content-muted dark:text-content-subtle uppercase tracking-wider w-[180px]">
                <div className="flex items-center gap-2">
                  <FileText className="w-3.5 h-3.5" />
                  Invoice
                </div>
              </TableHead>
              <TableHead className="h-12 px-6 text-xs font-bold text-content-muted dark:text-content-subtle uppercase tracking-wider">
                <div className="flex items-center gap-2">
                  <UserCheck className="w-3.5 h-3.5" />
                  Client
                </div>
              </TableHead>
              <TableHead className="h-12 px-6 text-xs font-bold text-content-muted dark:text-content-subtle uppercase tracking-wider w-[160px]">
                <div className="flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5" />
                  Date
                </div>
              </TableHead>
              <TableHead className="h-12 px-6 text-xs font-bold text-content-muted dark:text-content-subtle uppercase tracking-wider text-right w-[140px]">
                <div className="flex items-center justify-end gap-2">
                  <DollarSign className="w-3.5 h-3.5" />
                  Amount
                </div>
              </TableHead>
              <TableHead className="h-12 px-6 text-xs font-bold text-content-muted dark:text-content-subtle uppercase tracking-wider w-[140px]">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-3.5 h-3.5" />
                  Status
                </div>
              </TableHead>
              <TableHead className="h-12 px-6 text-xs font-bold text-content-muted dark:text-content-subtle uppercase tracking-wider text-center w-[120px]">
                Actions
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredInvoices.map((invoice) => (
              <InvoiceTableRow
                key={invoice.id}
                batchRunning={batchRunning}
                eligibility={eligibility}
                handleStatusChange={handleStatusChange}
                invoice={invoice}
                paymentsByInvoice={paymentsByInvoice}
                selectMode={selectMode}
                selectedIds={selectedIds}
                setDeleteDialog={setDeleteDialog}
                setNotificationDialog={setNotificationDialog}
                toggleOne={toggleOne}
                updatingStatus={updatingStatus}
              />
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
