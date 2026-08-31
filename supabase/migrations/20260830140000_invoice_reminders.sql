-- Remember that a reminder was sent, on the invoice itself.
--
-- -- Why this is needed at all ----------------------------------------------
--
-- src/pages/ChaseInvoice.jsx already sends reminders, and records what it sent
-- in localStorage under a single key. That history is per-device and per-
-- browser: chase an invoice from the van, open the laptop, and the laptop
-- believes nothing was ever sent. It is also lost the moment site data is
-- cleared.
--
-- Nothing can decide "this invoice is due a reminder" from a store like that.
-- The decision needs two facts that outlive a browser, so they go where the
-- invoice already is.
--
-- -- Why two columns rather than a history table ---------------------------
--
-- A full InvoiceReminder table would record every send with its channel, tone
-- and outcome, and one day that may be worth having. It is not what the
-- feature needs: the cadence asks only "how many have gone, and when was the
-- last one". Two columns answer that exactly, cost one ALTER each, and cannot
-- drift out of step with the invoice they describe.
--
-- Both defaults are constant, so this is catalogue-only -- no table rewrite,
-- no lock held while rows are touched.
--
-- Additive and non-breaking: existing rows read as "never reminded", which is
-- true of every invoice today.

alter table public."Invoice"
  add column if not exists last_reminder_sent_at timestamp with time zone;

-- Counts reminders, NOT sends. The first delivery of an invoice is not a
-- reminder and must not consume one, or a client who is merely slow gets the
-- final notice a stage early.
alter table public."Invoice"
  add column if not exists reminder_count integer not null default 0;

notify pgrst, 'reload schema';
