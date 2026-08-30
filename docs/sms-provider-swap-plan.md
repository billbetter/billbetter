# Swapping Twilio for Infobip

**Built.** All four open questions answered; decisions and their reasoning are
recorded inline below. No secret value was written to any file — step 1 of §8 is
still yours.

---

## 1. What the seam actually is

**The send path is one file and two callers, exactly as you said.**

```
supabase/functions/_shared/twilio.ts     export async function sendSMS({ to, body })
  └─ send-quote-sms/index.ts:3           import { sendSMS } from '../_shared/twilio.ts'
  └─ send-invoice-sms/index.ts:3         import { sendSMS } from '../_shared/twilio.ts'
```

Nothing else imports it. Both callers keep `requireAppAccess` above the try
block and neither is touched by the swap beyond the import and the return line.

**But the Twilio surface is bigger than the send path.** Three user-facing
places name Twilio, and one of them is a legal disclosure:

| File | What it says | Why it matters |
|---|---|---|
| `src/pages/PrivacyPolicy.jsx:248` | Lists **Twilio** as a named subprocessor: "SMS notifications … to phone numbers you provide" | Becomes **factually false** the first time Infobip sends a message. Line 309 says data is shared with "the third-party services listed above", so the list is load-bearing, not decorative. |
| `src/pages/TermsOfService.jsx:186` | "SMS providers (e.g., Twilio)" | Softer — hedged with "e.g." — but stale. |
| `src/pages/InvoiceDetail.jsx:737-750` | A help panel: "📱 Twilio Trial Account? … console.twilio.com → Verified Caller IDs" | Keyed on the error text containing `"trial account"` or `"unverified"`. Infobip never emits those strings, so the panel becomes unreachable — and if it did fire it would send the contractor to the wrong provider's console. |

The privacy one should ship in the same change. Telling a contractor's clients
their phone numbers go to Twilio while they go to Infobip is the kind of quiet
inaccuracy this codebase has spent its audit deleting, and we are a Canadian
company making a PIPEDA-relevant disclosure.

**Two findings that make the rest cheaper:**

- **Nothing consumes `sid`.** A grep of `src/` for `.sid` / `sid:` returns zero
  real hits — every match is `inside`, `outside`, `sideOffset`. So the return
  shape can be normalised freely; there is no caller to keep compatible.
- **No schema change is needed.** Nothing about SMS touches the database.

---

## 2. `_shared/sms.ts`

Same export, same signature, provider chosen inside:

```ts
export async function sendSMS({ to, body }: { to: string; body: string }): Promise<SmsResult>

interface SmsResult {
  id: string | null;        // Infobip messages[0].messageId | Twilio sid
  provider: 'infobip' | 'twilio';
  status: string | null;    // Infobip status.groupName | Twilio status
}
```

`SMS_PROVIDER` selects the branch, defaulting to `infobip`. The Twilio branch is
the current file moved across unchanged, so the rollback is a secret change plus
a redeploy — not a revert.

Nothing above this file learns which provider is in use. Both callers change two
lines: the import path, and `sid: data?.sid` → `id: result.id`.

`maskPhone()` lives here too and is the only thing that ever renders a number
into a log — last four digits, never the body. The current file logs neither,
and the new one must not start just because Infobip's errors sometimes echo the
destination back.

---

## 3. The success test — where this goes wrong if ported naively

Twilio's contract is `res.ok`. Infobip's is not, and porting the branch
unchanged means every rejected message reports success.

**Three layers, all of which must pass:**

```
1. HTTP        !res.ok                      -> throw requestError.serviceException.text
2. Envelope    !Array.isArray(messages)     -> throw (200 with no per-message result)
               || messages.length === 0
3. Per-message status.groupName not allowed -> throw status.description
```

Layer 3 is the one that matters. A rejected Infobip message arrives as
**HTTP 200** with:

```json
{ "messages": [ { "messageId": "...",
                  "status": { "groupName": "REJECTED",
                              "description": "Not enough credits" } } ] }
```

**Allowlist, not denylist.** An unknown group throws rather than passing. A
false failure is visible and recoverable; a false success tells a contractor
their quote was texted when it never left, which is the exact bug class here.

**One deliberate widening of your spec.** You said "anything outside
PENDING / DELIVERED". Infobip also has group `ACCEPTED` (groupId 0), and at
*submit* time `PENDING` or `ACCEPTED` is what a good send returns — `DELIVERED`
only appears later on a delivery report, so it will essentially never be seen
here. Allowlisting only PENDING/DELIVERED risks throwing on genuinely accepted
messages and making working SMS look broken.

So the allowlist I propose is **`PENDING`, `ACCEPTED`, `DELIVERED`**, with
`REJECTED`, `UNDELIVERABLE`, `EXPIRED` and anything unrecognised throwing. Say
if you want it narrower — this is the one place I have widened what you
specified.

The thrown message carries `status.description` so the log says *why*
("Not enough credits", "Invalid destination address"), which is what the Twilio
401 investigation lacked.

**Request shape** (dependency-free `fetch`, no npm):

```
POST {INFOBIP_BASE_URL}/sms/2/text/advanced
Authorization: App {INFOBIP_API_KEY}        <- the literal word App, not Bearer
Content-Type: application/json

{ "messages": [ { "destinations": [ { "to": to } ],
                  "from": INFOBIP_SENDER,
                  "text": body } ] }
```

`INFOBIP_BASE_URL` is normalised in `sms.ts`: trailing slash stripped, `https://`
prepended if absent. It is account-specific — a shared `api.infobip.com` produces
auth failures that read like a bad key, so `diagnose-infobip.py` warns loudly if
the configured host looks generic.

---

## 4. Secrets — and the ordering trap

`SECRET_NAMES` is all-or-nothing: `_env.require()` calls `sys.exit()` on the
first missing name, so **a name in the list that is not in `.env` fails the
entire push**, including Resend and Stripe. That makes the order below
load-bearing rather than advisory.

**Four names, not three.** The extra one is `SMS_PROVIDER`. Without it in
`.env` and `SECRET_NAMES`, the rollback you asked for is an undocumented click
in the Supabase dashboard rather than a one-line change pushed by the same
script as everything else. Tell me if you would rather keep it manual.

```
SMS_PROVIDER=infobip
INFOBIP_API_KEY=<yours>
INFOBIP_BASE_URL=https://<account>.api.infobip.com
INFOBIP_SENDER=<alphanumeric sender ID or number>
```

`TWILIO_*` stays in `SECRET_NAMES` for the life of the switch. Worth being
precise about why, because the mechanism is the opposite way round from how it
was described: *removing* a name never breaks the push — it just stops pushing
that secret. Keeping them matters because the deployed `TWILIO_*` values are
what `SMS_PROVIDER=twilio` needs in order to work. Drop them from the list and
the rollback path quietly stops being a rollback path.

No key, real or partial, goes into any file, comment, fixture or commit.
Placeholders are obvious (`<yours>`).

---

## 5. `scripts/diagnose-infobip.py`

Modelled on `diagnose-twilio.py`, same three-part structure, and it **reads
`.env` directly so the credential can be proven before anything is deployed**:

1. **Is the deployed secret the same string as `.env`?** — the Supabase
   Management API returns each secret as a SHA-256 digest, so hashing the local
   value and comparing proves sync without either side revealing the value.
2. **Is the key valid at Infobip at all?** — `GET {BASE_URL}/account/1/balance`,
   a read-only call that sends nothing. A 401 here is the Twilio 20003 moment:
   it separates "wrong key" from "wrong host". Also flags a base URL that looks
   generic rather than account-specific.
3. **Is the sender usable?** — `GET {BASE_URL}/sms/1/inbox/reports` or the
   sender-ID endpoint, printing what the account actually has, so a mismatch
   between `INFOBIP_SENDER` and the account is visible before a send fails.

No SMS is sent. Every call is a GET.

---

## 6. What this does NOT fix

**A2P 10DLC.** It is a US carrier registration requirement, not a Twilio one.
Infobip carries the identical obligation, and until the brand and campaign are
registered, US carriers keep filtering — link-bearing messages hardest, which is
every message this product sends. Switching providers does not move this at all,
and no comment or doc in the change will imply otherwise. `send-invoice-sms:62-69`
already says so and stays.

**SETTLED: Canadian recipients, so this is a real fix rather than a lateral
move.** The deciding signals were outside the data, which is why the query could
not answer it: the business is Toronto-based and prices in CAD, and the four
`Client` rows are test data rather than customers. `+1` is the North American
Numbering Plan, shared by the US and Canada, so the phone numbers never could
have distinguished them; `America/Chicago` in `BusinessSettings.timezone` is an
untouched column default and signals nothing either.

Canadian carriers do not require A2P 10DLC.

**Deferred, not solved.** 10DLC is keyed on the RECIPIENT, so it becomes
blocking the moment a US contractor signs up, and Infobip carries the identical
obligation — this swap moves it not at all. Registration has weeks of lead time,
so it wants starting when a US signup looks *plausible*, not when one lands.

`send-invoice-sms:62-69` is unchanged, byte for byte.

---

## 7. Files touched

| File | Change |
|---|---|
| `supabase/functions/_shared/sms.ts` | new — the seam, both providers, `maskPhone` |
| `supabase/functions/_shared/twilio.ts` | deleted; its body moves into the twilio branch |
| `send-quote-sms/index.ts` | import path; `sid:` → `id:` |
| `send-invoice-sms/index.ts` | import path; `sid:` → `id:`; the Twilio mention in the comment at :46 |
| `scripts/deploy-secrets.py` | four names added to `SECRET_NAMES` |
| `scripts/diagnose-infobip.py` | new |
| `src/pages/PrivacyPolicy.jsx` | subprocessor entry: Twilio → Infobip |
| `src/pages/TermsOfService.jsx` | "e.g., Twilio" → provider-neutral |
| `src/pages/InvoiceDetail.jsx` | retire the Twilio-trial help panel |
| `docs/feature-audit.md` | §12 updated: the 20003 finding, and what replaced it |

`scripts/diagnose-twilio.py` stays while the switch does — it is the instrument
for the rollback path.

---

## 8. What you run, in order

**Step 1 is yours and everything else fails without it**, because `SECRET_NAMES`
will name `INFOBIP_*` the moment this lands:

1. Add the four names above to `.env` with real values.
2. `python scripts/diagnose-infobip.py` — proves the key and the base URL against
   the live API before anything ships. Stop here if it fails; nothing below will
   work.
3. `python scripts/deploy-secrets.py`
4. `python scripts/deploy-functions.py send-quote-sms send-invoice-sms`
5. `python scripts/test-function-boots.py` — the deploy script reports upload
   success, not boot success.
6. `python scripts/diagnose-infobip.py` again — now the digest comparison in
   part 1 has something to compare, confirming deployed matches `.env`.
7. `npm run check`

Then one real send from the app to a number you control, which is the only thing
that proves the whole path. I cannot do that one: it needs a live account and a
real handset.

---

## 9. Decisions taken

| | Answer |
|---|---|
| **US or Canadian recipients?** | Canadian. Real fix, not a lateral move. 10DLC deferred, not solved — see §6. |
| **Allowlist `ACCEPTED`?** | Yes. `PENDING`, `ACCEPTED`, `DELIVERED`; throw on everything else including unrecognised groups. |
| **`SMS_PROVIDER` as a fourth secret?** | Yes — it makes the rollback a pushed change rather than a dashboard click. |
| **Privacy policy wording** | Names **both** providers while both are reachable. Drop Twilio in the same commit that deletes the Twilio branch. |
| **`InvoiceDetail.jsx:737-750`** | Left alone. Still correct for the Twilio branch; goes dead exactly when that branch is deleted, so it is removed in that same follow-up. No Infobip equivalent — guessing help copy for an error we have never seen is how you get a panel pointing at the wrong console. |
