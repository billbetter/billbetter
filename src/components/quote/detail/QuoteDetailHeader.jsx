import React from "react";
import { ArrowLeft, Download, Loader2, Send, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createPageUrl } from "@/utils";

/** Back link and the desktop actions: copy link, PDF, resend, delete.
 * Resend is the page's handleResendNotifications, passed in untouched. */
export default function QuoteDetailHeader({
  client,
  copyToClipboard,
  handleResendNotifications,
  navigate,
  quote,
  sendingNotifications,
  setDeleteDialog,
}) {
  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 sm:mb-8">
      <Button
        variant="ghost"
        onClick={() => navigate(createPageUrl("Quotes"))}
        className="gap-2"
      >
        <ArrowLeft className="w-4 h-4" />
        <span className="hidden sm:inline">Back to Quotes</span>
        <span className="sm:hidden">Back</span>
      </Button>

      {/* Desktop Actions */}
      <div className="hidden sm:flex flex-wrap items-center justify-end gap-2">
        {quote.pdf_url && (
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => copyToClipboard(quote.pdf_url)}
            >
              📋 Copy Link
            </Button>
            <Button variant="outline" size="sm" asChild>
              <a
                href={quote.pdf_url}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Download className="w-4 h-4 mr-2" />
                PDF
              </a>
            </Button>
          </>
        )}
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
        <Button
          variant="outline"
          size="sm"
          onClick={() => setDeleteDialog(true)}
          className="text-danger-700 hover:text-danger-700 hover:bg-danger-50 dark:text-danger-400 dark:hover:text-danger-400 dark:hover:bg-danger-900/20"
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
