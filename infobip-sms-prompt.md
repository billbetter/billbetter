# Claude Code prompt — swap SMS from Twilio to Infobip

Paste everything below the line into Claude Code from inside `AxisBill/`.

**Do not put the API key in this file, in the repo, or in a chat message.** It goes in `.env` only, and reaches production through `scripts/deploy-secrets.py`. If you catch yourself about to paste a live key anywhere else, stop.

---

Our Twilio credentials have been rejected with a 401 (code 20003) for a while — well-formed but invalid, rotated token or suspended account — so **both SMS paths are dead** and "Email & SMS delivery" is a bullet we sell on Core that sends nothing. I have an Infobip account. Swap the provider.

## Repo facts (verify, don't assume)

- The whole SMS surface is one file. `supabase/functions/_shared/twilio.ts` exports a single `sendSMS({ to, body })`, and exactly two functions import it: `send-quote-sms` and `send-invoice-sms`. That's the seam — the swap should not need to touch anything else.
- Both callers are Deno edge functions behind `requireAppAccess`. Both read secrets with `Deno.env.get`.
- Secrets live on the Supabase project, not in `.env`. `scripts/deploy-secrets.py` is what closes that gap, pushing the names in its `SECRET_NAMES` list. **That list is all-or-nothing** — it uses `require()`, so adding a name that isn't in `.env` fails the entire push, not just that one secret.
- `scripts/diagnose-twilio.py` exists and is how the 401 was found in the first place.
- Deploy is `scripts/deploy-functions.py <name>`, which textually inlines `../_shared/*.ts` imports — no bundler, no npm. Whatever you write has to be dependency-free `fetch`.

## The thing most likely to go wrong

Infobip is not a drop-in for Twilio's error contract, in two ways that both produce silent failure — the exact class of bug this codebase has spent its whole audit deleting:

1. **Infobip returns HTTP 200 for messages it rejected.** Delivery failure lives in the per-message body: `messages[0].status.groupName` is `REJECTED` or `UNDELIVERABLE` while `res.ok` is true. `twilio.ts` currently branches on `res.ok` alone. Port that logic unchanged and every rejected message reports success — a contractor would be told their quote texted when it never left. Treat anything outside `PENDING` / `DELIVERED` groups as a throw, and put the `status.description` in the error so the log says why.
2. **The base URL is account-specific.** Infobip issues each account its own host (`https://<something>.api.infobip.com`), not a shared one. Hardcoding `api.infobip.com` produces auth failures that look like a bad key. It has to be its own env var.

Auth header is `Authorization: App <API_KEY>` — the literal word `App`, not `Bearer`. Endpoint is `POST /sms/2/text/advanced`, JSON body, `messages: [{ destinations: [{ to }], from, text }]`.

## What to build

**Rename the seam.** `_shared/twilio.ts` → `_shared/sms.ts`, still exporting `sendSMS({ to, body })` with the same signature so the two callers barely change. The provider is an implementation detail of that file; nothing above it should know which one is in use.

**Keep Twilio behind a switch for one release.** `SMS_PROVIDER` env var, `infobip` default, `twilio` still reachable. If Infobip misbehaves in production I want the rollback to be a secret change and a function redeploy, not a code revert. Delete the Twilio branch in a follow-up once Infobip has actually delivered messages — ask me, don't assume it's earned.

**Three new secrets**, added to `.env` and to `SECRET_NAMES` in `deploy-secrets.py`:

- `INFOBIP_API_KEY`
- `INFOBIP_BASE_URL` — the account-specific host
- `INFOBIP_SENDER` — alphanumeric sender ID or number

Leave the `TWILIO_*` names in the list while the switch exists; removing them breaks the push for anyone whose `.env` still has them. I'll put the real values in `.env` myself — **never write a key into the file, a comment, a test fixture or a commit.** If you need a placeholder use an obvious one.

**Fix the return shape.** `send-quote-sms` returns `sid: data?.sid`, which is Twilio-shaped and will be `undefined` on Infobip. Infobip's identifier is `messages[0].messageId`. Normalise it in `sms.ts` — return one shape both providers satisfy — rather than making each caller know the difference. Check `send-invoice-sms` for the same assumption.

**Add `scripts/diagnose-infobip.py`**, modelled on `diagnose-twilio.py`: prove the credential and the base URL against the live API and print what came back, so the key can be verified *before* anything is deployed. That script is how the Twilio 401 was found; I want the same instrument for the replacement.

## What switching does NOT fix

**A2P 10DLC.** That's a US carrier registration requirement, not a Twilio one — Infobip has the same obligation and US traffic stays filtered until it's registered, especially messages carrying links. Don't imply in code comments or docs that the migration resolves it. If our SMS is mostly Canadian, say so explicitly in whatever you write, because that changes whether this is blocking or not.

## Constraints

- Dependency-free `fetch` only, for the reason in Repo facts. **Ask before adding dependencies.**
- No schema change should be needed. If you think one is, stop and tell me why.
- Don't touch `requireAppAccess` on either caller.
- Don't log message bodies or full phone numbers. Last four digits at most.
- `npm run check` must pass.

## What I want back first

Do not write code. Deliver:

1. What you found at the seam — confirm it really is one file and two callers, or tell me what else imports it.
2. A short plan: the `sms.ts` shape, the exact success/failure test for an Infobip response, what changes in each caller, and the env/secret steps in the order I have to run them.
3. The commands I need to run myself at the end, in order.

Then stop and wait for me.
