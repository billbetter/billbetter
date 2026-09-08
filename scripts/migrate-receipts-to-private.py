"""Move existing receipt images out of the public bucket into private-uploads.

20260907140000_private_uploads_bucket.sql creates the private bucket and the
app writes new receipts there. It deliberately does NOT move the receipts that
are already stored, because a schema migration that rewrites rows AND relocates
binaries has no safe way to stop halfway.

This does the move, one receipt at a time, and can be interrupted at any point
without leaving a broken row.

-- Order of operations, and why it is this order ---------------------------

For each JobExpense whose receipt_url is a public /uploads/ URL:

    1. download the object
    2. upload it to private-uploads at the SAME path
    3. update the row to 'private:<path>'
    4. delete the public copy

Steps 2 and 3 are the ones that matter. If the process dies between them, the
row still points at the public object, which still exists -- the receipt opens,
nothing is lost, and re-running picks it up again. Deleting first, or updating
the row before the private copy exists, would both produce a receipt that
cannot be opened at all. A brief window where the file exists in both buckets
is the acceptable failure; a window where it exists in neither is not.

Step 4 is skipped unless --delete-originals is passed. Verify the receipts open
in the app first, THEN reclaim the public copies -- until that delete runs, the
old exposure is still open, so do not stop after the dry run and consider this
finished.

Usage:
    python scripts/migrate-receipts-to-private.py                  # dry run
    python scripts/migrate-receipts-to-private.py --apply
    python scripts/migrate-receipts-to-private.py --apply --delete-originals
"""
import json
import sys
import urllib.parse
import urllib.request
import urllib.error

from _env import require

URL = require('VITE_SUPABASE_URL').rstrip('/')
SERVICE = require('SUPABASE_SERVICE_ROLE_KEY')

PUBLIC_BUCKET = 'uploads'
PRIVATE_BUCKET = 'private-uploads'
PUBLIC_MARKER = f'/storage/v1/object/public/{PUBLIC_BUCKET}/'


def _req(method, path, data=None, headers=None, raw=False):
    h = {'apikey': SERVICE, 'Authorization': f'Bearer {SERVICE}'}
    h.update(headers or {})
    req = urllib.request.Request(f'{URL}{path}', data=data, headers=h, method=method)
    try:
        with urllib.request.urlopen(req) as r:
            body = r.read()
            return r.status, body if raw else (json.loads(body.decode()) if body else None)
    except urllib.error.HTTPError as e:
        return e.code, e.read()


def list_receipt_rows():
    """Every JobExpense still pointing at a public uploads URL."""
    q = urllib.parse.urlencode({
        'select': 'id,receipt_url',
        'receipt_url': f'like.*{PUBLIC_MARKER}*',
    })
    status, rows = _req('GET', f'/rest/v1/JobExpense?{q}')
    if status >= 300:
        sys.exit(f'Could not read JobExpense: {status} {rows}')
    return rows or []


def object_path(public_url):
    """<user_id>/<uuid>-<name> from a public URL, or None if it is not one."""
    if PUBLIC_MARKER not in public_url:
        return None
    path = public_url.split(PUBLIC_MARKER, 1)[1]
    # Storage URLs can carry a cache-busting query; the object key never does.
    return urllib.parse.unquote(path.split('?', 1)[0])


def migrate_one(row, apply_changes, delete_originals):
    path = object_path(row['receipt_url'])
    if not path:
        return 'skipped', 'not a public uploads URL'

    if not apply_changes:
        return 'would move', path

    status, blob = _req('GET', f'/storage/v1/object/{PUBLIC_BUCKET}/{path}', raw=True)
    if status >= 300:
        return 'FAILED', f'download {status}'

    # x-upsert so a re-run after a partial failure is not an error.
    status, resp = _req(
        'POST',
        f'/storage/v1/object/{PRIVATE_BUCKET}/{path}',
        data=blob,
        headers={'Content-Type': 'application/octet-stream', 'x-upsert': 'true'},
    )
    if status >= 300:
        return 'FAILED', f'upload {status} {resp}'

    status, resp = _req(
        'PATCH',
        f'/rest/v1/JobExpense?id=eq.{urllib.parse.quote(str(row["id"]))}',
        data=json.dumps({'receipt_url': f'private:{path}'}).encode(),
        headers={'Content-Type': 'application/json'},
    )
    if status >= 300:
        # The private copy exists but the row still points at the public one.
        # That is the safe half-state: the receipt still opens, and a re-run
        # finishes the job.
        return 'FAILED', f'row update {status} {resp} (private copy left in place)'

    if delete_originals:
        status, resp = _req('DELETE', f'/storage/v1/object/{PUBLIC_BUCKET}/{path}')
        if status >= 300:
            return 'moved', f'{path} (public copy NOT deleted: {status})'
        return 'moved+deleted', path

    return 'moved', path


def main():
    apply_changes = '--apply' in sys.argv
    delete_originals = '--delete-originals' in sys.argv

    if delete_originals and not apply_changes:
        sys.exit('--delete-originals only makes sense with --apply.')

    rows = list_receipt_rows()
    print(f'{len(rows)} receipt(s) still in the public bucket.')
    if not rows:
        print('Nothing to do.')
        return

    if not apply_changes:
        print('\nDRY RUN -- nothing will be changed. Re-run with --apply.\n')

    counts = {}
    for row in rows:
        outcome, detail = migrate_one(row, apply_changes, delete_originals)
        counts[outcome] = counts.get(outcome, 0) + 1
        print(f'  {outcome:<14} {row["id"]}  {detail}')

    print('\n' + ', '.join(f'{n} {k}' for k, n in sorted(counts.items())))

    if counts.get('FAILED'):
        print('\nSome receipts did not move. Every failure above left the row '
              'pointing at a file that still exists, so nothing is broken -- '
              're-run to retry.')
        sys.exit(1)

    if apply_changes and not delete_originals:
        print('\nThe public copies are still there, so the old exposure is NOT '
              'closed yet. Open a few receipts in the app to confirm they '
              'still work, then re-run with --apply --delete-originals.')


if __name__ == '__main__':
    main()
