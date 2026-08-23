-- Storage for user uploads: business logos, job photos, receipts, quote photos.
--
-- The app has had five upload call sites since it was written -- the logo on
-- Settings, PhotoUploadModal, JobExpensesTab's receipt scanner, CameraAnalyzer
-- and QuickBillFlow -- and no bucket has ever existed for them to write to.
-- Core.UploadFile was a stub returning URL.createObjectURL(), a blob: URL that
-- lives in one tab and dies on reload, so nothing was ever actually stored.
--
-- Safe to run more than once.

-- ---------------------------------------------------------------------------
-- The bucket.
--
-- public = true is a deliberate trade, not a shortcut. A logo is embedded in
-- invoice PDFs and emails, and a shared job album is opened by a client who has
-- no account; both are rendered far outside an authenticated session, where a
-- signed URL would have expired by the time anyone looked. Read access is
-- therefore "anyone holding the URL", and the URL is made unguessable by
-- prefixing every object with a UUID.
--
-- WRITE access is not public: the policies below confine each user to a folder
-- named after their own id, so nobody can overwrite anybody else's logo.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'uploads', 'uploads', true,
  10485760,  -- 10MB; a phone photo of a receipt is comfortably under this
  array['image/png','image/jpeg','image/jpg','image/webp','image/gif','image/heic','application/pdf']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- ---------------------------------------------------------------------------
-- Policies. Dropped by name first so this can be re-run.
--
-- Every object is stored as  <user_id>/<uuid>-<filename>, so the first path
-- segment is the owner. storage.foldername() splits the key on "/", and
-- element 1 is that segment.
-- ---------------------------------------------------------------------------
drop policy if exists "uploads public read" on storage.objects;
drop policy if exists "uploads owner insert" on storage.objects;
drop policy if exists "uploads owner update" on storage.objects;
drop policy if exists "uploads owner delete" on storage.objects;

create policy "uploads public read" on storage.objects
  for select using (bucket_id = 'uploads');

create policy "uploads owner insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'uploads'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "uploads owner update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'uploads'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "uploads owner delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'uploads'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
