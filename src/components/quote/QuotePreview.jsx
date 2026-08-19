import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, Clock } from "lucide-react";
import { format, differenceInDays, isValid, parseISO } from "date-fns";

export default function QuotePreview({ quote, settings }) {
  // Safely parse and validate dates
  const getValidDate = (dateString) => {
    if (!dateString) return null;
    try {
      const date =
        typeof dateString === "string"
          ? parseISO(dateString)
          : new Date(dateString);
      return isValid(date) ? date : null;
    } catch {
      return null;
    }
  };

  const expiryDate = getValidDate(quote.expiry_date);
  const issuedDate = getValidDate(quote.date_issued);

  const daysUntilExpiry = expiryDate
    ? differenceInDays(expiryDate, new Date())
    : null;

  return (
    <Card className="border-none shadow-lg border-t-4 border-t-success-500 dark:!bg-surface">
      <CardHeader className="bg-success-50">
        <CardTitle className="flex items-center gap-2 text-content">
          <FileText className="w-5 h-5 text-success-600" />
          Quote Preview
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6 pt-6">
        <div className="border-b pb-4">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h3 className="text-2xl font-bold text-success-600 mb-2">
                QUOTE
              </h3>
              {settings?.business_name && (
                <p className="text-sm text-content-body mt-1">
                  {settings.business_name}
                </p>
              )}
            </div>
            <div className="text-right">
              <p className="text-xs text-success-600 font-medium">Quote #</p>
              <p className="font-semibold text-content">Draft</p>
            </div>
          </div>

          {quote.client_name && (
            <div className="bg-success-50 p-3 rounded-lg">
              <p className="text-xs text-success-600 font-medium mb-1">
                Quote For:
              </p>
              <p className="font-medium text-content">{quote.client_name}</p>
              {quote.client_email && (
                <p className="text-sm text-content-body">
                  {quote.client_email}
                </p>
              )}
            </div>
          )}
        </div>

        <div className="text-sm space-y-2 bg-success-50 p-3 rounded-lg">
          <div className="flex justify-between">
            <span className="text-success-600 font-medium">Date Issued:</span>
            <span className="font-medium text-content">
              {issuedDate ? format(issuedDate, "MMM d, yyyy") : "Not set"}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-success-600 font-medium">Valid Until:</span>
            <div className="flex items-center gap-2">
              <span className="font-medium text-content">
                {expiryDate ? format(expiryDate, "MMM d, yyyy") : "Not set"}
              </span>
              {daysUntilExpiry !== null && daysUntilExpiry >= 0 && (
                <span className="text-xs bg-success-200 text-success-800 px-2 py-1 rounded-full flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {daysUntilExpiry}d
                </span>
              )}
            </div>
          </div>
        </div>

        <div>
          <div className="space-y-2 mb-4">
            {quote.items &&
              quote.items.map((item, index) => (
                <div
                  key={index}
                  className="flex justify-between text-sm p-2 rounded hover:bg-success-50 transition-colors"
                >
                  <div className="flex-1">
                    <p className="font-medium text-content">
                      {item.description || "Item description"}
                    </p>
                    <p className="text-success-600 text-xs">
                      {item.quantity || 0} × ${(item.rate || 0).toFixed(2)}
                    </p>
                  </div>
                  <p className="font-semibold text-content">
                    ${(item.amount || 0).toFixed(2)}
                  </p>
                </div>
              ))}
          </div>

          <div className="border-t-2 border-success-200 pt-4 space-y-2">
            <div className="flex justify-between text-sm">
              <p className="text-content-body">Subtotal</p>
              <p className="font-medium text-content">
                ${(quote.subtotal || 0).toFixed(2)}
              </p>
            </div>
            {quote.tax_rate > 0 && (
              <div className="flex justify-between text-sm">
                <p className="text-content-body">Tax ({quote.tax_rate}%)</p>
                <p className="font-medium text-content">
                  ${(quote.tax_amount || 0).toFixed(2)}
                </p>
              </div>
            )}
            <div className="flex justify-between text-lg font-bold pt-2 border-t-2 border-success-300">
              <p className="text-content">Total</p>
              <p className="text-success-600">
                ${(quote.total || 0).toFixed(2)}
              </p>
            </div>
          </div>
        </div>

        {quote.notes && (
          <div className="text-sm bg-surface-sunken p-3 rounded-lg">
            <p className="text-content-body font-medium mb-1">Notes / Terms</p>
            <p className="text-ink-700">{quote.notes}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
