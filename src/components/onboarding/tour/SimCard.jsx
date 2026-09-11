import React from "react";

/** The dark card a simulated screen sits in. */
const SimCard = ({ children }) => (
  <div className="rounded-xl border border-ink-600 bg-ink-800 p-3.5">
    {children}
  </div>
);

export default SimCard;
