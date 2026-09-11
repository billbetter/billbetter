# Smart Insights ignores the selected date range

**Where:** `src/components/analytics/SmartInsights.jsx` (rendered on Analytics).

**What happens:** the component receives a `dateRange` prop and used to build date-filtered copies of invoices, quotes and jobs (`filterByDateRange`), then computed every insight from the **unfiltered** arrays. The filtered copies were never read. They were removed as dead code in `30677b7` (see `git show 30677b7 -- src/components/analytics/SmartInsights.jsx`). Behaviour is unchanged: insights still ignore the range.

**Why it might be intended:** the insights compare fixed windows ("this week vs last week", "last 30 vs previous 30 days"), which arguably should not move with a custom range.

**Decision needed:** either (a) insights should respect the selected range, in which case restore the filter and use it; or (b) they shouldn't, in which case say so in the UI (e.g. "based on the last 60 days") and drop the `dateRange` prop, which is currently only a `useMemo` dependency.
