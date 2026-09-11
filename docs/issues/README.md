# Open issues found during the 2026-09 refactor

Found while snapshot-testing the structural refactor, and deliberately not
fixed there, because fixing each one changes behaviour. **All ten are fixed
now**, each in its own commit, on top of the refactor. The files are kept as
the record of what was wrong and what was decided; each ends with the commit
that fixed it. One file per issue, written so it can be pasted into GitHub
as-is:

    for f in docs/issues/[0-9]*.md; do gh issue create --title "$(head -1 "$f" | sed 's/^# //')" --body-file "$f"; done

| # | Issue | Severity (my read) | Fixed in |
|---|---|---|---|
| 01 | [Mobile header taps land on an invisible toast strip](01-toast-viewport-blocks-mobile-header.md) | High: every phone user, every page | `f85dee4` |
| 02 | [Date-only `due_date` parsed as UTC, a day early in Canada](02-due-date-parsed-as-utc.md) | Medium: wrong dates shown/exported; overdue off by a day | `cf6ac5c` |
| 03 | [Currency hardcoded as USD in six places, CAD elsewhere](03-currency-hardcoded-usd.md) | Medium: amounts labelled US$ for Canadian businesses | `7f144c3` |
| 04 | [Smart Insights ignores the selected date range](04-smart-insights-ignores-date-range.md) | Low, may be intended | `2dd789a` |
| 05 | [Three unguarded crashes: photo without taken_date, quote without date_issued, PaymentSuccess logged out](05-unguarded-crashes.md) | Low today (no live data hits them) | `2d96559` |
| 06 | ["Edit Quote" from the quote list opens a blank quote](06-edit-quote-opens-blank-quote.md) | Medium: an edit silently becomes a duplicate quote | `29bf931` |
| 07 | [Quotes "Export to Excel" is a stub, and using it jams the button](07-quotes-excel-export-sticks.md) | Low: dead menu item that disables itself | `29bf931` |
| 08 | [The quote builder's "upload a photo" never reads the photo](08-quote-photo-analyzer-ignores-photo.md) | Medium: a feature that pretends to work | `4e1aba0` |
| 09 | [Line-item autofill shows nothing if any service preset lacks a name or description](09-service-autofill-fails-on-one-bad-row.md) | Medium: happening on live data now | `17137cf` |
| 10 | [Analytics doesn't count "approved" quotes as won](10-analytics-ignores-approved-quotes.md) | Medium: wrong conversion rate; tells you to chase clients who said yes | `067aa38` |
