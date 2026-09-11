import React from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Link } from "react-router-dom";
import { FileText, Loader2, MoreVertical } from "lucide-react";
import ReadReceiptBadge from "@/components/invoice/ReadReceiptBadge";
import { createPageUrl } from "@/utils";
import { format } from "date-fns";
import { formatMoney, paymentSummary } from "@/lib/invoicePayments";
import { isVoided } from "@/lib/invoiceVoid";
import { statusConfig } from "@/components/invoice/list/invoiceStatus";

export default function InvoiceCard({
  batchRunning,
  eligibility,
  invoice,
  paymentsByInvoice,
  selectMode,
  selectedIds,
  setMobileMenuOpen,
  setMobileStatusPicker,
  toggleOne,
  updatingStatus,
}) {
  const StatusIcon =
    statusConfig[invoice.status]?.icon || FileText;
  const isAssigned =
    invoice.assigned_to ||
    (invoice.assigned_to_users &&
      invoice.assigned_to_users.length > 0);

  return (
    <div
      className="bg-surface dark:bg-surface-inverted rounded-xl border border-line-subtle dark:border-ink-800 overflow-hidden shadow-sm active:scale-[0.99] transition-transform"
    >
      <div
        className={`h-1 ${statusConfig[invoice.status]?.indicator || "bg-ink-300"}`}
      />
      <div className="p-4">
        <div className="flex justify-between items-start mb-3">
          <div className="flex-1 min-w-0 pr-4">
            <div className="flex items-center gap-2 mb-1">
              {/* Same control as the desktop table. Batch
                  sending on a phone is the case that matters
                  most -- it is where a contractor sits at the
                  end of a day with a list of finished work. */}
              {selectMode && (
                <Checkbox
                  checked={selectedIds.has(invoice.id)}
                  onCheckedChange={() => toggleOne(invoice.id)}
                  disabled={
                    batchRunning ||
                    !eligibility.get(invoice.id)?.ok
                  }
                  aria-label={`Select invoice ${invoice.invoice_number || ""}`}
                  className="h-5 w-5"
                />
              )}
              <span className="font-bold text-content dark:text-content-inverted text-sm">
                {invoice.invoice_number ||
                  `#${invoice.id.slice(0, 8)}`}
              </span>
              {isAssigned && (
                <span className="text-[10px] bg-success-100 dark:bg-success-900/30 text-success-700 dark:text-success-400 px-1.5 py-0.5 rounded font-bold uppercase tracking-wide">
                  Assigned
                </span>
              )}
            </div>
            <p className="text-sm text-ink-700 dark:text-ink-300 font-semibold truncate">
              {invoice.client_name}
            </p>
            <p className="text-xs text-content-subtle dark:text-content-muted mt-0.5 font-medium">
              {format(new Date(invoice.created_date), "MMM d")}{" "}
              • Due{" "}
              {format(
                new Date(
                  invoice.due_date || invoice.created_date,
                ),
                "MMM d",
              )}
            </p>
          </div>
          <div className="text-right">
            <p className="font-bold text-content dark:text-content-inverted text-lg">
              ${invoice.total?.toFixed(2)}
            </p>
            {(() => {
              const s = paymentSummary(
                invoice,
                paymentsByInvoice.get(invoice.id) || [],
              );
              if (s.count === 0 || s.settled) return null;
              return (
                <p className="text-xs font-semibold text-alert-700 dark:text-alert-400 mt-0.5">
                  {formatMoney(s.balance)} owed
                </p>
              );
            })()}
          </div>
        </div>

        <div className="flex items-center justify-between pt-3 border-t border-ink-50 dark:border-ink-700">
          <div className="flex items-center gap-2 min-w-0">
            <button
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold transition-transform ${isVoided(invoice) ? "" : "active:scale-95"} ${statusConfig[invoice.status]?.color || "bg-ink-100"}`}
              disabled={isVoided(invoice)}
              onClick={() => setMobileStatusPicker(invoice.id)}
            >
              {updatingStatus === invoice.id ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <StatusIcon className="w-3 h-3" />
              )}
              <span className="capitalize">
                {invoice.status}
              </span>
            </button>
            <ReadReceiptBadge document={invoice} />
          </div>

          <div className="flex gap-2">
            <Link
              to={
                createPageUrl("InvoiceDetail") +
                `?id=${invoice.id}`
              }
            >
              <Button
                variant="outline"
                size="sm"
                className="h-9 px-4 text-xs font-semibold border-line dark:border-ink-700 dark:bg-ink-800 dark:text-ink-300 rounded-lg hover:bg-surface-sunken dark:hover:bg-ink-700"
              >
                View
              </Button>
            </Link>
            <Button
              variant="outline"
              size="icon"
              className="h-9 w-9 border-line dark:border-ink-700 dark:bg-ink-800 rounded-lg active:scale-95 hover:bg-surface-sunken dark:hover:bg-ink-700"
              onClick={() => setMobileMenuOpen(invoice.id)}
            >
              <MoreVertical className="w-4 h-4 text-content-body dark:text-content-subtle" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
