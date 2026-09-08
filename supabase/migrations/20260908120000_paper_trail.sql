-- The paper trail: what Invoicium witnessed, which the contractor cannot edit.
--
-- -- What this is for -------------------------------------------------------
--
-- A client refuses to pay and says "I never got that invoice", or "you only
-- sent it last week", or "I never agreed to that quote". The contractor's
-- answer today is a screenshot of their own account, which proves nothing: the
-- Invoice row is theirs to edit. date_issued is a form field. status is a
-- dropdown. Even "InvoiceEvent", the history table added with payments, carries
-- `for all` RLS -- the contractor can insert, rewrite and delete its rows.
-- Every date on that screen is a date the person showing it could have typed.
--
-- This table is the opposite. Rows are written only by triggers, timestamped
-- only by the database clock, and cannot be updated or deleted by anyone --
-- not the contractor, not the anon key, not an edge function holding the
-- service role, not a future migration that forgets. That is the entire value:
-- a record is worth exactly as much as the difficulty of changing it.
--
-- -- Why not just harden "InvoiceEvent" -------------------------------------
--
-- Because its existing rows were client-written under a policy that allowed
-- anything, and no amount of tightening makes those rows trustworthy after the
-- fact. A ledger that says "everything in here is sealed, except the older
-- half, which is not" is a ledger nobody can rely on. Starting a separate table
-- means every row it will ever hold was written under these rules.
--
-- "InvoiceEvent" is untouched and keeps feeding the timeline on InvoiceDetail.
-- The two answer different questions: that one is "what happened, roughly",
-- this one is "what can I prove".
--
-- -- Recorded for everyone, readable on Essential ---------------------------
--
-- The triggers fire on every account regardless of plan. Gating the RECORDING
-- would mean a contractor who upgrades mid-dispute gets an empty file for
-- exactly the invoice they are fighting about -- the feature would arrive too
-- late to ever be useful, which is a good way to build something nobody
-- renews for. The plan gate is on reading and exporting, in
-- components/utils/permissions.jsx.
--
-- -- Nothing in the send path is touched ------------------------------------
--
-- Recording "sent" from inside send-invoice-email would have been the obvious
-- place and is the wrong one. It changes wired-up email code to gain nothing:
-- the app already writes status='sent' after a successful send, so a trigger on
-- the table sees the same fact from a position the client cannot bypass, with a
-- timestamp the client cannot supply. Every path -- the app, the edge
-- functions, the Stripe webhook, a hand-written PATCH -- is covered by the same
-- eleven lines, and the email and payment code is left exactly as it is.

-- ---------------------------------------------------------------------------
-- The ledger
-- ---------------------------------------------------------------------------

create table if not exists public."AuditEvent" (
  id uuid primary key default gen_random_uuid(),

  -- The account the record belongs to. FK kept, like every other table here,
  -- so a row can never be orphaned from its owner.
  user_id uuid not null references auth.users(id),

  -- -- No foreign key to the document. Deliberate. -------------------------
  --
  -- `references "Invoice"(id) on delete cascade` would mean deleting an
  -- invoice deletes its proof, which hands the contractor a one-click way to
  -- destroy exactly the record this table exists to protect. `on delete set
  -- null` needs an UPDATE of the ledger row, which the immutability trigger
  -- below refuses, so it would block invoice deletion outright. `no action`
  -- does the same.
  --
  -- So the ledger is deliberately independent of the document. It carries its
  -- own copy of the number and the client name, taken at the time, and
  -- outlives anything that happens to the row it describes. Referential
  -- integrity is the wrong goal for an archive: the point is precisely that it
  -- does not follow the thing it is a record of.
  document_type   text not null check (document_type in ('invoice', 'quote')),
  document_id     uuid not null,
  document_number text,
  client_name     text,

  kind   text not null,
  detail text,
  amount numeric,

  -- -- Two timestamps, because they answer different questions -------------
  --
  --   occurred_at  when the thing happened. For a live event this is the
  --                instant the trigger fired. For a cash payment the
  --                contractor dates last Tuesday, it is last Tuesday -- their
  --                claim, not our observation.
  --   recorded_at  when Invoicium sealed the row. Always now(), always the
  --                database clock, never anything a caller supplied.
  --
  -- Collapsing these into one field is how a paper trail quietly becomes
  -- worthless: a contractor backdating a payment would look identical to one
  -- recording it as it happened. Keeping both means the record can show a
  -- payment dated the 3rd that was entered on the 20th, and let the reader
  -- draw their own conclusion.
  occurred_at timestamptz not null,
  recorded_at timestamptz not null default now(),

  -- -- Who is making the claim ---------------------------------------------
  --
  --   system    Invoicium observed it directly and no human could have staged
  --             it: the client opened the link, Stripe settled a card. This is
  --             the evidence that actually carries weight in a dispute.
  --   user      the contractor did it in the app. True, timestamped, sealed --
  --             but it is their action, not independent corroboration.
  --   imported  reconstructed from the document's own columns when this table
  --             was created. Sealed from that moment on, but the date shown is
  --             whatever the row said on import day.
  --
  -- Showing all three under one heading and calling it proof would be the
  -- dishonest version of this feature. The reader is told which is which.
  source   text not null check (source in ('system', 'user', 'imported')),
  actor_id uuid,

  -- -- The chain ------------------------------------------------------------
  --
  -- Each row hashes its own contents together with the hash of the previous
  -- row for the same account. Change any field of any row, or remove a row
  -- from the middle, and every hash after it stops matching.
  --
  -- This is what turns "we promise we did not alter it" into something a
  -- sceptical reader can check for themselves, which is the only version of
  -- that promise worth making. audit_verify() below does the checking.
  seq       bigint not null,
  prev_hash text,
  hash      text not null
);

create index if not exists auditevent_document_idx
  on public."AuditEvent" (document_id, occurred_at);
create index if not exists auditevent_user_idx
  on public."AuditEvent" (user_id, seq desc);
-- The chain is only a chain if positions are unique. Without this a race that
-- slipped past the advisory lock would fork it silently.
create unique index if not exists auditevent_user_seq_key
  on public."AuditEvent" (user_id, seq);

alter table public."AuditEvent" enable row level security;

-- SELECT and nothing else. There is deliberately no insert, update or delete
-- policy, so `authenticated` and `anon` can do none of the three: RLS denies
-- what no policy permits.
--
-- No has_app_access clause, matching "PublicLinkHit" and for a sharper reason.
-- A contractor whose subscription lapses in the middle of a payment dispute
-- must still be able to read the record of it. Evidence that disappears when
-- you stop paying is not evidence.
drop policy if exists "AuditEvent read" on public."AuditEvent";
create policy "AuditEvent read" on public."AuditEvent"
  for select to authenticated
  using (user_id in (select public.accessible_owner_ids(auth.uid())));

-- Belt and braces against RLS being disabled or a policy being widened later.
revoke insert, update, delete, truncate on public."AuditEvent" from anon, authenticated;
grant select on public."AuditEvent" to authenticated;

-- ---------------------------------------------------------------------------
-- Append-only, enforced below the application
-- ---------------------------------------------------------------------------

-- Row-level triggers fire for EVERY role, service_role and postgres included.
-- That is the point: the guarantee is not "the app does not do this", it is
-- "the database refuses". An edge function holding the service role cannot
-- quietly fix up a row, and neither can a future migration that means well.
--
-- Honest about the limit: a superuser can ALTER TABLE ... DISABLE TRIGGER. What
-- this defends against is the realistic threat -- the account owner, the app,
-- and our own server code -- not someone holding the database password.
create or replace function public.auditevent_reject_change()
returns trigger
language plpgsql
as $$
begin
  raise exception
    'AuditEvent is append-only: % is not permitted on the paper trail', tg_op
    using errcode = '42501';
end;
$$;

drop trigger if exists auditevent_no_update on public."AuditEvent";
create trigger auditevent_no_update
  before update on public."AuditEvent"
  for each row execute function public.auditevent_reject_change();

drop trigger if exists auditevent_no_delete on public."AuditEvent";
create trigger auditevent_no_delete
  before delete on public."AuditEvent"
  for each row execute function public.auditevent_reject_change();

-- ---------------------------------------------------------------------------
-- Hashing
-- ---------------------------------------------------------------------------

-- The exact bytes a row's hash covers.
--
-- Shared by the writer and the verifier on purpose. Two copies of this
-- expression would drift, and the failure mode is the worst possible one: a
-- verifier reporting tampering on an untouched chain, which destroys trust in
-- the record precisely when someone is relying on it.
--
-- Timestamps are rendered in UTC to fixed precision so the digest does not
-- depend on the session's TimeZone setting.
create or replace function public.audit_row_payload(
  p_seq bigint, p_user_id uuid, p_document_type text, p_document_id uuid,
  p_document_number text, p_client_name text, p_kind text, p_detail text,
  p_amount numeric, p_occurred_at timestamptz, p_recorded_at timestamptz,
  p_source text, p_actor_id uuid, p_prev_hash text)
returns text
language sql
-- STABLE and not IMMUTABLE, though every input maps to exactly one output.
-- `timestamptz AT TIME ZONE 'UTC'` reads the timezone database, which makes it
-- stable by Postgres's definition however unchanging UTC is in practice.
-- Claiming IMMUTABLE would be a promise this body does not keep, and the
-- planner is entitled to act on it.
stable
as $$
  select concat_ws('|',
    p_seq::text,
    p_user_id::text,
    p_document_type,
    p_document_id::text,
    coalesce(p_document_number, ''),
    coalesce(p_client_name, ''),
    p_kind,
    coalesce(p_detail, ''),
    coalesce(p_amount::text, ''),
    to_char(p_occurred_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US'),
    to_char(p_recorded_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US'),
    p_source,
    coalesce(p_actor_id::text, ''),
    coalesce(p_prev_hash, ''));
$$;

-- The ONLY way a row enters the ledger.
--
-- SECURITY DEFINER so the triggers can write through the RLS that denies
-- everyone else, and EXECUTE revoked from anon and authenticated so a browser
-- holding the anon key cannot call it directly and forge an entry. Supabase
-- grants EXECUTE on public functions by default, so that revoke is
-- load-bearing, not decoration.
create or replace function public.audit_append(
  p_user_id uuid, p_document_type text, p_document_id uuid,
  p_document_number text, p_client_name text, p_kind text, p_detail text,
  p_amount numeric, p_occurred_at timestamptz, p_source text, p_actor_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_seq  bigint;
  v_prev text;
  v_now  timestamptz := now();
  v_hash text;
begin
  if p_user_id is null or p_document_id is null or p_kind is null then
    return;
  end if;

  -- Serialise appends per account. Without it two concurrent writes read the
  -- same tail, take the same seq and the same prev_hash, and one of them loses
  -- to the unique index -- turning a saved invoice into a failed one.
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));

  select e.seq, e.hash into v_seq, v_prev
    from public."AuditEvent" e
   where e.user_id = p_user_id
   order by e.seq desc
   limit 1;

  v_seq := coalesce(v_seq, 0) + 1;

  v_hash := encode(sha256(convert_to(public.audit_row_payload(
    v_seq, p_user_id, p_document_type, p_document_id, p_document_number,
    p_client_name, p_kind, p_detail, p_amount, coalesce(p_occurred_at, v_now),
    v_now, p_source, p_actor_id, v_prev), 'UTF8')), 'hex');

  insert into public."AuditEvent" (
    user_id, document_type, document_id, document_number, client_name,
    kind, detail, amount, occurred_at, recorded_at, source, actor_id,
    seq, prev_hash, hash)
  values (
    p_user_id, p_document_type, p_document_id, p_document_number, p_client_name,
    p_kind, p_detail, p_amount, coalesce(p_occurred_at, v_now),
    v_now, p_source, p_actor_id, v_seq, v_prev, v_hash);
end;
$$;

revoke all on function public.audit_append(
  uuid, text, uuid, text, text, text, text, numeric, timestamptz, text, uuid)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- What gets recorded
-- ---------------------------------------------------------------------------

-- -- Why a trigger and not a call from the app ------------------------------
--
-- Because a record the client is trusted to write is not a record. If the app
-- calls "log that I sent this", then a forged HTTP request can log the same
-- thing with any date it likes, and the whole exercise collapses. A trigger
-- sees the write itself, from a position no caller can route around, and takes
-- the time from the database rather than from anyone's clock.
--
-- It also means coverage is free: the Stripe webhook, the public-link edge
-- function, the reminder sweep, the app and any future code all pass through
-- the same UPDATE, so none of them has to remember to log anything.

-- -- Why the body swallows its own errors -----------------------------------
--
-- An AFTER trigger that raises aborts the user's transaction. A bug here would
-- therefore stop a contractor saving an invoice, taking a payment or sending a
-- reminder -- the business breaks so the diary can stay perfect. That is the
-- wrong way round. A failure is warned about and skipped, so the ledger can
-- have a gap but the day's work never stops.

create or replace function public.invoice_audit()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
-- OLD and NEW are assigned per operation, and every reference below is guarded
-- by TG_OP for that reason. Note in particular that none of them appears in the
-- DECLARE block: PL/pgSQL raises "record old is not assigned yet" on an INSERT,
-- and an error during variable initialisation is NOT caught by this block's own
-- EXCEPTION clause -- so that one mistake would abort the transaction and stop
-- every invoice in the app from saving.
declare
  v_actor  uuid;
  v_num    text;
  v_client text;
  v_old    text;
  v_new    text;
  v_how    text;
begin
  v_actor  := auth.uid();
  v_num    := coalesce(new.invoice_number, '');
  v_client := coalesce(new.client_name, '');
  v_new    := lower(coalesce(new.status, ''));

  -- The channel is known from the row, but the ACT is not: status becomes
  -- 'sent' when the app finishes a successful send, and also when the
  -- contractor picks "sent" from the dropdown by hand. Wording it "marked as
  -- sent" covers both without claiming more than we saw. The line that proves
  -- delivery is the client opening the link, below, and that one we do witness.
  v_how := case lower(coalesce(new.delivery_method, ''))
             when 'email' then
               'Marked as sent' ||
               coalesce(' -- email to ' || nullif(new.client_email, ''), '')
             when 'sms' then
               'Marked as sent' ||
               coalesce(' -- SMS to ' || nullif(new.client_phone, ''), '')
             else 'Marked as sent'
           end;

  if tg_op = 'INSERT' then
    perform public.audit_append(
      new.user_id, 'invoice', new.id, v_num, v_client, 'created',
      'Invoice ' || v_num || ' raised for ' || v_client, new.total,
      now(), 'user', v_actor);

    -- Created straight into 'sent' -- CreateInvoice's send path inserts the row
    -- already sent rather than saving a draft first, so without this the most
    -- common send in the app would leave no record of having been sent.
    if v_new = 'sent' then
      perform public.audit_append(
        new.user_id, 'invoice', new.id, v_num, v_client, 'sent', v_how,
        new.total, now(), 'user', v_actor);
    end if;
    return null;
  end if;

  v_old := lower(coalesce(old.status, ''));

  if v_old is distinct from v_new then
    if v_new = 'sent' then
      perform public.audit_append(new.user_id, 'invoice', new.id, v_num, v_client,
        'sent', v_how, new.total, now(), 'user', v_actor);
    elsif v_new = 'paid' then
      perform public.audit_append(new.user_id, 'invoice', new.id, v_num, v_client,
        'paid', 'Marked as paid in full', new.total, now(), 'user', v_actor);
    else
      perform public.audit_append(new.user_id, 'invoice', new.id, v_num, v_client,
        'status_changed',
        'Status changed from ' || coalesce(nullif(v_old, ''), 'none') ||
        ' to ' || coalesce(nullif(v_new, ''), 'none'),
        null, now(), 'user', v_actor);
    end if;
  end if;

  -- The strongest line in the whole record, and the only one the contractor
  -- has no hand in: an actual HTTP request from the client's browser, counted
  -- by get-public-invoice.
  --
  -- Keyed on view_count rather than last_viewed_at because that column moves on
  -- every reload while the counter is 30-minute debounced -- one ledger row per
  -- genuine visit instead of one per refresh.
  if coalesce(new.view_count, 0) > coalesce(old.view_count, 0) then
    perform public.audit_append(
      new.user_id, 'invoice', new.id, v_num, v_client, 'viewed',
      case when old.first_viewed_at is null
           then 'Client opened the invoice link for the first time'
           else 'Client opened the invoice link again (visit ' ||
                new.view_count || ')' end,
      null, coalesce(new.last_viewed_at, now()), 'system', null);
  end if;

  if coalesce(new.reminder_count, 0) > coalesce(old.reminder_count, 0) then
    perform public.audit_append(
      new.user_id, 'invoice', new.id, v_num, v_client, 'reminded',
      'Payment reminder sent (reminder ' || new.reminder_count || ')',
      null, coalesce(new.last_reminder_sent_at, now()), 'user', v_actor);
  end if;

  if old.demand_letter_sent_at is null and new.demand_letter_sent_at is not null then
    perform public.audit_append(
      new.user_id, 'invoice', new.id, v_num, v_client, 'demand_letter',
      'Formal demand letter issued', null, new.demand_letter_sent_at, 'user', v_actor);
  end if;

  if old.voided_at is null and new.voided_at is not null then
    perform public.audit_append(
      new.user_id, 'invoice', new.id, v_num, v_client, 'voided',
      coalesce(nullif(new.void_reason, ''), 'Invoice voided'),
      null, new.voided_at, 'user', v_actor);
  elsif old.public_link_revoked_at is null and new.public_link_revoked_at is not null then
    -- Only when it was not a void: voiding revokes the link as a side effect,
    -- and two lines make one action look like two.
    perform public.audit_append(
      new.user_id, 'invoice', new.id, v_num, v_client, 'link_revoked',
      'Client link switched off', null, new.public_link_revoked_at, 'user', v_actor);
  end if;

  return null;
exception
  when others then
    raise warning 'invoice_audit skipped for % : %', new.id, sqlerrm;
    return null;
end;
$$;

drop trigger if exists invoice_audit_trg on public."Invoice";
create trigger invoice_audit_trg
  after insert or update on public."Invoice"
  for each row execute function public.invoice_audit();

create or replace function public.quote_audit()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
-- OLD stays out of the DECLARE block for the reason spelled out on
-- invoice_audit above: on an INSERT it is unassigned, and the failure would not
-- be catchable here.
declare
  v_actor  uuid;
  v_num    text;
  v_client text;
  v_old    text;
  v_new    text;
begin
  v_actor  := auth.uid();
  v_num    := coalesce(new.quote_number, '');
  v_client := coalesce(new.client_name, '');
  v_new    := lower(coalesce(new.status, ''));

  if tg_op = 'INSERT' then
    perform public.audit_append(
      new.user_id, 'quote', new.id, v_num, v_client, 'created',
      'Quote ' || v_num || ' raised for ' || v_client, new.total,
      now(), 'user', v_actor);
    if v_new = 'sent' then
      perform public.audit_append(new.user_id, 'quote', new.id, v_num, v_client,
        'sent', 'Marked as sent', new.total, now(), 'user', v_actor);
    end if;
    return null;
  end if;

  v_old := lower(coalesce(old.status, ''));

  if v_old is distinct from v_new and v_new = 'sent' then
    perform public.audit_append(new.user_id, 'quote', new.id, v_num, v_client,
      'sent', 'Marked as sent', new.total, now(), 'user', v_actor);
  end if;

  if coalesce(new.view_count, 0) > coalesce(old.view_count, 0) then
    perform public.audit_append(
      new.user_id, 'quote', new.id, v_num, v_client, 'viewed',
      case when old.first_viewed_at is null
           then 'Client opened the quote link for the first time'
           else 'Client opened the quote link again (visit ' ||
                new.view_count || ')' end,
      null, coalesce(new.last_viewed_at, now()), 'system', null);
  end if;

  -- The line that answers "I never agreed to that". Written by approve-quote
  -- from the client's own click, with the name they typed.
  if old.approved_at is null and new.approved_at is not null then
    perform public.audit_append(
      new.user_id, 'quote', new.id, v_num, v_client, 'approved',
      'Quote approved by ' || coalesce(nullif(new.approved_by_name, ''), 'the client'),
      new.total, new.approved_at, 'system', null);
  end if;

  if old.declined_at is null and new.declined_at is not null then
    perform public.audit_append(
      new.user_id, 'quote', new.id, v_num, v_client, 'declined',
      'Quote declined by ' || coalesce(nullif(new.declined_by_name, ''), 'the client') ||
      coalesce(' -- ' || nullif(new.decline_reason, ''), ''),
      null, new.declined_at, 'system', null);
  end if;

  if old.public_link_revoked_at is null and new.public_link_revoked_at is not null then
    perform public.audit_append(
      new.user_id, 'quote', new.id, v_num, v_client, 'link_revoked',
      'Client link switched off', null, new.public_link_revoked_at, 'user', v_actor);
  end if;

  return null;
exception
  when others then
    raise warning 'quote_audit skipped for % : %', new.id, sqlerrm;
    return null;
end;
$$;

drop trigger if exists quote_audit_trg on public."Quote";
create trigger quote_audit_trg
  after insert or update on public."Quote"
  for each row execute function public.quote_audit();

-- Money in, and money taken back out.
--
-- The DELETE half matters more than it looks. Removing a payment is how a
-- record of part-payment would be made to disappear -- "they never paid me
-- anything" -- so the removal is itself sealed. The payment row goes; the fact
-- that it existed and was removed does not.
create or replace function public.payment_audit()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
-- The two operations are written out separately rather than through one `v_row
-- record := case tg_op when 'DELETE' then old else new end`. That reads better
-- and does not work: PL/pgSQL has to expand both record variables to evaluate
-- the expression, and exactly one of them is unassigned on any given call.
declare
  v_actor  uuid;
  v_num    text;
  v_client text;
  v_when   timestamptz;
begin
  v_actor := auth.uid();

  if tg_op = 'DELETE' then
    select i.invoice_number, i.client_name into v_num, v_client
      from public."Invoice" i where i.id = old.invoice_id;

    perform public.audit_append(
      old.user_id, 'invoice', old.invoice_id, v_num, v_client,
      'payment_removed',
      'A recorded payment of ' || to_char(old.amount, 'FM999999990.00') ||
      ' dated ' || to_char(old.paid_at, 'DD Mon YYYY') || ' was deleted',
      old.amount, now(), 'user', v_actor);
    return null;
  end if;

  select i.invoice_number, i.client_name into v_num, v_client
    from public."Invoice" i where i.id = new.invoice_id;

  -- paid_at is a DATE. Noon rather than midnight so a payment dated the 4th
  -- sorts after anything timestamped early on the 4th, matching the convention
  -- in src/lib/invoicePayments.js.
  v_when := (new.paid_at::timestamp + interval '12 hours') at time zone 'UTC';

  perform public.audit_append(
    new.user_id, 'invoice', new.invoice_id, v_num, v_client, 'payment',
    'Payment of ' || to_char(new.amount, 'FM999999990.00') ||
    coalesce(' by ' || nullif(new.method, ''), '') ||
    coalesce(' (ref ' || nullif(new.reference, '') || ')', ''),
    new.amount, v_when,
    -- A card payment arrives from Stripe with an intent id and no human
    -- involved; a cash payment is the contractor's own word for it.
    case when new.stripe_payment_intent_id is not null then 'system' else 'user' end,
    v_actor);
  return null;
exception
  when others then
    raise warning 'payment_audit skipped: %', sqlerrm;
    return null;
end;
$$;

drop trigger if exists payment_audit_trg on public."InvoicePayment";
create trigger payment_audit_trg
  after insert or delete on public."InvoicePayment"
  for each row execute function public.payment_audit();

-- ---------------------------------------------------------------------------
-- Reading it back
-- ---------------------------------------------------------------------------

-- One row per document, for the list screen.
--
-- An RPC rather than "fetch every entry and group in JavaScript", because that
-- shape is fine at nine invoices and is a few tens of thousands of rows over
-- the phone for an account that has been running two years on Professional.
--
-- SECURITY INVOKER (the default) on purpose: RLS on "AuditEvent" is what scopes
-- this, so the function cannot return more than the caller could already read.
create or replace function public.paper_trail_summary()
returns table (
  document_type   text,
  document_id     uuid,
  document_number text,
  client_name     text,
  entries         bigint,
  first_at        timestamptz,
  last_at         timestamptz,
  sent_at         timestamptz,
  first_viewed_at timestamptz,
  views           bigint,
  amount          numeric,
  settled_at      timestamptz,
  witnessed       bigint
)
language sql
stable
as $$
  select
    e.document_type,
    e.document_id,
    -- The latest name we saw, so a renumbered or renamed document reads as it
    -- does today while every entry keeps the name it was sealed with.
    (array_agg(e.document_number order by e.seq desc))[1],
    (array_agg(e.client_name order by e.seq desc))[1],
    count(*),
    min(e.occurred_at),
    max(e.occurred_at),
    min(e.occurred_at) filter (where e.kind = 'sent'),
    min(e.occurred_at) filter (where e.kind = 'viewed'),
    count(*) filter (where e.kind = 'viewed'),
    max(e.amount) filter (where e.kind = 'created'),
    min(e.occurred_at) filter (where e.kind in ('paid', 'payment')),
    count(*) filter (where e.source = 'system')
  from public."AuditEvent" e
  where e.user_id in (select public.accessible_owner_ids(auth.uid()))
  group by e.document_type, e.document_id
$$;

grant execute on function public.paper_trail_summary() to authenticated;

-- Recompute every hash and confirm every link.
--
-- The point of exposing this rather than just asserting the chain is fine: the
-- claim "this was not altered" is only worth something if the person relying on
-- it can make the check themselves, and get a NO when it fails.
create or replace function public.audit_verify()
returns table (
  user_id          uuid,
  entries          bigint,
  intact           boolean,
  first_broken_seq bigint,
  sealed_from      timestamptz,
  sealed_to        timestamptz
)
language sql
stable
as $$
  with chain as (
    select e.*,
           lag(e.hash) over (partition by e.user_id order by e.seq) as expected_prev
      from public."AuditEvent" e
     where e.user_id in (select public.accessible_owner_ids(auth.uid()))
  ), checked as (
    select c.user_id, c.seq, c.recorded_at,
           (c.hash = encode(sha256(convert_to(public.audit_row_payload(
              c.seq, c.user_id, c.document_type, c.document_id, c.document_number,
              c.client_name, c.kind, c.detail, c.amount, c.occurred_at,
              c.recorded_at, c.source, c.actor_id, c.prev_hash), 'UTF8')), 'hex'))
           and c.prev_hash is not distinct from c.expected_prev as ok
      from chain c
  )
  -- Every reference here is qualified with the CTE name, including in the
  -- GROUP BY. RETURNS TABLE puts `user_id` in scope as an output parameter, so
  -- a bare `user_id` is genuinely ambiguous and Postgres refuses the function.
  select c.user_id, count(*), bool_and(c.ok),
         min(c.seq) filter (where not c.ok),
         min(c.recorded_at), max(c.recorded_at)
    from checked c
   group by c.user_id
$$;

grant execute on function public.audit_verify() to authenticated;

-- ---------------------------------------------------------------------------
-- Everything that happened before today
-- ---------------------------------------------------------------------------

-- -- Why this is imported and labelled as such ------------------------------
--
-- Without a backfill the feature is empty on the day it ships and stays empty
-- for every invoice already in the account -- including, with certainty, the
-- one somebody is already arguing about.
--
-- But these entries are reconstructed NOW from columns the contractor has been
-- able to edit all along, so presenting them as witnessed would be a lie
-- dressed as proof. They are stamped source='imported', which the UI renders as
-- "reconstructed from the invoice record on <date>", and the dates come from
-- the row rather than from anything we saw.
--
-- What the import does buy, and it is not nothing: from this moment those dates
-- are frozen. Editing the invoice afterwards no longer changes what the record
-- says, and the difference between the two becomes visible.
--
-- Guarded on emptiness so re-running the migration cannot duplicate the
-- history -- and it cannot be undone by hand afterwards, because the rows are
-- append-only by then.
do $$
declare
  r record;
begin
  if exists (select 1 from public."AuditEvent" where source = 'imported') then
    raise notice 'paper trail: already imported, skipping';
    return;
  end if;

  for r in
    -- Ordered by account then by when it happened, so each chain reads
    -- chronologically rather than in whatever order the tables scanned.
    select * from (
      select i.user_id, 'invoice'::text as dt, i.id, i.invoice_number as num,
             i.client_name as cli, 'created'::text as kind,
             'Invoice ' || coalesce(i.invoice_number, '') || ' raised for ' ||
               coalesce(i.client_name, '') as detail,
             i.total as amount, i.created_at as happened_at
        from public."Invoice" i where i.created_at is not null
      union all
      select i.user_id, 'invoice', i.id, i.invoice_number, i.client_name, 'sent',
             'Issued to the client', i.total, i.date_issued
        from public."Invoice" i
       where i.date_issued is not null
         and lower(coalesce(i.status, '')) <> 'draft'
      union all
      select i.user_id, 'invoice', i.id, i.invoice_number, i.client_name, 'viewed',
             'Client opened the invoice link', null, i.first_viewed_at
        from public."Invoice" i where i.first_viewed_at is not null
      union all
      select i.user_id, 'invoice', i.id, i.invoice_number, i.client_name, 'viewed',
             'Client opened the invoice link again (' ||
               coalesce(i.view_count, 1) || ' visits in total)', null, i.last_viewed_at
        from public."Invoice" i
       where i.last_viewed_at is not null and i.first_viewed_at is not null
         and i.last_viewed_at > i.first_viewed_at + interval '60 seconds'
      union all
      select i.user_id, 'invoice', i.id, i.invoice_number, i.client_name, 'reminded',
             case when coalesce(i.reminder_count, 0) > 1
                  then i.reminder_count || ' payment reminders sent; only the ' ||
                       'most recent date was kept'
                  else 'Payment reminder sent' end,
             null, i.last_reminder_sent_at
        from public."Invoice" i where i.last_reminder_sent_at is not null
      union all
      select i.user_id, 'invoice', i.id, i.invoice_number, i.client_name,
             'demand_letter', 'Formal demand letter issued', null,
             i.demand_letter_sent_at
        from public."Invoice" i where i.demand_letter_sent_at is not null
      union all
      select i.user_id, 'invoice', i.id, i.invoice_number, i.client_name, 'paid',
             'Recorded as paid', i.total, i.paid_date
        from public."Invoice" i where i.paid_date is not null
      union all
      select i.user_id, 'invoice', i.id, i.invoice_number, i.client_name, 'voided',
             coalesce(nullif(i.void_reason, ''), 'Invoice voided'), null, i.voided_at
        from public."Invoice" i where i.voided_at is not null
      union all
      select i.user_id, 'invoice', i.id, i.invoice_number, i.client_name,
             'link_revoked', 'Client link switched off', null,
             i.public_link_revoked_at
        from public."Invoice" i
       where i.public_link_revoked_at is not null and i.voided_at is null
      union all
      select p.user_id, 'invoice', p.invoice_id, i.invoice_number, i.client_name,
             'payment',
             'Payment of ' || to_char(p.amount, 'FM999999990.00') ||
               coalesce(' by ' || nullif(p.method, ''), ''), p.amount,
             (p.paid_at::timestamp + interval '12 hours') at time zone 'UTC'
        from public."InvoicePayment" p
        left join public."Invoice" i on i.id = p.invoice_id
      union all
      select q.user_id, 'quote', q.id, q.quote_number, q.client_name, 'created',
             'Quote ' || coalesce(q.quote_number, '') || ' raised for ' ||
               coalesce(q.client_name, ''), q.total, q.created_at
        from public."Quote" q where q.created_at is not null
      union all
      select q.user_id, 'quote', q.id, q.quote_number, q.client_name, 'sent',
             'Issued to the client', q.total, q.date_issued
        from public."Quote" q
       where q.date_issued is not null and lower(coalesce(q.status, '')) <> 'draft'
      union all
      select q.user_id, 'quote', q.id, q.quote_number, q.client_name, 'viewed',
             'Client opened the quote link', null, q.first_viewed_at
        from public."Quote" q where q.first_viewed_at is not null
      union all
      select q.user_id, 'quote', q.id, q.quote_number, q.client_name, 'approved',
             'Quote approved by ' || coalesce(nullif(q.approved_by_name, ''), 'the client'),
             q.total, q.approved_at
        from public."Quote" q where q.approved_at is not null
      union all
      select q.user_id, 'quote', q.id, q.quote_number, q.client_name, 'declined',
             'Quote declined by ' || coalesce(nullif(q.declined_by_name, ''), 'the client') ||
               coalesce(' -- ' || nullif(q.decline_reason, ''), ''), null, q.declined_at
        from public."Quote" q where q.declined_at is not null
    ) h
    where h.user_id is not null and h.happened_at is not null
    order by h.user_id, h.happened_at, h.id
  loop
    perform public.audit_append(
      r.user_id, r.dt, r.id, r.num, r.cli, r.kind, r.detail, r.amount,
      r.happened_at, 'imported', null::uuid);
  end loop;
end;
$$;

comment on table public."AuditEvent" is
  'The paper trail. Append-only: BEFORE UPDATE and BEFORE DELETE triggers refuse
   every role, and RLS grants SELECT only. Written solely by audit_append(),
   which is SECURITY DEFINER with EXECUTE revoked from anon and authenticated.
   Each row is hash-chained to the previous row for the same account; call
   audit_verify() to recompute the chain.';

notify pgrst, 'reload schema';
