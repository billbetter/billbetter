import React from "react";
import { Input } from "@/components/ui/input";

export default function PhoneInput({ value, onChange, placeholder, ...props }) {
  const formatPhoneNumber = (phoneNumber) => {
    // Handle null, undefined, or non-string values
    if (!phoneNumber || typeof phoneNumber !== "string") return "";

    // Remove all non-numeric characters
    const cleaned = phoneNumber.replace(/\D/g, "");

    // Handle different formats
    if (cleaned.length === 0) return "";

    // If starts with 1 (country code)
    if (cleaned.length <= 1) return `+${cleaned}`;
    if (cleaned.length <= 4)
      return `+${cleaned.slice(0, 1)} (${cleaned.slice(1)}`;
    if (cleaned.length <= 7)
      return `+${cleaned.slice(0, 1)} (${cleaned.slice(1, 4)}) ${cleaned.slice(4)}`;
    return `+${cleaned.slice(0, 1)} (${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7, 11)}`;
  };

  const handleChange = (e) => {
    const input = e.target.value || "";
    const cleaned = input.replace(/\D/g, "");

    // Store the cleaned number with + prefix
    let formattedValue = cleaned;
    if (cleaned.length > 0 && !cleaned.startsWith("1")) {
      formattedValue = "1" + cleaned;
    }
    if (formattedValue.length > 0) {
      formattedValue = "+" + formattedValue.slice(0, 11); // Limit to 11 digits (1 + 10)
    }

    // Call onChange with the formatted value directly (not as event object)
    // This matches how the Clients page now expects it
    onChange(formattedValue);
  };

  // Safely get the display value
  const displayValue = formatPhoneNumber(value || "");

  return (
    <Input
      {...props}
      value={displayValue}
      onChange={handleChange}
      placeholder={placeholder || "+1 (555) 123-4567"}
      maxLength={18}
    />
  );
}
