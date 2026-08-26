-- Public invoice links -- STEP 3 of 3: constrain.
--
-- Run only after scripts/backfill-public-tokens.py reports zero remaining.
-- The constraint below is validated in the same file, so it fails loudly if the
-- backfill was skipped rather than silently accepting a half-tokenised table.

-- NOT VALID skips the full-table scan that would otherwise happen under
-- ACCESS EXCLUSIVE. VALIDATE then performs that scan under SHARE UPDATE
-- EXCLUSIVE, which does not block reads or writes.
--
-- A CHECK rather than SET NOT NULL because SET NOT NULL has no NOT VALID form
-- before Postgres 17 and always takes the strong lock. The two are equivalent
-- for our purposes: both make a null token impossible.
alter table public."Invoice"
  drop constraint if exists invoice_public_token_present;
alter table public."Invoice"
  add constraint invoice_public_token_present
  check (public_token is not null) not valid;
alter table public."Invoice"
  validate constraint invoice_public_token_present;

-- New rows get a token automatically from here on. Attaching a default to an
-- EXISTING column is a catalogue update -- it is only combining the default
-- with the column's creation that forced the rewrite step 1 avoided.
alter table public."Invoice"
  alter column public_token set default gen_random_uuid();

-- The token is the only credential, so the lookup must be exact and indexed.
-- Unique because a collision would hand one client another client's invoice.
-- At uuid4 width this will never fire, which is precisely why it costs nothing
-- to assert it.
create unique index if not exists invoice_public_token_key
  on public."Invoice" (public_token);
