import React from "react";

/** The slide's own words. */
export default function TourSlideContent({
  slide,
}) {
  return (
    <div className="text-center mb-5">
      <div className="text-5xl mb-3">{slide.image}</div>
      <h3 className="text-lg font-bold text-content-inverted mb-1.5">
        {slide.title}
      </h3>
      <p className="text-sm text-content-subtle max-w-sm mx-auto leading-relaxed">
        {slide.description}
      </p>
    </div>
  );
}
