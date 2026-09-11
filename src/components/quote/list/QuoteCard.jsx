import React from "react";
import { ArrowRight, FileText, MoreVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import ReadReceiptBadge from "@/components/invoice/ReadReceiptBadge";
import { createPageUrl } from "@/utils";
import { respondedBy, statusConfig } from "@/components/quote/list/quoteStatus";
import { getExpiryStatus } from "@/components/quote/list/quoteStatus";
import { formatCalendarDay } from "@/lib/calendarDate";

/** One quote in the phone layout, with Convert when it has been approved. */
export default function QuoteCard({
  quote,
  setConvertDialog,
  setMobileMenuOpen,
}) {
  const StatusIcon =
    statusConfig[quote.status]?.icon || FileText;
  const expiryStatus = getExpiryStatus(quote.expiry_date);
  const canConvert =
    quote.status === "approved" && quote.status !== "converted";
  const isAssigned =
    quote.assigned_to ||
    (quote.assigned_to_users &&
      quote.assigned_to_users.length > 0);

  return (
    <div
      className="bg-surface dark:bg-ink-800 rounded-xl border border-line dark:border-ink-700 overflow-hidden shadow-sm active:scale-[0.99] transition-transform"
    >
      <div
        className={`h-1 ${statusConfig[quote.status]?.indicator || "bg-ink-300"}`}
      />
      <div className="p-4">
        <div className="flex justify-between items-start mb-3">
          <div className="flex-1 min-w-0 pr-4">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-bold text-content dark:text-content-inverted text-sm">
                {quote.quote_number ||
                  `#${quote.id.slice(0, 8)}`}
              </span>
              {isAssigned && (
                <span className="text-[10px] bg-success-100 dark:bg-success-900/30 text-success-700 dark:text-success-400 px-1.5 py-0.5 rounded font-bold uppercase tracking-wide">
                  Assigned
                </span>
              )}
            </div>
            <p className="text-sm text-ink-700 dark:text-ink-300 font-semibold truncate">
              {quote.client_name}
            </p>
            <div className="flex items-center gap-2 mt-1">
              <p className="text-xs text-content-subtle dark:text-content-muted font-medium">
                {formatCalendarDay(quote.date_issued, "MMM d")}
              </p>
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${expiryStatus.bgColor} ${expiryStatus.color}`}
              >
                {expiryStatus.text}
              </span>
            </div>
          </div>
          <div className="text-right">
            <p className="font-bold text-content dark:text-content-inverted text-lg">
              ${quote.total?.toFixed(2)}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between pt-3 border-t border-ink-50 dark:border-ink-700">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${statusConfig[quote.status]?.color || "bg-ink-100"}`}
              >
                <StatusIcon className="w-3 h-3" />
                <span className="capitalize">
                  {quote.status}
                </span>
              </span>
              <ReadReceiptBadge document={quote} />
            </div>
            {respondedBy(quote) && (
              <p className="mt-1.5 text-[11px] leading-tight text-content-muted dark:text-content-subtle truncate">
                {respondedBy(quote).verb}{" "}
                <span className="font-medium text-content-body dark:text-ink-300">
                  {respondedBy(quote).who}
                </span>
              </p>
            )}
          </div>

          <div className="flex gap-2">
            {canConvert ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setConvertDialog({ open: true, quote })
                }
                className="h-9 px-4 text-xs font-semibold border-success-200 dark:border-success-800 text-success-700 dark:text-success-400 bg-success-50 dark:bg-success-900/20 rounded-lg hover:bg-success-100 dark:hover:bg-success-900/30"
              >
                <ArrowRight className="w-3.5 h-3.5 mr-1.5" />
                Convert
              </Button>
            ) : (
              <Link
                to={
                  createPageUrl("QuoteDetail") +
                  `?id=${quote.id}`
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
            )}
            <Button
              variant="outline"
              size="icon"
              className="h-9 w-9 border-line dark:border-ink-700 dark:bg-ink-800 rounded-lg active:scale-95 hover:bg-surface-sunken dark:hover:bg-ink-700"
              onClick={() => setMobileMenuOpen(quote.id)}
            >
              <MoreVertical className="w-4 h-4 text-content-body dark:text-content-subtle" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
