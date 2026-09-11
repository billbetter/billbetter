import React from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

/**
 * What the batch actually did.
 *
 * Named per invoice rather than summarised as "3 of 5 sent", because the only
 * useful next action is retrying the specific ones that failed, and a
 * contractor cannot do that from a count.
 */
export default function BatchSendResultDialog({
  batchResult,
  setBatchResult,
}) {
  return (
    <Dialog
      open={Boolean(batchResult)}
      onOpenChange={(open) => !open && setBatchResult(null)}
    >
      <DialogContent className="sm:max-w-md rounded-2xl border border-line dark:border-ink-700 p-6 shadow-2xl dark:bg-ink-800">
        <DialogHeader className="space-y-3">
          <DialogTitle className="text-lg font-bold text-content dark:text-content-inverted">
            {batchResult?.failed === 0
              ? `Sent ${batchResult?.sent} ${batchResult?.sent === 1 ? "invoice" : "invoices"}`
              : `Sent ${batchResult?.sent} of ${batchResult?.total}`}
          </DialogTitle>
          <DialogDescription className="text-content-body dark:text-content-subtle">
            {batchResult?.failed === 0
              ? "Every client has been contacted."
              : `${batchResult?.failed} could not be delivered. Nothing else was affected.`}
          </DialogDescription>
        </DialogHeader>

        {batchResult?.failed > 0 && (
          <div className="mt-2 max-h-56 space-y-2 overflow-y-auto">
            {batchResult.results
              .filter((r) => !r.emailed && !r.texted)
              .map((r) => (
                <div
                  key={r.id}
                  className="rounded-lg border border-danger-200 bg-danger-50 p-3 text-sm dark:border-danger-800 dark:bg-danger-900/20"
                >
                  <p className="font-semibold text-danger-800 dark:text-danger-300">
                    {r.invoice_number || r.id}
                  </p>
                  <p className="text-xs text-danger-700 dark:text-danger-400">
                    {r.errors[0] || "Failed to send"}
                  </p>
                </div>
              ))}
          </div>
        )}

        <Button
          onClick={() => setBatchResult(null)}
          className="mt-4 w-full bg-brand hover:bg-brand-hover text-content-inverted"
        >
          Done
        </Button>
      </DialogContent>
    </Dialog>
  );
}
