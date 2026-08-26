"""Hold invoices and quotes to the SAME evidence bar.

The two document types were built a week apart and it would be easy for one to
quietly have a property the other lacks. This asserts the shared contract on
both, from the anon key:

  * unknown, malformed and revoked credentials are answered BYTE FOR BYTE
    identically -- so the endpoint cannot be used to tell "this link was real
    once" from "this never existed"
  * the failure state is the friendly 410, not a 404
  * branding resolves to the OWNING business, proven with a decoy row that a
    `list()[0]` implementation would have returned instead
  * replaying a request is idempotent

Everything it creates, it deletes.

Usage: python scripts/test-public-parity.py
"""
import json
import sys
import urllib.error
import urllib.request

from _env import require
from q import run_sql

SUPABASE_URL = require('VITE_SUPABASE_URL').rstrip('/')
ANON = require('VITE_SUPABASE_ANON_KEY')

MARKER = 'ZZ-PARITY-OWNER'
UA = ('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 '
      '(KHTML, like Gecko) Chrome/126 Safari/537.36')

results = []


def check(label, cond, detail=''):
    results.append(bool(cond))
    print(f'  {"PASS" if cond else "FAIL"}  {label}'
          f'{(" -- " + detail) if detail and not cond else ""}')
    return cond


def call_raw(fn, body):
    """Return (status, raw_text) -- raw, because byte equality is the point."""
    req = urllib.request.Request(
        f'{SUPABASE_URL}/functions/v1/{fn}',
        data=json.dumps(body).encode('utf-8'),
        headers={'Authorization': f'Bearer {ANON}', 'apikey': ANON,
                 'Content-Type': 'application/json', 'User-Agent': UA},
        method='POST',
    )
    try:
        with urllib.request.urlopen(req) as r:
            return r.status, r.read().decode('utf-8')
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode('utf-8')


def sql(query):
    status, body = run_sql(query)
    if status >= 300:
        sys.exit(f'SQL failed: {status}\n{body}\n{query[:200]}')
    try:
        return json.loads(body)
    except ValueError:
        return []


def identical_failures(label, fn, key, live_credential, revoke_sql, unrevoke_sql):
    """unknown / malformed / revoked must be indistinguishable."""
    print(f'\n{label}: unknown vs malformed vs revoked')

    s_unknown, b_unknown = call_raw(fn, {key: '11111111-2222-4333-8444-555555555555'})
    s_bad, b_bad = call_raw(fn, {key: 'zzz'})

    sql(revoke_sql)
    s_revoked, b_revoked = call_raw(fn, {key: live_credential})
    sql(unrevoke_sql)

    check('revoked is 410, not 404', s_revoked == 410, f'got {s_revoked}')
    check('unknown status == revoked status', s_unknown == s_revoked,
          f'{s_unknown} vs {s_revoked}')
    check('malformed status == revoked status', s_bad == s_revoked,
          f'{s_bad} vs {s_revoked}')
    check('unknown body is BYTE-IDENTICAL to revoked', b_unknown == b_revoked,
          f'\n      unknown: {b_unknown}\n      revoked: {b_revoked}')
    check('malformed body is BYTE-IDENTICAL to revoked', b_bad == b_revoked,
          f'\n      malformed: {b_bad}\n      revoked:   {b_revoked}')
    check('the shared answer carries no document data',
          all(k not in b_revoked for k in ('"invoice"', '"quote"', '"business"', '"client"')),
          b_revoked)
    return b_revoked


def main():
    users = sql('select id, email from auth.users order by created_at')
    owner = users[0]['id']
    decoys = [r['business_name'] for r in
              sql('select user_id, business_name from public."BusinessSettings"')
              if r['user_id'] != owner]
    if not decoys:
        sys.exit('Need a BusinessSettings row owned by a different user.')
    print(f'Owner under test: {users[0]["email"]}')
    print(f'Decoy business in the table: {decoys[0]!r}')

    invoice_id = quote_id = None
    made_settings = False
    try:
        sql(f"""insert into public."BusinessSettings" (user_id, business_name, currency)
                values ('{owner}', '{MARKER}', 'CAD')""")
        made_settings = True

        inv = sql(f"""insert into public."Invoice"
                        (user_id, invoice_number, client_name, client_email, client_address,
                         items, subtotal, tax_rate, tax_amount, total, status, due_date)
                      values ('{owner}', 'ZZ-PAR-INV', 'Parity Client', 'p@example.com', '1 Test St',
                        '[{{"description":"L","quantity":1,"rate":10,"amount":10,"extra":"leak"}}]'::jsonb,
                        10, 0, 0, 10, 'sent', now() + interval '30 days')
                      returning id, public_token""")[0]
        invoice_id, token = inv['id'], inv['public_token']

        qt = sql(f"""insert into public."Quote"
                       (user_id, quote_number, client_name, client_email, items,
                        subtotal, tax_rate, tax_amount, total, status, date_issued, expiry_date)
                     values ('{owner}', 'ZZ-PAR-QTE', 'Parity Client', 'p@example.com',
                       '[{{"description":"L","quantity":1,"rate":10,"amount":10,"extra":"leak"}}]'::jsonb,
                       10, 0, 0, 10, 'sent', now(), now() + interval '30 days')
                     returning id, public_id""")[0]
        quote_id, public_id = qt['id'], qt['public_id']

        # --- Identical failure answers -----------------------------------
        inv_fail = identical_failures(
            'INVOICE', 'get-public-invoice', 'token', token,
            f"""update public."Invoice" set public_link_revoked_at = now() where id = '{invoice_id}'""",
            f"""update public."Invoice" set public_link_revoked_at = null where id = '{invoice_id}'""")

        qte_fail = identical_failures(
            'QUOTE', 'get-public-quote', 'public_id', public_id,
            f"""update public."Quote" set public_link_revoked_at = now() where id = '{quote_id}'""",
            f"""update public."Quote" set public_link_revoked_at = null where id = '{quote_id}'""")

        print('\nacross document types:')
        check('invoice and quote share the SAME failure body',
              inv_fail == qte_fail, f'\n      inv: {inv_fail}\n      qte: {qte_fail}')

        # pay must not be more informative than view.
        s_pay, b_pay = call_raw('pay-public-invoice',
                                {'token': '11111111-2222-4333-8444-555555555555'})
        check('paying an unknown token gives the same answer as viewing one',
              b_pay == inv_fail, f'\n      pay:  {b_pay}\n      view: {inv_fail}')

        # --- Branding decoy, on BOTH types --------------------------------
        print('\nbranding resolves to the owner, not list()[0]:')
        _, inv_body = call_raw('get-public-invoice', {'token': token})
        _, qte_body = call_raw('get-public-quote', {'public_id': public_id})
        for name, body in (('invoice', inv_body), ('quote', qte_body)):
            parsed = json.loads(body)
            check(f'{name} carries the owning business ({MARKER})',
                  parsed.get('business', {}).get('name') == MARKER,
                  str(parsed.get('business', {}).get('name')))
            for decoy in decoys:
                check(f'{name} payload does not contain the decoy {decoy!r}',
                      decoy not in body)
            check(f'{name} drops unknown jsonb item fields', 'leak' not in body)

        # --- Replay is idempotent -----------------------------------------
        print('\nreplay is idempotent:')
        _, a = call_raw('get-public-invoice', {'token': token})
        _, b = call_raw('get-public-invoice', {'token': token})
        check('two identical invoice reads return identical bytes', a == b)
        _, a = call_raw('get-public-quote', {'public_id': public_id})
        _, b = call_raw('get-public-quote', {'public_id': public_id})
        check('two identical quote reads return identical bytes', a == b)

        s1, p1 = call_raw('pay-public-invoice', {'token': token})
        s2, p2 = call_raw('pay-public-invoice', {'token': token})
        check('replayed pay attempts agree', (s1, p1) == (s2, p2), f'{s1}/{s2}')

        sql(f"""update public."Invoice" set last_viewed_at = null,
                 updated_at = now() - interval '10 minutes' where id = '{invoice_id}'""")
        call_raw('get-public-invoice', {'token': token, 'action': 'record_view'})
        c1 = sql(f"""select view_count from public."Invoice" where id = '{invoice_id}'""")[0]
        for _ in range(3):
            call_raw('get-public-invoice', {'token': token, 'action': 'record_view'})
        c2 = sql(f"""select view_count from public."Invoice" where id = '{invoice_id}'""")[0]
        check('three replayed views do not inflate the counter',
              c1['view_count'] == c2['view_count'],
              f'{c1["view_count"]} -> {c2["view_count"]}')

    finally:
        print('\ncleanup:')
        if invoice_id:
            sql(f"""delete from public."PublicLinkHit" where invoice_id = '{invoice_id}'""")
            sql(f"""delete from public."Invoice" where id = '{invoice_id}'""")
        if quote_id:
            sql(f"""delete from public."PublicLinkHit" where quote_id = '{quote_id}'""")
            sql(f"""delete from public."Quote" where id = '{quote_id}'""")
        if made_settings:
            sql(f"""delete from public."BusinessSettings" where business_name = '{MARKER}'""")
        sql("""delete from public."PublicLinkHit" where invoice_id is null and quote_id is null""")
        left = sql("""select (select count(*) from public."Quote") as q,
                             (select count(*) from public."PublicLinkHit") as h""")[0]
        print(f'  removed fixtures; quotes={left["q"]} hits={left["h"]}')

    ok = all(results)
    print('\n' + ('ALL PASS' if ok else 'FAILURES ABOVE'))
    sys.exit(0 if ok else 1)


if __name__ == '__main__':
    main()
