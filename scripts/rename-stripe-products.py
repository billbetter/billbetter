"""Rename the live Stripe products from the old brand to Invoicium.

The plan names are customer-visible: they print on every receipt and invoice
Stripe sends, and they head the billing portal. Renaming them is the only part
of the rebrand that cannot be done by editing a file, because the strings live
in the Stripe account, not in this repo.

Safe to run because nothing keys off the product NAME except
`planFromSubscription` in supabase/functions/stripe-webhook/index.ts, which
lowercases the name and looks for the plan word inside it -- "Invoicium Core"
still contains "core". Price IDs, product IDs and the `plan_id` metadata are
untouched, so src/config/plans.js keeps matching.

Run with --apply to write; without it the script only reports what it would do.

    python scripts/rename-stripe-products.py            # dry run
    python scripts/rename-stripe-products.py --apply    # perform the rename
"""
import json
import sys
import urllib.error
import urllib.parse
import urllib.request

from _env import require

KEY = require('STRIPE_SECRET_KEY')
APPLY = '--apply' in sys.argv

# Every brand this codebase has shipped under, mapped onto the current one.
OLD_BRANDS = ('BillBetter', 'AxisBill', 'AxisPay')
NEW_BRAND = 'Invoicium'

# The business profile is customer-visible too -- Stripe prints it on receipts
# and on the hosted checkout page -- but it CANNOT be set from here: POST
# /v1/account 403s with "you may only use it on connected accounts". It is a
# dashboard-only edit, so the script reports it instead of trying.
DASHBOARD_URL = 'https://dashboard.stripe.com/settings/account'


def call(path, data=None):
    req = urllib.request.Request(
        f'https://api.stripe.com/v1/{path}',
        data=urllib.parse.urlencode(data).encode() if data else None,
        headers={'Authorization': f'Bearer {KEY}'},
        method='POST' if data else 'GET',
    )
    try:
        with urllib.request.urlopen(req) as resp:
            return json.loads(resp.read())
    except urllib.error.HTTPError as err:
        body = err.read().decode()
        raise SystemExit(f'Stripe {path} failed ({err.code}): {body}')


def rebrand(name):
    for old in OLD_BRANDS:
        name = name.replace(old, NEW_BRAND)
    return name


mode = 'APPLY' if APPLY else 'DRY RUN'
print(f'[{mode}] key {KEY[:12]}... '
      f'({"LIVE" if KEY.startswith("sk_live") else "test"} mode)\n')

products = call('products?limit=100')['data']
pending = [p for p in products if rebrand(p['name']) != p['name']]

if not pending:
    print('Products: nothing to rename.')
else:
    for p in pending:
        print(f'  {p["id"]}  {p["name"]!r} -> {rebrand(p["name"])!r}')
    if APPLY:
        for p in pending:
            updated = call(f'products/{p["id"]}', {'name': rebrand(p['name'])})
            print(f'  renamed {updated["id"]} -> {updated["name"]!r}')

profile = call('account').get('business_profile') or {}
name, url = profile.get('name') or '', profile.get('url') or ''
print(f'\nBusiness profile: name={name!r} url={url!r}')
if rebrand(name) != name or 'invoicium' not in url.lower():
    print(f'  STILL BRANDED, and not fixable from the API. Set the name to')
    print(f'  {NEW_BRAND!r} and the url to \'https://invoicium.ca\' by hand at')
    print(f'  {DASHBOARD_URL}')
else:
    print('  clean.')

if not APPLY:
    print('\nNo product was changed. Re-run with --apply to perform the rename.')
