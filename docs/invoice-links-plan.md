# The public document surface

Status: **plan only, nothing implemented** (one exception: the trap comment at
`PublicQuote.jsx` was added on request — see §1.5).

Reframed after Task 0, per your call. This is not "add a hosted invoice page".
**The public document surface has never worked.** Three client-facing pages are
down in production right now, and invoices were simply the one that had no page
to be down. The token + edge-function pattern is designed once in §3 and applied
to quotes and invoices together, quotes first.

---

## 1. Task 0 — security audit

**Both hypotheses are wrong in the direction that matters. Nothing is leaking.
The real defect is the opposite one, and it is bigger than one page: three
client-facing pages — `PublicQuote`, `ApproveQuote` and `PublicBooking` — are
non-functional in production, and the tight RLS is what has been hiding it.**

### 1.1 What the policy actually is

`20260819160000_hard_paywall_rls.sql` rebuilds every data-table policy in a
loop over an array that includes `Quote`:

```sql
tables constant text[] := array[
  'Client', 'Invoice', 'Quote', 'Job', 'JobMaterial', 'JobNote', 'JobPhoto',
  'InvoiceTemplate', 'RecurringInvoice', 'Receipt',
  'CrewMemberSettings'
];
...
execute format(
  'create policy %I on %s for all
     using (auth.uid() = user_id and public.has_app_access(auth.uid()))
     with check (auth.uid() = user_id and public.has_app_access(auth.uid()))',
  tbl || ' access', reg
);
```

`20260823000000_crew_access.sql` later widened the ownership half from
`auth.uid() = user_id` to an `accessible_owner_ids()` lookup so crew members can
see their employer's rows. The live policy — read from `pg_policies`, not
inferred — is now:

```
Quote / Invoice / Client   "…​ access"   ALL   roles={public}
  qual: (user_id IN (SELECT accessible_owner_ids(auth.uid())))
        AND has_app_access(auth.uid())
```

The header comment in the paywall migration says why this is not
authenticated-only:

> the project URL and anon key are both in the public bundle. This closes that.

### 1.2 Why anon gets nothing

Two independent reasons, either sufficient:

| expression | value for anon | source |
|---|---|---|
| `has_app_access(null)` | **`false`** | queried directly |
| `accessible_owner_ids(null)` | one row, containing `NULL` | queried directly |

`has_app_access(auth.uid())` is `false` for an anonymous request, and the policy
ANDs it, so the whole predicate is `false` regardless of the ownership half.
Independently, `user_id IN (NULL)` evaluates to `NULL`, which is not `true`, so
it would fail even without the paywall clause.

### 1.3 Proven, not reasoned

I issued real anonymous PostgREST requests with the publishable anon key
against tables that **contain rows** (`BusinessSettings` has 1, `Invoice` has 3),
so an empty result is meaningful rather than an artifact of empty tables:

```
GET /rest/v1/BusinessSettings?select=*   HTTP 200   []
GET /rest/v1/Invoice?select=*            HTTP 200   []
GET /rest/v1/Quote?select=*              HTTP 200   []
GET /rest/v1/Client?select=*             HTTP 200   []
GET /rest/v1/Job?select=*                HTTP 200   []
GET /rest/v1/JobPhoto?select=*           HTTP 200   []
```

`200 []` rather than `401` is expected: the anon role holds the table `GRANT`,
and RLS then filters every row away.

### 1.4 Answering the two questions directly

**1. Can a visitor drop the `public_id` filter and enumerate every quote?**
**No.** `Quote.filter({ public_id })` compiles to
`GET /rest/v1/Quote?public_id=eq.<id>` — a *narrowing* of the unfiltered query
above, which already returns `[]`. A filter can only remove rows. Dropping it
gains an attacker nothing.

**2. Can anon read every user's `BusinessSettings`?**
**No.** Its SELECT policy is
`user_id IN (SELECT accessible_owner_ids(auth.uid()))` and it returned `[]`
against a table holding a real row. Worth noting it is the one policy here
*without* a `has_app_access` clause, so it rests entirely on the `IN (NULL)`
behaviour — correct, but with one less layer than the others.

So the second branch of your hypothesis is the true one: **it returns empty and
branding silently never renders.**

### 1.5 The bug you predicted is real, but currently unreachable

`settingsData[0]` genuinely is wrong — it takes the *first* row rather than the
row belonging to the quote's owner. Today it is harmless only because the array
is always empty. It would become a live cross-tenant branding bug the moment
anyone "fixed" the blank branding by loosening that policy — which is exactly
the tempting wrong fix, and worth recording so nobody reaches for it later.

### 1.6 The actual defect: the public quote page is non-functional

```js
const [quoteData, settingsData] = await Promise.all([
  sdk.entities.Quote.filter({ public_id: publicId }),
  sdk.entities.BusinessSettings.list(),
]);
if (quoteData.length > 0) setQuote(quoteData[0]);
```

`quoteData` is always `[]`, so `quote` stays `null`, and the component renders:

> **Quote Not Found** — This link may be invalid or the quote has been removed.

Every recipient of a quote link gets that screen. This is not a security
finding; it is a total feature outage that the tight RLS has been masking.

### 1.7 You asked me to check ApproveQuote and PublicBooking. Both are also down.

Three separate outages, three different causes:

| Page | Cause | What the client sees |
|---|---|---|
| `PublicQuote.jsx` | anon RLS returns `[]` | "Quote Not Found" |
| `ApproveQuote.jsx` | **the edge function does not exist** | **a green "Quote Approved!"** |
| `PublicBooking.jsx` | anon RLS returns `[]` | "Booking page not found" |

**`ApproveQuote` is the worst of the three.** It calls:

```js
const response = await sdk.functions.invoke("approveQuote", { token });
```

There is no `approveQuote` directory in `supabase/functions/`, and no
`approveQuote` key in the `realEdgeFunctions` map in `src/api/sdk.js`.

**Correction to my earlier report.** I first said this surfaced as "An error
occurred". It does not — I stopped reading before the end of the stub chain.
`handleFunctionInvoke` ended with:

```js
return { data: { success: true } };
```

An unconditional catch-all answering **success** for any name nobody
implemented. So `approveQuote` returned `{ success: true }`, and ApproveQuote.jsx
rendered a green tick and **"Quote Approved!"** to the client — while the quote's
status was never touched, no notification fired, and the contractor's dashboard
never changed.

That is materially worse than an error message. An error makes the client call
the contractor; a fake confirmation makes both sides believe a deal closed that
did not. Silent data loss, presented to the customer as success.

Quote approval has never worked, and the failure was disguised.

`PublicBooking.jsx` uses the same doomed anon read as PublicQuote:

```js
const settingsData = await sdk.entities.BusinessSettings.filter({
  booking_slug: slug,
});
if (settingsData.length === 0) { setError("Booking page not found"); }
```

Same policy, same `[]`, same dead end. Note this one is sold at Professional as
`public_booking`.

**Verdict: nothing is exposed, so there is no leak to fix. But the entire
quote → approve → convert funnel is dead in production, and so is booking.**
That outranks the invoice work, which is now sequenced second.

---

## 2. What else the audit turned up

Six things that change the design, found while verifying the above.

### 2.0 Decision 4 — the public path deliberately skips `has_app_access`

Your call, recorded here because it is the one place this design intentionally
steps around the paywall. Every public function carries this comment verbatim:

```ts
// DELIBERATE: no requireAppAccess() on this path.
//
// A lapsed contractor's clients can still view and PAY an invoice that was
// already sent. This is intentional and must not be "fixed":
//
//   1. Blocking payment punishes the contractor by breaking THEIR cash flow --
//      a churn bomb aimed at someone whose card merely failed.
//   2. We would forfeit our platform fee on money we are already owed.
//   3. The exposure is bounded: RLS still stops a lapsed user CREATING
//      invoices, so no new links can appear while they are lapsed. The set of
//      reachable documents is frozen at the moment access lapsed.
//
// The application fee falls back to the Core rate when the subscription is
// not live -- see feePercentForSubscription().
```

### 2.0b Decision 4 — two functions, one session builder

Separate function, agreed: `requireAppAccess` stays a wall with no door.

Your divergence concern is the real risk, so the split is drawn at exactly one
line. `_shared/stripe-session.ts` owns **everything** about building the
Checkout session — line items, currency, success/cancel URLs, all metadata keys,
the `Stripe-Account` header, and the application fee. Both functions then read:

```ts
// create-invoice-payment-link (contractor)      pay-public-invoice (client)
const access = await requireAppAccess(req);      const inv = await invoiceByToken(token);
if (!access.ok) return accessDenied(access);     if (!inv) return notFound();
const invoice = await db.getOne('Invoice', id);
return buildInvoiceCheckoutSession(invoice);     return buildInvoiceCheckoutSession(inv);
```

**Can I get them down to that? Yes, with one exception I have to flag.**

The fee differs — not by code path, but by input. Decision 4 says a lapsed
contractor's clients can still pay, at the Core rate. The contractor path can
never be lapsed (`requireAppAccess` already returned). So the builder takes the
subscription and derives the rate itself via `feePercentForSubscription()`
(§2.3b), which returns the Core rate for a non-live subscription. Same function,
same input, no branch in either caller — the difference is data, not logic.

Everything else is genuinely identical. If a future change cannot be expressed
inside the builder, that is the signal the split has drifted and should be
challenged rather than worked around.

### 2.1 `create-invoice-payment-link` cannot serve the public page

The brief says the Pay button calls it at click time. It currently opens with:

```ts
const access = await requireAppAccess(req);
```

That authenticates **the contractor** and checks their subscription. An
anonymous client has no session, so the call fails. This needs either a new
public sibling or a token branch — see §5.

There is no `[functions.*]` block in `supabase/config.toml`, so every function
deploys with the default `verify_jwt = true`. That is not an obstacle: the anon
key is itself a valid JWT and `sdk.functions.invoke` sends it automatically. It
does mean JWT verification is not doing meaningful access control here, so the
token has to be the real credential.

### 2.2 Invoices have no public-link columns at all

Confirmed against `information_schema`. `Invoice` has 27 columns and **none** of
`public_id`, `public_token`, `revoked`, `viewed_at`. Quotes have both `public_id`
and `approval_token`; invoices have neither. So this is greenfield, and I would
rather introduce one clean convention than inherit the quote one — see §4.

### 2.3 Partial payments — CUT from scope (your decision 5)

`Invoice` has `total`, `status` and `paid_date` but no `amount_paid`, and
Stripe Checkout cannot produce a partial payment anyway. The page renders three
states only: **unpaid / paid / revoked**. No `amount_paid` column is added, and
`balance_due` does not appear in the payload — `total` is the amount due.

If manual part-payments are wanted later they need a column *and* a recording
UI, which is its own piece of work.

### 2.3b The platform fee is wrong on every live account right now

Unrelated to the public surface but in the same function, and worse than
described. `create-invoice-payment-link` reads a stored column:

```ts
const subscription = await db.findOne('Subscription', { user_id: invoice.user_id });
const feeCents = applicationFeeCents(totalCents, subscription?.payment_processing_fee);
```

`payment_processing_fee` was written at checkout and is stale after the pricing
rebalance. I queried the live table:

| plan_name | status | payment_processing_fee | should be |
|---|---|---|---|
| enterprise | active | **1** | 0.5 |
| enterprise | active | **1** | 0.5 |

Both live subscriptions are Enterprise being charged **1%, double the 0.5% the
pricing page advertises**. This is not a latent bug — it is overcharging on
100% of accounts today, on every payment taken.

`getTransactionAllowance()` in permissions.jsx already solved exactly this
problem for transaction limits, and its docblock explains why: stored values go
stale when the ladder is rebalanced and nothing rewrites them. The fee needs the
same treatment.

**One obstacle with your proposed fix.** `getProcessingFeePercent()` lives in
`src/components/utils/permissions.jsx` — a JSX module that imports via the `@/`
alias and pulls in `@/config/plans`. Edge functions run in **Deno**, which
resolves neither the alias nor JSX. It cannot be imported.

So the rate table has to be ported to `supabase/functions/_shared/plan-fees.ts`.
That is a fourth copy of plan knowledge, which I dislike — but there is
precedent and a stated rationale in `_shared/require-access.ts`:

> Three copies is two too many, but each runs in a different runtime; keep them
> in step.

The new helper resolves the fee from `plan_name` (authoritative) rather than the
stored column, and falls back to the Core rate when the subscription is not
live — which is also what decision 4 requires:

```ts
export function feePercentForSubscription(sub: Record<string, any> | null): number {
  if (!sub || !subscriptionGrantsAccess(sub)) return PLAN_FEES.core;   // lapsed -> Core rate
  return PLAN_FEES[resolvePlanId(sub.plan_name)] ?? PLAN_FEES.core;
}
```

A dev-time guard in `src/config/plans.js` should assert that `PLAN_FEES` matches
`processingFee` for every plan, so the two copies cannot silently diverge.

**Note this fix takes money out of our own pocket** — it halves the fee on both
live accounts. It is still the right call, because the alternative is charging
more than we advertise.

### 2.4 Nothing consumes a `viewed` signal today

`chaseFollowUp.js` escalates purely on `daysOverdue`. The string `"viewed"`
appears exactly once in the whole `src/` tree, in `Analytics.jsx:928`, and that
is for quotes. So "opened twice, hasn't paid" is genuinely new behaviour, not a
matter of wiring up an existing branch.

**Decision 6: record it, build nothing on it.** "Was this ever opened" cannot be
backfilled, so collection starts on day one and `chaseFollowUp.js` is left
alone. The signal is deliberately **inert for now** — it accumulates history so
the escalation logic has something real to read whenever it is written.

Sensitive fields that must never reach the public payload, now enumerated so the
narrowing in §3 can be checked against a list:
`Invoice.user_id`, `stripe_payment_intent_id`, `stripe_session_id`,
`platform_fee_amount`, `client_id`, `payment_link`;
`BusinessSettings.stripe_account_id`, `stripe_account_status`,
`stripe_onboarding_completed`, `email_subject_template`, `email_body_template`,
`analytics_email_*`.

---

## 3. The narrowed payload

Built field by field. No spreads.

```json
{
  "invoice": {
    "number": "INV-1042",
    "issue_date": "2026-08-01T00:00:00.000Z",
    "due_date": "2026-08-31T00:00:00.000Z",
    "status": "sent",
    "payment_terms": "Net 30",
    "notes": "Thanks for your business.",
    "currency": "CAD",
    "items": [
      { "description": "Panel upgrade — 200A", "quantity": 1, "rate": 2400.00, "amount": 2400.00 }
    ],
    "subtotal": 2400.00,
    "tax_rate": 13,
    "tax_amount": 312.00,
    "total": 2712.00
  },
  "client": {
    "name": "Marchetti Renovations",
    "address": "88 Bay St, Toronto ON M5J 2T3"
  },
  "business": {
    "name": "Northline Electric",
    "logo_url": "https://…/uploads/<uuid>-logo.png",
    "address": "12 Kipling Ave, Etobicoke ON",
    "phone": "+1 416 555 0134",
    "email": "accounts@northline.example",
    "website": "northline.example"
  },
  "capabilities": {
    "can_pay_online": true,
    "can_download_pdf": true
  }
}
```

Notes on deliberate omissions:

- **No ids of any kind.** Not `invoice.id`, not `client_id`, not `user_id`. The
  page already holds the token; it needs no other handle. Every follow-up call
  (pay, PDF) is authorised by the token, so an id would be a liability with no
  compensating use.
- `items` is **re-mapped**, not passed through. `Invoice.items` is `jsonb` and
  therefore unvalidated — whatever a client wrote is in there. Four fields are
  copied out by name; anything else a row happens to carry is dropped.
- `can_pay_online` is computed server-side from the owner's
  `stripe_account_status`, so the page never learns *why* it cannot offer
  payment, only that it cannot.
- No `amount_paid` / `balance_due` (decision 5). `total` is the amount due, and
  `status` alone distinguishes unpaid from paid.
- **The revoked case returns no payload at all** — `{ "error": "revoked" }` with
  HTTP 410, so the page cannot render stale figures from a killed link.

---

## 4. Schema changes

All additive. No existing column is altered. The new columns inherit the
existing `Invoice` policy automatically — a policy is per-table, not per-column —
so no RLS change is needed, and none is wanted: the service-role function is the
boundary, exactly as you specified.

```sql
-- Public invoice links.
--
-- Additive only. Nothing here loosens RLS: the public page never reads these
-- tables directly, it calls get-public-invoice, which uses the service role.
-- The columns are gated by the existing "Invoice access" policy like every
-- other column on the table.
--
-- NOTE: gen_random_uuid() is VOLATILE, so adding public_token REWRITES the
-- table under ACCESS EXCLUSIVE rather than taking the Postgres 11+ fast-default
-- path. Fine at current volume (3 invoices). On a large table use the
-- three-step form instead: add nullable, backfill in batches, then set NOT NULL.
-- Three-step form, deliberately, even at 3 rows: this migration is the one
-- someone copies next time. Doing it the cheap way here would teach the
-- expensive lesson later.

-- 1. Add nullable. Metadata-only, no rewrite, no lock.
alter table public."Invoice"
  add column if not exists public_token           uuid,
  add column if not exists public_link_revoked_at timestamptz,
  add column if not exists first_viewed_at        timestamptz,
  add column if not exists last_viewed_at         timestamptz,
  add column if not exists view_count             integer not null default 0;

-- 2. Backfill in batches. One statement at this size; the loop is what makes
--    it safe at 100k, where a single UPDATE would hold row locks throughout.
do $$
declare updated int;
begin
  loop
    update public."Invoice"
       set public_token = gen_random_uuid()
     where id in (
       select id from public."Invoice" where public_token is null limit 1000
     );
    get diagnostics updated = row_count;
    exit when updated = 0;
    commit;   -- procedural block; release locks between batches
  end loop;
end $$;

-- 3. Constrain. NOT VALID skips the full-table scan under ACCESS EXCLUSIVE;
--    VALIDATE then scans under a weaker lock that does not block writes.
alter table public."Invoice"
  add constraint invoice_public_token_present
  check (public_token is not null) not valid;
alter table public."Invoice"
  validate constraint invoice_public_token_present;

-- New rows get one automatically. A default is not a rewrite on its own --
-- only combining it with the column's creation was.
alter table public."Invoice"
  alter column public_token set default gen_random_uuid();

-- The token is the only credential, so the lookup must be exact and indexed.
-- Unique because a collision would hand one client another's invoice; at
-- uuid4 width this will never fire, which is the point of asserting it.
create unique index if not exists invoice_public_token_key
  on public."Invoice" (public_token);

-- NO Client column yet (your call). Phase A keeps the attachment for everyone,
-- so an override would have nothing to override. By Phase D we will know
-- whether it wants to be per-send, or a BusinessSettings default with a
-- per-send override. Locking the shape now would be guessing.

comment on column public."Invoice".public_token is
  'Credential for the public invoice page. Unguessable, never expires; only
   revocation kills it. Rotating this column invalidates the old link.';
comment on column public."Invoice".first_viewed_at is
  'Denormalised onto the invoice so the list view never joins PublicLinkHit.
   Permanent; the hit log itself is pruned at 180 days.

   NOTE: viewing is deliberately NOT a status value. status holds one value, so
   an invoice that has been viewed AND is overdue could only be one of them, and
   overdue is the one the UI needs. A timestamp composes with status; an enum
   member competes with it.';
```

**Rate limiting** needs its own table. Deno edge functions run per-isolate, so
an in-memory counter is not shared across invocations and would not actually
limit anything:

```sql
create table if not exists public."PublicLinkHit" (
  id           bigserial primary key,
  invoice_id   uuid not null references public."Invoice"(id) on delete cascade,
  hit_at       timestamptz not null default now(),
  is_bot       boolean not null default false,
  referrer     text,
  -- NOT the IP. Not the user agent either. See below.
  dedupe_hash  text
);
create index if not exists public_link_hit_invoice on public."PublicLinkHit" (invoice_id, hit_at desc);
create index if not exists public_link_hit_prune   on public."PublicLinkHit" (hit_at);

alter table public."PublicLinkHit" enable row level security;

-- The contractor may read hits for invoices they own. Deliberately no
-- has_app_access clause: this is a read of their own history, and the crew
-- lookup matches every other table.
create policy "PublicLinkHit read" on public."PublicLinkHit"
  for select to authenticated
  using (exists (
    select 1 from public."Invoice" i
     where i.id = "PublicLinkHit".invoice_id
       and i.user_id in (select accessible_owner_ids(auth.uid()))
  ));

-- No INSERT/UPDATE/DELETE policy at all. Writes come only from the edge
-- function, which uses the service role and bypasses RLS. With RLS enabled and
-- no write policy, anon and authenticated can write nothing -- which is the
-- point: a client must not be able to forge or erase view history.
```

### No raw IPs (PIPEDA)

Your call, and it tightened the design. These are a contractor's **client's** IP
addresses — third parties who never agreed to anything with us. We are a
Canadian company, so PIPEDA applies, and we gain nothing from storing them.

Stored: `invoice_id`, `hit_at`, `is_bot`, `referrer`. That is enough for "opened
twice, hasn't paid".

For dedupe, `dedupe_hash = sha256(ip + user_agent + daily_rotating_salt)`. The
salt rotates daily and is never stored alongside the hash, so yesterday's hashes
cannot be re-derived even with the same IP — dedupe works within a day, and the
data stops being linkable after it.

Pruned at 180 days by a `pg_cron` job. `Invoice.first_viewed_at` is permanent;
the log behind it is not.

### Recording from the client, after mount — not from the HTTP request

The most important detail here, and I would not have got to it on my own.

Corporate mail security (Outlook Safe Links, Mimecast, Proofpoint) pre-fetches
every URL in an email at delivery time. Recording server-side in the GET handler
would fire `first_viewed_at` seconds after send, from a scanner, for a large
share of business clients — precisely the clients who matter most.

The failure mode is not noise. It is **wrong in the exact direction that makes
the product accuse people**: chase sequences would escalate against clients who
never opened anything, in a tone justified by a view that was a robot.

Three layers:

1. **Record from JS after mount**, via a separate `POST /record-view` call.
   Scanners fetch HTML; they do not boot a React SPA. This alone removes most.
2. **Skip known scanner user-agents** and anything sending
   `Sec-Fetch-Mode: navigate` with no prior asset fetches, marking them
   `is_bot = true` and recording them without advancing `first_viewed_at`.
3. **Ignore hits within ~60s of send.** A human who opens an invoice ten seconds
   after it arrives is real but rare; a fetch in that window is overwhelmingly
   a scanner, and the cost of missing one genuine instant-open is nil.

`is_bot` rows are kept rather than dropped, so we can measure how much of this
is actually happening instead of assuming.

### Why `public_token uuid` rather than following the quote convention

`Quote.public_id` is `text`. I would not copy it:

- `uuid` is 16 bytes and self-validating — a malformed token fails at the type
  boundary before it reaches a query.
- `not null default gen_random_uuid()` means **the backfill is the migration**.
  Every existing invoice gets a token the moment the column is added; there is
  no separate backfill script, no window where a row has no link, and no "token
  is null" branch to write. That answers your backfill requirement directly.

**Correction to an earlier draft of this document.** I claimed this was a
metadata-only operation. It is not. Postgres 11+ skips the table rewrite only
for a NON-VOLATILE default; `gen_random_uuid()` is VOLATILE, because every row
must receive a distinct value. So the table IS rewritten, under
`ACCESS EXCLUSIVE`, blocking reads and writes for the duration.

At 3 invoices that is imperceptible and the conclusion stands. On a table with
100k invoices it would lock writes, and the migration would instead need the
three-step form: add the column nullable, backfill in batches, then set
`NOT NULL` (via `NOT VALID` check + `VALIDATE CONSTRAINT` to avoid a second
full lock). Worth writing down now so nobody copies this pattern onto a large
table later.

---

## 5. Files touched

### New

| File | Purpose |
|---|---|
| `supabase/functions/_shared/public-link.ts` | Token lookup, revocation check, rate limit, IP/token hashing — shared so the four cannot drift |
| `supabase/functions/_shared/plan-fees.ts` | Fee rate by `plan_name`; fixes §2.3b |
| `supabase/functions/get-public-quote/index.ts` | **Stage 1.** Fixes the PublicQuote outage (§1.6) |
| `supabase/functions/approve-quote/index.ts` | **Stage 1.** The function that was never written (§1.7) |
| `supabase/functions/get-public-booking/index.ts` | **Stage 2.** Fixes the PublicBooking outage (§1.7) |
| `supabase/functions/get-public-invoice/index.ts` | **Stage 3.** Token → narrowed payload. Service role. Rate limited. |
| `supabase/functions/pay-public-invoice/index.ts` | **Stage 3.** Token → fresh Stripe Checkout session at click time |
| `src/pages/PublicInvoice.jsx` | The page |
| `src/components/invoice/PublicLinkControls.jsx` | View / copy / revoke / regenerate |
| `supabase/migrations/<ts>_public_invoice_links.sql` | §4 |

### Modified

| File | Change |
|---|---|
| `src/App.jsx` | A short `/i/:token` route beside the existing `/Login`, `/BookDemo` custom routes |
| `src/Layout.jsx` | Add the page to `publicPages` **and** `publicPaths` — miss either and the layout bounces the client to login |
| `supabase/functions/send-invoice-email/index.ts` | Link instead of attachment; see §6 |
| `supabase/functions/send-invoice-sms/index.ts` | Short link only |
| `supabase/functions/generate-invoice-pdf/index.ts` | Accept token auth as an alternative to `requireAppAccess` |
| `supabase/functions/create-invoice-payment-link/index.ts` | Left alone; the public path gets its own function rather than weakening this one's `requireAppAccess` |
| `src/pages/InvoiceDetail.jsx` (or equivalent) | Mount `PublicLinkControls` |
| `src/pages/PublicQuote.jsx` | Swap the two `sdk.entities` calls for `get-public-quote`; the §1.5 trap comment is already in place |
| `src/pages/ApproveQuote.jsx` | Point at the real function; add a catch-all so a missing function can never again look like a generic error |
| `src/pages/PublicBooking.jsx` | Swap the anon `BusinessSettings.filter` for `get-public-booking` |
| `src/api/sdk.js` | Register `approveQuote`; **add a catch-all to `handleFunctionInvoke`** so an unmapped name throws loudly instead of returning `undefined` (§1.7) |
| `src/config/plans.js` | Dev guard asserting `PLAN_FEES` matches `processingFee` |
| `src/components/invoice/chaseFollowUp.js` | **No change** (decision 6) — the view signal is recorded but inert |

I have **not** confirmed the invoice detail screen's filename — worth checking
before implementation.

### Sequencing

Quotes outrank invoices, per your reframing.

| Stage | Scope | Why here |
|---|---|---|
| **0** | `_shared/public-link.ts` + the migration | Everything else depends on it |
| **1** | PublicQuote + ApproveQuote | The dead funnel. Highest value, and it proves the pattern on the page that already has `public_id`, so no new token convention is needed to ship it |
| **2** | PublicBooking | Same anon-read fix, smaller blast radius |
| **3** | PublicInvoice + pay + Phase A email | The original brief; lands on a pattern already proven three times |
| **4** | Email Phases B → D | Gated on measurement, not on code |

The `§2.3b` fee fix is independent of all of it and should go first — it is
small, and it is currently overcharging every live account.

---

## 6. Email and SMS changes — phased (your decision 7)

Not a single change. Four phases, because this is the most revenue-critical
email in the product and the current plan has no way to measure whether a change
helped or hurt.

### Phase A — add the link, KEEP the attachment

Zero deliverability delta: the message keeps the same attachment profile it has
today, and gains a link. We get the hosted page, the pay flow and the `viewed`
signal with nothing at risk.

`send-invoice-email` today builds attachments from a data URL:

```ts
if (pdf_url && pdf_url.startsWith('data:application/pdf;base64,')) {
  attachments = [{ filename: `Invoice-${invoice_number}.pdf`, content: base64 }];
}
```

Phase A changes only `ctaUrl` — from `payment_link` to the hosted page — and
adds the invoice number, amount due and due date to the body as **text**, so a
non-clicker has the facts. The existing `payment_link` column is exactly the
pre-generated, 24h-expiring URL the brief warns about; it stops being what we
send, though the column stays for now.

The body copy still says *"A PDF copy is attached for your records"*, which
remains true throughout Phase A. It only becomes a lie in Phase D, and must be
rewritten there.

### Phase B — verify the sending domain (you check, not me)

This is a DNS/dashboard check I cannot do from the repo. Exactly what to look at:

1. **Resend → Domains** — the sending domain should read **Verified**, not
   "Pending". Note whether we send from a real domain or from
   `onboarding@resend.dev`; the latter cannot be authenticated at all and would
   make the rest of this moot.
2. **SPF** — a TXT record at the domain root containing `include:amazonses.com`
   (Resend sends via SES). Confirm there is exactly **one** `v=spf1` record —
   two is a hard fail — and that the total lookup count is ≤ 10.
3. **DKIM** — Resend shows the exact CNAME/TXT records to add. All should show
   as verified. This is the one that matters most for inbox placement.
4. **DMARC** — a TXT record at `_dmarc.<domain>`. If absent, that is the single
   biggest fixable placement problem. Start at `v=DMARC1; p=none; rua=mailto:…`
   so we get aggregate reports without risking rejection, then tighten to
   `p=quarantine` once the reports are clean.
5. **Return-Path / MAIL FROM alignment** — DMARC needs SPF or DKIM to *align*
   with the From: domain, not merely to pass. A pass on `amazonses.com` with a
   From: of our domain does not align.

Quick external check: send to a Gmail account, open **Show original**, and
confirm SPF / DKIM / DMARC all read PASS with DKIM signed by our domain.

### Phase C — instrument it

Wire Resend webhooks for `email.delivered`, `email.bounced` and
`email.complained` into a new `resend-webhook` function writing to an
`EmailEvent` table. Without this we are flying blind, and Phase D is unmeasurable.

Verify the webhook signature — this endpoint has to be public, so an unsigned
one is an open write.

### Phase D — drop the attachment, behind a flag

Only after A–C. Per-user flag (`BusinessSettings.email_attach_pdf`, default
true) so it rolls back instantly. Compare delivered / bounced / complained and
`view_count` between cohorts before changing the default.

The body copy must be rewritten here — the "a PDF copy is attached" sentence
becomes false, and the page's Download PDF button becomes the answer.

### Escape hatch (all phases)

`attach_pdf_to_email ?? Client.attach_pdf_by_default` — per-send override on top
of a per-client default, for the clients a contractor knows will never click.

### SMS

Link only. `/i/<uuid>` is 40 characters on a short domain, leaving room inside
one 160-character GSM-7 segment — worth holding to, since each extra segment is
another chance to be dropped.

**A2P 10DLC is not registered**, so US carriers will filter this aggressively,
link-bearing messages most of all. Nothing in the design may depend on an SMS
arriving: it is a convenience channel behind email, and the hosted page must be
fully reachable from the email alone.

## 7. View tracking

The brief's "contractor previewing their own link must not mark it viewed" needs
a rule that works when the viewer is anonymous by definition. Layered:

1. `PublicLinkControls` opens previews with `?preview=1`, and the function skips
   tracking when present. Sufficient for the honest path, trivially removable by
   anyone who reads the URL — which is fine, because the only person motivated
   to remove it is the contractor, and they would only be fooling themselves.
2. Ignore a hit whose `ip_hash` matches one seen on an authenticated session for
   the owning account in the last 24h.
3. Debounce: repeat hits from the same `ip_hash` inside 30 minutes advance
   `last_viewed_at` but not `view_count`, so a refresh is not an "open".

Status advances `sent → viewed` only; it must never move an invoice out of
`paid` or `overdue`.

---

## 8. Risk I am least confident about

Deliverability was my top risk and you have de-risked it by phasing, so it is no
longer the answer. The new one:

**That the three outages have a fourth sibling I have not found, and that the
reason nobody noticed is that nobody is watching.**

What bothers me is not any single broken page — it is the shared property. All
three failed *silently and plausibly*. "Quote Not Found", "Booking page not
found" and "An error occurred" are all screens a user would read as **their own**
mistake: a stale link, a typo, a bad moment. None of them logs anything a
contractor sees. The quote funnel could have been dead since the paywall
migration landed and the only symptom would be quotes that never get approved —
which reads as clients being slow.

So the count of three is a floor, not a total. It is what two hours of targeted
looking found, and my confidence that it is the complete set is low. Every place
the app renders something for someone who is not signed in is suspect, and there
is no test, no monitor and no error report covering any of it.

Concretely, before calling this done I would want:

- a sweep of every page in `Layout.jsx`'s `publicPages` array for the same two
  patterns — a direct `sdk.entities` read, or an `sdk.functions.invoke` name
  absent from `realEdgeFunctions`
- the catch-all in `handleFunctionInvoke` (§5), which converts the entire
  *class* of ApproveQuote's bug from a silent `undefined` into a loud failure,
  and is the single highest-value line in this plan
- one end-to-end test per public page that actually loads it with the anon key,
  since every one of these bugs is invisible to an authenticated session and
  therefore invisible to the person building it

The second-order risk I flagged before still stands: **a link that never expires
will outlive some contractors' Stripe accounts.** `can_pay_online` must be
re-derived from `stripe_account_status` on every load, never cached, because a
Pay button that 500s is worse than one that was never shown.

---

## 9. Status

### Done (step 1 of your order of work)

| Change | File |
|---|---|
| Catch-all no longer fabricates success | `src/api/sdk.js` |
| `check-functions.cjs` completed into a real guard | `check-functions.cjs` |
| `check-imports.cjs` false positives fixed, can now fail | `check-imports.cjs` |
| `npm run check` wired | `package.json` |
| Trap comment | `src/pages/PublicQuote.jsx` |

`npm run check` **fails right now**, on `approveQuote` only. That is correct: the
guard proves the bug before step 2 fixes it, and goes green when the function
exists.

### Answers to your two questions

**`check-functions.cjs` was neither "meant to and doesn't" nor "does and isn't
wired".** It did the input half correctly — walked `src/`, extracted every
invoke name — then `console.log`'d them and exited 0. It never compared the list
to anything. `approveQuote` was the **second line of its output**. It had been
printing the bug since the day it was written.

It is also wired into nothing, and there is **no CI at all** — no
`.github/workflows`, at the repo root or in `AxisBill/`. So `npm run check`
currently only runs when someone types it. Wiring CI is worth doing and is not
in this step.

**The two Enterprise accounts are both yours** — `billbetterofficial@gmail.com`
and your own address. **0 paid invoices, $0 platform fees ever charged.** No
customer was overcharged and there is nothing to refund. The fee fix costs
nothing.

### Remaining order of work

2. The three outages — ApproveQuote first
3. Fee fix (`_shared/plan-fees.ts` + CI test, not a console warning)
4. Invoice link work

### Open

Nothing. All eight decisions are settled.

### Deferred by decision

- `Client.attach_pdf_by_default` — revisit at Phase D
- SMS segment count — render a real message and count it; do not pre-optimise
  the column type
- `viewed` as a status value — rejected; `first_viewed_at` composes instead
