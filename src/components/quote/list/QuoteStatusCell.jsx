import React from "react";
import { FileText, Loader2 } from "lucide-react";
import ReadReceiptBadge from "@/components/invoice/ReadReceiptBadge";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import { TableCell } from "@/components/ui/table";
import { respondedBy, statusConfig } from "@/components/quote/list/quoteStatus";

/** The desktop row's status: badge or dropdown, plus who responded, if a client did. */
export default function QuoteStatusCell({
  handleStatusChange,
  quote,
  updatingStatus,
}) {
  const StatusIcon =
    statusConfig[quote.status]?.icon || FileText;

  return (
    <TableCell className="py-4 px-4">
      <Select
        value={quote.status}
        onValueChange={(value) =>
          handleStatusChange(quote.id, value)
        }
        disabled={
          updatingStatus === quote.id ||
          quote.status === "converted"
        }
      >
        <SelectTrigger
          className={`w-28 h-7 border-0 bg-transparent p-0 focus:ring-0 text-xs ${updatingStatus === quote.id ? "opacity-50" : ""}`}
        >
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${statusConfig[quote.status]?.color || "bg-ink-100"}`}
          >
            {updatingStatus === quote.id ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <StatusIcon className="w-3 h-3" />
            )}
            <span className="capitalize">
              {quote.status}
            </span>
          </span>
        </SelectTrigger>
        <SelectContent
          align="start"
          className="rounded-xl dark:bg-ink-800 dark:border-ink-700"
        >
          {Object.keys(statusConfig).map((status) => (
            <SelectItem
              key={status}
              value={status}
              className="capitalize text-xs rounded-lg dark:text-ink-300 dark:focus:bg-ink-700"
              disabled={
                status === "converted" &&
                quote.status !== "converted"
              }
            >
              <div className="flex items-center gap-2">
                {React.createElement(
                  statusConfig[status].icon,
                  { className: "w-3.5 h-3.5" },
                )}
                {status}
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {/*
        The name the client typed, under the badge. A green
        badge says the quote is settled; it does not say who
        settled it, and "who" is the part that matters three
        months later.
      */}
      {respondedBy(quote) && (
        <p className="mt-1 text-[11px] leading-tight text-content-muted dark:text-content-subtle truncate max-w-[130px]">
          {respondedBy(quote).verb}{" "}
          <span className="font-medium text-content-body dark:text-ink-300">
            {respondedBy(quote).who}
          </span>
        </p>
      )}

      {/* A quote that has been read and not answered is the
          one worth a phone call. Renders nothing when there
          is no receipt to show. */}
      <ReadReceiptBadge
        document={quote}
        className="mt-1.5"
      />
    </TableCell>
  );
}
