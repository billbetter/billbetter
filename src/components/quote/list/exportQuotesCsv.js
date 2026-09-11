import { format } from "date-fns";
import { formatCalendarDay } from "@/lib/calendarDate";

/**
 * Download the given quotes as a CSV, one row each.
 *
 * The Actions menu used to offer "Export to Excel", which called an edge
 * function that was never written: every tap alerted "Excel export isn't
 * available yet" and left the menu item spinning until the page was reloaded.
 * This is the invoice list's export, for quotes -- no edge function, and every
 * spreadsheet opens a CSV.
 */
export function exportQuotesCsv(quotes) {
  if (quotes.length === 0) {
    alert("No quotes to export.");
    return;
  }

  const headers = [
    "Quote Number",
    "Client Name",
    "Date Issued",
    "Expiry Date",
    "Total Amount",
    "Status",
  ];

  const csvRows = [
    headers.join(","),
    ...quotes.map((quote) => {
      const clientName = `"${quote.client_name?.replace(/"/g, '""') || ""}"`;
      const quoteNumber = `"${quote.quote_number?.replace(/"/g, '""') || ""}"`;
      // Calendar days, so they export as the day they say -- see lib/calendarDate.
      const dateIssued = formatCalendarDay(quote.date_issued, "yyyy-MM-dd");
      const expiryDate = formatCalendarDay(quote.expiry_date, "yyyy-MM-dd");
      const total = quote.total?.toFixed(2) || "0.00";
      const status = quote.status || "";

      return [
        quoteNumber,
        clientName,
        dateIssued,
        expiryDate,
        total,
        status,
      ].join(",");
    }),
  ];

  const csvString = csvRows.join("\n");
  const blob = new Blob([csvString], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `quotes_export_${format(new Date(), "yyyyMMdd_HHmmss")}.csv`,
    );
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}
