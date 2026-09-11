"""Shared setup for the browser passes that load every page as the owner.

Used by audit-mobile.py and snapshot-pages.py. It does three things:

  1. mints a session for the owner account (see _session.py -- an auth
     session, like any sign-in; no application data is written);
  2. reads one invoice and one quote, so detail pages have real ids to load;
  3. serves dist/ with `vite preview` for the duration of a `with` block.

The browser half (_page-harness.cjs) is where writes are blocked. What the
optional client-link pages cost is documented in audit-mobile.py.
"""
import json
import os
import subprocess
import sys
import time
import urllib.request
from contextlib import contextmanager

from _env import require
from _session import session_for

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OWNER = 'zbagzat9@gmail.com'

try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except Exception:
    pass


def _get(path, token):
    url = require('VITE_SUPABASE_URL').rstrip('/')
    req = urllib.request.Request(f'{url}/rest/v1/{path}', headers={
        'apikey': require('VITE_SUPABASE_ANON_KEY'),
        'Authorization': f'Bearer {token}',
        # Cloudflare answers a bare urllib request with 1010, which arrives
        # looking exactly like an auth failure.
        'User-Agent': 'invoicium-page-harness/1.0',
    })
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read().decode())


def write_config(path, public_links=False):
    """Mint a session, read the fixture ids, write them for the browser half."""
    sess = session_for(OWNER)
    tok = sess['access_token']
    inv = _get('Invoice?select=id,public_token&public_token=not.is.null'
               '&public_link_revoked_at=is.null&order=created_at.desc&limit=1', tok)
    quo = _get('Quote?select=id,public_id&order=created_at.desc&limit=1', tok)
    config = {
        'session': sess,
        'invoiceId': inv[0]['id'] if inv else None,
        'invoiceToken': inv[0]['public_token'] if inv else None,
        'quoteId': quo[0]['id'] if quo else None,
        'quotePublicId': quo[0].get('public_id') if quo else None,
        'publicLinks': public_links,
    }
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(config, f)


def _wait_for(origin, timeout=60):
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            urllib.request.urlopen(origin, timeout=2)
            return True
        except Exception:
            time.sleep(0.5)
    return False


@contextmanager
def preview_server(port, dist=None):
    """`vite preview` on `port` for the body of the block; yields the origin.

    `dist` serves another build directory -- e.g. a worktree's, to capture a
    baseline from code that is not checked out here.
    """
    origin = f'http://localhost:{port}'
    extra = ['--outDir', dist] if dist else []
    server = subprocess.Popen(
        ['npx', 'vite', 'preview', '--port', str(port), '--strictPort', *extra],
        cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
        shell=(os.name == 'nt'),
    )
    try:
        if not _wait_for(origin):
            raise SystemExit('vite preview did not come up')
        yield origin
    finally:
        if os.name == 'nt':
            subprocess.call(['taskkill', '/F', '/T', '/PID', str(server.pid)],
                            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        else:
            server.terminate()


def run_browser_pass(script, out_dir, port, public_links=False, extra_args=(), dist=None):
    """Write the config, serve dist/, run `node <script> origin config outDir`.

    The config file holds a live access token, so it is deleted however the
    run ends.
    """
    os.makedirs(out_dir, exist_ok=True)
    cfg_path = os.path.join(out_dir, 'config.json')
    write_config(cfg_path, public_links)
    try:
        with preview_server(port, dist) as origin:
            return subprocess.call(
                ['node', os.path.join(ROOT, 'scripts', script),
                 origin, cfg_path, out_dir, *extra_args],
                cwd=ROOT,
            )
    finally:
        try:
            os.remove(cfg_path)
        except OSError:
            pass
