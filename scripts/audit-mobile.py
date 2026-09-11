"""Audit every page at phone size for the two things that make people zoom.

  1. A text field under 16px. iOS Safari zooms the whole page in when one is
     focused, and does not zoom back out when it loses focus -- so the
     contractor taps "Client name", types, and is left pinch-zooming out of a
     page that is now too big for the screen.
  2. Anything wider than the screen. Mobile browsers let the page be panned
     sideways and zoomed out to fit it, which reads as "the site is zoomed in".

Neither shows up in lint, in `vite build`, or on a desktop monitor.

-- What it writes -----------------------------------------------------------

By default, no application data. It mints a session for the owner account
(see _session.py -- an auth session, like any sign-in) and reads one invoice
and one quote to have real detail pages to load. The browser half aborts every
write to Supabase and every edge-function call except the reads the pages need.

--public-links adds the two pages a contractor's CLIENT sees, and those are
not free to load. get-public-invoice / get-public-quote log every request to
"PublicLinkHit", because that table is what the public-link rate limiter
counts: one row per page load, keyed to this machine's requester hash, so it
can only ever rate-limit the audit itself (60s window). What they must never
do is register a VIEW -- a stray one would be sealed into the append-only paper
trail as "client opened the invoice", and could never be removed. So
`record_view` is aborted in the browser AND the pages open with ?preview=1,
which the server already refuses to record. Checked against the live database
on 2026-09-10: five runs left 28 hit rows, and view_count, first_viewed_at and
the paper trail did not move.

Requires a build (`npx vite build`); serves dist/ with `vite preview`.

Usage: python scripts/audit-mobile.py [outDir] [--public-links]
"""
import json
import os
import subprocess
import sys
import tempfile
import time
import urllib.request

from _env import require
from _session import session_for

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PORT = 4181
ORIGIN = f'http://localhost:{PORT}'
URL = require('VITE_SUPABASE_URL').rstrip('/')
ANON = require('VITE_SUPABASE_ANON_KEY')

try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except Exception:
    pass


def get(path, token):
    req = urllib.request.Request(f'{URL}/rest/v1/{path}', headers={
        'apikey': ANON,
        'Authorization': f'Bearer {token}',
        # Cloudflare answers a bare urllib request with 1010, which arrives
        # looking exactly like an auth failure.
        'User-Agent': 'invoicium-audit/1.0',
    })
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read().decode())


def wait_for_server(timeout=60):
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            urllib.request.urlopen(ORIGIN, timeout=2)
            return True
        except Exception:
            time.sleep(0.5)
    return False


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    public_links = '--public-links' in sys.argv[1:]
    out_dir = args[0] if args else os.path.join(
        tempfile.gettempdir(), 'invoicium-mobile-audit')
    os.makedirs(out_dir, exist_ok=True)

    sess = session_for('zbagzat9@gmail.com')
    tok = sess['access_token']

    inv = get('Invoice?select=id,public_token&public_token=not.is.null'
              '&public_link_revoked_at=is.null&order=created_at.desc&limit=1', tok)
    quo = get('Quote?select=id,public_id&order=created_at.desc&limit=1', tok)

    config = {
        'session': sess,
        'invoiceId': inv[0]['id'] if inv else None,
        'invoiceToken': inv[0]['public_token'] if inv else None,
        'quoteId': quo[0]['id'] if quo else None,
        'quotePublicId': quo[0].get('public_id') if quo else None,
        'publicLinks': public_links,
    }
    cfg_path = os.path.join(out_dir, 'config.json')
    with open(cfg_path, 'w', encoding='utf-8') as f:
        json.dump(config, f)

    server = subprocess.Popen(
        ['npx', 'vite', 'preview', '--port', str(PORT), '--strictPort'],
        cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
        shell=(os.name == 'nt'),
    )
    try:
        if not wait_for_server():
            raise SystemExit('vite preview did not come up')
        code = subprocess.call(
            ['node', os.path.join(ROOT, 'scripts', 'audit-mobile.cjs'),
             ORIGIN, cfg_path, out_dir],
            cwd=ROOT,
        )
    finally:
        # The session file holds a live access token; do not leave it behind.
        try:
            os.remove(cfg_path)
        except OSError:
            pass
        if os.name == 'nt':
            subprocess.call(['taskkill', '/F', '/T', '/PID', str(server.pid)],
                            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        else:
            server.terminate()
    sys.exit(code)


if __name__ == '__main__':
    main()
