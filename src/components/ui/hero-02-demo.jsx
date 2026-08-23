import React from "react";
import { Hero02 } from "@/components/ui/hero-02";

/**
 * The upstream demo, kept as-is so the component can be viewed in isolation.
 *
 * The wash image is a remote Unsplash URL, which is fine here but is the one
 * thing to change before this goes on a real page: it is an uncached
 * third-party request on the largest element above the fold, so it lands
 * directly on LCP. Anything in public/ would do.
 */
const values = {
  title: "Every metric that matters,",
  titleLine2: "in one clear view.",
  description:
    "Track revenue, users, and activity in real time, with no setup and no spreadsheets.",
  washImage:
    "https://images.unsplash.com/photo-1578301978018-3005759f48f7?q=80&w=1144&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
  animation: "subtle",
  primaryCTA: {
    ctaEnabled: true,
    text: "Start free",
    link: "",
    variant: "default",
    size: "default",
  },
};

export default function Hero02Demo() {
  return <Hero02 {...values} />;
}
