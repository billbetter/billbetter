"""Prove the public-link rate limiter actually fires.

Separate from test-public-invoice.py because it deliberately burns the caller's
allowance, which would make every later assertion in that file fail. Run it
last, or on its own.

A limit that never trips is indistinguishable in the source from one that works.
This is the "must be able to pass AND fail, and you must prove both" rule from
docs/invoice-links-plan.md applied to a runtime control rather than a CI check.

Usage: python scripts/test-public-rate-limit.py
"""
import json
import sys
import urllib.request
import urllib.error

from _env import require
from q import run_sql

SUPABASE_URL = require('VITE_SUPABASE_URL').rstrip('/')
ANON = require('VITE_SUPABASE_ANON_KEY')

# _shared/public-link.ts: RATE_MAX_PER_WINDOW = 30 in a 60s window.
LIMIT = 30


def call(token):
    req = urllib.request.Request(
        f'{SUPABASE_URL}/functions/v1/get-public-invoice',
        data=json.dumps({'token': token}).encode('utf-8'),
        headers={
            'Authorization': f'Bearer {ANON}',
            'apikey': ANON,
            'Content-Type': 'application/json',
            'User-Agent': 'Mozilla/5.0 (rate-limit-probe) Chrome/126 Safari/537.36',
        },
        method='POST',
    )
    try:
        with urllib.request.urlopen(req) as resp:
            return resp.status, json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        raw = e.read().decode()
        try:
            return e.code, json.loads(raw)
        except ValueError:
            return e.code, raw


def main():
    status, body = run_sql('select public_token from public."Invoice" limit 1')
    token = json.loads(body)[0]['public_token']

    print(f'Firing {LIMIT + 8} requests at get-public-invoice '
          f'(limit is {LIMIT}/60s)...')

    first_429 = None
    for n in range(1, LIMIT + 9):
        code, payload = call(token)
        if code == 429:
            first_429 = n
            print(f'  request {n}: 429 {payload.get("reason")}')
            break
        if code != 200:
            sys.exit(f'  request {n}: unexpected {code} {payload}')

    if first_429 is None:
        print(f'\nFAIL: {LIMIT + 8} requests all returned 200. The limiter does '
              'not fire, which means it is not a limiter.')
        sys.exit(1)

    # It must not fire absurdly early either -- a limiter that rejects the
    # second request would "pass" a naive version of this test while breaking
    # every real page load.
    if first_429 <= 2:
        print(f'\nFAIL: first 429 at request {first_429} -- far too early.')
        sys.exit(1)

    print(f'\nPASS: limiter fired at request {first_429} '
          f'(expected just after {LIMIT}).')
    print('Note: this consumed the allowance for this IP+UA for up to 60s.')


if __name__ == '__main__':
    main()
