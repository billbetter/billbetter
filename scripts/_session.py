"""Mint a real user access token without knowing the password.

The Supabase admin API can generate a magiclink and hand back its
`hashed_token`; exchanging that at /auth/v1/verify returns a normal session.
generate_link does NOT send an email -- it returns the link for the caller to
deliver -- so this is silent.

Why this exists: several things in this project can only be checked as a
signed-in user (RLS-scoped writes, anything behind requireAppAccess), and
guessing at them from the service role proves the wrong thing. The service role
bypasses RLS, so a test that uses it is not testing what the product does.

Only ever used against the project's own owner account, from local scripts.
"""
import json
import urllib.request
import urllib.error

from _env import require

URL = require('VITE_SUPABASE_URL').rstrip('/')
SERVICE = require('SUPABASE_SERVICE_ROLE_KEY')
ANON = require('VITE_SUPABASE_ANON_KEY')


def _post(path, body, key, extra=None):
    headers = {
        'apikey': key,
        'Authorization': f'Bearer {key}',
        'Content-Type': 'application/json',
    }
    headers.update(extra or {})
    req = urllib.request.Request(
        f'{URL}{path}', data=json.dumps(body).encode(), headers=headers, method='POST'
    )
    try:
        with urllib.request.urlopen(req) as r:
            return r.status, json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        raw = e.read().decode()
        try:
            return e.code, json.loads(raw)
        except ValueError:
            return e.code, raw


def session_for(email):
    """Return the full session dict (access_token, refresh_token, user) or raise."""
    status, link = _post('/auth/v1/admin/generate_link',
                         {'type': 'magiclink', 'email': email}, SERVICE)
    if status >= 300:
        raise RuntimeError(f'generate_link failed: {status} {link}')
    hashed = link.get('hashed_token')
    if not hashed:
        raise RuntimeError(f'no hashed_token in response: {link}')

    # token_hash, not token: GoTrue's /verify rejects `token` alongside a type
    # with "Only an email address or phone number should be provided on verify".
    status, sess = _post('/auth/v1/verify',
                         {'type': 'magiclink', 'token_hash': hashed}, ANON)
    if status >= 300 or not sess.get('access_token'):
        raise RuntimeError(f'verify failed: {status} {sess}')
    return sess


if __name__ == '__main__':
    import sys
    who = sys.argv[1] if len(sys.argv) > 1 else 'zbagzat9@gmail.com'
    s = session_for(who)
    print(f'ok: session for {s["user"]["email"]} (id {s["user"]["id"]})')
    print(f'access_token: {s["access_token"][:24]}... ({len(s["access_token"])} chars)')
