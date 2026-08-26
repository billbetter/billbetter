-- Public invoice links -- STEP 1 of 3: add nullable.
--
-- See docs/invoice-links-plan.md sections 4 and 5.
--
-- Additive only. Nothing here loosens RLS: the public page never reads these
-- tables directly, it calls get-public-invoice, which uses the service role.
-- The new columns are gated by the existing "Invoice access" policy like every
-- other column on the table -- a policy is per-table, not per-column.
--
-- -- Why this is three files rather than one --------------------------------
--
-- gen_random_uuid() is VOLATILE, so
--
--     add column public_token uuid not null default gen_random_uuid()
--
-- does NOT take the Postgres 11+ fast-default path. It REWRITES the table under
-- ACCESS EXCLUSIVE, blocking reads and writes for the duration. At 3 invoices
-- that is imperceptible; at 100k it is an outage. The three-step form -- add
-- nullable, backfill in batches, then constrain -- avoids it, and this
-- migration is the one somebody copies next time.
--
-- The plan wrote step 2 as a DO block with COMMIT between batches. That does
-- not work here, and the difference is the whole point of the split. Probed
-- against this project:
--
--     do $$ begin insert into _probe values (1); commit; end $$;
--     ERROR: 2D000: invalid transaction termination
--
-- The Supabase Management API's /database/query endpoint wraps the body it is
-- sent in a transaction, so no statement inside it can commit. A CALL to a
-- procedure has the same problem for the same reason. Per-batch commits are
-- therefore impossible from inside the SQL, and the loop has to be driven one
-- request at a time from outside it -- which is what
-- scripts/backfill-public-tokens.py does. Each batch is its own HTTP request
-- and so its own transaction, which is the property the three-step form exists
-- to provide.

-- The credential for the public page, plus the revocation and view columns
-- that hang off it. All nullable at this point; step 3 constrains the token.
alter table public."Invoice"
  add column if not exists public_token           uuid,
  add column if not exists public_link_revoked_at timestamptz,
  add column if not exists first_viewed_at        timestamptz,
  add column if not exists last_viewed_at         timestamptz,
  add column if not exists view_count             integer not null default 0;

-- Decision 4 (docs/invoice-links-plan.md section 2.0b): the platform fee rate
-- is stamped onto the invoice when it is SENT, and read back at payment time.
--
-- Deriving it at payment time instead means a lapsed contractor's client pays
-- at the Core 1% when their plan promised 0.75% -- the fee would go UP when the
-- contractor stopped subscribing, so we would earn more from a churning
-- customer than a paying one on the same invoice. Nobody chose that.
--
-- Nullable on purpose: every invoice sent before this shipped has no stamped
-- rate, and those fall back to deriving from the subscription. That fallback is
-- temporary and is commented as such at its call site.
alter table public."Invoice"
  add column if not exists platform_fee_percent numeric;

comment on column public."Invoice".public_token is
  'Credential for the public invoice page. Unguessable, never expires; only
   revocation kills it. Rotating this column invalidates the old link.';

comment on column public."Invoice".public_link_revoked_at is
  'Set when the contractor kills the link. The page then returns 410 with no
   payload at all, so a revoked link cannot render stale figures.';

comment on column public."Invoice".first_viewed_at is
  'Denormalised onto the invoice so the list view never joins PublicLinkHit.
   Permanent; the hit log behind it is pruned at 180 days.

   NOTE: viewing is deliberately NOT a status value. status holds one value, so
   an invoice that has been viewed AND is overdue could only be one of them, and
   overdue is the one the UI needs. A timestamp composes with status; an enum
   member competes with it.';

-- Rate limiting and the view log need a table. Deno edge functions run
-- per-isolate, so an in-memory counter is not shared across invocations and
-- would not actually limit anything.
create table if not exists public."PublicLinkHit" (
  id           bigserial primary key,
  invoice_id   uuid not null references public."Invoice"(id) on delete cascade,
  hit_at       timestamptz not null default now(),
  is_bot       boolean not null default false,
  referrer     text,
  -- NOT the IP, and not the user agent either.
  --
  -- These are a contractor's CLIENT's IP addresses -- third parties who never
  -- agreed to anything with us. We are a Canadian company, PIPEDA applies, and
  -- we gain nothing from storing them.
  --
  -- dedupe_hash = sha256(ip + user_agent + daily_rotating_salt). The salt
  -- rotates daily and is never stored beside the hash, so yesterday's hashes
  -- cannot be re-derived even from the same IP: dedupe works within a day, and
  -- the data stops being linkable after it.
  dedupe_hash  text
);

create index if not exists public_link_hit_invoice on public."PublicLinkHit" (invoice_id, hit_at desc);
create index if not exists public_link_hit_prune   on public."PublicLinkHit" (hit_at);
-- The rate limiter counts recent hits for one dedupe_hash across all invoices,
-- so it needs its own index -- the invoice-first index above cannot serve it.
create index if not exists public_link_hit_dedupe  on public."PublicLinkHit" (dedupe_hash, hit_at desc);

alter table public."PublicLinkHit" enable row level security;

-- The contractor may read hits for invoices they own. Deliberately no
-- has_app_access clause: this is a read of their own history, and the crew
-- lookup matches every other table.
drop policy if exists "PublicLinkHit read" on public."PublicLinkHit";
create policy "PublicLinkHit read" on public."PublicLinkHit"
  for select to authenticated
  using (exists (
    select 1 from public."Invoice" i
     where i.id = "PublicLinkHit".invoice_id
       and i.user_id in (select accessible_owner_ids(auth.uid()))
  ));

-- No INSERT/UPDATE/DELETE policy at all. Writes come only from the edge
-- function, which uses the service role and bypasses RLS. With RLS enabled and
-- no write policy, anon and authenticated can write nothing -- which is the
-- point: a client must not be able to forge or erase view history.
