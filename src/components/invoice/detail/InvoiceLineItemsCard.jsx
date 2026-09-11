import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/** The invoice's line items and totals. */
export default function InvoiceLineItemsCard({
  invoice,
}) {
  return (
    <Card className="border-none shadow-lg dark:bg-surface-inverted dark:border-ink-700">
      <CardHeader className="p-4 sm:p-6">
        <CardTitle className="text-base sm:text-lg text-content dark:text-content-inverted">
          Line Items
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 sm:p-6 pt-0">
        <div className="space-y-3 sm:space-y-4">
          {invoice.items.map((item, index) => (
            <div
              key={index}
              className="flex justify-between items-start gap-3 pb-3 sm:pb-4 border-b border-line-subtle dark:border-ink-700 last:border-b-0"
            >
              <div className="flex-1 min-w-0">
                <p className="font-medium text-content dark:text-content-inverted text-sm sm:text-base break-words">
                  {item.description}
                </p>
                <p className="text-xs sm:text-sm text-content-body dark:text-content-subtle mt-1">
                  {item.quantity} × ${item.rate.toFixed(2)}
                </p>
              </div>
              <p className="font-semibold text-content dark:text-content-inverted text-sm sm:text-base flex-shrink-0">
                ${item.amount.toFixed(2)}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-4 sm:mt-6 pt-4 sm:pt-6 border-t border-line dark:border-ink-700 space-y-2">
          <div className="flex justify-between text-sm sm:text-base text-content-body dark:text-ink-300">
            <span>Subtotal</span>
            <span>${invoice.subtotal.toFixed(2)}</span>
          </div>
          {invoice.tax_rate > 0 && (
            <div className="flex justify-between text-sm sm:text-base text-content-body dark:text-ink-300">
              <span>Tax ({invoice.tax_rate}%)</span>
              <span>${invoice.tax_amount.toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between text-lg sm:text-xl font-bold text-content dark:text-content-inverted pt-2 border-t border-line dark:border-ink-700">
            <span>Total</span>
            <span>${invoice.total.toFixed(2)}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
