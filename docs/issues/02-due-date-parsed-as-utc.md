# Date-only `due_date` is parsed as UTC, so it reads a day early in Canada

**What happens:** `due_date` is a calendar day (`"2026-09-20"`). `new Date("2026-09-20")` parses a date-only string as **UTC** midnight, which in every Canadian time zone (UTC-3.5 to UTC-8) is the evening of the 19th. Anything that formats it shows the wrong day. Anything that compares it with `now` treats the invoice as due roughly a day early.

**Where** (`grep -rnE "new Date\([a-zA-Z_.?]*due_date\)" src/`):

| File | Effect |
|---|---|
| `src/components/invoice/list/exportInvoicesCsv.js:28` | CSV export: every due date one day early |
| `src/pages/Dashboard.jsx:309` | Dashboard export: same |
| `src/pages/InvoiceDetail.jsx:804` | Due date shown a day early |
| `src/pages/CreateInvoice.jsx:318` | Same, in the create/edit screen |
| `src/components/dashboard/DailyDigest.jsx:52,60,173-178` | "Due today/tomorrow" labels and overdue count off by a day |
| `src/pages/Dashboard.jsx:363`, `src/api/sdk.js:494` | Overdue comparison against `now` |
| `src/components/invoice/chaseFollowUp.js:135` | Chase tone chosen from days overdue |
| `src/components/analytics/SmartInsights.jsx:106` | Insight maths |
| `src/components/invoice/CustomTemplatePreview.jsx:132` | Preview only (sample data) |
| `src/components/invoice/recurring/recurringStatus.js` (`getEndLabel`) | Recurring schedule's end date shown a day early |

**Suggested fix:** one helper that parses a date-only string as a *local* calendar day (`parseISO` from date-fns does this, as does splitting `y-m-d` into `new Date(y, m-1, d)`), used at every site above. The overdue comparisons should compare calendar days, not instants.

**Note:** this is the same class of bug an earlier session recorded as "four pages still do it". There are more than four.
