import React from "react";
import { Button } from "@/components/ui/button";
import { FileText, PlusCircle } from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import InvoiceCard from "@/components/invoice/list/InvoiceCard";

/** The phone layout's invoice list: one card per invoice. */
export default function InvoiceCardList({
  batchRunning,
  eligibility,
  filteredInvoices,
  paymentsByInvoice,
  searchTerm,
  selectMode,
  selectedIds,
  setMobileMenuOpen,
  setMobileStatusPicker,
  statusFilter,
  toggleOne,
  updatingStatus,
}) {
  return (
    <div className="lg:hidden space-y-3">
      {filteredInvoices.length === 0 ? (
        <div className="bg-surface dark:bg-ink-800 rounded-xl border border-line dark:border-ink-700 p-8 text-center shadow-sm">
          <div className="w-16 h-16 rounded-full bg-ink-100 dark:bg-ink-700 flex items-center justify-center mx-auto mb-3">
            <FileText className="w-8 h-8 text-content-subtle dark:text-content-muted" />
          </div>
          <h3 className="text-lg font-black text-content dark:text-content-inverted mb-1">
            {searchTerm || statusFilter !== "all"
              ? "No invoices found"
              : "No invoices yet"}
          </h3>
          <p className="text-sm text-content-muted dark:text-content-subtle mb-4">
            {searchTerm || statusFilter !== "all"
              ? "Adjust your filters"
              : "Create your first invoice"}
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
        <div className="space-y-3">
          {filteredInvoices.map((invoice) => (
            <InvoiceCard
              key={invoice.id}
              batchRunning={batchRunning}
              eligibility={eligibility}
              invoice={invoice}
              paymentsByInvoice={paymentsByInvoice}
              selectMode={selectMode}
              selectedIds={selectedIds}
              setMobileMenuOpen={setMobileMenuOpen}
              setMobileStatusPicker={setMobileStatusPicker}
              toggleOne={toggleOne}
              updatingStatus={updatingStatus}
            />
          ))}
        </div>
      )}
    </div>
  );
}
