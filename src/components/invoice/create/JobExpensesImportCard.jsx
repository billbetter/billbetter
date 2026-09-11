import React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Receipt, X } from "lucide-react";
import { calculateTotals } from "@/components/invoice/create/invoiceFormMath";

/** Billable expenses from the job this invoice was opened for, and importing them as lines. */
export default function JobExpensesImportCard({
  formData,
  jobExpenses,
  setFormData,
  setShowJobExpenses,
  showJobExpenses,
}) {
  return <>
    {showJobExpenses && jobExpenses.length > 0 && (
      <Card className="border-0 shadow-lg bg-surface dark:bg-surface-inverted overflow-hidden ring-1 ring-success-200 dark:ring-success-800">
        <CardContent className="p-4 sm:p-5">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-success-100 dark:bg-success-900/40 flex items-center justify-center shrink-0">
                <Receipt className="w-5 h-5 text-success-600 dark:text-success-400" />
              </div>
              <div className="min-w-0">
                <h3 className="text-base font-black text-content dark:text-ink-50">
                  Job Expenses Tracked
                </h3>
                <p className="text-xs text-content-muted dark:text-content-subtle">
                  {jobExpenses.length} expense
                  {jobExpenses.length !== 1 ? "s" : ""} • Billable: $
                  {jobExpenses
                    .reduce(
                      (s, e) =>
                        s + (e.billable_amount || e.amount || 0),
                      0,
                    )
                    .toFixed(2)}
                </p>
              </div>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setShowJobExpenses(false)}
              className="h-7 w-7 shrink-0 text-content-subtle"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
          <div className="space-y-1 mb-3 max-h-28 overflow-y-auto">
            {jobExpenses.map((exp, i) => (
              <div
                key={i}
                className="flex justify-between text-sm py-1 border-b border-line-subtle dark:border-ink-700 last:border-0"
              >
                <span className="text-ink-700 dark:text-ink-300 truncate">
                  {exp.description}
                </span>
                <span className="font-semibold text-success-600 dark:text-success-400 ml-2 shrink-0">
                  ${(exp.billable_amount || exp.amount || 0).toFixed(2)}
                </span>
              </div>
            ))}
          </div>
          <Button
            type="button"
            onClick={() => {
              const expItems = jobExpenses.map((exp) => ({
                description:
                  exp.description +
                  (exp.vendor ? ` (${exp.vendor})` : ""),
                quantity: exp.quantity || 1,
                rate:
                  (exp.billable_amount || exp.amount || 0) /
                  (exp.quantity || 1),
                amount: exp.billable_amount || exp.amount || 0,
              }));
              const totals = calculateTotals(
                expItems,
                formData.tax_rate,
              );
              setFormData((prev) => ({
                ...prev,
                items: expItems,
                ...totals,
              }));
              setShowJobExpenses(false);
            }}
            className="w-full bg-brand hover:bg-brand-hover text-content-inverted h-9 text-sm"
          >
            Import All Expenses as Invoice Items
          </Button>
        </CardContent>
      </Card>
    )}
    </>;
}
