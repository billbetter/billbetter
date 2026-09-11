import React from "react";
import { ChevronRight, Trash2 } from "lucide-react";
import MobileActionSheet from "@/components/documentList/MobileActionSheet";

/** The phone layout's per-schedule actions. */
export default function RecurringActionSheet({
  filteredInvoices,
  mobileMenuOpen,
  setDeleteDialog,
  setMobileMenuOpen,
}) {
  return (
    <MobileActionSheet
      open={mobileMenuOpen}
      onClose={() => setMobileMenuOpen(null)}
      title="Recurring Actions"
      subtitle={
        filteredInvoices.find((inv) => inv.id === mobileMenuOpen)?.client_name
      }
    >

      <div className="flex-1 overflow-y-auto p-4 space-y-1 pb-24">
        <button
          className="w-full flex items-center gap-4 px-4 py-4 text-base font-semibold text-danger-700 dark:text-danger-400 hover:bg-danger-50 dark:hover:bg-danger-900/20 rounded-2xl transition-all active:scale-[0.98]"
          onClick={() => {
            setDeleteDialog({
              open: true,
              invoice: filteredInvoices.find(
                (inv) => inv.id === mobileMenuOpen,
              ),
            });
            setMobileMenuOpen(null);
          }}
        >
          <div className="w-10 h-10 rounded-xl bg-danger-100 dark:bg-danger-900/30 flex items-center justify-center flex-shrink-0">
            <Trash2 className="w-5 h-5 text-danger-600 dark:text-danger-400" />
          </div>
          <div className="text-left flex-1 min-w-0">
            <p className="font-bold">Delete Recurring</p>
            <p className="text-xs text-content-muted dark:text-content-subtle font-medium mt-0.5 truncate">
              Stop all future invoices
            </p>
          </div>
          <ChevronRight className="w-5 h-5 text-content-subtle dark:text-content-muted flex-shrink-0" />
        </button>
      </div>
    </MobileActionSheet>
  );
}
