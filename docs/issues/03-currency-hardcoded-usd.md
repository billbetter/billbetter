# Currency is hardcoded as USD in six places and CAD in others

**What happens:** amounts are formatted with `Intl.NumberFormat(..., { currency })`, but the currency is a literal that differs from screen to screen. In an `en-CA` browser a USD amount renders as **"US$1,234.00"**, so a Canadian contractor sees their own invoices labelled in US dollars on some screens and in Canadian dollars on others.

**USD, hardcoded:**
- `src/pages/PaperTrail.jsx:66` (Paper Trail list; its PDF export should be checked too)
- `src/pages/ChaseInvoice.jsx:77`, `:84`
- `src/components/invoice/ChaseInvoiceBanner.jsx:21`
- `src/components/invoice/chaseFollowUp.js:38` (the amount written into chase messages)
- `src/components/dashboard/DailyDigest.jsx:35`
- `src/components/billing/QuickBillFlow.jsx:38`

**CAD, hardcoded:** `src/pages/PaymentPlans.jsx`, `src/pages/Timesheet.jsx`, and the client link pages as a fallback (`src/components/public/documentFormat.jsx`).

**Already right:** the client-facing invoice/quote pages use the business's own `settings.currency` (server-provided), defaulting to CAD. `CreateInvoice.jsx:849` picks CAD or USD from the business location.

**Suggested fix:** one formatter that takes the business's `settings.currency` (default CAD), used everywhere above. Worth checking at the same time whether the chase *messages* sent to clients carry the wrong currency, since that text leaves the app.
