import React from "react";
import { Filter, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { VOID_STATUS } from "@/lib/invoiceVoid";

/** Search by client or number, and filter by status. */
export default function InvoiceFilterBar({
  searchTerm,
  setSearchTerm,
  setStatusFilter,
  statusFilter,
}) {
  return (
    <div className="bg-surface dark:bg-surface-inverted rounded-xl border border-line-subtle dark:border-ink-800 p-4 shadow-sm">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 relative group">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-content-subtle w-4 h-4 group-focus-within:text-content-body dark:group-focus-within:text-ink-300 transition-colors" />
          <Input
            placeholder="Search by client or number..."
            aria-label="Search invoices by client or number"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 h-11 border-line dark:border-ink-700 dark:bg-surface-inverted dark:text-content-inverted rounded-xl text-sm focus-visible:ring-2 focus-visible:ring-ink-200 dark:focus-visible:ring-ink-700"
          />
        </div>
        <div className="w-full sm:w-56">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-11 border-line dark:border-ink-700 dark:bg-surface-inverted dark:text-content-inverted rounded-xl text-sm focus:ring-2 focus:ring-ink-200 dark:focus:ring-ink-700">
              <Filter className="w-4 h-4 mr-2 text-content-muted dark:text-content-subtle" />
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent className="rounded-xl dark:bg-ink-800 dark:border-ink-700">
              <SelectItem
                value="all"
                className="dark:text-ink-300 dark:focus:bg-ink-700"
              >
                All Statuses
              </SelectItem>
              <SelectItem
                value="draft"
                className="dark:text-ink-300 dark:focus:bg-ink-700"
              >
                Draft
              </SelectItem>
              <SelectItem
                value="sent"
                className="dark:text-ink-300 dark:focus:bg-ink-700"
              >
                Sent
              </SelectItem>
              <SelectItem
                value="paid"
                className="dark:text-ink-300 dark:focus:bg-ink-700"
              >
                Paid
              </SelectItem>
              <SelectItem
                value="overdue"
                className="dark:text-ink-300 dark:focus:bg-ink-700"
              >
                Overdue
              </SelectItem>
              <SelectItem
                value="cancelled"
                className="dark:text-ink-300 dark:focus:bg-ink-700"
              >
                Cancelled
              </SelectItem>
              <SelectItem
                value={VOID_STATUS}
                className="dark:text-ink-300 dark:focus:bg-ink-700"
              >
                Voided
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}
