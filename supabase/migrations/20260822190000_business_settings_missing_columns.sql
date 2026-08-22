-- Add the six BusinessSettings columns the settings form writes but the table
-- never had.
--
-- Settings.jsx builds its payload as `{...formData, user_id, logo_url}` and
-- hands the whole thing to PostgREST, and localDataEngine.update passes it
-- through unfiltered (it only strips the legacy created_date/updated_date
-- aliases). Six of the 25 keys in initialFormData have no column behind them,
-- so PostgREST rejected the request with
--   PGRST204 "Could not find the 'logo_url' column of 'BusinessSettings'"
-- before reaching any of the others. Every save of the settings page failed --
-- the page's own load was broken by a ReferenceError, so nobody got far enough
-- to notice.
--
-- This is the same class as 20260820000000_add_missing_columns.sql, which did
-- it for 18 columns on other tables; these are the ones still outstanding.
--
-- Types match the nearest existing column on the same table:
--   urls, keys, text -> text, like BusinessSettings.website / pdf_footer_text
--   structured       -> jsonb, like Invoice.items
--
-- All nullable with no default. The form already supplies its own fallbacks on
-- read (`fetchedSettings.email_subject_template || defaultEmailSubjectTemplate`),
-- so a NULL means "not set" and keeps that path working rather than baking a
-- copy of the default text into the schema, where it would drift.
--
-- Purely additive: no drops, no rewrites, no data loss. Safe to run twice.

alter table public."BusinessSettings"
  add column if not exists logo_url               text,
  add column if not exists serpapi_key            text,
  add column if not exists review_link            text,
  add column if not exists email_subject_template text,
  add column if not exists email_body_template    text,
  add column if not exists custom_template_config jsonb;

comment on column public."BusinessSettings".logo_url is
  'Business logo shown in the app header and settings. Not yet used by the PDF templates.';
comment on column public."BusinessSettings".serpapi_key is
  'Per-business SerpApi key. Readable by its owner through PostgREST under RLS, so treat it as user-held rather than secret infrastructure.';
comment on column public."BusinessSettings".review_link is
  'Public review URL sent in review-request emails.';
comment on column public."BusinessSettings".email_subject_template is
  'Invoice email subject template. NULL falls back to the default in Settings.jsx.';
comment on column public."BusinessSettings".email_body_template is
  'Invoice email body template. NULL falls back to the default in Settings.jsx.';
comment on column public."BusinessSettings".custom_template_config is
  'Section toggles and colours for the "custom" invoice_template. jsonb because the form writes a whole object; no renderer consumes it yet.';
