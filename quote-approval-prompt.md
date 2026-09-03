# Claude Code prompt — client-side quote approval + Settings

Paste everything below the line into Claude Code from inside `AxisBill/`.

---

I want a client to be able to open their quote on our website, click Approve themselves, and have that approval show up on my side and be controllable from Settings. Before writing any code, do Task 0 — a chunk of this already exists and I don't want it rebuilt.

## Repo facts (verify, don't assume)

- Vite + React, **plain JSX, no TypeScript**. Tailwind + shadcn/ui in `src/components/ui`. `@` aliases to `src`. Routes in `src/pages.config.js`.
- Browser data access: `src/api/sdk.js` → `sdk.entities.<Name>` (Supabase via `src/api/localDataEngine.js` on the **anon key** — RLS is the only thing protecting those calls). Edge functions via `sdk.functions.invoke(name, body)`.
- Edge functions in `supabase/functions/`, shared helpers in `supabase/functions/_shared/`: `cors.ts`, `supabase-admin.ts` (service role), `public-link.ts`, `resend.ts`, `notify.ts`, `notification-types.ts`, `email-templates.ts`, `require-access.ts`.
- Column allow-lists live in `src/api/entityColumns.js`. A column that isn't listed there does not come back from a query, no matter what the database has.
- Migrations in `supabase/migrations/`. The paywall is `public.has_app_access()` from `20260819160000_hard_paywall_rls.sql`, mirrored client-side by `src/lib/access.js`.

## Task 0 — read what already exists. Blocking. Report before touching anything.

The public approval path is largely built. Read these and tell me what they actually do:

- `src/pages/PublicQuote.jsx` — the no-login quote page, with an Approve button behind a typed-name confirm step.
- `src/pages/ApproveQuote.jsx` — the one-click landing page from the emailed approval link.
- `supabase/functions/approve-quote/index.ts` — accepts either `approval_token` or `public_id`, requires a typed name, writes `status`, `approved_by_name`, `approved_at`, then emails me.
- `supabase/functions/get-public-quote/index.ts` and `_shared/public-link.ts` — how `capabilities.can_approve` is decided, and how revoked/expired links are answered.
- `supabase/migrations/20260826120000_public_quote_links.sql` and `20260826140000_quote_approval_record.sql`.

**Do not rebuild any of that.** The comments in those files record decisions that were made deliberately — no `requireAppAccess` on the public path, constant-time token compare, identical answers for unknown/revoked/expired, view tracking recorded client-side after mount, no IP logging. Treat all of it as settled. If you think one of them is wrong, say so and stop; do not quietly change it.

What I want from Task 0 is the honest list of what is missing between "client clicks Approve" and "I see it and can control it." Some things I already suspect — confirm or correct each:

1. `src/pages/QuoteDetail.jsx` around line 403 renders the approval date from `quote.approval_date`. I don't think that column exists — the migration added `approved_at`. If so, the "Approved [date]" line has never rendered once, and `approved_by_name` is displayed nowhere in the app at all.
2. `src/components/notifications/NotificationSettings.jsx` has `quote_approved` and `quote_declined` preference toggles. Check whether `approve-quote` reads them. It looks like it calls `sendEmail` directly rather than going through `_shared/notify.ts`, which would mean the toggle in Settings does nothing.
3. `quote_declined` has a toggle but I don't think a client can decline anywhere — `PublicQuote.jsx` renders a "this quote was declined" state but I see no control that sets it.
4. Check `src/api/entityColumns.js` actually lists `approved_by_name` and `approved_at` on `Quote`, and check `Quotes.jsx` (the list) for whether an approved quote shows anything beyond a status badge.

Quote each finding from the file. Don't assume I'm right.

## What I want built

**The client side.** Keep the existing Approve flow as-is — deliberate confirm, typed name, name stored. Add the matching **Decline** on `PublicQuote.jsx`: same weight of confirmation, an optional short reason, sets `status: 'rejected'` and records who declined and when. It goes through `approve-quote` (or a sibling function that shares its credential handling) — the same constant-time compare, the same treatment of revoked and expired links, the same rule that the confirmation is enforced **server-side**, not just in the page. A confirm step that lives only in the browser is decoration; the endpoint is reachable directly.

**My side.** When a client approves or declines, I should see it without opening my email:

- `QuoteDetail.jsx` — fix the wrong column, and show the actual record: "Approved by Dana Marchetti on 4 September", or the decline with its reason. This is the thing that has to survive a scope dispute in three months, so show the typed name, not the client name on the record — they can differ, and the one that matters is what the person approving asserted about themselves.
- `Quotes.jsx` — an approved row should say who approved it, not just carry a green badge.
- Whatever fix this needs in `entityColumns.js` so the fields actually come back.

**Settings.** Two separate things, and I want both:

1. **Make the existing notification toggles real.** `quote_approved` and `quote_declined` in Settings → Notifications should actually gate whether I get emailed. Route `approve-quote` through `_shared/notify.ts` the way the invoice paths do, add the payload types to `notification-types.ts`, and read the preference off the contractor's `notification_preferences`. Preferences live on the user record as JSON — check how `NotificationSettings.jsx` loads and saves them and follow that, don't invent a second store. Keep the notification best-effort: the approval is already committed when it fires, and a Resend outage must never make the client think their approval failed and click again.
2. **A control for whether clients can self-approve at all.** A business-level setting — default on — that decides whether public quote links carry the Approve and Decline buttons. It has to gate `capabilities.can_approve` (and the new decline capability) **in `get-public-quote` and be re-checked in the approving function**, not just hide the button in the page. Put it wherever it sits most naturally in the existing Settings layout (`src/components/settings/SettingsHub.jsx` has the section map) — probably alongside invoice defaults rather than a new top-level section.

## Constraints

- Plain JSX. Reuse the existing shadcn components, page conventions and the design tokens already in use on those pages (`text-content-body`, `bg-surface`, `border-line` and friends) — no raw hex, no new colour scale.
- **Ask before any schema change** and show me the migration SQL first. Additive and non-breaking only, RLS consistent with the existing policies. If a new column is needed for the decline reason, say so before writing it.
- **Ask before adding dependencies.**
- Do not loosen RLS on `Quote` to make any of this work. The service-role edge function is the boundary — that is the rule the whole public-link feature was built on.
- Do not put a second credential into the browser. `public_id` is what the page holds; `approval_token` stays in the email.
- The public page is the one screen my customer judges me on. It has to render on a five-year-old Android phone on bad data.
- `npm run check` must pass. Anything I need to run myself — a migration, a function deploy via `scripts/deploy-functions.py` — list it explicitly at the end.

## What I want back first

Do not write code. Deliver:

1. **Task 0 findings** — what already works, quoted from the files, and the confirmed list of what is actually missing.
2. A short plan at `docs/quote-approval-plan.md`: every file touched, the migration SQL if any, how the decline endpoint shares the approve function's credential handling, how the Settings toggle reaches `get-public-quote`, and what happens to quotes that were approved before this change.
3. The one thing you're least confident about.

Then stop and wait for me.
