import React, { useState, useEffect } from "react";
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
import { Card, CardContent } from "@/components/ui/card";
import { format, addDays } from "date-fns";
import VoiceInput from "../components/invoice/VoiceInput";
import { generateQuotePDF } from "@/functions/generateQuotePDF";
import CameraAnalyzer from "@/components/quote/create/CameraAnalyzer";
import { calculateTotals } from "@/components/documentForm/lineItemMath";
import DocumentBuilderHeader from "@/components/documentForm/DocumentBuilderHeader";
import PastDocumentsCard from "@/components/documentForm/PastDocumentsCard";
import FormCardHeader from "@/components/documentForm/FormCardHeader";
import ClientPicker from "@/components/documentForm/ClientPicker";
import QuoteDatesFields from "@/components/quote/create/QuoteDatesFields";
import LineItemsEditor from "@/components/documentForm/LineItemsEditor";
import TaxRateField from "@/components/documentForm/TaxRateField";
import TotalsSummary from "@/components/documentForm/TotalsSummary";
import NotesField from "@/components/documentForm/NotesField";
import QuoteFormActions from "@/components/quote/create/QuoteFormActions";
import LivePreviewPanel from "@/components/documentForm/LivePreviewPanel";
import QuoteSuccessDialog from "@/components/quote/create/QuoteSuccessDialog";
import QuotePreview from "@/components/quote/create/QuotePreview";
import { Quote } from "lucide-react";

export default function CreateQuote() {
  const navigate = useNavigate();
  const location = useLocation();
  const [clients, setClients] = useState([]);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showVoiceInput, setShowVoiceInput] = useState(false);
  const [sendingNotifications, setSendingNotifications] = useState(false);
  const [successDialog, setSuccessDialog] = useState({
    open: false,
    quote: null,
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
  const [cameraAnalysis, setCameraAnalysis] = useState(null);
  const [userSpecialty, setUserSpecialty] = useState("general");
  const [similarSuggestions, setSimilarSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isPageLoading, setIsPageLoading] = useState(true);

  const prefillData = location.state?.prefillData;
  const urlParams = new URLSearchParams(location.search);
  const editId = urlParams.get("edit");
  const [editMode] = useState(!!editId);

  const [formData, setFormData] = useState(
    prefillData || {
      client_id: "",
      client_name: "",
      client_email: "",
      items: [{ description: "", quantity: 1, rate: 0, amount: 0 }],
      subtotal: 0,
      tax_rate: 0,
      tax_amount: 0,
      total: 0,
      date_issued: format(new Date(), "yyyy-MM-dd"),
      expiry_date: format(addDays(new Date(), 30), "yyyy-MM-dd"),
      notes: "This quote is valid for 30 days from the date of issue.",
      status: "draft",
    },
  );

  useEffect(() => {
    loadData();
    if (editId) {
      loadQuoteForEdit(editId);
    }
  }, [editId]);

  useEffect(() => {
    if (prefillData) {
      setFormData((prev) => {
        const itemsWithAmounts = prefillData.items?.map((item) => ({
          ...item,
          amount: (item.quantity || 0) * (item.rate || 0),
        })) || [{ description: "", quantity: 1, rate: 0, amount: 0 }];

        const totals = calculateTotals(itemsWithAmounts, prev.tax_rate || 0);

        return {
          ...prev,
          ...prefillData,
          items: itemsWithAmounts,
          ...totals,
          client_id: prefillData.client_id || prev.client_id,
          client_name: prefillData.client_name || prev.client_name,
          client_email: prefillData.client_email || prev.client_email,
        };
      });
    }
  }, [prefillData]);

  const loadQuoteForEdit = async (quoteId) => {
    try {
      const quotes = await sdk.entities.Quote.filter({ id: quoteId });
      if (quotes.length > 0) {
        const quote = quotes[0];
        const totals = calculateTotals(quote.items, quote.tax_rate || 0);
        setFormData({
          ...quote,
          ...totals,
        });
      }
    } catch (error) {
      console.error("Error loading quote:", error);
      alert("Failed to load quote for editing");
    }
  };

  const loadData = async () => {
    try {
      const currentUser = await sdk.auth.me();
      setUser(currentUser);

      const [clientData, settingsData, subscriptionData, specialtyData] =
        await Promise.all([
          sdk.entities.Client.filter({ user_id: currentUser.id }, "-created_date"),
          sdk.entities.BusinessSettings.filter({ user_id: currentUser.id }),
          sdk.entities.Subscription.filter({ user_id: currentUser.id }),
          sdk.entities.UserSpecialty.filter({ user_id: currentUser.id }),
        ]);
      setClients(clientData);

      if (specialtyData.length > 0) {
        setUserSpecialty(specialtyData[0].primary_specialty || "general");
      }

      if (subscriptionData.length > 0) {
        setSubscription(subscriptionData[0]);
      }

      if (settingsData.length > 0) {
        setSettings(settingsData[0]);
        setFormData((prev) => {
          const newTaxRate = settingsData[0].tax_rate || 0;
          const totals = calculateTotals(prev.items, newTaxRate);
          let updatedFormData = { ...prev, tax_rate: newTaxRate, ...totals };

          if (
            prefillData &&
            prefillData.client_id &&
            !prefillData.client_name
          ) {
            const client = clientData.find(
              (c) => c.id === prefillData.client_id,
            );
            if (client) {
              updatedFormData = {
                ...updatedFormData,
                client_name: client.name,
                client_email: client.email || "",
              };
            }
          }
          return updatedFormData;
        });
      }
    } catch (error) {
      console.error("Error loading data:", error);
    } finally {
      setIsPageLoading(false);
    }
  };

  const checkTransactionLimit = async () => {
    if (!subscription || !user) return true;

    const transactionsUsed = subscription.transactions_used_this_month || 0;
    // NOT the stored monthly_transaction_limit column -- it is written at
    // checkout and goes stale when the ladder is rebalanced, capping paying
    // users below what they bought. See CreateInvoice for the same note.
    const limit = getTransactionAllowance(subscription);
    const additionalAvailable = subscription.additional_invoices_remaining || 0;
    const totalAvailable = limit + additionalAvailable;

    if (limit === -1) return true;

    if (limit > 0 && transactionsUsed >= totalAvailable) {
      alert(
        "You have reached your monthly transaction limit. Please upgrade your plan or purchase additional transactions in Settings > Billing.",
      );
      return false;
    }

    return true;
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
    setFormData({
      ...formData,
      items: [
        ...formData.items,
        { description: "", quantity: 1, rate: 0, amount: 0 },
      ],
    });
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
      });

      await loadSimilarQuotes(clientId);
    }
  };

  const loadSimilarQuotes = async (clientId) => {
    try {
      const pastQuotes = await sdk.entities.Quote.filter(
        { user_id: user.id, client_id: clientId },
        "-created_date",
        5,
      );

      if (pastQuotes.length > 0) {
        const suggestions = pastQuotes.map((quote) => ({
          id: quote.id,
          quote_number: quote.quote_number,
          items: quote.items,
          total: quote.total,
          date: quote.created_date,
        }));
        setSimilarSuggestions(suggestions);
        setShowSuggestions(true);
      }
    } catch (error) {
      console.error("Error loading similar quotes:", error);
    }
  };

  const handleAISuggest = async (jobDescription) => {
    try {
      const response = await sdk.integrations.Core.InvokeLLM({
        prompt: `Based on this job description, suggest quote line items with clear, concise descriptions, quantities, and reasonable rates.

Job: ${jobDescription}

Requirements:
- Keep descriptions SHORT and CLEAR (e.g., "2-step polishing process" NOT "Polishing - to remove scratches")
- Use professional service names without explanations
- Be direct and to the point
- Provide 2-4 line items
- CRITICAL: If the user mentions a specific total amount (e.g. "for $20,000", "budget is 500", "total 1000"), adjust the rates and quantities so the total sum of all items equals that exact amount.

Provide line items in this format.`,
        response_json_schema: LINE_ITEMS,
      });

      if (response.items && response.items.length > 0) {
        // See CreateInvoice: the model is asked for the stated total and often
        // misses it, so the arithmetic is settled here rather than hoped for.
        const priced = applyRequestedTotal(response.items, jobDescription);
        const itemsWithAmounts = priced.map((item) => ({
          ...item,
          amount: item.quantity * item.rate,
        }));
        const totals = calculateTotals(itemsWithAmounts, formData.tax_rate);
        setFormData({ ...formData, items: itemsWithAmounts, ...totals });
      }
    } catch (error) {
      // See CreateInvoice: silently swallowed until the AI could actually fail.
      console.error("Error getting AI suggestions:", error);
      alert(aiFailureMessage(error, "line items for this quote"));
    }
  };

  const handleVoiceTranscript = async (transcript) => {
    await handleAISuggest(transcript);
    setShowVoiceInput(false);
  };

  const handleCameraAnalysis = (analysis) => {
    setCameraAnalysis(analysis);
    // If there's a description, use the AI to generate proper line items
    if (analysis.description) {
      handleAISuggest(analysis.description);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const canProceed = await checkTransactionLimit();
    if (!canProceed) {
      return;
    }

    setLoading(true);

    try {
      const quoteNumber = `QTE-${Date.now().toString().slice(-6)}`;

      let createdQuote;
      if (editMode && editId) {
        await sdk.entities.Quote.update(editId, {
          ...formData,
        });
        const updatedQuotes = await sdk.entities.Quote.filter({ id: editId });
        createdQuote = updatedQuotes[0];
      } else {
        const quoteData = {
          ...formData,
          user_id: user.id,
          quote_number: quoteNumber,
          status: "draft",
          camera_photo_url: cameraAnalysis?.photoUrl || null,
          camera_description: cameraAnalysis?.description || null,
          ai_analysis: cameraAnalysis
            ? {
                materials: cameraAnalysis.materials,
                labor_hours: cameraAnalysis.laborHours,
                notes: cameraAnalysis.notes,
              }
            : null,
        };

        createdQuote = await sdk.entities.Quote.create(quoteData);
      }

      if (
        !editMode &&
        subscription &&
        !isUnlimited(subscription)
      ) {
        const baseLimit = getTransactionAllowance(subscription);
        const additionalRemaining =
          subscription.additional_invoices_remaining || 0;
        const currentUsed = subscription.transactions_used_this_month || 0;
        const newTransactionsUsed = currentUsed + 1;
        const newQuotesUsed = (subscription.quotes_used_this_month || 0) + 1;

        const updates = {
          transactions_used_this_month: newTransactionsUsed,
          quotes_used_this_month: newQuotesUsed,
        };

        if (
          baseLimit > 0 &&
          newTransactionsUsed > baseLimit &&
          additionalRemaining > 0
        ) {
          updates.additional_invoices_remaining = Math.max(
            0,
            additionalRemaining - 1,
          );
        }

        await sdk.entities.Subscription.update(subscription.id, updates);
        setSubscription((prev) => ({ ...prev, ...updates }));
      }

      if (prefillData?.job_id) {
        await sdk.entities.Job.update(prefillData.job_id, {
          linked_quote_id: createdQuote.id,
        });
      }

      let pdfUrl = null;
      let pdfGenerated = false;

      try {
        const pdfResponse = await generateQuotePDF({
          quote: { ...createdQuote, ...formData, quote_number: quoteNumber },
          settings: settings,
        });

        if (pdfResponse.data && pdfResponse.data.pdf_url) {
          pdfUrl = pdfResponse.data.pdf_url;
          pdfGenerated = true;

          await sdk.entities.Quote.update(createdQuote.id, {
            pdf_url: pdfUrl,
            pdf_generated_at: new Date().toISOString(),
          });
        } else {
          throw new Error("PDF generation failed - no URL returned");
        }
      } catch (pdfError) {
        console.error("❌ PDF generation failed:", pdfError);
        alert(
          `PDF generation failed: ${pdfError.response?.data?.error || pdfError.message}`,
        );
        setLoading(false);
        return;
      }

      const client = clients.find((c) => c.id === formData.client_id);
      let smsSuccess = false;
      let emailSuccess = false;
      let hasPhone = !!client?.phone;
      let hasEmail = !!client?.email;
      let smsError = null;
      let emailError = null;

      if (client) {
        setSendingNotifications(true);

        if (client.phone) {
          try {
            const smsResponse = await sdk.functions.invoke("sendQuoteSMS", {
              quote_id: createdQuote.id,
              client_phone: client.phone,
              client_name: client.name,
              quote_number: quoteNumber,
              total: formData.total,
              pdf_url: pdfUrl,
            });

            if (smsResponse.data?.success) {
              smsSuccess = true;
              await sdk.entities.Quote.update(createdQuote.id, {
                status: "sent",
              });
            } else {
              throw new Error(smsResponse.data?.error || "SMS failed");
            }
          } catch (smsErr) {
            console.error("❌ SMS failed:", smsErr);
            smsError =
              smsErr.response?.data?.details ||
              smsErr.response?.data?.error ||
              smsErr.message ||
              "SMS failed";
          }
        }

        if (client.email) {
          try {
            const emailResponse = await sdk.functions.invoke("sendQuoteEmail", {
              quote_id: createdQuote.id,
              client_email: client.email,
              client_name: client.name,
              quote_number: quoteNumber,
              total: formData.total,
              pdf_url: pdfUrl,
              expiry_date: formData.expiry_date,
              owner_id: user.id,
            });

            if (emailResponse.data?.success) {
              emailSuccess = true;
              await sdk.entities.Quote.update(createdQuote.id, {
                status: "sent",
              });
            } else {
              throw new Error(
                emailResponse.data?.error || "Email sending failed",
              );
            }
          } catch (emailErr) {
            console.error("❌ Email failed:", emailErr);
            emailError =
              emailErr.response?.data?.error ||
              emailErr.message ||
              "Email failed to send";
          }
        }

        setSendingNotifications(false);
      }

      setLoading(false);

      setSuccessDialog({
        open: true,
        quote: { ...createdQuote, quote_number: quoteNumber, pdf_url: pdfUrl },
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
      console.error("❌ Error creating quote:", error);
      alert(
        "Error creating quote. Please try again. Details: " + error.message,
      );
      setLoading(false);
      setSendingNotifications(false);
    }
  };

  const handleSuccessClose = () => {
    setSuccessDialog({
      open: false,
      quote: null,
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
    navigate(createPageUrl("Quotes"));
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

  return (
    <div className="min-h-screen bg-surface-sunken dark:bg-surface-inverted-deep transition-colors duration-300">
      <div className="w-full max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 py-4 sm:py-6 lg:py-8">
        <DocumentBuilderHeader
          Icon={Quote}
          subtitle="Create professional quotes for your trade services"
          title={editMode ? "Edit Quote" : "New Quote"}
          userSpecialty={userSpecialty}
        />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 lg:gap-8 items-start">
          <div className="space-y-4 sm:space-y-6 w-full min-w-0">
            <PastDocumentsCard
              formData={formData}
              numberField="quote_number"
              setFormData={setFormData}
              setShowSuggestions={setShowSuggestions}
              showSuggestions={showSuggestions}
              similarSuggestions={similarSuggestions}
              subtitle="Reuse pricing from previous jobs"
              title="Similar Past Quotes"
            />

            <CameraAnalyzer onAnalysisComplete={handleCameraAnalysis} />

            <Card className="border-0 shadow-xl bg-surface dark:bg-surface-inverted overflow-hidden ring-1 ring-ink-200 dark:ring-ink-700">
              <FormCardHeader
                setShowVoiceInput={setShowVoiceInput}
                title="Quote Details"
              />
              <CardContent className="p-4 sm:p-6 space-y-4 sm:space-y-6">
                <form
                  onSubmit={handleSubmit}
                  className="space-y-4 sm:space-y-6"
                >
                  <ClientPicker
                    clients={clients}
                    formData={formData}
                    handleClientSelect={handleClientSelect}
                    hint="(Required)"
                    selectedClient={selectedClient}
                  />

                  <QuoteDatesFields
                    formData={formData}
                    setFormData={setFormData}
                  />

                  <LineItemsEditor
                    addItem={addItem}
                    descriptionLabel="Description"
                    formData={formData}
                    handleItemChange={handleItemChange}
                    removeItem={removeItem}
                    setFormData={setFormData}
                    title="Line Items"
                    userSpecialty={userSpecialty}
                  />

                  <TaxRateField
                    formData={formData}
                    setFormData={setFormData}
                  />

                  <TotalsSummary
                    formData={formData}
                    totalLabel="Total"
                  />

                  <NotesField
                    formData={formData}
                    label="Notes & Terms"
                    placeholder="Quote validity, scope exclusions, payment terms..."
                    setFormData={setFormData}
                  />

                  <QuoteFormActions
                    editMode={editMode}
                    formData={formData}
                    loading={loading}
                    navigate={navigate}
                    sendingNotifications={sendingNotifications}
                  />
                </form>
              </CardContent>
            </Card>
          </div>

          <LivePreviewPanel>
            <QuotePreview quote={formData} settings={settings} />
          </LivePreviewPanel>
        </div>
      </div>

      <QuoteSuccessDialog
        copyToClipboard={copyToClipboard}
        handleSuccessClose={handleSuccessClose}
        navigate={navigate}
        setSuccessDialog={setSuccessDialog}
        successDialog={successDialog}
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
