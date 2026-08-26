"""Why does SMS fail with "Authenticate"?

Twilio answers HTTP 401 with {"code": 20003, "message": "Authenticate"}, so that
string means the credentials were rejected -- not that the code is wrong. This
separates the three things that could actually be true:

  1. The deployed secret differs from .env (deploy-secrets.py never run).
  2. The credentials in .env are themselves invalid or the account is suspended.
  3. The From number is not one this account owns.

No SMS is sent. The account and number lookups are GETs.

The first check works because the Supabase Management API returns each secret as
a SHA-256 digest rather than plaintext -- so hashing the local value and
comparing tells us whether the project has the same string, without either side
revealing it.

Usage: python scripts/diagnose-twilio.py
"""
import base64
import hashlib
import json
import sys
import urllib.error
import urllib.request

from _env import require, project_ref

try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except Exception:
    pass

NAMES = ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_PHONE_NUMBER']


def get(url, headers):
    req = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(req) as r:
            return r.status, json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        raw = e.read().decode()
        try:
            return e.code, json.loads(raw)
        except ValueError:
            return e.code, raw


def main():
    sid = require('TWILIO_ACCOUNT_SID')
    tok = require('TWILIO_AUTH_TOKEN')
    num = require('TWILIO_PHONE_NUMBER')

    print('1. Is the DEPLOYED secret the same string as .env?\n')
    status, secrets = get(
        f'https://api.supabase.com/v1/projects/{project_ref()}/secrets',
        {'Authorization': 'Bearer ' + require('SUPABASE_ACCESS_TOKEN'),
         'User-Agent': 'invoicium-diagnose/1.0'},
    )
    if status >= 300:
        sys.exit(f'could not list secrets: {status} {secrets}')
    deployed = {s['name']: s.get('value', '') for s in secrets}

    in_sync = True
    for name in NAMES:
        local = require(name)
        local_hash = hashlib.sha256(local.encode()).hexdigest()
        remote_hash = deployed.get(name)
        if remote_hash is None:
            print(f'  MISSING   {name} is not set on the project at all')
            in_sync = False
            continue
        same = local_hash == remote_hash
        in_sync &= same
        print(f'  {"MATCH  " if same else "DIFFERS"}   {name}'
              f'{"" if same else "  (project has a different value than .env)"}')

    print(f'\n  -> {"deployed secrets match .env" if in_sync else "deployed secrets are OUT OF SYNC with .env"}\n')

    print('2. Are the .env credentials valid at Twilio at all?\n')
    auth = base64.b64encode(f'{sid}:{tok}'.encode()).decode()
    hdrs = {'Authorization': f'Basic {auth}', 'User-Agent': 'invoicium-diagnose/1.0'}
    status, acct = get(f'https://api.twilio.com/2010-04-01/Accounts/{sid}.json', hdrs)

    if status == 200:
        print(f'  HTTP 200 -- credentials accepted')
        print(f'    account : {acct.get("friendly_name")}')
        print(f'    status  : {acct.get("status")}')
        print(f'    type    : {acct.get("type")}')
        if acct.get('status') != 'active':
            print(f'\n  -> the account is {acct.get("status")}, which is why sending fails')
    else:
        msg = acct.get('message') if isinstance(acct, dict) else str(acct)[:200]
        code = acct.get('code') if isinstance(acct, dict) else None
        print(f'  HTTP {status} -- {msg}  (twilio code {code})')
        print('\n  -> the SID/token pair in .env is rejected by Twilio.')
        print('     Since the deployed secret ' +
              ('matches it, the same rejection happens in production.'
               if in_sync else 'differs, production may fail for a different reason.'))
        sys.exit(0)

    print('\n3. Does this account own the From number?\n')
    status, nums = get(
        f'https://api.twilio.com/2010-04-01/Accounts/{sid}/IncomingPhoneNumbers.json',
        hdrs,
    )
    if status != 200:
        print(f'  HTTP {status} -- could not list numbers: {nums}')
    else:
        owned = [n.get('phone_number') for n in nums.get('incoming_phone_numbers', [])]
        print(f'  configured From : {num}')
        print(f'  numbers owned   : {owned or "(none)"}')
        if num in owned:
            print('\n  -> the From number is owned by this account')
        else:
            print('\n  -> the From number is NOT on this account, which would fail the send')


if __name__ == '__main__':
    main()
