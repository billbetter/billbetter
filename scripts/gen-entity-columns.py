"""Regenerate src/api/entityColumns.js from the live database schema.

localDataEngine strips keys that are not real columns before writing, because
PostgREST rejects the WHOLE request for one unknown key -- so a single stray
field in a form's state stops every field on that page from saving, reporting
only "Failed to save settings."

That strip needs to know the real columns. Hand-maintaining the list would drift
the moment somebody adds a migration, and a stale allowlist silently drops NEW
legitimate columns -- which is a worse bug than the one being fixed. So the list
is generated from information_schema and committed, and this script regenerates
it.

RUN THIS AFTER EVERY MIGRATION THAT ADDS OR REMOVES A COLUMN.
`npm run check` cannot verify it, because CI has no database.

Usage: python scripts/gen-entity-columns.py
"""
import json
import os

from q import run_sql

OUT = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    'src', 'api', 'entityColumns.js',
)

SQL = """
select table_name, column_name
  from information_schema.columns
 where table_schema = 'public'
 order by table_name, ordinal_position
"""

HEADER = '''/**
 * Real column names per table, generated from the live database schema.
 *
 * DO NOT EDIT BY HAND. Regenerate with:
 *
 *     python scripts/gen-entity-columns.py
 *
 * -- Why this exists -------------------------------------------------------
 *
 * PostgREST rejects an entire INSERT or PATCH if the body contains one key that
 * is not a column. It does not ignore the key; it fails the request with
 * `42703 column X does not exist`. So a single stray field in a form's state
 * stops EVERY field on that page from saving.
 *
 * That is not hypothetical. src/pages/Settings.jsx builds its payload as
 * `{ ...formData }`, and CalendarSettings binds inputs to `booking_slug` and
 * `available_hours` -- neither of which is a column. Typing in the booking URL
 * field broke saving for every unrelated setting on the page, and the only
 * feedback was "Failed to save settings. Please try again."
 *
 * localDataEngine strips unknown keys against this map before writing, and
 * warns loudly in development naming each key it dropped. It warns rather than
 * staying silent because a silent strip turns a typo'd column name into a
 * setting that never saves and never complains -- which is the same class of
 * bug, just quieter.
 *
 * A table absent from this map is not stripped at all, so a stale file degrades
 * to today's behaviour rather than dropping data.
 */
'''


def main():
    status, body = run_sql(SQL)
    if status >= 300:
        raise SystemExit(f'query failed: {status} {body}')

    tables = {}
    for row in json.loads(body):
        tables.setdefault(row['table_name'], []).append(row['column_name'])

    lines = [HEADER, 'export const ENTITY_COLUMNS = {']
    for table in sorted(tables):
        cols = ', '.join(json.dumps(c) for c in tables[table])
        lines.append(f'  {json.dumps(table)}: [{cols}],')
    lines.append('};')
    lines.append('')

    with open(OUT, 'w', encoding='utf-8', newline='\n') as f:
        f.write('\n'.join(lines))

    total = sum(len(v) for v in tables.values())
    print(f'Wrote {OUT}')
    print(f'  {len(tables)} tables, {total} columns')


if __name__ == '__main__':
    main()
