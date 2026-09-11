import React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Sparkles, X } from "lucide-react";
import { calculateTotals } from "@/components/invoice/create/invoiceFormMath";

/** The chosen client's recent invoices; picking one copies its line items. */
export default function RecentWorkOrdersCard({
  formData,
  setFormData,
  setShowSuggestions,
  showSuggestions,
  similarSuggestions,
}) {
  return <>
    {showSuggestions && similarSuggestions.length > 0 && (
      <Card className="border-0 shadow-lg bg-surface dark:bg-surface-inverted overflow-hidden ring-1 ring-brand-100 dark:ring-brand-800">
        <CardContent className="p-4 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-brand-100 flex items-center justify-center ring-1 ring-brand-200 dark:ring-brand-700 shrink-0 dark:bg-brand-900/30">
                <Sparkles className="w-5 h-5 text-brand-600 dark:text-brand-400" />
              </div>
              <div className="min-w-0">
                <h3 className="text-base sm:text-lg font-black text-content dark:text-ink-50 truncate">
                  Recent Work Orders
                </h3>
                <p className="text-xs sm:text-sm text-content-muted dark:text-content-subtle truncate">
                  Quickly bill for similar jobs
                </p>
              </div>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setShowSuggestions(false)}
              className="h-8 w-8 shrink-0 text-content-subtle hover:text-content-body dark:text-content-muted dark:hover:text-ink-300"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
          <div className="space-y-2 sm:space-y-3">
            {similarSuggestions.map((suggestion) => (
              <Button
                key={suggestion.id}
                type="button"
                variant="outline"
                onClick={() => {
                  const totals = calculateTotals(
                    suggestion.items,
                    formData.tax_rate,
                  );
                  setFormData({
                    ...formData,
                    items: suggestion.items,
                    ...totals,
                  });
                  setShowSuggestions(false);
                }}
                className="w-full text-left justify-start h-auto py-3 px-3 sm:px-4 border-line dark:border-ink-600 hover:border-brand-400 dark:hover:border-brand-500 hover:bg-brand-50 dark:hover:bg-brand-900/20 transition-all bg-surface-sunken dark:bg-ink-800 text-ink-700 dark:text-ink-200 group"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1 gap-2">
                    <span className="text-xs sm:text-sm font-semibold text-brand-700 dark:text-brand-400 truncate">
                      {suggestion.invoice_number}
                    </span>
                    <span className="text-base sm:text-lg font-bold text-content dark:text-ink-50 shrink-0">
                      ${suggestion.total.toFixed(2)}
                    </span>
                  </div>
                  <div className="text-xs sm:text-sm text-content-body dark:text-content-subtle truncate">
                    {suggestion.items
                      .slice(0, 2)
                      .map((item) => item.description)
                      .join(", ")}
                    {suggestion.items.length > 2 && (
                      <span className="text-brand-600 dark:text-brand-400 font-medium">
                        {" "}
                        +{suggestion.items.length - 2} more
                      </span>
                    )}
                  </div>
                </div>
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>
    )}
    </>;
}
