# Feature audit — what this product actually does

Every claim traced to code. **Traced, not run** — reading is dispositive when the
code plainly does not contain the thing; live proof is for when the code *claims*
to do it and might still fail (the `approve-quote` case, where the bug was in a
shared helper only a real run could surface).

Three states:

- **WORKS** — traced to real, reachable implementation
- **PARTIAL** — something real exists, but the claim overstates it
- **ABSENT** — no implementation

Written for one purpose: **the pricing page gets rebuilt from this table.**
`STRIPE_PRICES_UPDATED` stays `false` until it is settled.


---

## 0. LAUNCH GATE — the AI claim is unproven

The copy sweep made the marketing honest **except for AI**, which is
honest-*pending-key*. `invoke-llm` exists, is deployed, and currently returns
`not_configured` on every call. So "AI invoice & quote generation" is still a
false claim on the pricing page today.

This was deliberately NOT reworded — the decision was build, not describe away —
but the code existing is not the same as the claim being true. Four boxes, and
the claim is unproven until all four are ticked:

- [ ] **`LLM_API_KEY` set** in Supabase secrets
      (`npx supabase secrets set LLM_API_KEY=... --project-ref rcymevdxsizstnopqeow`)
- [ ] **A real generation verified end to end** — describe a job in
      CreateInvoice, get line items that reflect what was typed
- [ ] **The retry path verified** — currently unrun. `complete()` retries once
      with the validation errors fed back; that branch has never executed
      against a live provider
- [ ] **The default model id confirmed callable by that key** — `_shared/llm.ts`
      defaults to `claude-sonnet-5`; a key without access to it fails at the
      provider, not here

Until then, treat every AI bullet on the pricing page as PARTIAL, not WORKS.

---

## 1. AI was a hardcoded stub — now built, not yet proven

`src/api/sdk.js:589`

```js
async function invokeLLM({ prompt, response_json_schema }) {
  console.log("[LLM Stub] Prompt received, returning generic line items");
  const items = [
    { description: "Labor", quantity: 4, rate: 85 },
    { description: "Materials", quantity: 1, rate: 240 },
  ];
  return { items };
}
```

The prompt is **ignored**. Every AI feature in the product returns
`Labor ×4 @ $85` and `Materials ×1 @ $240`, always, regardless of what the
contractor typed, said, or photographed.

Six call sites depend on it:

| Call site | Feature sold as |
|---|---|
| `CreateInvoice.jsx:791` | AI invoice generation (**Core**) |
| `CreateQuote.jsx:623` | AI quote line items (**Core**) |
| `CameraAnalyzer.jsx:73` | AI estimate from a photo (**Core**) |
| `GlobalVoiceAssistant.jsx:106` | Voice-to-invoice dictation (**Core**) |
| `QuickBillFlow.jsx:214` | Quick bill |
| `JobExpensesTab.jsx:223` | AI receipt scanner (**Essential**) |

AI is the product's stated differentiator — the `permissions.jsx` docblock calls
it "the one thing that makes this different from a PDF template" and puts it on
Core for that reason. It does not exist.

---

## 2. Plan bullets

### Core — $24

| Claim | State | Evidence |
|---|---|---|
| 30 invoices or quotes/month | **PARTIAL** | Enforced, but client-side only and from a stale column — see §4 |
| AI invoice & quote generation | **BUILT, UNPROVEN** | Real `invoke-llm`. Blocked on §0's launch gate — do not treat as WORKS until all four boxes are ticked |
| Voice-to-invoice dictation | **BUILT, UNPROVEN** | Transcription was always real (`GlobalVoiceAssistant.jsx:25`); the parse now goes to `invoke-llm`. Same §0 gate |
| Online card payments via Stripe | **WORKS** | `create-invoice-payment-link` + `stripe-webhook`, Connect wired |
| Job tracking with before/after photos | **WORKS** | Since the `uploads` bucket and real `uploadFile()` landed. Was ABSENT before that — the old stub returned a `blob:` URL that died on reload |
| Email & SMS delivery | **WORKS** | `send-invoice-email` / `send-invoice-sms`, real Resend + Twilio |
| ~~Automated overdue reminders~~ → **One-tap overdue reminders (friendly → firm)** | **WORKS** as now worded | Reworded, not removed: the manual chase is real — escalating copy from `chaseFollowUp.js`, sent through Resend/Twilio. Only the word "automated" was false |

### Essential — $49

| Claim | State | Evidence |
|---|---|---|
| 100 invoices or quotes/month | **PARTIAL** | Webhook writes **75**, not 100 (§4) |
| ~~Recurring invoices~~ | **REMOVED from the bullet list** | No honest rewording existed — a saved schedule that nothing ever acts on is not a feature under any name, and there was no manual "generate now" either. The templates remain (they hold client, line items and cadence, so they become real when the scheduler lands), and the page now says automatic billing is not running. Returns to the pricing page when it does |
| Expense tracking + AI receipt scanner | **PARTIAL → BUILT, UNPROVEN** | Expense tracking was always real; the scanner now goes to `invoke-llm` with the RECEIPT_SCAN schema. Same §0 gate |
| Time tracking & job costing | **WORKS**, dormant | Built and working; switched off by request |
| Analytics dashboard & profit per job | **WORKS** | Real aggregation over real rows |
| Full job tracking | **WORKS** | |
| Your logo & colours on every PDF | **WORKS** | `InvoiceDocumentComplex.jsx` renders a logo block via `@react-pdf/renderer` |
| Google Calendar two-way sync | **WORKS** (unverified live) | Four functions exist: `auth-url`, `callback`, `sync-job` (app→Google), `events` (Google→app). Both directions present. Not exercised end to end |

### Professional — $99

| Claim | State | Evidence |
|---|---|---|
| 300 invoices or quotes/month | **PARTIAL** | Webhook writes **250** (§4) |
| 0.75% platform fee | **BROKEN** | Webhook writes `fee: 1`. Charged 1% — see §4 |
| Crew management, roles & permissions | **WORKS**, dormant | |
| Up to 4 crew members | **WORKS**, dormant | |
| Smart Insights (AI analytics) | **PARTIAL** | `SmartInsights.jsx` makes **zero** LLM calls. The insights are real, rule-based heuristics — genuinely useful, just not AI |
| Custom PDF templates | **WORKS** (unverified live) | `CustomTemplatePreview`, `TemplateDialogs`, `TemplatePreviewModal` + `InvoiceTemplate` entity |
| Material pricing & supplier comparison | **ABSENT** | `searchProductPrices` has **no callers** outside its own stub; no PriceComparison page exists |
| Public booking page for clients | **ABSENT** | Page dies on an anon RLS read, and `createBooking` was a stub that invented a `booking_id` |
| Priority support | n/a | Not software |

### Enterprise — $199 — RETIRED

This tier no longer exists. The audit below is why it was cut: all three of its
software differentiators were unimplemented, so what $199 bought over $99 was a
transaction cap that was being written wrong and a fee that was not being
applied.

Existing rows alias to Professional and keep their stored allowance. The four
flags it declared (`white_label`, `advanced_permissions`, `dedicated_support`,
`api_access`) were deleted rather than left declared — per the rule below, a
flag nothing reads is worse than no flag, because it reads as enforcement.

**Recorded as unbuilt**, in case any of it is ever wanted: white-label branding,
granular per-role permissions, and a public API with key issuance. None was ever
started; there is no partial work to resume.

| Claim | State | Evidence |
|---|---|---|
| 750 invoices or quotes/month | **PARTIAL** | Webhook writes **500** (§4) |
| 0.5% platform fee | **BROKEN** | Charged 1% — double the advertised rate (§4) |
| White-label — no Invoicium branding anywhere | **ABSENT** | `white_label` appears **nowhere** outside the permissions table. Zero implementation |
| Up to 19 crew members | **WORKS**, dormant | |
| Advanced granular permissions | **ABSENT** | `advanced_permissions` never read |
| API access | **ABSENT** | No API surface, no key issuance, no docs |
| Dedicated account manager | n/a | Not software |

**Enterprise's entire software differentiation is absent.** Every one of
white-label, advanced permissions and API access is unimplemented. What an
Enterprise subscriber gets over Professional today is a higher transaction cap
(which is written wrong) and a lower fee (which is not applied).

---

## 3. The root cause: there is no scheduler

Three sold features fail for one reason.

| Feature | Needs |
|---|---|
| Automated overdue reminders | a recurring sweep |
| Recurring invoices | a recurring sweep |
| Automatic review requests | a delayed job |

`pg_cron` **is installed**. Exactly one job exists: `stripe-sync-worker`.

`check-overdue-invoices` cannot be retrofitted — it opens with
`requireAppAccess(req)` and `getUserFromAuthHeader(req)`, so it needs a user's
JWT, which a cron job does not have. It is also single-user
(`user_id=eq.<caller>`) and it only relabels `sent` → `overdue`; it contains no
send path at all.

Building the scheduler is **one piece of infrastructure that unlocks three
things already being sold**, which is why it outranks the invoice-link work.

Scope: `verify_jwt = false` service-role runner, a job registry, idempotency keys
so a pg_cron double-fire cannot double-send, per-user notification-setting
checks before sending in the contractor's name, and a `pg_cron` entry beside
`stripe-sync-worker`.

---

## 4. The stale-column bugs have one source

Not drift over time — **the webhook is actively writing wrong values today.**

`supabase/functions/stripe-webhook/index.ts:12`

```ts
const PLAN_LIMITS: Record<string, { transactions: number; fee: number }> = {
  free:         { transactions: 10,  fee: 0 },
  core:         { transactions: 30,  fee: 1 },
  essential:    { transactions: 75,  fee: 1 },
  professional: { transactions: 250, fee: 1 },
  enterprise:   { transactions: 500, fee: 1 },
};
```

Against `src/config/plans.js`:

| Plan | Webhook writes | plans.js says | Effect |
|---|---|---|---|
| essential | 75 txn, 1% | 100 txn, 1% | capped 25 short |
| professional | 250 txn, **1%** | 300 txn, **0.75%** | capped 50 short, **overcharged** |
| enterprise | 500 txn, **1%** | 750 txn, **0.5%** | capped 250 short, **charged double** |

`confirm-and-activate` carries a mirrored copy with the same values.

Both live subscriptions show `monthly_transaction_limit: 500` and
`payment_processing_fee: 1` — exactly what this table writes.

### Answering the `fixSubscriptionLimits` question

You asked whether anything server-side reads `monthly_transaction_limit`, because
if so the button was the only thing correcting it.

**Nothing server-side reads it.** The edge functions only ever *write* it. It is
read in four places, all client-side, and all bypassing the helper built to
defeat exactly this staleness:

- `CreateInvoice.jsx:905, 936, 1092, 1385`
- `CreateQuote.jsx:513, 707, 709`

They read `subscription.monthly_transaction_limit` raw instead of calling
`getTransactionAllowance()`, whose docblock explains it exists because "stored
values go stale when the ladder is rebalanced and nothing rewrites them."

So the fix is two-part, and then the button goes:

1. `stripe-webhook` and `confirm-and-activate` write correct values — ideally
   from one shared `_shared/plan-limits.ts` rather than a third and fourth copy.
2. `CreateInvoice` / `CreateQuote` call `getTransactionAllowance()`.

You were right that the fix belongs in the webhook, not a button.

---

## 5. Feature flags: 4 of 35 gate anything, and 2 of those are dormant

An earlier pass of this document said "24 of 35 are never read". **That
understated it.** It matched the key as a quoted string anywhere in a file,
which is not the same as the key being used as a gate. Three of the eleven
"read" keys were coincidences:

| Key | Where it "appeared" | What it actually was |
|---|---|---|
| `expenses` | `JobDetailView.jsx` | a tab name — `setActiveTab("expenses")` |
| `google_calendar` | `Calendar.jsx` | an event type — `type: "google_calendar"` |
| `jobs` | `JobHeatmap.jsx` | a chart data source — `useState("jobs")` |

The honest count: **exactly four keys gate functionality anywhere in the app.**

| Key | Where it gates | Live? |
|---|---|---|
| `crew_management` | Layout nav + `Team.jsx` FeatureGate | **No — dormant** |
| `time_tracking` | Layout nav + `Timesheet.jsx` FeatureGate | **No — dormant** |
| `recurring_invoices` | `RecurringInvoices.jsx` | Yes, but gates a feature that does not generate anything |
| `excel_export` | `Dashboard.jsx:370` | **Yes** |

Six more (`basic_invoicing`, `quotes`, `client_management`, `analytics_dashboard`,
plus the two dormant ones) decide which chapters of the onboarding tour appear.
That is content, not entitlement — skipping a tour slide is not a paywall.

**Only three pages in the entire product call `FeatureGate`**, and two of them
are the dormant ones.

So the plan ladder is very close to unenforced. Analytics, Smart Insights, the
PDF theme editor, custom templates, expenses, Google Calendar and job costing
are all reachable on Core today. What actually differentiates a paid tier right
now is the **transaction allowance** (checked in CreateInvoice/CreateQuote via
`getTransactionAllowance`), the **platform fee**, and **Excel export**.

### Two categories worth naming

> **A feature flag is not enforcement until a call site reads it — verify the
> read, not the declaration.**

> **Correctness by accident.** Code that produces the right answer for a reason
> nobody chose, and stops the moment the surrounding conditions shift.
>
> The example: `getTransactionAllowance()` returned `-1` for unlimited, and
> `limit + additionalInvoices` on an unlimited plan therefore evaluated to
> `-1 + 5 = 4` — a *smaller* allowance than the tier below it. It never bit
> because every call site happened to guard with `limit > 0` first. Nobody
> designed that protection; it was incidental, and one new call site written
> without the guard would have silently capped an unlimited customer at four
> invoices. Fixed by returning `Infinity`, so the arithmetic is right with no
> guard at all.
>
> Related: the inline `response_json_schema` objects declared `properties` and
> no `required`, so `{}` validated. The validation looked like protection and
> asserted nothing. Same theme as the flags above, and as the two checkers that
> could never fail or always failed — **the thing that looked like protection
> wasn't.**

`permissions.jsx` was rewritten *because* of this exact failure. Its docblock
says Enterprise's flags "were sold on the pricing page and enforced nowhere."
The values were corrected; nothing was checked for whether anything read the new
table. All four Enterprise keys are still read by nothing.

The rewrite made an unenforced table tidier and called it a fix. That is a
sharper trap than the original bug, because the table now *looks* authoritative
— it is well-organised, single-source, and documented, and it still governs
nothing. A correct declaration reads as done.

---

## 6. What this means for the ladder

`STRIPE_PRICES_UPDATED` must stay `false`.

The $39 → $49 Essential rise was justified by moving Google Calendar and PDF
branding down. Both of those do appear to work — that part of the reasoning
holds. But Essential also headlines **Recurring invoices**, which has never
generated an invoice, and its AI receipt scanner is the stub.

Professional's Material pricing and Public booking are both absent. Enterprise's
three software differentiators are all absent.

Honest count of what is genuinely delivered per tier:

| Tier | WORKS | BUILT, UNPROVEN (§0) | PARTIAL | ABSENT |
|---|---|---|---|---|
| Core | 4 | 2 | 1 | 0 |
| Essential | 5 | 1 | 0 | 0 |
| Professional | 2 (+2 dormant) | 0 | 1 | 2 |

Both remaining ABSENT bullets — material pricing and public booking — were
pulled from Professional. A bullet goes on the page when a feature is PROVEN,
not when it is planned; "we'll fix it soon" is how most of the claims in this
document came to be written.

**Material pricing is a candidate to cut permanently, not defer.** It needs a
SerpAPI key and carries a per-search cost forever — a second paid vendor, for a
capability nobody buys invoicing software to get. It should need a reason to
build, not a reason to skip.

**Public booking** stays in the fix queue behind the same dead-public-surface
pattern as PublicQuote, and earns its bullet back when it demonstrably works.

---

## 7. Not yet traced

Stated so the gaps are visible rather than implied:

- Google Calendar two-way sync and Custom PDF templates are marked WORKS from
  code structure, not from a live run
- Review-request automation traced far enough to know no function exists; the
  toggle's full behaviour not mapped
- The Custom tier's bullets ("Enhanced AI features", "Website design") are
  negotiated per contract and not auditable here — though "Enhanced AI features"
  inherits §1
- Transaction-limit enforcement is client-side only; a determined user could
  bypass it via the anon key. Not audited as a security matter here

---

## 8. Found while building the public document surface

Recorded here rather than acted on, per the rule that a bug found mid-task gets
written down and does not reprioritise the task. Two of these were fixed in
passing because the work could not proceed around them; the rest are open.

### 8.1 FIXED — a bundle that fails to boot deploys as "OK"

The worst of the batch, because it is silent.

`scripts/deploy-functions.py` does not bundle with a module system. It
CONCATENATES each `_shared` file into the entry file's top-level scope and
strips the import lines. So two files that each declare `const APP_URL` produce
two `const APP_URL` declarations in one scope — a SyntaxError, and the function
never starts.

That is exactly what happened when `send-invoice-email` and `send-invoice-sms`
began importing `_shared/stripe-session.ts`. Both went to 503 `BOOT_ERROR` in
production. **The deploy script printed `OK` for both**, because the upload
succeeded and nothing in the pipeline distinguishes a function that deployed
from one that runs.

Fixed two ways: the value now lives once in `_shared/app-url.ts`, which makes
the collision impossible rather than merely absent; and
`scripts/test-function-boots.py` now calls every function and asserts it answers
with its OWN response (a 404 for a bogus token, a 401/403 from the paywall)
rather than a boot error. That probe is what caught it, after the deploy had
already claimed success.

> **A deploy that reports success is not evidence the code runs.** Anything that
> only checks the upload is checking the wrong end of the pipe.

### 8.2 FIXED — the deploy list had silently drifted from the source tree

`approve-quote`, `invoke-llm` and `accept-crew-invite` all had source on disk
and were live on the project, and **none of them was in `FUNCTIONS`**. Running
the deploy script would not have redeployed them, so any change to `_shared/`
would have reached every other function and not those three. Nothing would have
failed; they would just have stayed quietly on an older bundle.

The same script also exited 0 after printing `FAILED` for an upload, so a broken
deploy looked like a clean one to anything scripting it.

Both fixed, plus `check_for_drift()`, which refuses to run if a function
directory exists that the list does not know about — or vice versa.

### 8.3 OPEN — every invoice row carries its PDF as base64, and lists select `*`

`Invoice.pdf_url` does not hold a URL. It holds the whole PDF inline as a
`data:application/pdf;base64,…` string. Measured on the live table: 22 kB for
one invoice, 27 kB across three.

`src/api/localDataEngine.js:282` issues `select("*")`, so **every list read
downloads every stored PDF**. At the current three invoices this is invisible.
At the 300/month Professional allowance it is roughly 6.6 MB pulled on each
visit to the Invoices page after a single month, growing linearly and forever —
nothing prunes it.

Worked around rather than fixed: `get-public-invoice` never puts `pdf_url` in
its payload, and serves it only through a separate `download_pdf` action, so the
blob crosses the wire when somebody clicks and not before. The underlying
storage decision is untouched, and the fix is Supabase Storage plus a real URL
column.

### 8.4 OPEN — the live Stripe connected account is `restricted`

`BusinessSettings.stripe_account_status` reads `restricted`, not `active`, on
the only account in the database — with a LIVE `sk_live_…` key.

Consequences today: the public invoice page correctly hides its Pay button,
`pay-public-invoice` correctly refuses with 409 `not_connected`, and
`create-invoice-payment-link` refuses too. Everything behaves properly; there is
simply no account able to take money.

This also means the **successful payment branch is unproven end to end**. It
cannot be proven without a test-mode key or an active connected account, and a
live key plus a restricted account is the one combination where neither is
possible. Stated rather than glossed: `scripts/test-public-invoice.py` asserts
the refusal, and the success path has never executed.

### 8.5 CORRECTED — the planned migration could not have run

`docs/invoice-links-plan.md` §4 writes the backfill as a `DO` block with
`COMMIT` between batches. Probed directly against this project:

```
do $$ begin insert into _probe values (1); commit; end $$;
ERROR: 2D000: invalid transaction termination
```

The Management API's `/database/query` endpoint wraps whatever SQL it is sent in
a transaction, so nothing inside it can commit — a `CALL` to a procedure fails
for the same reason. Per-batch commits are therefore impossible from inside the
SQL, and every batch would have held its locks until the last one finished,
which is the precise thing batching exists to prevent.

Corrected to three migration files plus `scripts/backfill-public-tokens.py`,
which drives one batch per HTTP request — so each batch really is its own
transaction. The three-step form was kept at 3 rows deliberately, because this
migration is the one somebody copies onto a large table later.

### 8.6 CORRECTED — the rate limiter counted nothing

`_shared/public-link.ts` exposes `isRateLimited()`, `get-public-invoice` called
it on every request, and it never once returned true. `PublicLinkHit` was only
written on a FAILED lookup, so the happy path fed the limiter nothing and the
count was always zero. Thirty-eight consecutive requests all returned 200.

It existed, it was wired in, and it limited nothing — the same shape as the two
checkers, the ungated feature flags and the schemas with no `required`.

Fixed by recording every request before any branch.
`scripts/test-public-rate-limit.py` now asserts a 429 actually arrives (it fires
at request 32 against a limit of 30) and also that it does not fire absurdly
early, since a limiter that rejected the second request would pass a naive
"does it 429?" test while breaking every real page load.

### 8.7 CORRECTED — `PublicLinkHit.invoice_id NOT NULL` broke the limiter's only real use

The plan made `PublicLinkHit` the rate-limit store AND gave `invoice_id` a
`NOT NULL` foreign key. Those requirements conflict: a request carrying an
unknown token has no invoice to reference, so it could not be recorded, so it
could not be counted — and the caller a rate limit is actually FOR is the one
hammering the endpoint with tokens that do not resolve. As specified, it would
have throttled only legitimate viewers.

The rejected alternative was an in-memory counter for the unknown case. Deno
edge functions run per-isolate with no shared memory, so that limits nothing
across invocations while looking exactly like a rate limit in the source.

`invoice_id` is now nullable; a null means "token matched nothing". Every read
that reports views filters on it.

---

## 9. Step 6: quotes ported, booking is not a port

Step 6 was "port the pattern to PublicQuote and PublicBooking — both are dead in
production and it's the same mechanism". That is true of PublicQuote. It is not
true of PublicBooking, and the difference is worth being precise about.

### 9.1 FIXED — quotes had no credentials at all

PublicQuote was believed dead because anonymous reads resolve to empty under
RLS. It is deader than that: **nothing in the application has ever written
`public_id` or `approval_token`.**

`src/pages/CreateQuote.jsx:681` builds `quoteData` from `formData` plus six
explicit fields. Neither credential is among them. The only place either string
appears with a value is `src/entities/seedData.js`, which is local demo data.
Verified on the live database — `select count(*) from "Quote"` returns 0, and
the columns have no default.

Two consequences that were invisible because they compounded:

- `QuoteDetail.jsx:263` computed `quote.public_id ? url : null`. With
  `public_id` always null the link was never rendered, so **the page was
  unreachable even by its owner** — and the variable holding the URL was never
  read anywhere in the file either, so the share UI did not exist at all.
- `approve-quote` looks up by `approval_token`. It works; there has simply never
  been a row for it to find. Every "the quote approval flow is broken" symptom
  had this underneath it.

Fixed at the database, not in the client: both columns now default to
`gen_random_uuid()::text`. A credential that exists only if one code path
remembers to create it is a credential that goes missing, which is exactly what
happened. Adding a default to an existing column is a catalogue update, so no
rewrite — unlike creating column and volatile default together, which is what
forced the three-step form on `Invoice.public_token`.

### 9.2 FIXED — the branding trap, caught before it became a leak

`PublicQuote.jsx` read `BusinessSettings.list()` and took `[0]` — the first row
in the table, not the row belonging to the quote's owner.

Under the old RLS that read returned `[]`, so the bug was dormant and the page
merely showed "Quote Not Found". **Moving the read behind a service role is
precisely what would have woken it up**, because the service role bypasses RLS:
`list()` would have started returning rows and `[0]` would have shown one
contractor's client another contractor's business name, logo, address, phone
and tax details. Porting the pattern without noticing would have converted a
dead page into a cross-tenant branding leak.

`get-public-quote` resolves settings by `quote.user_id`. There is no `list()`
call in it.

Proven in both directions rather than reasoned about.
`scripts/test-public-quote.py` creates a second settings row owned by a
different user, then asserts the payload carries the OWNER's name and does not
contain the decoy's. Confirmed separately that PostgREST's unordered `list()`
returns the decoy first, so the `[0]` bug would have failed this assertion:

```
list() order with both rows present: ['That Guy', 'ZZ-TEST-OWNER-A']
list()[0] would have been: 'That Guy'
```

### 9.3 NOT DONE — PublicBooking is an unbuilt feature, not a dead page

Deliberately not ported, and deliberately not given a `get-public-booking`
function. Building one would have made the page load and render branding while
remaining incapable of taking a booking — a facade, and the same
looks-like-it-works pattern this document exists to catch.

The anon-RLS problem is not what is stopping it. Four things are, and only the
last is the one the pattern addresses:

| # | Missing | Evidence |
|---|---|---|
| 1 | `BusinessSettings.booking_slug` — **the column does not exist** | PostgREST: `42703 column BusinessSettings.booking_slug does not exist`, against a control query on `business_name` that returns 200 |
| 2 | `BusinessSettings.available_hours` — also does not exist | same probe |
| 3 | `getAvailableSlots` | returns `notImplemented` (`src/api/sdk.js:482`) |
| 4 | `createBooking` | returns `notImplemented` (`src/api/sdk.js:490`) |

`PublicBooking.jsx:61` filters on `booking_slug`, so the page 400s before it
ever reaches an RLS decision. It has never worked, and no amount of
service-role resolution changes that. A working booking page needs the two
columns, a slot-computation function built on `google-calendar-events`, a
booking-creation function, and a connected Google Calendar. That is a feature,
and it should be scoped as one.

### 9.4 OPEN — typing a booking URL breaks the entire Settings save

Found while establishing 9.3, and it is live and user-reachable today.

`src/pages/Settings.jsx:459` builds its payload as `{ ...formData }` — a full
spread. `src/components/settings/CalendarSettings.jsx:206` renders an input
bound to `formData.booking_slug`, and line 61 writes `formData.available_hours`.
**Neither column exists**, and PostgREST rejects the whole PATCH rather than
ignoring the unknown key.

Neither key is in `initialFormData`, and neither can arrive from a fetched row,
so the bug is dormant until somebody touches one of those two controls. From
that moment their next save fails — and it fails for *every* setting on the
page, not just the booking ones, reporting only "Failed to save settings.
Please try again."

Two candidate fixes, and they are not equivalent:

- **Add the columns.** Correct if booking is going to be built (9.3), and it
  makes the existing UI honest.
- **Strip unknown keys before the PATCH.** Fixes this class of bug permanently
  rather than this instance of it — and this is the second time this exact
  failure has occurred.

Not fixed here, because it is not step 6.

---

## 10. OPEN — what cannot be proven from this session

The public document surface is not "done" while any of these is unticked. They
are listed separately from the rest of this document because none of them is a
code problem: each needs an account, a credential or a device that only the
owner has.

- [ ] **A successful payment.** Never executed, not once. `STRIPE_SECRET_KEY` is
      a LIVE key and the only connected account reads `restricted`, so the only
      reachable branch is the refusal — which IS asserted (409 `not_connected`,
      and the page correctly hides its Pay button). Proving the success branch
      needs a test-mode key or an active connected account.
      **Needs: a working Stripe account.**
- [x] **The rendered email body.** DONE -- one real invoice was sent and the
      delivered HTML read back from Resend by id. See section 11. One finding
      came out of it and was fixed (11.1: the email invited a reply it could
      not receive).
- [ ] **The page on a real phone.** Every assertion here is headless Chrome at a
      desktop viewport. Nothing has been seen on an actual handset, which is
      where most clients will open these links.
      **Needs: a phone.**
- [ ] **Email landing in an inbox.** Deliverability is untested and Phase B of
      the plan (SPF / DKIM / DMARC, Resend domain verification) is a
      dashboard-and-DNS check that cannot be done from the repo. Until it is
      done, "the client got the link" is an assumption.
      **Needs: Resend domain auth.**

Two others, already recorded above, that also stay open:

- §0's four AI launch-gate boxes — unchanged, still all unticked.
- §8.3 `pdf_url` — the cheap half is done (list queries no longer select it, so
  the per-page-load download of every stored PDF is gone). The real fix, moving
  the bytes to Supabase Storage, is untouched. Cheapest before there is data.

### 10.1 Found while proving the above, not chased

Driving the real CreateQuote page surfaced two console errors that have nothing
to do with this work:

```
Error fetching suggestions: TypeError: Cannot read properties of undefined (reading 'toLowerCase')
Edge function sendQuoteSMS failed: Authenticate
```

The first is a live client-side crash in the line-item suggestion lookup. The
second is a Twilio auth failure on quote SMS — the same class as the A2P
registration gap noted in the invoice-links plan. Neither was investigated.

---

## 11. The email was sent, and what it showed

One real invoice email was sent through `send-invoice-email` and then read back
from Resend's API by id, so what follows is the HTML that actually left the
building rather than what the source suggests it would be.

`scripts/test-send-invoice-email.py` sends it;
`scripts/inspect-sent-email.py <id>` reads any sent message back.

| | |
|---|---|
| From | `noreply@invoicium.ca` — a real verified domain, not `onboarding@resend.dev` |
| Subject | `Invoice #INV-505305 from That Guy — $580.00 due` |
| Resend status | `delivered` |
| Links in the body | exactly one |

**§10's "rendered email body" box is ticked.** The rest of §10 is unchanged.

### What is right

- **One link, and it is the hosted page.** `View your invoice` →
  `https://invoicium.ca/i/<token>`. No `checkout.stripe.com` URL anywhere, so
  the 24-hour-expiring Checkout link is genuinely out of the email.
- **A non-clicker has the facts.** Invoice number, billed-to, issue date, due
  date, status, every line item with qty and rate, subtotal, tax and amount due
  are all in the body text.
- **The Phase A sentence is true.** "A PDF copy is attached for your records,
  and you can view it online using the link below."
- **The conditional CTA works.** It reads "View your invoice" rather than
  "View & pay invoice" because the connected Stripe account is `restricted`, so
  `canPayOnline` is false. That is the branch behaving correctly — and it is
  also the visible cost of §8.4: the client currently has no way to pay from
  the email.

### 11.1 FIXED — the email asked for a reply it could not receive

The body said:

> Questions about this invoice? Just reply to this email and we'll get back to
> you.

The message went out from `noreply@invoicium.ca` with **no `Reply-To` header** --
confirmed on the delivered message, which came back `reply_to: null`. A client
doing exactly what the email told them to do wrote into a void, and the
contractor never learned they had a question about an unpaid invoice.

The instruction was the right one -- replying is what people actually do -- so
the header changed, not the sentence.

`_shared/resend.ts` now takes `replyTo`, and because it is the shared helper the
fix reaches every email the product sends, not just invoices:

| Function | Reply-To | Why that address |
|---|---|---|
| `send-invoice-email` | the contractor (`sender_email`) | the body asks the client to reply |
| `send-quote-email` | the contractor (`sender_email`) | asks twice -- intro and footer |
| `approve-quote` | the CLIENT (`quote.client_email`) | goes to the contractor; the next conversation is "great, when can you start?" |
| `send-crew-invite` | the employer | an invitee's question is for the person who invited them, not for us |
| `_shared/notify.ts` | `support@invoicium.ca` | platform notifications, and the shared footer already names that address |

**A malformed address is dropped, not sent.** Resend rejects the whole request
for a bad `reply_to`, so without that filter one typo in a contractor's Settings
email would have silently stopped every invoice that account ever sent -- a far
worse failure than losing the reply path on one message. The bad value is logged
rather than discarded silently.

Both directions proven against real delivered messages, not the source:

```
PASS  Reply-To is populated, not null
PASS  Reply-To is the contractor, not noreply
PASS  Reply-To is NOT the noreply sender
```

and with `--bad-reply-to`:

```
PASS  a malformed reply-to did NOT break the send
PASS  the bad address was dropped rather than sent
```

One caveat on the first set: in this database the contractor's configured
business email and the client's email are the same address, so those assertions
prove Reply-To is populated and is not the noreply sender -- they cannot
distinguish "the contractor" from "the client". The code takes `sender_email`,
which is the contractor's; a database with two distinct addresses would prove it
outright.

`scripts/test-send-invoice-email.py` sends and asserts;
`scripts/inspect-sent-email.py <id>` reads any sent message back.

---

## 12. `sendQuoteSMS failed: Authenticate` — it is the credentials

Diagnosed with `scripts/diagnose-twilio.py`. No SMS was sent; both checks are
reads.

`Authenticate` is Twilio's own message for HTTP 401 (`code 20003`), so the
string means the credentials were rejected rather than that anything in our
code misbehaved.

Three possibilities, separated:

| Check | Result |
|---|---|
| Do the DEPLOYED secrets match `.env`? | **Yes** — all three match |
| Are the `.env` credentials valid at Twilio? | **No** — `HTTP 401 Authenticate`, code 20003 |
| Does the account own the From number? | Not reachable; the account lookup fails first |

The first check works without either side revealing a secret: the Supabase
Management API returns each secret as a SHA-256 digest, so hashing the local
value and comparing digests answers "same string?" exactly.

The credentials are *well-formed* — SID is `AC` + 32 hex (34 chars), token is 32
hex — so this is not a truncated paste or a wrong variable. A well-formed pair
that Twilio rejects means the token was rotated, or the account is
closed/suspended, or the SID and token do not belong to each other.

**The code is not at fault.** `_shared/twilio.ts` builds
`Basic base64(SID:TOKEN)` against
`https://api.twilio.com/2010-04-01/Accounts/<SID>/Messages.json` with a
form-encoded body — which is correct, and is the same helper the invoice SMS
path uses, so **invoice SMS is dead for the same reason**.

**This is a secret to replace, not a bug to fix.** Nothing further was done.
Note that even once the credentials work, A2P 10DLC is still unregistered, so US
carriers will filter link-bearing messages aggressively — SMS remains a
convenience channel behind email, and nothing may depend on one arriving.
