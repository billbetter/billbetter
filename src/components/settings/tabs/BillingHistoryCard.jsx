import React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Download, File, Loader2, RotateCcw } from "lucide-react";
import { format } from "date-fns";

/** Recent subscription invoices. Refresh is the page's loadBillingHistory, passed in untouched. */
export default function BillingHistoryCard({
  billingHistory,
  loadBillingHistory,
  loadingBilling,
}) {
  return (
    <Card className="border-line dark:border-ink-800 bg-surface dark:bg-surface-inverted">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2 text-content dark:text-content-inverted">
            <File className="w-5 h-5 text-content-body dark:text-content-subtle" />
            Recent Billing History
          </CardTitle>
          <Button
            onClick={loadBillingHistory}
            variant="outline"
            size="sm"
            disabled={loadingBilling}
            className="dark:border-ink-700 dark:text-ink-300 dark:hover:bg-ink-800"
          >
            {loadingBilling ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <RotateCcw className="w-4 h-4 mr-2" />
                Refresh
              </>
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loadingBilling ? (
          <div className="py-8 text-center">
            <Loader2 className="w-8 h-8 animate-spin mx-auto text-content-subtle dark:text-content-body dark:dark:text-ink-300" />
          </div>
        ) : billingHistory.invoices.length > 0 ? (
          <div className="space-y-3">
            {billingHistory.invoices
              .slice(0, 10)
              .map((invoice) => (
                <div
                  key={invoice.id}
                  className="flex items-center justify-between p-4 border dark:border-ink-700 rounded-lg hover:bg-surface-sunken dark:hover:bg-ink-800 transition-colors bg-surface dark:bg-ink-800/50"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-2 h-2 rounded-full ${
                          invoice.paid
                            ? "bg-success-500"
                            : invoice.status === "open"
                              ? "bg-caution-500"
                              : "bg-danger-500"
                        }`}
                      />
                      <div>
                        <p className="font-medium text-content dark:text-content-inverted">
                          {invoice.description}
                        </p>
                        <p className="text-sm text-content-muted dark:text-content-subtle">
                          {format(
                            new Date(
                              invoice.created * 1000,
                            ),
                            "MMM d, yyyy",
                          )}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="font-semibold text-content dark:text-content-inverted">
                        ${invoice.amount.toFixed(2)}{" "}
                        {invoice.currency}
                      </p>
                      <p
                        className={`text-xs font-medium ${
                          invoice.paid
                            ? "text-success-600 dark:text-success-400"
                            : invoice.status === "open"
                              ? "text-caution-600 dark:text-caution-400"
                              : "text-danger-600 dark:text-danger-400"
                        }`}
                      >
                        {invoice.paid
                          ? "Paid"
                          : invoice.status === "open"
                            ? "Open"
                            : "Failed"}
                      </p>
                    </div>
                    {invoice.invoice_pdf && (
                      <a
                        href={invoice.invoice_pdf}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 hover:bg-ink-100 dark:hover:bg-ink-700 rounded-lg transition-colors"
                      >
                        <Download className="w-4 h-4 text-content-body dark:text-content-subtle" />
                      </a>
                    )}
                  </div>
                </div>
              ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <File className="w-12 h-12 text-ink-300 dark:text-ink-700 mx-auto mb-3 dark:dark:text-ink-300" />
            <p className="text-content-body dark:text-content-subtle">
              No billing history available
            </p>
            <p className="text-sm text-content-muted dark:text-content-muted mt-1">
              Your invoices will appear here after your
              first payment
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
