import React from "react";
import { format } from "date-fns";

/** The live preview beside the form: the quote as it stands, laid out like the PDF. */
const QuotePreview = ({ quote, settings }) => {
  if (!quote) return null;

  return (
    <div className="bg-surface dark:bg-surface-inverted rounded-lg shadow-sm border border-line dark:border-ink-700 overflow-hidden">
      {/* Preview Header */}
      <div className="bg-surface-sunken dark:bg-surface-inverted-deep p-3 sm:p-4 text-content dark:text-content-inverted border-b border-line dark:border-ink-800">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2">
          <div className="min-w-0">
            <h2 className="text-base sm:text-lg font-black">QUOTE</h2>
            <p className="text-content-muted dark:text-content-subtle text-xs sm:text-sm mt-0.5 font-mono truncate">
              #{settings?.quote_prefix || "QTE"}-XXXXX
            </p>
          </div>
          <div className="sm:text-right min-w-0">
            {settings?.business_name && (
              <p className="font-semibold text-xs sm:text-sm truncate">
                {settings.business_name}
              </p>
            )}
            {settings?.address && (
              <p className="text-content-muted dark:text-content-subtle text-xs truncate hidden sm:block">
                {settings.address}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Preview Body */}
      <div className="p-3 sm:p-4 space-y-3 sm:space-y-4">
        {/* Client Info */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-4">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-content-muted dark:text-content-muted uppercase tracking-wider mb-0.5">
              Quote To
            </p>
            <p className="text-xs sm:text-sm font-semibold text-content dark:text-ink-100 truncate">
              {quote.client_name || "Client Name"}
            </p>
            {quote.client_email && (
              <p className="text-xs text-content-body dark:text-content-subtle truncate">
                {quote.client_email}
              </p>
            )}
          </div>
          <div className="sm:text-right min-w-0">
            <p className="text-xs font-semibold text-content-muted dark:text-content-muted uppercase tracking-wider mb-0.5">
              Valid Until
            </p>
            <p className="text-xs sm:text-sm font-medium text-content dark:text-ink-100">
              {quote.expiry_date
                ? format(new Date(quote.expiry_date), "MMM dd, yyyy")
                : "Not set"}
            </p>
          </div>
        </div>

        {/* Line Items Table */}
        <div className="border border-line dark:border-ink-700 rounded-lg overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-ink-100 dark:bg-ink-800 border-b border-line dark:border-ink-700">
              <tr>
                <th className="text-left p-2 font-semibold text-ink-700 dark:text-ink-300">
                  Item
                </th>
                <th className="text-right p-2 font-semibold text-ink-700 dark:text-ink-300 w-12">
                  Qty
                </th>
                <th className="text-right p-2 font-semibold text-ink-700 dark:text-ink-300 w-16 hidden sm:table-cell">
                  Rate
                </th>
                <th className="text-right p-2 font-semibold text-ink-700 dark:text-ink-300 w-16">
                  Amt
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line dark:divide-ink-700">
              {quote.items?.map((item, idx) => (
                <tr key={idx} className="bg-surface dark:bg-surface-inverted">
                  <td className="p-2 text-content dark:text-ink-100 font-medium truncate max-w-[100px] sm:max-w-[150px]">
                    {item.description || "—"}
                  </td>
                  <td className="p-2 text-right text-content-body dark:text-content-subtle">
                    {item.quantity}
                  </td>
                  <td className="p-2 text-right text-content-body dark:text-content-subtle hidden sm:table-cell">
                    ${item.rate?.toFixed(2)}
                  </td>
                  <td className="p-2 text-right font-semibold text-content dark:text-ink-100">
                    ${item.amount?.toFixed(2)}
                  </td>
                </tr>
              ))}
              {(!quote.items || quote.items.length === 0) && (
                <tr>
                  <td
                    colSpan="4"
                    className="p-3 text-center text-content-subtle dark:text-content-muted italic text-xs"
                  >
                    No items added
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div className="space-y-1 border-t border-line dark:border-ink-700 pt-2">
          <div className="flex justify-between text-xs">
            <span className="text-content-body dark:text-content-subtle">
              Subtotal
            </span>
            <span className="font-medium text-content dark:text-ink-100">
              ${quote.subtotal?.toFixed(2) || "0.00"}
            </span>
          </div>
          {quote.tax_rate > 0 && (
            <div className="flex justify-between text-xs">
              <span className="text-content-body dark:text-content-subtle">
                Tax ({quote.tax_rate}%)
              </span>
              <span className="font-medium text-content dark:text-ink-100">
                ${quote.tax_amount?.toFixed(2) || "0.00"}
              </span>
            </div>
          )}
          <div className="flex justify-between text-base sm:text-lg font-bold pt-1 border-t border-line dark:border-ink-700">
            <span className="text-content dark:text-ink-50">Total</span>
            <span className="text-brand-700 dark:text-brand-400">
              ${quote.total?.toFixed(2) || "0.00"}
            </span>
          </div>
        </div>

        {/* Notes */}
        {quote.notes && (
          <div className="bg-surface-sunken dark:bg-ink-800/50 p-2 sm:p-3 rounded-lg border border-line dark:border-ink-700">
            <p className="text-xs font-semibold text-ink-700 dark:text-ink-300 uppercase tracking-wider mb-0.5">
              Terms
            </p>
            <p className="text-xs text-content-body dark:text-content-subtle line-clamp-3">
              {quote.notes}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default QuotePreview;
