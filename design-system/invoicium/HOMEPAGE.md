# Invoicium Design System — extracted from `src/pages/Home.jsx`

Home.jsx is the source of truth. Everything below was read out of the homepage,
not invented. Codified in `src/components/marketing/*` and the `Button` variants.

## 1. Color

| Role | Token | Notes |
|---|---|---|
| Page ground | `bg-white` | default section tone |
| Alt section ground | `bg-sky-50` | every other section, banded |
| Inverted section | `bg-slate-900` | final CTA / footer only |
| Deep footer | `bg-slate-950` | footer only |
| Primary brand | `bg-sky-700` / `text-sky-700` | all primary CTAs, eyebrows, accent headline half |
| Primary on dark | `bg-sky-500 text-slate-900` | CTA inside `bg-slate-900` sections |
| Accent / success | `emerald-500/600` | checkmarks, "paid", trust ticks — never a primary CTA |
| Heading text | `text-slate-900` | |
| Body text | `text-slate-600` | |
| Muted / meta | `text-slate-500`, `text-slate-400` | |
| Body on dark | `text-slate-300` | |
| Border | `border-slate-200` | `border-slate-100` for internal dividers |
| Hover border | `hover:border-sky-300` | cards |
| Warning / negative | `amber-*`, `red-*` on `-50/-200` pairs | stat callouts |

Neutral scale is **slate** everywhere. No `gray-*`, no purple/violet/indigo. No gradients.

## 2. Typography

- Family: **Inter** (`@import` in `index.css`), fallback `ui-sans-serif, system-ui`.
- `h1` — `text-[clamp(3.5rem,10vw,7rem)] font-black leading-[0.88] tracking-tight`
  (sub-pages scale down to `clamp(2.5rem,7vw,4.5rem)` / `leading-[0.9]`)
- `h2` — `text-3xl sm:text-5xl font-black leading-tight`
- `h3` — `text-xl` … `text-2xl sm:text-3xl font-black`
- Eyebrow — `text-sky-700 font-bold text-sm uppercase tracking-widest mb-4`
- Lead paragraph — `text-lg sm:text-xl text-slate-600 leading-relaxed`
- Body — `text-slate-600 text-sm`/`text-base leading-relaxed`
- Footer column head — `font-bold text-xs uppercase tracking-widest`

Headings are **`font-black`**, never `font-bold`. That is the single most
recognisable homepage signature.

## 3. Spacing & layout

- Section padding — `py-20 sm:py-32` (major), `py-16 sm:py-24` (minor)
- Container — `max-w-7xl mx-auto px-4 sm:px-6 lg:px-8`
  (narrower variants: `max-w-5xl` steps, `max-w-4xl`/`max-w-3xl` prose+centered)
- Header height — `h-16`, sticky, `border-b border-slate-200`
- Card padding — `p-6` (small), `p-8 sm:p-10` (feature)
- Grid gaps — `gap-4`/`gap-5`/`gap-6`; hero split `grid lg:grid-cols-[1fr_auto] gap-10 lg:gap-20`

## 4. Components

- **Primary button** — `bg-sky-700 text-white h-14 px-8 rounded-2xl font-black shadow-2xl shadow-sky-600/25 hover:scale-[1.02] active:scale-[0.98] transition-all`
- **Primary on dark** — same but `bg-sky-500 text-slate-900 h-16 px-14 shadow-sky-500/30`
- **Secondary button** — `h-14 px-8 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900 font-black transition-colors`
- **Nav button** — `h-10 px-5 rounded-lg … text-sm font-semibold`
- **Card** — `bg-white rounded-2xl p-6 border border-slate-200 hover:border-sky-300 shadow-sm hover:shadow-md transition-all`
- **Featured card** — `ring-2 ring-sky-600 shadow-2xl shadow-sky-600/15`
- **Pill / badge** — `inline-flex items-center gap-2 bg-sky-50 border border-sky-200 text-sky-700 px-4 py-2 rounded-full text-sm font-bold`
- **Icon chip** — `w-8/9/12 h-… bg-sky-100 rounded-lg|xl flex items-center justify-center flex-shrink-0`
- **Trust row** — `flex items-center gap-2 text-emerald-600 font-semibold` + `CheckCircle w-4 h-4`

## 5. Motion

- Scroll reveal — IntersectionObserver `FadeIn`, `transition-all duration-700`, `opacity-0 translate-y-8` → `opacity-100 translate-y-0`, staggered by `delay` prop (60–120ms steps)
- Card hover — `hover:-translate-y-1 duration-300`, border + shadow lift
- CTA press — `hover:scale-[1.02] active:scale-[0.98]`
- Ambient blobs — `absolute … bg-sky-300/25 rounded-full blur-[160px]` inside `pointer-events-none` wrapper
- Named keyframes local to Home: marquee, floatA/B, pulseRing, scrollInvoice, liveDot

## 6. Iconography

`lucide-react`, stroke default. Sizes: `w-3 h-3` (inline meta), `w-4 h-4` (body/trust — most common),
`w-5 h-5` (buttons/list), `w-6 h-6` (chips), `w-8 h-8` (feature chips).
Always paired with `flex-shrink-0` when inline with text.
