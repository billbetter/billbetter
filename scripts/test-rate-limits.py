"""Prove the per-user rate limiter actually fires, and drains.

A limit that never trips is indistinguishable in the source from one that
works. The public limiter was once broken in exactly that way -- the check ran,
the recording sat on a branch the happy path never reached, and 38 consecutive
requests all returned 200. scripts/test-public-rate-limit.py exists because
asserting a real 429 arrives is the only test that catches that. This is the
same test for the authenticated side.

-- Why it probes generate-invoice-pdf and nothing else -----------------------

The five limited endpoints all spend money. A test that proved send-invoice-sms
limits at 15/min would do so by SENDING FIFTEEN REAL TEXT MESSAGES to a real
client's phone, on a real Infobip bill, every time anyone ran it. That is not a
test, it is an incident with an exit code.

generate-invoice-pdf is limited by the same shared counter, through the same
enforceRateLimit() call, and costs only CPU. If the counter fires here it fires
everywhere: what differs per endpoint is the number in RATE_LIMITS, not the
mechanism. The budgets for the paid endpoints are asserted against that table
statically instead, below.

-- What "drains" means and why it is checked -------------------------------

enforceRateLimit records only requests it ALLOWS. That is deliberate: counting
rejections would let a client that keeps retrying hold its own window full
forever, turning a 60-second budget into a permanent lockout. The consequence
is testable -- after the window passes, the caller must be able to proceed
again -- and it is the half of the behaviour a naive limiter gets wrong.

Usage: python scripts/test-rate-limits.py [--skip-drain]

--skip-drain omits the 65-second wait. Do that only when iterating; the drain
check is the one that proves a contractor is not locked out for good.
"""
import json
import sys
import time
import urllib.request
import urllib.error

from _env import require
from _session import session_for

SUPABASE_URL = require('VITE_SUPABASE_URL').rstrip('/')
ANON = require('VITE_SUPABASE_ANON_KEY')
OWNER = 'zbagzat9@gmail.com'

# Must match RATE_LIMITS in supabase/functions/_shared/rate-limit.ts.
PROBE_ENDPOINT = 'generate-invoice-pdf'
PROBE_LIMIT = 60
PROBE_WINDOW_S = 60

# The budgets this test cannot exercise without spending money. Checked against
# the source so that a number changed in one place and not the other is caught
# here rather than on the Infobip invoice.
EXPECTED_BUDGETS = {
    'send-invoice-sms': 15,
    'send-quote-sms': 15,
    'send-invoice-email': 40,
    'send-quote-email': 40,
    'generate-invoice-pdf': 60,
    'create-invoice-payment-link': 30,
    'stripe-create-session': 10,
    'invoke-llm': 20,
}


def call(token, payload):
    req = urllib.request.Request(
        f'{SUPABASE_URL}/functions/v1/{PROBE_ENDPOINT}',
        data=json.dumps(payload).encode('utf-8'),
        headers={
            'Authorization': f'Bearer {token}',
            'apikey': ANON,
            'Content-Type': 'application/json',
        },
        method='POST',
    )
    try:
        with urllib.request.urlopen(req) as resp:
            return resp.status, resp.headers, json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        raw = e.read().decode()
        try:
            return e.code, e.headers, json.loads(raw)
        except ValueError:
            return e.code, e.headers, raw


def check_budgets_match_source():
    """The per-minute max in rate-limit.ts must match EXPECTED_BUDGETS."""
    import os
    import re
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    path = os.path.join(root, 'supabase', 'functions', '_shared', 'rate-limit.ts')
    with open(path, 'r', encoding='utf-8') as f:
        src = f.read()

    problems = []
    for endpoint, expected in EXPECTED_BUDGETS.items():
        # The first { windowMs: 60_000, max: N } after the endpoint's key.
        m = re.search(
            re.escape(f"'{endpoint}': [") + r".*?windowMs:\s*60_000,\s*max:\s*(\d+)",
            src,
            re.S,
        )
        if not m:
            problems.append(f'  {endpoint}: no 60s budget found in rate-limit.ts')
            continue
        actual = int(m.group(1))
        if actual != expected:
            problems.append(
                f'  {endpoint}: rate-limit.ts says {actual}/min, this test expects {expected}'
            )

    if problems:
        print('FAIL: budgets in rate-limit.ts do not match this test:')
        print('\n'.join(problems))
        print('\nIf the change was intentional, update EXPECTED_BUDGETS here too.')
        sys.exit(1)
    print(f'PASS: all {len(EXPECTED_BUDGETS)} budgets match rate-limit.ts.')


def main():
    skip_drain = '--skip-drain' in sys.argv

    check_budgets_match_source()

    sess = session_for(OWNER)
    token = sess['access_token']
    # Minimal payload: the limiter runs before any of this is read, so it does
    # not need to be a real invoice. A 200 or a 500 both mean "not limited".
    payload = {'invoice': {'invoice_number': 'RATE-PROBE', 'items': []}, 'settings': {}}

    print(f'\nFiring {PROBE_LIMIT + 5} requests at {PROBE_ENDPOINT} '
          f'(limit is {PROBE_LIMIT}/{PROBE_WINDOW_S}s)...')

    first_429 = None
    retry_after = None
    for n in range(1, PROBE_LIMIT + 6):
        code, headers, body = call(token, payload)
        if code == 429:
            first_429 = n
            retry_after = headers.get('Retry-After')
            print(f'  request {n}: 429  Retry-After={retry_after}  {body}')
            break
        if code in (401, 402):
            sys.exit(f'  request {n}: {code} {body} -- the probe account cannot '
                     'reach this endpoint, so nothing was proved.')

    if first_429 is None:
        print(f'\nFAIL: {PROBE_LIMIT + 5} requests and no 429. The limiter does '
              'not fire, which means it is not a limiter.')
        sys.exit(1)

    # It must not fire absurdly early either -- a limiter that rejects the
    # second request would "pass" a naive version of this test while breaking
    # every real page load.
    if first_429 <= PROBE_LIMIT // 2:
        print(f'\nFAIL: first 429 at request {first_429}, far below the '
              f'{PROBE_LIMIT} budget. Legitimate use would be blocked.')
        sys.exit(1)

    if not retry_after:
        print('\nFAIL: 429 carried no Retry-After header, so a client has '
              'nothing to back off against.')
        sys.exit(1)

    print(f'PASS: limiter fired at request {first_429} (budget is {PROBE_LIMIT}).')

    if skip_drain:
        print('\nSKIPPED the drain check (--skip-drain).')
        return

    wait = PROBE_WINDOW_S + 5
    print(f'\nWaiting {wait}s for the window to drain...')
    time.sleep(wait)

    code, _, body = call(token, payload)
    if code == 429:
        print('\nFAIL: still 429 after the window elapsed. The limiter is a '
              'lockout, not a rate limit -- most likely it is recording '
              'rejected requests as hits.')
        sys.exit(1)

    print(f'PASS: allowed again after the window ({code}).')
    print('\nAll rate-limit checks passed.')


if __name__ == '__main__':
    main()
