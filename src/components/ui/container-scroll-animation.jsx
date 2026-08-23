import React, { useRef } from "react";
import { useScroll, useTransform, motion, useReducedMotion } from "framer-motion";

/**
 * Scroll-driven 3D card reveal: the panel starts tilted back and flattens as it
 * scrolls into view.
 *
 * Adapted from the upstream TSX component for this codebase:
 *  - JSX with JSDoc instead of TS types. components.json sets "tsx": false and
 *    eslint.config.js matches only {js,mjs,cjs,jsx} under src/components, so a
 *    .tsx file would ship unlinted.
 *  - No "use client" -- this is a Vite SPA, not the Next.js App Router.
 *  - The upstream demo used next/image, which does not exist here; callers pass
 *    whatever they like as children.
 *  - Honours prefers-reduced-motion: the rotation and drift are what make this
 *    component, and driving them off scroll is exactly the effect that guideline
 *    exists for, so the card renders flat and static instead.
 */

/**
 * @typedef {Object} ContainerScrollProps
 * @property {React.ReactNode} titleComponent  heading rendered above the card
 * @property {React.ReactNode} children        contents of the card
 * @property {string} [className]
 */

/** @param {ContainerScrollProps} props */
export const ContainerScroll = ({ titleComponent, children, className = "" }) => {
  const containerRef = useRef(null);
  const reduceMotion = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: containerRef });

  const [isMobile, setIsMobile] = React.useState(false);

  React.useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth <= 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // The card is scaled up slightly at rest on desktop so it settles to exactly
  // 1, and scaled down on mobile where the tilt would otherwise crop it.
  const scaleRange = isMobile ? [0.7, 0.9] : [1.05, 1];

  const rotate = useTransform(scrollYProgress, [0, 1], reduceMotion ? [0, 0] : [20, 0]);
  const scale = useTransform(scrollYProgress, [0, 1], reduceMotion ? [1, 1] : scaleRange);
  const translate = useTransform(scrollYProgress, [0, 1], reduceMotion ? [0, 0] : [0, -100]);

  return (
    <div
      ref={containerRef}
      className={`relative flex h-[60rem] items-center justify-center p-2 md:h-[80rem] md:p-20 ${className}`}
    >
      {/* perspective is what turns rotateX into a tilt rather than a squash. */}
      <div className="relative w-full py-10 md:py-40" style={{ perspective: "1000px" }}>
        <Header translate={translate} titleComponent={titleComponent} />
        <Card rotate={rotate} scale={scale}>
          {children}
        </Card>
      </div>
    </div>
  );
};

/**
 * @param {{ translate: import("framer-motion").MotionValue<number>,
 *           titleComponent: React.ReactNode }} props
 */
export const Header = ({ translate, titleComponent }) => (
  <motion.div style={{ translateY: translate }} className="mx-auto max-w-5xl text-center">
    {titleComponent}
  </motion.div>
);

/**
 * @param {{ rotate: import("framer-motion").MotionValue<number>,
 *           scale: import("framer-motion").MotionValue<number>,
 *           children: React.ReactNode }} props
 */
export const Card = ({ rotate, scale, children }) => (
  <motion.div
    style={{
      rotateX: rotate,
      scale,
      boxShadow:
        "0 0 #0000004d, 0 9px 20px #0000004a, 0 37px 37px #00000042, 0 84px 50px #00000026, 0 149px 60px #0000000a, 0 233px 65px #00000003",
    }}
    className="mx-auto -mt-12 h-[30rem] w-full max-w-5xl rounded-[30px] border-4 border-[#6C6C6C] bg-[#222222] p-2 shadow-2xl md:h-[40rem] md:p-6"
  >
    <div className="h-full w-full overflow-hidden rounded-2xl bg-gray-100 dark:bg-zinc-900 md:rounded-2xl">
      {children}
    </div>
  </motion.div>
);

export default ContainerScroll;
