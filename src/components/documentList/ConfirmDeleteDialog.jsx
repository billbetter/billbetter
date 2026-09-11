import React from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, Trash2 } from "lucide-react";

/**
 * "Are you sure?" before deleting a document from a list page. The wording is
 * the caller's (`children`), because what deleting means differs: an invoice
 * is gone, a recurring schedule stops producing invoices.
 */
export default function ConfirmDeleteDialog({
  open,
  onOpenChange,
  title,
  deleting,
  onCancel,
  onConfirm,
  children,
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm rounded-2xl border border-line dark:border-ink-700 p-6 shadow-2xl dark:bg-ink-800">
        <DialogHeader className="space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-danger-100 flex items-center justify-center mx-auto shadow-sm dark:bg-danger-900/30">
            <Trash2 className="w-7 h-7 text-danger-600 dark:text-danger-400" />
          </div>
          <DialogTitle className="text-center text-xl font-bold text-content dark:text-content-inverted">
            {title}
          </DialogTitle>
          <DialogDescription className="text-center text-sm text-content-muted dark:text-content-subtle leading-relaxed">
            {children}
          </DialogDescription>
        </DialogHeader>
        <div className="flex gap-3 mt-8">
          <Button
            variant="outline"
            onClick={onCancel}
            disabled={deleting}
            className="flex-1 h-12 text-sm font-semibold border-line dark:border-ink-700 dark:bg-ink-800 dark:text-ink-300 rounded-xl hover:bg-surface-sunken dark:hover:bg-ink-700"
          >
            Cancel
          </Button>
          <Button
            onClick={onConfirm}
            disabled={deleting}
            className="flex-1 h-12 text-sm font-semibold bg-danger-600 hover:bg-danger-700 dark:bg-danger-600 dark:hover:bg-danger-700 text-content-inverted rounded-xl shadow-lg shadow-danger-200 dark:shadow-danger-900/30"
          >
            {deleting ? <Loader2 className="w-5 h-5 animate-spin" /> : "Delete"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
