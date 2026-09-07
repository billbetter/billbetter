# RATE_LIMITING Fix Plan

## Changes

- `supabase/functions/_shared/rate-limit.ts` — new shared, persistent per-user
  limiter, modelled on the `PublicLinkHit` counter that is already proven to
  work here. Fails OPEN on a storage error: a limiter outage must not stop a
  contractor sending an invoice.
- `supabase/functions/send-invoice-sms/index.ts` — enforce (tightest budget;
  every call is a billed message)
- `supabase/functions/send-invoice-email/index.ts` — enforce
- `supabase/functions/generate-invoice-pdf/index.ts` — enforce
- `supabase/functions/create-invoice-payment-link/index.ts` — enforce
- `supabase/functions/stripe-create-session/index.ts` — enforce
- `supabase/functions/invoke-llm/index.ts` — replace the in-memory Map with the
  shared counter
- `supabase/migrations/*_rate_limit.sql` — `RateLimitHit` table, RLS denying all
  client access (service-role only), index on (key, hit_at), retention cleanup

## New files

- `supabase/functions/_shared/rate-limit.ts`
- the migration above
- `scripts/test-rate-limits.py` — asserts a real 429 arrives from each limited
  endpoint, in the spirit of the existing `test-public-rate-limit.py`

## Verification goals

- [ ] Each limited endpoint returns 429 after its budget, verified live
- [ ] The limit is shared across isolates (persisted, not in-memory)
- [ ] A limiter storage failure does not block a legitimate send (fails open)
- [ ] `X-Forwarded-For` spoofing does not widen any budget (already verified for
      the public endpoints; must hold for the new user-keyed ones, which key on
      user id and so are unaffected by headers)
- [ ] Existing public-endpoint limits still pass `test-public-rate-limit.py`

## Manual verification (for the human)

- Confirm Supabase Auth rate limits in the dashboard:
  Authentication -> Rate Limits. Sign-in and sign-up should be capped per IP.
- Set a spend alert on Infobip/Twilio and on the OpenAI account.
- After deploying, send invoices normally for a day and confirm no legitimate
  action hits a 429.
