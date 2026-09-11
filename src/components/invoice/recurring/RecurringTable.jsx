import React from "react";
import { FileText } from "lucide-react";
import { Table, TableBody, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import RecurringTableRow from "@/components/invoice/recurring/RecurringTableRow";

/** Desktop table of recurring invoices. */
export default function RecurringTable({
  filteredInvoices,
  handleToggleStatus,
  setDeleteDialog,
  updatingStatus,
}) {
  return (
    <div className="hidden lg:block bg-surface dark:bg-ink-800 rounded-2xl border border-line dark:border-ink-700 overflow-hidden shadow-sm">
      <Table>
        <TableHeader>
          <TableRow className="bg-surface-sunken/50 dark:bg-ink-800/50 border-b border-line dark:border-ink-700">
            <TableHead className="h-12 px-6 text-xs font-bold text-content-muted dark:text-content-subtle uppercase tracking-wider w-[200px]">
              <div className="flex items-center gap-2">
                <FileText className="w-3.5 h-3.5" />
                Client
              </div>
            </TableHead>
            <TableHead className="h-12 px-6 text-xs font-bold text-content-muted dark:text-content-subtle uppercase tracking-wider">
              Schedule
            </TableHead>
            <TableHead className="h-12 px-6 text-xs font-bold text-content-muted dark:text-content-subtle uppercase tracking-wider text-right w-[140px]">
              Amount
            </TableHead>
            <TableHead className="h-12 px-6 text-xs font-bold text-content-muted dark:text-content-subtle uppercase tracking-wider w-[140px]">
              Next Date
            </TableHead>
            <TableHead className="h-12 px-6 text-xs font-bold text-content-muted dark:text-content-subtle uppercase tracking-wider w-[140px]">
              Status
            </TableHead>
            <TableHead className="h-12 px-6 text-xs font-bold text-content-muted dark:text-content-subtle uppercase tracking-wider text-right w-[100px]">
              Actions
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredInvoices.map((recurring) => (
            <RecurringTableRow
              key={recurring.id}
              handleToggleStatus={handleToggleStatus}
              recurring={recurring}
              setDeleteDialog={setDeleteDialog}
              updatingStatus={updatingStatus}
            />
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
