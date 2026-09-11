import { useState, useEffect } from "react";
import { Invoice } from "@/entities/Invoice";
import { Client } from "@/entities/Client";
import { BusinessSettings } from "@/entities/BusinessSettings";
import { sdk } from "@/api/sdk";

/**
 * Everything InvoiceDetail shows, loaded by invoice id: the invoice, its
 * client, the business settings, its payments and its history.
 * `loadInvoiceData` reloads the lot after a write.
 */
export default function useInvoiceDetailData(invoiceId) {
  const [invoice, setInvoice] = useState(null);
  const [client, setClient] = useState(null);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [payments, setPayments] = useState([]);
  const [events, setEvents] = useState([]);

  useEffect(() => {
    if (invoiceId) {
      loadInvoiceData();
    }
  }, [invoiceId]);

  const loadInvoiceData = async () => {
    try {
      const invoices = await Invoice.filter({ id: invoiceId });
      if (invoices.length > 0) {
        const inv = invoices[0];
        setInvoice(inv);

        // Load client data
        if (inv.client_id) {
          const clients = await Client.filter({ id: inv.client_id });
          if (clients.length > 0) {
            setClient(clients[0]);
          }
        }

        // Load settings
        const settingsData = await BusinessSettings.list();
        if (settingsData.length > 0) {
          setSettings(settingsData[0]);
        }

        // Payments and history. Each is allowed to fail on its own: without
        // payments the invoice still renders with its total, and without the
        // history the timeline still shows everything the invoice row itself
        // knows. Neither is worth failing the page over.
        const [paymentRows, eventRows] = await Promise.all([
          sdk.entities.InvoicePayment.filter({ invoice_id: inv.id }).catch(() => []),
          sdk.entities.InvoiceEvent.filter({ invoice_id: inv.id }).catch(() => []),
        ]);
        setPayments(paymentRows || []);
        setEvents(eventRows || []);
      }
    } catch (error) {
      console.error("Error loading invoice:", error);
    }
    setLoading(false);
  };

  return {
    invoice, setInvoice, client, settings, loading, payments, events,
    loadInvoiceData,
  };
}
