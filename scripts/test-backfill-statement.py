"""Prove the quote-credential backfill statement actually backfills.

There are zero quotes, so applying the migration proved nothing: a column
DEFAULT only fills NEW rows, and an UPDATE over an empty table succeeds whether
or not it is correct. "It worked" and "there was nothing to do" are
indistinguishable from the outside.

So the statement is run verbatim against a scratch table shaped like Quote and
seeded with rows that have NULL credentials -- including one row that already
has a public_id, to prove the backfill does not clobber it.

The SQL is READ FROM THE MIGRATION FILE, not retyped here. A copy would drift,
and then this would prove that the copy works.

Usage: python scripts/test-backfill-statement.py
"""
import json
import os
import re
import sys

from q import run_sql

MIGRATION = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    'supabase', 'migrations', '20260826120000_public_quote_links.sql',
)

SCRATCH = '_backfill_probe'


def sql(query, label=''):
    status, body = run_sql(query)
    if status >= 300:
        raise SystemExit(f'SQL failed{" (" + label + ")" if label else ""}: '
                         f'{status}\n{body}\n{query[:300]}')
    try:
        return json.loads(body)
    except ValueError:
        return []


def extract_backfill():
    """Pull the UPDATE statement out of the migration file."""
    src = open(MIGRATION, encoding='utf-8').read()
    m = re.search(r'^update public\."Quote".*?;\s*$', src, re.S | re.M)
    if not m:
        raise SystemExit('Could not find the backfill UPDATE in the migration.')
    return m.group(0)


results = []


def check(label, cond, detail=''):
    results.append(bool(cond))
    print(f'  {"PASS" if cond else "FAIL"}  {label}'
          f'{(" -- " + detail) if detail and not cond else ""}')


def main():
    backfill = extract_backfill()
    print('Backfill statement read from the migration:\n')
    print('    ' + '\n    '.join(backfill.strip().split('\n')) + '\n')

    # Same statement, retargeted at the scratch table. This is the only edit,
    # and it is a table name.
    scratch_backfill = backfill.replace('public."Quote"', f'public."{SCRATCH}"')

    try:
        sql(f'drop table if exists public."{SCRATCH}"')
        sql(f'''create table public."{SCRATCH}" (
                  id uuid primary key default gen_random_uuid(),
                  public_id text,
                  approval_token text
                )''')
        # Three rows with nothing, one row that already has a public_id.
        sql(f'''insert into public."{SCRATCH}" (public_id, approval_token) values
                  (null, null), (null, null), (null, null),
                  ('ALREADY-SET', null)''')

        before = sql(f'''select count(*) as n from public."{SCRATCH}"
                          where public_id is null or approval_token is null''')[0]['n']
        check('fixture starts with rows missing credentials', int(before) == 4, f'{before}')

        sql(scratch_backfill, 'backfill')

        after = sql(f'''select count(*) as n from public."{SCRATCH}"
                         where public_id is null or approval_token is null''')[0]['n']
        check('no rows left without credentials after the backfill',
              int(after) == 0, f'{after} still null')

        rows = sql(f'select public_id, approval_token from public."{SCRATCH}" order by public_id')
        check('the pre-existing public_id was NOT overwritten',
              any(r['public_id'] == 'ALREADY-SET' for r in rows),
              str([r['public_id'] for r in rows]))
        check('that row still received an approval_token',
              all(r['approval_token'] for r in rows),
              str(rows))
        ids = [r['public_id'] for r in rows]
        check('every generated public_id is distinct', len(set(ids)) == len(ids), str(ids))
        toks = [r['approval_token'] for r in rows]
        check('every generated approval_token is distinct', len(set(toks)) == len(toks))

        # And the real table: the default must be attached, and nothing left null.
        live = sql('''select count(*) as n from public."Quote"
                       where public_id is null or approval_token is null''')[0]['n']
        check('live Quote table has no rows missing credentials', int(live) == 0, f'{live}')
        defaults = sql("""select column_name, column_default
                            from information_schema.columns
                           where table_schema='public' and table_name='Quote'
                             and column_name in ('public_id','approval_token')""")
        check('both columns carry a generating default',
              all('gen_random_uuid' in (c['column_default'] or '') for c in defaults),
              str(defaults))

    finally:
        sql(f'drop table if exists public."{SCRATCH}"')
        print('\n  scratch table dropped')

    ok = all(results)
    print('\n' + ('ALL PASS' if ok else 'FAILURES ABOVE'))
    sys.exit(0 if ok else 1)


if __name__ == '__main__':
    main()
