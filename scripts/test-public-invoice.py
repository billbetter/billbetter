"""Exercise get-public-invoice / pay-public-invoice as an ANONYMOUS caller.

Uses the anon key only -- the same credential a browser has -- so that a pass
here means a real client can load the page, not that the service role can.

Usage: python scripts/test-public-invoice.py
"""
import json
import sys
import urllib.request
import urllib.error

from _env import require
from q import run_sql

SUPABASE_URL = require('VITE_SUPABASE_URL').rstrip('/')
ANON = require('VITE_SUPABASE_ANON_KEY')


def call(fn, body):
    req = urllib.request.Request(
        f'{SUPABASE_URL}/functions/v1/{fn}',
        data=json.dumps(body).encode('utf-8'),
        headers={
            'Authorization': f'Bearer {ANON}',
            'apikey': ANON,
            'Content-Type': 'application/json',
            # A real browser sends one; isBotRequest() treats a missing UA as a bot.
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) '
                          'AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36',
        },
        method='POST',
    )
    try:
        with urllib.request.urlopen(req) as resp:
            return resp.status, json.loads(resp.read().decode('utf-8'))
    except urllib.error.HTTPError as e:
        raw = e.read().decode('utf-8')
        try:
            return e.code, json.loads(raw)
        except ValueError:
            return e.code, raw


def sql(query):
    status, body = run_sql(query)
    if status >= 300:
        sys.exit(f'SQL failed: {status} {body}')
    return json.loads(body)


def check(label, cond, detail=''):
    print(f'  {"PASS" if cond else "FAIL"}  {label}{(" -- " + detail) if detail and not cond else ""}')
    return cond


def main():
    rows = sql('select id, public_token, invoice_number, total, status '
               'from public."Invoice" order by created_at limit 1')
    if not rows:
        sys.exit('No invoices to test against.')
    inv = rows[0]
    token = inv['public_token']
    print(f'Testing against {inv["invoice_number"]} (token {token[:8]}...)\n')

    ok = True

    # --- The happy path ---------------------------------------------------
    print('get-public-invoice, valid token:')
    status, body = call('get-public-invoice', {'token': token})
    ok &= check('200', status == 200, f'got {status} {body}')
    ok &= check('success', body.get('success') is True, str(body))
    invoice = body.get('invoice', {})
    ok &= check('invoice number matches', invoice.get('number') == inv['invoice_number'])
    ok &= check('total matches', float(invoice.get('total', -1)) == float(inv['total']))
    ok &= check('items are a list', isinstance(invoice.get('items'), list))

    # --- The payload must not leak ---------------------------------------
    print('\nnarrowed payload:')
    flat = json.dumps(body)
    ok &= check('no invoice id', inv['id'] not in flat)
    for banned in ('user_id', 'client_id', 'client_email', 'client_phone',
                   'pdf_url', 'payment_link', 'stripe_', 'platform_fee'):
        ok &= check(f'no {banned}', banned not in flat)
    top = set(body.keys())
    ok &= check('top level is exactly the four sections',
                top == {'success', 'invoice', 'client', 'business', 'capabilities'}, str(top))
    ok &= check('invoice keys are the enumerated set',
                set(invoice.keys()) == {
                    'number', 'issue_date', 'due_date', 'status', 'payment_terms', 'notes',
                    'currency', 'items', 'subtotal', 'tax_rate', 'tax_amount', 'total',
                }, str(sorted(invoice.keys())))
    ok &= check('client keys are name+address only',
                set(body.get('client', {}).keys()) == {'name', 'address'})
    if invoice.get('items'):
        ok &= check('item keys are the enumerated four',
                    set(invoice['items'][0].keys()) == {'description', 'quantity', 'rate', 'amount'},
                    str(sorted(invoice['items'][0].keys())))

    # --- Rejections -------------------------------------------------------
    print('\nrejections:')
    status, body = call('get-public-invoice', {'token': 'not-a-uuid'})
    ok &= check('malformed token -> 410 unavailable',
                status == 410 and body.get('reason') == 'unavailable', f'{status} {body}')
    status, body = call('get-public-invoice', {'token': '00000000-0000-4000-8000-000000000000'})
    ok &= check('unknown token -> 410 unavailable',
                status == 410 and body.get('reason') == 'unavailable', f'{status} {body}')
    ok &= check('unknown token leaks no data', 'invoice' not in body)
    status, body = call('get-public-invoice', {})
    ok &= check('no token -> 410', status == 410, f'{status} {body}')

    # --- Revocation -------------------------------------------------------
    print('\nrevocation:')
    sql(f"""update public."Invoice" set public_link_revoked_at = now()
             where id = '{inv['id']}'""")
    status, body = call('get-public-invoice', {'token': token})
    ok &= check('revoked -> 410 unavailable',
                status == 410 and body.get('reason') == 'unavailable', f'{status} {body}')
    ok &= check('revoked returns NO payload', 'invoice' not in body and 'business' not in body)
    status, body = call('pay-public-invoice', {'token': token})
    ok &= check('pay on revoked -> 410', status == 410, f'{status} {body}')
    sql(f"""update public."Invoice" set public_link_revoked_at = null
             where id = '{inv['id']}'""")
    status, body = call('get-public-invoice', {'token': token})
    ok &= check('un-revoked works again', status == 200 and body.get('success') is True)

    # --- View recording ---------------------------------------------------
    print('\nview recording:')
    # Clear last_viewed_at first. Without this, the assertion below depends on
    # whether this script was last run inside the 30-minute debounce window --
    # it passed on a fresh database and failed on a re-run, which is a test
    # reporting the calendar rather than the code.
    sql(f"""update public."Invoice" set last_viewed_at = null
             where id = '{inv['id']}'""")
    before = sql(f"""select view_count, first_viewed_at from public."Invoice"
                      where id = '{inv['id']}'""")[0]
    status, body = call('get-public-invoice', {'token': token, 'action': 'record_view'})
    ok &= check('record_view 200', status == 200, f'{status} {body}')
    after = sql(f"""select view_count, first_viewed_at from public."Invoice"
                     where id = '{inv['id']}'""")[0]
    ok &= check('view_count advanced', after['view_count'] > before['view_count'],
                f'{before["view_count"]} -> {after["view_count"]} (outcome={body.get("outcome")})')
    ok &= check('first_viewed_at set', after['first_viewed_at'] is not None)

    # The debounce is the other half of the same behaviour, so prove it rather
    # than inferring it from a failure.
    status, body = call('get-public-invoice', {'token': token, 'action': 'record_view'})
    again = sql(f"""select view_count, last_viewed_at from public."Invoice"
                     where id = '{inv['id']}'""")[0]
    ok &= check('immediate re-view is debounced', body.get('outcome') == 'debounced', str(body))
    ok &= check('debounced view does NOT increment the counter',
                again['view_count'] == after['view_count'],
                f'{after["view_count"]} -> {again["view_count"]}')
    ok &= check('debounced view DOES move last_viewed_at', again['last_viewed_at'] is not None)

    status, body = call('get-public-invoice',
                        {'token': token, 'action': 'record_view', 'preview': True})
    ok &= check('preview does not count', body.get('outcome') == 'skipped_preview', str(body))

    debounced = sql(f"""select view_count from public."Invoice" where id = '{inv['id']}'""")[0]
    ok &= check('preview really left the counter alone',
                debounced['view_count'] == after['view_count'])

    # --- Payment ----------------------------------------------------------
    #
    # STRIPE_SECRET_KEY is a LIVE key, so this deliberately does not exercise
    # the success branch: it asserts the refusal instead. The connected account
    # is 'restricted', and buildInvoiceCheckoutSession refuses rather than
    # quietly charging the PLATFORM account -- which would take the client's
    # money into our balance and tell the contractor their invoice was settled.
    #
    # The success branch is therefore UNPROVEN end to end. It cannot be proven
    # without either a test-mode key or an active connected account.
    print('\npayment refusal (account is restricted, live Stripe key):')
    settings = sql("""select stripe_account_status from public."BusinessSettings" limit 1""")[0]
    status, body = call('pay-public-invoice', {'token': token})
    if settings['stripe_account_status'] == 'active':
        print('  SKIP  account is active -- not creating a live Stripe session from a test')
    else:
        ok &= check('pay refused with 409', status == 409, f'{status} {body}')
        ok &= check('reason is not_connected', body.get('reason') == 'not_connected', str(body))
        ok &= check('client is told nothing about our fee', 'platform_fee' not in json.dumps(body))
        cap = call('get-public-invoice', {'token': token})[1].get('capabilities', {})
        ok &= check('page hides the Pay button', cap.get('can_pay_online') is False, str(cap))

    # --- Fee stamping (decision 4) ---------------------------------------
    print('\nfee rate stamping:')
    ok &= check('platform_fee_percent column exists and is readable',
                'platform_fee_percent' in sql(
                    """select * from public."Invoice" limit 1""")[0])

    hits = sql(f"""select count(*) as n from public."PublicLinkHit"
                    where invoice_id = '{inv['id']}'""")[0]['n']
    ok &= check('hits were logged', int(hits) > 0, f'{hits} rows')
    unknown = sql("""select count(*) as n from public."PublicLinkHit" where invoice_id is null""")[0]['n']
    ok &= check('unknown-token attempts logged for the limiter', int(unknown) > 0, f'{unknown} rows')
    ips = sql("""select count(*) as n from public."PublicLinkHit"
                  where dedupe_hash ~ '^[0-9]{1,3}\\.[0-9]{1,3}\\.'""")[0]['n']
    ok &= check('no raw IPs stored', int(ips) == 0, f'{ips} rows look like IPs')

    print('\n' + ('ALL PASS' if ok else 'FAILURES ABOVE'))
    sys.exit(0 if ok else 1)


if __name__ == '__main__':
    main()
