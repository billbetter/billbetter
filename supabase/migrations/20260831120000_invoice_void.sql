-- Voiding an invoice: four columns on "Invoice" that hold the audit trail.
--
-- -- Why columns and not a separate audit table -----------------------------
--
-- An InvoiceAudit table would be the textbook answer and is the wrong shape
-- for what this feature actually needs. Voiding happens at most once per
-- invoice, it is terminal, and every screen that shows a voided invoice wants
-- the who/when/why on the same row it is already reading. A side table means a
-- join on the invoice list, the detail page and the public function, to fetch
-- at most one row that exists for a small minority of invoices.
--
-- If invoices later need a full event log -- edited, sent, viewed, disputed --
-- that IS a side table, and these columns become its first four entries. This
-- migration is not in the way of that; it is one event modelled as what it is.
--
-- -- Why the status is 'void' and not the existing 'cancelled' -------------
--
-- "cancelled" is already a status, and Invoices.jsx builds its per-row status
-- dropdown by iterating the keys of `statusConfig` -- so every status in that
-- map can be set, and unset, with one click and no confirmation. Reusing it
-- would mean a void with no reason, no actor and no timestamp, reversible by
-- misclick. `void` is deliberately absent from that dropdown; the only way to
-- reach it is the Void dialog, and there is no way back out.
--
-- No CHECK constraint is added on status. The column has never had one, the
-- app writes at least five values to it, and adding one in this migration
-- would fail on any existing row holding something unexpected -- turning an
-- additive change into an outage. The vocabulary is enforced in the UI, which
-- is where it already was.
--
-- -- Shape ------------------------------------------------------------------
--
-- Every column is nullable with no default, so every existing invoice is
-- untouched and reads as not-voided. Additive only: nothing is dropped,
-- renamed, or made stricter.
--
-- RLS is deliberately not mentioned. These are columns on "Invoice", and a
-- policy on a table covers every column of it -- including ones added later.
-- Writing a new policy here is how the existing one drifts.

alter table public."Invoice"
  -- The stamp. Also the tell-tale: isVoided() treats a row with voided_at set
  -- as voided even if the status was edited by hand in the dashboard, so the
  -- restrictive answer wins for a check that gates payment.
  add column if not exists voided_at timestamp with time zone,

  -- Free text, capped at 500 characters by the UI. "Wrong client", "duplicate
  -- of INV-482913", "job cancelled". Optional -- demanding a reason produces
  -- "asdf" rather than an explanation.
  add column if not exists void_reason text,

  -- Who did it. references auth.users rather than a bare uuid so the id cannot
  -- point at nothing; ON DELETE is deliberately omitted, so the default NO
  -- ACTION blocks deleting a user who has voided an invoice rather than
  -- silently blanking the audit trail.
  add column if not exists voided_by uuid references auth.users(id),

  -- Their name AT THE TIME, stored rather than joined. A crew member who is
  -- later removed still has to be nameable on an invoice they voided last
  -- year. Same reasoning as "Quote".approved_by_name and "JobNote".user_name.
  add column if not exists voided_by_name text;

-- Partial: the index covers only voided invoices, which are the minority and
-- the only rows any query filters on here. A full index would be mostly nulls.
create index if not exists invoice_voided_at_idx
  on public."Invoice" (voided_at)
  where voided_at is not null;

notify pgrst, 'reload schema';
