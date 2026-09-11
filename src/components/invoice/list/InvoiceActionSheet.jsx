import React from "react";
import { AlertCircle, Ban, ChevronRight, Download, Trash2 } from "lucide-react";
import MobileActionSheet from "@/components/documentList/MobileActionSheet";
import { canDeleteInvoice } from "@/lib/invoiceVoid";

/** The phone layout's per-invoice actions (reminder, PDF, delete). */
export default function InvoiceActionSheet({
  downloadInvoicePdf,
  filteredInvoices,
  mobileMenuOpen,
  setDeleteDialog,
  setMobileMenuOpen,
  setNotificationDialog,
}) {
  return (
    <MobileActionSheet
      open={mobileMenuOpen}
      onClose={() => setMobileMenuOpen(false)}
      title="Invoice Actions"
      subtitle={
        filteredInvoices.find((inv) => inv.id === mobileMenuOpen)
          ?.invoice_number
      }
    >

      <div className="flex-1 overflow-y-auto p-4 space-y-1 pb-24">
        {filteredInvoices.find((inv) => inv.id === mobileMenuOpen)
          ?.status === "overdue" && (
          <button
            className="w-full flex items-center gap-4 px-4 py-4 text-base font-semibold text-ink-700 dark:text-ink-300 hover:bg-alert-50 dark:hover:bg-alert-900/20 hover:text-alert-700 dark:hover:text-alert-400 rounded-2xl transition-all active:scale-[0.98]"
            onClick={() => {
              setNotificationDialog({
                open: true,
                invoice: filteredInvoices.find(
                  (inv) => inv.id === mobileMenuOpen,
                ),
              });
              setMobileMenuOpen(false);
            }}
          >
            <div className="w-10 h-10 rounded-xl bg-alert-100 dark:bg-alert-900/30 flex items-center justify-center flex-shrink-0">
              <AlertCircle className="w-5 h-5 text-alert-600 dark:text-alert-400" />
            </div>
            <div className="text-left flex-1 min-w-0">
              <p className="font-bold">Send Overdue Notice</p>
              <p className="text-xs text-content-muted dark:text-content-subtle font-medium mt-0.5 truncate">
                Email or SMS reminder
              </p>
            </div>
            <ChevronRight className="w-5 h-5 text-content-subtle dark:text-content-muted flex-shrink-0" />
          </button>
        )}

        {/*
          Fetches the document on click. The list query no longer
          asks for pdf_url, because that column holds the entire PDF
          inline as base64 and selecting it meant downloading every
          invoice's PDF just to render this menu.
        */}
        {mobileMenuOpen && (
          <a
            href="#"
            onClick={(e) => {
              e.preventDefault();
              downloadInvoicePdf(mobileMenuOpen);
            }}
            className="block w-full"
          >
            <button className="w-full flex items-center gap-4 px-4 py-4 text-base font-semibold text-ink-700 dark:text-ink-300 hover:bg-ink-100 dark:hover:bg-ink-700 rounded-2xl transition-all active:scale-[0.98]">
              <div className="w-10 h-10 rounded-xl bg-ink-100 dark:bg-ink-700 flex items-center justify-center flex-shrink-0">
                <Download className="w-5 h-5 text-content-body dark:text-content-subtle" />
              </div>
              <div className="text-left flex-1 min-w-0">
                <p className="font-bold">Download PDF</p>
                <p className="text-xs text-content-muted dark:text-content-subtle font-medium mt-0.5 truncate">
                  Save invoice to device
                </p>
              </div>
              <ChevronRight className="w-5 h-5 text-content-subtle dark:text-content-muted flex-shrink-0" />
            </button>
          </a>
        )}

        {canDeleteInvoice(
          filteredInvoices.find((inv) => inv.id === mobileMenuOpen),
        ).ok ? (
          <button
            className="w-full flex items-center gap-4 px-4 py-4 text-base font-semibold text-danger-700 dark:text-danger-400 hover:bg-danger-50 dark:hover:bg-danger-900/20 rounded-2xl transition-all active:scale-[0.98]"
            onClick={() => {
              setDeleteDialog({
                open: true,
                invoice: filteredInvoices.find(
                  (inv) => inv.id === mobileMenuOpen,
                ),
              });
              setMobileMenuOpen(false);
            }}
          >
            <div className="w-10 h-10 rounded-xl bg-danger-100 dark:bg-danger-900/30 flex items-center justify-center flex-shrink-0">
              <Trash2 className="w-5 h-5 text-danger-600 dark:text-danger-400" />
            </div>
            <div className="text-left flex-1 min-w-0">
              <p className="font-bold">Delete Invoice</p>
              <p className="text-xs text-content-muted dark:text-content-subtle font-medium mt-0.5 truncate">
                Remove permanently
              </p>
            </div>
            <ChevronRight className="w-5 h-5 text-content-subtle dark:text-content-muted flex-shrink-0" />
          </button>
        ) : (
          <div className="w-full flex items-center gap-4 px-4 py-4 rounded-2xl bg-ink-50 dark:bg-ink-700/40">
            <div className="w-10 h-10 rounded-xl bg-ink-100 dark:bg-ink-700 flex items-center justify-center flex-shrink-0">
              <Ban className="w-5 h-5 text-content-body dark:text-content-subtle" />
            </div>
            <div className="text-left flex-1 min-w-0">
              <p className="font-bold text-content dark:text-content-inverted text-base">
                Voided
              </p>
              <p className="text-xs text-content-muted dark:text-content-subtle font-medium mt-0.5">
                Kept on record. It cannot be deleted.
              </p>
            </div>
          </div>
        )}
      </div>
    </MobileActionSheet>
  );
}
