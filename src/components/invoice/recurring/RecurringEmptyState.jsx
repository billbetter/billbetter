import React from "react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { PlusCircle, RefreshCw } from "lucide-react";
import { createPageUrl } from "@/utils";

/** Shown when there are no recurring invoices, or none match the filter. */
export default function RecurringEmptyState({
  searchTerm,
  statusFilter,
}) {
  return (
    <div className="bg-surface dark:bg-ink-800 rounded-2xl border border-line dark:border-ink-700">
      <div className="py-16 px-4 text-center">
        <div className="w-16 h-16 rounded-full bg-success-50 dark:bg-success-900/20 flex items-center justify-center mx-auto mb-4 border border-success-100 dark:border-success-800">
          <RefreshCw className="w-8 h-8 text-success-600 dark:text-success-400" />
        </div>
        <h3 className="text-lg font-black text-content dark:text-content-inverted mb-2">
          {searchTerm || statusFilter !== "all"
            ? "No invoices found"
            : "No recurring invoices"}
        </h3>
        <p className="text-sm text-content-muted dark:text-content-subtle max-w-xs mx-auto mb-6">
          {searchTerm || statusFilter !== "all"
            ? "Try adjusting your search"
            : "Save a template with the client, line items and cadence"}
        </p>
        <Link
          to={createPageUrl("CreateInvoice")}
          state={{ isRecurring: true }}
        >
          <Button className="bg-brand hover:bg-brand-hover text-content-inverted font-bold h-12 px-8 text-base rounded-xl shadow-sm border-0">
            <PlusCircle className="w-5 h-5 mr-2" />
            Create Invoice
          </Button>
        </Link>
      </div>
    </div>
  );
}
