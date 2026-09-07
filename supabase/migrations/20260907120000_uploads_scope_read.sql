-- Stop anonymous cross-tenant enumeration and download of uploaded files.
--
-- -- The hole ---------------------------------------------------------------
--
-- 20260823120000_uploads_bucket.sql created the read policy as
--
--   create policy "uploads public read" on storage.objects
--     for select using (bucket_id = 'uploads');
--
-- with no owner predicate and no role restriction. That SELECT is what the
-- Storage `list` endpoint authorizes, and the anon key ships in the browser
-- bundle. So anyone could:
--
--   1. POST /storage/v1/object/list/uploads {"prefix":""}      -> every tenant's
--      user_id folder (objects are keyed <user_id>/<uuid>-<name>),
--   2. list inside a folder                                    -> every filename,
--   3. GET /storage/v1/object/public/uploads/<path>            -> the bytes,
--      because the bucket is public=true and /object/public/ ignores RLS.
--
-- Confirmed live: a receipt image belonging to another tenant was downloaded
-- with no apikey and no JWT. Receipts carry financial PII; job photos are
-- private client-site imagery. The design leaned entirely on unguessable UUID
-- paths, and enumeration defeated that.
--
-- -- The fix ----------------------------------------------------------------
--
-- Scope SELECT to the owning user. This kills enumeration (list now returns
-- only your own folder) and cross-tenant reads through the authenticated and
-- REST object paths.
--
-- Logo rendering is UNAFFECTED: a public bucket serves /object/public/<path>
-- from the bucket's public flag, not from this SELECT policy, so the <img>
-- tags in emails, PDFs and public invoice pages keep working. What stops is
-- *listing* and any RLS-gated read -- neither of which the app relies on for
-- rendering.
--
-- NOTE (tracked separately): logos, receipts and job photos still share one
-- public bucket, so a known full path still downloads any of them via
-- /public/. The complete fix is a second, private bucket (public=false) for
-- receipts and job photos, served by short-lived signed URLs, with only logos
-- left public. That is a larger change touching upload call sites; this
-- migration closes the enumeration -- the part that made it catastrophic --
-- immediately.

drop policy if exists "uploads public read" on storage.objects;

create policy "uploads owner read" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'uploads'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
