import { useEffect, useState } from "react";
import { sdk } from "@/api/sdk";

/**
 * The invoice list's data -- invoices, business settings, recorded payments
 * and the signed-in user -- loaded together on mount, and again by
 * `loadData(true)` for a refresh (which spins the refresh control instead of
 * the full-page loader).
 */
export default function useInvoiceListData() {
  const [invoices, setInvoices] = useState([]);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [payments, setPayments] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const user = await sdk.auth.me();
      setCurrentUser(user);

      // Payments are loaded alongside the invoices so each row can show what
      // is still owed on it. Allowed to fail on its own: without them every
      // invoice reads as fully unpaid, which is what the list showed before
      // this feature and is a worse outcome than no list at all.
      const [invoiceData, settingsData, paymentData] = await Promise.all([
        sdk.entities.Invoice.filter({ user_id: user.id }, "-created_date"),
        sdk.entities.BusinessSettings.filter({ user_id: user.id }),
        sdk.entities.InvoicePayment.filter({ user_id: user.id }).catch(() => []),
      ]);

      setInvoices(invoiceData);
      setPayments(paymentData || []);
      if (settingsData.length > 0) {
        setSettings(settingsData[0]);
      }
    } catch (error) {
      console.error("Error loading data:", error);
    }

    setLoading(false);
    setRefreshing(false);
  };

  return {
    invoices,
    setInvoices,
    settings,
    loading,
    refreshing,
    payments,
    currentUser,
    loadData,
  };
}
