-- Record WHO approved a quote and WHEN.
--
-- -- Why a name, and why a confirm step ------------------------------------
--
-- The public quote link is MEANT to be forwarded. A client sending "here's the
-- quote" to their spouse or business partner is normal and good. But once
-- approve-quote accepts public_id, that forward carries the power to commit to
-- the job -- and a $15k commitment should not be one click by whoever the link
-- reached.
--
-- So approval now requires a deliberate confirm with a typed name, and the name
-- is stored. That is also what makes an approval defensible three months later
-- when someone disputes the scope: "approved by Dana Marchetti on 4 September"
-- is a record; a status flipping to 'approved' is not.
--
-- approved_at is stored separately from updated_at on purpose. updated_at moves
-- for any edit, so it answers "when was this row last touched", not "when did
-- the client agree" -- and the second question is the one that matters in a
-- dispute.
--
-- No IP address is recorded. These are the contractor's client's, PIPEDA
-- applies, and a typed name is the part with evidentiary value anyway.

alter table public."Quote"
  add column if not exists approved_by_name text,
  add column if not exists approved_at      timestamptz;

comment on column public."Quote".approved_by_name is
  'Name the approver typed at the confirmation step. Free text and unverified --
   it is a record of what was asserted, not an identity claim.';

comment on column public."Quote".approved_at is
  'When the approval was accepted. Distinct from updated_at, which moves on any
   edit and therefore cannot answer "when did the client agree".';
