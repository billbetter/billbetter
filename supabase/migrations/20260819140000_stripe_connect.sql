-- Columns needed to accept payments on behalf of contractors via Stripe Connect.
--
--   BusinessSettings.stripe_account_id   <- stripe-connect-onboard, read by
--                                           stripe-connect-status and
--                                           create-invoice-payment-link
--   BusinessSettings.currency            <- create-invoice-payment-link
--
-- schema.sql already declares stripe_account_status and
-- stripe_onboarding_completed, and Settings.jsx reads stripe_account_id, but the
-- column was never created -- so the id had nowhere to live and every payment
-- link fell back to charging the platform account instead of the contractor's.
--
-- Currency was hardcoded to 'usd' in create-invoice-payment-link while the
-- product bills in CAD. Making it a setting stops the invoice total and the
-- amount charged disagreeing.
--
-- Safe to run more than once. Resolves table casing so it works either side of
-- the rename in 20260818010000_fix_table_casing.sql.

do $$
declare
  bs_tbl text := coalesce(
    to_regclass('public."BusinessSettings"')::text,
    to_regclass('public.businesssettings')::text
  );
  inv_tbl text := coalesce(
    to_regclass('public."Invoice"')::text,
    to_regclass('public.invoice')::text
  );
begin
  if bs_tbl is null then
    raise exception 'BusinessSettings table not found in public schema - run schema.sql first';
  end if;

  execute format('alter table %s add column if not exists stripe_account_id text', bs_tbl);
  execute format('alter table %s add column if not exists currency text default ''CAD''', bs_tbl);

  -- stripe-webhook maps account.updated back to a row by this id.
  execute format(
    'create index if not exists businesssettings_stripe_account_id_idx on %s (stripe_account_id)',
    bs_tbl
  );

  -- What the platform actually kept on a paid invoice. Recorded per invoice
  -- because the rate follows the plan the user was on at the time, and plans
  -- change.
  if inv_tbl is not null then
    execute format('alter table %s add column if not exists platform_fee_amount numeric', inv_tbl);
  end if;

  raise notice 'Patched % for Stripe Connect', bs_tbl;
end $$;

notify pgrst, 'reload schema';
