"""Exercise the DECLINE path, and the bug the declined/rejected split caused.

The decline branch has never run against live, exactly as approve had not
before it was proven. A passing boot test says the module loaded; it says
nothing about whether a decline lands, what word it writes, or whether the
guards downstream of it actually hold.

-- The assertion that matters ---------------------------------------------

Two spellings existed for one state. The contractor's UI wrote and read
'declined'; PublicQuote.jsx and approve-quote read 'rejected'. approve-quote
guarded 'approved' and 'rejected' and NOT 'declined' -- so a quote the
contractor had declined could still be approved by a client. This proves the
whole sequence end to end:

    decline  ->  status is literally 'declined' in the database
             ->  approve on that same quote is REFUSED
             ->  and the refusal did not quietly rewrite the row

A test that only checked "decline returns success" would have passed against
the broken build.

Everything it creates, it deletes.

Usage: python scripts/test-quote-decline.py
"""
import json
import sys
import urllib.error
import urllib.request

from _env import require
from q import run_sql

SUPABASE_URL = require('VITE_SUPABASE_URL').rstrip('/')
ANON = require('VITE_SUPABASE_ANON_KEY')

MARKER = 'ZZ-DECLINE-OWNER'

try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except Exception:
    pass


def call(fn, body):
    req = urllib.request.Request(
        f'{SUPABASE_URL}/functions/v1/{fn}',
        data=json.dumps(body).encode('utf-8'),
        headers={
            'Authorization': f'Bearer {ANON}',
            'apikey': ANON,
            'Content-Type': 'application/json',
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
        sys.exit(f'SQL failed: {status}\n{body}\nquery: {query[:200]}')
    return json.loads(body)


results = []


def check(label, cond, detail=''):
    results.append(bool(cond))
    print(f'  {"PASS" if cond else "FAIL"}  {label}'
          f'{(" -- " + detail) if detail and not cond else ""}')
    return cond


def make_quote(owner, number, status='sent'):
    rows = sql(f"""insert into public."Quote"
                     (user_id, quote_number, client_name, client_email, items,
                      subtotal, tax_rate, tax_amount, total, status,
                      date_issued, expiry_date)
                   values
                     ('{owner}', '{number}', 'Test Client', 'client@example.com',
                      '[{{"description":"Test line","quantity":1,"rate":900,"amount":900}}]'::jsonb,
                      900, 0, 0, 900, '{status}',
                      now() - interval '2 days', now() + interval '30 days')
                   returning id, public_id, approval_token""")
    return rows[0]


def row(quote_id):
    return sql(f"""select status, approved_by_name, approved_at,
                          declined_by_name, declined_at, decline_reason
                     from public."Quote" where id = '{quote_id}'""")[0]


def main():
    users = sql('select id, email from auth.users order by created_at')
    owner = users[0]['id']
    print(f'Owner under test: {users[0]["email"]}\n')

    made = []
    made_settings = False
    try:
        sql(f"""insert into public."BusinessSettings"
                  (user_id, business_name, phone, currency)
                values ('{owner}', '{MARKER}', '+15550000009', 'CAD')""")
        made_settings = True

        # ------------------------------------------------------------------
        # 1. The confirmation is enforced by the FUNCTION, not the form.
        # ------------------------------------------------------------------
        q = make_quote(owner, 'ZZ-DEC-001')
        made.append(q['id'])
        pid = q['public_id']

        print('the decline confirmation is server-side:')
        status, body = call('approve-quote', {'public_id': pid, 'action': 'decline'})
        check('decline with NO name is refused', status == 400, f'{status} {body}')
        check('and it asks for confirmation',
              body.get('needs_confirmation') is True, str(body))
        check('the nameless attempt changed nothing',
              row(q['id'])['status'] == 'sent', str(row(q['id'])))

        status, body = call('approve-quote',
                            {'public_id': pid, 'action': 'decline', 'responder_name': 'X'})
        check('a one-character name is refused too', status == 400, f'{status} {body}')
        check('still unchanged', row(q['id'])['status'] == 'sent')

        # ------------------------------------------------------------------
        # 2. A decline lands, and writes the word the whole app reads.
        # ------------------------------------------------------------------
        print('\ndecline lands, with the record attached:')
        status, body = call('approve-quote', {
            'public_id': pid,
            'action': 'decline',
            'responder_name': 'Dana Marchetti',
            'decline_reason': 'Going with another quote this time.',
        })
        check('decline succeeds', status == 200 and body.get('success') is True,
              f'{status} {body}')
        check('response says declined, not approved',
              body.get('action') == 'declined', str(body.get('action')))

        after = row(q['id'])
        # THE assertion. Not "a terminal status" -- the literal word, because
        # 'rejected' would have satisfied a looser check and broken every list,
        # filter, badge and stat card on the contractor's side.
        check("status is literally 'declined' in the DATABASE",
              after['status'] == 'declined', f'got {after["status"]!r}')
        check('the decliner name is recorded',
              after['declined_by_name'] == 'Dana Marchetti', str(after))
        check('declined_at is recorded', bool(after['declined_at']), str(after))
        check('the reason is recorded',
              after['decline_reason'] == 'Going with another quote this time.', str(after))
        check('approving columns were NOT touched',
              after['approved_by_name'] is None and after['approved_at'] is None, str(after))

        # ------------------------------------------------------------------
        # 3. THE BUG THE SPLIT CAUSED: approve must now be refused.
        # ------------------------------------------------------------------
        print('\na declined quote can no longer be approved (the vocabulary bug):')
        status, body = call('approve-quote', {
            'public_id': pid,
            'action': 'approve',
            'responder_name': 'Someone Else',
        })
        check('approve on a declined quote is refused',
              body.get('success') is not True, f'{status} {body}')
        check('and it reports already_declined',
              body.get('already_declined') is True, str(body))

        still = row(q['id'])
        check('status is STILL declined after the approve attempt',
              still['status'] == 'declined', f'got {still["status"]!r}')
        check('the refused approve wrote no approver name',
              still['approved_by_name'] is None, str(still))
        check('it did not overwrite the decliner',
              still['declined_by_name'] == 'Dana Marchetti', str(still))

        print('\nreplaying the decline is idempotent:')
        status, body = call('approve-quote', {
            'public_id': pid, 'action': 'decline',
            'responder_name': 'Someone Else', 'decline_reason': 'different reason',
        })
        check('second decline reports already_declined',
              body.get('already_declined') is True, str(body))
        replayed = row(q['id'])
        check('the original decliner survives a replay',
              replayed['declined_by_name'] == 'Dana Marchetti', str(replayed))
        check('the original reason survives a replay',
              replayed['decline_reason'] == 'Going with another quote this time.',
              str(replayed))

        print('\nthe page reflects it:')
        status, body = call('get-public-quote', {'public_id': pid})
        caps = body.get('capabilities', {})
        check('can_approve is false', caps.get('can_approve') is False, str(caps))
        check('can_decline is false', caps.get('can_decline') is False, str(caps))
        check('status reaches the page as declined',
              body.get('quote', {}).get('status') == 'declined', str(body.get('quote')))

        # ------------------------------------------------------------------
        # 3b. The GUARD, proven independently of the WRITER.
        #
        # Everything above depends on decline writing 'declined'. If it did,
        # and the guard were still the old `status === 'rejected'`, section 3
        # would fail -- but if BOTH regressed together the pair could agree
        # with each other and still be wrong.
        #
        # So these rows are seeded straight into the terminal states, without
        # going through decline at all. This is the assertion that fails
        # against the ORIGINAL build: approve-quote guarded 'approved' and
        # 'rejected' and never 'declined', so a contractor-declined quote --
        # 'declined' is what their status dropdown writes -- was still
        # approvable by any client holding the link.
        # ------------------------------------------------------------------
        print('\nthe guard, seeded directly (fails on the original build):')
        for spelling in ('declined', 'rejected'):
            s = make_quote(owner, f'ZZ-DEC-GUARD-{spelling}')
            made.append(s['id'])
            sql(f"""update public."Quote" set status = '{spelling}'
                     where id = '{s['id']}'""")
            status, body = call('approve-quote', {
                'public_id': s['public_id'], 'action': 'approve',
                'responder_name': 'Dana Marchetti',
            })
            check(f"approve on a quote seeded as '{spelling}' is refused",
                  body.get('success') is not True and body.get('already_declined') is True,
                  f'{status} {body}')
            check(f"the '{spelling}' row was not flipped to approved",
                  row(s['id'])['status'] == spelling, str(row(s['id'])))

        # ------------------------------------------------------------------
        # 4. A DRAFT quote cannot be responded to, by either action.
        # ------------------------------------------------------------------
        print("\na draft quote is not open to a response (the 'sent' guard):")
        d = make_quote(owner, 'ZZ-DEC-002', status='draft')
        made.append(d['id'])
        for act in ('approve', 'decline'):
            status, body = call('approve-quote', {
                'public_id': d['public_id'], 'action': act,
                'responder_name': 'Dana Marchetti',
            })
            check(f'{act} on a draft is refused',
                  body.get('success') is not True and body.get('not_sent') is True,
                  f'{status} {body}')
        check('the draft is still a draft', row(d['id'])['status'] == 'draft')

        # ------------------------------------------------------------------
        # 5. The business gate: hiding the button is not the control.
        # ------------------------------------------------------------------
        print('\nallow_client_quote_approval=false is enforced at the ENDPOINT:')
        g = make_quote(owner, 'ZZ-DEC-003')
        made.append(g['id'])
        sql(f"""update public."BusinessSettings"
                   set allow_client_quote_approval = false
                 where business_name = '{MARKER}'""")

        status, body = call('get-public-quote', {'public_id': g['public_id']})
        caps = body.get('capabilities', {})
        check('page stops offering approve', caps.get('can_approve') is False, str(caps))
        check('page stops offering decline', caps.get('can_decline') is False, str(caps))
        check('the quote itself still loads', body.get('success') is True, str(body)[:200])

        # The point of the whole exercise: the endpoint is reachable directly,
        # so it has to refuse on its own rather than trusting the page.
        for act in ('approve', 'decline'):
            status, body = call('approve-quote', {
                'public_id': g['public_id'], 'action': act,
                'responder_name': 'Dana Marchetti',
            })
            check(f'{act} is refused by the FUNCTION, not just hidden',
                  status == 403 and body.get('responses_disabled') is True,
                  f'{status} {body}')
        check('the gated quote is untouched', row(g['id'])['status'] == 'sent')

        sql(f"""update public."BusinessSettings"
                   set allow_client_quote_approval = true
                 where business_name = '{MARKER}'""")
        status, body = call('approve-quote', {
            'public_id': g['public_id'], 'action': 'decline',
            'responder_name': 'Dana Marchetti',
        })
        check('turning the setting back on restores the decline',
              body.get('success') is True, f'{status} {body}')
        check('and a decline with NO reason stores NULL, not an empty string',
              row(g['id'])['decline_reason'] is None, str(row(g['id'])))

        # ------------------------------------------------------------------
        # 6. A revoked link cannot be declined either.
        # ------------------------------------------------------------------
        print('\nrevocation covers decline too:')
        r = make_quote(owner, 'ZZ-DEC-004')
        made.append(r['id'])
        sql(f"""update public."Quote" set public_link_revoked_at = now()
                 where id = '{r['id']}'""")
        status, body = call('approve-quote', {
            'public_id': r['public_id'], 'action': 'decline',
            'responder_name': 'Dana Marchetti',
        })
        check('decline on a revoked link is refused',
              body.get('success') is not True, f'{status} {body}')
        check('revoked decline changed nothing', row(r['id'])['status'] == 'sent')

    finally:
        print('\ncleanup:')
        for qid in made:
            sql(f"""delete from public."PublicLinkHit" where quote_id = '{qid}'""")
            sql(f"""delete from public."Quote" where id = '{qid}'""")
        print(f'  removed {len(made)} test quotes and their hits')
        if made_settings:
            sql(f"""delete from public."BusinessSettings" where business_name = '{MARKER}'""")
            print('  removed test settings row')
        sql("""delete from public."PublicLinkHit" where invoice_id is null and quote_id is null""")
        left = sql("""select count(*) as n from public."Quote" """)[0]['n']
        print(f'  quotes remaining in table: {left}')

    ok = all(results)
    print('\n' + ('ALL PASS' if ok else 'FAILURES ABOVE'))
    sys.exit(0 if ok else 1)


if __name__ == '__main__':
    main()
