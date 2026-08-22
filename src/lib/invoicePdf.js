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

import {
  mapInvoiceToPdfData,
  mapInvoiceToComplexPdfData,
} from "@/lib/invoicePdfData";

// Which layout each BusinessSettings.invoice_template value renders.
//
// That column predates any of these templates and offered four choices --
// professional / compact / simple / custom -- while only one layout existed, so
// picking any of them changed nothing. Three are now real. The two ids without
// a layout of their own are aliased rather than dropped, so existing rows keep
// rendering instead of falling back and silently changing a business's invoice.
const TEMPLATE_ALIASES = {
  compact: "simple",
  custom: "professional",
};

const TEMPLATE_LOADERS = {
  professional: () => import("@/components/invoice/InvoiceDocument"),
  simple: () => import("@/components/invoice/InvoiceDocumentSimple"),
  detailed: () => import("@/components/invoice/InvoiceDocumentComplex"),
};

const DEFAULT_TEMPLATE = "professional";

/** Resolve a settings value to a key of TEMPLATE_LOADERS. */
export function resolveTemplateId(settings) {
  const raw = String(settings?.invoice_template || "").trim().toLowerCase();
  const id = TEMPLATE_ALIASES[raw] ?? raw;
  return TEMPLATE_LOADERS[id] ? id : DEFAULT_TEMPLATE;
}

// @react-pdf/renderer is ~440KB gzipped -- more than a third of the app's main
// chunk -- and only matters on the handful of screens that emit a PDF. Loading
// it dynamically keeps it out of the initial bundle, so every other page (and
// every first paint) stays as fast as it was before. The import is cached by
// the browser after the first PDF, so repeat renders pay nothing.
const rendererPromises = new Map();
function loadRenderer(templateId) {
  if (!rendererPromises.has(templateId)) {
    rendererPromises.set(
      templateId,
      Promise.all([import("@react-pdf/renderer"), TEMPLATE_LOADERS[templateId]()]).then(
        ([renderer, mod]) => ({ pdf: renderer.pdf, Template: mod.default }),
      ),
    );
  }
  return rendererPromises.get(templateId);
}

/**
 * Render an invoice to a Blob.
 *
 * @param {object} invoice   row from public."Invoice"
 * @param {object} settings  row from public."BusinessSettings"
 * @param {object} [options] passed through to the mapper ({ client, job, paymentDetails });
 *                           `templateId` overrides the business's saved choice
 * @returns {Promise<Blob>}
 */
export async function renderInvoicePdfBlob(invoice, settings, options = {}) {
  const templateId = options.templateId || resolveTemplateId(settings);
  const { pdf, Template } = await loadRenderer(templateId);

  // The detailed layout takes a different shape -- grouped sections and an array
  // of tax lines -- so it needs its own mapper, not the flat one.
  const data =
    templateId === "detailed"
      ? mapInvoiceToComplexPdfData(invoice, settings, options)
      : mapInvoiceToPdfData(invoice, settings, options);

  return await pdf(Template(data)).toBlob();
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
