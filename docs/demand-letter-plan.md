# Demand letters — where this stands, and what step 3 builds

A formal payment demand letter, offered when an invoice is far enough overdue
that chasing has stopped working. It is the last thing a contractor does on
their own, before deciding whether to involve anyone else.

Nothing in this feature sends anything on a timer, and nothing reaches a client
without the contractor having read it. That is the load-bearing constraint;
every decision below follows from it.

---

## 1. Built (steps 1–2)

| Piece | Where |
|---|---|
| Daily sweep, service-role, all accounts | `supabase/functions/sweep-demand-letters/` |
| Schedule, 07:00 UTC | `migrations/20260904120100_demand_letter_sweep_cron.sql` |
| Prompt state on the invoice | `migrations/20260904120000_demand_letter_prompts.sql` |
| Eligibility rules, pure | `src/lib/demandLetter.js` |
| The banner | `src/components/invoice/DemandLetterBanner.jsx`, mounted on Dashboard |

The sweep stamps `demand_letter_prompted_at` and does nothing else. Eligibility
is 21+ days past `due_date` with status `sent` or `overdue` — matched on the
date rather than the status, because nothing in this app reliably promotes an
invoice to `overdue`.

**Not yet running.** The schedule skips unless `project_functions_url` and
`cron_secret` are in Vault, and `CRON_SECRET` is still commented out in
`scripts/deploy-secrets.py` pending a value in `.env`.

---

## 2. Four decisions taken, and why

### `date_issued`, not `created_at`

`migrations/20260904120200_invoice_date_issued.sql`. Matches Quote's existing
`date_issued` rather than inventing `invoice_date`. Backfilled from `created_at`
for everything already sent; drafts left null so they get a true date when they
actually go out. No column default — `default now()` would stamp at INSERT and
reproduce exactly the drafted-Tuesday-sent-Friday ambiguity the column exists to
remove. Stamped by `issuedPatch()` at all three places a status becomes `sent`.

Written as a full ISO instant, deliberately diverging from Quote, which writes a
bare `yyyy-MM-dd`. That bare shape is stored as midnight UTC and reads a day
early west of Greenwich — the same defect already found on the chase queue. A
document that asserts its own issue date should not be able to be off by one.

### `payment_methods` on BusinessSettings, entered by hand

`migrations/20260904120300_business_settings_payment_methods.sql`. Free text,
one method per line, because the letter must say *how* to pay: "E-transfer to
pay@example.com", "Cheque payable to Bagzat Contracting, 14 Mill Road". A
checkbox set cannot carry the address, payee or reference, which is the part
that moves money.

Null means the business has never filled it in. The flow **asks before
generating** rather than inventing methods on their behalf, and rather than
falling back to Stripe status — an active Stripe account says a card payment
would work, not that card is what this contractor wants listed.

### `amount_due` is the balance, never `total`

Partial payments are real (`InvoicePayment` rows). Read through the existing
helpers — `src/lib/invoicePayments.js` in the browser,
`_shared/invoice-balance.ts` server-side. A letter demanding the full total
after a recorded deposit is the kind of error that ends the conversation.

### `work_description` is reviewed before it reaches the letter prompt

The one input that is neither a column nor a computation. It has to be
summarised from `items` (jsonb) and `notes`, which is a judgment call inside a
document with legal weight — the place a wrong line item or an invented phrase
would do the most damage.

So it gets its own review step. The AI drafts a summary; the contractor sees and
edits it **before** the letter is generated; the edited text is what goes into
the letter prompt. Review-before-send applies at every stage that produces
prose, not only the last one.

---

## 3. Step 3 — the generation flow

Two review gates, in order. Neither is skippable.

```
banner CTA
    │
    ▼
┌─────────────────────────────────────────┐
│ Gate 1 — the work description           │
│                                          │
│  seed:  AI summary of items + notes      │
│         (deterministic join of item      │
│          descriptions if AI is off)      │
│  shown: editable textarea                │
│  needs: contractor confirms              │
└─────────────────────────────────────────┘
    │  edited text
    ▼
┌─────────────────────────────────────────┐
│ Gate 2 — the letter                      │
│                                          │
│  input: the prompt, fully populated      │
│  shown: editable textarea                │
│  needs: contractor confirms              │
└─────────────────────────────────────────┘
    │
    ▼
  send  →  stamp demand_letter_sent_at, log the text (step 6)
```

### Preconditions checked before Gate 1

Fail early and say which is missing, rather than producing a letter with a hole
in it:

- `payment_methods` is set on BusinessSettings → otherwise link to Settings
- business name and a contact method exist
- the client has a name and at least one contact method
- the invoice has a `date_issued` (or `created_at` to fall back on)
- the balance is greater than zero

### Values computed in code, never by the model

| Value | Rule |
|---|---|
| `letter_date` | today |
| `payment_deadline` | `letter_date` + 10 business days, Sat/Sun skipped |
| `days_overdue` | from `due_date`, calendar days |
| `amount_due` | balance helper, formatted with the business currency |

Holidays are **not** handled. Ten business days skipping weekends is what the
spec says and what the code does; a statutory-holiday calendar is
jurisdiction-specific and belongs with the jurisdiction guide, not here. Worth
saying out loud in case a deadline landing on Boxing Day is a problem.

### Prompt inputs, mapped to what actually exists

| Prompt variable | Source |
|---|---|
| `business_name` | `BusinessSettings.business_name` |
| `business_contact` | composed from `email`, `phone`, `address` |
| `client_name` | `Invoice.client_name` |
| `client_contact` | composed from `client_email`, `client_phone`, `client_address` |
| `invoice_number` | `Invoice.invoice_number` |
| `invoice_date` | `issueDateOf(invoice)` → `date_issued` |
| `due_date` | `Invoice.due_date` |
| `days_overdue` | computed |
| `amount_due` | balance helper |
| `work_description` | **Gate 1 output**, contractor-edited |
| `payment_methods` | `BusinessSettings.payment_methods` |
| `letter_date` | computed |
| `payment_deadline` | computed |

Two changes to the prompt as drafted:

1. **Add `{letter_date}` and `{payment_deadline}` to its input list.** They are
   not in it today, and the letter cannot be written without them.
2. **Drop `{jurisdiction}` from its inputs.** It is supplied but the do-not
   rules forbid referencing jurisdiction, courts or claim limits. A variable
   that is passed but must not be used is an invitation to use it.

### When AI is unavailable

`invoke-llm` answers `not_configured` without `LLM_API_KEY`. Gate 1 falls back
to a deterministic join of the line-item descriptions, which is honest and
editable. Gate 2 has no fallback — a demand letter is not something to
template-fill silently — so the flow says the drafting service is unavailable
and leaves the invoice untouched.

---

## 4. Steps 4–6, sketched

**Step 4** is Gate 2 above; it is not a separate build.

**Step 5** — the follow-up at day 35–40 already works: `demandLetterPrompt()`
returns `"follow_up"` and the banner has the copy. What is missing is the
destination, which is the jurisdiction guide, not yet built. Until it exists the
follow-up should not claim to point anywhere.

**Step 6** — logging. `demand_letter_sent_at` exists and is unwritten. The
letter text itself has no home yet, deliberately: an `InvoiceEvent` row puts it
in the invoice's existing history alongside everything else that happened to it,
which is probably right, but that is a decision for the step that writes it.

---

## 5. Open questions

- **Delivery.** Steps 4–6 say "sent" without saying how. Email is already wired
  (`send-invoice-email`, Resend) and was explicitly fenced off. A demand letter
  is not an invoice email, so it needs its own decision: reuse that path, or
  produce a PDF the contractor sends themselves?
- **Who the letter is from.** `business_name` alone signs it. There is no
  owner-name field on BusinessSettings; a letter signed by a company rather than
  a person may or may not be what is wanted.
- **The notification bell.** `sdk.entities.Notification.filter()` is hardcoded to
  return `[]`, so the bell is a shell. The banner deliberately does not depend on
  it. If notifications are ever made real, this prompt should move there.
