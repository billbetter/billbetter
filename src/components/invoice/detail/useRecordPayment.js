import { useState } from "react";
import { Invoice } from "@/entities/Invoice";
import { sdk } from "@/api/sdk";
import {
  paymentRecord,
  settledDate,
  statusChangeEvent,
  statusFromPayments,
  validatePayment,
} from "@/lib/invoicePayments";

/** The record-payment dialog's state, and the write behind it. */
export default function useRecordPayment({ invoice, payments, user, loadInvoiceData }) {
  const [paymentDialog, setPaymentDialog] = useState(false);
  const [recordingPayment, setRecordingPayment] = useState(false);
  const [paymentError, setPaymentError] = useState(null);

  /**
   * Record a payment, and settle the invoice if that was the last of it.
   *
   * The order matters and is the same ordering used everywhere else in this
   * codebase that writes two rows: the payment is created FIRST, and the
   * invoice is only marked paid once the payment actually exists. The reverse
   * would leave an invoice marked paid with no payment behind it if the second
   * write failed -- which is the state this whole feature exists to abolish.
   */
  const handleRecordPayment = async (form) => {
    const check = validatePayment({ invoice, payments, amount: form.amount });
    if (!check.ok) {
      setPaymentError(check.reason);
      return;
    }

    setRecordingPayment(true);
    setPaymentError(null);
    try {
      const created = await sdk.entities.InvoicePayment.create(
        paymentRecord({ invoice, user, ...form }),
      );
      const nextPayments = [...payments, created];

      // Only ever writes 'paid', and only when the payments actually settle
      // it. statusFromPayments never reopens an invoice.
      const nextStatus = statusFromPayments(invoice, nextPayments);
      if (nextStatus) {
        const patch = {
          status: nextStatus,
          // The date the LAST payment landed, not today -- this is what the
          // revenue charts are dated by now.
          paid_date: settledDate(invoice, nextPayments),
        };
        await Invoice.update(invoice.id, patch);
        await recordEvent(
          statusChangeEvent({
            invoice,
            from: invoice.status,
            to: nextStatus,
            detail: "Settled in full",
            user,
          }),
        );
      }

      setPaymentDialog(false);
      await loadInvoiceData();
    } catch (err) {
      console.error("Error recording payment:", err);
      setPaymentError(err?.message || "Could not record that payment.");
    }
    setRecordingPayment(false);
  };

  /**
   * Append to the history, never at the cost of the thing being recorded.
   *
   * A failed history write must not fail the payment or the status change it
   * describes: the money is the fact, the note about it is not. Reported to the
   * console rather than the user, who cannot act on it.
   */
  const recordEvent = async (row) => {
    try {
      await sdk.entities.InvoiceEvent.create(row);
    } catch (err) {
      console.error("Could not record history entry (ignored):", err);
    }
  };

  return {
    paymentDialog, setPaymentDialog, recordingPayment, paymentError, setPaymentError,
    handleRecordPayment,
  };
}
