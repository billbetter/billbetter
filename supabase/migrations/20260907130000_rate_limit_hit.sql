-- Per-user rate limiting for the endpoints that spend money.
--
-- See supabase/functions/_shared/rate-limit.ts for the budgets and the
-- reasoning; this file is only the counter they read.
--
-- -- Why a table ------------------------------------------------------------
--
-- Deno edge functions run per-isolate. An in-memory counter is not shared
-- across invocations and is wiped when an isolate recycles, so it caps nothing
-- a reconnecting client cannot walk around. invoke-llm had exactly that and
-- described itself, correctly, as "a brake, not a wall". Counting rows is what
-- makes it a wall, and it is the same mechanism already proven on
-- "PublicLinkHit" for the public endpoints.
--
-- -- What is stored ---------------------------------------------------------
--
-- `bucket` is '<endpoint>:<user uuid>'. No IP, no user agent, no request body.
-- The user id is ours and already on every row this product writes; nothing
-- here is a third party's data, which is the reason "PublicLinkHit" had to hash
-- its identity and this does not.

create table if not exists public."RateLimitHit" (
  id      bigserial primary key,
  bucket  text        not null,
  hit_at  timestamptz not null default now()
);

-- The only query the limiter runs: count rows for one bucket since a cutoff.
-- bucket first, hit_at descending -- the same shape as public_link_hit_dedupe,
-- for the same reason.
create index if not exists rate_limit_hit_bucket on public."RateLimitHit" (bucket, hit_at desc);
-- Separate index for the pruning job, which sweeps by time across all buckets.
create index if not exists rate_limit_hit_prune  on public."RateLimitHit" (hit_at);

alter table public."RateLimitHit" enable row level security;

-- No policy at all -- not for select, not for anything.
--
-- Deliberate, and different from "PublicLinkHit", which lets a contractor read
-- their own view history because that is a product feature. There is no feature
-- here: nobody needs to read their own rate-limit counters, and a client that
-- could read them learns exactly how close it is to the cap. Writes come only
-- from the edge functions, which use the service role and bypass RLS. With RLS
-- enabled and no policy, anon and authenticated can neither read nor forge nor
-- erase a counter.

comment on table public."RateLimitHit" is
  'One row per rate-limited call. bucket = <endpoint>:<user uuid>. Written by
   edge functions through the service role only; pruned daily at 24h, which is
   the longest window any budget uses. Not an audit log -- rows are disposable
   and nothing should ever join to it.';

-- -- Retention --------------------------------------------------------------
--
-- The longest window in RATE_LIMITS is 24 hours, so anything older than that
-- can never affect a decision. Without this the table grows forever and the
-- index behind every limited request grows with it -- the limiter would slowly
-- become the latency it was added to prevent.
--
-- Same skip-rather-than-fail structure as the demand-letter sweep: a fresh
-- clone or a local `supabase db reset` has no pg_cron, and a migration that
-- raised there would block work unrelated to rate limiting. The sharp edge is
-- the same too -- on production a silent skip means rows accumulate and nothing
-- says so. Verify after applying, with:
--
--     select jobname, schedule, active from cron.job
--      where jobname = 'prune-rate-limit-hits';
--
-- Zero rows means pg_cron was not installed when this ran. Install it and
-- re-run this file; cron.schedule() upserts on the job name, so applying it
-- twice is safe.
--
-- 03:20 UTC: off the hour, so it does not pile onto every other cron job that
-- was written as '0 * * * *'.
do $$
begin
  if not exists (select 1 from pg_extension where extname = 'pg_cron') then
    raise notice 'pg_cron not installed - skipping prune-rate-limit-hits schedule';
    return;
  end if;

  perform cron.schedule(
    'prune-rate-limit-hits',
    '20 3 * * *',
    $cmd$delete from public."RateLimitHit" where hit_at < now() - interval '24 hours';$cmd$
  );

  raise notice 'scheduled prune-rate-limit-hits at 03:20 UTC';
end
$$;
