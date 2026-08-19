"""Apply a SQL migration to the live project via the Supabase Management API.

There is no local Postgres and no `supabase` CLI login in this environment, so
`supabase db push` is not available. The Management API's /database/query
endpoint runs SQL against the same database, which is what the CLI ultimately
does.

Usage: python scripts/apply-migration.py <path-to.sql> [--dry-run]
"""
import json
import sys
import urllib.request
import urllib.error

from _env import project_ref, require

API = 'https://api.supabase.com/v1/projects/{ref}/database/query'


def run_sql(sql):
    ref = project_ref()
    req = urllib.request.Request(
        API.format(ref=ref),
        data=json.dumps({'query': sql}).encode('utf-8'),
        headers={
            'Authorization': 'Bearer ' + require('SUPABASE_ACCESS_TOKEN'),
            'Content-Type': 'application/json',
            # Cloudflare in front of the Management API 403s urllib's default UA.
            'User-Agent': 'invoicium-migrate/1.0',
        },
        method='POST',
    )
    try:
        with urllib.request.urlopen(req) as resp:
            return resp.status, resp.read().decode('utf-8')
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode('utf-8')


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    if not args:
        sys.exit('Usage: python scripts/apply-migration.py <path-to.sql>')
    path = args[0]
    with open(path, 'r', encoding='utf-8') as f:
        sql = f.read()
    if '--dry-run' in sys.argv:
        print(f'{path}: {len(sql)} chars, would POST to project {project_ref()}')
        return
    status, body = run_sql(sql)
    print(f'HTTP {status}')
    print(body[:4000])
    sys.exit(0 if status < 300 else 1)


if __name__ == '__main__':
    main()
