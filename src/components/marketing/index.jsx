import React, { useEffect, useRef, useState } from "react";
import { CheckCircle } from "lucide-react";

/**
 * Shared marketing primitives extracted from src/pages/Home.jsx.
 * See design-system/invoicium/HOMEPAGE.md. Home.jsx remains the source of
 * truth — these components mirror it so other pages stop duplicating classes.
 */

/* ── Scroll reveal (same observer + timings as Home.jsx) ─────────────── */
export const useInView = (options = {}) => {
  const [isInView, setIsInView] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1, ...options },
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);
  return [ref, isInView];
};

export const FadeIn = ({ children, delay = 0, className = "" }) => {
  const [ref, isInView] = useInView();
  return (
    <div
      ref={ref}
      className={`transition-all duration-700 ${className} ${
        isInView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
      }`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
};

/* ── Ambient blur field behind heroes / banded sections ──────────────── */
export const Ambient = ({ tone = "sky", position = "top" }) => (
  <div className="absolute inset-0 pointer-events-none overflow-hidden">
    {position === "top" ? (
      <div
        className={`absolute -top-40 left-1/2 -translate-x-1/2 w-[900px] h-[600px] rounded-full blur-[160px] ${
          tone === "emerald" ? "bg-success-200/30" : "bg-brand-300/25"
        }`}
      />
    ) : (
      <div
        className={`absolute bottom-0 left-1/2 -translate-x-1/2 w-[800px] h-[300px] rounded-full blur-[100px] ${
          tone === "emerald" ? "bg-success-500/10" : "bg-brand-200/25"
        }`}
      />
    )}
  </div>
);

/* ── Section shell: tone + vertical rhythm + container ───────────────── */
const SECTION_TONES = {
  white: "bg-surface",
  sky: "bg-brand-50 border-y border-line",
  dark: "bg-surface-inverted",
};

const SECTION_PAD = {
  lg: "py-20 sm:py-32",
  md: "py-16 sm:py-24",
  sm: "py-12 sm:py-16",
};

const CONTAINERS = {
  "7xl": "max-w-7xl",
  "5xl": "max-w-5xl",
  "4xl": "max-w-4xl",
  "3xl": "max-w-3xl",
};

export const Section = ({
  tone = "white",
  pad = "lg",
  width = "7xl",
  ambient = null,
  className = "",
  containerClassName = "",
  children,
}) => (
  <section
    className={`relative overflow-hidden ${SECTION_TONES[tone]} ${SECTION_PAD[pad]} ${className}`}
  >
    {ambient && (
      <Ambient tone={ambient} position={tone === "dark" ? "bottom" : "top"} />
    )}
    <div
      className={`relative ${CONTAINERS[width]} mx-auto px-4 sm:px-6 lg:px-8 ${containerClassName}`}
    >
      {children}
    </div>
  </section>
);

/* ── Pill badge above a headline ─────────────────────────────────────── */
export const Pill = ({
  icon: Icon,
  tone = "sky",
  className = "",
  children,
}) => {
  const tones = {
    sky: "bg-brand-50 border-brand-200 text-brand-700",
    emerald: "bg-success-50 border-success-200 text-success-700",
  };
  return (
    <div
      className={`inline-flex items-center gap-2 border px-4 py-2 rounded-full text-sm font-bold ${tones[tone]} ${className}`}
    >
      {Icon && <Icon className="w-4 h-4 flex-shrink-0" />}
      {children}
    </div>
  );
};

/* ── Page hero: the homepage headline treatment, scaled for sub-pages ── */
export const PageHero = ({
  eyebrow,
  eyebrowIcon,
  eyebrowTone = "sky",
  title,
  accent,
  subtitle,
  children,
  align = "center",
  className = "",
}) => (
  <section
    className={`relative overflow-hidden bg-surface border-b border-line py-16 sm:py-24 ${className}`}
  >
    <Ambient />
    <div
      className={`relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 ${
        align === "center" ? "text-center" : ""
      }`}
    >
      {eyebrow && (
        <Pill icon={eyebrowIcon} tone={eyebrowTone} className="mb-8">
          {eyebrow}
        </Pill>
      )}
      <h1 className="text-[clamp(2.5rem,7vw,4.5rem)] font-black text-content leading-[0.9] tracking-tight mb-6 dark:text-content-inverted">
        {title}
        {accent && (
          <>
            <br />
            <span className="text-brand-700">{accent}</span>
          </>
        )}
      </h1>
      {subtitle && (
        <p
          className={`text-lg sm:text-xl text-content-body leading-relaxed ${
            align === "center" ? "max-w-2xl mx-auto" : "max-w-2xl"
          }`}
        >
          {subtitle}
        </p>
      )}
      {children}
    </div>
  </section>
);

/* ── Centered eyebrow + h2 + lead, used above every section grid ─────── */
export const SectionHeading = ({
  eyebrow,
  eyebrowTone = "sky",
  title,
  accent,
  subtitle,
  invert = false,
  className = "",
}) => (
  <div className={`text-center ${className}`}>
    {eyebrow && (
      <p
        className={`font-bold text-sm uppercase tracking-widest mb-4 ${
          eyebrowTone === "emerald" ? "text-success-600" : "text-brand-700"
        }`}
      >
        {eyebrow}
      </p>
    )}
    <h2
      className={`text-3xl sm:text-5xl font-black leading-tight ${
        invert ? "text-content-inverted" : "text-content"
      } ${subtitle ? "mb-4" : ""}`}
    >
      {title}
      {accent && (
        <>
          <br />
          <span className={invert ? "text-brand-400" : "text-brand-700"}>
            {accent}
          </span>
        </>
      )}
    </h2>
    {subtitle && (
      <p
        className={`text-lg max-w-xl mx-auto leading-relaxed ${
          invert ? "text-ink-300" : "text-content-body"
        }`}
      >
        {subtitle}
      </p>
    )}
  </div>
);

/* ── Surface card: the homepage testimonial/plan card ────────────────── */
export const SurfaceCard = ({
  featured = false,
  hoverLift = true,
  className = "",
  children,
  ...props
}) => (
  <div
    className={`bg-surface rounded-2xl transition-all duration-300 ${
      featured
        ? "ring-2 ring-brand-600 shadow-2xl shadow-brand-600/15"
        : "border border-line hover:border-brand-300 shadow-sm hover:shadow-md"
    } ${hoverLift ? "hover:-translate-y-1" : ""} ${className}`}
    {...props}
  >
    {children}
  </div>
);

/* ── Icon chip ───────────────────────────────────────────────────────── */
const CHIP_SIZES = {
  sm: "w-8 h-8 rounded-lg",
  md: "w-10 h-10 rounded-xl",
  lg: "w-12 h-12 rounded-xl",
  xl: "w-16 h-16 rounded-2xl",
};
const CHIP_TONES = {
  sky: "bg-brand-100 text-brand-700",
  emerald: "bg-success-100 text-success-600",
  amber: "bg-warning-100 text-warning-600",
  slate: "bg-ink-100 text-content-body",
};
const CHIP_ICON = {
  sm: "w-4 h-4",
  md: "w-5 h-5",
  lg: "w-6 h-6",
  xl: "w-8 h-8",
};

export const IconChip = ({
  icon: Icon,
  tone = "sky",
  size = "md",
  className = "",
}) => (
  <div
    className={`${CHIP_SIZES[size]} ${CHIP_TONES[tone]} flex items-center justify-center flex-shrink-0 ${className}`}
  >
    <Icon className={CHIP_ICON[size]} />
  </div>
);

/* ── Emerald trust ticks under a CTA ─────────────────────────────────── */
export const TrustRow = ({ items, className = "" }) => (
  <div className={`flex flex-wrap gap-5 text-sm ${className}`}>
    {items.map((t) => (
      <div
        key={t}
        className="flex items-center gap-2 text-success-600 font-semibold"
      >
        <CheckCircle className="w-4 h-4 flex-shrink-0" /> {t}
      </div>
    ))}
  </div>
);
