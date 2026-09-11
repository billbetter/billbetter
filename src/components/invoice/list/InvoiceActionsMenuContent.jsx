import React from "react";
import { Link } from "react-router-dom";
import { AlertCircle, Download, FileSpreadsheet, Loader2 } from "lucide-react";
import { DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { createPageUrl } from "@/utils";

/**
 * The invoice list's Actions menu, opened from either header. The phone
 * header leaves out Batch / import (`withBatchImport`); the rest is one menu.
 */
export default function InvoiceActionsMenuContent({
  checkingOverdue,
  handleCheckOverdue,
  handleExportInvoices,
  withBatchImport,
}) {
  return (
    <DropdownMenuContent
      align="end"
      className="w-48 rounded-xl shadow-lg dark:bg-ink-800 dark:border-ink-700"
    >
      <DropdownMenuItem
        onClick={handleCheckOverdue}
        disabled={checkingOverdue}
        className="rounded-lg dark:text-ink-300 dark:focus:bg-ink-700"
      >
        {checkingOverdue && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
        {!checkingOverdue && <AlertCircle className="w-4 h-4 mr-2 text-alert-500" />}
        Check Overdue
      </DropdownMenuItem>
      <DropdownMenuItem
        onClick={handleExportInvoices}
        className="rounded-lg dark:text-ink-300 dark:focus:bg-ink-700"
      >
        <Download className="w-4 h-4 mr-2 text-content-body dark:text-content-subtle" />
        Export CSV
      </DropdownMenuItem>
      {/* Sits beside Export CSV on purpose: exporting and importing are the
          same shape of task, and this is where someone who has just exported
          will look. */}
      {withBatchImport && (
        <DropdownMenuItem asChild>
          <Link
            to={createPageUrl("BatchInvoices")}
            className="rounded-lg dark:text-ink-300 dark:focus:bg-ink-700"
          >
            <FileSpreadsheet className="w-4 h-4 mr-2 text-content-body dark:text-content-subtle" />
            Batch / import
          </Link>
        </DropdownMenuItem>
      )}
    </DropdownMenuContent>
  );
}
