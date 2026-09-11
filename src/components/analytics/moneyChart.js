import { token } from "@/lib/tokens";

/* ─── Revenue chart axes ─────────────────────────────────────────
   Shared by the revenue-trend and paid/pending charts. Props, not a wrapper
   component: recharts finds its axes by element type among the chart's
   direct children, so <XAxis> has to stay in place. Built at render time
   because token() reads the live CSS variable, and the colours must follow
   the theme. */
export const moneyChartGrid = () => ({
  strokeDasharray: "3 3",
  stroke: token("ink-100"),
  vertical: false,
});
export const moneyChartAxis = () => ({
  tick: { fontSize: 11, fill: token("ink-400"), fontWeight: 500 },
  axisLine: false,
  tickLine: false,
});
export const formatMoneyTick = (v) => `$${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`;
