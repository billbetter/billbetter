import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";
import Balancer from "react-wrap-balancer";

import { cn } from "@/lib/utils";

import { Cta } from "@/components/ui/hero-02-utils/cta";
import { DashboardDemo } from "@/components/ui/hero-02-utils/dashboard-demo";

/**
 * Hero with a headline, a CTA, and a product panel over a wash image.
 *
 * Adapted from the upstream TSX component for this codebase:
 *  - JSX with JSDoc instead of TS types. components.json sets "tsx": false and
 *    eslint.config.js matches only {js,mjs,cjs,jsx}, so a .tsx file would ship
 *    unlinted.
 *  - No "use client" -- this is a Vite SPA, not the Next.js App Router.
 *  - Imports framer-motion rather than motion/react. Both packages are
 *    installed and they are the same engine, but ten files here already use
 *    framer-motion and shipping two copies of one animation runtime in the
 *    bundle to satisfy an import style is not a trade worth making.
 *
 * @typedef {Object} Hero02Props
 * @property {string} title
 * @property {string} [titleLine2]
 * @property {string} description
 * @property {string} washImage           background image URL, decorative
 * @property {"none"|"subtle"} [animation]
 * @property {import("@/components/ui/hero-02-utils/cta").CtaProps} primaryCTA
 * @property {"standard"|"compact"} [variant]
 * @property {React.ReactNode} [media]    replaces the default DashboardDemo
 */

const variantStyles = {
  standard: {
    section: "py-20 sm:py-28",
    title: "text-3xl sm:text-4xl md:text-5xl",
    description: "max-w-md text-sm sm:text-base",
    header: "gap-5",
    content: "gap-14 sm:gap-20",
  },
  compact: {
    section: "py-14 sm:py-20",
    title: "text-2xl sm:text-3xl md:text-4xl",
    description: "max-w-sm text-sm",
    header: "gap-4",
    content: "gap-10 sm:gap-14",
  },
};

const container = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1, delayChildren: 0.05 } },
};

const item = {
  hidden: { opacity: 0, y: 12, filter: "blur(6px)" },
  visible: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] },
  },
};

const mediaItem = {
  hidden: { opacity: 0, y: 24, filter: "blur(8px)" },
  visible: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] },
  },
};

/**
 * Wraps children in a motion element only when animating.
 *
 * A plain div when inactive rather than a motion div with empty variants: it
 * keeps a reduced-motion render free of the will-change and transform layers
 * framer-motion attaches, which is the point of honouring the setting.
 *
 * @param {{ active: boolean, variants?: any, className?: string,
 *           children: React.ReactNode }} props
 */
function Reveal({ active, variants, className, children }) {
  if (!active) return <div className={className}>{children}</div>;

  return (
    <motion.div variants={variants ?? item} className={className}>
      {children}
    </motion.div>
  );
}

/** @param {Hero02Props} props */
export function Hero02({
  title,
  titleLine2,
  description,
  washImage,
  animation = "none",
  primaryCTA,
  variant = "standard",
  media,
}) {
  const reduce = useReducedMotion();
  const animate = animation === "subtle" && !reduce;
  const vs = variantStyles[variant] || variantStyles.standard;

  const titleElement = title && (
    <h1
      className={cn(
        "text-balance font-serif font-normal tracking-tight text-foreground",
        vs.title,
      )}
    >
      <Balancer>{title}</Balancer>
      {titleLine2 && (
        <>
          <br />
          <Balancer>{titleLine2}</Balancer>
        </>
      )}
    </h1>
  );

  const descriptionElement = description && (
    <p className={cn("text-muted-foreground", vs.description)}>
      <Balancer>{description}</Balancer>
    </p>
  );

  const mediaElement = (
    <div className="relative w-full overflow-hidden rounded-md outline outline-black/10 dark:outline-white/10">
      {washImage && (
        <img
          src={washImage}
          alt=""
          aria-hidden
          className="absolute inset-0 size-full object-cover"
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-b from-background/30 via-background/10 to-background/40" />
      <div className="relative flex items-center justify-center px-6 py-12 sm:px-12 sm:py-16">
        {media ?? <DashboardDemo />}
      </div>
    </div>
  );

  return (
    <section className="relative isolate w-full overflow-hidden bg-background">
      <motion.div
        className={cn(
          "relative z-10 mx-auto flex max-w-6xl flex-col px-6",
          vs.section,
          vs.content,
        )}
        variants={animate ? container : undefined}
        initial={animate ? "hidden" : false}
        whileInView={animate ? "visible" : undefined}
        viewport={{ once: true, margin: "-80px" }}
      >
        <Reveal
          active={animate}
          className={cn("flex max-w-2xl flex-col items-start", vs.header)}
        >
          {titleElement}
          {descriptionElement}
          <Cta cta={primaryCTA} />
        </Reveal>

        <Reveal active={animate} variants={mediaItem} className="w-full">
          {mediaElement}
        </Reveal>
      </motion.div>
    </section>
  );
}

export default Hero02;
