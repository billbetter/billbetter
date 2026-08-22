// Maps real Supabase rows onto the InvoiceData shape InvoiceDocument.jsx expects.
//
// Source tables (see supabase/schema.sql -- note the quoted PascalCase names):
//
//   "Invoice"          items jsonb, subtotal, tax_rate, tax_amount, total,
//                      client_name/email/phone/address (denormalised onto the
//                      row), client_id -> "Client", payment_terms, notes,
//                      due_date, created_at
//   "BusinessSettings" business_name, email, phone, address, website,
//                      tax_rate, payment_terms
//   "Client"           name, email, phone, address  (optional fallback only --
//                      the Invoice row normally carries its own copy, which is
//                      the one that was true when the invoice was issued)
//
// There is no separate line-items table: line items are the `items` jsonb array
// on the invoice, shaped { description, quantity, rate, total }.

import { format, isValid, parseISO } from "date-fns";

/**
 * Format a timestamptz / ISO string the way the template wants it: "Aug 20, 2026".
 *
 * Due dates are entered as a plain "yyyy-MM-dd" (CreateInvoice.jsx:426) and land
 * in a timestamptz column, so they come back as midnight UTC. Formatting that in
 * local time west of Greenwich -- i.e. everywhere in Canada -- renders the day
 * before, so an invoice due Sep 19 prints "Sep 18". Anything sitting exactly on
 * midnight UTC is therefore treated as a calendar date and read off its UTC
 * parts; real timestamps (created_at) still format in local time.
 */
function formatDate(value) {
  if (!value) return "—";

  if (typeof value === "string") {
    const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
    if (dateOnly) {
      const [, y, m, day] = dateOnly;
      return format(new Date(Number(y), Number(m) - 1, Number(day)), "MMM d, yyyy");
    }
  }

  const d = typeof value === "string" ? parseISO(value) : new Date(value);
  if (!isValid(d)) return "—";

  const isCalendarDate =
    d.getUTCHours() === 0 &&
    d.getUTCMinutes() === 0 &&
    d.getUTCSeconds() === 0 &&
    d.getUTCMilliseconds() === 0;

  if (isCalendarDate) {
    return format(
      new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
      "MMM d, yyyy",
    );
  }

  return format(d, "MMM d, yyyy");
}

/** Join the non-empty parts of a contact line with a bullet separator. */
function contactLine(parts) {
  return parts.filter((p) => p && String(p).trim()).join(" • ");
}

/**
 * The DB stores tax_rate as a PERCENT (13 means 13% HST); the PDF template
 * wants a FRACTION (0.13). Getting this wrong renders 1300%.
 *
 * Uses ?? rather than || throughout so a deliberate 0 -- a tax-exempt or
 * out-of-province client -- survives instead of falling through to the
 * business default. taxRate 0 makes the template omit the tax row entirely.
 */
export function resolveTaxRate(invoice = {}, settings = {}) {
  const percent = invoice.tax_rate ?? settings.tax_rate ?? 0;
  const n = Number(percent);
  return Number.isFinite(n) ? n / 100 : 0;
}

/**
 * @param {object}  invoice    a row from public."Invoice"
 * @param {object}  settings   a row from public."BusinessSettings"
 * @param {object} [options]
 * @param {object} [options.client]  a row from public."Client", used only to
 *                                   fill gaps the invoice row does not carry
 * @param {object} [options.job]     a row from public."Job", for jobLocation
 * @param {string} [options.paymentDetails]  e.g. an e-transfer address or the
 *                                   Stripe payment link, if you want it printed
 * @returns {import("@/components/invoice/InvoiceDocument").InvoiceData}
 */
export function mapInvoiceToPdfData(invoice = {}, settings = {}, options = {}) {
  const { client = null, job = null, paymentDetails } = options;

  // `items` is jsonb; PostgREST hands it back parsed, but seeded/local rows have
  // been seen as a JSON string, so tolerate both.
  let rawItems = invoice.items ?? [];
  if (typeof rawItems === "string") {
    try {
      rawItems = JSON.parse(rawItems || "[]");
    } catch {
      rawItems = [];
    }
  }
  if (!Array.isArray(rawItems)) rawItems = [];

  const lineItems = rawItems.map((item) => ({
    description: String(item?.description ?? ""),
    // The DB calls it `quantity`; the template calls it `qty`.
    qty: Number(item?.quantity ?? item?.qty ?? 0),
    rate: Number(item?.rate ?? 0),
  }));

  return {
    businessName: settings.business_name || "Invoicium",
    businessAddress: settings.address || "",
    businessContact: contactLine([
      settings.phone,
      settings.email,
      settings.website,
    ]),

    invoiceNumber: String(invoice.invoice_number ?? ""),
    invoiceDate: formatDate(invoice.created_at),
    dueDate: formatDate(invoice.due_date),

    clientName: invoice.client_name || client?.name || "Client",
    // "Client" has no company column; left undefined unless a caller adds one.
    clientCompany: undefined,
    clientAddress: invoice.client_address || client?.address || undefined,
    clientContact:
      contactLine([
        invoice.client_phone || client?.phone,
        invoice.client_email || client?.email,
      ]) || undefined,

    jobLocation: job?.location || undefined,
    terms:
      invoice.payment_terms || settings.payment_terms || "Due on receipt",

    lineItems,
    taxRate: resolveTaxRate(invoice, settings),

    paymentDetails: paymentDetails || undefined,
    notes: invoice.notes || undefined,
  };
}

export default mapInvoiceToPdfData;
