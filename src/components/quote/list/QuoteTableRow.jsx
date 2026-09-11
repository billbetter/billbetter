import React from "react";
import { Button } from "@/components/ui/button";
import { Clock, ExternalLink, Trash2 } from "lucide-react";
import { Link } from "react-router-dom";
import { TableCell, TableRow } from "@/components/ui/table";
import { createPageUrl } from "@/utils";
import { statusConfig } from "@/components/quote/list/quoteStatus";
import { getExpiryStatus } from "@/components/quote/list/quoteStatus";
import QuoteStatusCell from "@/components/quote/list/QuoteStatusCell";
import { formatCalendarDay } from "@/lib/calendarDate";

/** One quote in the desktop table: number, client, who responded, amount,
 * expiry, status dropdown and Open / Delete. */
export default function QuoteTableRow({
  handleStatusChange,
  navigate,
  quote,
  setDeleteDialog,
  updatingStatus,
}) {  const expiryStatus = getExpiryStatus(quote.expiry_date);

  return (
    <TableRow
      className="border-b border-line-subtle dark:border-ink-700 hover:bg-surface-sunken/50 dark:hover:bg-ink-700/50 transition-colors group"
    >
      <TableCell className="py-4 px-4">
        <div className="flex items-center gap-3">
          <div
            className={`w-1 h-8 rounded-full ${statusConfig[quote.status]?.indicator || "bg-ink-300"}`}
          />
          <button
            onClick={() =>
              navigate(
                createPageUrl("QuoteDetail") +
                  `?id=${quote.id}`,
              )
            }
            className="font-bold text-content dark:text-content-inverted hover:text-accent-600 dark:hover:text-accent-400 transition-colors text-sm"
          >
            {quote.quote_number || `#${quote.id.slice(0, 8)}`}
          </button>
        </div>
      </TableCell>

      <TableCell className="py-4 px-4">
        <p className="font-bold text-content dark:text-content-inverted text-sm">
          {quote.client_name}
        </p>
        {quote.client_email && (
          <p className="text-xs text-content-muted dark:text-content-subtle mt-0.5">
            {quote.client_email}
          </p>
        )}
      </TableCell>

      <TableCell className="py-4 px-4">
        <p className="text-sm font-semibold text-ink-700 dark:text-ink-300">
          {formatCalendarDay(quote.date_issued, "MMM d, yyyy")}
        </p>
      </TableCell>

      <TableCell className="py-4 px-4">
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${expiryStatus.bgColor} ${expiryStatus.color}`}
        >
          <Clock className="w-3 h-3" />
          {expiryStatus.text}
        </span>
      </TableCell>

      <TableCell className="py-4 px-4 text-right">
        <p className="font-bold text-content dark:text-content-inverted text-base">
          ${quote.total?.toFixed(2)}
        </p>
      </TableCell>

      <QuoteStatusCell
        handleStatusChange={handleStatusChange}
        quote={quote}
        updatingStatus={updatingStatus}
      />

      <TableCell className="py-4 px-4">
        <div className="flex items-center justify-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            asChild
            className="h-8 w-8 text-content-muted hover:text-accent-700 dark:hover:text-accent-400 hover:bg-accent-50 dark:hover:bg-accent-900/30 rounded-lg"
            title="Open"
          >
            <Link
              to={
                createPageUrl("QuoteDetail") +
                `?id=${quote.id}`
              }
            >
              <ExternalLink className="w-4 h-4" />
            </Link>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() =>
              setDeleteDialog({ open: true, quote })
            }
            className="h-8 w-8 text-content-body hover:text-danger-700 dark:hover:text-danger-400 hover:bg-danger-50 dark:hover:bg-danger-900/30 rounded-lg dark:text-ink-300"
            title="Delete"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}
