import React from "react";
import { Button } from "@/components/ui/button";
import { CheckSquare, Loader2, Send } from "lucide-react";

/**
 * Batch sending.
 *
 * Off until asked for: checkboxes on every row turn a list you mostly read
 * into a form, and the usual action here is opening one invoice. Once on, the
 * bar states plainly how many are re-sends, because mailing a client a second
 * copy of the same invoice is a different act from sending it for the first
 * time. The send itself is the page's handleBatchSend, passed in untouched.
 */
export default function BatchSendBar({
  allSelectableChosen,
  batchProgress,
  batchRunning,
  chosen,
  exitSelectMode,
  handleBatchSend,
  resendCount,
  selectMode,
  selectableIds,
  setSelectMode,
  toggleAll,
}) {
  return <>
    {selectableIds.length > 0 && (
      <div className="bg-surface dark:bg-surface-inverted rounded-xl border border-line-subtle dark:border-ink-800 p-3 sm:p-4 shadow-sm">
        {!selectMode ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-content-body dark:text-content-subtle">
              {selectableIds.length}{" "}
              {selectableIds.length === 1 ? "invoice" : "invoices"} can be
              sent or re-sent.
            </p>
            <Button
              variant="outline"
              onClick={() => setSelectMode(true)}
              className="dark:border-ink-700 dark:text-ink-300 dark:hover:bg-ink-800"
            >
              <CheckSquare className="w-4 h-4 mr-2" />
              Select invoices
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                onClick={toggleAll}
                disabled={batchRunning}
                className="text-sm font-semibold text-brand-700 hover:underline dark:text-brand-300"
              >
                {allSelectableChosen
                  ? "Clear selection"
                  : `Select all ${selectableIds.length}`}
              </button>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  onClick={exitSelectMode}
                  disabled={batchRunning}
                  className="text-content-body dark:text-content-subtle"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleBatchSend}
                  disabled={batchRunning || chosen.length === 0}
                  className="bg-brand hover:bg-brand-hover text-content-inverted"
                >
                  {batchRunning ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4 mr-2" />
                  )}
                  {batchRunning
                    ? `Sending ${batchProgress.done} of ${batchProgress.total}...`
                    : `Send ${chosen.length}`}
                </Button>
              </div>
            </div>

            {chosen.length > 0 && !batchRunning && (
              <p className="text-xs text-content-muted dark:text-content-subtle">
                {resendCount > 0 ? (
                  <>
                    <span className="font-semibold text-caution-700 dark:text-caution-400">
                      {resendCount} of these{" "}
                      {resendCount === 1 ? "has" : "have"} already been
                      sent
                    </span>{" "}
                    — your client will get a second copy.{" "}
                  </>
                ) : null}
                Each client gets an email or text with a link to view and
                pay. No PDF is attached.
              </p>
            )}

            {batchRunning && (
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-ink-100 dark:bg-ink-800">
                <div
                  className="h-full rounded-full bg-brand transition-all"
                  style={{
                    width: `${batchProgress.total ? (batchProgress.done / batchProgress.total) * 100 : 0}%`,
                  }}
                />
              </div>
            )}
          </div>
        )}
      </div>
    )}
    </>;
}
