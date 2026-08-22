import React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Star } from "lucide-react";

/**
 * Vertically scrolling testimonial columns.
 *
 * Adapted from the upstream TSX component for this codebase:
 *  - JSX, not TSX (components.json sets "tsx": false, and there is no
 *    tsconfig -- a .tsx file would not compile here).
 *  - No "use client" ("rsc": false; this is a Vite SPA, not the Next.js App
 *    Router, so the directive is meaningless).
 *  - Raw neutral and dark: utilities are replaced with the app's semantic
 *    design tokens (surface / content / line / brand) so the section matches
 *    the rest of the marketing pages instead of shipping a second palette.
 *  - The upstream default export was a demo shell (full-screen wrapper plus a
 *    dark-mode toggle button). Theming is owned by the app, so only the
 *    marquee itself is exported; the <section>, eyebrow and heading stay in
 *    the calling page alongside its sibling sections.
 *
 * Each column renders its list twice and animates to -50%, so the second copy
 * lands exactly where the first started and the loop is seamless. The copy is
 * aria-hidden and taken out of the tab order to avoid announcing every quote
 * twice.
 */

const TestimonialCard = ({ quote, name, trade, image, stars = 5 }) => (
  <motion.li
    whileHover={{
      scale: 1.03,
      y: -8,
      transition: { type: "spring", stiffness: 400, damping: 17 },
    }}
    className="group flex w-full max-w-xs flex-col rounded-2xl border border-line bg-surface p-6 shadow-sm transition-colors hover:border-brand-300 hover:shadow-md focus-within:border-brand-300"
  >
    {stars > 0 && (
      <div className="mb-4 flex gap-1">
        {[...Array(stars)].map((_, si) => (
          <Star key={si} className="h-4 w-4 fill-current text-warning-400" />
        ))}
      </div>
    )}

    <blockquote className="flex flex-1 flex-col">
      <p className="mb-6 flex-1 text-[15px] leading-relaxed text-ink-700">
        &ldquo;{quote}&rdquo;
      </p>

      <footer className="flex items-center gap-3 border-t border-line-subtle pt-4">
        {image ? (
          <img
            src={image}
            alt=""
            width={40}
            height={40}
            loading="lazy"
            className="h-10 w-10 flex-shrink-0 rounded-full object-cover ring-2 ring-line-subtle transition-all group-hover:ring-brand-300"
          />
        ) : (
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-brand">
            <span className="text-sm font-black text-content-inverted">
              {name[0]}
            </span>
          </div>
        )}
        <div>
          <cite className="block text-sm font-bold not-italic text-content">
            {name}
          </cite>
          <span className="text-xs text-content-muted">{trade}</span>
        </div>
      </footer>
    </blockquote>
  </motion.li>
);

export const TestimonialsColumn = ({
  testimonials = [],
  duration = 15,
  className = "",
}) => {
  const reduceMotion = useReducedMotion();

  // With reduced motion the marquee would still crawl, so drop the animation
  // and the duplicate copy and render a plain, readable stack instead.
  if (reduceMotion) {
    return (
      <ul className={`m-0 flex list-none flex-col gap-6 p-0 ${className}`}>
        {testimonials.map((t, i) => (
          <TestimonialCard key={i} {...t} />
        ))}
      </ul>
    );
  }

  return (
    <div className={className}>
      <motion.ul
        animate={{ translateY: "-50%" }}
        transition={{
          duration,
          repeat: Infinity,
          ease: "linear",
          repeatType: "loop",
        }}
        className="m-0 flex list-none flex-col gap-6 p-0 pb-6"
      >
        {[0, 1].map((copy) => (
          <React.Fragment key={copy}>
            {testimonials.map((t, i) => (
              <TestimonialCard key={`${copy}-${i}`} {...t} />
            ))}
          </React.Fragment>
        ))}
      </motion.ul>
    </div>
  );
};

/**
 * Three offset columns of the same testimonials, masked top and bottom.
 * Columns two and three are hidden below md/lg so narrow screens get a single
 * readable track. Each column starts at a different testimonial and runs at a
 * different speed so the three never read as one repeated block.
 */
export const TestimonialsMarquee = ({ testimonials = [], className = "" }) => {
  if (!testimonials.length) return null;

  // Rotate the list per column rather than slicing it, so a short list still
  // fills all three columns with a different leading quote in each.
  const rotate = (n) => [...testimonials.slice(n), ...testimonials.slice(0, n)];

  return (
    <div
      role="region"
      aria-label="Customer testimonials"
      className={`flex max-h-[620px] justify-center gap-6 overflow-hidden [mask-image:linear-gradient(to_bottom,transparent,black_10%,black_90%,transparent)] ${className}`}
    >
      <TestimonialsColumn testimonials={rotate(0)} duration={15} />
      <TestimonialsColumn
        testimonials={rotate(1)}
        duration={19}
        className="hidden md:block"
      />
      <TestimonialsColumn
        testimonials={rotate(2)}
        duration={17}
        className="hidden lg:block"
      />
    </div>
  );
};

export default TestimonialsMarquee;
