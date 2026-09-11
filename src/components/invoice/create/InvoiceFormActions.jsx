import React from "react";
import { Button } from "@/components/ui/button";
import { CheckCircle, Download, Loader2 } from "lucide-react";
import { createPageUrl } from "@/utils";

/** Cancel, Save & Download, and the submit button (Send / Update / Schedule).
 * Submitting runs the page's handleSubmit, which is untouched. */
export default function InvoiceFormActions({
  formData,
  handleDownloadOnly,
  isEditing,
  isRecurring,
  navigate,
  saving,
  sendingStatus,
}) {
  return (
    <div className="flex flex-col-reverse sm:flex-row gap-2 sm:gap-3 pt-4 border-t border-line-subtle dark:border-ink-700">
      <Button
        type="button"
        variant="outline"
        onClick={() =>
          navigate(
            createPageUrl(
              isRecurring ? "RecurringInvoices" : "Invoices",
            ),
          )
        }
        className="w-full sm:flex-1 h-10 sm:h-11 border-line-strong dark:border-ink-600 hover:bg-surface-sunken dark:hover:bg-ink-800 text-ink-700 dark:text-ink-300 font-medium text-sm"
        disabled={saving || sendingStatus !== "idle"}
      >
        Cancel
      </Button>
      {!isRecurring && !isEditing && (
        <Button
          type="button"
          onClick={handleDownloadOnly}
          disabled={
            saving ||
            sendingStatus !== "idle" ||
            !formData.client_id ||
            formData.items.length === 0
          }
          variant="outline"
          className="w-full sm:flex-1 h-10 sm:h-11 border-info-600 text-info-700 dark:text-info-400 hover:bg-info-50 dark:hover:bg-info-900/20 font-medium shadow-sm hover:shadow-md transition-all dark:border-info-600 text-sm"
        >
          {saving && sendingStatus === "generating_pdf" ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Download className="w-4 h-4 mr-2" />
              Save & Download
            </>
          )}
        </Button>
      )}
      <Button
        type="submit"
        disabled={
          saving ||
          sendingStatus !== "idle" ||
          !formData.client_id ||
          formData.items.length === 0
        }
        className="w-full sm:flex-1 h-10 sm:h-11 bg-brand hover:bg-brand-hover dark:bg-brand dark:hover:bg-brand-hover text-content-inverted font-semibold shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm"
      >
        {saving || sendingStatus !== "idle" ? (
          <div className="flex items-center gap-2 justify-center">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-xs sm:text-sm">
              {sendingStatus === "generating_pdf"
                ? "Creating PDF..."
                : sendingStatus === "generating_payment_link"
                  ? "Payment Setup..."
                  : sendingStatus === "sending_sms"
                    ? "Sending Text..."
                    : sendingStatus === "sending_email"
                      ? "Sending Email..."
                      : "Processing..."}
            </span>
          </div>
        ) : (
          <span className="flex items-center justify-center gap-2">
            {isEditing
              ? "Update Invoice"
              : isRecurring
                ? "Schedule Recurring"
                : "Send Invoice"}
            {!isEditing && !isRecurring && (
              <CheckCircle className="w-4 h-4" />
            )}
          </span>
        )}
      </Button>
    </div>
  );
}
