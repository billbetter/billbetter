// Matches the src/functions/* wrapper convention (cf. generateInvoicePDF.js),
// and, like that one, now resolves locally instead of calling a Supabase Edge
// Function: quote PDFs render in the browser with @react-pdf/renderer, through
// the same three templates and the same branding as invoices.
//
// Same call signature and same { data: { pdf_url } } result as the old
// sdk.functions.invoke("generateQuotePDF", ...), so callers are unchanged apart
// from where the function comes from. send-quote-email still receives a
// data:application/pdf;base64 URL and still attaches it.
//
// The generate-quote-pdf Edge Function is left deployed but is no longer
// called. Deleting it is a separate decision: it is the only thing that can
// still produce a quote PDF without a browser, and nothing needs that today.

export {
  generateQuotePDF,
  renderQuotePdfBlob,
} from "@/lib/invoicePdf";
