import React from "react";
import "./shiny-button.css";

/**
 * Pill CTA with an animated conic-gradient border and inner shimmer.
 *
 * Adapted from the upstream TSX component for this codebase:
 *  - JSX, not TSX (components.json sets "tsx": false, and there is no
 *    tsconfig -- a .tsx file would not compile here).
 *  - No "use client" ("rsc": false; this is a Vite SPA, not the Next.js App
 *    Router, so the directive is meaningless).
 *  - Styles live in shiny-button.css instead of `<style jsx>`; see that file.
 *
 * Extra props are forwarded so the button can still take aria-label, disabled,
 * form attributes and so on. type defaults to "button" so dropping one inside
 * a form does not submit it by accident.
 */
export function ShinyButton({
  children,
  onClick,
  className = "",
  type = "button",
  ...props
}) {
  return (
    <button
      type={type}
      className={`shiny-cta ${className}`}
      onClick={onClick}
      {...props}
    >
      <span>{children}</span>
    </button>
  );
}

export default ShinyButton;
