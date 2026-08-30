"""Confirm every deployed function BOOTS -- that its bundle loads and runs.

A function whose _shared imports failed to inline, or whose top-level code
throws, answers 500 with a boot error rather than its own response. That is
indistinguishable from "deployed fine" in the deploy output, which only reports
that the upload succeeded.

Calling a paywalled function with the anon key should produce ITS OWN rejection
(401/403 from requireAppAccess). Anything else -- especially a 500 -- means the
module did not load, and the paywall response is proof the module DID.

Usage: python scripts/test-function-boots.py
"""
import json
import sys
import urllib.request
import urllib.error

from _env import require

SUPABASE_URL = require('VITE_SUPABASE_URL').rstrip('/')
ANON = require('VITE_SUPABASE_ANON_KEY')

# (slug, body, acceptable status codes)
#
# The public three are reachable anonymously and answer 404 for a bogus token.
# The rest are behind requireAppAccess and must answer 401/403, never 500.
CASES = [
    # 410 is the shared LINK_UNAVAILABLE answer: revoked, unknown and malformed
    # credentials are all answered identically so the endpoint cannot be used to
    # probe which tokens were once real.
    ('get-public-invoice', {'token': '00000000-0000-4000-8000-000000000000'}, {410}),
    ('pay-public-invoice', {'token': '00000000-0000-4000-8000-000000000000'}, {410}),
    ('get-public-quote', {'public_id': '00000000-0000-4000-8000-000000000000'}, {410}),
    # 400 needs_confirmation: approval requires a typed name, checked before the
    # credential is even looked up, so this reveals nothing about the token.
    ('approve-quote', {'token': 'x' * 32}, {400}),
    ('send-invoice-email', {'to': 'nobody@example.com'}, {401, 402, 403}),
    ('send-invoice-sms', {'to': '+15550000000'}, {401, 402, 403}),
    ('create-invoice-payment-link', {'invoice_id': 'x'}, {401, 402, 403}),
    ('invoke-llm', {'prompt': 'x'}, {401, 402, 403}),
    # The anon key is a valid JWT, so it clears verify_jwt and reaches the
    # function's own getUserFromAuthHeader, which has no user behind it. 401 is
    # therefore proof the module loaded AND that the identity check runs before
    # anything else -- action defaults to 'preview', so a booted-but-unguarded
    # build would answer 200 or 400 here instead.
    ('stripe-cancel-subscription', {'action': 'preview'}, {401}),
]


def call(fn, body):
    req = urllib.request.Request(
        f'{SUPABASE_URL}/functions/v1/{fn}',
        data=json.dumps(body).encode('utf-8'),
        headers={
            'Authorization': f'Bearer {ANON}',
            'apikey': ANON,
            'Content-Type': 'application/json',
            'User-Agent': 'Mozilla/5.0 (boot-probe) Chrome/126 Safari/537.36',
        },
        method='POST',
    )
    try:
        with urllib.request.urlopen(req) as resp:
            return resp.status, resp.read().decode()[:300]
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()[:300]
    except Exception as e:  # noqa: BLE001
        return 0, str(e)


def main():
    ok = True
    for slug, body, expected in CASES:
        status, text = call(slug, body)
        good = status in expected
        # A boot failure is the specific thing this is looking for, so name it.
        note = ''
        if not good:
            note = ' <-- BOOT/BUNDLE FAILURE' if status >= 500 else ''
            note += f' got {status}: {text}'
        print(f'  {"PASS" if good else "FAIL"}  {slug}{note}')
        ok &= good
    print('\n' + ('ALL FUNCTIONS BOOT' if ok else 'FAILURES ABOVE'))
    sys.exit(0 if ok else 1)


if __name__ == '__main__':
    main()
