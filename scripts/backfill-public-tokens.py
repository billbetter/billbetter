"""Drive step 2 of the public-invoice-links migration, one batch per request.

Why this is a script and not a loop inside the SQL: the Supabase Management API
wraps the SQL body it is sent in a transaction, so a DO block cannot COMMIT
between iterations -- probed directly, it answers

    ERROR: 2D000: invalid transaction termination

which means every batch would hold its row locks until the last one finished,
and the batching would buy nothing. One HTTP request per batch gives each batch
its own transaction, which is the point.

Usage: python scripts/backfill-public-tokens.py [--dry-run]
"""
import json
import os
import sys

from _env import project_ref  # noqa: F401  (validates .env is loadable)
from q import run_sql

BATCH_SQL_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    'supabase', 'migrations', '20260825120100_public_invoice_links_b_backfill.sql',
)

REMAINING_SQL = 'select count(*) as remaining from public."Invoice" where public_token is null'

# A stuck batch would otherwise spin forever against the live project.
MAX_BATCHES = 1000


def remaining():
    status, body = run_sql(REMAINING_SQL)
    if status >= 300:
        sys.exit(f'Could not count remaining rows: {status} {body}')
    return int(json.loads(body)[0]['remaining'])


def main():
    with open(BATCH_SQL_PATH, encoding='utf-8') as f:
        batch_sql = f.read()

    before = remaining()
    print(f'{before} invoice(s) without a public_token.')
    if '--dry-run' in sys.argv:
        return
    if before == 0:
        print('Nothing to do.')
        return

    for n in range(1, MAX_BATCHES + 1):
        status, body = run_sql(batch_sql)
        if status >= 300:
            sys.exit(f'Batch {n} failed: {status} {body}')
        left = remaining()
        print(f'  batch {n}: {before - left} row(s) written, {left} remaining')
        if left == 0:
            print('Backfill complete. Safe to apply step 3 (…_c_constrain.sql).')
            return
        if left == before:
            sys.exit(f'Batch {n} wrote nothing but {left} rows remain -- stopping '
                     'rather than looping. Check the batch SQL.')
        before = left

    sys.exit(f'Still {remaining()} remaining after {MAX_BATCHES} batches -- stopping.')


if __name__ == '__main__':
    main()
