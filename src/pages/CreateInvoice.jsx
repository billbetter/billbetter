import React, { useState, useEffect } from "react";
import { InvokeLLM } from "@/integrations/Core";
import { LINE_ITEMS } from "@/lib/ai/schemas";
import { aiFailureMessage } from "@/lib/ai/failure";
import { useNavigate, useLocation } from "react-router-dom";
import { createPageUrl } from "@/utils";
import {
  getTransactionAllowance,
  isUnlimited,
} from "@/components/utils/permissions";
import { sdk } from "@/api/sdk";
import { markTimeEntriesInvoiced } from "@/lib/timeTracking";
import { generateInvoicePDF } from "@/functions/generateInvoicePDF";
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
  Save,
  Zap,
  MoreVertical,
  Edit,
  RefreshCw,
  Download,
  HardHat,
  Wrench,
  ClipboardList,
  Calendar,
  X,
  FileText,
  Upload,
  Camera as CameraIcon,
  Receipt,
} from "lucide-react";
import { format, addDays, addWeeks, addMonths, addYears } from "date-fns";
import VoiceInput from "../components/invoice/VoiceInput";
import ServiceAutofill from "../components/invoice/ServiceAutofill";
import InvoiceSuccessDialog from "../components/invoice/InvoiceSuccessDialog";
import {
  SaveTemplateDialog,
  EditTemplateDialog,
  DeleteTemplateDialog,
} from "../components/invoice/TemplateDialogs";

const STORAGE_KEY = "invoicium_invoice_draft";

// A carry-over that moved in-progress drafts off this app's previous storage key
// ran here from 2026-08-20 to 2026-08-22. It was self-retiring -- it deleted the
// old entry as it moved it -- and is removed now that the rename is far enough
// behind.

// Camera Analyzer Component with proper dark mode colors
const CameraAnalyzer = ({ onAnalyze, className }) => {
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [image, setImage] = useState(null);

  const handleGenerate = async () => {
    if (!description.trim()) return;
    setLoading(true);
    await new Promise((resolve) => setTimeout(resolve, 1500));
    if (onAnalyze) {
      onAnalyze(description);
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
              Describe the work or upload a photo
            </p>
          </div>
        </div>

        {/* Input Area */}
        <div className="space-y-2">
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g., Replace kitchen backsplash, install new flooring..."
            className="min-h-[80px] sm:min-h-[100px] border-line dark:border-ink-600 bg-surface-sunken dark:bg-surface-inverted-deep text-content dark:text-ink-50 placeholder:text-content-muted dark:placeholder:text-content-body focus:border-info-500 focus:ring-info-500/20 resize-none text-sm sm:text-base dark:dark:placeholder:text-ink-300"
          />
          <p className="text-xs text-content-muted dark:text-content-muted">
            Describe the work you did. Include hours worked or desired total if
            known.
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
              Generate Invoice Items
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
};

// Inline Invoice Preview Component
const InvoicePreview = ({ invoice, settings }) => {
  if (!invoice) return null;

  return (
    <div className="bg-surface dark:bg-surface-inverted rounded-lg shadow-sm border border-line dark:border-ink-700 overflow-hidden">
      {/* Preview Header */}
      <div className="bg-surface-sunken dark:bg-surface-inverted-deep p-3 sm:p-4 text-content dark:text-content-inverted border-b border-line dark:border-ink-800">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2">
          <div className="min-w-0">
            <h2 className="text-base sm:text-lg font-black">INVOICE</h2>
            <p className="text-content-muted dark:text-content-subtle text-xs sm:text-sm mt-0.5 font-mono truncate">
              #{settings?.invoice_prefix || "INV"}-XXXXX
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
              Bill To
            </p>
            <p className="text-xs sm:text-sm font-semibold text-content dark:text-ink-100 truncate">
              {invoice.client_name || "Client Name"}
            </p>
            {invoice.client_email && (
              <p className="text-xs text-content-body dark:text-content-subtle truncate">
                {invoice.client_email}
              </p>
            )}
          </div>
          <div className="sm:text-right min-w-0">
            <p className="text-xs font-semibold text-content-muted dark:text-content-muted uppercase tracking-wider mb-0.5">
              Due Date
            </p>
            <p className="text-xs sm:text-sm font-medium text-content dark:text-ink-100">
              {invoice.due_date
                ? format(new Date(invoice.due_date), "MMM dd, yyyy")
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
              {invoice.items?.map((item, idx) => (
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
              {(!invoice.items || invoice.items.length === 0) && (
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
              ${invoice.subtotal?.toFixed(2) || "0.00"}
            </span>
          </div>
          {invoice.tax_rate > 0 && (
            <div className="flex justify-between text-xs">
              <span className="text-content-body dark:text-content-subtle">
                Tax ({invoice.tax_rate}%)
              </span>
              <span className="font-medium text-content dark:text-ink-100">
                ${invoice.tax_amount?.toFixed(2) || "0.00"}
              </span>
            </div>
          )}
          <div className="flex justify-between text-base sm:text-lg font-bold pt-1 border-t border-line dark:border-ink-700">
            <span className="text-content dark:text-ink-50">Total</span>
            <span className="text-brand-700 dark:text-brand-400">
              ${invoice.total?.toFixed(2) || "0.00"}
            </span>
          </div>
        </div>

        {/* Notes */}
        {invoice.notes && (
          <div className="bg-surface-sunken dark:bg-ink-800/50 p-2 sm:p-3 rounded-lg border border-line dark:border-ink-700">
            <p className="text-xs font-semibold text-ink-700 dark:text-ink-300 uppercase tracking-wider mb-0.5">
              Notes
            </p>
            <p className="text-xs text-content-body dark:text-content-subtle line-clamp-3">
              {invoice.notes}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default function CreateInvoice() {
  const navigate = useNavigate();
  const location = useLocation();
  const [clients, setClients] = useState([]);
  const [settings, setSettings] = useState(null);
  const [templates, setTemplates] = useState([]);
  const [isPageLoading, setIsPageLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
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
  const [saveTemplateDialog, setSaveTemplateDialog] = useState(false);
  const [editTemplateDialog, setEditTemplateDialog] = useState(false);
  const [deleteTemplateDialog, setDeleteTemplateDialog] = useState({
    open: false,
    template: null,
  });
  const [templateName, setTemplateName] = useState("");
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [deletingTemplate, setDeletingTemplate] = useState(false);
  const [user, setUser] = useState(null);
  const [subscription, setSubscription] = useState(null);
  const [showOverageWarning, setShowOverageWarning] = useState(false);
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

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    const urlParams = new URLSearchParams(location.search);
    const fromQuote = urlParams.get("fromQuote");
    const editId = urlParams.get("edit");

    if (fromQuote === "true") {
      const quoteId = urlParams.get("quoteId");
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
      await loadSimilarInvoices(clientId, client.name);
    }
  };

  const loadSimilarInvoices = async (clientId, clientName) => {
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

  const handleLoadTemplate = (template) => {
    const taxRateToUse =
      template.tax_rate !== undefined ? template.tax_rate : formData.tax_rate;
    const totals = calculateTotals(template.items, taxRateToUse);

    setFormData({
      ...formData,
      items: template.items,
      notes: template.notes || formData.notes,
      tax_rate: taxRateToUse,
      ...totals,
    });
  };

  const handleSaveAsTemplate = async () => {
    if (!templateName.trim()) {
      alert("Please enter a template name");
      return;
    }

    setSavingTemplate(true);
    try {
      await sdk.entities.InvoiceTemplate.create({
        user_id: user.id,
        template_name: templateName,
        items: formData.items,
        notes: formData.notes,
        tax_rate: formData.tax_rate,
      });

      const templateData = await sdk.entities.InvoiceTemplate.filter(
        { user_id: user.id },
        "-created_date",
      );
      setTemplates(templateData);

      setSaveTemplateDialog(false);
      setTemplateName("");
      alert("Template saved successfully!");
    } catch (error) {
      console.error("Error saving template:", error);
      alert("Failed to save template. Please try again.");
    }
    setSavingTemplate(false);
  };

  const handleOpenEditTemplate = (template) => {
    setEditingTemplate(template);
    setTemplateName(template.template_name);
    setEditTemplateDialog(true);
  };

  const handleUpdateTemplate = async () => {
    if (!templateName.trim()) {
      alert("Please enter a template name");
      return;
    }

    setSavingTemplate(true);
    try {
      await sdk.entities.InvoiceTemplate.update(editingTemplate.id, {
        template_name: templateName,
        items: editingTemplate.items,
        notes: editingTemplate.notes,
        tax_rate: editingTemplate.tax_rate,
      });

      const templateData = await sdk.entities.InvoiceTemplate.filter(
        { user_id: user.id },
        "-created_date",
      );
      setTemplates(templateData);

      setEditTemplateDialog(false);
      setEditingTemplate(null);
      setTemplateName("");
      alert("Template updated successfully!");
    } catch (error) {
      console.error("Error updating template:", error);
      alert("Failed to update template. Please try again.");
    }
    setSavingTemplate(false);
  };

  const handleDeleteTemplate = async () => {
    if (!deleteTemplateDialog.template) return;

    setDeletingTemplate(true);
    try {
      await sdk.entities.InvoiceTemplate.delete(
        deleteTemplateDialog.template.id,
      );
      const templateData = await sdk.entities.InvoiceTemplate.filter(
        { user_id: user.id },
        "-created_date",
      );
      setTemplates(templateData);
      setDeleteTemplateDialog({ open: false, template: null });
    } catch (error) {
      console.error("Error deleting template:", error);
      alert("Failed to delete template. Please try again.");
    }
    setDeletingTemplate(false);
  };

  const handleAISuggest = async (jobDescription) => {
    setAiLoading(true);
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
        prompt: `You are a pricing expert for contracting services in ${country}. Based on this job description, suggest invoice line items with realistic market rates for ${country}.

Job: ${jobDescription}
Location: ${country}
Currency: ${currency}
Specialty: ${userSpecialty}

CRITICAL PRICING REQUIREMENTS:
- Use REALISTIC ${currency} market rates for ${country} (Canada rates are typically 15-25% higher than US)
- Research current 2025 market rates for the specialty: ${userSpecialty}
- Account for labor costs, materials, overhead, and profit margins typical in ${country}
- For labor: ${country === "Canada" ? "$60-$150/hr" : "$50-$120/hr"} depending on complexity
- For materials: Add 20-30% markup over wholesale cost

EXACT PRICE EXTRACTION - HIGHEST PRIORITY:
- If the user specifies a price for an item (e.g., "lock removal $50", "furnace repair for $200"), USE THAT EXACT PRICE as the rate
- Extract prices from patterns like: "$50", "for $200", "at $75", "costs $100"
- When a price is explicitly stated, DO NOT modify it based on market rates
- If no price is specified, then use realistic market rates
- If user mentions a total amount for the entire job, distribute it across line items proportionally

CRITICAL CALCULATION RULES:
- quantity × rate MUST equal the line item total
- For "10 hours @ $75/hr" → quantity=10, rate=75 (NOT rate=750)
- The "rate" field is the per-unit price, NOT the total
- Double-check your math: quantity × rate = correct total
- Example: 5 items @ $20 each → quantity=5, rate=20, total=100
- Example: "lock removal $50" → quantity=1, rate=50, total=50

FORMATTING REQUIREMENTS:
- Keep descriptions SHORT and CLEAR (e.g., "HVAC System Inspection" NOT "Inspection of heating and cooling system")
- Use professional service names without explanations
- Be direct and to the point
- Provide 2-4 line items
- Rates should reflect ${currency} pricing

Provide line items in this format.`,
        response_json_schema: LINE_ITEMS,
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
      // Was console.error alone, so a failure looked like the button doing
      // nothing. It could not fail before -- the stub always "succeeded" -- so
      // making it real makes this path reachable for the first time.
      console.error("Error getting AI suggestions:", error);
      alert(aiFailureMessage(error, "line items for this job"));
    }
    setAiLoading(false);
  };

  const handleVoiceTranscript = async (transcript) => {
    await handleAISuggest(transcript);
    setShowVoiceInput(false);
  };

  const calculateNextDate = (startDate, frequency) => {
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

        window.open(pdfUrl, "_blank");

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
        {/* Header */}
        <div className="mb-4 sm:mb-6 lg:mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-ink-800 flex items-center justify-center shadow-lg ring-1 ring-ink-900/10 dark:ring-content-inverted/10 shrink-0">
                <HardHat className="w-5 h-5 sm:w-6 sm:h-6 text-content-inverted" />
              </div>
              <div className="min-w-0 flex-1">
                <h1 className="text-xl sm:text-2xl lg:text-3xl font-black text-content dark:text-ink-50 tracking-tight truncate">
                  {isEditing
                    ? "Edit Invoice"
                    : isRecurring
                      ? "Recurring Invoice"
                      : "New Invoice"}
                </h1>
                <p className="text-content-body dark:text-content-subtle text-xs sm:text-sm mt-0.5 truncate">
                  {isRecurring
                    ? "Set up automatic billing for ongoing contracts"
                    : "Create professional invoices for your trade services"}
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

        {/* Limit Reached Dialog */}
        <Dialog open={showLimitReached} onOpenChange={setShowLimitReached}>
          <DialogContent className="sm:max-w-md mx-4 sm:mx-auto border-line dark:border-ink-700 bg-surface dark:bg-surface-inverted shadow-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-3 text-danger-600 dark:text-danger-400">
                <div className="w-10 h-10 rounded-full bg-danger-100 dark:bg-danger-900/30 flex items-center justify-center shrink-0">
                  <AlertCircle className="w-6 h-6" />
                </div>
                Monthly Limit Reached
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="bg-ink-100 dark:bg-ink-800 rounded-xl p-4 border border-line dark:border-ink-700">
                <p className="text-content dark:text-ink-100 font-semibold mb-2">
                  You've reached your monthly transaction limit
                </p>
                <p className="text-sm text-content-body dark:text-content-subtle">
                  You've used{" "}
                  <strong className="text-content dark:text-ink-50">
                    {subscription?.transactions_used_this_month || 0}
                  </strong>{" "}
                  of{" "}
                  <strong className="text-content dark:text-ink-50">
                    {isUnlimited(subscription)
                      ? "unlimited"
                      : getTransactionAllowance(subscription)}
                  </strong>{" "}
                  transactions this month.
                </p>
              </div>
              <Button
                onClick={() => {
                  setShowLimitReached(false);
                  navigate(createPageUrl("Pricing"));
                }}
                className="w-full bg-brand hover:bg-brand-hover dark:bg-brand dark:hover:bg-brand-hover text-content-inverted shadow-lg h-11"
              >
                Upgrade Your Plan
              </Button>
            </div>
          </DialogContent>
        </Dialog>

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
                          Recent Work Orders
                        </h3>
                        <p className="text-xs sm:text-sm text-content-muted dark:text-content-subtle truncate">
                          Quickly bill for similar jobs
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
                              {suggestion.invoice_number}
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

            {/* Job Expenses Import */}
            {showJobExpenses && jobExpenses.length > 0 && (
              <Card className="border-0 shadow-lg bg-surface dark:bg-surface-inverted overflow-hidden ring-1 ring-success-200 dark:ring-success-800">
                <CardContent className="p-4 sm:p-5">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-success-100 dark:bg-success-900/40 flex items-center justify-center shrink-0">
                        <Receipt className="w-5 h-5 text-success-600 dark:text-success-400" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-base font-black text-content dark:text-ink-50">
                          Job Expenses Tracked
                        </h3>
                        <p className="text-xs text-content-muted dark:text-content-subtle">
                          {jobExpenses.length} expense
                          {jobExpenses.length !== 1 ? "s" : ""} • Billable: $
                          {jobExpenses
                            .reduce(
                              (s, e) =>
                                s + (e.billable_amount || e.amount || 0),
                              0,
                            )
                            .toFixed(2)}
                        </p>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => setShowJobExpenses(false)}
                      className="h-7 w-7 shrink-0 text-content-subtle"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                  <div className="space-y-1 mb-3 max-h-28 overflow-y-auto">
                    {jobExpenses.map((exp, i) => (
                      <div
                        key={i}
                        className="flex justify-between text-sm py-1 border-b border-line-subtle dark:border-ink-700 last:border-0"
                      >
                        <span className="text-ink-700 dark:text-ink-300 truncate">
                          {exp.description}
                        </span>
                        <span className="font-semibold text-success-600 dark:text-success-400 ml-2 shrink-0">
                          ${(exp.billable_amount || exp.amount || 0).toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>
                  <Button
                    type="button"
                    onClick={() => {
                      const expItems = jobExpenses.map((exp) => ({
                        description:
                          exp.description +
                          (exp.vendor ? ` (${exp.vendor})` : ""),
                        quantity: exp.quantity || 1,
                        rate:
                          (exp.billable_amount || exp.amount || 0) /
                          (exp.quantity || 1),
                        amount: exp.billable_amount || exp.amount || 0,
                      }));
                      const totals = calculateTotals(
                        expItems,
                        formData.tax_rate,
                      );
                      setFormData((prev) => ({
                        ...prev,
                        items: expItems,
                        ...totals,
                      }));
                      setShowJobExpenses(false);
                    }}
                    className="w-full bg-brand hover:bg-brand-hover text-content-inverted h-9 text-sm"
                  >
                    Import All Expenses as Invoice Items
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Templates */}
            {templates.length > 0 && (
              <Card className="border-0 shadow-lg bg-surface dark:bg-surface-inverted overflow-hidden ring-1 ring-ink-200 dark:ring-ink-700">
                <CardContent className="p-4 sm:p-6">
                  <div className="flex items-center gap-3 mb-4 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-brand-100 flex items-center justify-center shrink-0 dark:bg-brand-900/30">
                      <Zap className="w-5 h-5 text-brand-600 dark:text-brand-400" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-base sm:text-lg font-black text-content dark:text-ink-50 truncate">
                        Service Templates
                      </h3>
                      <p className="text-xs sm:text-sm text-content-muted dark:text-content-subtle truncate">
                        Quick-start common jobs
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {templates.map((template) => (
                      <div
                        key={template.id}
                        className="flex items-center gap-1 group"
                      >
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => handleLoadTemplate(template)}
                          className="gap-2 text-xs sm:text-sm h-8 sm:h-9 px-2 sm:px-3 border-line dark:border-ink-600 hover:border-brand-400 dark:hover:border-brand-500 hover:bg-brand-50 dark:hover:bg-brand-900/20 bg-surface-sunken dark:bg-ink-800 text-ink-700 dark:text-ink-200"
                        >
                          <ClipboardList className="w-3.5 h-3.5 text-brand-600 dark:text-brand-400" />
                          <span className="truncate max-w-[100px] sm:max-w-[150px]">
                            {template.template_name}
                          </span>
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 sm:h-9 sm:w-9 text-content-subtle hover:text-content-body dark:hover:text-ink-300"
                            >
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent
                            align="end"
                            className="w-48 bg-surface dark:bg-surface-inverted border-line dark:border-ink-700"
                          >
                            <DropdownMenuItem
                              onClick={() => handleOpenEditTemplate(template)}
                              className="dark:text-ink-200 dark:focus:bg-ink-800 cursor-pointer"
                            >
                              <Edit className="w-4 h-4 mr-2 text-brand-700 dark:text-brand-400" />
                              Edit Template
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() =>
                                setDeleteTemplateDialog({
                                  open: true,
                                  template,
                                })
                              }
                              className="text-danger-600 dark:text-danger-400 dark:focus:bg-danger-900/20 cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              Delete Template
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Camera Analyzer */}
            <CameraAnalyzer onAnalyze={handleAISuggest} />

            {/* Recurring Toggle */}
            <Card className="border-0 shadow-lg bg-surface dark:bg-surface-inverted overflow-hidden ring-1 ring-ink-200 dark:ring-ink-700">
              <CardContent className="p-4 sm:p-6">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-brand flex items-center justify-center shadow-lg shrink-0">
                      <RefreshCw className="w-5 h-5 sm:w-6 sm:h-6 text-content-inverted" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-base sm:text-lg font-black text-content dark:text-ink-50 truncate">
                        Recurring Billing
                      </h3>
                      <p className="text-xs sm:text-sm text-content-muted dark:text-content-subtle truncate">
                        For maintenance contracts & retainers
                      </p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer shrink-0">
                    <input
                      type="checkbox"
                      checked={isRecurring}
                      onChange={(e) => setIsRecurring(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-12 sm:w-14 h-6 sm:h-7 bg-ink-200 dark:bg-ink-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-info-300 dark:peer-focus:ring-info-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-content-inverted after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-surface after:border-line-strong dark:after:border-ink-600 after:border after:rounded-full after:h-5 sm:after:h-6 after:w-5 sm:after:w-6 after:transition-all peer-checked:bg-info-600 dark:after:bg-surface-inverted"></div>
                  </label>
                </div>
              </CardContent>
            </Card>

            {/* Recurring Settings */}
            {isRecurring && (
              <Card className="border-0 shadow-lg bg-surface dark:bg-surface-inverted overflow-hidden ring-1 ring-ink-200 dark:ring-ink-700">
                <CardHeader className="bg-surface-sunken dark:bg-ink-800 border-b border-line-subtle dark:border-ink-700 py-3 sm:py-4 px-4 sm:px-6">
                  <CardTitle className="text-content dark:text-ink-50 flex items-center gap-2 text-base sm:text-lg">
                    <Calendar className="w-4 h-4 sm:w-5 sm:h-5 text-brand-700 dark:text-brand-400" />
                    Schedule Settings
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 sm:space-y-5 p-4 sm:p-6">
                  <div className="space-y-2">
                    <Label
                      htmlFor="template_name"
                      className="text-ink-700 dark:text-ink-300 font-medium text-sm"
                    >
                      Contract Name{" "}
                      <span className="text-content-muted font-normal">
                        (Optional)
                      </span>
                    </Label>
                    <Input
                      id="template_name"
                      value={recurringSettings.template_name}
                      onChange={(e) =>
                        setRecurringSettings({
                          ...recurringSettings,
                          template_name: e.target.value,
                        })
                      }
                      placeholder="e.g., Monthly HVAC Maintenance"
                      className="h-10 sm:h-11 border-line dark:border-ink-600 bg-surface dark:bg-surface-inverted-deep text-content dark:text-ink-50 focus:border-info-500 focus:ring-info-500/20"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    <div className="space-y-2">
                      <Label className="text-ink-700 dark:text-ink-300 font-medium text-sm">
                        Frequency *
                      </Label>
                      <Select
                        value={recurringSettings.frequency}
                        onValueChange={(value) =>
                          setRecurringSettings({
                            ...recurringSettings,
                            frequency: value,
                          })
                        }
                      >
                        <SelectTrigger className="h-10 sm:h-11 border-line dark:border-ink-600 bg-surface dark:bg-surface-inverted-deep text-content dark:text-ink-50">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-surface dark:bg-surface-inverted border-line dark:border-ink-700">
                          <SelectItem
                            value="weekly"
                            className="dark:text-ink-200 dark:focus:bg-ink-800"
                          >
                            Weekly
                          </SelectItem>
                          <SelectItem
                            value="biweekly"
                            className="dark:text-ink-200 dark:focus:bg-ink-800"
                          >
                            Bi-weekly
                          </SelectItem>
                          <SelectItem
                            value="monthly"
                            className="dark:text-ink-200 dark:focus:bg-ink-800"
                          >
                            Monthly
                          </SelectItem>
                          <SelectItem
                            value="quarterly"
                            className="dark:text-ink-200 dark:focus:bg-ink-800"
                          >
                            Quarterly
                          </SelectItem>
                          <SelectItem
                            value="yearly"
                            className="dark:text-ink-200 dark:focus:bg-ink-800"
                          >
                            Yearly
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-ink-700 dark:text-ink-300 font-medium text-sm">
                        Start Date *
                      </Label>
                      <Input
                        id="start_date"
                        type="date"
                        value={recurringSettings.start_date}
                        onChange={(e) =>
                          setRecurringSettings({
                            ...recurringSettings,
                            start_date: e.target.value,
                          })
                        }
                        className="h-10 sm:h-11 border-line dark:border-ink-600 bg-surface dark:bg-surface-inverted-deep text-content dark:text-ink-50 focus:border-info-500 focus:ring-info-500/20"
                      />
                    </div>
                  </div>

                  <div className="space-y-3">
                    <Label className="text-ink-700 dark:text-ink-300 font-medium text-sm">
                      End Condition
                    </Label>
                    <div className="space-y-3 bg-surface-sunken dark:bg-ink-800/50 p-3 sm:p-4 rounded-xl border border-line dark:border-ink-700">
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="radio"
                          checked={recurringSettings.end_type === "never"}
                          onChange={() =>
                            setRecurringSettings({
                              ...recurringSettings,
                              end_type: "never",
                            })
                          }
                          className="w-4 h-4 sm:w-5 sm:h-5 text-info-600 dark:text-info-300 border-line-strong dark:border-ink-600 focus:ring-info-500 dark:bg-ink-700"
                        />
                        <span className="text-ink-700 dark:text-ink-300 text-sm">
                          Never ends
                        </span>
                      </label>

                      <label className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="radio"
                          checked={recurringSettings.end_type === "after"}
                          onChange={() =>
                            setRecurringSettings({
                              ...recurringSettings,
                              end_type: "after",
                            })
                          }
                          className="w-4 h-4 sm:w-5 sm:h-5 text-info-600 dark:text-info-300 border-line-strong dark:border-ink-600 focus:ring-info-500 dark:bg-ink-700"
                        />
                        <span className="text-ink-700 dark:text-ink-300 text-sm">
                          After
                        </span>
                        <Input
                          type="number"
                          min="1"
                          value={recurringSettings.occurrences}
                          onChange={(e) =>
                            setRecurringSettings({
                              ...recurringSettings,
                              occurrences: parseInt(e.target.value) || 1,
                            })
                          }
                          disabled={recurringSettings.end_type !== "after"}
                          className="w-16 sm:w-20 h-8 sm:h-9 disabled:opacity-50 bg-surface dark:bg-surface-inverted-deep border-line dark:border-ink-600 text-content dark:text-ink-50 text-sm"
                        />
                        <span className="text-ink-700 dark:text-ink-300 text-sm">
                          occurrences
                        </span>
                      </label>

                      <label className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="radio"
                          checked={recurringSettings.end_type === "on_date"}
                          onChange={() =>
                            setRecurringSettings({
                              ...recurringSettings,
                              end_type: "on_date",
                            })
                          }
                          className="w-4 h-4 sm:w-5 sm:h-5 text-info-600 dark:text-info-300 border-line-strong dark:border-ink-600 focus:ring-info-500 dark:bg-ink-700"
                        />
                        <span className="text-ink-700 dark:text-ink-300 text-sm">
                          On date
                        </span>
                        <Input
                          type="date"
                          value={recurringSettings.end_date}
                          onChange={(e) =>
                            setRecurringSettings({
                              ...recurringSettings,
                              end_date: e.target.value,
                            })
                          }
                          disabled={recurringSettings.end_type !== "on_date"}
                          className="h-8 sm:h-9 disabled:opacity-50 bg-surface dark:bg-surface-inverted-deep border-line dark:border-ink-600 text-content dark:text-ink-50 text-sm"
                        />
                      </label>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Main Invoice Form */}
            <Card className="border-0 shadow-xl bg-surface dark:bg-surface-inverted overflow-hidden ring-1 ring-ink-200 dark:ring-ink-700">
              <CardHeader className="border-b border-line-subtle dark:border-ink-700 bg-surface-sunken/50 dark:bg-ink-800/50 py-3 sm:py-4 px-4 sm:px-6">
                <CardTitle className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-3 text-base sm:text-lg lg:text-xl text-content dark:text-ink-50">
                  <span className="flex items-center gap-2">
                    <ClipboardList className="w-4 h-4 sm:w-5 sm:h-5 text-brand-700 dark:text-brand-400" />
                    Job Details
                  </span>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setSaveTemplateDialog(true)}
                      className="gap-1.5 sm:gap-2 border-line-strong dark:border-ink-600 hover:bg-surface-sunken dark:hover:bg-ink-800 text-ink-700 dark:text-ink-300 h-8 sm:h-9 text-xs sm:text-sm"
                      disabled={formData.items.length === 0}
                    >
                      <Save className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-brand-700 dark:text-brand-400" />
                      <span className="hidden sm:inline">Save Template</span>
                      <span className="sm:hidden">Save</span>
                    </Button>
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
                        (Property Owner)
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

                  {/* Due Date */}
                  {!isRecurring && (
                    <div className="space-y-2">
                      <Label
                        htmlFor="due_date"
                        className="text-ink-700 dark:text-ink-300 font-medium text-sm"
                      >
                        Payment Due Date
                      </Label>
                      <Input
                        id="due_date"
                        type="date"
                        value={formData.due_date}
                        onChange={(e) =>
                          setFormData({ ...formData, due_date: e.target.value })
                        }
                        className="h-10 sm:h-11 border-line dark:border-ink-600 bg-surface dark:bg-surface-inverted-deep text-content dark:text-ink-50 focus:border-info-500 focus:ring-info-500/20"
                      />
                    </div>
                  )}

                  {/* Payment Terms */}
                  <div className="space-y-2">
                    <Label
                      htmlFor="payment_terms"
                      className="text-ink-700 dark:text-ink-300 font-medium text-sm"
                    >
                      Payment Terms
                    </Label>
                    <Input
                      id="payment_terms"
                      value={formData.payment_terms}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          payment_terms: e.target.value,
                        })
                      }
                      placeholder={
                        settings?.payment_terms ||
                        "e.g., Net 30, Due on Receipt"
                      }
                      className="h-10 sm:h-11 border-line dark:border-ink-600 bg-surface dark:bg-surface-inverted-deep text-content dark:text-ink-50 focus:border-info-500 focus:ring-info-500/20"
                    />
                    {settings?.payment_terms && (
                      <p className="text-xs text-content-muted flex items-center gap-1.5 mt-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-brand-600"></span>
                        Default: {settings.payment_terms}
                      </p>
                    )}
                  </div>

                  {/* Line Items */}
                  <div className="space-y-3 sm:space-y-4">
                    <div className="flex items-center justify-between">
                      <Label className="text-ink-700 dark:text-ink-300 font-semibold text-sm sm:text-base flex items-center gap-2">
                        <Wrench className="w-4 h-4 sm:w-5 sm:h-5 text-content-subtle dark:text-content-muted" />
                        Labor & Materials
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
                                Service Description
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
                        <span>Total Due</span>
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
                      Job Notes & Terms
                    </Label>
                    <Textarea
                      id="notes"
                      value={formData.notes}
                      onChange={(e) =>
                        setFormData({ ...formData, notes: e.target.value })
                      }
                      rows={3}
                      placeholder="Scope of work, warranty info, payment instructions..."
                      className="border-line dark:border-ink-600 bg-surface dark:bg-surface-inverted-deep text-content dark:text-ink-50 focus:border-info-500 focus:ring-info-500/20 resize-none text-sm"
                    />
                  </div>

                  {/* Action Buttons */}
                  <div className="flex flex-col-reverse sm:flex-row gap-2 sm:gap-3 pt-4 border-t border-line-subtle dark:border-ink-700">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() =>
                        navigate(
                          createPageUrl(
                            isRecurring ? "RecurringInvoices" : "Invoices",
                          ),
                        )
                      }
                      className="w-full sm:flex-1 h-10 sm:h-11 border-line-strong dark:border-ink-600 hover:bg-surface-sunken dark:hover:bg-ink-800 text-ink-700 dark:text-ink-300 font-medium text-sm"
                      disabled={saving || sendingStatus !== "idle"}
                    >
                      Cancel
                    </Button>
                    {!isRecurring && !isEditing && (
                      <Button
                        type="button"
                        onClick={handleDownloadOnly}
                        disabled={
                          saving ||
                          sendingStatus !== "idle" ||
                          !formData.client_id ||
                          formData.items.length === 0
                        }
                        variant="outline"
                        className="w-full sm:flex-1 h-10 sm:h-11 border-info-600 text-info-700 dark:text-info-400 hover:bg-info-50 dark:hover:bg-info-900/20 font-medium shadow-sm hover:shadow-md transition-all dark:border-info-600 text-sm"
                      >
                        {saving && sendingStatus === "generating_pdf" ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Generating...
                          </>
                        ) : (
                          <>
                            <Download className="w-4 h-4 mr-2" />
                            Save & Download
                          </>
                        )}
                      </Button>
                    )}
                    <Button
                      type="submit"
                      disabled={
                        saving ||
                        sendingStatus !== "idle" ||
                        !formData.client_id ||
                        formData.items.length === 0
                      }
                      className="w-full sm:flex-1 h-10 sm:h-11 bg-brand hover:bg-brand-hover dark:bg-brand dark:hover:bg-brand-hover text-content-inverted font-semibold shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                    >
                      {saving || sendingStatus !== "idle" ? (
                        <div className="flex items-center gap-2 justify-center">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span className="text-xs sm:text-sm">
                            {sendingStatus === "generating_pdf"
                              ? "Creating PDF..."
                              : sendingStatus === "generating_payment_link"
                                ? "Payment Setup..."
                                : sendingStatus === "sending_sms"
                                  ? "Sending Text..."
                                  : sendingStatus === "sending_email"
                                    ? "Sending Email..."
                                    : "Processing..."}
                          </span>
                        </div>
                      ) : (
                        <span className="flex items-center justify-center gap-2">
                          {isEditing
                            ? "Update Invoice"
                            : isRecurring
                              ? "Schedule Recurring"
                              : "Send Invoice"}
                          {!isEditing && !isRecurring && (
                            <CheckCircle className="w-4 h-4" />
                          )}
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
                <InvoicePreview invoice={formData} settings={settings} />
              </div>
            </div>
          </div>
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
