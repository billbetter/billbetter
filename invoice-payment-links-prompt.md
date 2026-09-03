# Claude Code prompt — hosted invoice pages + payment links in notifications

Paste everything below the line into Claude Code from inside `AxisBill/`.

---

I want to change how invoices reach clients. Today we email a PDF. Instead: the email/SMS carries a link to a public, no-login invoice page on our own domain, where the client views the invoice and pays. Before writing any code, do the security audit in Task 0, then produce a plan.

## Repo facts (verify, don't assume)

- Vite + React, **plain JSX, no TypeScript**. Tailwind + shadcn/ui in `src/components/ui`. `@` aliases to `src`. Routes in `src/pages.config.js`.
- Browser data access: `src/api/sdk.js` → `sdk.entities.<Name>` (wrapper over Supabase via `src/api/localDataEngine.js`, using the **anon key** — so RLS is the only thing protecting these calls). Edge functions via `sdk.functions.invoke(name, body)`.
- Edge functions in `supabase/functions/`, shared helpers in `supabase/functions/_shared/`: `cors.ts`, `supabase-admin.ts` (service role), `stripe.ts`, `resend.ts`, `twilio.ts`, `email-templates.ts`, `notification-layout.ts`, `require-access.ts`.
- Already exist: `send-invoice-email`, `send-invoice-sms`, `create-invoice-payment-link`, `generate-invoice-pdf`, `stripe-webhook`.
- Stripe **Connect** — each contractor has their own connected account. Platform application fee varies by plan (see `processingFee` in `src/config/plans.js`).
- Migrations in `supabase/migrations/`. The paywall lives in `20260819160000_hard_paywall_rls.sql` (`public.has_app_access()`), mirrored client-side by `src/lib/access.js`.
- Quotes already have a public client-facing page: `src/pages/PublicQuote.jsx` and `ApproveQuote.jsx`. **Invoices have no public page at all.** That's the gap.

## Task 0 — security audit. Blocking. Do this first and report before anything else.

`src/pages/PublicQuote.jsx` currently loads its data straight from the browser with the anon key:

```js
sdk.entities.Quote.filter({ public_id: publicId }),
sdk.entities.BusinessSettings.list(),
```

Two things to verify against the actual RLS policies in `supabase/migrations/`:

1. **The `public_id` filter is client-side intent, not server-side enforcement.** PostgREST applies the filter, but RLS decides what is *visible*. If the anon policy on `quotes` is broad, a visitor can drop the filter and enumerate every quote in the database. Read the actual policy and tell me whether that's true.

2. **`BusinessSettings.list()` has no filter at all**, and the code takes `settingsData[0]`. Either anon can read every user's business settings — name, address, phone, tax numbers, logo — which is a serious leak, or it returns empty and branding silently never renders. There is also a plain correctness bug: it takes the *first* row, not the row belonging to the quote's owner, so a client can be shown a different contractor's branding on their quote.

Report what you actually find. Do not assume I'm right. If the policies turn out to be tight, say so and tell me how. **Whatever the answer, do not copy this pattern onto invoices** — invoices carry more money detail and potentially job cost data.

If quotes are in fact exposed, treat fixing them as part of this work, not a follow-up.

## The design

**Public invoice page.** No login, ever. Client opens it from an email or text.

**Data path — this is the important part.** The page must NOT query `sdk.entities` directly. Add an edge function (`get-public-invoice`) that:

- takes only the token
- uses the service role client from `_shared/supabase-admin.ts`
- returns a **narrowed, explicitly enumerated payload** — invoice number, issue/due dates, line items, subtotal/tax/total, amount paid and balance, status, client name and billing address, and the *correct owning business's* name/logo/address/contact
- returns **nothing else**. No raw row spreads. No internal UUIDs beyond what the page needs, no `user_id`, no Stripe customer/account ids, no job cost or margin fields, no other clients, no other invoices.
- is rate-limited, since the token is the only credential

Build the response object field by field. If you find yourself writing `...invoice`, stop.

**Token and lifetime.** Unguessable — UUIDv4 minimum, never a sequential invoice number. **Links never expire.** The client may come back eight months later looking for their record, and that's fine. The only thing that kills a link is the contractor revoking it from the dashboard. So:

- add a revocation column (e.g. `public_link_revoked_at`) and have the edge function reject revoked tokens with a friendly "this link is no longer available" page, not a raw 404
- add dashboard UI on the invoice detail screen: view link, copy link, revoke, regenerate (regenerating mints a new token and invalidates the old one)
- check whether invoices already have a `public_id` column — quotes do. Reuse the convention if it exists.

**Payment.** The Pay button calls `create-invoice-payment-link` **at click time**, minting a fresh Stripe Checkout session on each click. Do not pre-generate a payment URL and embed it in the email — Checkout sessions expire (24h default) and a client clicking next week would hit a dead link. This is the main reason the hosted page exists; don't undermine it.

Handle these states on the page: unpaid, partially paid (show balance due), paid in full (receipt view, no pay button, clear PAID treatment), and revoked.

**View tracking.** Record a `viewed` event on first real load and advance the invoice lifecycle (draft → sent → viewed → paid → overdue). This feeds the chase sequences in `src/components/invoice/chaseFollowUp.js` — "opened twice, hasn't paid" should be able to escalate differently from "never opened." Make sure the contractor previewing their own link does **not** mark it viewed.

**Email changes.** Stop attaching the PDF by default. The email body must still carry the essentials for people who never click — business name, amount due, due date, invoice number — with the link as the action, not the information. Keep it attachment-free so it lands in the inbox; attachments are a major spam-filter trigger and for an invoice, deliverability *is* getting paid.

**Keep the PDF, relocate it.** Prominent "Download PDF" on the public page, served through `generate-invoice-pdf` authorised by the same token. AP departments and accountants genuinely need a file.

**Escape hatch.** A per-send and per-client "attach PDF to email anyway" option. Some clients will not click a link and the contractor knows which ones.

**SMS.** Link only. Note: **A2P 10DLC registration is not done yet**, so US carriers will filter this traffic aggressively, especially messages containing links. Build it, but treat email as the primary channel, keep the URL short enough not to blow up SMS segments (a short `/i/<token>` route beats a long query string), and flag anywhere the design depends on SMS actually arriving.

**noindex** the public page — `PublicQuote.jsx` already does this correctly with the `SEO` component. Copy that.

## Constraints

- Plain JSX. Reuse existing shadcn components and the existing page/route conventions.
- **Ask before any schema change**, and show me the migration SQL. Additive and non-breaking only, with RLS policies consistent with the existing ones.
- **Ask before adding dependencies.**
- Do not loosen RLS on `invoices` to make the public page work. The service-role edge function is the boundary.
- Don't break current invoice sending while migrating. Existing sent invoices with no token need a backfill or a graceful path.
- The public page must render acceptably on a five-year-old Android phone on bad data. This is the single screen the contractor's customer will judge them on.

## What I want back first

Do not write code. Deliver:

1. **Task 0 findings** — what the RLS policies actually permit for anon on `quotes` and `business_settings`, quoted from the migration files.
2. A plan at `docs/invoice-links-plan.md`: the token/revocation model, the exact narrowed payload shape as a JSON example, every file touched, the migration SQL, how the backfill works, and what changes in `send-invoice-email` / `send-invoice-sms`.
3. The risk you're least confident about.

Then stop and wait for me.
