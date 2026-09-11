# Quotes "Export to Excel" is a stub, and using it jams the button

**Where:** `src/pages/Quotes.jsx`, `handleExportToExcel`; the stub is in `src/api/sdk.js:543` (`exportInvoicesToExcel` / `exportQuotesToExcel` return `notImplemented`).

**What happens:** the Actions menu on the quote list offers "Export to Excel". The export was never built, so every tap:
1. alerts "Excel export isn't available yet.", then
2. `return`s from inside the `try`, which skips the `setExporting(false)` after the try/catch, so
3. the menu item stays disabled with a spinner until the page is reloaded.

**Suggested fix:** either build the export (the invoice list's CSV export, `src/components/invoice/list/exportInvoicesCsv.js`, is a working model and needs no edge function) or remove the menu item until it exists. Whichever you choose, put `setExporting(false)` in a `finally`.

**Found:** 2026-09-10, while splitting Quotes.jsx; not fixed there because it changes behaviour.

---

**Fixed:** 2026-09-11 in `29bf931` (Fix #06 and #07: Edit Quote opens the quote, and the export works). Built as CSV, the way the invoice list already exports; the menu reads "Export CSV" and the handler is synchronous, so there is no `exporting` state left to stick.
