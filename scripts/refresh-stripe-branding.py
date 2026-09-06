"""Push the current brand assets to Stripe and re-point every connected account.

With Connect direct charges the client checks out on the CONTRACTOR's account,
so the hosted Checkout page renders that account's branding -- not the
platform's. stripe-connect-onboard therefore copies platform branding onto each
account as it is created.

That copy happened once, at onboarding, which left two gaps a rebrand falls
straight through:

  * accounts onboarded before the rebrand keep pointing at the old file, and
  * the old file stayed the newest one with its purpose, so it kept being
    reused for new accounts too.

The onboarding function now uploads fresh and re-applies every time, which
closes both going forward. This script is the backfill for accounts already out
there -- and the tool to run after any future logo change.

One file cannot serve two accounts: attaching it consumes it, and the next
account gets "That file is already attached to something else." So every account
gets its own upload. Stripe also re-encodes branding images, so the size it
reports back is not the size that was sent -- there is no content comparison
available to skip work with. Re-running therefore re-uploads; that is cheap and
harmless, and the result is the same either way.

Usage: python scripts/refresh-stripe-branding.py [--dry-run]
"""
import base64
import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request
import uuid

from _env import ENV, require

# Must stay in step with PLATFORM_BRANDING in supabase/functions/_shared/stripe.ts.
PRIMARY_COLOR = '#0369A1'
SECONDARY_COLOR = '#0EA5E9'

# (Stripe file purpose, branding field, asset path) -- the same pair the
# onboarding function uploads.
ASSETS = [
    ('business_icon', 'icon', '/logo-icon.png'),
    ('business_logo', 'logo', '/logo-full.png'),
]

API = 'https://api.stripe.com/v1'
FILES_API = 'https://files.stripe.com/v1/files'

DRY_RUN = '--dry-run' in sys.argv


def auth_header():
    sk = require('STRIPE_SECRET_KEY')
    return 'Basic ' + base64.b64encode((sk + ':').encode()).decode()


def app_url():
    return (os.environ.get('APP_BASE_URL') or ENV.get('APP_BASE_URL')
            or 'https://www.invoicium.ca').rstrip('/')


def call(method, path, params=None):
    """Form-encoded Stripe call against the platform account."""
    data = urllib.parse.urlencode(params).encode() if params else None
    headers = {'Authorization': auth_header()}
    if data:
        headers['Content-Type'] = 'application/x-www-form-urlencoded'
    req = urllib.request.Request(API + path, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req) as resp:
            return json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        body = e.read().decode()
        try:
            msg = json.loads(body)['error']['message']
        except Exception:
            msg = body[:300]
        raise StripeError(f'{e.code} {msg}')


class StripeError(Exception):
    pass


def upload(blob, filename, purpose):
    """Multipart upload as the PLATFORM.

    Deliberately no Stripe-Account header: branding files must be owned by the
    platform or attaching them fails with "No such file upload".
    """
    boundary = '----invoicium' + uuid.uuid4().hex
    pre = (
        f'--{boundary}\r\n'
        f'Content-Disposition: form-data; name="purpose"\r\n\r\n{purpose}\r\n'
        f'--{boundary}\r\n'
        f'Content-Disposition: form-data; name="file"; filename="{filename}"\r\n'
        f'Content-Type: image/png\r\n\r\n'
    ).encode()
    body = pre + blob + f'\r\n--{boundary}--\r\n'.encode()
    req = urllib.request.Request(
        FILES_API,
        data=body,
        headers={
            'Authorization': auth_header(),
            'Content-Type': f'multipart/form-data; boundary={boundary}',
        },
        method='POST',
    )
    try:
        with urllib.request.urlopen(req) as resp:
            return json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        raise StripeError(f'upload {filename}: {e.code} {e.read().decode()[:300]}')


def fetch_asset(path):
    req = urllib.request.Request(app_url() + path,
                                 headers={'User-Agent': 'invoicium-brand/1.0'})
    with urllib.request.urlopen(req) as resp:
        return resp.read()


def upload_brand_files():
    """One fresh platform-owned copy of each brand asset, for a single account."""
    out = {}
    for purpose, field, path in ASSETS:
        blob = fetch_asset(path)
        if DRY_RUN:
            print(f'    {field:5} WOULD UPLOAD {path} ({len(blob)} bytes)')
            out[field] = None
            continue
        f = upload(blob, path.lstrip('/'), purpose)
        print(f'    {field:5} {f["id"]}  ({len(blob)} bytes sent)')
        out[field] = f['id']
    return out


def all_accounts():
    out, starting_after = [], None
    while True:
        q = '/accounts?limit=100' + (f'&starting_after={starting_after}' if starting_after else '')
        page = call('GET', q)
        out.extend(page.get('data', []))
        if not page.get('has_more'):
            return out
        starting_after = page['data'][-1]['id']


def main():
    print(f'app: {app_url()}   {"(DRY RUN)" if DRY_RUN else ""}')

    accounts = all_accounts()
    print(f'\nConnected accounts: {len(accounts)}')

    failures = []
    for acct in accounts:
        aid = acct['id']
        name = (acct.get('business_profile') or {}).get('name') or '(unnamed)'
        print(f'  {aid}  {name}')
        try:
            files = upload_brand_files()
            params = {
                'settings[branding][primary_color]': PRIMARY_COLOR,
                'settings[branding][secondary_color]': SECONDARY_COLOR,
            }
            for field in ('icon', 'logo'):
                if files.get(field):
                    params[f'settings[branding][{field}]'] = files[field]
            if DRY_RUN:
                print('    WOULD UPDATE branding')
                continue
            call('POST', f'/accounts/{aid}', params)
            print('    updated')
        except StripeError as e:
            # One account failing must not strand the rest.
            failures.append((aid, str(e)))
            print(f'    FAILED: {e}')

    if DRY_RUN:
        print('\nDry run only; nothing was written.')
    elif failures:
        print(f'\nDone, with {len(failures)} failure(s):')
        for aid, err in failures:
            print(f'  {aid}: {err}')
        sys.exit(1)
    else:
        print('\nDone.')


if __name__ == '__main__':
    main()
