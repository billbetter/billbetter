import React from "react";
import { Ban, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

/** Void an invoice: reason required, irreversible, kept as a record. */
export default function VoidInvoiceDialog({
  handleVoid,
  invoice,
  setVoidDialog,
  setVoidReason,
  voidDialog,
  voidError,
  voidReason,
  voiding,
}) {
  return (
    <Dialog open={voidDialog} onOpenChange={setVoidDialog}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Void invoice {invoice.invoice_number}?</DialogTitle>
          <DialogDescription>
            The invoice stays on record with its number, and this is written
            against it. Its payment link stops working immediately, and it can
            never be edited, sent or paid again. There is no undo.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-2">
          <label
            htmlFor="void-reason"
            className="text-sm font-semibold text-content dark:text-content-inverted"
          >
            Reason{" "}
            <span className="font-normal text-content-muted dark:text-content-subtle">
              (optional)
            </span>
          </label>
          <Textarea
            id="void-reason"
            value={voidReason}
            onChange={(e) => setVoidReason(e.target.value)}
            maxLength={500}
            rows={3}
            placeholder="Wrong client, duplicate, job cancelled…"
            className="mt-2"
          />
          <p className="text-xs text-content-muted dark:text-content-subtle mt-1.5">
            Only you and your crew see this. Your client is not told.
          </p>
        </div>

        {voidError && (
          <p className="text-sm text-danger-600 dark:text-danger-400 mt-3">
            {voidError}
          </p>
        )}

        <div className="flex justify-end gap-3 mt-4">
          <Button
            variant="outline"
            onClick={() => setVoidDialog(false)}
            disabled={voiding}
          >
            Keep it
          </Button>
          <Button onClick={handleVoid} disabled={voiding} className="gap-2">
            {voiding ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Voiding…
              </>
            ) : (
              <>
                <Ban className="w-4 h-4" />
                Void invoice
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
