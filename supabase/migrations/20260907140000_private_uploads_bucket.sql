-- A second, PRIVATE bucket for receipts and quote-analysis photos.
--
-- This is the structural half of the storage finding. 20260907120000 closed the
-- enumeration -- the part that made it catastrophic -- by scoping the SELECT
-- policy to the owner. What it could not close is the rest of the sentence in
-- its own closing note: logos, receipts and job photos all lived in ONE bucket
-- with public = true, and /object/public/<path> does not consult RLS at all.
-- So a known full path still downloaded anything, including a receipt.
--
-- -- What moves, and what deliberately does not ----------------------------
--
-- PRIVATE (this bucket):
--   receipts            -- financial PII. A receipt names the vendor, the
--                          amounts, sometimes a card's last four. One was
--                          demonstrably downloaded across tenants on
--                          2026-09-07 with no apikey and no JWT.
--   quote-analysis photos -- job-site imagery uploaded only so the model can
--                          read it. No client ever sees these.
--
-- STAYS PUBLIC (the existing "uploads" bucket):
--   business logos      -- rendered inside emailed invoice PDFs and on the
--                          public invoice page, opened by a client with no
--                          session, often days after sending. A signed URL
--                          would have expired by then and the invoice would
--                          arrive unbranded. Nothing about a logo is secret.
--   job photos          -- the product SHARES these with the client through an
--                          anonymous album link (pages/SharedPhotos.jsx). Making
--                          them private and then signing URLs for an anonymous
--                          viewer is public access with extra steps, plus an
--                          expiry that breaks a link the client bookmarked.
--
-- That second exclusion is a real, narrowed decision rather than an oversight.
-- If job photos should stop being world-readable by path, the change is a
-- product change first -- the album link has to become a server-side endpoint
-- that validates the share token and mints signed URLs, the way the public
-- invoice page already validates a public_token. Tracked, not done here.
--
-- -- Existing rows are NOT moved by this file ------------------------------
--
-- Receipts uploaded before this still sit in the public bucket, and their rows
-- still hold plain https URLs. src/lib/storageUrl.js passes those through
-- untouched, which is what makes this deployable on its own -- no data has to
-- move before the code works. It also means the old exposure persists for old
-- receipts until the data is moved, which is a separate, reversible step:
--
--     python scripts/migrate-receipts-to-private.py            # dry run
--     python scripts/migrate-receipts-to-private.py --apply
--
-- Safe to run more than once.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'private-uploads', 'private-uploads', false,
  10485760,  -- 10MB, same as "uploads"; a phone photo of a receipt fits easily
  array['image/png','image/jpeg','image/jpg','image/webp','image/gif','image/heic','application/pdf']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- ---------------------------------------------------------------------------
-- Policies. Dropped by name first so this can be re-run.
--
-- Objects are keyed <user_id>/<uuid>-<filename>, exactly as in "uploads", so
-- storage.foldername(name)[1] is the owner.
--
-- Note the difference from "uploads": SELECT here is owner-scoped AND the
-- bucket is private, so there is no /object/public/ route around it. In
-- "uploads" the owner-scoped SELECT only stops listing; the bytes stay
-- reachable. Here it is the whole control.
-- ---------------------------------------------------------------------------
drop policy if exists "private uploads owner read"   on storage.objects;
drop policy if exists "private uploads owner insert" on storage.objects;
drop policy if exists "private uploads owner update" on storage.objects;
drop policy if exists "private uploads owner delete" on storage.objects;

create policy "private uploads owner read" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'private-uploads'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "private uploads owner insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'private-uploads'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "private uploads owner update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'private-uploads'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "private uploads owner delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'private-uploads'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
