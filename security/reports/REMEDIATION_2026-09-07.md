# Remediation record — 2026-09-07

What actually shipped against the open audit findings, what was narrowed and
why, and what is still open. Written so the next person does not have to guess
which half of a finding was closed.

Nothing here has been deployed. See **Before this is real** at the bottom.

---

## 1. Deploy path could green-light a runtime failure — CLOSED

**The gap.** `send-invoice-email` called `loadOwnedForSend()` without importing
it. `check-function-bundles.cjs` passed anyway: it flattens and *parses* the
bundle, and unimported source parses perfectly. The function deployed, printed
`Done.`, and threw a ReferenceError on the first live request. Worse, nothing
in the deploy path consulted the checker at all — `npm run check` catches this
only if somebody remembers to run it.

**What changed.**

- `check-function-bundles.cjs` gained a third gate: the flattened source is
  type-erased with esbuild (which is what the runtime sees) and run through
  eslint's `no-undef` against a hand-written Deno global set. Any name
  referenced but never declared, imported, or provided by the runtime fails
  the build.
- `scripts/deploy-functions.py` now runs that checker before uploading anything
  and refuses to deploy on failure. `--skip-checks` overrides it, loudly.

**Verified.** Removing the `loadOwnedForSend` import reproduces the original
bug and the checker fails with
`send-invoice-email: uses 1 name(s) nothing defines`. Restored, all 30
functions pass. No false positives across the current tree.

**Not `deno check`, deliberately.** It is the more thorough tool but needs a
Deno binary nobody here installs and would fetch every remote import over the
network. This gate uses esbuild and eslint, both already devDependencies, so
`npm run check` still works offline on a clean clone. It catches the
missing-import class. It is not a type checker and does not claim to be.

---

## 2. Money-spending endpoints had no rate limit (HIGH-1) — CLOSED

**What changed.**

- New `supabase/functions/_shared/rate-limit.ts`: a persistent per-user
  counter modelled on the `PublicLinkHit` limiter already proven in
  production. Counts rows, so it is shared across isolates and survives a
  recycle. **Fails open** — a limiter outage must not stop a contractor getting
  paid.
- New `supabase/migrations/20260907130000_rate_limit_hit.sql`: the
  `RateLimitHit` table, RLS on with **no policy at all** (service role only —
  unlike `PublicLinkHit`, nobody needs to read their own counters, and a client
  that could read them learns how close it is to the cap), plus a daily pg_cron
  prune at 24h.
- Enforcement wired into eight endpoints:

  | Endpoint | Per minute | Per day |
  |---|---|---|
  | `send-invoice-sms` | 15 | 200 |
  | `send-quote-sms` | 15 | 200 |
  | `send-invoice-email` | 40 | 500 |
  | `send-quote-email` | 40 | 500 |
  | `generate-invoice-pdf` | 60 | — |
  | `create-invoice-payment-link` | 30 | — |
  | `stripe-create-session` | 10 | — |
  | `invoke-llm` | 20 | 400 |

  The plan named five; the two quote-send paths were added because they are the
  same spend through a different door, and leaving them open would have made
  the limit trivially avoidable.

**Why some budgets have a daily ceiling.** A per-minute limit stops a runaway
loop, which is the realistic failure. It does *not* cap a bill: 15/min forever
is a five-figure SMS invoice over a weekend. The paths that spend per call
carry a second window; the ones that only burn CPU do not, because a daily cap
is a real lockout and should not exist where it buys nothing.

**Counting only allowed requests is deliberate.** A rejected call did no work.
Recording rejections would let a client that keeps retrying hold its own window
permanently full — a 60-second budget becomes an indefinite lockout.

- `scripts/test-rate-limits.py` asserts a real 429 arrives, that it does not
  arrive absurdly early, that `Retry-After` is set, and that the window
  **drains**. It probes `generate-invoice-pdf` only: proving the SMS limit
  live would mean sending fifteen real texts on a real bill every time anyone
  ran the test. The paid endpoints' budgets are asserted against the source
  instead, so a number changed in one place and not the other fails here rather
  than on the Infobip invoice.

**`invoke-llm` promoted from brake to wall.** Its in-memory `Map` was
per-isolate and said so honestly in its own comment. Same 20/min, now one
budget across every isolate, plus a daily ceiling.

---

## 3. Storage finding, structural half — CLOSED, WITH ONE DELIBERATE EXCLUSION

`20260907120000_uploads_scope_read.sql` closed the enumeration. It left this
open, in its own words: logos, receipts and job photos shared one `public=true`
bucket, and `/object/public/<path>` ignores RLS, so a known full path still
downloaded anything.

**What changed.**

- New `private-uploads` bucket (`public=false`), owner-scoped policies on all
  four operations — `20260907140000_private_uploads_bucket.sql`.
- `UploadFile` takes a `visibility`, **defaulting to private**. The two public
  cases now argue for themselves in writing at the call site.
- Private uploads return two values that are not interchangeable:
  `file_url` (a 1-hour signed URL — for previewing and for handing to
  `invoke-llm`, whose provider fetches it within seconds) and `file_ref`
  (`private:<path>` — the durable value that goes in the database). Storing the
  signed URL would work for an hour and then rot into a dead link, silently.
- New `src/lib/storageUrl.js`: `resolveStorageUrl`, `openStorageRef`,
  `useStorageUrl`. Legacy plain URLs pass straight through, which is what makes
  this deployable without moving any data first.
- Call sites updated: Settings logo (public), PhotoUploadModal (public),
  JobExpensesTab receipts + AI scan (private), QuickBillFlow (private),
  CameraAnalyzer (private).

**The exclusion: job photos stay public.** This is a narrowing of the original
recommendation, not an oversight. The product *shares* job photos with the
client through an anonymous album link (`pages/SharedPhotos.jsx`) — no account,
no session, and the link is expected to keep working for as long as the share
says it does. Making them private and then minting signed URLs for an anonymous
viewer is public access with extra steps plus an expiry that breaks a link the
client bookmarked. Closing that properly is a **product change first**: the
album has to become a server-side endpoint that validates the share token and
signs URLs, the way the public invoice page already validates `public_token`.
Tracked below, not done here.

**Old receipts have not moved.** Rows written before this still hold plain
public URLs, and those files are still world-readable by path. Moving them is
`scripts/migrate-receipts-to-private.py` — dry run by default, ordered so an
interruption always leaves the row pointing at a file that exists.

> **The old exposure is not closed until that script has run with
> `--apply --delete-originals`.** Deploying the code alone protects new
> receipts only.

---

## Still open — none of these are code

1. **`SECRETS_EXPOSURE`: three leaked credentials are still live.** Rotating
   them remains the single most urgent item on this list, ahead of everything
   above. See `security/plans/SECRETS_EXPOSURE_PLAN.md`.
2. **`GoogleCalendarToken` RLS is still unverified.** It could not be
   determined from source and the dashboard session was not signed in when this
   was attempted. Run in the SQL editor:

   ```sql
   select c.relname, c.relrowsecurity as rls_enabled, c.relforcerowsecurity as forced
     from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'GoogleCalendarToken';

   select polname, polcmd,
          pg_get_expr(polqual, polrelid)      as using_expr,
          pg_get_expr(polwithcheck, polrelid) as check_expr
     from pg_policy
    where polrelid = to_regclass('public."GoogleCalendarToken"');
   ```

   Expect `rls_enabled = true` and every policy scoped to `auth.uid()`. Zero
   policy rows with RLS on means nothing but the service role can read it,
   which is also acceptable — check the app still works if so.
3. **Spend alerts on Infobip/Twilio and OpenAI.** The rate limiter bounds the
   rate; only a billing alert bounds the bill when the limiter fails open.
4. **Supabase Auth rate limits** (Authentication → Rate Limits), which live in
   the dashboard and not in this repo.
5. **Job-photo album endpoint**, per the exclusion above.
6. **Audit coverage.** Run 1's parallel hunt was cut short by a rate limit. The
   areas it never reached: payment-plan and void state machines, the LLM
   `ajv.compile` sink, and the webhook replay window. A re-run would cover them.

---

## Before this is real

Nothing above is deployed. In order:

```
npm run check          # includes the new undefined-name gate
npm run build          # the frontend changes are not covered by npm run check
python scripts/apply-migration.py supabase/migrations/20260907130000_rate_limit_hit.sql
python scripts/apply-migration.py supabase/migrations/20260907140000_private_uploads_bucket.sql
python scripts/deploy-functions.py        # now refuses to run if the check fails
python scripts/test-rate-limits.py        # asserts a real 429, and that it drains
# then, once receipts are confirmed working in the app:
python scripts/migrate-receipts-to-private.py --apply --delete-originals
```

**The migrations must land before the functions.** `enforceRateLimit` reads
`RateLimitHit`; if the table does not exist it fails open and logs on every
call — safe, but the limiter does nothing and looks like it works.
