import { format } from "date-fns";
import { formatCalendarDay } from "@/lib/calendarDate";

/** Download the given invoices as a CSV, one row each. */
export function exportInvoicesCsv(invoices) {
  if (invoices.length === 0) {
    alert("No invoices to export.");
    return;
  }

  const headers = [
    "Invoice Number",
    "Client Name",
    "Created Date",
    "Due Date",
    "Total Amount",
    "Status",
  ];

  const csvRows = [
    headers.join(","),
    ...invoices.map((invoice) => {
      const clientName = `"${invoice.client_name?.replace(/"/g, '""') || ""}"`;
      const invoiceNumber = `"${invoice.invoice_number?.replace(/"/g, '""') || ""}"`;
      const createdDate = invoice.created_date
        ? format(new Date(invoice.created_date), "yyyy-MM-dd")
        : "";
      const dueDate = formatCalendarDay(invoice.due_date, "yyyy-MM-dd");
      const total = invoice.total?.toFixed(2) || "0.00";
      const status = invoice.status || "";

      // The PDF column is gone on purpose. It wrote the entire PDF into a
      // cell as a base64 data: URL -- 22 kB per row, which no spreadsheet
      // can open and which is no longer fetched by list queries anyway.
      return [
        invoiceNumber,
        clientName,
        createdDate,
        dueDate,
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
      `invoices_export_${format(new Date(), "yyyyMMdd_HHmmss")}.csv`,
    );
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}
