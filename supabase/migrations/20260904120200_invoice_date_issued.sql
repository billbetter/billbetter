-- When the contractor considers an invoice issued, as opposed to when the row
-- happened to be written.
--
-- -- Why created_at is not this --------------------------------------------
--
-- created_at is a row-creation artifact. An invoice drafted on Tuesday and
-- sent on Friday was issued on Friday, and created_at says Tuesday; an invoice
-- edited and re-saved carries whatever the original write said. That gap is
-- tolerable on a dashboard and is not tolerable in a demand letter, which
-- states the issue date as a fact and may end up in front of an adjudicator.
-- The date a document asserts about itself should be stored, not inferred.
--
-- -- Why date_issued and not invoice_date ----------------------------------
--
-- Quote already has `date_issued timestamp with time zone` for exactly this
-- concept. Naming the invoice column to match means one name for one idea
-- across the two documents this app produces, rather than a second convention
-- that every future reader has to learn. See public."Quote" in schema.sql.
--
-- -- No column default, on purpose -----------------------------------------
--
-- `default now()` would stamp the row at INSERT, which is precisely the
-- Tuesday-versus-Friday error this column exists to remove -- it would make
-- date_issued an alias for created_at with a different name. It is set in
-- application code at the moment an invoice is sent, by issuedPatch() in
-- src/lib/invoiceIssued.js, which is applied at all three places a status
-- becomes 'sent'.
--
-- A draft therefore has no issue date, which is correct: it has not been
-- issued. Reads should go through issueDateOf(), which falls back to
-- created_at, so a row written by an older bundle still yields a date.

alter table public."Invoice"
  add column if not exists date_issued timestamp with time zone;

-- Backfill: created_at is the best evidence available for invoices that
-- already went out, and a demand letter needs SOME issue date for them.
--
-- Drafts are deliberately excluded. They have not been issued, so giving them
-- a date now would be an assertion nobody made -- and worse, it would stick:
-- issuedPatch() only stamps rows on the way to 'sent', so a backfilled draft
-- sent next month would carry today's date forever. Left null, it gets a true
-- date the day it is actually sent.
--
-- Idempotent: `where date_issued is null` means re-running this file cannot
-- overwrite a real issue date with a creation date.
update public."Invoice"
   set date_issued = created_at
 where date_issued is null
   and coalesce(status, 'draft') <> 'draft';

notify pgrst, 'reload schema';
