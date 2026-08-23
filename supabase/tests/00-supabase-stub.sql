-- Enough of Supabase to run the real migrations unmodified.
--
-- auth.uid() reads the same GUC PostgREST sets, so impersonation in the test is
-- exactly what happens in production: set the claim, then query as a role that
-- RLS actually applies to.

create schema if not exists auth;

create table if not exists auth.users (
  id uuid primary key,
  email text,
  -- schema.sql installs a trigger on this table that reads the column, so the
  -- stub has to carry it or the fixtures fail for a reason unrelated to RLS.
  raw_user_meta_data jsonb default '{}'::jsonb
);

create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

-- PostgREST's roles. RLS is bypassed by superusers and table owners, so the
-- test must query as `authenticated` or it proves nothing.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
end $$;

grant usage on schema public, auth to authenticated, service_role, anon;
