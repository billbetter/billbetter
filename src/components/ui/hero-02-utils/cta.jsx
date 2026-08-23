import React from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

/**
 * The hero's call to action.
 *
 * hero-02 imports this but the file was not supplied with it, so it is
 * reconstructed from the contract the hero relies on: a `CtaProps` object with
 * ctaEnabled / text / link / variant / size, rendered as a single button.
 *
 * `ctaEnabled: false` renders nothing at all rather than a disabled button --
 * the flag exists so a hero can be laid out without a CTA, and a greyed-out
 * button is not the same thing as no button.
 *
 * Routing note: the upstream component is written for Next.js, which this
 * project is not. An in-app path goes through react-router's Link so it does
 * not reload the SPA; anything external, or an anchor, falls back to <a> with
 * the usual noopener guard.
 *
 * @typedef {Object} CtaProps
 * @property {boolean} [ctaEnabled]  render the button at all (default true)
 * @property {string} text
 * @property {string} [link]         in-app path, absolute URL, or "" for none
 * @property {string} [variant]      any variant on components/ui/button
 * @property {string} [size]
 */

/** @param {{ cta?: CtaProps, className?: string }} props */
export function Cta({ cta, className }) {
  if (!cta || cta.ctaEnabled === false || !cta.text) return null;

  const { text, link, variant = "default", size = "default" } = cta;
  const button = (
    <Button variant={variant} size={size} className={className}>
      {text}
    </Button>
  );

  // An empty link is a deliberate "button that does nothing yet" -- the demo
  // ships with link: "". Wrapping that in an anchor would produce a link to the
  // current page, which reloads and loses state.
  if (!link) return button;

  const isExternal = /^(https?:)?\/\//.test(link) || link.startsWith("mailto:");
  if (isExternal) {
    return (
      <a href={link} target="_blank" rel="noopener noreferrer">
        {button}
      </a>
    );
  }

  if (link.startsWith("#")) {
    return <a href={link}>{button}</a>;
  }

  return <Link to={link}>{button}</Link>;
}

export default Cta;
