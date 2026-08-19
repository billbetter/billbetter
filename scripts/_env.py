"""Load .env from the repo root so scripts never hardcode refs or credentials.

The AxisBill -> Invoicium migration left every deploy script pointing at the
dead rtflrrugewkphoxukymw project with its own drifted copy of the secrets.
Reading .env instead keeps one source of truth.
"""
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def load(path=None):
    """Parse .env into a dict. Does not mutate os.environ."""
    path = path or os.path.join(ROOT, '.env')
    values = {}
    try:
        with open(path, 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith('#') or '=' not in line:
                    continue
                key, _, val = line.partition('=')
                val = val.strip()
                if len(val) >= 2 and val[0] == val[-1] and val[0] in '"\'':
                    val = val[1:-1]
                values[key.strip()] = val
    except FileNotFoundError:
        sys.exit(f'ERROR: {path} not found.')
    return values


ENV = load()


def require(name):
    """Fetch a value from the environment, falling back to .env. Exit if unset."""
    val = os.environ.get(name) or ENV.get(name)
    if not val:
        sys.exit(f'ERROR: {name} is not set (checked the environment and .env).')
    return val


def project_ref():
    """The Supabase project ref, derived from VITE_SUPABASE_URL when not explicit."""
    ref = os.environ.get('SUPABASE_PROJECT_REF') or ENV.get('SUPABASE_PROJECT_REF')
    if ref:
        return ref
    url = require('VITE_SUPABASE_URL')
    host = url.split('://', 1)[-1].split('/', 1)[0]
    if not host.endswith('.supabase.co'):
        sys.exit(f'ERROR: cannot derive a project ref from VITE_SUPABASE_URL={url!r}.')
    return host[:-len('.supabase.co')]
