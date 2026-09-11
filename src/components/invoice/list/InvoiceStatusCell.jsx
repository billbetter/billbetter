import React from "react";
import { FileText, Loader2 } from "lucide-react";
import ReadReceiptBadge from "@/components/invoice/ReadReceiptBadge";
import { SETTABLE_STATUSES, statusConfig } from "@/components/invoice/list/invoiceStatus";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import { TableCell } from "@/components/ui/table";
import { isVoided } from "@/lib/invoiceVoid";

export default function InvoiceStatusCell({
  handleStatusChange,
  invoice,
  updatingStatus,
}) {
  const StatusIcon = statusConfig[invoice.status]?.icon || FileText;

  return (
    <TableCell className="py-4 px-6">
      {/* A voided invoice's status is frozen. Leaving the
          dropdown live would let one click undo a void
          that recorded who did it and why -- and there is
          no equivalent record of the undo. */}
      <Select
        value={invoice.status}
        onValueChange={(value) =>
          handleStatusChange(invoice.id, value)
        }
        disabled={
          updatingStatus === invoice.id || isVoided(invoice)
        }
      >
        <SelectTrigger
          className={`w-28 h-7 border-0 bg-transparent p-0 focus:ring-0 text-xs ${updatingStatus === invoice.id ? "opacity-50" : ""}`}
        >
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${statusConfig[invoice.status]?.color || "bg-ink-100"}`}
          >
            {updatingStatus === invoice.id ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <StatusIcon className="w-3 h-3" />
            )}
            <span className="capitalize">
              {invoice.status}
            </span>
          </span>
        </SelectTrigger>
        <SelectContent
          align="start"
          className="rounded-xl dark:bg-ink-800 dark:border-ink-700"
        >
          {SETTABLE_STATUSES.map((status) => (
            <SelectItem
              key={status}
              value={status}
              className="capitalize text-xs rounded-lg dark:text-ink-300 dark:focus:bg-ink-700"
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

      {/* Under the status, not beside it: whether the
          client has opened it is the first thing you want
          to know about an invoice that is still sitting at
          "sent", and it is nothing at all once it is paid.
          Renders itself away when there is no receipt. */}
      <ReadReceiptBadge
        document={invoice}
        className="mt-1.5"
      />
    </TableCell>
  );
}
