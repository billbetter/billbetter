-- Public quote links.
--
-- Step 6 of docs/invoice-links-plan.md: the same mechanism the invoice link
-- uses, applied to quotes.
--
-- -- The part that was not just an RLS problem -----------------------------
--
-- PublicQuote was believed to be dead because anonymous reads resolve to empty
-- under RLS. It is deader than that: **nothing in the application has ever
-- written public_id or approval_token.** src/pages/CreateQuote.jsx builds
-- quoteData from formData plus six explicit fields, and neither credential is
-- among them. The only place either string appears with a value is
-- src/entities/seedData.js, which is local demo data.
--
-- So on the live database every quote has public_id = null and
-- approval_token = null, which means:
--
--   * QuoteDetail.jsx:263 computes `quote.public_id ? url : null`, so the share
--     link is never rendered -- the page cannot be reached even by its owner.
--   * approve-quote looks up by approval_token, so it could never have matched
--     a real quote. The function works; there has simply never been a row for
--     it to find.
--
-- Generating these in the client was rejected. A credential that only exists if
-- one particular code path remembers to create it is a credential that goes
-- missing, which is precisely what happened here. A column default cannot be
-- forgotten.
--
-- Adding a DEFAULT to an EXISTING column is a catalogue update, not a rewrite --
-- unlike creating the column and the volatile default together, which is what
-- forced the three-step form on Invoice.public_token.

-- 1. Defaults, so no future quote can be created without its credentials.
alter table public."Quote"
  alter column public_id      set default gen_random_uuid()::text,
  alter column approval_token set default gen_random_uuid()::text;

-- 2. Backfill. Bounded by LIMIT so the shape is right if this is ever copied
--    onto a full table; at the current row count it completes in one pass.
--    Repeat until it reports zero, or use scripts/backfill-public-tokens.py's
--    approach for anything large.
update public."Quote"
   set public_id = coalesce(public_id, gen_random_uuid()::text),
       approval_token = coalesce(approval_token, gen_random_uuid()::text)
 where id in (
   select id from public."Quote"
    where public_id is null or approval_token is null
    limit 1000
 );

-- 3. Constrain. This is also what makes a half-finished backfill fail loudly
--    rather than leaving a table where some quotes have links and some do not.
alter table public."Quote" drop constraint if exists quote_public_id_present;
alter table public."Quote"
  add constraint quote_public_id_present
  check (public_id is not null and approval_token is not null) not valid;
alter table public."Quote" validate constraint quote_public_id_present;

-- Both are credentials, so both lookups must be exact and indexed, and a
-- collision would hand one client another client's quote.
create unique index if not exists quote_public_id_key
  on public."Quote" (public_id);
create unique index if not exists quote_approval_token_key
  on public."Quote" (approval_token);

-- Parity with Invoice: revocation and the view signal.
alter table public."Quote"
  add column if not exists public_link_revoked_at timestamptz,
  add column if not exists first_viewed_at        timestamptz,
  add column if not exists last_viewed_at         timestamptz,
  add column if not exists view_count             integer not null default 0;

comment on column public."Quote".public_id is
  'Credential for the public quote page. Text rather than uuid only because the
   column predates the convention and already appears in sent links; new values
   are uuids cast to text. Never expires; only revocation kills it.';

comment on column public."Quote".approval_token is
  'Separate credential for one-click approval from the emailed link. Kept
   distinct from public_id so that approving is an action credential rather
   than a consequence of being able to view.';

-- PublicLinkHit becomes the log for both document types. A hit belongs to at
-- most one document; two nullable FKs keep referential integrity, which a
-- generic (document_type, document_id) pair would throw away. Both null still
-- means "token matched nothing", which is the row the rate limiter needs.
alter table public."PublicLinkHit"
  add column if not exists quote_id uuid references public."Quote"(id) on delete cascade;

create index if not exists public_link_hit_quote on public."PublicLinkHit" (quote_id, hit_at desc);

-- The read policy has to cover quotes too, or a contractor can see the view
-- history of their invoices and not their quotes.
drop policy if exists "PublicLinkHit read" on public."PublicLinkHit";
create policy "PublicLinkHit read" on public."PublicLinkHit"
  for select to authenticated
  using (
    exists (
      select 1 from public."Invoice" i
       where i.id = "PublicLinkHit".invoice_id
         and i.user_id in (select accessible_owner_ids(auth.uid()))
    )
    or exists (
      select 1 from public."Quote" q
       where q.id = "PublicLinkHit".quote_id
         and q.user_id in (select accessible_owner_ids(auth.uid()))
    )
  );

-- Still no INSERT/UPDATE/DELETE policy. Writes come only from the edge
-- functions, which use the service role and bypass RLS. A client must not be
-- able to forge or erase view history.
