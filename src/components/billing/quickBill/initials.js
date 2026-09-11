/** "Dana Reyes" -> "DR", for the little avatar circles. "?" when there is no name. */
export const initials = (name = "") =>
  name
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase() || "?";
