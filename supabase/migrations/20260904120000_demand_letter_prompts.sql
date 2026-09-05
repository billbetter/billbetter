-- Remember where each invoice sits in the demand-letter conversation.
--
-- -- Why three columns and not one -----------------------------------------
--
-- The spec names one field, demand_letter_sent_at, to stop the app re-prompting
-- about the same invoice. That is enough to stop prompting AFTER a letter
-- exists, and nothing at all before one does: an invoice 21 days overdue that
-- the contractor has looked at and decided not to escalate has no letter, so a
-- single column re-offers it every single day. The prompt has three distinct
-- states and needs three answers.
--
--   demand_letter_prompted_at    the sweep first surfaced this invoice. Stamped
--                                once, by the daily job, and never moved. It is
--                                the clock the day 35-40 follow-up is measured
--                                from -- measuring that from the due date
--                                instead would fire the follow-up for invoices
--                                the contractor has never once been shown.
--
--   demand_letter_dismissed_at   the contractor said "not now". Silences the
--                                first prompt without claiming a letter was
--                                written.
--
--   demand_letter_sent_at        a letter exists. Written by the generation
--                                flow (steps 3-6), read by everything else.
--                                Ends the first prompt permanently.
--
-- All three are nullable with no default, so this is catalogue-only: no table
-- rewrite and no lock held while rows are touched. Existing invoices read as
-- "never prompted, never dismissed, no letter", which is true of every invoice
-- today.
--
-- Deliberately NOT added here: the letter text itself. Step 6 logs the sent
-- letter for the contractor's records, and where that goes -- a column, or an
-- InvoiceEvent row alongside the rest of the invoice's history -- is a decision
-- for the step that writes it, not one to pre-empt with an empty column.

alter table public."Invoice"
  add column if not exists demand_letter_prompted_at timestamp with time zone,
  add column if not exists demand_letter_dismissed_at timestamp with time zone,
  add column if not exists demand_letter_sent_at timestamp with time zone;

-- The daily sweep's exact query, and the reason it stays cheap as the table
-- grows. It looks for unpaid invoices past a date cutoff that have never been
-- prompted, so the index carries due_date and excludes every row already
-- stamped. Partial on the two conditions that never change per-scan, which
-- keeps it to the handful of rows actually in play rather than one entry per
-- invoice ever issued.
--
-- 'sent' AND 'overdue' both count as unpaid on purpose. Nothing in this app
-- reliably moves an invoice from 'sent' to 'overdue' -- check-overdue-invoices
-- does that relabelling but needs a user's JWT and only runs when someone
-- happens to call it -- so an invoice can sit at 'sent' months past its due
-- date. A sweep that trusted the status would silently skip exactly those.
create index if not exists invoice_demand_letter_candidates_idx
  on public."Invoice" (due_date)
  where demand_letter_prompted_at is null
    and demand_letter_sent_at is null
    and status in ('sent', 'overdue');

notify pgrst, 'reload schema';
