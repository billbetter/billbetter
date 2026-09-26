import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

/**
 * AnimatedTextCycle -- one word in a sentence that keeps changing, the box
 * around it springing to each word's width. From 21st.dev's
 * "animated-text-cycle", adapted for this codebase:
 *
 *  - JSX, not TSX (components.json "tsx": false; eslint lints {js,jsx}).
 *  - Spans throughout, so it is valid inside a heading -- the original's
 *    measuring <div> is not allowed in an <h2>.
 *  - The measuring copy sits in a relative wrapper. Loose `absolute`, it was
 *    positioned against whatever ancestor happened to be positioned and could
 *    widen the page.
 *  - No forced `font-bold`: the words take the weight of the text they sit
 *    in, and the measurement uses that same weight, so the width is right.
 *  - Re-measures when the web font finishes loading and on resize. The first
 *    measurement usually happens in the fallback font, and the box then
 *    clipped or gapped around every word until the next change.
 *  - Reduced motion: no cycling at all, just the first word.
 *  - Screen readers get the first word, once. The cycling copy is hidden from
 *    them; announcing a new word every few seconds would be noise.
 *
 * @param {{ words: string[], interval?: number, className?: string }} props
 */
export default function AnimatedTextCycle({ words, interval = 5000, className = "" }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [width, setWidth] = useState("auto");
  const measureRef = useRef(null);
  const reduceMotion = useReducedMotion();

  useLayoutEffect(() => {
    const measure = () => {
      const el = measureRef.current?.children[currentIndex];
      if (el) setWidth(`${el.getBoundingClientRect().width}px`);
    };
    measure();
    let cancelled = false;
    document.fonts?.ready.then(() => !cancelled && measure());
    window.addEventListener("resize", measure);
    return () => {
      cancelled = true;
      window.removeEventListener("resize", measure);
    };
  }, [currentIndex, words]);

  useEffect(() => {
    if (reduceMotion || words.length < 2) return undefined;
    const timer = setInterval(() => {
      setCurrentIndex((i) => (i + 1) % words.length);
    }, interval);
    return () => clearInterval(timer);
  }, [interval, words.length, reduceMotion]);

  const variants = {
    hidden: { y: -20, opacity: 0, filter: "blur(8px)" },
    visible: {
      y: 0,
      opacity: 1,
      filter: "blur(0px)",
      transition: { duration: 0.4, ease: "easeOut" },
    },
    exit: {
      y: 20,
      opacity: 0,
      filter: "blur(8px)",
      transition: { duration: 0.3, ease: "easeIn" },
    },
  };

  return (
    <span className="relative inline-block">
      <span className="sr-only">{words[0]}</span>

      {/* Every word, invisible, to read each one's width from. */}
      <span
        ref={measureRef}
        aria-hidden="true"
        className="pointer-events-none invisible absolute left-0 top-0 whitespace-nowrap"
      >
        {words.map((word, i) => (
          <span key={i} className={`inline-block ${className}`}>
            {word}
          </span>
        ))}
      </span>

      <motion.span
        aria-hidden="true"
        className="relative inline-block"
        animate={{
          width,
          transition: { type: "spring", stiffness: 150, damping: 15, mass: 1.2 },
        }}
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={currentIndex}
            className={`inline-block ${className}`}
            variants={variants}
            initial="hidden"
            animate="visible"
            exit="exit"
            style={{ whiteSpace: "nowrap" }}
          >
            {words[currentIndex]}
          </motion.span>
        </AnimatePresence>
      </motion.span>
    </span>
  );
}
