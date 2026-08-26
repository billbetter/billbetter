/**
 * Every response schema the app asks the LLM for, in one place.
 *
 * These used to be declared inline at six call sites. That is six places to
 * drift, which is the same disease as the four plan tables that ended up
 * charging live accounts double the advertised fee.
 *
 * -- Are they really separate shapes? -------------------------------------
 *
 * Checked, and no. Six call sites, four schemas:
 *
 *   CreateInvoice + QuickBillFlow  IDENTICAL. QuickBillFlow added an optional
 *                                  `notes` string and nothing else, so they are
 *                                  now one schema (LINE_ITEMS) and `notes` is
 *                                  optional for both.
 *
 *   JobExpensesTab + CameraAnalyzer  THE SAME SHAPE UNDER DIFFERENT NAMES.
 *                                  Both are "a list of priced lines":
 *                                    receipt:  description / quantity / unit_cost   / amount
 *                                    photo:    name        / quantity / price_per_unit / total_cost
 *                                  Rather than force one vocabulary on both --
 *                                  which would mean rewriting how both
 *                                  components read the result -- the shape is
 *                                  declared once in pricedLine() and each
 *                                  schema names its own fields. One definition,
 *                                  two vocabularies, no drift.
 *
 *   GlobalVoiceAssistant           Genuinely different: an intent classifier.
 *
 * -- Why `required` matters here ------------------------------------------
 *
 * The inline versions declared `properties` and no `required`, so a response of
 * `{}` validated. That is precisely the "plausible but wrong-shaped" case the
 * validator exists to catch, so every field the consuming code actually reads
 * is listed as required.
 */

/**
 * One line of something with a price, named however the caller names it.
 *
 * @param {object} names
 * @param {string} names.label     what the thing is called ("description", "name")
 * @param {string} names.unitPrice per-unit price field ("rate", "unit_cost")
 * @param {string} [names.total]   optional line total field
 * @param {string[]} [names.extra] additional optional string fields
 */
function pricedLine({ label, unitPrice, total, extra = [] }) {
  const properties = {
    [label]: { type: "string" },
    quantity: { type: "number" },
    [unitPrice]: { type: "number" },
  };
  if (total) properties[total] = { type: "number" };
  for (const key of extra) properties[key] = { type: "string" };
  return {
    type: "object",
    properties,
    // The total is derived and the model gets it wrong often enough that
    // requiring it would fail otherwise-good responses. The consuming code
    // recomputes quantity x unitPrice anyway.
    required: [label, "quantity", unitPrice],
  };
}

/**
 * Invoice / quick-bill line items.
 *
 * `rate` is the PER-UNIT price, not the line total. Getting that wrong is the
 * single most common failure -- "10 hours @ $75" coming back as rate 750 -- so
 * the prompt says it too, and the consumer multiplies rather than trusting any
 * total the model volunteers.
 */
export const LINE_ITEMS = {
  type: "object",
  properties: {
    items: {
      type: "array",
      items: pricedLine({ label: "description", unitPrice: "rate" }),
    },
    notes: { type: "string" },
  },
  required: ["items"],
};

/** A scanned receipt. */
export const RECEIPT_SCAN = {
  type: "object",
  properties: {
    vendor_name: { type: "string" },
    receipt_date: { type: "string" },
    total: { type: "number" },
    items: {
      type: "array",
      items: pricedLine({
        label: "description",
        unitPrice: "unit_cost",
        total: "amount",
        extra: ["category"],
      }),
    },
  },
  required: ["items"],
};

/** A photo of a job, estimated. */
export const PHOTO_ESTIMATE = {
  type: "object",
  properties: {
    materials: {
      type: "array",
      items: pricedLine({
        label: "name",
        unitPrice: "price_per_unit",
        total: "total_cost",
        extra: ["unit"],
      }),
    },
    labor_hours: { type: "number" },
    labor_rate: { type: "number" },
    labor_total: { type: "number" },
    materials_subtotal: { type: "number" },
    estimated_total: { type: "number" },
    notes: { type: "string" },
  },
  required: ["materials"],
};

/** A spoken command, classified. */
export const VOICE_COMMAND = {
  type: "object",
  properties: {
    intent: {
      type: "string",
      // enum rather than a free string: the consumer switches on this value,
      // and an unrecognised intent silently does nothing.
      enum: [
        "create_invoice",
        "upload_receipt",
        "view_dashboard",
        "view_analytics",
        "view_clients",
        "view_invoices",
        "view_pricing",
        "help",
        "unknown",
      ],
    },
    confirmation: { type: "string" },
    action: { type: "string" },
    data: { type: "object" },
  },
  required: ["intent", "confirmation"],
};
