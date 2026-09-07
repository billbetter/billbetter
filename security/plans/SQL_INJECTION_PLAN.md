# SQL_INJECTION Fix Plan

## Changes

None required. The category is a PASS: there is no raw SQL in the request path,
the `db` helper encodes every value, and the two raw-string escape hatches are
called only with machine-generated input.

Optional hardening, not a fix:

- Future migration DDL should use `format('%I')` rather than `format('%s')` for
  identifiers. Existing uses are administrator-run and take no user input.

## New files

- `scripts/test-sql-injection.py` — asserts the properties this report relies on
  stay true, so a future caller passing request data into `db.select` /
  `db.updateWhere` is caught.

## Verification goals

- [ ] No raw SQL string with interpolation in `src/` or `supabase/functions/`
- [ ] `db.getOne/findOne/list/update` encode values
- [ ] `db.select` and `db.updateWhere` have no caller passing request data
- [ ] Public token is UUID-validated before any query
- [ ] A PostgREST filter-injection payload in a public token is rejected, not executed

## Manual verification (for the human)

- Submit `' OR '1'='1` and `'; DROP TABLE users; --` into the invoice search,
  client name and job description fields. Expect them stored/displayed as text,
  with no error and no unexpected rows.
