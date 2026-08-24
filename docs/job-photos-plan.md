# Job photos — rebuild plan

Status: **plan only, nothing implemented.** Phase 1 is specified to the point of
being executable; Phases 2–4 are sketched to show where Phase 1's seams have to be.

---

## 1. What I found

Your description of the code is accurate. Every file, field and behaviour you
listed is there as described, and all ten ranked gaps are real. Five things are
different from what the brief assumes, and two of them change the shape of the work.

### 1.1 There is no data to migrate — the backfill is a no-op

I queried production (`rcymevdxsizstnopqeow`) rather than inferring from migrations:

| | rows |
|---|---|
| `public."JobPhoto"` | **0** |
| `public."Job"` | **0** |
| `storage.objects` in `uploads` | **0** |
| `Client` / `Invoice` / `auth.users` | 3 / 3 / 2 |

So "backfill strategy for existing rows where `thumbnail_url === photo_url`" has
nothing to act on. There is no migration job, no re-processing pass, no
progressive backfill. What's still needed is the much smaller thing: a **read
guard** (`thumbnail_url || photo_url`, which all three grids already do) so rows
written before the change — including the four in `src/entities/seedData.js`,
which hardcode Unsplash URLs at `w=200` — keep rendering. That's it.

This is worth saying plainly because it removes the single riskiest item in
Phase 1. It also means the photo path can change shape freely: no compatibility
surface exists yet.

The `uploads` bucket having zero objects also means the `uploadFile()` fix that
replaced the `createObjectURL` stub **has never run in production**. Phase 1 will
be its first real exercise.

### 1.2 This is not a PWA in the sense the brief assumes

`public/manifest.json` exists. That is the entire PWA surface:

- no service worker file anywhere in `public/` or `src/`
- no `navigator.serviceWorker.register` call
- no `vite-plugin-pwa` / Workbox in `vite.config.js`
- zero occurrences of `indexedDB` in the codebase today

So the app is installable-looking but has no offline layer at all. This makes the
Phase 1 ceiling **lower** than "PWA" implies, and I'd rather set that expectation
now — see §6.

### 1.3 The share links you asked me not to break are already broken

`ShareAlbumModal.jsx` and `SharedPhotos.jsx` both call
`sdk.entities.JobPhotoShare`, declared inline at `src/api/sdk.js:726`.
**The `JobPhotoShare` table does not exist in Postgres** — the public schema has
17 tables and that isn't one of them.

The consequence is specific. `localDataEngine` treats `PGRST205` as "table
missing" and falls back to `localStorage`. So creating a share link writes a row
into *the contractor's own browser*, and `SharedPhotos.jsx` then looks for that
token in *the client's* browser, finds nothing, and renders "This link is invalid
or has expired". The feature works only in the tab that created it.

Even with the table created, the RLS pattern on `JobPhoto` is
`user_id IN (accessible_owner_ids(auth.uid())) AND has_app_access(auth.uid())`,
which an anonymous visitor fails on both clauses. A working share needs a
deliberate token-scoped anon read path.

I have **not** touched this — it's outside Phase 1 and needs its own decision.
Flagging it because "don't break the share links" isn't achievable as stated:
there is nothing working to preserve.

### 1.4 The gating rule is violated inside the file we're rewriting

`PhotoUploadModal.jsx:100`:

```js
const isEnterprise = subscription?.plan_name === "enterprise";
```

That's a hardcoded plan name, which your constraints forbid, and it gates
**camera and GPS behind Enterprise** — directly contradicting "basic capture
stays on Core — a solo contractor taking before/after shots is the base use
case". A Core subscriber today gets an alert reading "Camera access requires
Enterprise plan".

Meanwhile the declarative tables already say the opposite: `jobs: "core"` in
`FEATURE_MINIMUM_PLAN` and `JobPhoto: "core"` in `ENTITY_MINIMUM_PLAN`. There is
no photo-specific feature key at all, and for Phase 1 there shouldn't be — basic
capture is covered by `jobs`. Phase 1 deletes the `isEnterprise` branch rather
than adding a key.

### 1.5 Two smaller defects in the current upload path

- **Failed uploads write broken rows.** `uploadFile()` reports failure by
  returning `{ success: false, file_url: null }` rather than throwing — a
  deliberate choice, documented at `sdk.js:112`. But `PhotoUploadModal.jsx:188`
  never checks it, so a failed upload still creates a `JobPhoto` with
  `photo_url: null`. Silent corruption, and it survives reload.
- **Opening the modal prompts for camera access.** `checkPermissions()`
  (`PhotoUploadModal.jsx:70`) calls `getUserMedia({video:true})` purely to probe
  permission state, then immediately stops the tracks. On a fresh browser that
  triggers the camera prompt on modal open, before the user has asked for the
  camera. The Permissions API query below it is the correct probe; the
  `getUserMedia` call should go.

### 1.6 Confirmed as described

- `thumbnail_url` is assigned `uploadResult.file_url` (`:189`), comment and all.
- Three grids consume it, all already null-safe: `JobDetailView.jsx:310`,
  `PhotoSelector.jsx:112`, `SharedPhotos.jsx:168`. None sets `loading="lazy"` or
  intrinsic dimensions, so the 4-column grid eager-loads full-resolution images
  and shifts layout as they arrive.
- The upload loop is a sequential `for … await` in one try/catch (`:177`–`:199`)
  — one failure aborts the remainder and loses the batch.
- `JobPhoto` has exactly the 17 columns you listed. Verified against
  `information_schema`.
- The `uploads` bucket is public-read, 10 MB per object, MIME allowlist
  `png, jpeg, jpg, webp, gif, heic, pdf`. Note **`image/heif` is not on that
  list** and iOS reports that type for some HEIC files — see §7.

---

## 2. Phase 1 — steps

The through-line: **decode each photo exactly once, derive both sizes from that
one decode, and make every step idempotent so a retry can never double-write.**

### Step 1 — EXIF extraction (`src/lib/photos/exif.js`, new)

Read `DateTimeOriginal`, `GPSLatitude`/`GPSLongitude` and `Orientation` from the
file *before* any re-encode, because re-encoding destroys them (§5).

Returns a plain object with everything optional — a screenshot or a scan has no
EXIF and that must be a normal outcome, not an error. GPS refs (`S`/`W`) must be
applied as sign flips; `exifr` does this, which is a large part of why it earns a
dependency.

`taken_date` becomes `DateTimeOriginal ?? file.lastModified ?? now`, in that
order. That alone fixes gap #4's worst symptom — photos uploaded from home in the
evening currently claim to have been taken then.

### Step 2 — image pipeline (`src/lib/photos/imagePipeline.js`, new)

One decode, two outputs:

```
File
 └─ createImageBitmap(file, { imageOrientation: "from-image" })   ← orientation baked in
     ├─ draw → canvas 1600px longest edge, quality 0.82 → full blob
     └─ draw → canvas  400px longest edge, quality 0.72 → thumb blob
```

`imageOrientation: "from-image"` makes the browser apply the EXIF rotation during
decode, which fixes sideways iPhone photos without hand-rolling the eight-case
orientation matrix.

Output format: **WebP where supported, JPEG otherwise**, decided once by probing
`canvas.toBlob` support. WebP is roughly 25–30 % smaller at matched quality.

Fallback for older Safari (`OffscreenCanvas.convertToBlob` is 16.4+):
`HTMLImageElement` + on-thread `<canvas>` + `toBlob`. Slower, same output.

Returns `{ fullBlob, thumbBlob, width, height, originalBytes }`.

### Step 3 — durable queue (`src/lib/photos/uploadQueue.js` + `idb.js`, new)

A module-level singleton, **not** owned by the modal — that's what lets it
survive closing the dialog or navigating to another page.

One IndexedDB object store, `pendingPhotos`, keyed by a client-generated UUID:

```
{ id, jobId, clientId, userId, ownerId,
  fullBlob, thumbBlob,          // compressed — see below
  meta: { category, caption, tags, takenDate, lat, lng, width, height },
  filename, state, attempts, lastError, enqueuedAt }
```

**Compress before enqueue, not after.** Two reasons: a queued item is ~300 KB
instead of 4–8 MB, so a 20-photo batch is ~6 MB of IndexedDB rather than 150 MB;
and it sidesteps the question of whether a `File` handle from an `<input>`
survives a reload on iOS, since a generated `Blob` is unambiguously stored by
value.

Runs at **concurrency 3** — enough to keep a slow link saturated, few enough to
bound peak memory. Retries with exponential backoff (1s, 2s, 4s, 8s, capped), max
5 attempts, then `state: "failed"` with a visible Retry control. Resumes on
`load`, on `online`, and on `visibilitychange → visible`.

### Step 4 — exactly-once semantics

This is what the acceptance test actually probes, so it's worth being explicit.
The queue item's UUID is used as **both** identifiers:

| | value | on retry |
|---|---|---|
| Storage object key | `<user_id>/<uuid>-full.webp` | `upsert: true` → overwrites the same object |
| `JobPhoto.id` | the same `<uuid>` | PK conflict `23505` → treated as **success**, not error |

So a mid-batch reload can only ever re-do work, never duplicate it. The row is
deleted from IndexedDB only after the `JobPhoto` insert is confirmed, which makes
the ordering crash-safe in the other direction too (worst case: an orphaned
storage object with no row — invisible and cheap).

This requires one small change to `uploadFile()` — see §5.

### Step 5 — UI

- `PhotoUploadModal.jsx`: replace the blocking loop with "enqueue and close".
  Per-file rows showing thumbnail, progress and a per-file Retry. Delete the
  `isEnterprise` gate and the `getUserMedia` permission probe (§1.4, §1.5).
- `UploadQueueIndicator.jsx` (new): a small persistent element showing
  "3 photos uploading" with a failure count, mounted from `Layout.jsx` so it's
  visible from any page.
- `JobDetailView.jsx`: add `loading="lazy"`, `decoding="async"` and intrinsic
  `width`/`height` to the grid `<img>` so the browser reserves the box.

### Step 6 — verification

Not asserted — measured, per your instruction. I'd drive a real Chromium over
CDP: throttle to Slow 3G with `Network.emulateNetworkConditions`, select 20
fixture photos, force a reload mid-batch, then check:

1. `JobPhoto` row count is exactly 20, and `count(distinct id) = 20`
2. every `photo_url` resolves 200, and no row has `photo_url is null`
3. orientation: decode each result and compare dimensions against the EXIF
   orientation of the fixture
4. **transfer size**: load the grid, then sum
   `performance.getEntriesByType("resource")` `transferSize` for image requests.
   This is the programmatic form of reading the devtools Network panel, and it's
   the number that matters — it must reflect thumbnails only.

### Files touched

| File | Change |
|---|---|
| `src/lib/photos/exif.js` | new |
| `src/lib/photos/imagePipeline.js` | new |
| `src/lib/photos/uploadQueue.js` | new |
| `src/lib/photos/idb.js` | new (dropped if `idb` is approved) |
| `src/components/jobPhotos/UploadQueueIndicator.jsx` | new |
| `src/components/jobPhotos/PhotoUploadModal.jsx` | substantial rewrite |
| `src/api/sdk.js` | `uploadFile()` gains optional `path` / `upsert` |
| `src/components/jobPhotos/JobDetailView.jsx` | lazy-load + intrinsic size |
| `src/Layout.jsx` | mount indicator, start queue on load |

---

## 3. Schema changes

**Phase 1 needs none.** The idempotency scheme in §2 Step 4 uses the existing
`id` primary key and the existing storage key format. Worth stating clearly,
because it's the safest possible answer to "don't alter existing columns".

There are four columns I'd *like*, all purely additive, none read by existing
code, all inheriting the table's existing RLS policy automatically (a policy is
per-table, not per-column, so nothing needs re-granting):

```sql
-- Additive only. No existing column is altered, and no default backfills
-- anything currently read. Safe to run more than once.
alter table public."JobPhoto"
  add column if not exists photo_path     text,
  add column if not exists thumbnail_path text,
  add column if not exists width          integer,
  add column if not exists height         integer;

comment on column public."JobPhoto".photo_path is
  'Storage object key for photo_url. Lets us delete the object when the row is
   deleted, and re-sign the URL if `uploads` ever becomes a private bucket.';

comment on column public."JobPhoto".thumbnail_path is
  'Storage object key for thumbnail_url.';

notify pgrst, 'reload schema';
```

Why each earns its place:

- `photo_path` / `thumbnail_path` — today, deleting a `JobPhoto` orphans its
  storage objects forever, because the row never recorded the key. It also gives
  you the migration path if the bucket ever has to go private (§7).
- `width` / `height` — lets the grid reserve the correct box and stop layout
  shift, and lets a lightbox size itself before the image loads.

**I have not run this.** It needs your approval, per your constraint.

---

## 4. Dependencies

I want **one** of the two you proposed, and I'd argue against the other.

### `exifr` — yes

Parsing EXIF by hand means walking a TIFF IFD inside a JPEG APP1 segment,
handling both endiannesses, decoding rational types for GPS, and applying the
`GPSLatitudeRef`/`GPSLongitudeRef` sign flips. Getting the sign flip wrong puts a
job in the wrong hemisphere, and it's the kind of bug that only shows up for
users in half the world.

`exifr` also does the thing that matters for the acceptance test: it can read
**only the header** (`exifr.parse(file, { pick: [...] })`) rather than buffering
the whole 8 MB file, so extraction stays cheap on a phone.

Lazy-import it inside `exif.js` so it stays out of the initial bundle — which
matters, because `dist/assets/index-*.js` is already **2.4 MB** in a single chunk.

### `browser-image-compression` — no, and I'd rather not

It's the obvious pick and I think it's the wrong one here, for three reasons:

1. **We have to write the canvas pipeline anyway.** It produces one output per
   call. We need two sizes — full and thumbnail — so using it means either
   calling it twice (decoding an 8 MP image twice, the expensive step) or using
   it for the full size and hand-rolling the thumbnail regardless. Once the
   canvas code exists for the thumbnail, the library is duplicating what we have.
2. **It doesn't solve orientation.** Its output is canvas-encoded, so EXIF —
   orientation included — is gone. Correct rotation still has to come from
   `createImageBitmap(..., { imageOrientation: "from-image" })` on our side. The
   library's presence doesn't remove that requirement.
3. **Its headline feature is one we don't want.** `maxSizeMB` works by
   re-encoding in a loop until the blob is under a threshold — repeated decodes
   to hit a byte target. On a phone that's exactly the memory pressure I'm most
   worried about (§7). A fixed longest-edge plus fixed quality is one decode and
   predictable output.

The whole replacement is roughly 60 lines against `createImageBitmap` and
`canvas.toBlob`, both of which we need regardless.

If you'd rather ship the library, say so and I will — it's a defensible call and
it's less code I've written myself. But I don't think it earns the weight.

### `idb` — mild yes

~1.5 KB gzipped, and raw IndexedDB is genuinely easy to get subtly wrong
(transactions auto-commit when the microtask queue drains, which bites exactly
the async/await style the rest of this codebase uses). Our needs are one store
and four operations, so hand-rolling is viable — call it 50 lines. **Slight
preference for `idb`; entirely happy to hand-roll if you'd rather hold the
dependency count down.**

### `heic2any` — no

~1 MB for a case iOS mostly handles itself (Safari converts HEIC to JPEG when a
file is chosen through `accept="image/*"`). See §7 for what I'd do instead.

**Nothing gets installed until you say so.**

---

## 5. The existing upload path: change vs leave alone

### Leave alone

- **`localDataEngine`'s owner-scoping.** `JobPhoto` is already in
  `OWNER_SCOPED_TABLES`, so `user_id` is rewritten to the business owner on every
  write and crew photos land in the right account. The queue writes through
  `sdk.entities.JobPhoto.create` like everything else and inherits this for free.
- **The `<user_id>/<uuid>-<name>` key format.** The first segment is what the
  storage policies match on; the UUID is what makes public-read acceptable. Both
  stay.
- **`uploadFile()` returning `{success:false}` instead of throwing.** The docblock
  explains why (a throw aborts a whole settings save over one image), and other
  call sites depend on it. The queue will check `success` properly, which is what
  the modal should have been doing all along.
- **`PhotoSelector.jsx` and the invoice attachment flow.** It reads
  `thumbnail_url || photo_url` and is unaffected — it gets faster for free once
  thumbnails are real.
- **`ShareAlbumModal` / `SharedPhotos`.** Broken already (§1.3); fixing them is a
  separate decision. Phase 1 doesn't make them worse.

### Change

- **`uploadFile()` gains two optional parameters**, backwards-compatibly:

  ```js
  uploadFile({ file, path, upsert })   // path/upsert both optional
  ```

  Without them, behaviour is byte-for-byte what it is today — the four other call
  sites are untouched. The queue passes an explicit `path` (so a retry targets
  the same object) and `upsert: true` (so it overwrites rather than failing with
  "already exists"). This is the one change that makes exactly-once possible, and
  it is additive.

- **`PhotoUploadModal`'s upload loop** is replaced entirely — that's the substance
  of the work.

- **EXIF must be read before compression, in that order.** Canvas re-encoding
  produces a bitmap with no metadata at all, so reading EXIF from the output is
  reading from something that no longer has any. This ordering constraint is the
  single easiest thing to get wrong here, and it fails silently — every photo
  just quietly gets upload-time instead of capture-time.

---

## 6. The PWA ceiling — honestly

You asked me not to pretend. Here's the real boundary.

**What a durable queue genuinely buys you**

- Survives closing the dialog, navigating away, or a full reload.
- Survives a tab crash or the browser being killed — the bytes are in IndexedDB,
  already compressed.
- Resumes automatically on next visit, on reconnect, and on tab refocus.
- Never duplicates, because of the idempotency scheme in §2 Step 4.

**What it cannot do**

- **Upload while the app is backgrounded.** iOS suspends JavaScript in a
  backgrounded tab within seconds. Lock the phone mid-batch and uploads stop
  until the user returns. This is the big one, and it's the platform, not the
  implementation.
- **Background Sync doesn't rescue this.** The `sync` event is Chromium-only —
  WebKit has not implemented it, and Safari/iOS is the platform contractors are
  most likely to be on. Adding a service worker would help Android and do nothing
  for iPhone.
- There's no service worker at all today (§1.2), so any of this would be new
  infrastructure with its own caching and update-lifecycle risks.

**What I'd do instead**

- **Screen Wake Lock** during an active batch (iOS 16.4+), so the screen doesn't
  sleep mid-upload while the phone is in the user's hand.
- **`beforeunload` warning** while items are pending.
- **Honest UI**: "12 of 20 uploaded — keep this screen open", not a spinner that
  implies work continues after they walk away.
- **Resume prompt on return**: "8 photos still to upload", with a Resume button.

The realistic promise is *"nothing is ever lost, and it picks up where it left
off"* — not *"it uploads in the background"*. I'd write the UI copy to say the
first thing.

---

## 7. The risk I'm least sure about

**iOS Safari killing the tab on memory pressure during decode.**

Decoding a 12 MP HEIC/JPEG to an RGBA bitmap costs roughly 48 MB of memory
(`4032 × 3024 × 4` bytes) — the *decoded* size, which has nothing to do with the
4–8 MB file. At concurrency 3 that's ~150 MB of live bitmaps, plus canvases, plus
whatever React is holding. iOS Safari's per-tab budget is not documented and it
does not throw a catchable error when exceeded — **the tab reloads.**

The acceptance test — 20 phone photos, throttled, mid-batch reload — is close
enough to that ceiling that I can't predict the outcome. The bitter irony is that
a tab kill would look exactly like a successful test of the reload path.

I can't resolve this from here: I can measure on desktop Chrome, but the limit I
care about only exists on a physical iPhone, and headless Chrome's memory
behaviour tells us nothing about WebKit's.

**How I'd de-risk it**

- Decode strictly **serially** (concurrency 1 for the decode stage), even though
  *uploads* run at 3. Compression and upload are separate stages with separate
  concurrency; only the memory-hungry one is serialised.
- `bitmap.close()` immediately after the last draw, and set canvas dimensions to
  0 when done — both release memory that GC otherwise reclaims lazily.
- Never hold more than one original `File` decoded at a time; keep the rest as
  file handles, which cost nothing until read.
- Cap the longest edge at 1600 px, so the *output* bitmap is ~10 MB rather than
  48 MB.
- A batch-size soft warning above ~30 photos.

Even with all of that I'd want one real-device pass before calling the acceptance
criterion met. If you have an iPhone to test on, that's the single most valuable
thing you could contribute to Phase 1.

**Second-order risk, much smaller**: HEIC files that reach us undecodable —
possible on desktop Safari and some Android file managers, where the browser
can't decode HEIC and `createImageBitmap` rejects. The bucket allowlist also
includes `image/heic` but **not** `image/heif`, which iOS uses for some files, so
those would be rejected at the storage layer with a confusing error. My
inclination is to detect both cases and show a clear message ("iPhone HEIC photos
aren't supported here yet — change Settings → Camera → Formats to Most
Compatible") rather than add a 1 MB decoder. Worth a decision, not worth a
dependency.

---

## 8. Phases 2–4

Sketched only, to show where Phase 1's seams need to be.

**Phase 2 — field capture.** Fullscreen `getUserMedia` capture with rapid
multi-shot, feeding the *same* queue from Phase 1 — which is why the queue is a
standalone module rather than modal state. Reverse geocoding needs a provider
decision (Nominatim's usage policy effectively rules it out for commercial use;
Mapbox and Google both cost per lookup) — that's a question for you, and it's the
same shape as the existing per-lookup-cost reasoning that put `material_assistant`
at Professional. The burned-in stamp is a second canvas pass on the full-size
blob, applied *before* upload and preserving the unstamped original.

**Phase 3 — collaboration.** New `PhotoComment` table. Annotations stored as
**JSON vector data, not flattened pixels** — that's what "non-destructive"
requires, and it means the original blob is never rewritten. Both tables get the
`JobPhoto` policy verbatim:

```sql
create policy "PhotoComment access" on public."PhotoComment"
  for all to authenticated
  using      (user_id in (select accessible_owner_ids(auth.uid())) and has_app_access(auth.uid()))
  with check (user_id in (select accessible_owner_ids(auth.uid())) and has_app_access(auth.uid()));
```

Annotation gets a new `FEATURE_MINIMUM_PLAN` key (`photo_annotation`), most likely
at `professional` alongside the other crew tooling.

**Phase 4 — output.** Timeline and cross-job search are read-side work over
`taken_date` and `tags` — both will want indexes by then, which is a schema
conversation. The PDF report needs no new dependency: `@react-pdf/renderer` is
already here and already renders invoices. `photo_report` and `photo_checklists`
become feature keys.

**A note on the public bucket.** Everything above assumes photos are "unguessable
but public". Once photos carry a burned-in street address and timestamp
(Phase 2), the sensitivity goes up meaningfully — that's a residential address
tied to a date. If that bothers you, the migration is a private bucket plus
signed URLs, and the `photo_path` column proposed in §3 is what makes it a
same-day change instead of a data-recovery exercise. That's the main reason I
want that column now rather than later.

---

## 9. What I need from you

1. **`exifr`** — approve? (and `idb`, or shall I hand-roll it?)
2. **`browser-image-compression`** — accept my argument against, or overrule me?
3. **The four additive columns in §3** — approve, or Phase 1 with none?
4. **The share-link breakage (§1.3)** — separate task, or fold into this?
5. **An iPhone for one real-device pass (§7)** — do you have one?

Stopping here as instructed.
