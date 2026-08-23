-- Run as superuser, once, before the test.
--
-- PostgREST connects as `authenticated`, which holds table privileges but is
-- NOT a superuser and does NOT own the tables -- that is precisely why RLS
-- applies to it. Testing as `postgres` proves nothing: superusers bypass RLS,
-- so every policy silently passes.

grant usage on schema public, auth to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant execute on all functions in schema public to authenticated;
grant select on auth.users to authenticated;
