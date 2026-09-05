import React, { useMemo, useState } from "react";
import { FileText, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { sdk } from "@/api/sdk";
import {
  DEMAND_LETTER_DAYS,
  demandLetterCandidates,
  dismissPatch,
} from "@/lib/demandLetter";

/**
 * The prompt that offers to draft a formal demand letter.
 *
 * -- One at a time, on purpose --------------------------------------------
 *
 * A contractor with six invoices past 21 days gets one banner, for the worst
 * of them, and a line saying how many others are waiting. Six stacked prompts
 * would be a wall to clear rather than a decision to make, and clearing a wall
 * is done by dismissing all of it -- including the one that mattered.
 *
 * -- Why it does not use the notification bell -----------------------------
 *
 * It cannot. sdk.entities.Notification.filter() is hardcoded to resolve to an
 * empty array, so nothing written there is ever read back; the bell is a shell
 * with no store behind it. A banner rendered from the invoice rows themselves
 * needs no such store and cannot fall out of step with the invoice it is
 * about -- if the client pays this morning, the prompt is gone by the next
 * load rather than sitting in a queue announcing a debt that is settled.
 */
export default function DemandLetterBanner({
  invoices,
  onDraftLetter,
  onDismissed,
  className = "",
}) {
  const [dismissing, setDismissing] = useState(false);
  // Dismissal is written to the invoice, but the banner should go the instant
  // it is clicked rather than after a round trip. Kept locally so a slow
  // network does not leave a "dismissed" prompt sitting on screen.
  const [dismissedIds, setDismissedIds] = useState(() => new Set());

  const candidates = useMemo(
    () =>
      demandLetterCandidates(invoices).filter(
        (row) => !dismissedIds.has(row.invoice.id),
      ),
    [invoices, dismissedIds],
  );

  const top = candidates[0];
  if (!top) return null;

  const { invoice, prompt, overdue } = top;
  const others = candidates.length - 1;

  const handleDismiss = async () => {
    setDismissing(true);
    setDismissedIds((prev) => new Set(prev).add(invoice.id));
    try {
      await sdk.entities.Invoice.update(invoice.id, dismissPatch());
      onDismissed?.(invoice);
    } catch (error) {
      // The banner stays gone for this session either way. Re-showing it after
      // a failed write would mean the contractor has to dismiss it twice for
      // reasons they cannot see; it simply returns on the next load, which is
      // the honest outcome of a dismissal that was not recorded.
      console.error("Could not record demand letter dismissal:", error);
    } finally {
      setDismissing(false);
    }
  };

  const clientName = invoice.client_name || "this client";
  const invoiceNumber = invoice.invoice_number || "this invoice";

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border border-warning-200 bg-warning-50 p-4 sm:p-5 dark:border-warning-900/60 dark:bg-warning-950/40 ${className}`}
      role="status"
    >
      <div className="flex items-start gap-3 sm:gap-4">
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-warning-100 dark:bg-warning-900/50">
          <FileText className="h-5 w-5 text-warning-700 dark:text-warning-400" />
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold uppercase tracking-widest text-warning-700 dark:text-warning-400">
            {prompt === "follow_up"
              ? "Still unpaid"
              : `${DEMAND_LETTER_DAYS}+ days overdue`}
          </p>

          <p className="mt-1 text-sm font-semibold text-content dark:text-content-inverted">
            Invoice {invoiceNumber} to {clientName} is now {overdue} days
            overdue.
          </p>

          <p className="mt-1 text-sm text-content-body dark:text-content-subtle">
            {prompt === "follow_up"
              ? "It has been more than a month. Want help drafting a formal demand letter?"
              : "Want help drafting a formal demand letter?"}
          </p>

          {others > 0 && (
            <p className="mt-1.5 text-xs text-content-muted dark:text-content-muted">
              and {others} other {others === 1 ? "invoice" : "invoices"} past{" "}
              {DEMAND_LETTER_DAYS} days
            </p>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button
              onClick={() => onDraftLetter?.(invoice)}
              className="h-9 rounded-xl bg-warning-700 px-4 text-sm font-semibold text-content-inverted hover:bg-warning-800"
            >
              Draft a demand letter
            </Button>
            <Button
              variant="ghost"
              onClick={handleDismiss}
              disabled={dismissing}
              className="h-9 rounded-xl px-3 text-sm font-medium text-content-body dark:text-content-subtle"
            >
              {dismissing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Not now"
              )}
            </Button>
          </div>
        </div>

        <button
          type="button"
          onClick={handleDismiss}
          disabled={dismissing}
          aria-label="Dismiss"
          className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-content-muted transition-colors hover:bg-warning-100 hover:text-content-body dark:hover:bg-warning-900/50"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
