import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Wallet } from "lucide-react";
import { formatMoney, paymentsSupported } from "@/lib/invoicePayments";

/** What has been received against this invoice, and what is still owed. */
export default function InvoicePaymentsCard({
  payments,
  summary,
  voided,
}) {
  return <>
    {(payments.length > 0 || (!voided && summary.total > 0)) && (
      <Card className="border-none shadow-lg dark:bg-surface-inverted dark:border-ink-700">
        <CardHeader className="border-b border-line dark:border-ink-700 p-4 sm:p-6">
          <CardTitle className="flex items-center gap-2 text-base sm:text-lg text-content dark:text-content-inverted">
            <Wallet className="w-5 h-5 text-brand-700 dark:text-brand-400" />
            Payments
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 sm:p-6">
          <div className="flex flex-wrap gap-x-8 gap-y-3 mb-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-content-subtle dark:text-content-muted">
                Invoice total
              </p>
              <p className="text-lg font-bold text-content dark:text-content-inverted">
                {formatMoney(summary.total)}
              </p>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-content-subtle dark:text-content-muted">
                Paid to date
              </p>
              <p className="text-lg font-bold text-success-700 dark:text-success-400">
                {formatMoney(summary.paid)}
              </p>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-content-subtle dark:text-content-muted">
                {summary.overpaid ? "Overpaid by" : "Still owed"}
              </p>
              <p
                className={`text-lg font-bold ${
                  summary.settled
                    ? "text-success-700 dark:text-success-400"
                    : "text-content dark:text-content-inverted"
                }`}
              >
                {formatMoney(Math.abs(summary.balance))}
              </p>
            </div>
          </div>

          {payments.length === 0 ? (
            <p className="text-sm text-content-muted dark:text-content-subtle">
              Nothing recorded yet.
              {!paymentsSupported() &&
                " Recording payments needs a database update that has not been applied yet."}
            </p>
          ) : (
            <div className="divide-y divide-line-subtle dark:divide-ink-700">
              {[...payments]
                .sort((a, b) => String(b.paid_at).localeCompare(String(a.paid_at)))
                .map((p) => (
                  <div key={p.id} className="py-2.5 flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-content dark:text-content-inverted">
                        {p.method || "Payment"}
                        {p.reference ? ` · ${p.reference}` : ""}
                      </p>
                      <p className="text-xs text-content-muted dark:text-content-subtle mt-0.5">
                        {p.paid_at}
                        {p.recorded_by_name ? ` · recorded by ${p.recorded_by_name}` : ""}
                        {p.stripe_payment_intent_id ? " · paid online" : ""}
                      </p>
                      {p.notes && (
                        <p className="text-xs text-content-body dark:text-ink-300 mt-1 break-words">
                          {p.notes}
                        </p>
                      )}
                    </div>
                    <p
                      className={`text-sm font-bold flex-shrink-0 ${
                        Number(p.amount) < 0
                          ? "text-danger-600 dark:text-danger-400"
                          : "text-content dark:text-content-inverted"
                      }`}
                    >
                      {formatMoney(p.amount)}
                    </p>
                  </div>
                ))}
            </div>
          )}
        </CardContent>
      </Card>
    )}
    </>;
}
