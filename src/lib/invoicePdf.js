// Browser-side invoice PDF rendering.
//
// Replaces the generateInvoicePDF Supabase Edge Function for invoices. That
// function rendered with pdf-lib server-side; @react-pdf/renderer needs Node
// internals (fontkit, streams, zlib) that do not exist in Deno Deploy, and this
// app has no Node server -- vercel.json ships a static Vite build. So the render
// happens on the client instead.
//
// The output contract is deliberately unchanged: a
// `data:application/pdf;base64,...` URL, exactly what the old function returned.
// That keeps two existing consumers working untouched --
//   * Invoice.pdf_url, which Invoices.jsx links directly as an <a href>
//   * send-invoice-email, which splits the base64 off pdf_url and hands it to
//     Resend as an attachment (send-invoice-email/index.ts:43)

import { mapInvoiceToPdfData } from "@/lib/invoicePdfData";

// @react-pdf/renderer is ~440KB gzipped -- more than a third of the app's main
// chunk -- and only matters on the handful of screens that emit a PDF. Loading
// it dynamically keeps it out of the initial bundle, so every other page (and
// every first paint) stays as fast as it was before. The import is cached by
// the browser after the first PDF, so repeat renders pay nothing.
let rendererPromise = null;
function loadRenderer() {
  if (!rendererPromise) {
    rendererPromise = Promise.all([
      import("@react-pdf/renderer"),
      import("@/components/invoice/InvoiceDocument"),
    ]).then(([renderer, doc]) => ({
      pdf: renderer.pdf,
      InvoiceDocument: doc.InvoiceDocument,
    }));
  }
  return rendererPromise;
}

/**
 * Render an invoice to a Blob.
 *
 * @param {object} invoice   row from public."Invoice"
 * @param {object} settings  row from public."BusinessSettings"
 * @param {object} [options] passed through to mapInvoiceToPdfData ({ client, job, paymentDetails })
 * @returns {Promise<Blob>}
 */
export async function renderInvoicePdfBlob(invoice, settings, options = {}) {
  const { pdf, InvoiceDocument } = await loadRenderer();
  const data = mapInvoiceToPdfData(invoice, settings, options);
  return await pdf(InvoiceDocument(data)).toBlob();
}

/** Blob -> "data:application/pdf;base64,..." without blowing the stack on big files. */
function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error || new Error("Could not read PDF blob"));
    reader.readAsDataURL(blob);
  });
}

/**
 * Drop-in replacement for `sdk.functions.invoke("generateInvoicePDF", ...)`.
 * Returns the same `{ data: { pdf_url, success } }` envelope the callers expect,
 * so call sites only swap the function they call.
 *
 * @returns {Promise<{ data: { pdf_url: string, success: boolean } }>}
 */
export async function generateInvoicePDF({ invoice, settings, ...options }) {
  const blob = await renderInvoicePdfBlob(invoice, settings || {}, options);
  const pdf_url = await blobToDataUrl(blob);
  return { data: { pdf_url, success: true } };
}

/**
 * Render and save to the user's device. Uses a blob: URL rather than the base64
 * data: URL -- Chrome refuses to navigate to data: URLs over ~2MB, which a
 * multi-page invoice can reach.
 */
export async function downloadInvoicePdf(invoice, settings, options = {}) {
  const blob = await renderInvoicePdfBlob(invoice, settings, options);
  const url = URL.createObjectURL(blob);
  try {
    const a = document.createElement("a");
    a.href = url;
    a.download = `Invoice-${invoice?.invoice_number || "000"}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  } finally {
    // Give the click a tick to start before revoking.
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }
}

export default generateInvoicePDF;
