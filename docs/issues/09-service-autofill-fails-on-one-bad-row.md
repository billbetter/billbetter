# Line-item autofill shows nothing if any service preset lacks a name or description

**Where:** `src/components/invoice/ServiceAutofill.jsx`, the `fetchSuggestions` effect (lines 45–100).

**What happens:** typing two or more characters into a line item's description loads every system `ServicePreset` and every `CustomServiceTemplate`, then filters them with `preset.name.toLowerCase()` and `preset.description.toLowerCase()`. Neither field is null-checked. One row with a missing `name` or `description` throws, and the `catch` only logs `Error fetching suggestions: TypeError: Cannot read properties of undefined (reading 'toLowerCase')`. The dropdown then never appears, for any search, on every line item.

This is happening against the live data right now. Opening an existing invoice for editing (`/CreateInvoice?edit=…`) fills the description fields, which triggers the search, and the error is logged once per line item.

**Suggested fix:** guard the fields (`(preset.name || "").toLowerCase()`, the same for `description`, and for `template.name` / `template.description`). Also find the row(s) missing them. A column renamed during the AxisBill → Invoicium migration would produce exactly this.

**Found:** 2026-09-10, as a console error in the CreateInvoice edit snapshot. Not fixed there because it changes behaviour.

---

**Fixed:** 2026-09-11 in `17137cf` (Fix #09: one bad service preset emptied the whole autofill list). Guarded. The row(s) with a missing name or description are still there and worth finding.
