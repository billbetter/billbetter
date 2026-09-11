import React from "react";
import FeatureGate from "@/components/access/FeatureGate";
import RecurringCardList from "@/components/invoice/recurring/RecurringCardList";
import RecurringTable from "@/components/invoice/recurring/RecurringTable";
import RecurringEmptyState from "@/components/invoice/recurring/RecurringEmptyState";

/** The recurring-invoice list behind the plan gate: empty state, desktop
 * table and phone cards. */
export default function RecurringInvoiceList({
  filteredInvoices,
  handleToggleStatus,
  hasRecurringAccess,
  searchTerm,
  setDeleteDialog,
  setMobileMenuOpen,
  statusFilter,
  updatingStatus,
}) {
  return (
    <FeatureGate
      hasAccess={hasRecurringAccess}
      featureName="recurring_invoices"
      mode="blur"
    >
      {filteredInvoices.length === 0 ? (
        <RecurringEmptyState
          searchTerm={searchTerm}
          statusFilter={statusFilter}
        />
      ) : (
        <>
          {/* Desktop Table */}
          <RecurringTable
            filteredInvoices={filteredInvoices}
            handleToggleStatus={handleToggleStatus}
            setDeleteDialog={setDeleteDialog}
            updatingStatus={updatingStatus}
          />

          {/* Mobile List - EXACTLY like Invoices style */}
          <RecurringCardList
            filteredInvoices={filteredInvoices}
            handleToggleStatus={handleToggleStatus}
            setMobileMenuOpen={setMobileMenuOpen}
            updatingStatus={updatingStatus}
          />
        </>
      )}
    </FeatureGate>
  );
}
