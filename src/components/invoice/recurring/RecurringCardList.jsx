import React from "react";
import RecurringCard from "@/components/invoice/recurring/RecurringCard";

/** The phone layout's recurring-invoice list. */
export default function RecurringCardList({
  filteredInvoices,
  handleToggleStatus,
  setMobileMenuOpen,
  updatingStatus,
}) {
  return (
    <div className="lg:hidden space-y-3">
      {filteredInvoices.map((recurring) => (
        <RecurringCard
          key={recurring.id}
          handleToggleStatus={handleToggleStatus}
          recurring={recurring}
          setMobileMenuOpen={setMobileMenuOpen}
          updatingStatus={updatingStatus}
        />
      ))}
    </div>
  );
}
