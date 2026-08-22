// Matches the src/functions/* wrapper convention (cf. generateQuotePDF.js),
// but resolves locally instead of calling a Supabase Edge Function: invoice
// PDFs now render in the browser with @react-pdf/renderer.
//
// Same call signature and same { data: { pdf_url } } result as the old
// sdk.functions.invoke("generateInvoicePDF", ...), so callers are unchanged
// apart from the import.
//
// Quotes still go through the pdf-lib edge function -- see generateQuotePDF.js.

export {
  generateInvoicePDF,
  renderInvoicePdfBlob,
  downloadInvoicePdf,
} from "@/lib/invoicePdf";
