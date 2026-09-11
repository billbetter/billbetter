import React from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Link } from "react-router-dom";
import { statusConfig } from "@/components/invoice/list/invoiceStatus";
import { TableCell, TableRow } from "@/components/ui/table";
import { createPageUrl } from "@/utils";
import { format } from "date-fns";
import { formatMoney, paymentSummary } from "@/lib/invoicePayments";
import InvoiceRowActions from "@/components/invoice/list/InvoiceRowActions";
import InvoiceStatusCell from "@/components/invoice/list/InvoiceStatusCell";

export default function InvoiceTableRow({
  batchRunning,
  eligibility,
  handleStatusChange,
  invoice,
  paymentsByInvoice,
  selectMode,
  selectedIds,
  setDeleteDialog,
  setNotificationDialog,
  toggleOne,
  updatingStatus,
}) {
  return (
    <TableRow
      className="border-b border-line-subtle dark:border-ink-700 hover:bg-surface-sunken/50 dark:hover:bg-ink-700/50 transition-colors group"
    >
      {selectMode && (
        <TableCell className="py-4 pl-6 pr-0">
          {/* Ineligible rows show a disabled box with the
              reason on hover rather than an empty cell, so
              "why can't I pick this one" is answered where
              it is asked. */}
          <Checkbox
            checked={selectedIds.has(invoice.id)}
            onCheckedChange={() => toggleOne(invoice.id)}
            disabled={
              batchRunning || !eligibility.get(invoice.id)?.ok
            }
            title={eligibility.get(invoice.id)?.reason || ""}
            aria-label={`Select invoice ${invoice.invoice_number || ""}`}
          />
        </TableCell>
      )}
      <TableCell className="py-4 px-6">
        <div className="flex items-center gap-3">
          <div
            className={`w-1 h-8 rounded-full ${statusConfig[invoice.status]?.indicator || "bg-ink-300"}`}
          />
          <Link
            to={
              createPageUrl("InvoiceDetail") +
              `?id=${invoice.id}`
            }
            className="font-bold text-content dark:text-content-inverted hover:text-info-600 dark:hover:text-info-400 transition-colors text-sm"
          >
            {invoice.invoice_number ||
              `#${invoice.id.slice(0, 8)}`}
          </Link>
        </div>
      </TableCell>

      <TableCell className="py-4 px-6">
        <p className="font-bold text-content dark:text-content-inverted text-sm">
          {invoice.client_name}
        </p>
        {invoice.client_email && (
          <p className="text-xs text-content-muted dark:text-content-subtle mt-0.5">
            {invoice.client_email}
          </p>
        )}
      </TableCell>

      <TableCell className="py-4 px-6">
        <p className="text-sm font-semibold text-ink-700 dark:text-ink-300">
          {format(
            new Date(invoice.created_date),
            "MMM d, yyyy",
          )}
        </p>
        <p className="text-xs text-content-subtle dark:text-content-muted mt-0.5">
          Due{" "}
          {format(
            new Date(
              invoice.due_date || invoice.created_date,
            ),
            "MMM d",
          )}
        </p>
      </TableCell>

      <TableCell className="py-4 px-6 text-right">
        <p className="font-bold text-content dark:text-content-inverted text-base">
          ${invoice.total?.toFixed(2)}
        </p>
        {/* Only when a PART of it has been paid. A fully
            unpaid invoice already says what is owed -- the
            total -- and repeating it on every row would bury
            the handful where it differs. */}
        {(() => {
          const s = paymentSummary(
            invoice,
            paymentsByInvoice.get(invoice.id) || [],
          );
          if (s.count === 0 || s.settled) return null;
          return (
            <p className="text-xs font-semibold text-alert-700 dark:text-alert-400 mt-0.5">
              {formatMoney(s.balance)} still owed
            </p>
          );
        })()}
      </TableCell>

      <InvoiceStatusCell
        handleStatusChange={handleStatusChange}
        invoice={invoice}
        updatingStatus={updatingStatus}
      />

      <InvoiceRowActions
        invoice={invoice}
        setDeleteDialog={setDeleteDialog}
        setNotificationDialog={setNotificationDialog}
      />
    </TableRow>
  );
}
