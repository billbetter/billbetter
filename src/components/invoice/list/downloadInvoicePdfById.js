import { sdk } from "@/api/sdk";
import { deliverPdf } from "@/lib/pdfDelivery";

/**
 * Fetch one invoice's PDF and hand it to the browser.
 *
 * List queries deliberately no longer select pdf_url: that column stores the
 * whole PDF inline as a base64 data: URL, so `select("*")` on the list meant
 * downloading every invoice's PDF on every visit to this page. Fetching by id
 * keeps every column, so the document is complete here.
 */
export async function downloadInvoicePdfById(invoiceId, settings) {
  try {
    const inv = await sdk.entities.Invoice.get(invoiceId);
    let pdf = inv?.pdf_url || "";

    // -- Render it now if there isn't one ------------------------------
    //
    // This used to give up with "No PDF is available for this invoice yet",
    // which was a dead end on a button labelled Download. An invoice only
    // HAS a stored PDF if it was created through a path that generated one:
    // save a draft, or have generation fail once, and the row keeps a null
    // pdf_url forever with no way back. Since the renderer moved into the
    // browser (src/lib/invoicePdf.js) there is no reason to refuse -- we can
    // just make it, from the same invoice and the same settings the create
    // screen would have used.
    //
    // Stored on the way out so the next download, and any email that
    // attaches it, is instant rather than a re-render.
    if (!pdf.startsWith("data:application/pdf")) {
      const { generateInvoicePDF } = await import("@/lib/invoicePdf");
      const res = await generateInvoicePDF({ invoice: inv, settings });
      pdf = res?.data?.pdf_url || "";
      if (!pdf) throw new Error("Could not render this invoice.");
      // Best effort: a failed save must not cost the user the download they
      // are already holding.
      try {
        await sdk.entities.Invoice.update(invoiceId, {
          pdf_url: pdf,
          pdf_generated_at: new Date().toISOString(),
        });
      } catch (saveErr) {
        console.warn("PDF rendered but could not be saved:", saveErr);
      }
    }

    await deliverPdf(pdf, {
      filename: `Invoice-${inv.invoice_number || invoiceId}.pdf`,
    });
  } catch (err) {
    console.error("PDF download failed:", err);
    alert("Could not download the PDF. Please try again.");
  }
}
