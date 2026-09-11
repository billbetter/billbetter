/**
 * How an amount is printed on an invoice or quote PDF: "$1,234.50" --
 * Canadian digit grouping, always two decimals, no currency code. Shared by
 * the three PDF templates so the same amount cannot print two ways.
 */
export const formatPdfMoney = (n) =>
  `$${Number(n || 0).toLocaleString("en-CA", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
