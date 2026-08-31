-- Create public."JobExpense", the table the job expenses feature has always
-- been written against and which has never existed.
--
-- -- What is broken right now ----------------------------------------------
--
-- src/components/jobPhotos/JobExpensesTab.jsx (1143 lines), JobDetailView's
-- expense count, and CreateInvoice's "billable job expenses" panel all read
-- and write `JobExpense`. Every one of those calls answers:
--
--     HTTP 404  PGRST205  Could not find the table 'public.JobExpense'
--
-- So receipts scanned into a job are discarded, the expense count is always 0,
-- and the invoice panel that would bill those expenses never appears. The UI
-- swallows the error (`catch (e) {}`), which is why it looks merely empty
-- rather than broken.
--
-- -- Why not point the code at JobMaterial instead --------------------------
--
-- JobMaterial exists, is empty, and is a different thing: item_name, unit,
-- price_estimate, total_estimate, purchased -- an ESTIMATE line for planning a
-- job. JobExpense is a recorded cost: vendor, receipt_url, category,
-- expense_date, and the three columns the feature exists for --
-- markup_percent, billable_amount and include_in_invoice, which are how a
-- contractor marks up a receipt and bills it on. Repointing would drop those
-- and delete the feature rather than fix it.
--
-- -- Shape --------------------------------------------------------------
--
-- Columns are exactly what the two write paths in JobExpensesTab send, no
-- more. PostgREST rejects an ENTIRE insert for one unknown key, so a column
-- missing here fails the whole save, and a column here that nothing writes is
-- dead weight that later reads as a feature nobody built.
--
-- Conventions copied from JobMaterial rather than invented: uuid id defaulting
-- to gen_random_uuid(), user_id NOT NULL referencing auth.users, job_id
-- cascading from Job, and the identical RLS policy. Deliberately additive --
-- it creates one new table and touches nothing that exists.

create table if not exists public."JobExpense" (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  job_id uuid references public."Job"(id) on delete cascade,

  description text,
  vendor text,
  category text,
  -- What it cost. `amount` is the total for the line; quantity and unit_cost
  -- are what the receipt scanner breaks it into and are informational.
  amount numeric,
  quantity numeric default 1,
  unit_cost numeric,

  -- What the client is charged. Written by the UI rather than computed here:
  -- computeBillable() already owns that arithmetic, and a generated column
  -- would silently disagree with the figure the contractor was shown while
  -- typing.
  markup_percent numeric default 0,
  billable_amount numeric,
  include_in_invoice boolean default true,

  receipt_url text,
  expense_date date,
  notes text,
  created_at timestamp with time zone default now()
);

-- Every read is "the expenses on this job", from three separate screens.
create index if not exists jobexpense_job_id_idx on public."JobExpense" (job_id);
create index if not exists jobexpense_user_id_idx on public."JobExpense" (user_id);

alter table public."JobExpense" enable row level security;

-- Byte-for-byte the policy on Job, JobPhoto and JobMaterial. accessible_owner_ids
-- is what lets a crew member reach their employer's rows; has_app_access is the
-- hard paywall. A new table with a hand-rolled policy is how those two drift.
drop policy if exists "JobExpense access" on public."JobExpense";
create policy "JobExpense access" on public."JobExpense"
  for all
  using (
    user_id in (select accessible_owner_ids(auth.uid()))
    and has_app_access(auth.uid())
  )
  with check (
    user_id in (select accessible_owner_ids(auth.uid()))
    and has_app_access(auth.uid())
  );

notify pgrst, 'reload schema';
