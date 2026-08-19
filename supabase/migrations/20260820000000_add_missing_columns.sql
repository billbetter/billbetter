-- Add the 18 columns the app writes but the schema never had.
--
-- Every one of these produced PostgREST 204 ("Could not find the 'x' column
-- of 'y' in the schema cache"). Until the localDataEngine fix, PGRST204 was
-- treated as "table missing" and the write silently fell through to
-- localStorage -- so these features looked like they worked and then lost the
-- data on reload. Now the error surfaces, which is how `payment_terms` was
-- found; the rest are the same bug waiting behind it.
--
-- Types match the nearest existing column on the same table:
--   dates       -> timestamptz, like Invoice.due_date / Quote.expiry_date
--   urls, text  -> text, like Invoice.pdf_url
--   structured  -> jsonb, like Invoice.items
--   foreign ids -> uuid, like Quote.linked_invoice_id (no FK, matching the
--                  existing link columns, which are plain uuids)
--
-- Purely additive: no drops, no rewrites, no data loss. Safe to run twice.

-- Invoice: payment terms per invoice (Settings already has the default that
-- feeds this) and the PDF generation timestamp.
alter table public."Invoice"
  add column if not exists payment_terms    text,
  add column if not exists pdf_generated_at timestamptz;

-- Quote: PDF fields mirroring Invoice, the camera/AI estimate capture, and the
-- job link. Job already has linked_quote_id; this is the other direction.
alter table public."Quote"
  add column if not exists pdf_url            text,
  add column if not exists pdf_generated_at   timestamptz,
  add column if not exists camera_photo_url   text,
  add column if not exists camera_description text,
  add column if not exists ai_analysis        jsonb,
  add column if not exists job_id             uuid;

-- RecurringInvoice: fields the create form has always sent. Without notes and
-- payment_terms a generated invoice loses them silently.
alter table public."RecurringInvoice"
  add column if not exists payment_terms text,
  add column if not exists client_phone  text,
  add column if not exists notes         text,
  add column if not exists end_date      timestamptz;

-- BusinessSettings: which Google Calendar to sync to. The connected flag was
-- stored but never the calendar itself.
alter table public."BusinessSettings"
  add column if not exists google_calendar_id text;

-- JobPhoto: favourites, tags, capture time and GPS.
-- double precision (not numeric) because the UI calls .toFixed(6) on these,
-- which needs a JSON number rather than a string.
alter table public."JobPhoto"
  add column if not exists is_favorite  boolean not null default false,
  add column if not exists tags         text[],
  add column if not exists taken_date   timestamptz,
  add column if not exists location_lat double precision,
  add column if not exists location_lng double precision;

-- Existing photos predate taken_date; fall back to when the row was written so
-- the sorts and date labels in JobDetailView have something real to show.
update public."JobPhoto" set taken_date = created_at where taken_date is null;

notify pgrst, 'reload schema';
