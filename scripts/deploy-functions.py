import json
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

    # Called by an external service, so no user JWT is available.
    ('stripe-customer-portal', True),
    ('stripe-webhook', False),        # Stripe signs the request instead
    ('google-calendar-callback', False),  # Google OAuth redirect
]

# Deployed on the project but NOT managed here, because there is no local source
# for them (the Management API only returns compiled eszip bundles):
#   stripe-setup, stripe-worker   -- both live with verify_jwt=False

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


def main():
    print(f'Deploying Edge Functions to project {PROJECT_REF}...')
    for slug, verify_jwt in FUNCTIONS:
        print(f'Deploying {slug}...')
        deploy_function(slug, verify_jwt)
    print('Done.')


if __name__ == '__main__':
    main()
