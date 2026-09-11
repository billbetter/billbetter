import { useState, useEffect } from "react";
import { sdk } from "@/api/sdk";

/** Everything Analytics reads: the owner's invoices, payments, clients, quotes and jobs. */
export default function useAnalyticsData() {
  const [invoices, setInvoices] = useState([]);
  const [payments, setPayments] = useState([]);
  const [clients, setClients] = useState([]);
  const [quotes, setQuotes] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const user = await sdk.auth.me();
      const [invoiceData, clientData, quoteData, jobData, paymentData] =
        await Promise.all([
          sdk.entities.Invoice.filter({ user_id: user.id }, "-created_date"),
          sdk.entities.Client.filter({ user_id: user.id }, "-created_date"),
          sdk.entities.Quote.filter({ user_id: user.id }, "-created_date"),
          sdk.entities.Job.filter({ user_id: user.id }, "-created_date"),
          // Allowed to fail on its own: revenueDate() then falls back to
          // paid_date and finally to the creation date, which is exactly what
          // every chart here used before.
          sdk.entities.InvoicePayment.filter({ user_id: user.id }).catch(() => []),
        ]);

      setInvoices(invoiceData);
      setPayments(paymentData || []);
      setClients(clientData);
      setQuotes(quoteData);
      setJobs(jobData);
    } catch (error) {
      console.error("Error loading data:", error);
    } finally {
      setLoading(false);
    }
  };

  return { invoices, payments, clients, quotes, jobs, loading };
}
