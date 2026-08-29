-- Quote decline records, the client-response gate, and notification preferences.
--
-- Additive only. No column is dropped, no type changes, no RLS policy is
-- touched. Every default here is a CONSTANT, so each `add column` is a
-- catalogue update that takes no table rewrite -- unlike the volatile
-- gen_random_uuid() default that forced the three-step add/backfill/constrain
-- form in 20260825120000_public_invoice_links_a_add.sql. Nothing in this file
-- holds ACCESS EXCLUSIVE for longer than it takes to update pg_attribute.

-- 1. WHO declined, WHEN, and optionally WHY.
--
-- Mirrors approved_by_name / approved_at from 20260826140000 rather than
-- reusing them. A single (responded_by, responded_at, outcome) triple would be
-- narrower, but it would make "was this ever approved and then declined?"
-- unanswerable, and a quote's history is exactly what a contractor needs in a
-- dispute. Separate columns keep both events.
--
-- decline_reason carries no length constraint on purpose: the function trims to
-- 500 characters before it gets here, and a hard limit that fired at the
-- database would surface to a client as a 500 they cannot act on.
alter table public."Quote"
  add column if not exists declined_by_name text,
  add column if not exists declined_at      timestamptz,
  add column if not exists decline_reason   text;

comment on column public."Quote".declined_by_name is
  'Name the decliner typed at the confirmation step. Free text and unverified --
   a record of what was asserted, not an identity claim. Mirrors
   approved_by_name, and like it is written ONLY by a client responding through
   the public link. A contractor changing the status manually stamps the
   timestamp and never the name: "marked declined by you" and "declined by Dana
   Marchetti" must not render identically, because they carry opposite
   evidentiary weight.';

comment on column public."Quote".declined_at is
  'When the decline was accepted. Distinct from updated_at, which moves on any
   edit and therefore cannot answer "when did the client say no".';

comment on column public."Quote".decline_reason is
  'Optional short reason the client gave. Shown to the contractor only. NULL
   means none was given, which is different from an empty string and is stored
   that way deliberately.';

-- 2. Whether clients may respond to a public quote link at all.
--
-- Default true: that is how the product behaves today, and a business-level
-- switch that silently changed the behaviour of links already sitting in
-- clients' inboxes would be a worse default than the one it replaced. Readers
-- test `!== false` so that a missing row means enabled too.
--
-- Gated in get-public-quote (what is drawn) AND re-checked in approve-quote
-- (what is allowed). Hiding a button is not a control: the endpoint is
-- reachable directly by anyone holding the link.
alter table public."BusinessSettings"
  add column if not exists allow_client_quote_approval boolean not null default true;

comment on column public."BusinessSettings".allow_client_quote_approval is
  'When false, public quote links still render the quote but carry no Approve or
   Decline control, and approve-quote refuses both actions with a distinct
   reason. Enforced in two places on purpose -- get-public-quote decides what is
   drawn, approve-quote decides what is allowed.';

-- 3. Contractor notification preferences, on the row the settings writer
--    already targets.
--
-- src/api/sdk.js saveNotificationSettings has listed notification_preferences in
-- its `allowed` array since it was written, while no such column existed
-- anywhere in the database. That is a live landmine, not a gap: PostgREST
-- rejects an ENTIRE patch for one unknown key, so the first caller to actually
-- send it would have failed the whole notification-settings save with a 42703.
-- This is also why the migration must land BEFORE the NotificationSettings.jsx
-- change that starts sending the key.
--
-- Empty object rather than a seeded set of keys: absent means "not chosen", and
-- every reader treats absent as enabled. Seeding defaults would put an opinion
-- on record that the contractor never expressed, and a default changed later
-- would not reach them.
alter table public."BusinessSettings"
  add column if not exists notification_preferences jsonb not null default '{}'::jsonb;

comment on column public."BusinessSettings".notification_preferences is
  'Per-notification opt-out map, e.g. {"quote_approved": false}. A MISSING key
   means enabled -- absent is "not chosen", never "off" -- so a preference added
   later arrives on for everyone rather than silently off. Read through
   supabase/functions/_shared/notify-prefs.ts, which is the only reader.';

-- Not included, deliberately: a CHECK constraint on Quote.status.
--
-- It would be safe today (see below) and it would have prevented the
-- declined/rejected split that this change repairs. But it is a behaviour
-- change for every write path in the app and belongs in its own migration,
-- after the vocabulary is actually single in production. Recorded here so the
-- next person does not have to rediscover that it is the obvious follow-up:
--
--   alter table public."Quote"
--     add constraint quote_status_known
--     check (status in ('draft','sent','approved','declined','converted'))
--     not valid;
--   alter table public."Quote" validate constraint quote_status_known;
