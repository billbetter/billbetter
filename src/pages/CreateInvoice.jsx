import React, { useState, useEffect } from "react";
import { InvokeLLM } from "@/integrations/Core";
import { LINE_ITEMS } from "@/lib/ai/schemas";
import { applyRequestedTotal } from "@/lib/ai/lineItems";
import { aiFailureMessage } from "@/lib/ai/failure";
import { useNavigate, useLocation } from "react-router-dom";
import { createPageUrl } from "@/utils";
import {
  getTransactionAllowance,
  isUnlimited,
} from "@/components/utils/permissions";
import { sdk } from "@/api/sdk";
import { issuedPatch } from "@/lib/invoiceIssued";
import { markTimeEntriesInvoiced } from "@/lib/timeTracking";
import { generateInvoicePDF } from "@/functions/generateInvoicePDF";
import { deliverPdf } from "@/lib/pdfDelivery";
import { Card, CardContent } from "@/components/ui/card";
import { format, addDays } from "date-fns";
import { markStageReleased } from "@/lib/paymentPlan";
import { canEditInvoice } from "@/lib/invoiceVoid";
import VoiceInput from "../components/invoice/VoiceInput";
import InvoiceSuccessDialog from "../components/invoice/InvoiceSuccessDialog";
import {
  SaveTemplateDialog,
  EditTemplateDialog,
  DeleteTemplateDialog,
} from "../components/invoice/TemplateDialogs";
import CameraAnalyzer from "@/components/invoice/create/CameraAnalyzer";
import { calculateNextDate } from "@/components/invoice/create/invoiceFormMath";
import { calculateTotals } from "@/components/documentForm/lineItemMath";
import useInvoiceTemplates from "@/components/invoice/create/useInvoiceTemplates";
import { lineItemsPrompt } from "@/components/invoice/create/lineItemsPrompt";
import DocumentBuilderHeader from "@/components/documentForm/DocumentBuilderHeader";
import LimitReachedDialog from "@/components/invoice/create/LimitReachedDialog";
import PastDocumentsCard from "@/components/documentForm/PastDocumentsCard";
import JobExpensesImportCard from "@/components/invoice/create/JobExpensesImportCard";
import ServiceTemplatesCard from "@/components/invoice/create/ServiceTemplatesCard";
import RecurringToggleCard from "@/components/invoice/create/RecurringToggleCard";
import RecurringScheduleCard from "@/components/invoice/create/RecurringScheduleCard";
import FormCardHeader from "@/components/documentForm/FormCardHeader";
import SaveTemplateButton from "@/components/invoice/create/SaveTemplateButton";
import ClientPicker from "@/components/documentForm/ClientPicker";
import DueDateField from "@/components/invoice/create/DueDateField";
import PaymentTermsField from "@/components/invoice/create/PaymentTermsField";
import LineItemsEditor from "@/components/documentForm/LineItemsEditor";
import PrefillSourceNotice from "@/components/invoice/create/PrefillSourceNotice";
import TaxRateField from "@/components/documentForm/TaxRateField";
import TotalsSummary from "@/components/documentForm/TotalsSummary";
import NotesField from "@/components/documentForm/NotesField";
import InvoiceFormActions from "@/components/invoice/create/InvoiceFormActions";
import LivePreviewPanel from "@/components/documentForm/LivePreviewPanel";
import InvoicePreview from "@/components/invoice/create/InvoicePreview";
import { HardHat } from "lucide-react";

const STORAGE_KEY = "invoicium_invoice_draft";

// A carry-over that moved in-progress drafts off this app's previous storage key
// ran here from 2026-08-20 to 2026-08-22. It was self-retiring -- it deleted the
// old entry as it moved it -- and is removed now that the rename is far enough
// behind.

export default function CreateInvoice() {
  const navigate = useNavigate();
  const location = useLocation();
  const [clients, setClients] = useState([]);
  const [settings, setSettings] = useState(null);
  const [isPageLoading, setIsPageLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showVoiceInput, setShowVoiceInput] = useState(false);
  const [sendingStatus, setSendingStatus] = useState("idle");
  const [successDialog, setSuccessDialog] = useState({
    open: false,
    invoice: null,
    notifications: {
      sms: false,
      email: false,
      hasPdf: false,
      hasPhone: false,
      hasEmail: false,
      smsError: null,
      emailError: null,
    },
  });
  const [user, setUser] = useState(null);
  const [subscription, setSubscription] = useState(null);
  const [proceedWithOverage, setProceedWithOverage] = useState(false);
  const [showLimitReached, setShowLimitReached] = useState(false);
  const [userSpecialty, setUserSpecialty] = useState("general");
  const [similarSuggestions, setSimilarSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isRecurring, setIsRecurring] = useState(
    location.state?.isRecurring || false,
  );
  const [jobExpenses, setJobExpenses] = useState([]);
  const [showJobExpenses, setShowJobExpenses] = useState(false);

  const [recurringSettings, setRecurringSettings] = useState({
    frequency: "monthly",
    start_date: format(new Date(), "yyyy-MM-dd"),
    end_type: "never",
    occurrences: 12,
    end_date: format(addDays(new Date(), 365), "yyyy-MM-dd"),
    template_name: "",
  });

  const prefillData = location.state?.prefillData;
  const defaultFormData = {
    client_id: "",
    client_name: "",
    client_email: "",
    items: [{ description: "", quantity: 1, rate: 0, amount: 0 }],
    subtotal: 0,
    tax_rate: 0,
    tax_amount: 0,
    total: 0,
    due_date: format(addDays(new Date(), 30), "yyyy-MM-dd"),
    payment_terms: "",
    notes: "",
    status: "draft",
  };

  const [formData, setFormData] = useState(() => {
    if (!prefillData) {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch (e) {
          console.error("Error loading saved invoice:", e);
        }
      }
    }
    return prefillData || defaultFormData;
  });
  const {
    templates, setTemplates, saveTemplateDialog, setSaveTemplateDialog,
    editTemplateDialog, setEditTemplateDialog, deleteTemplateDialog, setDeleteTemplateDialog,
    templateName, setTemplateName, editingTemplate, savingTemplate, deletingTemplate,
    handleLoadTemplate, handleSaveAsTemplate, handleOpenEditTemplate, handleUpdateTemplate,
    handleDeleteTemplate,
  } = useInvoiceTemplates({ user, formData, setFormData });

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    const urlParams = new URLSearchParams(location.search);
    const fromQuote = urlParams.get("fromQuote");
    const editId = urlParams.get("edit");

    if (fromQuote === "true") {
      const clientId = urlParams.get("clientId");
      const clientName = urlParams.get("clientName");
      const clientEmail = urlParams.get("clientEmail");
      const items = urlParams.get("items");
      const taxRate = parseFloat(urlParams.get("taxRate")) || 0;
      const notes = urlParams.get("notes");

      try {
        const parsedItems = items ? JSON.parse(items) : [];
        const totals = calculateTotals(parsedItems, taxRate);

        setFormData((prev) => ({
          ...prev,
          client_id: clientId || "",
          client_name: clientName || "",
          client_email: clientEmail || "",
          items: parsedItems,
          tax_rate: taxRate,
          notes: notes || "",
          ...totals,
        }));
      } catch (error) {
        console.error("Error parsing quote data:", error);
      }
    } else if (editId) {
      loadInvoiceForEdit(editId);
    }
  }, [location.search]);

  useEffect(() => {
    if (formData.client_id || formData.items.some((item) => item.description)) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(formData));
    }
  }, [formData]);

  const loadInvoiceForEdit = async (invoiceId) => {
    try {
      const invoices = await sdk.entities.Invoice.filter({ id: invoiceId });
      if (invoices.length > 0) {
        const invoice = invoices[0];

        // Refused before the form is populated, not on save. A voided invoice
        // loaded into an editable form is a screen that invites work which
        // will be thrown away -- and the URL is hand-editable, so the check
        // has to be here rather than only on the buttons that link to it.
        const editable = canEditInvoice(invoice);
        if (!editable.ok) {
          alert(editable.reason);
          navigate(createPageUrl("InvoiceDetail") + `?id=${invoice.id}`);
          return;
        }

        const totals = calculateTotals(invoice.items, invoice.tax_rate || 0);
        setFormData({
          ...invoice,
          ...totals,
        });
      }
    } catch (error) {
      console.error("Error loading invoice:", error);
      alert("Failed to load invoice for editing");
    }
  };

  const loadInitialData = async () => {
    try {
      const currentUser = await sdk.auth.me();
      setUser(currentUser);

      const [
        clientData,
        settingsData,
        templateData,
        subscriptionData,
        specialtyData,
      ] = await Promise.all([
        sdk.entities.Client.filter({ user_id: currentUser.id }, "-created_date"),
        sdk.entities.BusinessSettings.filter({ user_id: currentUser.id }),
        sdk.entities.InvoiceTemplate.filter(
          { user_id: currentUser.id },
          "-created_date",
        ),
        sdk.entities.Subscription.filter({ user_id: currentUser.id }),
        sdk.entities.UserSpecialty.filter({ user_id: currentUser.id }),
      ]);

      setClients(clientData);
      setTemplates(templateData);

      if (settingsData.length > 0) {
        const businessSettings = settingsData[0];
        setSettings(businessSettings);
        const initialTaxRate = businessSettings.tax_rate || 0;
        setFormData((prev) => {
          const totals = calculateTotals(prev.items, initialTaxRate);
          return {
            ...prev,
            tax_rate: prev.tax_rate || initialTaxRate,
            ...totals,
          };
        });
      }

      if (subscriptionData.length > 0) {
        setSubscription(subscriptionData[0]);
      }

      if (specialtyData.length > 0) {
        setUserSpecialty(specialtyData[0].primary_specialty || "general");
      }

      const urlJobId = new URLSearchParams(window.location.search).get("jobId");
      if (urlJobId) {
        try {
          const expenses = await sdk.entities.JobExpense.filter({
            job_id: urlJobId,
          });
          const billable = expenses.filter(
            (e) => e.include_in_invoice !== false,
          );
          if (billable.length > 0) {
            setJobExpenses(billable);
            setShowJobExpenses(true);
          }
        } catch (e) {
          console.error("Error loading job expenses:", e);
        }
      }

      if (prefillData?.client_id && clientData.length > 0) {
        const prefillClient = clientData.find(
          (c) => c.id === prefillData.client_id,
        );
        if (prefillClient) {
          setFormData((prev) => ({
            ...prev,
            client_id: prefillClient.id,
            client_name: prefillClient.name,
            client_email: prefillClient.email || "",
          }));
        }
      }
    } catch (error) {
      console.error("Error loading data:", error);
    }
    setIsPageLoading(false);
  };

  const handleItemChange = (index, field, value) => {
    const newItems = [...formData.items];
    newItems[index] = { ...newItems[index], [field]: value };

    if (field === "quantity" || field === "rate") {
      newItems[index].amount =
        (newItems[index].quantity || 0) * (newItems[index].rate || 0);
    }

    const totals = calculateTotals(newItems, formData.tax_rate);
    setFormData({ ...formData, items: newItems, ...totals });
  };

  const addItem = () => {
    const newItems = [
      ...formData.items,
      { description: "", quantity: 1, rate: 0, amount: 0 },
    ];
    setFormData({ ...formData, items: newItems });
  };

  const removeItem = (index) => {
    const newItems = formData.items.filter((_, i) => i !== index);
    const totals = calculateTotals(newItems, formData.tax_rate);
    setFormData({ ...formData, items: newItems, ...totals });
  };

  const handleClientSelect = async (clientId) => {
    const client = clients.find((c) => c.id === clientId);
    if (client) {
      setFormData({
        ...formData,
        client_id: clientId,
        client_name: client.name,
        client_email: client.email || "",
        client_phone: client.phone || "",
        client_address: client.address || "",
      });
      await loadSimilarInvoices(clientId);
    }
  };

  const loadSimilarInvoices = async (clientId) => {
    try {
      const pastInvoices = await sdk.entities.Invoice.filter(
        { user_id: user.id, client_id: clientId },
        "-created_date",
        5,
      );

      if (pastInvoices.length > 0) {
        const suggestions = pastInvoices.map((inv) => ({
          id: inv.id,
          invoice_number: inv.invoice_number,
          items: inv.items,
          total: inv.total,
          date: inv.created_date,
        }));
        setSimilarSuggestions(suggestions);
        setShowSuggestions(true);
      }
    } catch (error) {
      console.error("Error loading similar invoices:", error);
    }
  };

  const handleAISuggest = async (jobDescription, fileUrl = null) => {
    try {
      const businessLocation = settings?.address || "";
      const isCanada =
        businessLocation.toLowerCase().includes("canada") ||
        businessLocation.toLowerCase().includes("ontario") ||
        businessLocation.toLowerCase().includes("quebec") ||
        businessLocation.toLowerCase().includes("bc") ||
        businessLocation.toLowerCase().includes("alberta");

      const currency = isCanada ? "CAD" : "USD";
      const country = isCanada ? "Canada" : "United States";

      const response = await InvokeLLM({
        prompt: lineItemsPrompt({ country, currency, userSpecialty, jobDescription, fileUrl }),
        ...(fileUrl && { file_urls: [fileUrl] }),
        response_json_schema: LINE_ITEMS,
      });

      if (response.items && response.items.length > 0) {
        // The prompt asks the model to honour a stated total; this makes it so.
        // Measured, it obeys about a third of the time -- see lib/ai/lineItems.
        const priced = applyRequestedTotal(response.items, jobDescription);
        const itemsWithAmounts = priced.map((item) => ({
          ...item,
          amount: item.quantity * item.rate,
        }));
        const totals = calculateTotals(itemsWithAmounts, formData.tax_rate);
        setFormData({ ...formData, items: itemsWithAmounts, ...totals });
      }
    } catch (error) {
      // Was console.error alone, so a failure looked like the button doing
      // nothing. It could not fail before -- the stub always "succeeded" -- so
      // making it real makes this path reachable for the first time.
      console.error("Error getting AI suggestions:", error);
      alert(aiFailureMessage(error, "line items for this job"));
    }
  };

  const handleVoiceTranscript = async (transcript) => {
    await handleAISuggest(transcript);
    setShowVoiceInput(false);
  };

  const validateForm = () => {
    if (!formData.client_id) {
      alert("Please select a client.");
      return false;
    }
    if (
      formData.items.length === 0 ||
      formData.items.some((item) => item.quantity <= 0 || item.rate < 0)
    ) {
      alert(
        "Please ensure all line items have a quantity and a non-negative rate.",
      );
      return false;
    }
    return true;
  };

  const checkTransactionLimit = async () => {
    if (!subscription || !user) return true;

    const transactionsUsed = subscription.transactions_used_this_month || 0;
    // NOT subscription.monthly_transaction_limit. That column is written by the
    // Stripe webhook at checkout and goes stale whenever the ladder is
    // rebalanced -- it currently reads 500 on Enterprise rows that are sold 750,
    // so reading it raw caps paying users below what they bought.
    // getTransactionAllowance() resolves from plan_name and never returns less
    // than the stored value.
    const limit = getTransactionAllowance(subscription);

    if (limit === -1) return true;

    if (limit > 0 && transactionsUsed >= limit) {
      setShowLimitReached(true);
      return false;
    }

    return true;
  };

  const handleDownloadOnly = async () => {
    if (!validateForm()) return;
    const canProceed = await checkTransactionLimit();
    if (!canProceed) return;

    setSaving(true);
    setSendingStatus("generating_pdf");

    try {
      const invoiceNumber = `${settings?.invoice_prefix || "INV"}-${Date.now().toString().slice(-6)}`;

      const createdInvoice = await sdk.entities.Invoice.create({
        ...formData,
        user_id: user.id,
        invoice_number: invoiceNumber,
        status: "draft",
        delivery_method: "download",
      });

      if (subscription && !isUnlimited(subscription)) {
        const currentUsed = subscription.transactions_used_this_month || 0;
        const newTransactionsUsed = currentUsed + 0.5;
        const newInvoicesUsed =
          (subscription.invoices_used_this_month || 0) + 0.5;

        const updates = {
          transactions_used_this_month: newTransactionsUsed,
          invoices_used_this_month: newInvoicesUsed,
        };

        await sdk.entities.Subscription.update(subscription.id, updates);
        setSubscription((prev) => ({ ...prev, ...updates }));
      }

      const pdfResponse = await generateInvoicePDF({
        invoice: {
          ...createdInvoice,
          ...formData,
          invoice_number: invoiceNumber,
        },
        settings: settings,
      });

      if (pdfResponse.data && pdfResponse.data.pdf_url) {
        const pdfUrl = pdfResponse.data.pdf_url;
        await sdk.entities.Invoice.update(createdInvoice.id, {
          pdf_url: pdfUrl,
          pdf_generated_at: new Date().toISOString(),
        });

        // Chrome blocks top-level navigation to data: URLs, so this
        // used to be a silent no-op behind a success alert.
        await deliverPdf(pdfUrl, {
          filename: `Invoice-${invoiceNumber}.pdf`,
          mode: "open",
        });

        localStorage.removeItem(STORAGE_KEY);
        alert("Invoice created and downloaded! (Counted as 0.5 invoice)");
        navigate(createPageUrl("Invoices"));
      } else {
        throw new Error("PDF generation failed");
      }
    } catch (error) {
      console.error("Error creating invoice:", error);
      alert("Error creating invoice: " + error.message);
    } finally {
      setSaving(false);
      setSendingStatus("idle");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;
    if (isRecurring) {
      setSaving(true);
      try {
        const nextDate = calculateNextDate(
          recurringSettings.start_date,
          recurringSettings.frequency,
        );
        await sdk.entities.RecurringInvoice.create({
          user_id: user.id,
          client_id: formData.client_id,
          client_name: formData.client_name,
          client_email: formData.client_email,
          client_phone: formData.client_phone,
          items: formData.items,
          subtotal: formData.subtotal,
          tax_rate: formData.tax_rate,
          tax_amount: formData.tax_amount,
          total: formData.total,
          payment_terms: formData.payment_terms,
          notes: formData.notes,
          frequency: recurringSettings.frequency,
          start_date: recurringSettings.start_date,
          end_type: recurringSettings.end_type,
          occurrences: recurringSettings.occurrences,
          end_date: recurringSettings.end_date,
          next_generation_date: nextDate,
          invoices_generated: 0,
          status: "active",
          template_name: recurringSettings.template_name,
        });

        setSaving(false);
        localStorage.removeItem(STORAGE_KEY);
        alert(
          "Recurring template saved. Automatic generation isn't running yet — you'll need to create each invoice from the template for now.",
        );
        navigate(createPageUrl("RecurringInvoices"));
        return;
      } catch (error) {
        console.error("❌ Error creating recurring invoice:", error);
        alert(
          "Error creating recurring invoice. Please try again. Details: " +
            error.message,
        );
        setSaving(false);
        return;
      }
    }

    const canProceed = await checkTransactionLimit();
    if (!canProceed) return;
    if (proceedWithOverage) setProceedWithOverage(false);

    setSaving(true);
    setSendingStatus("idle");

    try {
      const invoiceNumber = `${settings?.invoice_prefix || "INV"}-${Date.now().toString().slice(-6)}`;

      const urlParams = new URLSearchParams(location.search);
      const editId = urlParams.get("edit");
      const fromQuote = urlParams.get("fromQuote");
      const quoteId = urlParams.get("quoteId");

      let createdInvoice;
      if (editId) {
        await sdk.entities.Invoice.update(editId, {
          ...formData,
        });
        const updatedInvoices = await sdk.entities.Invoice.filter({
          id: editId,
        });
        createdInvoice = updatedInvoices[0];
      } else {
        createdInvoice = await sdk.entities.Invoice.create({
          ...formData,
          user_id: user.id,
          invoice_number: invoiceNumber,
          status: "sent",
          // Issued now, because this path creates it already sent. Stamped
          // here rather than defaulted in the database: a draft saved today
          // and sent on Friday is issued on Friday, and only the send knows
          // that. See src/lib/invoiceIssued.js.
          ...issuedPatch(formData),
          delivery_method: formData.client_email
            ? "email"
            : formData.client_phone
              ? "sms"
              : "download",
        });

        try {
          await sdk.functions.invoke("notifyInvoiceCreated", {
            invoice_id: createdInvoice.id,
          });
        } catch (notifErr) {
          console.error("⚠️ Failed to send notification:", notifErr);
        }

        if (fromQuote === "true" && quoteId) {
          await sdk.entities.Quote.update(quoteId, {
            status: "converted",
            linked_invoice_id: createdInvoice.id,
          });
        }
      }

      if (
        !editId &&
        subscription &&
        !isUnlimited(subscription)
      ) {
        const currentUsed = subscription.transactions_used_this_month || 0;
        const newTransactionsUsed = currentUsed + 1;
        const newInvoicesUsed =
          (subscription.invoices_used_this_month || 0) + 1;

        const updates = {
          transactions_used_this_month: newTransactionsUsed,
          invoices_used_this_month: newInvoicesUsed,
        };

        await sdk.entities.Subscription.update(subscription.id, updates);
        setSubscription((prev) => ({ ...prev, ...updates }));
      }

      // Hours billed from the Timesheet are marked only once the invoice
      // actually exists. Marking them when the button was pressed would bill
      // work that was never invoiced if the user backed out of this screen.
      if (createdInvoice?.id && prefillData?.time_entry_ids?.length) {
        await markTimeEntriesInvoiced(
          prefillData.time_entry_ids,
          createdInvoice.id,
        );
      }

      const urlJobId = new URLSearchParams(location.search).get("jobId");
      if (prefillData?.job_id || urlJobId) {
        const jid = prefillData?.job_id || urlJobId;
        await sdk.entities.Job.update(jid, {
          linked_invoice_id: createdInvoice.id,
        });
      }

      // A payment plan stage is marked released only now, once the invoice
      // actually exists. Marking it when Release was pressed would leave the
      // plan claiming an invoice that was never created if the contractor
      // backed out of this screen -- the bug the quote flow still has, where a
      // quote is set to `converted` the moment the button is clicked.
      if (createdInvoice?.id && prefillData?.payment_plan_id && prefillData?.plan_stage_id) {
        try {
          const rows = await sdk.entities.PaymentPlan.filter({
            id: prefillData.payment_plan_id,
          });
          const plan = rows?.[0];
          if (plan) {
            const stages = markStageReleased(
              plan.stages || [],
              prefillData.plan_stage_id,
              createdInvoice.id,
            );
            await sdk.entities.PaymentPlan.update(plan.id, {
              stages,
              status: stages.every((s) => s.released_at) ? "completed" : "active",
            });
          }
        } catch (planErr) {
          // The invoice is real and the client can be billed; failing to tick
          // the stage off is worth a console line, not a failed save.
          console.error("Invoice created, but could not mark the stage released:", planErr);
        }
      }

      let pdfUrl = null;
      let pdfGenerated = false;
      let paymentLink = null;
      let smsSuccess = false;
      let emailSuccess = false;
      let hasPhone = !!formData.client_phone;
      let hasEmail = !!formData.client_email;
      let smsError = null;
      let emailError = null;

      try {
        setSendingStatus("generating_pdf");
        const pdfResponse = await generateInvoicePDF({
          invoice: {
            ...createdInvoice,
            ...formData,
            invoice_number: invoiceNumber,
          },
          settings: settings,
        });

        if (pdfResponse.data && pdfResponse.data.pdf_url) {
          pdfUrl = pdfResponse.data.pdf_url;
          pdfGenerated = true;

          await sdk.entities.Invoice.update(createdInvoice.id, {
            pdf_url: pdfUrl,
            pdf_generated_at: new Date().toISOString(),
          });
        } else {
          throw new Error("PDF generation failed - no URL returned");
        }
      } catch (pdfError) {
        console.error("❌ PDF generation failed:", pdfError);
        alert(
          `PDF generation failed: ${pdfError.response?.data?.error || pdfError.message}. The invoice was created, but no PDF was attached or sent.`,
        );
      }

      if (pdfGenerated && settings?.stripe_account_status === "active") {
        try {
          setSendingStatus("generating_payment_link");
          const paymentLinkResponse = await sdk.functions.invoke(
            "createInvoicePaymentLink",
            {
              invoice_id: createdInvoice.id,
            },
          );

          if (
            paymentLinkResponse.data &&
            paymentLinkResponse.data.payment_link
          ) {
            paymentLink = paymentLinkResponse.data.payment_link;
          }
        } catch (paymentError) {
          console.error("❌ Payment link generation failed:", paymentError);
        }
      }

      if (pdfGenerated) {
        if (hasPhone) {
          try {
            setSendingStatus("sending_sms");
            await sdk.functions.invoke("sendInvoiceSMS", {
              invoice_id: createdInvoice.id,
              client_phone: formData.client_phone,
              client_name: formData.client_name,
              invoice_number: invoiceNumber,
              total: formData.total,
              payment_link: paymentLink,
            });
            smsSuccess = true;
          } catch (smsErr) {
            console.error("❌ SMS failed:", smsErr);
            smsError =
              smsErr.response?.data?.details ||
              smsErr.response?.data?.error ||
              "SMS failed";
          }
        }

        if (hasEmail) {
          try {
            setSendingStatus("sending_email");
            const emailResponse = await sdk.functions.invoke(
              "sendInvoiceEmail",
              {
                invoice_id: createdInvoice.id,
                client_email: formData.client_email,
                client_name: formData.client_name,
                invoice_number: invoiceNumber,
                total: formData.total,
                pdf_url: pdfUrl,
                payment_link: paymentLink,
              },
            );

            if (emailResponse.data?.success) {
              emailSuccess = true;
            } else {
              throw new Error(
                emailResponse.data?.error || "Email sending failed",
              );
            }
          } catch (emailErr) {
            console.error("❌ Email failed:", emailErr);

            const errorData = emailErr.response?.data;
            if (errorData?.help) {
              emailError = `${errorData.error || "Email failed"}. ${errorData.help}`;
            } else if (errorData?.error) {
              emailError = errorData.error;
            } else {
              emailError = emailErr.message || "Email failed to send";
            }

            if (
              emailError.includes("sandbox") ||
              emailError.includes("verify")
            ) {
              emailError =
                "Your Resend account is in sandbox mode. Verify your domain at https://resend.com/domains to send emails to any client.";
            }
          }
        }
      }

      setSaving(false);
      setSendingStatus("done");
      localStorage.removeItem(STORAGE_KEY);

      setSuccessDialog({
        open: true,
        invoice: {
          ...createdInvoice,
          invoice_number: invoiceNumber,
          pdf_url: pdfUrl,
          payment_link: paymentLink,
        },
        notifications: {
          sms: smsSuccess,
          email: emailSuccess,
          hasPdf: pdfGenerated,
          hasPhone: hasPhone,
          hasEmail: hasEmail,
          smsError: smsError,
          emailError: emailError,
        },
      });
    } catch (error) {
      console.error("❌ Error creating invoice:", error);
      alert(
        "Error creating invoice. Please try again. Details: " + error.message,
      );
      setSaving(false);
      setSendingStatus("idle");
    }
  };

  const handleSuccessClose = () => {
    setSuccessDialog({
      open: false,
      invoice: null,
      notifications: {
        sms: false,
        email: false,
        hasPdf: false,
        hasPhone: false,
        hasEmail: false,
        smsError: null,
        emailError: null,
      },
    });
    navigate(createPageUrl("Invoices"));
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
  };

  const selectedClient = clients.find((c) => c.id === formData.client_id);

  if (isPageLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-surface-sunken dark:bg-surface-inverted-deep">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 sm:h-16 sm:w-16 border-4 border-line dark:border-ink-800 border-t-blue-600 dark:border-t-blue-500 mx-auto"></div>
          <p className="mt-4 text-content-muted dark:text-content-subtle animate-pulse text-sm sm:text-base">
            Loading...
          </p>
        </div>
      </div>
    );
  }

  const urlParams = new URLSearchParams(location.search);
  const editId = urlParams.get("edit");
  const isEditing = !!editId;

  return (
    <div className="min-h-screen bg-surface-sunken dark:bg-surface-inverted-deep transition-colors duration-300">
      <div className="w-full max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 py-4 sm:py-6 lg:py-8">
        <DocumentBuilderHeader
          Icon={HardHat}
          subtitle={isRecurring ? "Set up automatic billing for ongoing contracts" : "Create professional invoices for your trade services"}
          title={isEditing ? "Edit Invoice" : isRecurring ? "Recurring Invoice" : "New Invoice"}
          userSpecialty={userSpecialty}
        />

        <LimitReachedDialog
          navigate={navigate}
          setShowLimitReached={setShowLimitReached}
          showLimitReached={showLimitReached}
          subscription={subscription}
        />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 lg:gap-8 items-start">
          <div className="space-y-4 sm:space-y-6 w-full min-w-0">
            <PastDocumentsCard
              formData={formData}
              numberField="invoice_number"
              setFormData={setFormData}
              setShowSuggestions={setShowSuggestions}
              showSuggestions={showSuggestions}
              similarSuggestions={similarSuggestions}
              subtitle="Quickly bill for similar jobs"
              title="Recent Work Orders"
            />

            <JobExpensesImportCard
              formData={formData}
              jobExpenses={jobExpenses}
              setFormData={setFormData}
              setShowJobExpenses={setShowJobExpenses}
              showJobExpenses={showJobExpenses}
            />

            <ServiceTemplatesCard
              handleLoadTemplate={handleLoadTemplate}
              handleOpenEditTemplate={handleOpenEditTemplate}
              setDeleteTemplateDialog={setDeleteTemplateDialog}
              templates={templates}
            />

            <CameraAnalyzer onAnalyze={handleAISuggest} />

            <RecurringToggleCard
              isRecurring={isRecurring}
              setIsRecurring={setIsRecurring}
            />

            <RecurringScheduleCard
              isRecurring={isRecurring}
              recurringSettings={recurringSettings}
              setRecurringSettings={setRecurringSettings}
            />

            <Card className="border-0 shadow-xl bg-surface dark:bg-surface-inverted overflow-hidden ring-1 ring-ink-200 dark:ring-ink-700">
              <FormCardHeader
                setShowVoiceInput={setShowVoiceInput}
                title="Job Details"
              >
                <SaveTemplateButton formData={formData} setSaveTemplateDialog={setSaveTemplateDialog} />
              </FormCardHeader>
              <CardContent className="p-4 sm:p-6 space-y-4 sm:space-y-6">
                <form
                  onSubmit={handleSubmit}
                  className="space-y-4 sm:space-y-6"
                >
                  <ClientPicker
                    clients={clients}
                    formData={formData}
                    handleClientSelect={handleClientSelect}
                    hint="(Property Owner)"
                    selectedClient={selectedClient}
                  />

                  <DueDateField
                    formData={formData}
                    isRecurring={isRecurring}
                    setFormData={setFormData}
                  />

                  <PaymentTermsField
                    formData={formData}
                    setFormData={setFormData}
                    settings={settings}
                  />

                  <LineItemsEditor
                    addItem={addItem}
                    descriptionLabel="Service Description"
                    formData={formData}
                    handleItemChange={handleItemChange}
                    notice={<PrefillSourceNotice prefillData={prefillData} />}
                    removeItem={removeItem}
                    setFormData={setFormData}
                    title="Labor & Materials"
                    userSpecialty={userSpecialty}
                  />

                  <TaxRateField
                    formData={formData}
                    setFormData={setFormData}
                  />

                  <TotalsSummary
                    formData={formData}
                    totalLabel="Total Due"
                  />

                  <NotesField
                    formData={formData}
                    label="Job Notes & Terms"
                    placeholder="Scope of work, warranty info, payment instructions..."
                    setFormData={setFormData}
                  />

                  <InvoiceFormActions
                    formData={formData}
                    handleDownloadOnly={handleDownloadOnly}
                    isEditing={isEditing}
                    isRecurring={isRecurring}
                    navigate={navigate}
                    saving={saving}
                    sendingStatus={sendingStatus}
                  />
                </form>
              </CardContent>
            </Card>
          </div>

          <LivePreviewPanel>
            <InvoicePreview invoice={formData} settings={settings} />
          </LivePreviewPanel>
        </div>
      </div>

      <SaveTemplateDialog
        open={saveTemplateDialog}
        onOpenChange={setSaveTemplateDialog}
        templateName={templateName}
        onNameChange={setTemplateName}
        onSave={handleSaveAsTemplate}
        saving={savingTemplate}
      />
      <EditTemplateDialog
        open={editTemplateDialog}
        onOpenChange={setEditTemplateDialog}
        templateName={templateName}
        onNameChange={setTemplateName}
        editingTemplate={editingTemplate}
        onUpdate={handleUpdateTemplate}
        saving={savingTemplate}
      />
      <DeleteTemplateDialog
        open={deleteTemplateDialog.open}
        onOpenChange={setDeleteTemplateDialog}
        template={deleteTemplateDialog.template}
        onDelete={handleDeleteTemplate}
        deleting={deletingTemplate}
      />
      <InvoiceSuccessDialog
        successDialog={successDialog}
        onClose={handleSuccessClose}
        onCopy={copyToClipboard}
      />

      {showVoiceInput && (
        <VoiceInput
          isOpen={showVoiceInput}
          onClose={() => setShowVoiceInput(false)}
          onTranscript={handleVoiceTranscript}
        />
      )}
    </div>
  );
}
