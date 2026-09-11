import React from "react";
import { ArrowLeft, Ban, Download, Loader2, Send, Trash2, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createPageUrl } from "@/utils";

/** Back link and the desktop action buttons (PDF, record payment, resend,
 * void, delete). Resend calls the page's handleResendNotifications, untouched. */
export default function InvoiceDetailHeader({
  canRecordPayment,
  canVoid,
  client,
  copyToClipboard,
  handleResendNotifications,
  invoice,
  navigate,
  sendingNotifications,
  setDeleteDialog,
  setPaymentDialog,
  setPaymentError,
  setVoidDialog,
  setVoidError,
  voided,
}) {
  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 sm:mb-8">
      <Button
        variant="ghost"
        onClick={() => navigate(createPageUrl("Invoices"))}
        className="gap-2"
      >
        <ArrowLeft className="w-4 h-4" />
        <span className="hidden sm:inline">Back to Invoices</span>
        <span className="sm:hidden">Back</span>
      </Button>

      {/* Desktop Actions */}
      <div className="hidden sm:flex flex-wrap items-center justify-end gap-2">
        {invoice.pdf_url && (
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                copyToClipboard(invoice.pdf_url);
                alert("PDF link copied to clipboard!");
              }}
            >
              📋 Copy Link
            </Button>
            <Button variant="outline" size="sm" asChild>
              <a
                href={invoice.pdf_url}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Download className="w-4 h-4 mr-2" />
                PDF
              </a>
            </Button>
          </>
        )}

        {/* Resend, Void and Delete all disappear once an invoice is voided.
            A voided invoice is a record to look at, not a document to act
            on -- and re-mailing one would be a demand for money the
            contractor has already withdrawn. */}
        {canRecordPayment && (
          <Button
            size="sm"
            onClick={() => {
              setPaymentError(null);
              setPaymentDialog(true);
            }}
            className="gap-2 bg-brand hover:bg-brand-hover text-content-inverted"
          >
            <Wallet className="w-4 h-4" />
            Record payment
          </Button>
        )}
        {!voided && (
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={handleResendNotifications}
              disabled={sendingNotifications || !client}
              className="gap-2"
            >
              {sendingNotifications ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              Resend
            </Button>
            {canVoid.ok && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setVoidError(null);
                  setVoidDialog(true);
                }}
                className="gap-2"
              >
                <Ban className="w-4 h-4" />
                Void
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDeleteDialog(true)}
              className="text-danger-700 hover:text-danger-700 hover:bg-danger-50 dark:text-danger-400 dark:hover:text-danger-400 dark:hover:bg-danger-900/20"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
