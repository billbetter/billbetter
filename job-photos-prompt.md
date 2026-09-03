# Claude Code prompt — CompanyCam-grade job photos

Paste everything below the line into Claude Code from inside `AxisBill/`.

---

I want to rebuild job photo capture in this app to the standard CompanyCam sets. Before writing any code, explore the existing implementation and come back with a plan.

## Repo facts (verify these, don't assume)

- Vite + React, **plain JSX — no TypeScript**. Tailwind + shadcn/ui in `src/components/ui`. `@` aliases to `src`.
- All data access goes through `src/api/sdk.js` → `sdk.entities.<Name>` (a wrapper over Supabase via `src/api/localDataEngine.js`). Entities are declared in `src/entities/`.
- File uploads: `sdk.integrations.Core.UploadFile({ file })` → returns `{ file_url, url, path, success }`. It writes to the **public-read Supabase Storage bucket `uploads`** under the key `<user_id>/<uuid>-<filename>`. Storage policies confine a user to their own folder; the UUID is what makes a public bucket acceptable.
- Hard paywall: no free tier. `src/lib/access.js` mirrors `public.has_app_access()` in RLS. Feature gating lives in `src/components/utils/permissions.jsx` — each feature is declared **once** in `FEATURE_MINIMUM_PLAN` against its minimum plan, and the per-plan tables are generated from that. Gate UI with `<FeatureGate feature="..." />` or `canAccessFeature(subscription, key)`.
- This is a **PWA**, not a native app. That's a real constraint on Phase 1 — see below.

## What already exists — extend it, don't rewrite it

- `src/pages/JobPhotos.jsx` — job list + gallery
- `src/components/jobPhotos/PhotoUploadModal.jsx` — multi-file picker, category select, caption, comma-separated tags, browser geolocation
- `src/components/jobPhotos/PhotoDetailModal.jsx`, `JobDetailView.jsx`, `PhotoSelector.jsx` (attaches photos to invoices), `ShareAlbumModal.jsx` (expiring client links) and `src/pages/SharedPhotos.jsx` (the public album page)
- `JobPhoto` records already carry: `user_id`, `job_id`, `client_id`, `uploaded_by_user_id`, `uploaded_by_name`, `photo_url`, `thumbnail_url`, `category`, `caption`, `tags[]`, `is_favorite`, `location_lat`, `location_lng`, `taken_date`, `position`

So the data model is already close. The gap is in capture reliability, image handling, and everything downstream of the photo.

## The gap vs CompanyCam, ranked by what actually bites on a job site

1. **No image compression.** Full-size phone photos (4–8MB each) are uploaded as-is. A 20-photo batch on site LTE will hang or fail.
2. **`thumbnail_url` is set to `photo_url`** — there's a comment admitting it. The gallery grid therefore downloads full-resolution images. This is the single worst thing for a contractor on mobile data.
3. **Uploads are sequential and blocking** — a `for` loop of `await`, inside one try/catch. One failure loses the whole batch, there's no progress indicator, no retry, and no queue that survives navigating away or losing signal.
4. **No EXIF.** `taken_date` is set to upload time, not capture time. GPS comes from browser geolocation *at upload*, not from the photo — so photos uploaded that evening from home are tagged with the wrong location. EXIF orientation is also unhandled, so iPhone photos can render sideways.
5. No reverse-geocoded street address, and no option to burn a date/time/address stamp into the image (CompanyCam's signature output — it's what makes the photo hold up as documentation).
6. No per-photo comments.
7. No annotation/markup (arrows, boxes, text) — heavily used for punch lists.
8. No cross-job photo search or filtering by tag / date / location.
9. No chronological timeline view grouped by day.
10. No PDF photo report, and no required-photo checklist per job type.

## Phases

Plan all four, but implement **Phase 1 only** until I say otherwise.

**Phase 1 — foundation.** Client-side compression before upload; real generated thumbnails; EXIF extraction (capture time, GPS, orientation) with correct orientation handling; a resilient upload queue with per-file progress, retry, and an IndexedDB-backed pending queue that survives reload and reconnects. Backfill strategy for existing rows where `thumbnail_url === photo_url`.

*Acceptance:* 20 photos selected from a phone, network throttled to slow 3G, with a mid-batch reload — every photo lands exactly once, no duplicates, correct orientation, and the gallery grid transfers thumbnails only. Verify the transfer size in devtools rather than asserting it.

**Phase 2 — field capture.** Fullscreen camera with rapid multi-shot, auto-tagged to job + GPS + capture time, reverse geocoding to a street address, optional burned-in stamp.

**Phase 3 — collaboration.** Per-photo comments; annotation/markup on a canvas layer, saved non-destructively so the original is preserved.

**Phase 4 — output.** Day-grouped timeline view, cross-job search, PDF photo report, required-photo checklists per job type.

## Constraints

- Plain JSX. Reuse the existing shadcn components; don't introduce a second UI vocabulary.
- **Ask before adding any dependency.** I'd expect `browser-image-compression` and `exifr` to be the right calls for Phase 1 — make the case for them (or against) before installing.
- **Ask before any schema change.** New columns and tables must be additive, non-breaking migrations with RLS policies matching the existing ones. Do not alter existing `JobPhoto` columns.
- Don't break the existing expiring share links, `SharedPhotos.jsx`, or invoice photo attachment via `PhotoSelector.jsx`.
- The `uploads` bucket is public-read. Anything genuinely sensitive needs a different bucket and a signed-URL path — flag it if you hit that.
- New advanced capability (annotation, photo reports, checklists) should be feature-gated. Basic capture stays on Core — a solo contractor taking before/after shots is the base use case. Add keys to `FEATURE_MINIMUM_PLAN` rather than hardcoding plan names anywhere.
- Be honest about the PWA ceiling: a web app cannot do true background upload the way a native app can. Tell me where the realistic limit is instead of pretending to match it.

## What I want back first

Do not write code yet. Explore the files above, then write me a plan at `docs/job-photos-plan.md` covering:

- What you found — correct me where I'm wrong above
- Phase 1 broken into concrete steps with the files each touches
- Any schema changes, spelled out as the migration SQL you'd run
- Dependencies you want, and why the alternative is worse
- What you'd have to change about the existing upload path vs. what you'd leave alone
- The risk you're least sure about

Then stop and wait.
