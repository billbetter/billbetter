-- Crew access: make the EmployeeProfile / CrewInvite tables actually reachable.
--
-- The tables, the RLS policies and the send-crew-invite function have existed
-- since the original schema, and Professional has sold "crew management" the
-- whole time, but no crew member could ever use the app. Two separate walls:
--
--   1. has_app_access(uid) requires a Subscription row owned by uid. A crew
--      member does not buy anything -- their employer does -- so every gated
--      table returned zero rows for them.
--   2. Every policy is `auth.uid() = user_id`. Even past wall 1, a crew member
--      would see only rows they personally created, never the business's.
--
-- Both changes here are ADDITIVE. No existing user loses access, and a solo
-- account with no EmployeeProfile rows resolves to exactly the old behaviour --
-- accessible_owner_ids(uid) returns {uid}, so `user_id in (...)` collapses back
-- to `auth.uid() = user_id`.
--
-- Safe to run more than once.

-- ---------------------------------------------------------------------------
-- 1. Which businesses may this user touch?
--
--    Yourself, always. Plus any business you are an ACTIVE crew member of.
--
--    SECURITY DEFINER matters twice over. It lets the function read
--    EmployeeProfile regardless of the caller's own policies, and -- because
--    EmployeeProfile is itself gated by a policy that will call this function --
--    it is what stops the policy recursing into itself.
-- ---------------------------------------------------------------------------
create or replace function public.accessible_owner_ids(uid uuid)
returns setof uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select uid
  union
  select e.owner_id
    from public."EmployeeProfile" e
   where e.user_id = uid
     and coalesce(e.is_active, true)
$$;

comment on function public.accessible_owner_ids(uuid) is
  'Owner ids whose business data this user may read/write: themselves, plus any business they are active crew of.';

revoke all on function public.accessible_owner_ids(uuid) from public;
grant execute on function public.accessible_owner_ids(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 2. A crew member inherits their employer's subscription.
--
--    Rewritten as: does ANY business I can touch have a live subscription?
--    For a solo user that is the original query verbatim, so this can only
--    ever grant access, never withdraw it.
--
--    The trial rule is unchanged: active never expires locally, a trial dies
--    on its own date.
-- ---------------------------------------------------------------------------
create or replace function public.has_app_access(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
      from public."Subscription" s
     where s.user_id in (select public.accessible_owner_ids(uid))
       and s.status in ('active', 'trial', 'trialing')
       and (
         s.status = 'active'
         or (s.trial_end_date is not null and s.trial_end_date > now())
       )
  );
$$;

comment on function public.has_app_access(uuid) is
  'True when the user may use the core app: paid, inside an unexpired trial, or active crew of a business that is.';

-- ---------------------------------------------------------------------------
-- 2b. Let the CLIENT ask the same question.
--
--     Layout decides whether to show the app by reading the user's own
--     Subscription row. A crew member does not have one -- their employer does,
--     and Subscription policy is still owner-only (deliberately: it carries the
--     Stripe customer and subscription ids, which are none of an employee's
--     business). So without this the browser would bounce a perfectly valid
--     crew member to the pricing page while the database happily served them.
--
--     Returning a boolean rather than opening up the row is the whole point:
--     the client learns exactly one bit, and it is the same bit RLS uses.
-- ---------------------------------------------------------------------------
create or replace function public.my_app_access()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.has_app_access(auth.uid());
$$;

comment on function public.my_app_access() is
  'Does the calling user have app access? Boolean only -- lets a crew member be admitted without exposing their employer''s billing row.';

revoke all on function public.my_app_access() from public;
grant execute on function public.my_app_access() to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 3. Re-gate every business table on the owner set instead of a single id.
--
--    Same drop-by-catalog-lookup discipline as the paywall migration: the live
--    policy names do not match anything you would guess, and because permissive
--    policies are OR'd, a missed drop leaves the old ungated door open while
--    the migration still reports success. Never guess a policy name.
-- ---------------------------------------------------------------------------
do $$
declare
  pol text;
  tables constant text[] := array[
    'Client', 'Invoice', 'Quote', 'Job', 'JobMaterial', 'JobNote', 'JobPhoto',
    'InvoiceTemplate', 'RecurringInvoice', 'Receipt', 'TimeEntry'
  ];
  tbl text;
  reg text;
begin
  foreach tbl in array tables loop
    reg := coalesce(
      to_regclass(format('public.%I', tbl))::text,
      to_regclass(format('public.%I', lower(tbl)))::text
    );
    if reg is null then
      raise notice 'skipping %, table not present', tbl;
      continue;
    end if;

    for pol in select policyname from pg_policies
                where schemaname = 'public'
                  and tablename in (tbl, lower(tbl))
    loop
      execute format('drop policy if exists %I on %s', pol, reg);
    end loop;

    execute format(
      'create policy %I on %s for all
         using (user_id in (select public.accessible_owner_ids(auth.uid()))
                and public.has_app_access(auth.uid()))
         with check (user_id in (select public.accessible_owner_ids(auth.uid()))
                and public.has_app_access(auth.uid()))',
      tbl || ' access', reg
    );
    raise notice 'crew-gated %', reg;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 4. BusinessSettings is readable by crew, writable only by the owner.
--
--    Crew need the business name, logo and theme to render a document. They
--    must not be able to repoint the Stripe Connect account or the payout
--    email, which live on the same row -- so the write side stays owner-only.
--
--    It is deliberately NOT behind has_app_access, same as before: a lapsed
--    owner has to be able to reach the billing screen to fix their card.
-- ---------------------------------------------------------------------------
do $$
declare
  reg text;
  pol text;
begin
  reg := to_regclass('public."BusinessSettings"')::text;
  if reg is null then return; end if;

  for pol in select policyname from pg_policies
              where schemaname = 'public' and tablename = 'BusinessSettings'
  loop
    execute format('drop policy if exists %I on %s', pol, reg);
  end loop;

  execute format(
    'create policy "BusinessSettings read" on %s for select
       using (user_id in (select public.accessible_owner_ids(auth.uid())))', reg);
  execute format(
    'create policy "BusinessSettings insert" on %s for insert
       with check (auth.uid() = user_id)', reg);
  execute format(
    'create policy "BusinessSettings update" on %s for update
       using (auth.uid() = user_id) with check (auth.uid() = user_id)', reg);
  execute format(
    'create policy "BusinessSettings delete" on %s for delete
       using (auth.uid() = user_id)', reg);
end $$;

-- ---------------------------------------------------------------------------
-- 5. The crew tables themselves.
--
--    EmployeeProfile: the owner manages the roster; a member may read their own
--    row (that is how the app learns who it is working for) but not edit it --
--    otherwise a member could promote themselves to admin, or flip is_active
--    back on after being removed.
--
--    CrewInvite: the owner manages invites. An invitee is not yet in
--    EmployeeProfile and may not even have an account, so acceptance cannot be
--    done from the browser under RLS -- it runs in the accept-crew-invite edge
--    function on the service role. Nothing here grants the invitee direct
--    access to the row.
-- ---------------------------------------------------------------------------
do $$
declare
  reg text;
  pol text;
begin
  reg := to_regclass('public."EmployeeProfile"')::text;
  if reg is not null then
    for pol in select policyname from pg_policies
                where schemaname = 'public' and tablename = 'EmployeeProfile'
    loop
      execute format('drop policy if exists %I on %s', pol, reg);
    end loop;

    execute format(
      'create policy "EmployeeProfile owner manage" on %s for all
         using (auth.uid() = owner_id and public.has_app_access(auth.uid()))
         with check (auth.uid() = owner_id and public.has_app_access(auth.uid()))',
      reg);
    execute format(
      'create policy "EmployeeProfile self read" on %s for select
         using (auth.uid() = user_id)', reg);
  end if;

  reg := to_regclass('public."CrewInvite"')::text;
  if reg is not null then
    for pol in select policyname from pg_policies
                where schemaname = 'public' and tablename = 'CrewInvite'
    loop
      execute format('drop policy if exists %I on %s', pol, reg);
    end loop;
    execute format(
      'create policy "CrewInvite owner manage" on %s for all
         using (auth.uid() = owner_id and public.has_app_access(auth.uid()))
         with check (auth.uid() = owner_id and public.has_app_access(auth.uid()))',
      reg);
  end if;

  -- Personal preferences, always your own, never gated on the paywall: a
  -- removed member must still be able to load their own profile screen.
  reg := to_regclass('public."CrewMemberSettings"')::text;
  if reg is not null then
    for pol in select policyname from pg_policies
                where schemaname = 'public' and tablename = 'CrewMemberSettings'
    loop
      execute format('drop policy if exists %I on %s', pol, reg);
    end loop;
    execute format(
      'create policy "CrewMemberSettings self" on %s for all
         using (auth.uid() = user_id) with check (auth.uid() = user_id)', reg);
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 6. Columns the roster UI needs that the original table did not carry.
-- ---------------------------------------------------------------------------
alter table public."EmployeeProfile"
  add column if not exists name text,
  add column if not exists email text,
  add column if not exists hourly_rate numeric,
  add column if not exists phone text,
  add column if not exists removed_at timestamp with time zone;

alter table public."CrewInvite"
  add column if not exists token text,
  add column if not exists expires_at timestamp with time zone;

-- One active membership per person per business. Without this a double-accepted
-- invite silently duplicates the row, and accessible_owner_ids starts returning
-- the same owner twice.
create unique index if not exists employee_profile_unique_member
  on public."EmployeeProfile" (owner_id, user_id);

create index if not exists employee_profile_user_idx
  on public."EmployeeProfile" (user_id) where coalesce(is_active, true);

create index if not exists crew_invite_token_idx
  on public."CrewInvite" (token);

notify pgrst, 'reload schema';
