import React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2 } from "lucide-react";
import { SETTABLE_STATUSES, statusConfig } from "@/components/invoice/list/invoiceStatus";

/** The phone layout's status picker for one invoice. Offers only
 * SETTABLE_STATUSES -- voiding is not a status change (see invoiceStatus.js). */
export default function InvoiceStatusSheet({
  filteredInvoices,
  handleStatusChange,
  mobileStatusPicker,
  setMobileStatusPicker,
}) {
  return (
    <AnimatePresence>
      {mobileStatusPicker && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="lg:hidden fixed inset-0 bg-black/40 backdrop-blur-sm z-50"
            onClick={() => setMobileStatusPicker(null)}
          />
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="lg:hidden fixed bottom-0 left-0 right-0 bg-surface dark:bg-ink-800 rounded-t-3xl z-50 shadow-2xl overflow-hidden"
            style={{
              paddingBottom: "max(env(safe-area-inset-bottom), 16px)",
            }}
          >
            <div className="w-full flex justify-center pt-3 pb-1">
              <div className="w-12 h-1.5 bg-ink-300 dark:bg-ink-600 rounded-full" />
            </div>
            <div className="px-6 py-3 border-b border-line-subtle dark:border-ink-700">
              <h3 className="font-black text-content dark:text-content-inverted text-base">
                Change Status
              </h3>
            </div>
            <div className="p-4 space-y-1.5">
              {SETTABLE_STATUSES.map((status) => {
                const config = statusConfig[status];
                const Icon = config.icon;
                const isCurrentStatus =
                  filteredInvoices.find(
                    (inv) => inv.id === mobileStatusPicker,
                  )?.status === status;
                return (
                  <button
                    key={status}
                    className={`w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl transition-all active:scale-[0.98] ${isCurrentStatus ? "bg-ink-100 dark:bg-ink-700" : "hover:bg-surface-sunken dark:hover:bg-ink-700/50"}`}
                    onClick={() => {
                      handleStatusChange(mobileStatusPicker, status);
                      setMobileStatusPicker(null);
                    }}
                  >
                    <span
                      className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${config.color}`}
                    >
                      <Icon className="w-4 h-4" />
                    </span>
                    <span className="font-semibold text-ink-800 dark:text-ink-200 capitalize text-sm">
                      {status}
                    </span>
                    {isCurrentStatus && (
                      <CheckCircle2 className="w-4 h-4 text-success-500 ml-auto" />
                    )}
                  </button>
                );
              })}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
