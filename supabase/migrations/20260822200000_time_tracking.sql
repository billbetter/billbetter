-- Time tracking and job costing.
--
-- Job already carries estimated_hours, hourly_rate, labor_cost, materials_cost
-- and actual_cost, and ProfitabilityMetrics already charts profit per job --
-- but nothing ever recorded an actual hour, so labor_cost could only be typed
-- in by hand. This is the missing input.
--
-- Deliberately timestamped BEFORE the crew migration so that migration's table
-- loop finds TimeEntry and gates it with the same owner-set policy as every
-- other business table. The policy created here is the solo-only form and is
-- replaced there; it is written out anyway so this file stands alone if the
-- crew migration is ever rolled back.
--
-- Safe to run more than once.

create table if not exists public."TimeEntry" (
  id uuid primary key default gen_random_uuid(),

  -- The BUSINESS the entry belongs to, not the person who worked. Every RLS
  -- policy in this schema keys off user_id, so a crew member's hours must be
  -- stamped with their employer's id or the owner could not see them.
  user_id uuid references auth.users not null,

  -- Who actually did the work. Equals user_id for a solo contractor.
  member_user_id uuid references auth.users,
  member_name text,

  job_id uuid references public."Job" on delete cascade,
  client_id uuid references public."Client" on delete set null,

  started_at timestamp with time zone not null default timezone('utc'::text, now()),
  ended_at timestamp with time zone,

  -- Stored rather than always derived: a running entry has no end yet, and a
  -- manually entered timesheet row ("3 hours on Tuesday") never had a clock.
  duration_minutes integer,

  -- Snapshotted at stop time. Raising someone's rate must not silently restate
  -- the cost of work they already did, or of an invoice already sent.
  hourly_rate numeric,

  billable boolean default true,
  invoiced boolean default false,
  invoice_id uuid,
  notes text,

  created_at timestamp with time zone default timezone('utc'::text, now()),
  updated_at timestamp with time zone default timezone('utc'::text, now())
);

alter table public."TimeEntry" enable row level security;

do $$
declare pol text;
begin
  for pol in select policyname from pg_policies
              where schemaname = 'public' and tablename = 'TimeEntry'
  loop
    execute format('drop policy if exists %I on public."TimeEntry"', pol);
  end loop;
end $$;

create policy "TimeEntry access" on public."TimeEntry" for all
  using (auth.uid() = user_id and public.has_app_access(auth.uid()))
  with check (auth.uid() = user_id and public.has_app_access(auth.uid()));

create index if not exists time_entry_job_idx on public."TimeEntry" (job_id);
create index if not exists time_entry_user_idx on public."TimeEntry" (user_id);
create index if not exists time_entry_member_idx on public."TimeEntry" (member_user_id);

-- At most one running entry per person. Two open clocks means every duration
-- computed from "now" is wrong and there is no way to tell which is real.
create unique index if not exists time_entry_one_running_per_member
  on public."TimeEntry" (member_user_id) where ended_at is null;

-- Job carries estimated_hours but never had a place to put the real number.
alter table public."Job"
  add column if not exists actual_hours numeric;

notify pgrst, 'reload schema';
