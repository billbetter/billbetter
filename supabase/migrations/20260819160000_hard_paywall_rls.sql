-- Hard paywall at the database layer.
--
-- Until now the only thing standing between a blocked user and their data was
-- a redirect in Layout.jsx. Every RLS policy was ownership-only
-- (auth.uid() = user_id), so anyone whose subscription had lapsed could still
-- read and write everything with supabase-js from the browser console -- the
-- project URL and anon key are both in the public bundle. This closes that.
--
-- Access states, per the product rule "no free tier":
--   active               -> allowed
--   trial / trialing     -> allowed ONLY while trial_end_date is in the future
--   past_due, canceled,
--   free, incomplete,
--   no row at all        -> blocked
--
-- Deliberately NOT gated, because a blocked user must still be able to fix
-- their billing:
--   Subscription      read own status; Checkout writes it
--   BusinessSettings  Stripe Connect onboarding + the billing screen
--   profiles          identity
--
-- Safe to run more than once.

-- ---------------------------------------------------------------------------
-- 1. Backfill: a trial with no end date would be denied by the rule below.
--    Nothing should be locked out by the act of installing this.
-- ---------------------------------------------------------------------------
update public."Subscription"
   set trial_end_date = coalesce(created_at, now()) + interval '7 days'
 where status in ('trial', 'trialing')
   and trial_end_date is null;

-- ---------------------------------------------------------------------------
-- 2. The single source of truth for "may this user use the app?"
--
--    SECURITY DEFINER so it can read Subscription regardless of the caller's
--    own policies -- otherwise gating Subscription would make this recurse.
--    search_path is pinned: a SECURITY DEFINER function without that can be
--    hijacked by a caller-controlled search_path.
--
--    STABLE (not IMMUTABLE): it reads a table and compares against now().
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
     where s.user_id = uid
       and s.status in ('active', 'trial', 'trialing')
       -- A paid subscription does not expire locally; Stripe's webhook moves
       -- it to past_due/canceled. A trial expires on its own date, so an
       -- unconverted trial is cut off the moment it lapses rather than
       -- whenever Stripe next sends an event.
       and (
         s.status = 'active'
         or (s.trial_end_date is not null and s.trial_end_date > now())
       )
  );
$$;

comment on function public.has_app_access(uuid) is
  'True when the user may use the core app: paid, or inside an unexpired trial. Used by every data-table RLS policy.';

revoke all on function public.has_app_access(uuid) from public;
grant execute on function public.has_app_access(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 3. Re-create every data-table policy with the access check ANDed onto the
--    existing ownership expression. Ownership semantics are preserved exactly;
--    only the extra condition is new.
--
--    with check is set explicitly. The old policies omitted it, which means
--    INSERT fell back to the using expression -- correct, but implicit.
--
--    Old policies are dropped by LOOKING THEM UP in pg_policies, not by
--    reconstructing their names. The live names are pluralised ("Users can
--    CRUD own Clients") while the table is singular ("Client"), so a
--    drop-by-guessed-name silently matched nothing -- and because permissive
--    policies are OR'd together, the surviving ungated policy would have kept
--    granting access while this migration reported success. Never guess a
--    policy name; ask the catalog.
-- ---------------------------------------------------------------------------
do $$
declare
  pol text;
  tables constant text[] := array[
    'Client', 'Invoice', 'Quote', 'Job', 'JobMaterial', 'JobNote', 'JobPhoto',
    'InvoiceTemplate', 'RecurringInvoice', 'Receipt',
    -- Crew features are gone from the UI but the tables remain; gate them too
    -- rather than leaving an ungated door open.
    'CrewMemberSettings'
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
      raise notice 'dropped % on %', pol, reg;
    end loop;
    execute format(
      'create policy %I on %s for all
         using (auth.uid() = user_id and public.has_app_access(auth.uid()))
         with check (auth.uid() = user_id and public.has_app_access(auth.uid()))',
      tbl || ' access', reg
    );
    raise notice 'gated %', reg;
  end loop;
end $$;

-- These two carry a different ownership column / expression, so they are
-- written out rather than looped, to avoid guessing at their semantics.
do $$
declare
  reg text;
  pol text;
begin
  reg := to_regclass('public."CrewInvite"')::text;
  if reg is not null then
    for pol in select policyname from pg_policies
                where schemaname = 'public' and tablename = 'CrewInvite'
    loop
      execute format('drop policy if exists %I on %s', pol, reg);
    end loop;
    execute format(
      'create policy "CrewInvite access" on %s for all
         using (auth.uid() = owner_id and public.has_app_access(auth.uid()))
         with check (auth.uid() = owner_id and public.has_app_access(auth.uid()))',
      reg
    );
  end if;

  reg := to_regclass('public."EmployeeProfile"')::text;
  if reg is not null then
    for pol in select policyname from pg_policies
                where schemaname = 'public' and tablename = 'EmployeeProfile'
    loop
      execute format('drop policy if exists %I on %s', pol, reg);
    end loop;
    execute format(
      'create policy "EmployeeProfile access" on %s for all
         using ((auth.uid() = user_id or auth.uid() = owner_id) and public.has_app_access(auth.uid()))
         with check ((auth.uid() = user_id or auth.uid() = owner_id) and public.has_app_access(auth.uid()))',
      reg
    );
  end if;
end $$;

notify pgrst, 'reload schema';
