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
