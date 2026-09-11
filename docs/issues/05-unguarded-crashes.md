# Three unguarded crashes

None of them is hit by current live data, but each takes a whole screen down when it is.

## A. A job photo with no `taken_date` crashes the job view

**Where:** `src/components/jobPhotos/JobDetailView.jsx`, photo grid: `format(new Date(photo.taken_date), "MMM d, yyyy")`.

**What happens:** if `taken_date` is null, `format()` throws `RangeError: Invalid time value`, the error boundary catches it, and the job's page is replaced by the error screen.

**Today:** every JobPhoto row has a `taken_date` (checked 2026-09-10: 1 of 1), so this is latent, found when fixture data without one crashed the view. It becomes live the first time an upload path or import skips the field.

**Suggested fix:** guard it the way `JobPhotos.jsx` already guards `scheduled_start_time` (render the date only when present), or fall back to `created_at`.

## B. PaymentSuccess throws when opened while logged out

**Where:** `src/pages/PaymentSuccess.jsx`.

**What happens:** opened with no session it logs `❌ Database check error: TypeError: Cannot read properties of null (reading 'id')`. The user is `null` and the check reads `.id` from it.

**Note:** this is Stripe-flow code. Per the standing rule it needs an explicit go-ahead before anyone edits it.

## C. A quote with no `date_issued` crashes the quote list

**Where:** `src/pages/Quotes.jsx` (desktop table row and mobile card): `format(new Date(quote.date_issued), ...)`, unguarded.

**What happens:** one such quote replaces the whole Quotes page with the error screen, the same `RangeError` as A.

**Today:** latent. Every Quote row has `date_issued` (checked 2026-09-10: 2 of 2). Found the same way as A, from fixture data.

**Suggested fix:** render the date only when present, or fall back to `created_at`, which is what `get-public-quote` already does for the client's copy (`issue_date: quote.date_issued || quote.created_at`).
