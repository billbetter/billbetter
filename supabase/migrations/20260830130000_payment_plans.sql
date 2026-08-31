-- Progress invoicing: a plan of stages that ISSUES ordinary invoices.
--
-- -- The shape, and why ----------------------------------------------------
--
-- A plan holds the stages (deposit 30%, rough-in 40%, completion 30%). When a
-- stage is released it becomes a normal row in Invoice -- not a special kind
-- of invoice, and not a sub-record. That is the whole design decision:
--
--   * the public link, Stripe checkout, overdue status, batch send and the
--     reminder queue all keep working with no special cases;
--   * nothing that reads Invoice today has to learn what a plan is;
--   * a plan that is deleted leaves its issued invoices standing, because the
--     client has already been billed and that fact is not ours to retract.
--
-- Stages are jsonb rather than a second table, following Invoice.items and
-- Quote.items. They are read and written whole, always in the context of
-- their plan, and never queried across plans -- which is exactly the case
-- jsonb suits. Each stage looks like:
--
--   { "id": "stg_1", "label": "Deposit", "percent": 30, "amount": 3600,
--     "due_date": "2026-09-01", "invoice_id": null, "released_at": null }
--
-- `amount` is stored alongside `percent` on purpose. Percentages are how the
-- plan is written, but the amount is what the client is billed, and rounding
-- 30% of 12,000.01 three different ways must not produce three totals that
-- fail to add up to the contract. The amount is settled once, when the plan
-- is created, and the code makes the last stage absorb the rounding.
--
-- Additive: one new table, plus two nullable columns on Invoice.

create table if not exists public."PaymentPlan" (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  client_id uuid references public."Client"(id),
  -- Where the plan came from. Both nullable: a plan can be written straight
  -- against a client with no job or quote behind it.
  job_id uuid references public."Job"(id) on delete set null,
  quote_id uuid references public."Quote"(id) on delete set null,

  title text,
  client_name text,
  total_amount numeric not null default 0,
  tax_rate numeric default 0,
  notes text,

  stages jsonb not null default '[]'::jsonb,

  -- active | completed | cancelled. Deliberately NOT constrained by a CHECK
  -- yet: Quote.status taught us that adding one later against known values is
  -- safe, while guessing the vocabulary up front is how you end up with a
  -- constraint that refuses a state the product later needs.
  status text not null default 'active',

  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

create index if not exists paymentplan_user_id_idx on public."PaymentPlan" (user_id);
create index if not exists paymentplan_job_id_idx on public."PaymentPlan" (job_id);

alter table public."PaymentPlan" enable row level security;

-- Byte-for-byte the policy on Job, JobPhoto and JobMaterial.
drop policy if exists "PaymentPlan access" on public."PaymentPlan";
create policy "PaymentPlan access" on public."PaymentPlan"
  for all
  using (
    user_id in (select accessible_owner_ids(auth.uid()))
    and has_app_access(auth.uid())
  )
  with check (
    user_id in (select accessible_owner_ids(auth.uid()))
    and has_app_access(auth.uid())
  );

-- The back-reference from an issued invoice to the stage that issued it.
--
-- Nullable, with no foreign key on plan_stage_id because a stage is a jsonb
-- element rather than a row. payment_plan_id DOES get one, set null on delete:
-- deleting a plan must never cascade into deleting invoices a client has
-- already been sent and may already have paid.
alter table public."Invoice"
  add column if not exists payment_plan_id uuid references public."PaymentPlan"(id) on delete set null;
alter table public."Invoice"
  add column if not exists plan_stage_id text;

create index if not exists invoice_payment_plan_id_idx on public."Invoice" (payment_plan_id);

notify pgrst, 'reload schema';
