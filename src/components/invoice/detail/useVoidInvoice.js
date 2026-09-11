import { useState } from "react";
import { Invoice } from "@/entities/Invoice";
import { voidEligibility, voidPatch } from "@/lib/invoiceVoid";

/** The void dialog's state, and the write behind it. */
export default function useVoidInvoice({ invoice, setInvoice, user }) {
  const [voidDialog, setVoidDialog] = useState(false);
  const [voidReason, setVoidReason] = useState("");
  const [voiding, setVoiding] = useState(false);
  const [voidError, setVoidError] = useState(null);

  /**
   * Void this invoice.
   *
   * The whole patch comes from voidPatch() rather than being assembled here,
   * so there is exactly one shape of a voided invoice and no way for this
   * screen to produce a partial one -- a void with a status but no timestamp
   * would be worse than no void at all.
   *
   * The invoice in state is replaced with the server's answer rather than
   * merged optimistically. If the write only half landed, the screen shows
   * what actually happened.
   */
  const handleVoid = async () => {
    const allowed = voidEligibility(invoice);
    if (!allowed.ok) {
      setVoidError(allowed.reason);
      return;
    }

    setVoiding(true);
    setVoidError(null);
    try {
      await Invoice.update(invoice.id, voidPatch(invoice, { reason: voidReason, user }));
      const rows = await Invoice.filter({ id: invoice.id });
      const saved = rows?.[0] || null;
      if (saved) setInvoice(saved);
      setVoidDialog(false);
      setVoidReason("");
    } catch (error) {
      console.error("Error voiding invoice:", error);
      setVoidError(
        error?.message || "Could not void this invoice. Nothing has been changed.",
      );
    }
    setVoiding(false);
  };

  return {
    voidDialog, setVoidDialog, voidReason, setVoidReason, voiding, voidError, setVoidError,
    handleVoid,
  };
}
