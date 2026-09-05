-- How this business wants to be paid, in their own words.
--
-- -- Why this is not derived from Stripe ------------------------------------
--
-- stripe_account_status = 'active' says a card payment WOULD work. It does not
-- say the contractor wants card listed, that it is the method they prefer for
-- this client, or that it is the only one they take. Plenty of trades work is
-- settled by e-transfer, cheque or cash, and a letter that offers only a
-- payment link because Stripe happens to be connected is quietly telling the
-- client something untrue about how to pay.
--
-- -- Why free text rather than a multi-select ------------------------------
--
-- A demand letter has to tell someone HOW to pay, not merely which categories
-- of payment are theoretically accepted. "E-transfer" on its own is unusable;
-- "E-transfer to pay@example.com" is a payment. So is "Cheque payable to
-- Bagzat Contracting, 14 Mill Road" and "Card: use the payment link on the
-- invoice". A fixed set of checkboxes cannot carry the address, the payee name
-- or the reference, which is the part that actually gets money moved -- the
-- contractor would end up writing it in a notes field anyway.
--
-- One method per line. That shape survives being rendered as a list in the
-- letter and as a textarea in Settings without parsing anything, and it does
-- not pretend to a structure the data does not have. If a later feature needs
-- these as discrete records -- per-client method preferences, say -- that is a
-- table, not a jsonb column bolted on here.
--
-- Nullable with no default. An account that has never filled this in reads as
-- null, and the letter flow treats that as "ask before generating" rather than
-- inventing methods on the business's behalf.

alter table public."BusinessSettings"
  add column if not exists payment_methods text;

notify pgrst, 'reload schema';
