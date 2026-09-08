/**
 * Turning a sealed record into a document somebody else will read.
 *
 * Same shape as src/lib/invoicePdf.js -- @react-pdf/renderer behind a dynamic
 * import, because the library is ~440KB gzipped and no page that is not
 * producing a PDF should pay for it.
 *
 * -- Why this returns a blob: URL and not a data: URL ----------------------
 *
 * invoicePdf.js returns `data:application/pdf;base64,...` because its output is
 * STORED, in Invoice.pdf_url, and read back by send-invoice-email. Nothing
 * stores this one; it is built on demand and handed straight to the browser. So
 * it skips the base64 round-trip entirely and hands back a blob: URL, which is
 * also the only form Chrome will actually open -- see src/lib/pdfDelivery.js
 * for the bug that taught us that.
 *
 * -- All the formatting happens here ---------------------------------------
 *
 * react-pdf has no layout escape hatch for "format this date", and putting
 * toLocaleString calls inside the template would scatter the timezone decision
 * across a dozen call sites. Every string the document renders is composed
 * here, once, against one timezone that the document then names.
 */

import { format } from "date-fns";

const rendererPromise = { current: null };

function loadRenderer() {
  if (!rendererPromise.current) {
    rendererPromise.current = Promise.all([
      import("@react-pdf/renderer"),
      import("@/components/invoice/PaperTrailDocument"),
    ]).then(([renderer, mod]) => ({ pdf: renderer.pdf, Template: mod.default }));
  }
  return rendererPromise.current;
}

/**
 * The viewer's timezone, named in the document.
 *
 * A record of when things happened that does not say which clock it is quoting
 * invites the obvious objection, and "the reader's own browser" is the answer
 * least likely to surprise whoever is looking at it -- but it has to be stated
 * rather than assumed.
 */
function resolveTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "your local time";
  } catch {
    return "your local time";
  }
}

const stamp = (d) => (d ? format(d, "d MMM yyyy, HH:mm") : "--");

/** How the document credits each entry. Matches the key printed at the foot. */
function attestationFor(entry) {
  if (entry.source === "system") return "Invoicium (observed)";
  if (entry.source === "imported") return "Reconstructed";
  return "Account holder";
}

/**
 * Render the record.
 *
 * @param {object} p
 * @param {object} p.document  a row from paper_trail_summary()
 * @param {Array}  p.entries   entryView() results, oldest first
 * @param {object} [p.settings] BusinessSettings, for the issuing business name
 * @param {object} [p.chain]    verifyChain() result
 * @returns {Promise<string>} a blob: URL
 */
export async function renderPaperTrailPdf({ document, entries = [], settings, chain }) {
  const { pdf, Template } = await loadRenderer();

  const views = entries.filter((e) => e.kind === "viewed");
  const sent = entries.find((e) => e.kind === "sent");
  const witnessed = entries.filter((e) => e.source === "system").length;

  const headline = views.length
    ? views.length > 1
      ? `The client opened this ${views.length} times, first on ${stamp(views[0].occurred)}.`
      : `The client opened this on ${stamp(views[0].occurred)}.`
    : sent
      ? "This was sent, and has never been opened from the link."
      : "This has not been recorded as sent.";

  const rows = entries.map((e) => ({
    id: e.id,
    label: e.label,
    detail: e.detail,
    backdated: e.backdated,
    occurredText: stamp(e.occurred),
    recordedText: stamp(e.recorded),
    attestation: attestationFor(e),
  }));

  const summary = {
    headline,
    witnessed,
    sentAtText: sent ? stamp(sent.occurred) : "",
    firstOpenedText: views.length ? stamp(views[0].occurred) : "",
  };

  const blob = await pdf(
    Template({
      doc: document,
      rows,
      businessName: settings?.business_name || "",
      summary,
      reference: entries[entries.length - 1]?.hash?.slice(0, 12).toUpperCase() || "",
      chain,
      timeZone: resolveTimeZone(),
      generatedAt: stamp(new Date()),
    }),
  ).toBlob();

  return URL.createObjectURL(blob);
}

export default renderPaperTrailPdf;
