import React from "react";
import { Ban, ShieldAlert } from "lucide-react";

/** Who voided this invoice, when and why -- and any money that arrived after. */
export default function VoidedInvoiceBanner({
  auditLine,
  paidDespiteVoid,
  voided,
}) {
  return <>
    {voided && (
      <div className="mb-4 sm:mb-6 rounded-xl border border-line dark:border-ink-700 bg-ink-50 dark:bg-ink-800/60 p-4">
        <div className="flex items-start gap-3">
          <Ban className="w-5 h-5 text-content-body dark:text-ink-300 flex-shrink-0 mt-0.5" />
          <div className="min-w-0">
            <p className="font-bold text-content dark:text-content-inverted">
              This invoice has been voided
            </p>
            {auditLine && (
              <p className="text-sm text-content-body dark:text-ink-300 mt-1 break-words">
                {auditLine}
              </p>
            )}
            <p className="text-sm text-content-muted dark:text-content-subtle mt-2">
              It is kept as a record. It cannot be edited, deleted, sent or paid,
              and its number is never reused.
            </p>
          </div>
        </div>

        {/* Money that arrived after the void. See recordInvoicePayment in
            stripe-webhook: the webhook writes the payment and deliberately
            does NOT clear the void, so the contractor is told rather than
            quietly shown a paid invoice. */}
        {paidDespiteVoid && (
          <div className="mt-3 pt-3 border-t border-line dark:border-ink-700 flex items-start gap-3">
            <ShieldAlert className="w-5 h-5 text-alert-600 dark:text-alert-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-content dark:text-content-inverted">
                A payment arrived for this invoice anyway
              </p>
              <p className="text-sm text-content-body dark:text-ink-300 mt-1">
                A checkout page opened before you voided it stays valid for 24
                hours. The money is in your Stripe account. Refund it there, or
                raise a replacement invoice to cover it.
              </p>
            </div>
          </div>
        )}
      </div>
    )}
    </>;
}
