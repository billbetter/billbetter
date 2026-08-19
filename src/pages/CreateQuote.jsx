import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { sdk } from "@/api/sdk";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sparkles,
  Mic,
  Plus,
  Trash2,
  Loader2,
  CheckCircle,
  AlertCircle,
  FileText,
  MoreVertical,
  Edit,
  Download,
  HardHat,
  Wrench,
  ClipboardList,
  Camera,
  Calendar,
  X,
  DollarSign,
  Upload,
  Camera as CameraIcon,
  Quote,
  Save,
} from "lucide-react";
import { format, addDays } from "date-fns";
import VoiceInput from "../components/invoice/VoiceInput";
import AIAssistant from "../components/invoice/AIAssistant";
import ServiceAutofill from "../components/invoice/ServiceAutofill";
import { generateQuotePDF } from "@/functions/generateQuotePDF";

// Camera Analyzer Component with proper dark mode colors
const CameraAnalyzer = ({ onAnalysisComplete, className }) => {
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [image, setImage] = useState(null);

  const handleGenerate = async () => {
    if (!description.trim()) return;
    setLoading(true);
    await new Promise((resolve) => setTimeout(resolve, 1500));
    if (onAnalysisComplete) {
      onAnalysisComplete({
        description: description,
        materials: [],
        laborHours: 0,
        notes: description,
      });
    }
    setLoading(false);
    setDescription("");
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setImage(URL.createObjectURL(file));
    }
  };

  return (
    <Card
      className={`border-0 shadow-lg bg-surface dark:bg-surface-inverted overflow-hidden ring-1 ring-ink-200 dark:ring-ink-700 ${className}`}
    >
      <CardContent className="p-4 sm:p-6 space-y-4">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-100 flex items-center justify-center ring-1 ring-brand-200 dark:ring-brand-700 shrink-0 dark:bg-brand-900/30">
            <Sparkles className="w-5 h-5 text-brand-700 dark:text-brand-400" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-base sm:text-lg font-black text-content dark:text-ink-50 truncate">
              AI Assistant
            </h3>
            <p className="text-xs sm:text-sm text-content-muted dark:text-content-subtle truncate">
              Describe the job or upload a photo
            </p>
          </div>
        </div>

        {/* Input Area */}
        <div className="space-y-2">
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g., Kitchen renovation, drywall repair, plumbing fix..."
            className="min-h-[80px] sm:min-h-[100px] border-line dark:border-ink-600 bg-surface-sunken dark:bg-surface-inverted-deep text-content dark:text-ink-50 placeholder:text-content-muted dark:placeholder:text-content-body focus:border-info-500 focus:ring-info-500/20 resize-none text-sm sm:text-base dark:dark:placeholder:text-ink-300"
          />
          <p className="text-xs text-content-muted dark:text-content-muted">
            Describe the work needed. Include desired total if known.
          </p>
        </div>

        {/* Photo Buttons */}
        <div className="grid grid-cols-2 gap-2 sm:gap-3">
          <Button
            type="button"
            variant="outline"
            className="h-16 sm:h-20 border-dashed border-2 border-line-strong dark:border-ink-600 hover:border-info-400 dark:hover:border-info-500 hover:bg-info-50 dark:hover:bg-info-900/20 flex flex-col gap-1 sm:gap-2 text-ink-700 dark:text-ink-300"
            onClick={() => document.getElementById("camera-input")?.click()}
          >
            <CameraIcon className="w-5 h-5 sm:w-6 sm:h-6 text-content-subtle dark:text-content-muted" />
            <span className="text-xs sm:text-sm font-medium">Take Photo</span>
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-16 sm:h-20 border-dashed border-2 border-line-strong dark:border-ink-600 hover:border-info-400 dark:hover:border-info-500 hover:bg-info-50 dark:hover:bg-info-900/20 flex flex-col gap-1 sm:gap-2 text-ink-700 dark:text-ink-300"
            onClick={() => document.getElementById("file-input")?.click()}
          >
            <Upload className="w-5 h-5 sm:w-6 sm:h-6 text-content-subtle dark:text-content-muted" />
            <span className="text-xs sm:text-sm font-medium">Upload Photo</span>
          </Button>
          <input
            id="camera-input"
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handleFileChange}
          />
          <input
            id="file-input"
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
          />
        </div>

        {/* Image Preview */}
        {image && (
          <div className="relative rounded-lg overflow-hidden border border-line dark:border-ink-700">
            <img
              src={image}
              alt="Preview"
              className="w-full h-28 sm:h-32 object-cover"
            />
            <button
              onClick={() => setImage(null)}
              className="absolute top-2 right-2 w-6 h-6 bg-surface-inverted/80 dark:bg-surface-inverted-deep/80 text-content-inverted rounded-full flex items-center justify-center hover:bg-surface-inverted transition-colors"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        )}

        {/* Generate Button */}
        <Button
          type="button"
          onClick={handleGenerate}
          disabled={loading || !description.trim()}
          className="w-full h-11 sm:h-12 bg-brand hover:bg-brand-hover dark:bg-brand dark:hover:bg-brand-hover text-content-inverted font-medium shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all text-sm sm:text-base"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Analyzing...
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4 mr-2" />
              Generate Quote Items
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
};

// Inline Quote Preview Component
const QuotePreview = ({ quote, settings }) => {
  if (!quote) return null;

  return (
    <div className="bg-surface dark:bg-surface-inverted rounded-lg shadow-sm border border-line dark:border-ink-700 overflow-hidden">
      {/* Preview Header */}
      <div className="bg-surface-sunken dark:bg-surface-inverted-deep p-3 sm:p-4 text-content dark:text-content-inverted border-b border-line dark:border-ink-800">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2">
          <div className="min-w-0">
            <h2 className="text-base sm:text-lg font-black">QUOTE</h2>
            <p className="text-content-muted dark:text-content-subtle text-xs sm:text-sm mt-0.5 font-mono truncate">
              #{settings?.quote_prefix || "QTE"}-XXXXX
            </p>
          </div>
          <div className="sm:text-right min-w-0">
            {settings?.business_name && (
              <p className="font-semibold text-xs sm:text-sm truncate">
                {settings.business_name}
              </p>
            )}
            {settings?.address && (
              <p className="text-content-muted dark:text-content-subtle text-xs truncate hidden sm:block">
                {settings.address}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Preview Body */}
      <div className="p-3 sm:p-4 space-y-3 sm:space-y-4">
        {/* Client Info */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-4">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-content-muted dark:text-content-muted uppercase tracking-wider mb-0.5">
              Quote To
            </p>
            <p className="text-xs sm:text-sm font-semibold text-content dark:text-ink-100 truncate">
              {quote.client_name || "Client Name"}
            </p>
            {quote.client_email && (
              <p className="text-xs text-content-body dark:text-content-subtle truncate">
                {quote.client_email}
              </p>
            )}
          </div>
          <div className="sm:text-right min-w-0">
            <p className="text-xs font-semibold text-content-muted dark:text-content-muted uppercase tracking-wider mb-0.5">
              Valid Until
            </p>
            <p className="text-xs sm:text-sm font-medium text-content dark:text-ink-100">
              {quote.expiry_date
                ? format(new Date(quote.expiry_date), "MMM dd, yyyy")
                : "Not set"}
            </p>
          </div>
        </div>

        {/* Line Items Table */}
        <div className="border border-line dark:border-ink-700 rounded-lg overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-ink-100 dark:bg-ink-800 border-b border-line dark:border-ink-700">
              <tr>
                <th className="text-left p-2 font-semibold text-ink-700 dark:text-ink-300">
                  Item
                </th>
                <th className="text-right p-2 font-semibold text-ink-700 dark:text-ink-300 w-12">
                  Qty
                </th>
                <th className="text-right p-2 font-semibold text-ink-700 dark:text-ink-300 w-16 hidden sm:table-cell">
                  Rate
                </th>
                <th className="text-right p-2 font-semibold text-ink-700 dark:text-ink-300 w-16">
                  Amt
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line dark:divide-ink-700">
              {quote.items?.map((item, idx) => (
                <tr key={idx} className="bg-surface dark:bg-surface-inverted">
                  <td className="p-2 text-content dark:text-ink-100 font-medium truncate max-w-[100px] sm:max-w-[150px]">
                    {item.description || "—"}
                  </td>
                  <td className="p-2 text-right text-content-body dark:text-content-subtle">
                    {item.quantity}
                  </td>
                  <td className="p-2 text-right text-content-body dark:text-content-subtle hidden sm:table-cell">
                    ${item.rate?.toFixed(2)}
                  </td>
                  <td className="p-2 text-right font-semibold text-content dark:text-ink-100">
                    ${item.amount?.toFixed(2)}
                  </td>
                </tr>
              ))}
              {(!quote.items || quote.items.length === 0) && (
                <tr>
                  <td
                    colSpan="4"
                    className="p-3 text-center text-content-subtle dark:text-content-muted italic text-xs"
                  >
                    No items added
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div className="space-y-1 border-t border-line dark:border-ink-700 pt-2">
          <div className="flex justify-between text-xs">
            <span className="text-content-body dark:text-content-subtle">
              Subtotal
            </span>
            <span className="font-medium text-content dark:text-ink-100">
              ${quote.subtotal?.toFixed(2) || "0.00"}
            </span>
          </div>
          {quote.tax_rate > 0 && (
            <div className="flex justify-between text-xs">
              <span className="text-content-body dark:text-content-subtle">
                Tax ({quote.tax_rate}%)
              </span>
              <span className="font-medium text-content dark:text-ink-100">
                ${quote.tax_amount?.toFixed(2) || "0.00"}
              </span>
            </div>
          )}
          <div className="flex justify-between text-base sm:text-lg font-bold pt-1 border-t border-line dark:border-ink-700">
            <span className="text-content dark:text-ink-50">Total</span>
            <span className="text-brand-700 dark:text-brand-400">
              ${quote.total?.toFixed(2) || "0.00"}
            </span>
          </div>
        </div>

        {/* Notes */}
        {quote.notes && (
          <div className="bg-surface-sunken dark:bg-ink-800/50 p-2 sm:p-3 rounded-lg border border-line dark:border-ink-700">
            <p className="text-xs font-semibold text-ink-700 dark:text-ink-300 uppercase tracking-wider mb-0.5">
              Terms
            </p>
            <p className="text-xs text-content-body dark:text-content-subtle line-clamp-3">
              {quote.notes}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default function CreateQuote() {
  const navigate = useNavigate();
  const location = useLocation();
  const [clients, setClients] = useState([]);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
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
  const [editMode, setEditMode] = useState(!!editId);

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
        if (quote.assigned_to) {
        }
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
    const limit = subscription.monthly_transaction_limit || 0;
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

  const calculateTotals = (items, taxRate) => {
    const subtotal = items.reduce((sum, item) => sum + (item.amount || 0), 0);
    const tax_amount = (subtotal * taxRate) / 100;
    const total = subtotal + tax_amount;
    return { subtotal, tax_amount, total };
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

      await loadSimilarQuotes(clientId, client.name);
    }
  };

  const loadSimilarQuotes = async (clientId, clientName) => {
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
    setAiLoading(true);
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
        response_json_schema: {
          type: "object",
          properties: {
            items: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  description: { type: "string" },
                  quantity: { type: "number" },
                  rate: { type: "number" },
                },
              },
            },
          },
        },
      });

      if (response.items && response.items.length > 0) {
        const itemsWithAmounts = response.items.map((item) => ({
          ...item,
          amount: item.quantity * item.rate,
        }));
        const totals = calculateTotals(itemsWithAmounts, formData.tax_rate);
        setFormData({ ...formData, items: itemsWithAmounts, ...totals });
      }
    } catch (error) {
      console.error("Error getting AI suggestions:", error);
    }
    setAiLoading(false);
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
        subscription.monthly_transaction_limit !== -1
      ) {
        const baseLimit = subscription.monthly_transaction_limit || 0;
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
        {/* Header */}
        <div className="mb-4 sm:mb-6 lg:mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-ink-800 flex items-center justify-center shadow-lg ring-1 ring-ink-900/10 dark:ring-content-inverted/10 shrink-0">
                <Quote className="w-5 h-5 sm:w-6 sm:h-6 text-content-inverted" />
              </div>
              <div className="min-w-0 flex-1">
                <h1 className="text-xl sm:text-2xl lg:text-3xl font-black text-content dark:text-ink-50 tracking-tight truncate">
                  {editMode ? "Edit Quote" : "New Quote"}
                </h1>
                <p className="text-content-body dark:text-content-subtle text-xs sm:text-sm mt-0.5 truncate">
                  Create professional quotes for your trade services
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <div className="flex items-center gap-2 px-3 py-1.5 sm:px-4 sm:py-2 bg-surface dark:bg-surface-inverted rounded-xl border border-line dark:border-ink-700 shadow-sm">
                <Wrench className="w-4 h-4 text-brand-700 dark:text-brand-400" />
                <span className="text-xs sm:text-sm font-medium text-ink-700 dark:text-ink-300 capitalize truncate max-w-[100px] sm:max-w-[150px]">
                  {userSpecialty.replace("_", " ")}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 lg:gap-8 items-start">
          <div className="space-y-4 sm:space-y-6 w-full min-w-0">
            {/* Smart Suggestions */}
            {showSuggestions && similarSuggestions.length > 0 && (
              <Card className="border-0 shadow-lg bg-surface dark:bg-surface-inverted overflow-hidden ring-1 ring-brand-100 dark:ring-brand-800">
                <CardContent className="p-4 sm:p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-brand-100 flex items-center justify-center ring-1 ring-brand-200 dark:ring-brand-700 shrink-0 dark:bg-brand-900/30">
                        <Sparkles className="w-5 h-5 text-brand-600 dark:text-brand-400" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-base sm:text-lg font-black text-content dark:text-ink-50 truncate">
                          Similar Past Quotes
                        </h3>
                        <p className="text-xs sm:text-sm text-content-muted dark:text-content-subtle truncate">
                          Reuse pricing from previous jobs
                        </p>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => setShowSuggestions(false)}
                      className="h-8 w-8 shrink-0 text-content-subtle hover:text-content-body dark:text-content-muted dark:hover:text-ink-300"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                  <div className="space-y-2 sm:space-y-3">
                    {similarSuggestions.map((suggestion) => (
                      <Button
                        key={suggestion.id}
                        type="button"
                        variant="outline"
                        onClick={() => {
                          const totals = calculateTotals(
                            suggestion.items,
                            formData.tax_rate,
                          );
                          setFormData({
                            ...formData,
                            items: suggestion.items,
                            ...totals,
                          });
                          setShowSuggestions(false);
                        }}
                        className="w-full text-left justify-start h-auto py-3 px-3 sm:px-4 border-line dark:border-ink-600 hover:border-brand-400 dark:hover:border-brand-500 hover:bg-brand-50 dark:hover:bg-brand-900/20 transition-all bg-surface-sunken dark:bg-ink-800 text-ink-700 dark:text-ink-200 group"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1 gap-2">
                            <span className="text-xs sm:text-sm font-semibold text-brand-700 dark:text-brand-400 truncate">
                              {suggestion.quote_number}
                            </span>
                            <span className="text-base sm:text-lg font-bold text-content dark:text-ink-50 shrink-0">
                              ${suggestion.total.toFixed(2)}
                            </span>
                          </div>
                          <div className="text-xs sm:text-sm text-content-body dark:text-content-subtle truncate">
                            {suggestion.items
                              .slice(0, 2)
                              .map((item) => item.description)
                              .join(", ")}
                            {suggestion.items.length > 2 && (
                              <span className="text-brand-600 dark:text-brand-400 font-medium">
                                {" "}
                                +{suggestion.items.length - 2} more
                              </span>
                            )}
                          </div>
                        </div>
                      </Button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Camera Analyzer */}
            <CameraAnalyzer onAnalysisComplete={handleCameraAnalysis} />

            {/* Main Quote Form */}
            <Card className="border-0 shadow-xl bg-surface dark:bg-surface-inverted overflow-hidden ring-1 ring-ink-200 dark:ring-ink-700">
              <CardHeader className="border-b border-line-subtle dark:border-ink-700 bg-surface-sunken/50 dark:bg-ink-800/50 py-3 sm:py-4 px-4 sm:px-6">
                <CardTitle className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-3 text-base sm:text-lg lg:text-xl text-content dark:text-ink-50">
                  <span className="flex items-center gap-2">
                    <ClipboardList className="w-4 h-4 sm:w-5 sm:h-5 text-brand-700 dark:text-brand-400" />
                    Quote Details
                  </span>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setShowVoiceInput(true)}
                      className="gap-1.5 sm:gap-2 border-line-strong dark:border-ink-600 hover:bg-surface-sunken dark:hover:bg-ink-800 text-ink-700 dark:text-ink-300 h-8 sm:h-9 text-xs sm:text-sm"
                    >
                      <Mic className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-brand-700 dark:text-brand-400" />
                      <span className="hidden sm:inline">Voice Input</span>
                      <span className="sm:hidden">Voice</span>
                    </Button>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 sm:p-6 space-y-4 sm:space-y-6">
                <form
                  onSubmit={handleSubmit}
                  className="space-y-4 sm:space-y-6"
                >
                  {/* Client Selection */}
                  <div className="space-y-2">
                    <Label
                      htmlFor="client"
                      className="text-ink-700 dark:text-ink-300 font-medium text-sm flex items-center gap-2"
                    >
                      Client *
                      <span className="text-xs font-normal text-content-muted">
                        (Required)
                      </span>
                    </Label>
                    <Select
                      onValueChange={handleClientSelect}
                      value={formData.client_id}
                    >
                      <SelectTrigger className="h-10 sm:h-11 border-line dark:border-ink-600 bg-surface dark:bg-surface-inverted-deep text-content dark:text-ink-50 focus:border-info-500 focus:ring-info-500/20">
                        <SelectValue placeholder="Select a client">
                          {selectedClient ? (
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-brand-700 flex items-center justify-center text-content-inverted font-semibold text-xs">
                                {selectedClient.name.charAt(0).toUpperCase()}
                              </div>
                              <span className="truncate">
                                {selectedClient.name}
                              </span>
                            </div>
                          ) : (
                            "Select a client"
                          )}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent className="max-h-80 bg-surface dark:bg-surface-inverted border-line dark:border-ink-700">
                        {clients.map((client) => (
                          <SelectItem
                            key={client.id}
                            value={client.id}
                            className="py-2.5 sm:py-3 dark:text-ink-200 dark:focus:bg-ink-800"
                          >
                            <div className="flex items-center gap-2 sm:gap-3">
                              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-ink-100 dark:bg-ink-800 flex items-center justify-center text-content-body dark:text-content-subtle font-semibold text-xs sm:text-sm">
                                {client.name.charAt(0).toUpperCase()}
                              </div>
                              <div className="min-w-0">
                                <div className="font-medium text-content dark:text-ink-100 text-sm truncate">
                                  {client.name}
                                </div>
                                {client.email && (
                                  <div className="text-xs text-content-muted truncate">
                                    {client.email}
                                  </div>
                                )}
                              </div>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Dates */}
                  <div className="grid grid-cols-2 gap-3 sm:gap-4">
                    <div className="space-y-2">
                      <Label className="text-ink-700 dark:text-ink-300 font-medium text-sm">
                        Date Issued
                      </Label>
                      <Input
                        type="date"
                        value={formData.date_issued}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            date_issued: e.target.value,
                          })
                        }
                        className="h-10 sm:h-11 border-line dark:border-ink-600 bg-surface dark:bg-surface-inverted-deep text-content dark:text-ink-50 focus:border-info-500 focus:ring-info-500/20"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-ink-700 dark:text-ink-300 font-medium text-sm">
                        Valid Until
                      </Label>
                      <Input
                        type="date"
                        value={formData.expiry_date}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            expiry_date: e.target.value,
                          })
                        }
                        className="h-10 sm:h-11 border-line dark:border-ink-600 bg-surface dark:bg-surface-inverted-deep text-content dark:text-ink-50 focus:border-info-500 focus:ring-info-500/20"
                      />
                    </div>
                  </div>

                  {/* Line Items */}
                  <div className="space-y-3 sm:space-y-4">
                    <div className="flex items-center justify-between">
                      <Label className="text-ink-700 dark:text-ink-300 font-semibold text-sm sm:text-base flex items-center gap-2">
                        <Wrench className="w-4 h-4 sm:w-5 sm:h-5 text-content-subtle dark:text-content-muted" />
                        Line Items
                      </Label>
                      <Button
                        type="button"
                        onClick={addItem}
                        size="sm"
                        className="bg-brand hover:bg-brand-hover dark:bg-brand dark:hover:bg-brand-hover text-content-inverted shadow-md transition-all hover:scale-105 active:scale-95 h-8 sm:h-9"
                      >
                        <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1" />
                        Add
                      </Button>
                    </div>

                    <div className="space-y-2 sm:space-y-3">
                      {formData.items.map((item, index) => (
                        <div
                          key={index}
                          className="group p-3 sm:p-4 bg-surface dark:bg-surface-inverted-deep border border-line dark:border-ink-700 rounded-xl space-y-2.5 sm:space-y-3 hover:border-info-400 dark:hover:border-info-600 transition-all shadow-sm hover:shadow-md"
                        >
                          <div className="flex items-start gap-2 sm:gap-3">
                            <div className="flex-1 min-w-0 space-y-1.5 sm:space-y-2">
                              <Label className="text-xs font-semibold text-content-muted dark:text-content-subtle uppercase tracking-wider">
                                Description
                              </Label>
                              <ServiceAutofill
                                value={item.description}
                                onChange={(value) =>
                                  handleItemChange(index, "description", value)
                                }
                                onServiceSelect={(lineItem) => {
                                  const newItems = [...formData.items];
                                  newItems[index] = lineItem;
                                  const totals = calculateTotals(
                                    newItems,
                                    formData.tax_rate,
                                  );
                                  setFormData({
                                    ...formData,
                                    items: newItems,
                                    ...totals,
                                  });
                                }}
                                userSpecialty={userSpecialty}
                              />
                            </div>
                            {formData.items.length > 1 && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => removeItem(index)}
                                className="mt-5 sm:mt-6 text-content-body hover:text-danger-700 dark:hover:text-danger-400 hover:bg-danger-50 dark:hover:bg-danger-900/20 transition-all h-7 w-7 sm:h-8 sm:w-8 shrink-0 dark:text-ink-300"
                              >
                                <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                              </Button>
                            )}
                          </div>

                          <div className="grid grid-cols-3 gap-2 sm:gap-3">
                            <div className="space-y-1">
                              <Label className="text-xs font-semibold text-content-muted dark:text-content-subtle uppercase tracking-wider">
                                Qty
                              </Label>
                              <Input
                                type="number"
                                placeholder="0"
                                min="0"
                                step="0.01"
                                value={item.quantity}
                                onChange={(e) =>
                                  handleItemChange(
                                    index,
                                    "quantity",
                                    parseFloat(e.target.value) || 0,
                                  )
                                }
                                className="h-9 sm:h-10 border-line dark:border-ink-600 bg-surface-sunken dark:bg-surface-inverted text-content dark:text-ink-50 focus:border-info-500 focus:ring-info-500/20 font-medium text-sm"
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs font-semibold text-content-muted dark:text-content-subtle uppercase tracking-wider">
                                Rate ($)
                              </Label>
                              <Input
                                type="number"
                                placeholder="0.00"
                                min="0"
                                step="0.01"
                                value={item.rate}
                                onChange={(e) =>
                                  handleItemChange(
                                    index,
                                    "rate",
                                    parseFloat(e.target.value) || 0,
                                  )
                                }
                                className="h-9 sm:h-10 border-line dark:border-ink-600 bg-surface-sunken dark:bg-surface-inverted text-content dark:text-ink-50 focus:border-info-500 focus:ring-info-500/20 font-medium text-sm"
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs font-semibold text-content-muted dark:text-content-subtle uppercase tracking-wider">
                                Total
                              </Label>
                              <div className="h-9 sm:h-10 px-2 sm:px-3 bg-ink-100 dark:bg-ink-800 border border-line dark:border-ink-700 rounded-md flex items-center justify-between font-semibold text-content dark:text-ink-50 text-sm">
                                <span className="text-content-subtle dark:text-content-muted text-xs">
                                  $
                                </span>
                                <span>{item.amount.toFixed(2)}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Tax Rate */}
                  <div className="space-y-2">
                    <Label
                      htmlFor="tax_rate"
                      className="text-ink-700 dark:text-ink-300 font-medium text-sm"
                    >
                      Tax Rate (%)
                    </Label>
                    <Input
                      id="tax_rate"
                      type="number"
                      min="0"
                      step="0.01"
                      value={formData.tax_rate}
                      onChange={(e) => {
                        const taxRate = parseFloat(e.target.value) || 0;
                        const totals = calculateTotals(formData.items, taxRate);
                        setFormData({
                          ...formData,
                          tax_rate: taxRate,
                          ...totals,
                        });
                      }}
                      className="h-10 sm:h-11 border-line dark:border-ink-600 bg-surface dark:bg-surface-inverted-deep text-content dark:text-ink-50 focus:border-info-500 focus:ring-info-500/20"
                    />
                  </div>

                  {/* Totals */}
                  <div className="p-4 sm:p-5 bg-surface-sunken dark:bg-surface-inverted-deep rounded-xl text-content dark:text-content-inverted shadow-sm dark:shadow-xl border border-line dark:border-ink-800">
                    <div className="space-y-2">
                      <div className="flex justify-between text-content-body dark:text-content-subtle text-xs sm:text-sm">
                        <span>Subtotal</span>
                        <span className="font-medium text-content dark:text-ink-50">
                          ${formData.subtotal.toFixed(2)}
                        </span>
                      </div>
                      {formData.tax_rate > 0 && (
                        <div className="flex justify-between text-content-body dark:text-content-subtle text-xs sm:text-sm">
                          <span>Tax ({formData.tax_rate}%)</span>
                          <span className="font-medium text-content dark:text-ink-50">
                            ${formData.tax_amount.toFixed(2)}
                          </span>
                        </div>
                      )}
                      <div className="flex justify-between text-lg sm:text-xl font-bold pt-2 border-t border-line dark:border-ink-800">
                        <span>Total</span>
                        <span className="text-brand-700 dark:text-info-400">
                          ${formData.total.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Notes */}
                  <div className="space-y-2">
                    <Label
                      htmlFor="notes"
                      className="text-ink-700 dark:text-ink-300 font-medium text-sm"
                    >
                      Notes & Terms
                    </Label>
                    <Textarea
                      id="notes"
                      value={formData.notes}
                      onChange={(e) =>
                        setFormData({ ...formData, notes: e.target.value })
                      }
                      rows={3}
                      placeholder="Quote validity, scope exclusions, payment terms..."
                      className="border-line dark:border-ink-600 bg-surface dark:bg-surface-inverted-deep text-content dark:text-ink-50 focus:border-info-500 focus:ring-info-500/20 resize-none text-sm"
                    />
                  </div>

                  {/* Action Buttons */}
                  <div className="flex flex-col-reverse sm:flex-row gap-2 sm:gap-3 pt-4 border-t border-line-subtle dark:border-ink-700">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => navigate(createPageUrl("Quotes"))}
                      className="w-full sm:flex-1 h-10 sm:h-11 border-line-strong dark:border-ink-600 hover:bg-surface-sunken dark:hover:bg-ink-800 text-ink-700 dark:text-ink-300 font-medium text-sm"
                      disabled={loading || sendingNotifications}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={
                        loading ||
                        sendingNotifications ||
                        !formData.client_id ||
                        formData.items.length === 0
                      }
                      className="w-full sm:flex-1 h-10 sm:h-11 bg-brand hover:bg-brand-hover dark:bg-brand dark:hover:bg-brand-hover text-content-inverted font-semibold shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                    >
                      {loading || sendingNotifications ? (
                        <div className="flex items-center gap-2 justify-center">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span className="text-xs sm:text-sm">
                            {sendingNotifications
                              ? "Sending..."
                              : "Creating..."}
                          </span>
                        </div>
                      ) : (
                        <span className="flex items-center justify-center gap-2">
                          {editMode ? "Update Quote" : "Create & Send Quote"}
                          {!editMode && <CheckCircle className="w-4 h-4" />}
                        </span>
                      )}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>

          {/* Preview Panel */}
          <div className="hidden lg:block lg:sticky lg:top-24 w-full">
            <div className="bg-surface dark:bg-surface-inverted rounded-2xl shadow-xl overflow-hidden border border-line dark:border-ink-700">
              <div className="bg-surface-sunken dark:bg-ink-800 px-4 sm:px-6 py-3 sm:py-4 border-b border-line-subtle dark:border-ink-700 flex items-center justify-between">
                <h3 className="font-black text-content dark:text-ink-50 flex items-center gap-2 text-sm">
                  <FileText className="w-4 h-4 text-content-subtle dark:text-content-muted" />
                  Live Preview
                </h3>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-success-500 animate-pulse"></div>
                  <span className="text-xs text-content-muted dark:text-content-subtle font-medium">
                    Real-time
                  </span>
                </div>
              </div>
              <div className="p-3 sm:p-4 bg-surface-sunken dark:bg-surface-inverted-deep">
                <QuotePreview quote={formData} settings={settings} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Success Dialog */}
      <Dialog
        open={successDialog.open}
        onOpenChange={(open) => !open && handleSuccessClose()}
      >
        <DialogContent className="sm:max-w-lg mx-4 sm:mx-auto border-line dark:border-ink-700 bg-surface dark:bg-surface-inverted shadow-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3 text-xl sm:text-2xl text-content dark:text-ink-50">
              <div className="w-12 h-12 rounded-full bg-success-100 dark:bg-success-900/30 flex items-center justify-center shrink-0">
                <CheckCircle className="w-6 h-6 text-success-600 dark:text-success-400" />
              </div>
              <div className="min-w-0">
                <div className="truncate">Quote Created!</div>
                <div className="text-sm font-normal text-content-muted dark:text-content-subtle truncate">
                  #{successDialog.quote?.quote_number}
                </div>
              </div>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Notification Status */}
            <div className="space-y-2">
              {successDialog.notifications?.hasPdf && (
                <div className="flex items-center gap-3 p-3 bg-success-50 dark:bg-success-900/20 rounded-lg border border-success-200 dark:border-success-800">
                  <FileText className="w-5 h-5 text-success-600 dark:text-success-400 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-success-900 dark:text-success-100">
                      PDF Generated
                    </p>
                    <p className="text-xs text-success-700 dark:text-success-300 truncate">
                      Ready for download
                    </p>
                  </div>
                </div>
              )}

              {successDialog.notifications?.hasEmail && (
                <div
                  className={`flex items-center gap-3 p-3 rounded-lg border ${successDialog.notifications.email ? "bg-success-50 dark:bg-success-900/20 border-success-200 dark:border-success-800" : "bg-warning-50 dark:bg-warning-900/20 border-warning-200 dark:border-warning-800"}`}
                >
                  {successDialog.notifications.email ? (
                    <CheckCircle className="w-5 h-5 text-success-600 dark:text-success-400 shrink-0" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-warning-600 dark:text-warning-400 shrink-0" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p
                      className={`text-sm font-semibold ${successDialog.notifications.email ? "text-success-900 dark:text-success-100" : "text-warning-900 dark:text-warning-100"}`}
                    >
                      Email{" "}
                      {successDialog.notifications.email ? "Sent" : "Failed"}
                    </p>
                    {successDialog.notifications.emailError && (
                      <p className="text-xs text-warning-700 dark:text-warning-300 mt-1 break-words">
                        {successDialog.notifications.emailError}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {successDialog.notifications?.hasPhone && (
                <div
                  className={`flex items-center gap-3 p-3 rounded-lg border ${successDialog.notifications.sms ? "bg-success-50 dark:bg-success-900/20 border-success-200 dark:border-success-800" : "bg-warning-50 dark:bg-warning-900/20 border-warning-200 dark:border-warning-800"}`}
                >
                  {successDialog.notifications.sms ? (
                    <CheckCircle className="w-5 h-5 text-success-600 dark:text-success-400 shrink-0" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-warning-600 dark:text-warning-400 shrink-0" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p
                      className={`text-sm font-semibold ${successDialog.notifications.sms ? "text-success-900 dark:text-success-100" : "text-warning-900 dark:text-warning-100"}`}
                    >
                      SMS {successDialog.notifications.sms ? "Sent" : "Failed"}
                    </p>
                    {successDialog.notifications.smsError && (
                      <p className="text-xs text-warning-700 dark:text-warning-300 mt-1">
                        {successDialog.notifications.smsError}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* PDF Download */}
            {successDialog.quote?.pdf_url && (
              <Button
                onClick={() =>
                  window.open(successDialog.quote.pdf_url, "_blank")
                }
                className="w-full bg-surface-inverted hover:bg-ink-800 dark:bg-ink-800 dark:hover:bg-ink-700 text-content-inverted h-11"
              >
                <Download className="w-4 h-4 mr-2" />
                Download PDF
              </Button>
            )}

            {/* Copy Link */}
            {successDialog.quote?.pdf_url && (
              <Button
                onClick={() => copyToClipboard(successDialog.quote.pdf_url)}
                variant="outline"
                className="w-full border-line-strong dark:border-ink-600 hover:bg-surface-sunken dark:hover:bg-ink-800 text-ink-700 dark:text-ink-300 h-11"
              >
                Copy PDF Link
              </Button>
            )}
          </div>

          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => {
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
                navigate(
                  createPageUrl("QuoteDetail") +
                    `?id=${successDialog.quote?.id}`,
                );
              }}
              className="flex-1 border-line-strong dark:border-ink-600 dark:text-ink-300 dark:hover:bg-ink-800 h-11"
            >
              View Quote
            </Button>
            <Button
              onClick={handleSuccessClose}
              className="flex-1 bg-brand hover:bg-brand-hover dark:bg-brand dark:hover:bg-brand-hover text-content-inverted h-11"
            >
              Done
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Voice Input Modal */}
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
