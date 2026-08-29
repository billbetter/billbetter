# Quote approval — closing the loop from client click to contractor control

Plan only. No code written, no migration applied, no function deployed.

The public approval path is built and works. What is missing is everything
*after* the click: the contractor cannot see who approved, cannot be notified
according to a preference they set, and cannot turn the capability off. There is
also no way for a client to decline at all.

This plan covers only that gap. Nothing in `PublicQuote.jsx`, `ApproveQuote.jsx`,
`get-public-quote`, `_shared/public-link.ts` or the two existing migrations is
rebuilt — the decisions recorded in their comments are treated as settled.

---

## 0. Decisions — settled

All answered. Recorded with the reasoning so a later reader does not reopen
them.

| | Decision |
|---|---|
| §0.1 | Decline writes **`declined`**. Fix the two readers; guard both spellings in the function anyway, since it is one `\|\|`. |
| §0.2 | **`BusinessSettings.notification_preferences jsonb`.** |
| §0.3 | `QuoteDetail`'s send sets `status: 'sent'` **first**, in the same commit as the guard tightening. |
| §6 | A manual flip stamps **`approved_at` only, never `approved_by_name`.** |

### 0.1 `declined`, not `rejected` — SETTLED

The app already uses two words for one state, and they never meet:

| Writes / reads `rejected` | Writes / reads `declined` |
|---|---|
| `PublicQuote.jsx:276` — the "this quote was declined" banner | `Quotes.jsx:281` — `statusConfig.declined` (badge colour + icon) |
| `approve-quote/index.ts:132` — "already declined" guard | `Quotes.jsx:297` — the Declined stat card count |
| | `Quotes.jsx:661` — the Declined filter option |
| | `Quotes.jsx:849` — the contractor's status dropdown writes `declined` |
| | `QuoteDetail.jsx:229,237` — badge colour + icon |

There is **no CHECK constraint on `Quote.status`** (verified against
`pg_constraint`), so both values write successfully and neither is validated.

This is not cosmetic. It produces a live bug today: a contractor who sets a quote
to Declined from the list writes `declined`; `approve-quote` guards only
`approved` and `rejected`, so **the client can still approve a quote the
contractor already declined**. See §0.3.

**The split is smaller than it looks, and there is nothing to migrate.**
A full grep of `src/` and `supabase/` finds exactly two places that read
`rejected` as a quote status — `PublicQuote.jsx:276` and
`approve-quote/index.ts:132` — and **zero that write it**. Every other match is
unrelated: `timeTracking.js:240` reads a `Promise.allSettled` result, and the
rest is comment prose. One site is already defensive:

```jsx
// Analytics.jsx:931 -- already counts both spellings
(q) => q.status === "declined" || q.status === "rejected",
```

So no backfill, no data migration, no dual-write window.

**Decided: decline writes `declined`.** It is the contractor-facing vocabulary,
it is what the status dropdown already writes, and "Declined" is the word shown
to humans. The two readers change, and both keep accepting `rejected` as a
synonym — one `||` each — so nothing that somehow holds the old value renders
wrong.

### 0.2 Notification preferences live on `BusinessSettings` — SETTLED

The brief says "preferences live on the user record as JSON". They do not live
anywhere. `notification_preferences` is not a column on any table in `public`
(checked against `information_schema.columns`), including `profiles`, which has
exactly `id, full_name, onboarding_completed, role, updated_at`.

**Decided: `BusinessSettings.notification_preferences jsonb`.** Three reasons:

1. `sdk.js:371` `saveNotificationSettings` already writes to `BusinessSettings`
   and already lists `notification_preferences` in its `allowed` array — it is
   the store the writer was built for.
2. **It costs zero extra lookups**, now or later. The functions that would gate
   a notification already hold the row: `approve-quote:142` and
   `send-invoice-email:69` both run
   `db.findOne('BusinessSettings', { user_id })` for branding. The preference
   rides on a row already in memory. `profiles` is the option that would *add*
   a query.
3. `profiles` is treated as optional by `sdk.auth.me()` — "Table doesn't exist
   yet or no profile row — that's okay" — so a notification decision resting on
   it would be resting on a row that may not exist. It also has only
   `id, full_name, onboarding_completed, role, updated_at`.

"Preferences live on the user record" described the broken **read** half
(`NotificationSettings.jsx:73` reads `currentUser.notification_preferences`),
not the intent. That read moves to the settings row.

The only future callers that would pay for a lookup are `stripe-webhook`, which
resolves the row by `stripe_account_id` rather than `user_id`, and
`confirm-and-activate`, which does not load it at all. Neither is gated in this
change.

### 0.3 `status === 'sent'` — and the outage hiding behind it

`get-public-quote:169` computes `can_approve: status === 'sent' && !expired`,
under a comment stating "the page never decides for itself whether an approval
would be accepted — approve-quote re-checks all of this."

It does not re-check all of this. `approve-quote:129-134` guards only `approved`
and `rejected`, so nothing stops a **draft** or a **declined** quote being
approved by a direct call. Tightening it to require `sent` is the obvious fix.

**Do not do that yet — it would make a live outage total.** Two send paths
exist and only one of them sets the status:

| Path | Sends | Sets `status: 'sent'` |
|---|---|---|
| `CreateQuote.jsx:792, :823` — save-and-send | SMS, then email | **yes**, after each success |
| `QuoteDetail.jsx:118-145` — Send from the detail page | SMS, then email | **no.** It sets `smsSuccess` / `emailSuccess` and never touches the row |

So a quote created as a draft and later sent from its detail page stays `draft`
forever. Today that means `can_approve` is **false** and the client opens the
link to a quote with **no Approve button on it** — while the emailed one-click
link still works, because `approve-quote` does not check `sent`. The looser
server guard is currently the only reason those approvals land at all.

**Decided, in this order and in the same commit:**

1. `QuoteDetail.jsx`'s send handler sets `status: 'sent'` on success, matching
   `CreateQuote.jsx`. This alone restores the Approve button for every quote
   sent from the detail page.
2. *Then* `approve-quote` moves to a positive guard — accepted only from
   `sent` — keeping the distinct `already_approved` answer the pages branch on.

They ship together because doing 2 without 1 turns a partial outage into a total
one: every emailed approval link for a detail-page-sent quote would start being
refused. This is the first thing built.

---

## 0.5 Build order

1. **The send-path fix** — `QuoteDetail` sets `status: 'sent'`, then
   `approve-quote` tightens to a positive guard. Same commit (§0.3). This is
   first because it repairs a live outage and everything after it assumes a
   quote actually reaches `sent`.
2. Migration file (§1) — written, not applied, until you say so.
3. The decline endpoint (§3) and the capability gate (§4).
4. The contractor's surfaces (§2.4) and the vocabulary fix (§0.1).
5. Notification preferences, end to end (§5).

---

## 1. Migration SQL

One new file: `supabase/migrations/20260828120000_quote_decline_and_gate.sql`.

Additive only. No column is dropped, no type changes, no RLS policy is touched.
Every default is a constant, so each `add column` is a catalogue update and
takes no table rewrite — unlike the volatile `gen_random_uuid()` default that
forced the three-step form in `20260825120000_public_invoice_links_a_add.sql`.

```sql
-- Record WHO declined a quote, WHEN, and optionally WHY.
--
-- Mirrors approved_by_name / approved_at from 20260826140000 rather than
-- reusing them. A single (responded_by, responded_at, outcome) triple would be
-- narrower, but it would make "was this ever approved and then declined?"
-- unanswerable, and a quote's history is exactly what the contractor needs in
-- a dispute. Separate columns keep both events.
--
-- decline_reason is optional and client-supplied free text. It is truncated in
-- the function before it reaches here; the column carries no length constraint
-- because a hard limit that fires at the database is a 500 the client cannot
-- act on.
alter table public."Quote"
  add column if not exists declined_by_name text,
  add column if not exists declined_at      timestamptz,
  add column if not exists decline_reason   text;

comment on column public."Quote".declined_by_name is
  'Name the decliner typed at the confirmation step. Free text and unverified --
   a record of what was asserted, not an identity claim. Mirrors
   approved_by_name.';

comment on column public."Quote".declined_at is
  'When the decline was accepted. Distinct from updated_at, which moves on any
   edit and therefore cannot answer "when did the client say no".';

comment on column public."Quote".decline_reason is
  'Optional short reason the client gave. Shown to the contractor only.';

-- Whether clients may approve or decline from a public quote link at all.
--
-- Default true: this is how the product behaves today, and a business-level
-- switch that silently changed the behaviour of links already in clients'
-- inboxes would be a worse default than the one it replaced.
--
-- boolean not null default true is a constant default, so this is a catalogue
-- update -- no rewrite, no ACCESS EXCLUSIVE hold on a table the app is reading.
alter table public."BusinessSettings"
  add column if not exists allow_client_quote_approval boolean not null default true;

comment on column public."BusinessSettings".allow_client_quote_approval is
  'When false, public quote links still render the quote but carry no Approve or
   Decline control, and approve-quote refuses both actions. Gates capabilities
   in get-public-quote AND is re-checked in approve-quote -- hiding the button
   alone would leave the endpoint open.';

-- Contractor notification preferences, as JSON on the row the settings writer
-- already targets.
--
-- Empty object rather than a seeded set of keys: absent means "not chosen", and
-- every reader treats absent as enabled. Seeding defaults here would mean a
-- contractor who never opened Settings has an opinion on record that they never
-- expressed, and changing a default later would not reach them.
alter table public."BusinessSettings"
  add column if not exists notification_preferences jsonb not null default '{}'::jsonb;

comment on column public."BusinessSettings".notification_preferences is
  'Per-notification opt-out map, e.g. {"quote_approved": false}. A missing key
   means enabled -- absent is "not chosen", never "off". Read by edge functions
   through _shared/notify-prefs.ts.';
```

**Not included, deliberately:** a CHECK constraint on `Quote.status`. It would
be safe today (one row, `approved`), and it would have prevented the
`declined`/`rejected` split from ever happening. But it is a behaviour change to
every write path in the app and belongs in its own change, after §0.1 lands and
the vocabulary is actually single. Flagging it as the obvious follow-up.

---

## 2. Files touched

### 2.1 Database and the client-side column allow-list

| File | Change |
|---|---|
| `supabase/migrations/20260828120000_quote_decline_and_gate.sql` | new — the SQL above |
| `src/api/entityColumns.js` | regenerate via `scripts/gen-entity-columns.py`. Adds `declined_by_name`, `declined_at`, `decline_reason` to `Quote` and `allow_client_quote_approval`, `notification_preferences` to `BusinessSettings`. **Without this the new columns do not come back from any query, whatever the database holds.** |

`approved_by_name` and `approved_at` are **already** in the `Quote` allow-list
(`entityColumns.js:44`) — no fix needed there.

### 2.2 The decline endpoint

| File | Change |
|---|---|
| `supabase/functions/approve-quote/index.ts` | add `action: 'approve' \| 'decline'`; §3 |
| `supabase/functions/_shared/notification-types.ts` | add `QuoteApprovedPayload`, `QuoteDeclinedPayload` |
| `supabase/functions/_shared/email-quote-responded.ts` | new — one template, two outcomes |
| `supabase/functions/_shared/notify.ts` | add `notify.quoteApproved` / `notify.quoteDeclined`, and the preference gate; §5 |
| `supabase/functions/_shared/notify-prefs.ts` | new — the single place a preference is read |
| `supabase/functions/get-public-quote/index.ts` | `can_approve` gains the settings gate; add `can_decline`; §4 |

### 2.3 The client's page

| File | Change |
|---|---|
| `src/pages/PublicQuote.jsx` | Decline button beside Approve, behind the same weight of confirm — typed name plus an optional reason. Reuses the existing confirm form shell, so the two paths cannot drift in look or in rigour. Reads `capabilities.can_decline`. Line 276's `"rejected"` becomes `"declined"` (accepting both). |
| `src/pages/ApproveQuote.jsx` | unchanged. It is the *approval* landing page from the emailed link; a decline arriving by email link is a separate decision and is not in scope. |

### 2.4 The contractor's side

| File | Change |
|---|---|
| `src/pages/QuoteDetail.jsx` | `quote.approval_date` → `quote.approved_at` at **both** dead sites (`:403` and `:478`). Render `approved_by_name` — "Approved by Dana Marchetti on 4 September" — and the decline equivalent with its reason. Handle the null-name case; §6. Set `status: 'sent'` in the send handler (§0.3 step 1) — currently it sends and never marks the quote sent, which is why its public link shows no Approve button. Add `declined` to `statusColors`/`statusIcons` if §0.1 goes the other way. |
| `src/pages/Quotes.jsx` | approved and declined rows show who responded, not just a badge. Table view and card view both (`:752` and `:941` are the two render paths). `handleStatusChange` stamps `approved_at` / `declined_at` on a manual flip and never a name (§6.1), and the dead `notifyQuoteApproval` invocation at `:164` is replaced with the real notification (§6.2). |
| `src/components/notifications/NotificationSettings.jsx` | include `notification_preferences` in the `saveSettings()` payload — today it is simply absent, §5.2 — and load it from the settings row rather than the user record. |
| `src/pages/Settings.jsx` | `allow_client_quote_approval` into `initialFormData` **and** a control in the `business` tab, next to invoice defaults. The key must exist in `initialFormData` or the whole settings save 400s on an unknown column. |
| `src/components/settings/SettingsHub.jsx` | extend the "Invoice defaults" card description, or add a sibling card pointing at the same `business` tab. No new top-level section. |

---

## 3. How decline shares approve's credential handling

**One function, two actions — not a sibling function.**

`approve-quote` gains `action`, defaulting to `'approve'` so every existing
caller is unchanged. Both actions run the *same* code before they diverge:

```
  parse body
  resolve credential   (approval_token, else public_id, else 400)
  require typed name   (>= 2 chars, else 400 needs_confirmation)
  look up the quote    (PostgREST filter + constant-time compare)
  refuse revoked links (public_link_revoked_at)
  refuse wrong status  (must be 'sent' -- §0.3)
  refuse expired       (expiry_date vs now)
  check the business gate (allow_client_quote_approval -- §4)
  ────────────── only here does approve differ from decline ──────────────
  write + notify
```

A sibling function would have to import that sequence and remember to call every
step in order. This shares it by construction: there is one path, and an action
selects a terminal branch. The existing sequence is not rewritten — the branch
is inserted below it.

Two consequences worth stating:

- The function name becomes slightly historical. It is kept because renaming
  would leave the old slug deployed and orphaned, and the `approveQuote` name in
  `sdk.js:303` is what the pages already call. A docblock line records why.
- `approve-quote:47-52` currently defines its **own** local copy of
  `tokensMatch`, duplicating the exported one in `_shared/public-link.ts:121`.
  Two constant-time comparators that must stay identical is one more than
  necessary. The local copy is deleted and the shared export imported.

The decline branch writes `status: 'declined'`, `declined_by_name`,
`declined_at`, `decline_reason` (trimmed, capped at 500 characters server-side),
and `updated_at`. The reason is optional; a decline with no reason is valid.

---

## 4. How the Settings toggle reaches `get-public-quote`

`get-public-quote` **already** loads the owning business at line 110:

```ts
const settings = await db.findOne('BusinessSettings', { user_id: String(quote.user_id) });
```

so the gate costs no extra query. The capabilities block becomes:

```ts
capabilities: {
  can_approve: allowsResponse && status === 'sent' && !expired,
  can_decline: allowsResponse && status === 'sent' && !expired,
  expired,
  can_download_pdf: ...,
}
```

where `allowsResponse` is `settings?.allow_client_quote_approval !== false`.

**`!== false`, not truthiness.** A missing settings row, or a row read before the
column existed, must mean *enabled* — the behaviour the product has today. Only
an explicit `false` turns it off.

`can_approve` and `can_decline` are separate fields even though they are
computed identically right now, because "clients may say no but not yes" is a
setting somebody will eventually ask for, and a page reading one flag for two
buttons would need changing on that day rather than a server that already sends
two.

**And it is re-checked in `approve-quote`.** The gate in `get-public-quote` only
decides what to render; the endpoint is reachable directly with a `public_id`
that any recipient of the link holds. `approve-quote` reads the same column from
the same row and refuses both actions when it is `false`. This means moving its
existing settings read (currently line 142, after the status checks, used only
for the business name) up above the write — one line moved, no new query.

A refusal returns a distinct reason so the page can say "this business is not
accepting online responses right now" rather than a generic failure — which is
true, actionable, and reveals nothing a person holding the link does not know.

---

## 5. Making the notification toggles real

### 5.1 Three separate breaks, not one

The brief suspected `approve-quote` bypasses `notify.ts`. It does — and fixing
only that would change nothing, because:

1. **`approve-quote:166` calls `sendEmail` directly**, so no preference is
   consulted. *(suspected)*
2. **`notify.ts` reads no preferences at all.** `deliver()` takes a recipient and
   sends. All seven `notify.*` call sites across `confirm-and-activate`,
   `send-invoice-email` and `stripe-webhook` send unconditionally. Routing
   through it does not gate anything today. *(not suspected)*
3. **The toggles are never saved.** `saveSettings()` at
   `NotificationSettings.jsx:113` posts four keys and
   `notification_preferences` is not among them. `togglePreference` sets React
   state only; a reload reverts every switch. *(not suspected)*

So all three need fixing, in that order of depth.

### 5.2 The shape

`_shared/notify-prefs.ts` — new, and the only place a preference is read:

```ts
export async function wants(userId: string, key: string): Promise<boolean>
```

resolving `BusinessSettings.notification_preferences` by `user_id` and returning
`prefs[key] !== false`. Absent means enabled, so a contractor who never opened
Settings keeps getting everything, and a key we add later does not arrive
silently switched off.

`notify.ts` gains `quoteApproved` and `quoteDeclined`, each taking `userId` and
consulting `wants()` before `deliver()`. The existing four are left alone in
this change — wiring them to preferences is the same mechanism but it touches
billing and payment mail, and that deserves its own decision.

The notification stays **best-effort and after the write**, exactly as
`approve-quote:162-203` has it now: the response is already committed, and a
Resend outage must never make the client think their click failed and try again.
A preference lookup that throws is caught and treated as "send" — failing toward
the contractor hearing about a $15k decision is the right direction.

### 5.3 What the contractor gets

`quote_approved` → the existing approval email, now gated.
`quote_declined` → a new one, carrying the typed name and the reason if given.
Both keep `replyTo: quote.client_email`, which `approve-quote:170` already
does and which is the right address: the reply to "your quote was declined" is
a conversation with the client.

---

## 6. Quotes approved before this change

There is exactly one quote in the live database:

```
QTE-962315   status=approved   approved_by_name=NULL   approved_at=NULL
```

It was approved by the contractor moving the dropdown in `Quotes.jsx`, not by a
client through `approve-quote`, so it has no record attached — and it never
will, because the information does not exist to backfill. **No backfill is
proposed.** Inventing an `approved_at` from `updated_at` would manufacture
evidence for exactly the dispute this record is meant to settle.

Both new surfaces therefore have to render the null case honestly:

- `QuoteDetail.jsx` — "Approved" alone when there is no name or date, never
  "Approved by undefined" and never a date derived from another column.
- `Quotes.jsx` — the badge alone, as today.

### 6.1 The manual flip — SETTLED

The contractor's dropdown in `Quotes.jsx` sets `status` and nothing else, so a
manually-approved quote has no date either.

**Decided: a manual flip stamps `approved_at`, and never `approved_by_name`.**

The whole evidentiary value of `approved_by_name` is that it is the *client's*
assertion — a name a person typed into a confirmation before committing to the
work. A contractor moving a dropdown has asserted nothing about the client. If
both wrote the same columns, the two records would render identically and the
one that survives a scope dispute would be indistinguishable from the one that
does not.

So the two surfaces must read differently, and the presence of
`approved_by_name` is what distinguishes them:

| | Rendered as |
|---|---|
| Client approved through the link | **"Approved by Dana Marchetti on 4 September"** |
| Contractor flipped the status | **"Marked approved by you on 4 September"** |

`approved_at` alone therefore means "marked approved", and `approved_at` with a
name means "the client agreed". No extra column is needed to tell them apart.

The same rule applies to the decline side: a contractor setting Declined stamps
`declined_at` only.

### 6.2 A dead notification on the manual path

`Quotes.jsx:164` passes an `approval_date` field to
`sdk.functions.invoke("notifyQuoteApproval", ...)`. It is a payload field, not a
column read — but the function does not exist. `sdk.js:445` routes
`notifyQuoteApproval` to `notImplemented`, and the caller only `console.log`s
the result, so **a manual approve from the list notifies nobody and reports
success in the console.**

Low severity, same feature, swept up here: the manual path calls the same
`notify.quoteApproved` the client path does, gated by the same preference, and
the dead `notifyQuoteApproval` invocation is deleted rather than left looking
like it works.

---

## 7. What you need to run

In order, after the plan is approved and the code is written:

1. `python scripts/apply-migration.py supabase/migrations/20260828120000_quote_decline_and_gate.sql`
2. `python scripts/gen-entity-columns.py` — regenerates `src/api/entityColumns.js`. Must run *after* the migration or the new columns will be missing from the allow-list.
3. `python scripts/deploy-functions.py approve-quote get-public-quote` — both, because they now share `_shared/notify-prefs.ts` and `_shared/notify.ts`. Deploying one alone leaves the gate half-applied.
4. `python scripts/test-function-boots.py` — the deploy script reports upload success, not boot success. A duplicate `const` across concatenated `_shared` files is a `SyntaxError` that only shows here.
5. `npm run check`
6. `python scripts/test-public-quote.py` and `python scripts/test-public-parity.py` — invoice/quote parity must survive the capabilities change.

Nothing here needs a dependency. No new package is proposed.

---

## 8. Risks

- **The vocabulary decision leaks.** If §0.1 is answered `rejected` instead, the
  edit list grows by `Quotes.jsx` (four sites) and `QuoteDetail.jsx` (two), and
  the contractor's status dropdown starts writing a word the UI does not have a
  colour for. This is the one decision that changes more than a line.
- **`notification_preferences` is in `sdk.js:383`'s `allowed` array but is not a
  column.** Until the migration runs, any caller that passes it makes the entire
  notification-settings save fail with a PostgREST `42703` — the whole request,
  not the one key. The migration must land before the `NotificationSettings.jsx`
  change ships, not alongside it.
- **The public page is the client-facing screen.** The decline form is a second
  input on a page that has to work on an old Android phone. Same components,
  same tokens, no new colour scale, and the reason field is optional so a slow
  keyboard is never between a client and the button.
