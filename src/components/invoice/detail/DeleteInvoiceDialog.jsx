import React from "react";
import { Ban, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { canDeleteInvoice } from "@/lib/invoiceVoid";

/** Confirm deleting an invoice -- pointing to Void instead where that is
 * the better record to keep. */
export default function DeleteInvoiceDialog({
  canVoid,
  deleteDialog,
  deleting,
  handleDelete,
  invoice,
  setDeleteDialog,
  setVoidDialog,
  setVoidError,
}) {
  return (
    <Dialog open={deleteDialog} onOpenChange={setDeleteDialog}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete Invoice</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete invoice {invoice.invoice_number}?
            This action cannot be undone.
          </DialogDescription>
        </DialogHeader>

        {/* Deleting a sent invoice is still allowed -- it was allowed before
            this feature and removing it would take away something
            contractors do. But the client has this number, so the dialog
            says what disappears and offers the answer that keeps it. */}
        {canDeleteInvoice(invoice).prefer === "void" && (
          <div className="rounded-lg border border-line dark:border-ink-700 bg-ink-50 dark:bg-ink-800/60 p-3">
            <p className="text-sm text-content-body dark:text-ink-300">
              Your client has already been sent this invoice. Deleting it
              leaves nothing to point at if they ask about{" "}
              {invoice.invoice_number} later.
            </p>
            {canVoid.ok && (
              <Button
                variant="outline"
                size="sm"
                className="mt-3 gap-2"
                onClick={() => {
                  setDeleteDialog(false);
                  setVoidError(null);
                  setVoidDialog(true);
                }}
              >
                <Ban className="w-4 h-4" />
                Void it instead
              </Button>
            )}
          </div>
        )}

        <div className="flex justify-end gap-3 mt-4">
          <Button
            variant="outline"
            onClick={() => setDeleteDialog(false)}
            disabled={deleting}
          >
            Cancel
          </Button>
          <Button
            onClick={handleDelete}
            disabled={deleting}
            className="bg-danger-600 hover:bg-danger-700"
          >
            {deleting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Deleting...
              </>
            ) : (
              "Delete Invoice"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
