/**
 * Handing a generated PDF to the browser.
 *
 * -- The bug this exists to kill -------------------------------------------
 *
 * Every PDF in this app is a `data:application/pdf;base64,...` URL (that is
 * the contract src/lib/invoicePdf.js deliberately kept when rendering moved to
 * the client). Four separate places then did:
 *
 *     window.open(pdf_url, "_blank");
 *
 * **Chrome has blocked top-level navigation to `data:` URLs since Chrome 60.**
 * It does not throw, it does not warn the user, and `window.open` still
 * returns. The tab simply never appears. So the invoice was created, the PDF
 * was rendered and stored correctly, the code took the success branch, and the
 * user was told "Invoice created and downloaded!" while absolutely nothing
 * happened. From the outside that is indistinguishable from "PDF generation is
 * broken".
 *
 * Invoices.jsx already knew: its list download converts to a blob first and
 * says why in a comment. That knowledge just never reached the other four
 * call sites, which is exactly the kind of thing a shared helper prevents.
 *
 * `blob:` URLs are not subject to the same block, so the fix everywhere is to
 * turn the data URL into a blob first.
 *
 * -- Why "download" is the safer default -----------------------------------
 *
 * An `<a download>` click is not a popup and cannot be popup-blocked. Opening
 * a tab can be, because by the time a PDF has rendered we are several awaits
 * past the click that started it and the browser no longer credits us with a
 * user gesture. So `open` degrades to a download rather than failing, which is
 * the outcome the user wanted anyway.
 */

/** Turn a data: URL into a blob: URL. Pass through anything already a URL. */
async function toBlobUrl(pdfUrl) {
  if (typeof pdfUrl !== "string" || !pdfUrl) return null;
  if (!pdfUrl.startsWith("data:")) return pdfUrl;
  // fetch() parses data: URLs and gives back a real Blob, base64 decoding
  // included -- shorter and less error-prone than doing atob by hand.
  const blob = await (await fetch(pdfUrl)).blob();
  return URL.createObjectURL(blob);
}

function clickDownload(url, filename) {
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/**
 * Put a PDF in front of the user.
 *
 * @param {string} pdfUrl   a data: or blob: or https: URL
 * @param {object} [opts]
 * @param {string} [opts.filename] used when it saves rather than opens
 * @param {"open"|"download"} [opts.mode] "open" tries a tab first
 * @returns {Promise<boolean>} false when there was nothing to deliver
 */
export async function deliverPdf(pdfUrl, opts = {}) {
  const filename = opts.filename || "document.pdf";
  const mode = opts.mode === "open" ? "open" : "download";

  const url = await toBlobUrl(pdfUrl);
  if (!url) return false;

  const isObjectUrl = url.startsWith("blob:");

  try {
    if (mode === "open") {
      const win = window.open(url, "_blank", "noopener");
      // Popup blocked, or opened into nothing. Saving it is strictly better
      // than the silent no-op this helper was written to remove.
      if (!win || win.closed) clickDownload(url, filename);
    } else {
      clickDownload(url, filename);
    }
  } finally {
    // The tab or the download needs the URL to still resolve when it starts,
    // so revoking immediately would race it. Ten seconds is far longer than
    // either needs and still bounds the leak.
    if (isObjectUrl) setTimeout(() => URL.revokeObjectURL(url), 10000);
  }
  return true;
}

export default deliverPdf;
