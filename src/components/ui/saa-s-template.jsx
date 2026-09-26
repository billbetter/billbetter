import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";

/**
 * The hero of 21st.dev's "SaaS template" landing kit, ported to this project.
 *
 * Converted from TSX to JSX (components.json -> "tsx": false), its inline SVGs
 * swapped for lucide-react, its colours mapped onto the design tokens, and its
 * Poppins face scoped to the section -- the original set `* { font-family }`
 * from a <style> tag, which would have re-fonted the whole page. The kit's own
 * navigation bar is not ported: the marketing layout already has a header.
 *
 * Content is passed in, so the homepage supplies the words and the actions:
 *   announcement  { text, linkText, to }     the pill above the heading; `to`
 *                                             is an in-app route
 *   title         node                        gradient headline
 *   description   node
 *   children      the call to action
 *   footer        node under the call to action
 *   preview       node                        the product shot, over a glow
 *   after         node                        closes the section, under it
 */

export const heroButtonClasses = {
  base: "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-400 focus-visible:ring-offset-2 focus-visible:ring-offset-ink-950 disabled:pointer-events-none disabled:opacity-50",
  // The kit's "gradient" button: white fading down, dark text.
  gradient:
    "bg-gradient-to-b from-white via-white/95 to-white/60 text-ink-950 hover:scale-105 active:scale-95",
  ghost: "text-content-inverted hover:bg-ink-800/50",
  lg: "h-12 px-8 text-base",
  sm: "h-10 px-5 text-sm",
};

export function SaasHero({ announcement, title, description, children, footer, preview, after }) {
  return (
    <section
      className="saas-hero relative flex min-h-[calc(100vh-64px)] flex-col items-center justify-start overflow-hidden bg-ink-950 px-6 pb-10 pt-16 text-content-inverted md:pt-24"
      style={{ animation: "saasHeroFadeIn 0.6s ease-out" }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap');

        .saas-hero, .saas-hero :where(*) {
          font-family: 'Poppins', ui-sans-serif, system-ui, sans-serif;
        }

        @keyframes saasHeroFadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @media (prefers-reduced-motion: reduce) {
          .saas-hero { animation: none !important; }
        }
      `}</style>

      {announcement && (
        <aside className="mb-8 inline-flex max-w-full flex-wrap items-center justify-center gap-2 rounded-full border border-ink-700 bg-ink-800/50 px-4 py-2 backdrop-blur-sm">
          <span className="whitespace-nowrap text-center text-xs text-ink-400">{announcement.text}</span>
          {announcement.to && (
            <Link
              to={announcement.to}
              className="flex items-center gap-1 whitespace-nowrap text-xs text-ink-400 transition-all hover:text-content-inverted active:scale-95"
            >
              {announcement.linkText}
              <ArrowRight className="size-3" />
            </Link>
          )}
        </aside>
      )}

      <h1
        className="mb-6 max-w-3xl bg-gradient-to-b from-white via-white to-white/60 bg-clip-text px-2 text-center text-4xl font-medium leading-tight text-transparent md:text-5xl lg:text-6xl"
        style={{ letterSpacing: "-0.05em" }}
      >
        {title}
      </h1>

      {description && (
        <p className="mb-10 max-w-2xl px-2 text-center text-sm text-ink-400 md:text-base">{description}</p>
      )}

      <div className="relative z-10 mb-6 flex w-full flex-col items-center">{children}</div>

      {footer && <div className="relative z-10 mb-16 flex w-full justify-center">{footer}</div>}

      {preview && (
        <div className="relative w-full max-w-5xl pb-10">
          {/* The kit shipped this glow as a hosted PNG; drawn in CSS here so
              the page carries no third-party image. */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute left-1/2 top-[-18%] z-0 h-[70%] w-[90%] -translate-x-1/2 rounded-[100%] opacity-70 blur-3xl"
            style={{
              background:
                "radial-gradient(ellipse at center, rgb(var(--brand-500) / 0.45), rgb(var(--brand-700) / 0.15) 45%, transparent 70%)",
            }}
          />
          <div className="relative z-10">{preview}</div>
        </div>
      )}

      {after && <div className="relative z-10 w-full max-w-5xl">{after}</div>}
    </section>
  );
}

export default SaasHero;
