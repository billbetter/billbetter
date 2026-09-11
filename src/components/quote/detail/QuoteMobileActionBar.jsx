import React from "react";
import { Button } from "@/components/ui/button";
import { Download, Loader2, Send, Trash2 } from "lucide-react";

/** The phone layout's fixed action bar: the same actions as the desktop header. */
export default function QuoteMobileActionBar({
  client,
  copyToClipboard,
  handleResendNotifications,
  quote,
  sendingNotifications,
  setDeleteDialog,
}) {
  return (
    <div
      className="sm:hidden fixed bottom-0 left-0 right-0 bg-surface dark:bg-surface-inverted border-t border-line dark:border-ink-700 shadow-lg z-40"
      style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 8px)" }}
    >
      <div className="p-3 flex items-center gap-2">
        {quote.pdf_url && (
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => copyToClipboard(quote.pdf_url)}
              className="flex-1 h-11"
            >
              📋 Copy
            </Button>
            <Button
              variant="outline"
              size="sm"
              asChild
              className="flex-1 h-11"
            >
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
          className="flex-1 h-11"
        >
          {sendingNotifications ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <>
              <Send className="w-4 h-4 mr-2" />
              Resend
            </>
          )}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setDeleteDialog(true)}
          className="text-danger-700 hover:text-danger-700 hover:bg-danger-50 h-11 px-3 dark:text-danger-400 dark:hover:text-danger-400 dark:hover:bg-danger-900/20"
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
