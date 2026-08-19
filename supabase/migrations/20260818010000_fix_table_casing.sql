-- Rename the folded-lowercase tables to the quoted mixed-case names the app uses.
--
-- schema.sql originally declared tables unquoted (create table public.Invoice),
-- which Postgres folds to "invoice". The client queries them case-sensitively --
-- sdk.js uses from("Invoice") and the edge functions call db.getOne('Invoice')
-- -> /rest/v1/Invoice -- so every table 404s until the names match.
--
-- Re-running the corrected schema.sql does NOT fix this: its
-- "create table if not exists public.\"Invoice\"" sees no conflict with the
-- lowercase table and would create a SECOND empty table alongside it. It would
-- also abort on the policy statements, which have no IF NOT EXISTS.
--
-- Safe to run more than once: each rename fires only when the lowercase table
-- exists and the mixed-case one does not. RLS policies, indexes, constraints and
-- data all follow the table through a rename.

do $$
declare
  target text;
  targets text[] := array[
    'BusinessSettings', 'Client', 'CrewInvite', 'CrewMemberSettings',
    'EmployeeProfile', 'Invoice', 'InvoiceTemplate', 'Job', 'JobMaterial',
    'JobNote', 'JobPhoto', 'Quote', 'Receipt', 'RecurringInvoice', 'Subscription'
  ];
  renamed int := 0;
begin
  foreach target in array targets loop
    if to_regclass(format('public.%I', lower(target))) is not null
       and to_regclass(format('public.%I', target)) is null then
      execute format('alter table public.%I rename to %I', lower(target), target);
      renamed := renamed + 1;
      raise notice 'renamed % -> %', lower(target), target;
    end if;
  end loop;

  raise notice 'casing fix complete: % table(s) renamed', renamed;
end $$;

notify pgrst, 'reload schema';
