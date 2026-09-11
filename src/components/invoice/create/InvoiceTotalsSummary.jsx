import React from "react";

/** Subtotal, tax and total due. */
export default function InvoiceTotalsSummary({
  formData,
}) {
  return (
    <div className="p-4 sm:p-5 bg-surface-sunken dark:bg-surface-inverted-deep rounded-xl text-content dark:text-content-inverted shadow-sm dark:shadow-xl border border-line dark:border-ink-800">
      <div className="space-y-2">
        <div className="flex justify-between text-content-body dark:text-content-subtle text-xs sm:text-sm">
          <span>Subtotal</span>
          <span className="font-medium text-content dark:text-ink-50">
            ${formData.subtotal.toFixed(2)}
          </span>
        </div>
        {formData.tax_rate > 0 && (
          <div className="flex justify-between text-content-body dark:text-content-subtle text-xs sm:text-sm">
            <span>Tax ({formData.tax_rate}%)</span>
            <span className="font-medium text-content dark:text-ink-50">
              ${formData.tax_amount.toFixed(2)}
            </span>
          </div>
        )}
        <div className="flex justify-between text-lg sm:text-xl font-bold pt-2 border-t border-line dark:border-ink-800">
          <span>Total Due</span>
          <span className="text-brand-700 dark:text-info-400">
            ${formData.total.toFixed(2)}
          </span>
        </div>
      </div>
    </div>
  );
}
