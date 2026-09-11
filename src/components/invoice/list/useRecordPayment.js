import { useState } from "react";
import { sdk } from "@/api/sdk";
import {
  paymentRecord,
  settledDate,
  statusChangeEvent,
  statusFromPayments,
} from "@/lib/invoicePayments";

/**
 * The Record Payment dialog's state and its save, for the invoice list.
 * `paymentFor` is the invoice the dialog is open for (null = closed).
 */
export default function useRecordPayment({ paymentsByInvoice, currentUser, loadData }) {
  const [paymentFor, setPaymentFor] = useState(null);
  const [recordingPayment, setRecordingPayment] = useState(false);
  const [paymentError, setPaymentError] = useState(null);

  /**
   * Record a payment from the list.
   *
   * Same ordering as InvoiceDetail: the payment row is created FIRST and the
   * invoice is marked paid only once it exists. The reverse leaves an invoice
   * marked paid with nothing behind it if the second write fails, which is the
   * exact state this feature exists to abolish.
   */
  const handleRecordPayment = async (form) => {
    const invoice = paymentFor;
    if (!invoice) return;

    setRecordingPayment(true);
    setPaymentError(null);
    try {
      const existing = paymentsByInvoice.get(invoice.id) || [];
      const created = await sdk.entities.InvoicePayment.create(
        paymentRecord({ invoice, user: currentUser, ...form }),
      );
      const next = [...existing, created];

      const nextStatus = statusFromPayments(invoice, next);
      if (nextStatus) {
        await sdk.entities.Invoice.update(invoice.id, {
          status: nextStatus,
          paid_date: settledDate(invoice, next),
        });
        try {
          await sdk.entities.InvoiceEvent.create(
            statusChangeEvent({
              invoice,
              from: invoice.status,
              to: nextStatus,
              detail: "Settled in full",
              user: currentUser,
            }),
          );
        } catch (err) {
          // A history entry that failed must not fail the payment it describes.
          console.error("Could not record history entry (ignored):", err);
        }
      }

      setPaymentFor(null);
      await loadData(true);
    } catch (err) {
      console.error("Error recording payment:", err);
      setPaymentError(err?.message || "Could not record that payment.");
    }
    setRecordingPayment(false);
  };

  return {
    paymentFor,
    setPaymentFor,
    recordingPayment,
    paymentError,
    setPaymentError,
    handleRecordPayment,
  };
}
