"""Drive the real CreateQuote page in a browser, then assert the database.

Fixtures (a Client row) and assertions live here; the browser work is in
test-create-quote-ui.cjs. Everything created is deleted, including on failure.

Requires the app to be built (`npx vite build`) -- it serves dist/ with
`vite preview`.

Usage: python scripts/test-create-quote-ui.py
"""
import json
import os
import re
import signal
import subprocess
import sys
import time
import urllib.error
import urllib.request

from _session import session_for
from q import run_sql

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PORT = 4173
ORIGIN = f'http://localhost:{PORT}'
CLIENT_NAME = 'ZZ-UI-TEST Client'

# The app's own console output contains emoji and en-dashes; this terminal is
# cp1252 by default and printing them raises UnicodeEncodeError, which would
# fail the run for a reason that has nothing to do with the code under test.
try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except Exception:
    pass

results = []


def check(label, cond, detail=''):
    results.append(bool(cond))
    print(f'  {"PASS" if cond else "FAIL"}  {label}'
          f'{(" -- " + detail) if detail and not cond else ""}')
    return cond


def sql(query):
    status, body = run_sql(query)
    if status >= 300:
        raise SystemExit(f'SQL failed: {status}\n{body}\n{query[:200]}')
    try:
        return json.loads(body)
    except ValueError:
        return []


def wait_for_server(timeout=60):
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            with urllib.request.urlopen(ORIGIN, timeout=2) as r:
                if r.status < 500:
                    return True
        except Exception:
            time.sleep(1)
    return False


def main():
    if not os.path.isdir(os.path.join(ROOT, 'dist')):
        sys.exit('dist/ missing -- run `npx vite build` first.')

    users = sql('select id, email from auth.users order by created_at')
    owner, email = users[0]['id'], users[0]['email']
    print(f'Acting as {email}\n')

    server = None
    client_id = None
    created_ids = []
    try:
        # --- Fixture: the form requires an existing client -----------------
        rows = sql(f"""insert into public."Client" (user_id, name, email, phone)
                       values ('{owner}', '{CLIENT_NAME}', 'ui-test@example.com', '+15550000002')
                       returning id""")
        client_id = rows[0]['id']

        before = {r['id'] for r in sql('select id from public."Quote"')}

        # --- Serve the built app -------------------------------------------
        server = subprocess.Popen(
            ['npx', 'vite', 'preview', '--port', str(PORT), '--strictPort'],
            cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
            shell=(os.name == 'nt'),
        )
        if not wait_for_server():
            raise SystemExit('vite preview did not come up')
        print(f'  serving dist/ at {ORIGIN}')

        sess = session_for(email)
        payload = json.dumps({
            'access_token': sess['access_token'],
            'refresh_token': sess['refresh_token'],
            'expires_at': sess.get('expires_at'),
            'expires_in': sess.get('expires_in', 3600),
            'token_type': 'bearer',
            'user': sess['user'],
        })

        # Written to a file rather than passed on argv: a JSON blob this size,
        # full of quotes and dots, gets mangled by shell argument handling.
        sess_path = os.path.join(ROOT, 'scripts', '.session.tmp.json')
        with open(sess_path, 'w', encoding='utf-8') as f:
            f.write(payload)

        proc = subprocess.run(
            ['node', os.path.join(ROOT, 'scripts', 'test-create-quote-ui.cjs'),
             ORIGIN, sess_path, CLIENT_NAME],
            capture_output=True, text=True, encoding='utf-8', errors='replace',
            cwd=ROOT, timeout=180,
        )
        print(proc.stdout.rstrip())
        if proc.stderr.strip():
            print('  [browser stderr]', proc.stderr.strip()[:600])

        m = re.search(r'^RESULT (.*)$', proc.stdout, re.M)
        outcome = json.loads(m.group(1)) if m else {'ok': False, 'error': 'no RESULT line'}
        check('the browser completed the form', outcome.get('ok'),
              str(outcome.get('error')))

        # --- The assertion that matters ------------------------------------
        after = sql('''select id, quote_number, public_id, approval_token, total, status
                         from public."Quote" order by created_at''')
        new = [q for q in after if q['id'] not in before]
        created_ids = [q['id'] for q in new]

        if not check('a quote row was created through the UI', len(new) == 1,
                     f'{len(new)} new rows'):
            return

        q = new[0]
        print(f'\n  created {q["quote_number"]} (total {q["total"]}, status {q["status"]})')
        check('public_id was populated WITHOUT the client sending it',
              bool(q['public_id']), repr(q['public_id']))
        check('approval_token was populated too',
              bool(q['approval_token']), repr(q['approval_token']))
        check('public_id is a uuid, not a placeholder',
              bool(re.fullmatch(r'[0-9a-f-]{36}', str(q['public_id'] or ''))),
              str(q['public_id']))
        check('the two credentials differ',
              q['public_id'] != q['approval_token'])

        # --- And the link the contractor actually sees ---------------------
        # Rendered by PublicLinkControls, which is gated on the token existing.
        # Before this work QuoteDetail computed the URL and never used it, so
        # asserting the URL renders is asserting the whole chain.
        proc2 = subprocess.run(
            ['node', os.path.join(ROOT, 'scripts', 'test-quote-detail-link.cjs'),
             ORIGIN, sess_path, q['id'], q['public_id']],
            capture_output=True, text=True, encoding='utf-8', errors='replace',
            cwd=ROOT, timeout=180,
        )
        print(proc2.stdout.rstrip())
        m2 = re.search(r'^RESULT (.*)$', proc2.stdout, re.M)
        detail = json.loads(m2.group(1)) if m2 else {'ok': False, 'error': 'no RESULT line'}
        check('QuoteDetail renders the share link', detail.get('linkShown'),
              str(detail))
        check('the rendered link contains the real public_id',
              detail.get('hasPublicId'), str(detail.get('linkText'))[:160])

    finally:
        print('\ncleanup:')
        if server:
            try:
                if os.name == 'nt':
                    subprocess.run(['taskkill', '/F', '/T', '/PID', str(server.pid)],
                                   capture_output=True)
                else:
                    server.send_signal(signal.SIGTERM)
            except Exception as e:
                print('  could not stop preview server:', e)
            print('  preview server stopped')
        for qid in created_ids:
            sql(f"""delete from public."PublicLinkHit" where quote_id = '{qid}'""")
            sql(f"""delete from public."Quote" where id = '{qid}'""")
        if created_ids:
            print(f'  removed {len(created_ids)} test quote(s)')
        if client_id:
            sql(f"""delete from public."Client" where id = '{client_id}'""")
            print('  removed test client')
        tmp = os.path.join(ROOT, 'scripts', '.session.tmp.json')
        if os.path.exists(tmp):
            os.remove(tmp)
            print('  removed temp session file')

    ok = all(results)
    print('\n' + ('ALL PASS' if ok else 'FAILURES ABOVE'))
    sys.exit(0 if ok else 1)


if __name__ == '__main__':
    main()
