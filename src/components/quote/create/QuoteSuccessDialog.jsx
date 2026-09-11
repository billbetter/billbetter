import React from "react";
import { AlertCircle, CheckCircle, Download, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { createPageUrl } from "@/utils";
import { deliverPdf } from "@/lib/pdfDelivery";

/** After saving: what was sent to the client, the PDF, and the share link. */
export default function QuoteSuccessDialog({
  copyToClipboard,
  handleSuccessClose,
  navigate,
  setSuccessDialog,
  successDialog,
}) {
  return (
    <Dialog
      open={successDialog.open}
      onOpenChange={(open) => !open && handleSuccessClose()}
    >
      <DialogContent className="sm:max-w-lg border-line dark:border-ink-700 bg-surface dark:bg-surface-inverted shadow-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3 text-xl sm:text-2xl text-content dark:text-ink-50">
            <div className="w-12 h-12 rounded-full bg-success-100 dark:bg-success-900/30 flex items-center justify-center shrink-0">
              <CheckCircle className="w-6 h-6 text-success-600 dark:text-success-400" />
            </div>
            <div className="min-w-0">
              <div className="truncate">Quote Created!</div>
              <div className="text-sm font-normal text-content-muted dark:text-content-subtle truncate">
                #{successDialog.quote?.quote_number}
              </div>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Notification Status */}
          <div className="space-y-2">
            {successDialog.notifications?.hasPdf && (
              <div className="flex items-center gap-3 p-3 bg-success-50 dark:bg-success-900/20 rounded-lg border border-success-200 dark:border-success-800">
                <FileText className="w-5 h-5 text-success-600 dark:text-success-400 shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-success-900 dark:text-success-100">
                    PDF Generated
                  </p>
                  <p className="text-xs text-success-700 dark:text-success-300 truncate">
                    Ready for download
                  </p>
                </div>
              </div>
            )}

            {successDialog.notifications?.hasEmail && (
              <div
                className={`flex items-center gap-3 p-3 rounded-lg border ${successDialog.notifications.email ? "bg-success-50 dark:bg-success-900/20 border-success-200 dark:border-success-800" : "bg-warning-50 dark:bg-warning-900/20 border-warning-200 dark:border-warning-800"}`}
              >
                {successDialog.notifications.email ? (
                  <CheckCircle className="w-5 h-5 text-success-600 dark:text-success-400 shrink-0" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-warning-600 dark:text-warning-400 shrink-0" />
                )}
                <div className="min-w-0 flex-1">
                  <p
                    className={`text-sm font-semibold ${successDialog.notifications.email ? "text-success-900 dark:text-success-100" : "text-warning-900 dark:text-warning-100"}`}
                  >
                    Email{" "}
                    {successDialog.notifications.email ? "Sent" : "Failed"}
                  </p>
                  {successDialog.notifications.emailError && (
                    <p className="text-xs text-warning-700 dark:text-warning-300 mt-1 break-words">
                      {successDialog.notifications.emailError}
                    </p>
                  )}
                </div>
              </div>
            )}

            {successDialog.notifications?.hasPhone && (
              <div
                className={`flex items-center gap-3 p-3 rounded-lg border ${successDialog.notifications.sms ? "bg-success-50 dark:bg-success-900/20 border-success-200 dark:border-success-800" : "bg-warning-50 dark:bg-warning-900/20 border-warning-200 dark:border-warning-800"}`}
              >
                {successDialog.notifications.sms ? (
                  <CheckCircle className="w-5 h-5 text-success-600 dark:text-success-400 shrink-0" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-warning-600 dark:text-warning-400 shrink-0" />
                )}
                <div className="min-w-0 flex-1">
                  <p
                    className={`text-sm font-semibold ${successDialog.notifications.sms ? "text-success-900 dark:text-success-100" : "text-warning-900 dark:text-warning-100"}`}
                  >
                    SMS {successDialog.notifications.sms ? "Sent" : "Failed"}
                  </p>
                  {successDialog.notifications.smsError && (
                    <p className="text-xs text-warning-700 dark:text-warning-300 mt-1">
                      {successDialog.notifications.smsError}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* PDF Download */}
          {successDialog.quote?.pdf_url && (
            <Button
              onClick={() =>
                deliverPdf(successDialog.quote.pdf_url, {
                  filename: `Quote-${successDialog.quote.quote_number || "000"}.pdf`,
                  mode: "open",
                })
              }
              className="w-full bg-surface-inverted hover:bg-ink-800 dark:bg-ink-800 dark:hover:bg-ink-700 text-content-inverted h-11"
            >
              <Download className="w-4 h-4 mr-2" />
              Download PDF
            </Button>
          )}

          {/* Copy Link */}
          {successDialog.quote?.pdf_url && (
            <Button
              onClick={() => copyToClipboard(successDialog.quote.pdf_url)}
              variant="outline"
              className="w-full border-line-strong dark:border-ink-600 hover:bg-surface-sunken dark:hover:bg-ink-800 text-ink-700 dark:text-ink-300 h-11"
            >
              Copy PDF Link
            </Button>
          )}
        </div>

        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={() => {
              setSuccessDialog({
                open: false,
                quote: null,
                notifications: {
                  sms: false,
                  email: false,
                  hasPdf: false,
                  hasPhone: false,
                  hasEmail: false,
                  smsError: null,
                  emailError: null,
                },
              });
              navigate(
                createPageUrl("QuoteDetail") +
                  `?id=${successDialog.quote?.id}`,
              );
            }}
            className="flex-1 border-line-strong dark:border-ink-600 dark:text-ink-300 dark:hover:bg-ink-800 h-11"
          >
            View Quote
          </Button>
          <Button
            onClick={handleSuccessClose}
            className="flex-1 bg-brand hover:bg-brand-hover dark:bg-brand dark:hover:bg-brand-hover text-content-inverted h-11"
          >
            Done
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
