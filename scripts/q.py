"""Run a read-only SQL query against the live project and print the JSON result.

Companion to apply-migration.py, for inspection rather than change. Kept because
every schema decision in docs/invoice-links-plan.md was checked against
information_schema rather than against the migration files, which do not
describe tables created through the dashboard.

Usage: python scripts/q.py "select ..."
"""
import json
import sys
import urllib.request
import urllib.error

from _env import project_ref, require

API = 'https://api.supabase.com/v1/projects/{ref}/database/query'


def run_sql(sql):
    req = urllib.request.Request(
        API.format(ref=project_ref()),
        data=json.dumps({'query': sql}).encode('utf-8'),
        headers={
            'Authorization': 'Bearer ' + require('SUPABASE_ACCESS_TOKEN'),
            'Content-Type': 'application/json',
            'User-Agent': 'invoicium-query/1.0',
        },
        method='POST',
    )
    try:
        with urllib.request.urlopen(req) as resp:
            return resp.status, resp.read().decode('utf-8')
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode('utf-8')


if __name__ == '__main__':
    if len(sys.argv) < 2:
        sys.exit('Usage: python scripts/q.py "<sql>"')
    status, body = run_sql(sys.argv[1])
    print(status)
    try:
        print(json.dumps(json.loads(body), indent=2))
    except ValueError:
        print(body)
