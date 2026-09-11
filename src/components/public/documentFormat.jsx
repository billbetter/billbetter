import React from "react";
import { format } from "date-fns";

/*
 * Shared by the two pages a contractor's client opens from a link --
 * PublicInvoice and PublicQuote -- which render outside Layout and so cannot
 * lean on anything the signed-in app provides.
 */

/** An amount in the document's own currency, in the reader's locale. */
export function formatCurrency(amount, currency) {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currency || "CAD",
    }).format(Number(amount) || 0);
  } catch {
    // An unknown currency code from settings must not blank the total.
    return `${(Number(amount) || 0).toFixed(2)} ${currency || ""}`.trim();
  }
}

/** `format()` that returns null instead of throwing on a missing or bad date. */
export function safeDate(value, pattern) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : format(parsed, pattern);
}

/** Full-page message, used for every state that is not a rendered document. */
export function Notice({ icon: Icon, tone, title, children }) {
  return (
    <div className="min-h-screen bg-surface-sunken flex items-center justify-center p-4">
      <div className="text-center max-w-md">
        <Icon className={`w-16 h-16 mx-auto mb-4 ${tone}`} />
        <h1 className="text-2xl font-black text-ink-800">{title}</h1>
        <p className="text-content-body mt-2">{children}</p>
      </div>
    </div>
  );
}
