import React from "react";

/**
 * The mark. Module level on purpose: it used to be declared inside Layout,
 * which makes it a different component type on every render, so React threw
 * the <img> away and rebuilt it each time.
 */
const Logo = ({ className = "w-8 h-8", circular = false }) => {
  return (
    <img
      src="/logo-mark.png"
      alt="Invoicium Logo"
      className={`${className} object-contain ${circular ? "rounded-full" : ""}`}
    />
  );
};

export default Logo;
