# SECRETS_EXPOSURE Fix Plan

## Changes

- `.env.example` — new file, every variable name required by `scripts/_env.py`
  and `scripts/deploy-secrets.py`, with placeholder values only.
- `scripts/scan-secrets.py` — new. Scans the working tree AND every reachable
  commit for live-credential patterns, and reports whether each hit is on a
  remote (public) or local-only ref. Exits non-zero on a finding so it can be
  wired into CI or a pre-push hook.
- No change to `scripts/deploy-secrets.py`: it already reads from `.env` and
  hardcodes nothing.

## New files

- `.env.example`
- `scripts/scan-secrets.py`

## Verification goals

- [ ] `git ls-files .env` returns nothing
- [ ] `.env` and `.env.*` matched by `.gitignore`
- [ ] No live-secret pattern in any tracked file (test placeholders excluded)
- [ ] No `VITE_`/`NEXT_PUBLIC_`/`REACT_APP_` variable holds a secret
- [ ] `.env.example` exists, lists every required name, contains no real value
- [ ] `scan-secrets.py` detects the two known historical leaks and correctly
      reports them as local-only
- [ ] `scan-secrets.py` exits 0 against the working tree alone

## Manual verification (for the human) — REQUIRED, NOT OPTIONAL

These cannot be done from code. The credentials stay exploitable until they are.

- [ ] Revoke the leaked Stripe key `sk_live_51SPuik…BE4oBfOg` at
      https://dashboard.stripe.com/apikeys
      Confirm: re-running the audit's liveness check returns 401, not 200.
- [ ] Roll the Stripe webhook signing secret at
      https://dashboard.stripe.com/webhooks, update `STRIPE_WEBHOOK_SECRET` in
      `.env`, re-run `python scripts/deploy-secrets.py`, then send a test
      webhook from the Stripe dashboard and confirm it is accepted.
- [ ] Revoke the leaked Supabase PAT `sbp_…461c` at
      https://supabase.com/dashboard/account/tokens
      Confirm: `curl -H "Authorization: Bearer sbp_…461c" https://api.supabase.com/v1/projects`
      returns 401.
- [ ] Check the Stripe dashboard's payment and payout history for anything
      unrecognised while the key was exposed.
- [ ] Delete the dead branch: `git branch -D stripe-schema-fixes`
      (cherry-pick anything still wanted from it first).
