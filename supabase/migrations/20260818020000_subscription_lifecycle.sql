-- Columns needed to handle Stripe subscription lifecycle events.
--
--   Subscription.stripe_customer_id      <- confirm-and-activate, read by stripe-webhook
--   Subscription.stripe_subscription_id  <- confirm-and-activate, read by stripe-webhook
--   Subscription.subscription_end_date   <- stripe-webhook on customer.subscription.deleted
--
-- customer.subscription.* events carry only the subscription object, so the
-- webhook maps an event back to a user by metadata.user_id, falling back to
-- these ids for subscriptions created before that metadata was stamped.
--
-- Safe to run more than once. Resolves table casing so it works either side of
-- the rename in 20260818010000_fix_table_casing.sql.

do $$
declare
  sub_tbl text := coalesce(
    to_regclass('public."Subscription"')::text,
    to_regclass('public.subscription')::text
  );
begin
  if sub_tbl is null then
    raise exception 'Subscription table not found in public schema - run schema.sql first';
  end if;

  execute format('alter table %s add column if not exists stripe_customer_id text', sub_tbl);
  execute format('alter table %s add column if not exists stripe_subscription_id text', sub_tbl);
  execute format('alter table %s add column if not exists subscription_end_date timestamp with time zone', sub_tbl);

  -- The webhook looks rows up by these on every lifecycle event.
  execute format(
    'create index if not exists subscription_stripe_subscription_id_idx on %s (stripe_subscription_id)',
    sub_tbl
  );
  execute format(
    'create index if not exists subscription_stripe_customer_id_idx on %s (stripe_customer_id)',
    sub_tbl
  );

  raise notice 'Patched % for subscription lifecycle', sub_tbl;
end $$;

notify pgrst, 'reload schema';
