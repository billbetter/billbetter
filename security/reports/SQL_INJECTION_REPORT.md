# SQL_INJECTION Security Report

## Status: PASS

No SQL injection vector was found. This is a genuine pass, not an absence of
evidence: the architecture removes the class rather than defending against it.

## Findings

### There is no raw SQL in the request path

Every read and write goes through one of two parameterised layers:

- **Browser** — `supabase-js`, whose `.eq()` / `.filter()` builders serialise
  values into PostgREST query parameters. No string is ever concatenated into a
  statement.
- **Edge Functions** — the `db` helper in
  `supabase/functions/_shared/supabase-admin.ts`, which speaks PostgREST over
  HTTP. There is no Postgres driver in the project and no `SELECT`/`INSERT`/
  `UPDATE` string anywhere in `src/` or `supabase/functions/`.

The only `.rpc()` call in the codebase is `client.rpc("my_app_access")` in
`src/lib/access.js`, which takes no arguments.

### The `db` helper encodes its values

```ts
async findOne(table: string, filters: Record<string, string>) {
  const qs = Object.entries(filters)
    .map(([k, v]) => `${k}=eq.${encodeURIComponent(v)}`).join('&');
```

`getOne`, `findOne`, `list` and `update` all pass values through
`encodeURIComponent`, so a value containing `&`, `=`, `,` or a PostgREST
operator cannot break out of its filter and add another.

### Two raw-string escape hatches — both audited, both clean

`db.select(table, query)` and `db.updateWhere(table, query, patch)` take a
verbatim query string. Both are documented as escape hatches, and both have
exactly one caller each:

| Helper | Caller | Input |
|---|---|---|
| `updateWhere` | `sweep-demand-letters/index.ts:104` | module constants + `encodeURIComponent(cutoff.toISOString())` |
| `select` | `_shared/public-link.ts:230` | `encodeURIComponent(hash)` + `encodeURIComponent(since)` |

Neither takes a request-supplied value. The sweep's filter is built from
`UNPAID_STATUSES` (a hardcoded array) and a date computed from `Date.now()`;
the rate limiter's is a SHA-256 hex digest and an ISO timestamp. Nothing an
attacker controls reaches either.

### Public tokens are type-checked before they reach a query

`_shared/public-link.ts` validates the token against a UUID regex *before*
lookup:

```ts
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
```

The in-code comment says this exists so a malformed value "fails at the type
boundary rather than as a Postgres error" — which also means the single
highest-traffic unauthenticated parameter in the product cannot carry a payload
at all.

### Search boxes do not reach the database

The search inputs on the Recovery Queue and Invoices pages filter an
already-fetched array in JavaScript. Every `.filter(` match in `src/` is
`Array.prototype.filter`, not a PostgREST builder. There is no `.or()`,
`.textSearch()` or `.like()` call taking user input anywhere in the client.

### LOW-1 — `format('%s')` in migrations, not `%I`

Several migrations build DDL with `execute format('alter table %s add column …',
inv_tbl)`. `%s` interpolates without quoting; `%I` quotes as an identifier.

This is **not exploitable**: `inv_tbl` is resolved by `to_regclass` against the
project's own catalog, migrations are run once by an administrator, and no
request path executes them. `20260818010000_fix_table_casing.sql` already uses
`%I` correctly, showing the right form is known. Flagged as hygiene so a future
migration that takes a real parameter starts from the safe idiom.

## What's at risk

Nothing, from this class. The realistic future risk is a *new* caller passing a
request value into `db.select` or `db.updateWhere`, which would be injectable
PostgREST filter syntax (e.g. a token of `x&user_id=neq.x` widening a match).
That is a footgun, not a present hole.

## What's already secure

- No Postgres driver, no raw SQL, no string-built statements.
- Value encoding on every convenience helper.
- Both escape hatches documented as such, with the reason they exist, and used
  only with machine-generated values.
- UUID validation on the one unauthenticated parameter, before it is used.
- Client-side search never touches the database.
- RLS is a second wall behind all of it, so even a successful filter
  manipulation would still be constrained to the caller's own rows on any
  anon-key path.

## Recommendations

1. Keep `db.select` / `db.updateWhere` free of request data. Consider a comment
   convention or a lint rule if more callers appear.
2. Prefer `%I` over `%s` in future migration DDL.
3. No code change is required for this category.
