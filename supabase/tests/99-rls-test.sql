-- What each signed-in user can actually see and do.
--
-- Every case runs inside BEGIN ... ROLLBACK with `set local role authenticated`
-- and the JWT claim set -- the same pair PostgREST establishes per request.
-- Both parts matter: the claim alone leaves you as superuser, and a superuser
-- bypasses RLS, so the whole suite would pass while proving nothing.

\pset pager off
\set ON_ERROR_STOP on

\echo ''
\echo '=== 1. has_app_access: does a crew member inherit their employer? ======='
begin;
set local role authenticated;
select
  public.has_app_access('00000000-0000-0000-0000-0000000000a1') as owner_a,
  public.has_app_access('00000000-0000-0000-0000-0000000000d1') as crew_of_a,
  public.has_app_access('00000000-0000-0000-0000-0000000000c1') as lapsed_c,
  public.has_app_access('00000000-0000-0000-0000-0000000000e1') as crew_of_lapsed,
  public.has_app_access('00000000-0000-0000-0000-0000000000f1') as nomad;
rollback;
\echo 'expect:            t         t         f         f         f'

\echo ''
\echo '=== 2. Row visibility, per user, as `authenticated` ====================='
\echo '     owner A and owner B each own 1 client / 1 invoice / 1 job'
begin;
set local role authenticated;

set local request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000a1';
select 'owner A' as who, (select count(*) from public."Client") c,
       (select count(*) from public."Invoice") i, (select count(*) from public."Job") j,
       (select count(*) from public."BusinessSettings") s;

set local request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000b1';
select 'owner B', (select count(*) from public."Client"),
       (select count(*) from public."Invoice"), (select count(*) from public."Job"),
       (select count(*) from public."BusinessSettings");

set local request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000d1';
select 'crew of A', (select count(*) from public."Client"),
       (select count(*) from public."Invoice"), (select count(*) from public."Job"),
       (select count(*) from public."BusinessSettings");

set local request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000c1';
select 'lapsed C', (select count(*) from public."Client"),
       (select count(*) from public."Invoice"), (select count(*) from public."Job"),
       (select count(*) from public."BusinessSettings");

set local request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000e1';
select 'crew of lapsed', (select count(*) from public."Client"),
       (select count(*) from public."Invoice"), (select count(*) from public."Job"),
       (select count(*) from public."BusinessSettings");

set local request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000f1';
select 'nomad', (select count(*) from public."Client"),
       (select count(*) from public."Invoice"), (select count(*) from public."Job"),
       (select count(*) from public."BusinessSettings");
rollback;
\echo 'expect: owner A 1/1/1/1 | owner B 1/1/1/1 | crew of A 1/1/1/1'
\echo '        lapsed C 0/0/0/1 (settings ungated so they can fix billing)'
\echo '        crew of lapsed 0/0/0/1 | nomad 0/0/0/0'

\echo ''
\echo '=== 3. Crew sees their employer''s client and NOT business B ============'
begin;
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000d1';
select name from public."Client" order by name;
rollback;
\echo 'expect: A client only'

\echo ''
\echo '=== 4. Crew MAY write into their employer''s business ==================='
begin;
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000d1';
do $$
begin
  insert into public."Client" (user_id, name)
    values ('00000000-0000-0000-0000-0000000000a1', 'added by crew');
  raise notice 'RESULT: ALLOWED  (correct)';
exception when others then
  raise notice 'RESULT: BLOCKED (%)  <-- crew cannot do their job', sqlerrm;
end $$;
rollback;

\echo ''
\echo '=== 5. Crew may NOT write into a business they do not belong to ========'
begin;
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000d1';
do $$
begin
  insert into public."Client" (user_id, name)
    values ('00000000-0000-0000-0000-0000000000b1', 'smuggled into B');
  raise notice 'RESULT: ALLOWED  <-- SECURITY FAILURE';
exception when insufficient_privilege then
  raise notice 'RESULT: BLOCKED  (correct)';
end $$;
rollback;

\echo ''
\echo '=== 6. Crew may NOT rewrite the employer''s payout settings ============='
begin;
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000d1';
do $$
declare n int;
begin
  update public."BusinessSettings" set business_name = 'HIJACKED'
   where user_id = '00000000-0000-0000-0000-0000000000a1';
  get diagnostics n = row_count;
  if n > 0 then raise notice 'RESULT: WROTE % row(s)  <-- SECURITY FAILURE', n;
  else raise notice 'RESULT: BLOCKED  (correct)'; end if;
exception when insufficient_privilege then
  raise notice 'RESULT: BLOCKED  (correct)';
end $$;
rollback;

\echo ''
\echo '=== 7. Crew CAN read the employer''s branding (name on every PDF) ======='
begin;
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000d1';
select business_name from public."BusinessSettings";
rollback;
\echo 'expect: Business A only'

\echo ''
\echo '=== 8. Crew may NOT promote themselves to admin ========================'
begin;
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000d1';
do $$
declare n int;
begin
  update public."EmployeeProfile" set role = 'admin'
   where user_id = '00000000-0000-0000-0000-0000000000d1';
  get diagnostics n = row_count;
  if n > 0 then raise notice 'RESULT: WROTE % row(s)  <-- SECURITY FAILURE', n;
  else raise notice 'RESULT: BLOCKED  (correct)'; end if;
exception when insufficient_privilege then
  raise notice 'RESULT: BLOCKED  (correct)';
end $$;
rollback;

\echo ''
\echo '=== 9. Crew may NOT read the employer''s Subscription (billing) ========='
begin;
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000d1';
select count(*) as subscription_rows_visible from public."Subscription";
rollback;
\echo 'expect: 0  -- my_app_access() is how they get admitted, not this row'

\echo ''
\echo '=== 10. my_app_access() admits crew without exposing anything =========='
begin;
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000d1';
select public.my_app_access() as crew_admitted;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000f1';
select public.my_app_access() as nomad_admitted;
rollback;
\echo 'expect: t then f'

\echo ''
\echo '=== 11. Removing a member revokes access immediately ==================='
begin;
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000a1';
update public."EmployeeProfile" set is_active = false
 where user_id = '00000000-0000-0000-0000-0000000000d1';
set local request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000d1';
select public.has_app_access('00000000-0000-0000-0000-0000000000d1') as still_has_access,
       (select count(*) from public."Client") as clients_visible;
rollback;
\echo 'expect: f, 0'

\echo ''
\echo '=== 12. A SOLO owner is byte-for-byte unaffected ======================='
\echo '     owner B has no crew at all -- the whole point of the additive claim'
begin;
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000b1';
select
  (select count(*) from public."Client")  as own_clients,
  (select count(*) from public."Client" where user_id <> '00000000-0000-0000-0000-0000000000b1') as foreign_clients,
  public.has_app_access('00000000-0000-0000-0000-0000000000b1') as has_access;
rollback;
\echo 'expect: 1, 0, t'

\echo ''
\echo '=== 13. One running time entry per person (partial unique index) ======='
begin;
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000a1';
insert into public."TimeEntry" (user_id, member_user_id, started_at)
  values ('00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-0000000000a1', now());
do $$
begin
  insert into public."TimeEntry" (user_id, member_user_id, started_at)
    values ('00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-0000000000a1', now());
  raise notice 'RESULT: SECOND CLOCK ALLOWED  <-- durations become ambiguous';
exception when unique_violation then
  raise notice 'RESULT: BLOCKED  (correct)';
end $$;
rollback;
