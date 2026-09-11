import React from "react";
import { ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

/** Confirm turning an approved quote into an invoice. */
export default function ConvertQuoteDialog({
  convertDialog,
  converting,
  handleConvertToInvoice,
  setConvertDialog,
}) {
  return (
    <Dialog
      open={convertDialog.open}
      onOpenChange={(open) => setConvertDialog({ open, quote: null })}
    >
      <DialogContent className="sm:max-w-sm rounded-2xl border border-line dark:border-ink-700 p-6 shadow-2xl dark:bg-ink-800">
        <DialogHeader className="space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-success-100 flex items-center justify-center mx-auto shadow-sm dark:bg-success-900/30">
            <ArrowRight className="w-7 h-7 text-success-600 dark:text-success-400" />
          </div>
          <DialogTitle className="text-center text-xl font-bold text-content dark:text-content-inverted">
            Convert to Invoice
          </DialogTitle>
          <DialogDescription className="text-center text-sm text-content-muted dark:text-content-subtle leading-relaxed">
            Convert{" "}
            <span className="font-bold text-content dark:text-content-inverted">
              {convertDialog.quote?.quote_number}
            </span>{" "}
            to an invoice? The quote will be marked as converted.
          </DialogDescription>
        </DialogHeader>
        <div className="flex gap-3 mt-8">
          <Button
            variant="outline"
            onClick={() => setConvertDialog({ open: false, quote: null })}
            disabled={converting === convertDialog.quote?.id}
            className="flex-1 h-12 text-sm font-semibold border-line dark:border-ink-700 dark:bg-ink-800 dark:text-ink-300 rounded-xl hover:bg-surface-sunken dark:hover:bg-ink-700"
          >
            Cancel
          </Button>
          <Button
            onClick={handleConvertToInvoice}
            disabled={converting === convertDialog.quote?.id}
            className="flex-1 h-12 text-sm font-semibold bg-brand hover:bg-brand-hover dark:bg-brand dark:hover:bg-brand-hover text-content-inverted rounded-xl shadow-lg shadow-success-200 dark:shadow-success-900/30"
          >
            {converting === convertDialog.quote?.id ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              "Convert"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
