import React from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";

/** Confirm deleting a quote. */
export default function DeleteQuoteDialog({
  deleteDialog,
  deleting,
  handleDelete,
  quote,
  setDeleteDialog,
}) {
  return (
    <Dialog open={deleteDialog} onOpenChange={setDeleteDialog}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete Quote</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete quote {quote.quote_number}? This
            action cannot be undone.
          </DialogDescription>
        </DialogHeader>
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
              "Delete Quote"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
