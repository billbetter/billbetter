import { format, addWeeks, addMonths, addYears } from "date-fns";

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
