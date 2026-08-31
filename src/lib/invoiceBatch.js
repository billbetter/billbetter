/**
 * Sending many invoices in one go.
 *
 * -- What this is NOT ------------------------------------------------------
 *
 * It is not the same operation as InvoiceDetail's "resend notifications", and
 * the difference is deliberate rather than drift, so it is written down here.
 *
 *   InvoiceDetail  refuses outright unless invoice.pdf_url exists, generates a
 *                  Stripe payment link first if one is missing, and attaches
 *                  the PDF to the email.
 *   This module    sends the invoice's own public link and nothing else.
 *
 * The reason is cost, not laziness. Those two extra steps are a PDF render and
 * a Stripe API call PER INVOICE, so a batch of thirty is sixty round trips
 * before a single email leaves. And they are not needed: send-invoice-email
 * resolves `${APP_URL}/i/<public_token>` server-side and puts it in the mail,
 * so the client still gets a page they can view and pay on. The PDF is an
 * attachment, not the delivery mechanism.
 *
 * The UI must say this plainly rather than implying the batch is identical to
 * pressing send on each invoice one at a time.
 *
 * -- Why the sending is sequential ----------------------------------------
 *
 * One at a time, on purpose. Firing thirty concurrent invokes at Resend and
 * Infobip is how an account trips a rate limit, and a rate-limited send fails
 * in a way that looks exactly like a bad address. Sequential is slower and
 * legible: each invoice has one outcome, and a failure stops nothing else.
 */

/** Statuses that may never be batch-sent, whatever the caller asks. */
const NEVER_SEND = new Set(["paid", "cancelled", "canceled"]);

/** Statuses that have already been delivered once, so sending again is a reminder. */
const RESEND_STATUSES = new Set(["sent", "overdue"]);

/**
 * Whether an invoice can be included in a batch, and what sending it means.
 *
 * @returns {{ ok: boolean, kind?: 'send'|'resend', reason?: string }}
 *   `kind` matters to the UI: a first send and a second copy of the same
 *   invoice are different things to do to a client, and the count of re-sends
 *   is shown before the batch runs so nobody mails a duplicate by accident.
 */
export function batchSendEligibility(invoice, client = null) {
  const status = String(invoice?.status || "").toLowerCase();

  // Drafts ARE eligible -- a batch is how you send them for the first time.
  // Only money already settled is off limits: re-mailing a paid invoice reads
  // to the client as a second demand for money they have handed over.
  if (NEVER_SEND.has(status)) {
    return { ok: false, reason: `Already ${status}` };
  }

  // A contact is the hard requirement -- without one there is nowhere to send.
  // Checked against the invoice first, because that is what the send functions
  // are given, and only then against the client row.
  const email = invoice?.client_email || client?.email;
  const phone = invoice?.client_phone || client?.phone;
  if (!email && !phone) {
    return { ok: false, reason: "No email or phone on file" };
  }

  return { ok: true, kind: RESEND_STATUSES.has(status) ? "resend" : "send" };
}

/**
 * Send one invoice by every channel its client has.
 *
 * Both channels are attempted when both a phone and an email exist, matching
 * what the single-invoice path does. A failure on one does not stop the other:
 * a client whose email bounces may still get the text.
 *
 * `invoke` is injected rather than imported so this can be tested without a
 * browser, a network or a key.
 *
 * @returns {{ id, invoice_number, emailed: boolean, texted: boolean,
 *             errors: string[], attempted: boolean }}
 */
export async function sendOneInvoice({ invoice, client = null }, invoke) {
  const email = invoice?.client_email || client?.email || null;
  const phone = invoice?.client_phone || client?.phone || null;
  const name = invoice?.client_name || client?.name || "";

  const result = {
    id: invoice?.id,
    invoice_number: invoice?.invoice_number || "",
    emailed: false,
    texted: false,
    errors: [],
    attempted: Boolean(email || phone),
  };

  if (email) {
    try {
      const res = await invoke("sendInvoiceEmail", {
        invoice_id: invoice.id,
        client_email: email,
        client_name: name,
        invoice_number: invoice.invoice_number,
        total: invoice.total,
      });
      // These invokes resolve rather than throw on failure -- the sdk turns a
      // non-2xx into { success: false, error }. Checking only for a thrown
      // error would report every failed send as a success.
      if (res?.data?.success) result.emailed = true;
      else result.errors.push(res?.data?.error || "Email failed");
    } catch (err) {
      result.errors.push(err?.message || "Email failed");
    }
  }

  if (phone) {
    try {
      const res = await invoke("sendInvoiceSMS", {
        invoice_id: invoice.id,
        client_phone: phone,
        client_name: name,
        invoice_number: invoice.invoice_number,
        total: invoice.total,
      });
      if (res?.data?.success) result.texted = true;
      else result.errors.push(res?.data?.error || "SMS failed");
    } catch (err) {
      result.errors.push(err?.message || "SMS failed");
    }
  }

  return result;
}

/**
 * Send a list of invoices, one at a time, reporting as it goes.
 *
 * Never throws. A batch that dies half way through and reports nothing is
 * worse than one that finishes and tells you which three failed -- the
 * contractor has to know exactly who was mailed before they can retry safely.
 *
 * @param {Array} rows           [{ invoice, client }]
 * @param {Function} invoke      sdk.functions.invoke
 * @param {Function} [onProgress] called after each with (doneCount, result)
 */
export async function sendInvoiceBatch(rows, invoke, onProgress) {
  const results = [];
  for (const row of rows) {
    let result;
    try {
      result = await sendOneInvoice(row, invoke);
    } catch (err) {
      result = {
        id: row?.invoice?.id,
        invoice_number: row?.invoice?.invoice_number || "",
        emailed: false,
        texted: false,
        errors: [err?.message || "Unexpected failure"],
        attempted: true,
      };
    }
    results.push(result);
    if (onProgress) onProgress(results.length, result);
  }

  const delivered = results.filter((r) => r.emailed || r.texted);
  return {
    results,
    sent: delivered.length,
    failed: results.length - delivered.length,
    total: results.length,
  };
}

/**
 * Which invoices actually changed hands, so the caller can flip them to 'sent'.
 *
 * Only invoices that were still drafts are returned. A re-sent invoice is
 * already 'sent' or 'overdue', and rewriting an overdue invoice back to 'sent'
 * would erase the fact that it is late -- which is the one thing its status is
 * for.
 */
export function draftsNowSent(rows, results) {
  const byId = new Map(rows.map((r) => [r.invoice?.id, r.invoice]));
  return results
    .filter((r) => (r.emailed || r.texted) && String(byId.get(r.id)?.status || "").toLowerCase() === "draft")
    .map((r) => r.id);
}
