-- Constrain Quote.status to the five values the app actually understands.
--
-- The follow-up recorded commented-out in 20260828120000_quote_decline_and_gate.sql,
-- now that the vocabulary is single in production.
--
-- -- What this would have prevented -----------------------------------------
--
-- Nothing validated this column, so 'declined' and 'rejected' both wrote
-- successfully and the app drifted into using each in different places: the
-- contractor's status dropdown, list filters, stat cards and badges keyed on
-- 'declined', while PublicQuote.jsx and approve-quote read 'rejected'.
--
-- That was not cosmetic. approve-quote guarded 'approved' and 'rejected' and
-- never 'declined', so a quote the contractor had already declined could still
-- be approved by any client holding the link. A CHECK constraint would have
-- made the second spelling impossible to write in the first place.
--
-- -- 'rejected' is deliberately NOT in the list -----------------------------
--
-- Zero rows have ever held it (verified against live data before writing this),
-- and both readers now accept it only as a synonym on the way in while
-- producing 'declined' on the way out. Including it here would keep the split
-- writable and re-open the exact hole this closes.
--
-- -- NOT VALID then VALIDATE, deliberately ---------------------------------
--
-- Adding a validated CHECK takes ACCESS EXCLUSIVE and scans the whole table
-- while holding it. NOT VALID takes the lock only long enough to update the
-- catalogue -- new and updated rows are enforced immediately -- and VALIDATE
-- then scans under a weaker SHARE UPDATE EXCLUSIVE that does not block reads or
-- writes. At this row count the difference is nil; the form is what matters,
-- because this is the migration somebody copies onto a large table later.
--
-- Verified before writing: the only status present in live data is 'approved',
-- and the only values any code path writes are the five below.

alter table public."Quote" drop constraint if exists quote_status_known;

alter table public."Quote"
  add constraint quote_status_known
  check (status in ('draft', 'sent', 'approved', 'declined', 'converted'))
  not valid;

alter table public."Quote" validate constraint quote_status_known;

comment on constraint quote_status_known on public."Quote" is
  'The five states the UI can render. Deliberately excludes ''rejected'': it was
   read in two places, written by none, and allowing it would re-open the
   declined/rejected split that let a client approve an already-declined quote.';
