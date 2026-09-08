-- Who asked for a demo, and what they do.
--
-- -- Why this table exists at all -------------------------------------------
--
-- /BookDemo currently asks for nothing. It is a page of copy and a button that
-- opens a Google appointment link, so the only thing we ever learn about a lead
-- is whatever Google's own booking form collects -- a name and an email -- and
-- that arrives in a calendar invite rather than anywhere you can sort, count or
-- follow up from.
--
-- The four questions the form now asks are chosen to do double duty: they
-- qualify the lead AND personalise the follow-up. Trade type in particular is
-- the difference between "thanks for booking" and "here is how we handle
-- progress billing for electrical work".
--
-- Phone rather than email, deliberately. A trade will give you a number they
-- actually answer far more readily than an address they check on Sundays, and
-- a text gets read. Google collects the email at the booking step anyway, so
-- asking for it here would be asking twice for the weaker of the two.
--
-- -- Deliberately NOT routed through sendContactEmail ------------------------
--
-- That is the obvious home for a lead form and it is a trap: sendContactEmail
-- is a stub (src/api/sdk.js returns notImplemented for it), so the public
-- contact form has been reporting "message sent" and discarding every message.
-- Sending demo requests down the same pipe would lose them exactly as quietly.
-- A row in a table you can read is worth more than an email nobody sends.

create table if not exists public."DemoRequest" (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),

  -- Lengths are constrained rather than left open because this table is
  -- writable by anonymous visitors (see the policy below). A cap is the
  -- cheapest defence against somebody posting a novel into it.
  name  text not null check (length(name)  between 1 and 120),
  phone text not null check (length(phone) between 7 and 40),
  trade text not null check (length(trade) between 1 and 60),

  -- One click, two answers. Kept as a constrained string rather than a boolean
  -- because "solo" and "crew" are what the form asks and what a human reading
  -- this table wants to see -- a column of true/false would need a legend.
  team_size text not null check (team_size in ('solo', 'crew')),

  -- Which page sent them, so the two entry points can be told apart later.
  source text check (source is null or length(source) <= 60),

  -- Set by hand once somebody has actually called them back. Nothing writes it
  -- yet; it exists so the first person working the list has somewhere to put
  -- "done" other than a spreadsheet beside the table.
  contacted_at timestamptz
);

create index if not exists demorequest_created_idx
  on public."DemoRequest" (created_at desc);

alter table public."DemoRequest" enable row level security;

-- -- INSERT only, and only INSERT --------------------------------------------
--
-- A marketing form is submitted by people who are not logged in, so anon has to
-- be able to write. It must not be able to read: without this being INSERT-only
-- anyone holding the anon key -- which ships in the bundle, by design -- could
-- pull down every lead, their phone numbers included.
--
-- There is no SELECT policy for anybody. These are read through the Supabase
-- dashboard or the Management API, both of which use the service role and
-- bypass RLS. That is the correct amount of machinery for a list somebody looks
-- at once a day.
drop policy if exists "DemoRequest submit" on public."DemoRequest";
create policy "DemoRequest submit" on public."DemoRequest"
  for insert to anon, authenticated
  with check (true);

revoke select, update, delete, truncate on public."DemoRequest" from anon, authenticated;
grant insert on public."DemoRequest" to anon, authenticated;

comment on table public."DemoRequest" is
  'Demo enquiries from /BookDemo. Anonymous visitors may INSERT and nothing
   else; there is no SELECT policy, so leads are readable only through the
   service role. Being anon-writable it is spammable in principle -- the column
   checks bound the damage, and if it is ever abused in practice the fix is to
   move the insert behind an edge function with the existing rate limiter
   (_shared/rate-limit.ts) rather than to tighten this policy.';

notify pgrst, 'reload schema';
