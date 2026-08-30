"""Prove the Infobip credential and host BEFORE anything is deployed.

The instrument, not the fix. diagnose-twilio.py is how the 20003 "Authenticate"
failure was found rather than guessed at, and this is the same thing for the
replacement -- so a bad key or a wrong host is a two-minute answer instead of a
day spent reading edge-function logs.

It separates the four things that could actually be true:

  1. The deployed secret differs from .env (deploy-secrets.py never run).
  2. INFOBIP_BASE_URL is not this account's host. Infobip issues every account
     its own (https://<account>.api.infobip.com); the shared api.infobip.com
     answers with an auth error that reads exactly like a bad key.
  3. The API key itself is rejected.
  4. INFOBIP_SENDER is not something this account can send from.

NO SMS IS SENT. Every call is a GET.

The deployed-secret check works because the Supabase Management API returns each
secret as a SHA-256 digest rather than plaintext -- so hashing the local value
and comparing tells us whether the project holds the same string, without either
side revealing it.

Usage: python scripts/diagnose-infobip.py
"""
import hashlib
import json
import re
import sys
import urllib.error
import urllib.request

from _env import require, ENV, project_ref

try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except Exception:
    pass

NAMES = ['SMS_PROVIDER', 'INFOBIP_API_KEY', 'INFOBIP_BASE_URL', 'INFOBIP_SENDER']


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
    except Exception as e:  # DNS failure on a mistyped host lands here
        return 0, str(e)


def normalize_base_url(raw):
    """Mirrors normalizeBaseUrl() in _shared/sms.ts, so this tests what ships."""
    trimmed = raw.strip().rstrip('/')
    if not re.match(r'^https?://', trimmed, re.I):
        trimmed = 'https://' + trimmed
    return trimmed


def infobip_error(payload):
    """Pull the human-readable reason out of an Infobip error envelope."""
    if isinstance(payload, dict):
        ex = (payload.get('requestError') or {}).get('serviceException') or {}
        return ex.get('text') or ex.get('messageId') or json.dumps(payload)[:200]
    return str(payload)[:200]


def main():
    key = require('INFOBIP_API_KEY')
    base = normalize_base_url(require('INFOBIP_BASE_URL'))
    sender = require('INFOBIP_SENDER')
    provider = ENV.get('SMS_PROVIDER') or 'infobip'

    print(f'SMS_PROVIDER    : {provider}')
    print(f'INFOBIP_BASE_URL: {base}')
    print(f'INFOBIP_SENDER  : {sender}\n')

    if provider != 'infobip':
        print(f'  NOTE  SMS_PROVIDER is {provider!r}, so the deployed functions are NOT')
        print('        using Infobip right now. The checks below still test the key.\n')

    # -- 0. Is the host account-specific? ---------------------------------
    #
    # Cheap, offline, and catches the mistake that costs the most time: the
    # generic host authenticates nobody, and its 401 is indistinguishable from
    # a bad key.
    print('0. Does the base URL look account-specific?\n')
    host = base.split('://', 1)[-1]
    if host.lower() in ('api.infobip.com', 'www.infobip.com'):
        print(f'  WRONG   {host} is the generic host, not your account host.')
        print('          Infobip issues each account its own, shown on the API')
        print('          key page as https://<something>.api.infobip.com.')
        print('          Everything below will fail with what looks like a bad key.\n')
    elif not host.endswith('.api.infobip.com'):
        print(f'  UNUSUAL {host} does not end in .api.infobip.com -- double-check it.\n')
    else:
        print(f'  OK      {host} looks account-specific\n')

    # -- 1. Deployed vs .env ----------------------------------------------
    print('1. Is the DEPLOYED secret the same string as .env?\n')
    status, secrets = get(
        f'https://api.supabase.com/v1/projects/{project_ref()}/secrets',
        {'Authorization': 'Bearer ' + require('SUPABASE_ACCESS_TOKEN'),
         'User-Agent': 'invoicium-diagnose/1.0'},
    )
    if status >= 300 or not isinstance(secrets, list):
        print(f'  could not list secrets: {status} {str(secrets)[:200]}\n')
        in_sync = None
    else:
        deployed = {s['name']: s.get('value', '') for s in secrets}
        in_sync = True
        for name in NAMES:
            local = ENV.get(name) or ''
            if not local:
                print(f'  ABSENT    {name} is not in .env')
                in_sync = False
                continue
            remote = deployed.get(name)
            if remote is None:
                print(f'  MISSING   {name} is not set on the project at all')
                in_sync = False
                continue
            same = hashlib.sha256(local.encode()).hexdigest() == remote
            in_sync &= same
            print(f'  {"MATCH  " if same else "DIFFERS"}   {name}'
                  f'{"" if same else "  (project has a different value than .env)"}')
        print(f'\n  -> {"deployed secrets match .env" if in_sync else "deployed secrets are OUT OF SYNC with .env -- run deploy-secrets.py"}\n')

    # -- 2. Is the key valid? ---------------------------------------------
    #
    # /account/1/balance is read-only and sends nothing. A 401 here is the
    # Infobip equivalent of Twilio's 20003.
    print('2. Does Infobip accept the API key?\n')
    hdrs = {
        'Authorization': f'App {key}',   # the literal word App, not Bearer
        'Accept': 'application/json',
        'User-Agent': 'invoicium-diagnose/1.0',
    }
    status, balance = get(f'{base}/account/1/balance', hdrs)

    if status == 200:
        print('  HTTP 200 -- key accepted')
        if isinstance(balance, dict):
            print(f'    balance  : {balance.get("balance")} {balance.get("currency", "")}')
            if isinstance(balance.get('balance'), (int, float)) and balance['balance'] <= 0:
                print('\n  -> balance is zero, so sends will be REJECTED even though the key works.')
    elif status == 0:
        print(f'  could not reach {base} -- {balance}')
        print('\n  -> the host is wrong or unreachable. Check INFOBIP_BASE_URL.')
        sys.exit(1)
    else:
        print(f'  HTTP {status} -- {infobip_error(balance)}')
        print('\n  -> the API key or the base URL is rejected.')
        if in_sync:
            print('     The deployed secret matches .env, so production fails the same way.')
        elif in_sync is False:
            print('     The deployed secret differs, so production may fail differently.')
        sys.exit(1)

    # -- 3. Can the account send from INFOBIP_SENDER? ---------------------
    #
    # The alphanumeric-sender trap, checked BEFORE the network call because it
    # is the likeliest first-send failure and the most misleading one.
    #
    # Alphanumeric sender IDs ("BillBetter") are not supported for US or
    # Canadian destinations -- carriers reject them. The rejection arrives as
    # groupName REJECTED inside an HTTP 200, which _shared/sms.ts correctly
    # turns into a throw. So the symptom is "the new code is failing" when layer
    # 3 is in fact working perfectly and the SENDER VALUE is wrong. That is an
    # hour lost to reading the wrong file.
    print('\n3. Is the configured sender usable?\n')

    digits = re.sub(r'\D', '', sender)
    if not re.fullmatch(r'\+?\d+', sender.strip()):
        print(f'  WRONG   {sender!r} is alphanumeric.')
        print('          Alphanumeric sender IDs are NOT supported for Canadian or')
        print('          US destinations -- carriers reject them. Every send will')
        print('          come back groupName=REJECTED inside an HTTP 200, which')
        print('          sms.ts turns into a throw. That failure will LOOK like the')
        print('          new code and is actually this value.')
        print('          Use a numeric long code / toll-free number you own.\n')
    elif len(digits) < 10:
        print(f'  UNUSUAL {sender!r} has only {len(digits)} digits -- expected an')
        print('          E.164 number such as +1XXXXXXXXXX.\n')
    else:
        print(f'  OK      {sender} is numeric, which is what NANP destinations need\n')
    status, senders = get(f'{base}/sms/2/sender-ids', hdrs)
    if status == 200 and isinstance(senders, dict):
        known = [s.get('senderId') or s.get('sender')
                 for s in (senders.get('results') or senders.get('senderIds') or [])]
        known = [k for k in known if k]
        print(f'  configured sender : {sender}')
        print(f'  registered senders: {known or "(none returned)"}')
        if known and sender not in known:
            print(f'\n  -> {sender} is NOT registered on this account. Sends may be')
            print('     rejected, or silently rewritten to a default.')
        elif known:
            print('\n  -> the configured sender is registered on this account')
    else:
        # Not every plan exposes this endpoint; a failure here is informational.
        print(f'  HTTP {status} -- could not list sender IDs ({infobip_error(senders)})')
        print('  (not conclusive: some accounts do not expose this endpoint)')

    print('\n---')
    print('No SMS was sent. To prove delivery, send one from the app to a handset')
    print('you control -- that is the only check this script cannot perform.')
    print('\nNote: A2P 10DLC is a US carrier requirement keyed on the RECIPIENT and')
    print('is unaffected by which provider we use. Canadian recipients do not need')
    print('it; US ones do, and Infobip carries the identical obligation.')


if __name__ == '__main__':
    main()
