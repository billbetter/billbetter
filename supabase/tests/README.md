# RLS tests

Proves what each signed-in user can actually see and do, against a real
Postgres, before a policy change goes near production.

The crew migration rewrites the RLS policies on eleven tables and redefines
`has_app_access()`, which every one of them depends on. Getting that wrong
leaks one business's invoices into another's, or locks out everybody who pays.
Neither failure is visible by reading the SQL, so it gets run.

## Why it is written this way

Two details are the difference between a suite that proves something and one
that passes vacuously:

- **Every case runs as `authenticated`**, not `postgres`. Superusers and table
  owners bypass RLS entirely — testing as `postgres` makes all thirteen cases
  pass no matter how broken the policies are.
- **Every case is `begin … rollback` with `set local`.** `SET LOCAL` outside a
  transaction is a no-op that only emits a warning, so the role never changes
  and the writes persist. The first draft of this suite made both mistakes at
  once; it reported a crew member deactivated by an earlier un-rolled-back
  `UPDATE` as a policy bug.

`00-supabase-stub.sql` supplies just enough of Supabase to run the real
migrations unmodified: `auth.users`, `auth.uid()` reading the same GUC
PostgREST sets, and the `authenticated` / `service_role` / `anon` roles.

## Fixtures

| user | subscription | belongs to |
|---|---|---|
| owner A | active, professional | — |
| owner B | active, professional | — (the stranger; nothing may leak into or out of B) |
| lapsed C | canceled | — |
| crew | none | owner A |
| orphan | none | lapsed C |
| nomad | none | nobody |

## Running it

Any Postgres 14+ will do. Docker is easiest where virtualisation is available:

```bash
docker run -d --name rls-test -e POSTGRES_PASSWORD=test -p 55432:5432 postgres:16-alpine
```

Where it is not, the EnterpriseDB Windows binaries run natively with no install
and no admin rights — unzip, `initdb -D data -U postgres -A trust`, then start
`postgres.exe -D data -p 55432` **detached**, or it dies with the shell that
launched it.

Then, from the repo root, against an empty database:

```bash
PSQL="psql -h 127.0.0.1 -p 55432 -U postgres -d postgres -v ON_ERROR_STOP=1"

$PSQL -c "drop schema if exists public cascade; create schema public;
          drop schema if exists auth cascade;"
$PSQL -f supabase/tests/00-supabase-stub.sql
$PSQL -f supabase/schema.sql
for f in supabase/migrations/*.sql; do [ -s "$f" ] && $PSQL -f "$f"; done
$PSQL -f supabase/tests/98-grants.sql
$PSQL -f supabase/tests/90-fixtures.sql
$PSQL -f supabase/tests/99-rls-test.sql
```

**Always reset to an empty database first.** Cases 4 and 11 write; they roll
back, but a leftover row or a deactivated crew member from an aborted run shows
up as a policy failure that is not real.

Each case prints its own `expect:` line. Read them — the suite does not assert.

## Coverage

1. crew inherits the employer's subscription; lapsed, orphaned and unaffiliated do not
2. row visibility per user across Client / Invoice / Job / BusinessSettings
3. crew sees their employer's rows and not the stranger's
4. crew **may** write into their employer's business
5. crew may **not** write into a business they do not belong to
6. crew may **not** rewrite the employer's payout settings
7. crew **can** read the employer's branding — without it every PDF is nameless
8. crew may **not** promote themselves to admin
9. crew may **not** read the employer's `Subscription` row
10. `my_app_access()` admits crew while exposing nothing
11. deactivating a member revokes access immediately
12. a solo owner is unaffected — the additive claim in the migration header
13. one running `TimeEntry` per person (the partial unique index)
