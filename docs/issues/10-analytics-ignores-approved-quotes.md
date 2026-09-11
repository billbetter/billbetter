# Analytics doesn't count "approved" quotes as won

**Where:**
- `src/components/analytics/overview/QuoteFunnelCard.jsx` (`quoteFunnel`)
- `src/components/analytics/insights/RecommendationsCard.jsx` (`recommendedActions`)

Both lived inline in `src/pages/Analytics.jsx` until the 2026-09 refactor.

**What happens:** everywhere else in the app a quote the client accepts has status `"approved"`. That's what `approve-quote` writes, what the quote list filters on, and what `QuoteDetail` displays. Analytics instead counts a quote as won only if its status is `"accepted"` or `"converted"`. The consequences:
- The Quote Funnel's **Conversion Rate** leaves out every approved quote that hasn't been converted to an invoice. The "Accepted" stage undercounts the same way.
- Approved quotes don't show up in any funnel stage.
- **Recommended Actions** counts approved quotes as "need follow-up", so it asks the contractor to chase clients who have already said yes.

With the Analytics snapshot fixture (2 approved, 2 sent, 1 declined, 1 converted, 1 draft) the funnel shows 14% conversion. Counting approved quotes it would show 43%.

**Suggested fix:** treat `"approved"` as won in both places. `"accepted"` can stay for safety, the way QuoteDetail reads `"rejected"` alongside `"declined"`. Better still, share one list of won/declined statuses between Analytics, the quote list and QuoteDetail.

**Found:** 2026-09-10, while splitting Analytics.jsx. Not fixed there because it changes the numbers shown.

---

**Fixed:** 2026-09-11 in `067aa38` (Fix #10: Analytics counts "approved" quotes as won). "approved" counts as won, from one shared list of statuses in `src/lib/quoteStatus.js`.
