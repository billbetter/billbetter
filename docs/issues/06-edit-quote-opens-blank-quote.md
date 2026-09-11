# "Edit Quote" from the quote list opens a blank quote

**Where:** `src/pages/Quotes.jsx`, `handleEdit`, reached from the phone layout's per-quote actions sheet ("Edit Quote"):

```js
navigate(createPageUrl(`CreateQuote?id=${quoteId}`));
```

**What happens:** `CreateQuote` reads the quote to edit from `?edit=` (`src/pages/CreateQuote.jsx:379`, `urlParams.get("edit")`) and ignores `?id=`. So the action lands on an empty New Quote form, not the quote the contractor tapped. If they fill it in and save, they get a second quote instead of an edited one.

**Related:** `CreateInvoice` also supports `?edit=` (three reads of it), but nothing in the app links there, so invoice edit mode is unreachable from the UI.

**Suggested fix:** send `?edit=${quoteId}` from `handleEdit`. Then decide whether invoices should get an Edit entry point too.

**Found:** 2026-09-10, while splitting Quotes.jsx; not fixed there because it changes behaviour.
