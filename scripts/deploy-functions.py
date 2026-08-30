import json
import sys
import urllib.request
import urllib.error
import os
import re

from _env import require, project_ref

TOKEN = require('SUPABASE_ACCESS_TOKEN')
PROJECT_REF = project_ref()
BASE_URL = f'https://api.supabase.com/v1/projects/{PROJECT_REF}/functions'

FUNCTIONS = [
    # verify_jwt mirrors what is live on the project. Keep it True by default:
    # these endpoints are reached from the browser with a user access token, and
    # turning platform verification off exposes anything that does not check
    # identity itself. Only set False for endpoints called by an outside service
    # that cannot present a user JWT.
    #
    # NOTE: send-invoice-email, create-invoice-payment-link and
    # generate-invoice-pdf currently perform NO internal auth check, so they rely
    # entirely on verify_jwt=True. Do not flip them without adding
    # getUserFromAuthHeader() first — create-invoice-payment-link reads invoices
    # through SERVICE_ROLE and would leak other users' data.
    ('generate-invoice-pdf', True),
    ('generate-quote-pdf', True),
    ('send-invoice-email', True),
    ('send-quote-email', True),
    ('send-invoice-sms', True),
    ('send-quote-sms', True),
    ('create-invoice-payment-link', True),
    ('google-calendar-auth-url', True),
    ('google-calendar-events', True),
    ('google-calendar-sync-job', True),
    ('send-crew-invite', True),
    ('check-overdue-invoices', True),
    ('send-test-analytics-email', True),
    ('stripe-create-session', True),
    ('stripe-create-subscription', True),
    ('stripe-validate-promo', True),
    ('stripe-connect-onboard', True),
    ('stripe-connect-status', True),
    ('confirm-and-activate', True),
    ('accept-crew-invite', True),
    ('invoke-llm', True),

    # Public document surface. verify_jwt stays True and is NOT the access
    # control here: sdk.functions.invoke sends the anon key, which is itself a
    # valid JWT, so every anonymous visitor passes it. The public_token is the
    # only real credential -- see supabase/functions/_shared/public-link.ts.
    # verify_jwt is kept on anyway because it costs nothing and turns away
    # traffic that is not even pretending to be our app.
    ('approve-quote', True),
    ('get-public-invoice', True),
    ('get-public-quote', True),
    ('pay-public-invoice', True),

    # Called by an external service, so no user JWT is available.
    ('stripe-customer-portal', True),
    ('stripe-webhook', False),        # Stripe signs the request instead
    ('google-calendar-callback', False),  # Google OAuth redirect
]

# Deployed on the project but NOT managed here, and deliberately left alone:
#
#   stripe-setup, stripe-worker
#
# These are the SUPABASE STRIPE SYNC ENGINE, installed from the Supabase
# dashboard rather than written here -- which is why no source exists in this
# repo and why the Management API only returns their compiled eszip.
#
# DO NOT DELETE THEM. They are live and in use: the `stripe` schema holds 15+
# tables with real subscription, invoice and price data, and _sync_obj_runs
# shows over 1500 completed runs.
#
# DO NOT "FIX" verify_jwt=False ON THEM EITHER. It looks like an unauthenticated
# endpoint and is not. A pg_cron job (cron.job id 1, every minute) calls
# stripe-worker with `Authorization: Bearer <stripe_sync_worker_secret>` read
# from Supabase Vault -- a shared secret, NOT a JWT. Platform JWT verification
# would reject that bearer and break the sync every minute. The function
# authenticates its own callers instead; probed directly, no header returns
# 401 Unauthorized and a wrong secret returns 403 "Invalid worker secret".
#
# Recorded because this was raised as a possible security hole during the audit
# and investigated to a conclusion: it is not one.

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SHARED_DIR = os.path.join(ROOT, 'supabase', 'functions', '_shared')
FUNCTIONS_DIR = os.path.join(ROOT, 'supabase', 'functions')

# Matches: import { ... } from '../_shared/file.ts'; OR from './file.ts';
# Accepts single or double quotes, and `import type { ... }`. Prettier rewrites
# quotes, and a specifier this misses is left unresolved in the uploaded
# bundle -- which only shows up as a runtime failure after deploy.
IMPORT_RE = re.compile(
    r"""^import\s+(?:type\s+)?\{[^}]+\}\s+from\s+['"](?:\.\./_shared|\.)/([^'"]+)['"]\s*;?\s*$"""
)


def read_shared(name):
    with open(os.path.join(SHARED_DIR, name), 'r', encoding='utf-8') as f:
        return f.read()


def _collapse_multiline_imports(source):
    """Join a multi-line import onto a single line.

    inline_shared matches line by line, and Prettier wraps any import whose
    braces exceed the print width -- so simply running the formatter could
    silently stop an import being inlined, leaving an unresolvable specifier
    in the uploaded bundle. Normalising first makes that impossible.
    """
    pattern = (
        r"^(import\s+(?:type\s+)?\{)([^}]*?)"
        r"(\}\s+from\s+['\"][^'\"]+['\"]\s*;?)\s*$"
    )
    return re.sub(
        pattern,
        lambda m: m.group(1) + " " + " ".join(m.group(2).split()) + " " + m.group(3),
        source,
        flags=re.M | re.S,
    )


def inline_shared(source, visited=None):
    """Inline any ../_shared/... or ./... imports recursively, skipping already-included files."""
    if visited is None:
        visited = set()
    lines = _collapse_multiline_imports(source).split('\n')
    result = []
    for line in lines:
        m = IMPORT_RE.match(line.strip())
        if m:
            shared_file = m.group(1)
            if shared_file in visited:
                # Already inlined — strip the import so we don't re-declare
                continue
            visited.add(shared_file)
            try:
                shared_source = read_shared(shared_file)
            except FileNotFoundError:
                result.append(line)
                continue
            # Recursively inline that file's own shared imports
            inlined = inline_shared(shared_source, visited)
            result.append(f'// ===== START {shared_file} =====')
            result.append(inlined)
            result.append(f'// ===== END {shared_file} =====')
        else:
            result.append(line)
    return '\n'.join(result)


def deploy_function(slug, verify_jwt):
    entry_path = os.path.join(FUNCTIONS_DIR, slug, 'index.ts')
    with open(entry_path, 'r', encoding='utf-8') as f:
        source = f.read()

    full_source = inline_shared(source)

    req = urllib.request.Request(
        f'{BASE_URL}/{slug}',
        headers={'Authorization': f'Bearer {TOKEN}', 'User-Agent': 'Mozilla/5.0'}
    )
    exists = False
    try:
        urllib.request.urlopen(req)
        exists = True
    except urllib.error.HTTPError as e:
        if e.code != 404:
            print(f'  Error checking {slug}: {e.code} {e.read().decode()}')
            return False

    if exists:
        req = urllib.request.Request(
            f'{BASE_URL}/{slug}',
            data=json.dumps({'body': full_source, 'verify_jwt': verify_jwt}).encode(),
            headers={'Authorization': f'Bearer {TOKEN}', 'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0'},
            method='PATCH'
        )
    else:
        req = urllib.request.Request(
            BASE_URL,
            data=json.dumps({'slug': slug, 'name': slug, 'body': full_source, 'verify_jwt': verify_jwt}).encode(),
            headers={'Authorization': f'Bearer {TOKEN}', 'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0'},
            method='POST'
        )

    try:
        resp = urllib.request.urlopen(req)
        data = json.loads(resp.read().decode())
        print(f'  OK {slug}: {data.get("id", "deployed")} (verify_jwt={verify_jwt})')
        return True
    except urllib.error.HTTPError as e:
        print(f'  FAILED {slug}: {e.code} {e.read().decode()}')
        return False


def check_for_drift():
    """Fail if a function directory exists but is not listed above.

    This list had silently drifted: approve-quote, invoke-llm and
    accept-crew-invite all had source on disk and were live on the project, but
    none was in FUNCTIONS -- so running this script would not have redeployed
    them, and a change to _shared/ would have been picked up by every other
    function and not by those three. Nothing would have failed; the three would
    just have quietly stayed on an older bundle.
    """
    on_disk = {
        d for d in os.listdir(FUNCTIONS_DIR)
        if d != '_shared' and os.path.isfile(os.path.join(FUNCTIONS_DIR, d, 'index.ts'))
    }
    listed = {slug for slug, _ in FUNCTIONS}
    missing = sorted(on_disk - listed)
    if missing:
        print('ERROR: function source exists but is not in FUNCTIONS, so it would')
        print('       never be deployed by this script:')
        for slug in missing:
            print(f'         {slug}')
        sys.exit(1)
    stale = sorted(listed - on_disk)
    if stale:
        print('ERROR: FUNCTIONS lists slugs with no source on disk:')
        for slug in stale:
            print(f'         {slug}')
        sys.exit(1)


def main():
    check_for_drift()
    only = [a for a in sys.argv[1:] if not a.startswith('-')]
    targets = [(s, v) for s, v in FUNCTIONS if not only or s in only]
    if only and not targets:
        sys.exit(f'No such function: {", ".join(only)}')
    print(f'Deploying {len(targets)} Edge Function(s) to project {PROJECT_REF}...')
    ok = True
    for slug, verify_jwt in targets:
        print(f'Deploying {slug}...')
        if not deploy_function(slug, verify_jwt):
            ok = False
    print('Done.')
    # A failed upload used to print FAILED and exit 0, so a broken deploy looked
    # like a successful one to anything scripting this.
    sys.exit(0 if ok else 1)


if __name__ == '__main__':
    main()
