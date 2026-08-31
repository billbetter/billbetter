/**
 * Record a payment against an invoice.
 *
 * Prefilled with today's date and the outstanding balance, so the common case
 * -- "they paid it, all of it, today" -- is still two clicks. Everything else
 * is editable, because the common case is not the only one: a cheque banked on
 * Friday gets entered on Monday, and a deposit is not the whole invoice.
 *
 * The write is the caller's job. This collects and validates; InvoiceDetail
 * and the Invoices list both save it the same way, through the same helpers,
 * so a payment recorded from either screen is the same row.
 */

import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AlertCircle, Loader2, Wallet } from "lucide-react";
import {
  PAYMENT_METHODS,
  formatMoney,
  paymentSummary,
  validatePayment,
} from "@/lib/invoicePayments";

export default function RecordPaymentDialog({
  open,
  onOpenChange,
  invoice,
  payments = [],
  saving = false,
  error = null,
  onRecord,
}) {
  const summary = paymentSummary(invoice, payments);

  const [amount, setAmount] = useState("");
  const [paidAt, setPaidAt] = useState("");
  const [method, setMethod] = useState("");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");

  // Reset every time it opens, so a dialog closed half-filled does not reopen
  // with last time's numbers and get saved by muscle memory.
  useEffect(() => {
    if (!open) return;
    const outstanding = summary.balance > 0 ? summary.balance : summary.total;
    setAmount(outstanding > 0 ? String(outstanding.toFixed(2)) : "");
    setPaidAt(new Date().toISOString().slice(0, 10));
    setMethod("");
    setReference("");
    setNotes("");
    // summary is derived from props that do not change while open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, invoice?.id]);

  if (!invoice) return null;

  const check = validatePayment({ invoice, payments, amount });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record a payment</DialogTitle>
          <DialogDescription>
            {invoice.invoice_number} · {formatMoney(summary.total)} total
            {summary.paid !== 0 && (
              <>
                {" "}
                · {formatMoney(summary.paid)} already paid ·{" "}
                <strong>{formatMoney(summary.balance)} owed</strong>
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="grid sm:grid-cols-2 gap-4 mt-2">
          <div>
            <Label htmlFor="payment-amount">Amount</Label>
            <Input
              id="payment-amount"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="h-11 mt-1"
            />
          </div>
          <div>
            <Label htmlFor="payment-date">Date received</Label>
            <Input
              id="payment-date"
              type="date"
              value={paidAt}
              onChange={(e) => setPaidAt(e.target.value)}
              className="h-11 mt-1"
            />
          </div>
        </div>

        <div className="mt-4">
          <Label>Method</Label>
          {/* Buttons rather than a select: on a phone in a van this is one tap,
              and the list is short enough to show whole. The column is free
              text, so "Other" leaves it unset rather than lying. */}
          <div className="flex flex-wrap gap-2 mt-2">
            {PAYMENT_METHODS.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMethod(method === m ? "" : m)}
                className={`px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
                  method === m
                    ? "border-brand bg-brand-50 dark:bg-brand-900/30 text-brand-800 dark:text-brand-300"
                    : "border-line dark:border-ink-700 bg-surface dark:bg-ink-800 text-ink-700 dark:text-ink-300 hover:bg-surface-sunken dark:hover:bg-ink-700"
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4">
          <Label htmlFor="payment-reference">
            Reference{" "}
            <span className="font-normal text-content-muted dark:text-content-subtle">
              (optional)
            </span>
          </Label>
          <Input
            id="payment-reference"
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            placeholder="Cheque number, e-transfer reference…"
            className="h-11 mt-1"
          />
          <p className="text-xs text-content-muted dark:text-content-subtle mt-1.5">
            Whatever helps you find it on your bank statement.
          </p>
        </div>

        <div className="mt-4">
          <Label htmlFor="payment-notes">
            Notes{" "}
            <span className="font-normal text-content-muted dark:text-content-subtle">
              (optional)
            </span>
          </Label>
          <Textarea
            id="payment-notes"
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="mt-1"
          />
        </div>

        {/* An overpayment is flagged and allowed. A client who rounds up, or
            pays two invoices with one cheque, has genuinely handed over the
            money -- refusing to record it would be worse than recording an
            awkward number. */}
        {check.warning && (
          <div className="mt-4 flex gap-2 text-sm text-alert-700 dark:text-alert-400">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{check.warning}</span>
          </div>
        )}
        {(error || (!check.ok && check.reason && amount !== "")) && (
          <p className="mt-4 text-sm text-danger-600 dark:text-danger-400">
            {error || check.reason}
          </p>
        )}

        <div className="flex justify-end gap-3 mt-6">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button
            onClick={() =>
              onRecord({
                amount,
                paidAt,
                method,
                reference,
                notes,
              })
            }
            disabled={saving || !check.ok}
            className="bg-brand hover:bg-brand-hover text-content-inverted gap-2"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Recording…
              </>
            ) : (
              <>
                <Wallet className="w-4 h-4" />
                Record payment
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
