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

## 1. The single worst finding: AI is a hardcoded stub

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
| AI invoice & quote generation | **ABSENT** | Hardcoded stub (§1) |
| Voice-to-invoice dictation | **PARTIAL** | Web Speech transcription is real (`GlobalVoiceAssistant.jsx:25`); the result is then parsed by the stub, so it hears you and returns Labor/Materials |
| Online card payments via Stripe | **WORKS** | `create-invoice-payment-link` + `stripe-webhook`, Connect wired |
| Job tracking with before/after photos | **WORKS** | Since the `uploads` bucket and real `uploadFile()` landed. Was ABSENT before that — the old stub returned a `blob:` URL that died on reload |
| Email & SMS delivery | **WORKS** | `send-invoice-email` / `send-invoice-sms`, real Resend + Twilio |
| Automated overdue reminders | **PARTIAL** | Manual chase is real and good. Nothing automatic exists — no scheduler (§3) |

### Essential — $49

| Claim | State | Evidence |
|---|---|---|
| 100 invoices or quotes/month | **PARTIAL** | Webhook writes **75**, not 100 (§4) |
| Recurring invoices | **ABSENT** | `RecurringInvoice` rows are created, listed, updated, deleted. **Nothing converts one into an `Invoice`** — no function, no cron, no client path. `CreateInvoice.jsx:1021` toasts "Invoices will be generated automatically" |
| Expense tracking + AI receipt scanner | **PARTIAL** | Expense tracking is real; the scanner is the stub (§1) |
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

## 5. Feature flags: 24 of 35 are never read

`FEATURE_MINIMUM_PLAN` declares 35 keys. **24 are not referenced anywhere
outside `permissions.jsx`**, so they gate nothing:

```
pdf_export, email_sending, sms_sending, online_payments, client_approvals,
client_reviews, ai_assistance, automations, receipt_checker, job_costing,
branding, employee_profiles, task_management, multi_user, custom_templates,
smart_insights, priority_support, public_booking, material_assistant,
price_comparison, white_label, advanced_permissions, dedicated_support,
api_access
```

A dead key is not automatically a bug — `pdf_export` describes something that
works and simply is not gated. But it means **the plan ladder is largely
unenforced**: a Core subscriber who reaches a Professional screen is usually
stopped by nothing.

### The rule

> **A feature flag is not enforcement until a call site reads it — verify the
> read, not the declaration.**

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

| Tier | WORKS | PARTIAL | ABSENT |
|---|---|---|---|
| Core | 3 | 3 | 1 |
| Essential | 4 | 3 | 1 |
| Professional | 2 (+2 dormant) | 2 | 2 |
| Enterprise | 0 (+1 dormant) | 2 | 3 |

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
