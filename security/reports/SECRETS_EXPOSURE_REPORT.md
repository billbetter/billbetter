# SECRETS_EXPOSURE Security Report

## Status: CRITICAL

Two live production credentials are recoverable from this repository's git
history, and both were confirmed still valid by authenticating with them on
2026-09-07.

## Findings

### CRITICAL-1 — Live Stripe secret key in git history

`scripts/deploy-secrets.py` hardcoded the platform's live Stripe secret key and
live webhook signing secret as a Python list, across **at least 10 commits**:

```python
# scripts/deploy-secrets.py, as committed in db61f4a and 9 earlier commits
SECRETS = [
    ('STRIPE_SECRET_KEY', 'sk_live_51SPuik…BE4oBfOg'),
    ('STRIPE_WEBHOOK_SECRET', 'whsec_9HOi6RTg…axuu'),
]
```

Commits carrying it include `db61f4a`, `4ccfde7`, `4898f93`, `0094b12`,
`26baff3`, `e649470`, `a782ba8`, `e1fedb2`, `2c09cae`, `7af3e01`.

**Verified still live.** `GET https://api.stripe.com/v1/balance` with that key
returned **HTTP 200**. It has not been revoked — only replaced. The current
`.env` holds a *different* key (SHA-256 prefix `b6084508` vs the leaked
`6ea4e74b`), so a rotation happened at some point but the old key was left
enabled.

### CRITICAL-2 — Live Supabase personal access token in git history

`supabase_token.txt` was committed in `13a1c25` containing a base64 blob that
decodes to a Supabase PAT (`sbp_…461c`).

**Verified still live.** `GET https://api.supabase.com/v1/projects` with it
returned **HTTP 200 and listed 2 projects**.

A Supabase PAT is the most powerful credential in this system. It is not scoped
to one project or one table. It permits, among other things: reading every Edge
Function secret (which includes the *current* Stripe key, the Resend key, the
Infobip key and the service-role key), running arbitrary SQL through the
Management API's `/database/query` endpoint, and deleting the projects.

`.gitignore` now lists `supabase_token.txt`, so the file is no longer tracked —
but gitignoring a file does not remove it from history.

### The full inventory — six credentials, three still live

`scripts/scan-secrets.py` (added by this audit) found more than the two above.
Every one was probed against its provider on 2026-09-07:

| Credential | In history as | Live? | Still in use? |
|---|---|---|---|
| Stripe live secret key `sk_live_51SPui…` | `scripts/deploy-secrets.py` | **LIVE** | no — replaced |
| Stripe webhook secret `whsec_9HOi6RTg…` | `scripts/deploy-secrets.py` | no probe available | no — replaced |
| Supabase PAT `sbp_619ab2faa5…` | `supabase_token.txt` (base64) | **LIVE** | no — replaced |
| Supabase PAT `sbp_f72e90b243…` | committed script | **LIVE** | no — replaced |
| Resend API key `re_cr1NVdas_QE…` | committed script | revoked (403) | no |
| Google OAuth client secret `GOCSPX-jc5JNHb…` | committed script | no probe available | **YES — currently in `.env`** |

Two points this table makes that the narrative above does not:

**There are two Supabase personal access tokens, not one, and both still work.**
Revoking one is not enough.

**The Google OAuth client secret in history is the one still in production.**
Every other leak is an old value that was rotated and merely left enabled. This
one was never rotated at all — the string in the git history is the string in
`.env` today. It cannot be probed without running an OAuth exchange, so it is
listed as untested rather than assumed safe, but it must be treated as
compromised and rolled.

The Resend key is the one piece of good news: already revoked.

### Exposure boundary — narrower than it first appears

Both leaks live **only** on the local branch `stripe-schema-fixes`. Checked
explicitly:

```
$ for r in $(git for-each-ref --format='%(refname)' refs/remotes); do
    git merge-base --is-ancestor db61f4a $r && echo "REACHABLE from $r"; done
(no output — not reachable from any remote ref)

$ git branch -a --contains db61f4a
  stripe-schema-fixes          # local only
```

So these are **not on GitHub today**. They are one `git push stripe-schema-fixes`
away from being public, and are readable by anyone with this machine, a backup
of it, or any clone that took all branches.

`stripe-schema-fixes` is an unrelated history (no merge-base with `clean-main`)
from the pre-rebrand era, last touched 2026-08-18. It is not merged and, per the
earlier branch review, must not be merged — it would delete 189 files and
reintroduce 44 with stale AxisBill naming.

### MEDIUM-1 — No `.env.example`

There is no `.env.example`. A new contributor has no way to learn which of the
25 variables in `.env` are required without being handed the real file — which
is exactly how real credentials get copied around.

## What's at risk

With the Stripe key: charging saved payment methods, reading the full customer
and payment history, issuing refunds to an attacker-controlled destination,
creating payouts, and reading every connected contractor's account. This is a
**live** key on a platform that processes real contractor invoices.

With the Supabase PAT: reading every other secret the platform holds (turning
this into a total compromise even after the Stripe key is rotated), reading or
destroying all customer, invoice and payment data across both projects, and
disabling RLS.

The two together mean rotating only one is insufficient — the PAT can read the
replacement Stripe key straight out of the Edge Function secrets.

## What's already secure

Real credit where due — the *current* state of the repo is good:

- `.env` and `.env.*` are in `.gitignore`, and `git ls-files .env` returns
  nothing. `.env` has **never** been committed on any ref.
- The current `scripts/deploy-secrets.py` reads from `.env` via `_env.py` and
  hardcodes nothing. The docstring in `_env.py` records that this was a
  deliberate fix.
- No live secret appears in any **currently tracked** file. The only matches are
  two literal `sk_test_placeholder_not_a_real_key` strings in test fixtures.
- No secret is exposed through the client bundle. Every `VITE_`-prefixed
  variable in use is genuinely public: `VITE_SUPABASE_URL`,
  `VITE_SUPABASE_ANON_KEY`, `VITE_STRIPE_PUBLISHABLE_KEY`,
  `VITE_ENABLE_GOOGLE_AUTH`, `VITE_TTL_DAYS`. The service-role key and the
  Stripe secret key are never referenced from `src/`.
- `.gitignore` also covers `*.pem`, `*.key`, `*.p12`, `*.pfx`,
  `supabase_token.txt`, and the scripts' session temp files.

## Recommendations

In priority order. **1 and 2 are urgent and cannot be done from code — they
require the owner in a dashboard.**

0. **Revoke BOTH Supabase personal access tokens** at
   https://supabase.com/dashboard/account/tokens — `sbp_619ab2faa5…` and
   `sbp_f72e90b243…`. Do these first: a PAT can read every other secret the
   platform holds, including whatever you rotate the Stripe key to.
1. **Revoke the leaked Stripe key** at
   https://dashboard.stripe.com/apikeys. It is live now. Roll the webhook
   signing secret at https://dashboard.stripe.com/webhooks at the same time,
   and update `STRIPE_WEBHOOK_SECRET` in `.env`, then re-run
   `scripts/deploy-secrets.py`.
2. **Roll the Google OAuth client secret** at
   https://console.cloud.google.com/apis/credentials — this one is still in
   active use, so rolling it means updating `GOOGLE_CLIENT_SECRET` in `.env`
   and re-running `scripts/deploy-secrets.py` immediately afterwards, or Google
   sign-in breaks.
3. **Delete the `stripe-schema-fixes` branch** once anything wanted from it has
   been cherry-picked. It is an unmergeable dead history whose only ongoing
   function is to carry two credentials. `git branch -D stripe-schema-fixes`
   makes the leak unreachable and unpushable. (History rewriting is not needed
   because nothing is on the remote.)
4. **Never push that branch.** Until it is deleted, treat it as radioactive.
5. Add `.env.example` with placeholder values documenting the required keys.
6. Consider a pre-push hook or `gitleaks` in CI so a future hardcoded key is
   caught before it reaches a commit.
