-- Columns the Stripe edge functions write to but that schema.sql never created.
--
--   Invoice.stripe_payment_intent_id  <- stripe-webhook (checkout.session.completed,
--                                       payment_intent.succeeded)
--   Invoice.stripe_session_id         <- create-invoice-payment-link
--   Subscription.trial_end_date       <- confirm-and-activate (7-day trial path)
--
-- Without these, PostgREST rejects the PATCH with PGRST204 and the webhook 500s,
-- so paid invoices never flip to 'paid' and trial signups never activate.
--
-- schema.sql declares tables unquoted (create table public.Invoice), which Postgres
-- folds to lowercase, while the client queries them case-sensitively as "Invoice".
-- Resolve whichever name actually exists rather than assuming.

do $$
declare
  inv_tbl text := coalesce(
    to_regclass('public."Invoice"')::text,
    to_regclass('public.invoice')::text
  );
  sub_tbl text := coalesce(
    to_regclass('public."Subscription"')::text,
    to_regclass('public.subscription')::text
  );
begin
  if inv_tbl is null then
    raise exception 'Invoice table not found in public schema - run schema.sql first';
  end if;
  if sub_tbl is null then
    raise exception 'Subscription table not found in public schema - run schema.sql first';
  end if;

  execute format('alter table %s add column if not exists stripe_payment_intent_id text', inv_tbl);
  execute format('alter table %s add column if not exists stripe_session_id text', inv_tbl);
  execute format('alter table %s add column if not exists trial_end_date timestamp with time zone', sub_tbl);

  raise notice 'Patched % and %', inv_tbl, sub_tbl;
end $$;

notify pgrst, 'reload schema';
