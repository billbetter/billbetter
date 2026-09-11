# The quote builder's "upload a photo" never reads the photo

**Where:** `src/pages/CreateQuote.jsx`, the module-level `CameraAnalyzer` (line 56), rendered at line 1002.

**What happens:** the card invites the contractor to "Describe the job or upload a photo". The photo is only ever turned into a preview URL. On Generate, the component waits a fixed 1.5 seconds to look busy, then hands back `{ description, materials: [], laborHours: 0, notes: description }`. The image is never uploaded and never sent to the model. The Generate button is also disabled when there's no text, so a photo on its own can't be submitted at all.

The invoice builder had the same fake analyzer and it was fixed there. `src/components/invoice/create/CameraAnalyzer.jsx` uploads the file, checks the upload result, validates the type with `unscannableReason`, and passes the file URL to the AI prompt. Its own comment describes the old behaviour: "The photo used to be decoration."

**Suggested fix:** give the quote builder the invoice version's behaviour. The two components are near-identical apart from this. Once they match, make them one shared component, with the copy ("Generate Quote Items" / "Generate Invoice Items") and the callback name passed in as props.

**Found:** 2026-09-10, while splitting CreateInvoice.jsx. Not merged or fixed there, because merging would change what the quote builder does.

---

**Fixed:** 2026-09-11 in `4e1aba0` (Fix #08: the quote builder now actually reads the photo). One shared CameraAnalyzer; the quote builder uploads and reads the photo.
