import { format, addWeeks, addMonths, addYears } from "date-fns";

/** Subtotal, tax and total for a list of line items at `taxRate` percent. */
export const calculateTotals = (items, taxRate) => {
  const subtotal = items.reduce((sum, item) => sum + (item.amount || 0), 0);
  const tax_amount = (subtotal * taxRate) / 100;
  const total = subtotal + tax_amount;
  return { subtotal, tax_amount, total };
};

/** The date a recurring schedule starting `startDate` next bills, as yyyy-MM-dd. */
export const calculateNextDate = (startDate, frequency) => {
  const date = new Date(startDate);
  switch (frequency) {
    case "weekly":
      return format(addWeeks(date, 1), "yyyy-MM-dd");
    case "biweekly":
      return format(addWeeks(date, 2), "yyyy-MM-dd");
    case "monthly":
      return format(addMonths(date, 1), "yyyy-MM-dd");
    case "quarterly":
      return format(addMonths(date, 3), "yyyy-MM-dd");
    case "yearly":
      return format(addYears(date, 1), "yyyy-MM-dd");
    default:
      return format(addMonths(date, 1), "yyyy-MM-dd");
  }
};
