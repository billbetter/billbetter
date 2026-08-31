-- Payment tracking and status history: two tables on the side of "Invoice".
--
-- -- What is broken right now ----------------------------------------------
--
-- Nothing in the app has ever written `paid_date`. Only stripe-webhook does.
-- The only way a contractor can mark an offline payment -- cash, a cheque, an
-- e-transfer, which is most of what a trade actually receives -- is the status
-- dropdown on the Invoices list, and handleStatusChange writes exactly
-- `{ status: 'paid' }`. No date, no amount, no method, no record of who did
-- it.
--
-- The consequences are not cosmetic. `paid_date` stays null, so InvoiceDetail
-- never shows when it was paid, and SmartInsights falls back to `created_date`
-- and counts the money in the month the invoice was RAISED. A deposit taken
-- against a larger invoice cannot be recorded at all: the invoice is either
-- fully paid or not paid, and a contractor holding $200 of a $500 job has
-- nowhere to put it.
--
-- -- Why two tables and not one ---------------------------------------------
--
-- A single "InvoiceEvent" table with a kind discriminator was the first
-- design, and it is the one this repo's own void migration anticipated ("if
-- invoices later need a full event log ... that IS a side table"). It was
-- rejected for money: a payments row wants NOT NULL on amount and a positive
-- check, and both have to become nullable the moment status changes share the
-- table. Summing money out of a table where most rows are not money is how a
-- balance ends up wrong.
--
-- So "InvoicePayment" holds money and can be constrained like money.
-- "InvoiceEvent" holds what happened and has no amount at all.
--
-- -- Why the history table is small, and stays small ------------------------
--
-- Most of an invoice's history is ALREADY on the invoice: created_at,
-- first_viewed_at, last_viewed_at, view_count, last_reminder_sent_at,
-- reminder_count, public_link_revoked_at, voided_at/voided_by/void_reason, and
-- now its payments. src/lib/invoicePayments.js builds the timeline by MERGING
-- those with this table.
--
-- That matters for a reason a stored-only design misses: an events table
-- records nothing that happened before it existed, so every invoice already in
-- the account would show an empty history. Deriving what the columns already
-- know means the timeline is populated on day one, and this table only has to
-- carry what has no column of its own -- status changes, chiefly.
--
-- -- Deliberately additive --------------------------------------------------
--
-- Two new tables. Nothing existing is altered, dropped or made stricter. No
-- new status value: an invoice with a part payment keeps the status it has and
-- shows a balance, so every consumer of `status` -- the filters, the batch
-- send, the reminder ladder, the overdue sweep -- is untouched and a partly
-- paid invoice is still chased for the rest, which is correct.

-- ---------------------------------------------------------------------------
-- Payments
-- ---------------------------------------------------------------------------

create table if not exists public."InvoicePayment" (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  invoice_id uuid not null references public."Invoice"(id) on delete cascade,

  -- Money, constrained as money. NOT NULL and non-zero: a payment row that
  -- records no amount is not a payment, and it would sit in the balance
  -- arithmetic contributing nothing while looking like something.
  --
  -- Negative IS allowed, and deliberately: a refund or a bounced cheque is a
  -- payment of a negative amount, which keeps the running balance correct
  -- without a second table or a `direction` column. Zero is not allowed
  -- because it is never a real event.
  amount numeric not null check (amount <> 0),

  -- The date the money actually moved, which is NOT the date somebody got
  -- round to entering it. A date, not a timestamp: nobody knows or cares what
  -- time a cheque cleared, and a timestamp invites the same
  -- midnight-UTC-renders-a-day-early bug the PDF mapper already had to fix.
  paid_at date not null default current_date,

  -- Free text rather than an enum. The set of ways a contractor gets paid is
  -- longer than any list we would write (cash, cheque, e-transfer, card, bank
  -- transfer, "took it off the Reilly job"), and a CHECK constraint here means
  -- a migration every time somebody is paid a new way. The UI offers the
  -- common ones and allows anything.
  method text,

  -- A cheque number, an e-transfer reference, the last four of a card. What
  -- the contractor writes down so they can find it in their bank statement.
  reference text,
  notes text,

  -- Set by stripe-webhook for an online payment, null for one entered by hand.
  -- The unique index below is what makes the webhook safe to retry.
  stripe_payment_intent_id text,

  -- Who recorded it. The name is stored alongside the id for the same reason
  -- "Quote".approved_by_name is: a crew member who is later removed still has
  -- to be nameable on a payment they entered last year.
  recorded_by uuid references auth.users(id),
  recorded_by_name text,

  created_at timestamp with time zone default now()
);

-- Every read is "the payments on this invoice".
create index if not exists invoicepayment_invoice_id_idx on public."InvoicePayment" (invoice_id);
create index if not exists invoicepayment_user_id_idx on public."InvoicePayment" (user_id);
-- Revenue by the month the money arrived, which is what the charts are now
-- dated by.
create index if not exists invoicepayment_paid_at_idx on public."InvoicePayment" (user_id, paid_at);

-- THE line that makes the webhook safe.
--
-- Stripe retries a delivery until it is acknowledged, and this app already
-- handles BOTH checkout.session.completed and payment_intent.succeeded for the
-- same payment -- so one payment can arrive here three or four times. Without
-- this, a $500 card payment becomes $2,000 of recorded payments and the
-- invoice shows a credit balance.
--
-- Partial rather than plain: hand-entered payments have no intent id, and
-- every one of them would collide on null under a plain unique index.
create unique index if not exists invoicepayment_stripe_intent_key
  on public."InvoicePayment" (stripe_payment_intent_id)
  where stripe_payment_intent_id is not null;

alter table public."InvoicePayment" enable row level security;

-- Byte-for-byte the policy on "Invoice"'s neighbours. accessible_owner_ids is
-- what lets a crew member reach their employer's rows; has_app_access is the
-- paywall. A new table with a hand-rolled policy is how those two drift.
drop policy if exists "InvoicePayment access" on public."InvoicePayment";
create policy "InvoicePayment access" on public."InvoicePayment"
  for all
  using (
    user_id in (select accessible_owner_ids(auth.uid()))
    and has_app_access(auth.uid())
  )
  with check (
    user_id in (select accessible_owner_ids(auth.uid()))
    and has_app_access(auth.uid())
  );

-- ---------------------------------------------------------------------------
-- Status history
-- ---------------------------------------------------------------------------

create table if not exists public."InvoiceEvent" (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  invoice_id uuid not null references public."Invoice"(id) on delete cascade,

  at timestamp with time zone not null default now(),

  -- 'status_changed', 'payment_recorded', 'payment_removed'. Free text for the
  -- same reason `method` is: the list will grow, and a CHECK constraint turns
  -- every new kind of event into a migration. Unknown kinds render as their
  -- own detail line rather than breaking the timeline.
  kind text not null,

  from_status text,
  to_status text,

  -- One human sentence, written at the time. Stored rather than composed at
  -- read time so a change to the wording never rewrites history.
  detail text,

  actor_id uuid references auth.users(id),
  actor_name text,

  created_at timestamp with time zone default now()
);

create index if not exists invoiceevent_invoice_id_idx on public."InvoiceEvent" (invoice_id, at desc);
create index if not exists invoiceevent_user_id_idx on public."InvoiceEvent" (user_id);

alter table public."InvoiceEvent" enable row level security;

drop policy if exists "InvoiceEvent access" on public."InvoiceEvent";
create policy "InvoiceEvent access" on public."InvoiceEvent"
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
