// Live preview of a themed invoice PDF for the branding settings.
//
// Renders the REAL template through @react-pdf/renderer rather than an HTML
// mock. A mock would be a second layout to keep in sync with three templates
// that are still changing, and it would not show what the contrast fallbacks
// actually do -- which is the whole point of previewing a colour.
//
// The renderer is ~440KB gzipped, so it is imported dynamically here exactly as
// src/lib/invoicePdf.js does. The import is cached, so opening the branding
// panel is the only time it is fetched.

import React, { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";

// Enough rows to show a section subtotal and a wrapped description, few enough
// to stay legible in a small preview pane.
const SAMPLE_INVOICE = {
  invoice_number: "INV-1042",
  created_at: "2026-08-22",
  due_date: "2026-09-21",
  client_name: "Northside Property Group",
  client_address: "812 Kingsway, Vancouver, BC",
  client_email: "accounts@northside.example",
  payment_terms: "Net 30",
  notes: "Access arranged through the building manager.",
  tax_rate: 12,
  items: [
    { description: "Service panel upgrade — 200A", quantity: 1, rate: 1850 },
    { description: "Licensed electrician labour", quantity: 6, rate: 95 },
    { description: "Permit and inspection", quantity: 1, rate: 210 },
  ],
};

/**
 * @param {object}   props
 * @param {object}   props.settings   BusinessSettings-shaped values, including
 *                                    the in-progress colours from the form
 * @param {string}   [props.templateId] overrides the saved invoice_template
 * @param {number}   [props.debounceMs]
 */
export default function InvoiceThemePreview({ settings, templateId, debounceMs = 300 }) {
  const [url, setUrl] = useState(null);
  const [error, setError] = useState(null);
  const [pending, setPending] = useState(true);

  // Colour inputs fire continuously while a swatch is dragged. Each render is a
  // full PDF build, so they are debounced, and every render is stamped with a
  // sequence number -- an earlier build that finishes late must not overwrite a
  // newer one.
  const seqRef = useRef(0);
  const urlRef = useRef(null);

  // Depend on the resolved colour values rather than the settings object, which
  // is a fresh literal on every keystroke anywhere in the settings form.
  const key = [
    templateId || settings?.invoice_template || "",
    settings?.pdf_color_scheme || "",
    settings?.pdf_background_color || "",
    settings?.pdf_text_color || "",
    settings?.pdf_muted_text_color || "",
    settings?.business_name || "",
  ].join("|");

  useEffect(() => {
    let cancelled = false;
    const seq = ++seqRef.current;
    setPending(true);

    const timer = setTimeout(async () => {
      try {
        const { renderInvoicePdfBlob } = await import("@/lib/invoicePdf");
        const blob = await renderInvoicePdfBlob(SAMPLE_INVOICE, settings || {}, {
          templateId,
          paymentDetails: "E-transfer to pay@example.com",
        });
        if (cancelled || seq !== seqRef.current) return;

        const next = URL.createObjectURL(blob);
        // Revoke only after the new URL is in state, so the iframe never points
        // at a revoked blob mid-swap.
        const previous = urlRef.current;
        urlRef.current = next;
        setUrl(next);
        setError(null);
        if (previous) setTimeout(() => URL.revokeObjectURL(previous), 1000);
      } catch (err) {
        if (!cancelled && seq === seqRef.current) {
          setError(err?.message || "Could not render the preview");
        }
      } finally {
        if (!cancelled && seq === seqRef.current) setPending(false);
      }
    }, debounceMs);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, debounceMs]);

  // Release the last blob when the panel closes.
  useEffect(
    () => () => {
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    },
    [],
  );

  return (
    <div className="relative rounded-lg border border-line dark:border-ink-700 bg-surface-sunken dark:bg-ink-900 overflow-hidden">
      {url ? (
        <iframe
          src={`${url}#toolbar=0&navpanes=0`}
          title="Invoice PDF preview"
          className="w-full h-[520px] border-0 bg-white"
        />
      ) : (
        <div className="h-[520px] flex items-center justify-center text-sm text-content-muted">
          {error ? error : "Building preview…"}
        </div>
      )}

      {pending && url ? (
        <div className="absolute top-3 right-3 flex items-center gap-2 rounded-full bg-surface/90 dark:bg-ink-800/90 px-3 py-1 text-xs text-content-muted shadow-sm">
          <Loader2 className="w-3 h-3 animate-spin" /> Updating
        </div>
      ) : null}

      {error && url ? (
        <div className="absolute bottom-3 left-3 right-3 rounded-md bg-danger-50 dark:bg-danger-900/40 px-3 py-2 text-xs text-danger-700 dark:text-danger-300">
          {error}
        </div>
      ) : null}
    </div>
  );
}
