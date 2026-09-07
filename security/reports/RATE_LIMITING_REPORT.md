# RATE_LIMITING Security Report

## Status: MEDIUM

The endpoints exposed to the public internet are properly limited, and the
limiter was verified working against production. The gap is on the
*authenticated* side: the five endpoints that spend real money on every call
have no limit at all.

## Findings

### What is limited, and it genuinely works

`_shared/public-link.ts` limits the three unauthenticated endpoints to **30
requests per 60 seconds**:

| Endpoint | Limited | Returns |
|---|---|---|
| `get-public-invoice` | yes (line 76) | 429 |
| `get-public-quote` | yes (line 80) | 429 |
| `pay-public-invoice` | yes (line 51) | 429 |

Two design details worth crediting:

**The counter is persisted, not in-memory.** It counts rows in `PublicLinkHit`,
so it survives isolate recycling and is shared across every isolate. That is a
real wall, not a per-instance brake.

**The limiter runs before token validation**, so an attacker probing for valid
tokens is limited by the same budget as a legitimate viewer.

The code carries a comment recording that this was once broken in the most
dangerous way — the limiter was called, but only failed lookups were recorded,
so the happy path fed it nothing and "38 consecutive requests all returned 200".
It was caught by `scripts/test-public-rate-limit.py`, which asserts a 429
actually arrives rather than that the code exists. That is the right kind of
test for this control.

### VERIFIED — the limiter is not bypassable by spoofing `X-Forwarded-For`

The checklist calls this out specifically, and `dedupeHash()` does read the
header:

```ts
const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || …
```

Taking `[0]` of a client-supplied header is the classic bypass. **Tested against
production on 2026-09-07:**

- 36 requests with a **fixed** spoofed `X-Forwarded-For` → 429 began at
  request #32, i.e. the limit engaged after 30.
- 36 requests with **36 different** spoofed `X-Forwarded-For` values → **all 36
  returned 429.**

If the header controlled the bucket, the second run would have given each fake
IP its own budget and returned no 429s at all. It returned 429 on every request,
which means all 72 requests shared one bucket: Supabase's edge proxy sets
`X-Forwarded-For` itself and the client's value does not win. **Not bypassable.**

(Test rows — `PublicLinkHit` entries with a null document id — were deleted
afterwards; verified 0 remaining.)

### MEDIUM-1 — `invoke-llm` has a brake, not a wall

20 requests per user per 60 seconds, but the counter is a `Map` in isolate
memory. The code says so plainly:

> In-memory, so it is per-isolate rather than global — Supabase may run several,
> and an isolate recycles. That makes this a brake, not a wall.

A client that reconnects to spread requests across isolates gets a multiple of
20/min. Each call is a billed OpenAI request. The honest assessment in the
comment is right; the fix (a shared counter) is the outstanding work.

### HIGH-1 — the endpoints that cost money have no limit whatsoever

| Endpoint | Limiter | Cost of one call |
|---|---|---|
| `send-invoice-sms` | **none** | a billed Infobip/Twilio SMS |
| `send-invoice-email` | **none** | a Resend send, against domain reputation |
| `generate-invoice-pdf` | **none** | CPU, and a stored multi-MB artifact |
| `create-invoice-payment-link` | **none** | a Stripe API call |
| `stripe-create-session` | **none** | a Stripe API call |

These sit behind `requireAppAccess`, so the caller must be a paying, signed-in
user — which bounds *who* can do it, not *how much*. A single subscriber
(or one stolen session, or one runaway client-side retry loop) can:

- send unlimited SMS, each one a real charge on your Infobip account;
- send unlimited email, which is how a Resend sending domain gets blocked —
  and if that happens, invoice delivery stops for **every** contractor, not just
  the abuser;
- generate unlimited PDFs, burning CPU and storage.

The SMS path is the sharpest: it converts an application bug or one bad actor
directly into a bill, with no ceiling and no alert.

### PASS — authentication endpoints

Login, signup and password reset are `supabase.auth.signInWithPassword`,
`signUp` and OAuth, handled entirely by hosted Supabase Auth. There is no
custom auth endpoint in this codebase to leave unprotected. Supabase applies its
own per-IP limits to these; they are configured in the dashboard rather than in
this repo, so they are listed under manual verification below rather than
asserted here.

## What's at risk

Financial, not data. Nobody reads another user's rows through any of this. The
exposure is an unbounded bill (SMS, LLM, Stripe API), and a shared-reputation
failure where one abuser's email volume degrades deliverability for every
contractor on the platform.

## What's already secure

- All three public endpoints limited, persistently and globally.
- Limiter placed before token lookup, so it also throttles token guessing.
- Verified not bypassable by header spoofing.
- A regression test that asserts a real 429, written after a real failure.
- Rate-limit identity is a salted daily hash, not a stored IP — the limiter
  works without retaining third parties' IP addresses (PIPEDA).
- No custom auth endpoints to get wrong.

## Recommendations

In priority order:

1. **Limit `send-invoice-sms` and `send-invoice-email` per user.** These spend
   money and reputation. A shared counter (the `PublicLinkHit` pattern, or a
   small `RateLimit` table keyed on user + endpoint + window) is the same shape
   already proven to work here.
2. **Limit `generate-invoice-pdf` and the two Stripe-calling endpoints.**
3. **Promote `invoke-llm` from in-memory to the shared counter** so it becomes a
   wall.
4. Add a billing alert on the Infobip/Twilio and OpenAI accounts, so an
   unbounded loop is noticed in hours rather than on the invoice.
5. Confirm the Supabase Auth rate limits in the dashboard (manual).
