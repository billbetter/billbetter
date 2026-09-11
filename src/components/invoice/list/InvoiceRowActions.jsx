import React from "react";
import { AlertCircle, Ban, ExternalLink, MoreVertical, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Link } from "react-router-dom";
import { TableCell } from "@/components/ui/table";
import { canDeleteInvoice } from "@/lib/invoiceVoid";
import { createPageUrl } from "@/utils";

export default function InvoiceRowActions({
  invoice,
  setDeleteDialog,
  setNotificationDialog,
}) {
  return (
    <TableCell className="py-4 px-6">
      <div className="flex items-center justify-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          asChild
          className="h-8 w-8 text-content-body hover:text-info-600 dark:hover:text-info-400 hover:bg-info-50 dark:hover:bg-info-900/30 rounded-lg dark:text-ink-300"
        >
          <Link
            to={
              createPageUrl("InvoiceDetail") +
              `?id=${invoice.id}`
            }
          >
            <ExternalLink className="w-4 h-4" />
          </Link>
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-content-body hover:text-ink-700 dark:hover:text-ink-200 hover:bg-ink-100 dark:hover:bg-ink-700 rounded-lg dark:text-ink-300"
            >
              <MoreVertical className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="w-44 rounded-xl dark:bg-ink-800 dark:border-ink-700"
          >
            {invoice.status === "overdue" && (
              <DropdownMenuItem
                onClick={() =>
                  setNotificationDialog({
                    open: true,
                    invoice,
                  })
                }
                className="rounded-lg dark:text-ink-300 dark:focus:bg-ink-700"
              >
                <AlertCircle className="w-4 h-4 mr-2 text-alert-500" />
                Send Reminder
              </DropdownMenuItem>
            )}
            {/* A voided invoice is a record. Delete is
                not offered here, and handleDelete refuses
                it as well -- hiding a control is
                presentation, not enforcement. */}
            {canDeleteInvoice(invoice).ok ? (
              <DropdownMenuItem
                onClick={() =>
                  setDeleteDialog({ open: true, invoice })
                }
                className="rounded-lg text-danger-600 dark:text-danger-400 dark:focus:bg-ink-700"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem
                disabled
                className="rounded-lg dark:text-ink-400"
              >
                <Ban className="w-4 h-4 mr-2" />
                Voided — kept on record
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </TableCell>
  );
}
