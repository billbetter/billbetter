import React, { useState, useEffect } from "react";
import { sdk } from "@/api/sdk";
import {
  useShaderBackground,
  setShaderBackgroundEnabled,
} from "@/lib/appearance";
import { supabase } from "@/api/supabaseClient";
// This import is not directly used in the new logic but kept for safety.
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordStrength } from "@/components/ui/password-strength";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import SettingsHub from "@/components/settings/SettingsHub";
import { ArrowLeft } from "lucide-react";


import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Building2,
  Upload,
  Loader2,
  CheckCircle,
  FileText,
  Mail,
  MessageSquare,
  Info,
  File,
  RotateCcw,
  Palette,
  Waves,
  CreditCard,
  ExternalLink,
  ArrowRight,
  BookOpen,
  Download,
  Clock,
  Moon,
  Sun,
  Monitor,
  Lock,
} from "lucide-react";
import TemplatePreviewModal from "../components/invoice/TemplatePreviewModal";
import PdfTemplateSettings from "../components/settings/PdfTemplateSettings";
import FeatureTour from "../components/onboarding/FeatureTour";


import NotificationSettings from "../components/notifications/NotificationSettings";
import CalendarSettings from "../components/settings/CalendarSettings";

import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Badge } from "@/components/ui/badge"; // Assuming Badge component exists
import { format } from "date-fns"; // Import date-fns for date formatting
import {
  getTransactionAllowance,
  isUnlimited,
  getProcessingFeePercent,
} from "@/components/utils/permissions";

// Define default template content
const defaultEmailSubjectTemplate =
  "New Invoice [Invoice #] from [Business Name]";
const defaultEmailBodyTemplate =
  "Hello [Client Name],\n\nYou have a new invoice for [Amount Due].\n\nInvoice Number: [Invoice #]\n\nThank you for your business! \n[Business Name]";
const initialCustomTemplateConfig = {
  show_logo: true,
  show_company_address: true,
  show_client_address: true,
  show_invoice_details: true,
  show_payment_info: true,
  show_notes: true,
  header_style: "modern",
  layout_style: "two-column",
  accent_color: "#10b981",
  secondary_color: "#6b7280",
};

export default function Settings() {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false); // Renamed from 'uploading' for clarity
  const [logoFile, setLogoFile] = useState(null); // New state to hold the selected logo file object
  const [resetDialog, setResetDialog] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [saveMessage, setSaveMessage] = useState(null); // State for success/error messages
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);
  const [connectingStripe, setConnectingStripe] = useState(false);
  const [disconnectingStripe, setDisconnectingStripe] = useState(false);
  const [showCustomPreview, setShowCustomPreview] = useState(false);
  const [subscription, setSubscription] = useState(null); // New state for subscription
  const [user, setUser] = useState(null); // New state for user
  // null shows the settings hub; a tab id shows that panel. The tab values
  // are unchanged, so every existing panel still works exactly as before.
  const [activeTab, setActiveTab] = useState(null);
  const [showFeatureTour, setShowFeatureTour] = useState(false);
  const [billingHistory, setBillingHistory] = useState({
    invoices: [],
    payment_methods: [],
  });
  const [loadingBilling, setLoadingBilling] = useState(false);
  const [userSpecialty, setUserSpecialty] = useState(null);
  const shaderBackground = useShaderBackground();
  const [darkMode, setDarkMode] = useState(() => {
    const stored = localStorage.getItem("invoicium-dark-mode");
    if (stored !== null) return stored === "true";
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  });

  const initialFormData = {
    business_name: "",
    email: "",
    phone: "",
    address: "",
    website: "",
    logo_url: "", // This will hold the URL for display (either saved or temporary for new upload)
    tax_rate: 0,
    hourly_rate: 0,
    invoice_template: "professional",
    invoice_prefix: "INV",
    payment_terms: "Payment due within 30 days",
    // Empty means "not customised": src/lib/invoiceTheme.js then derives the
    // colour, which reproduces today's black-on-white PDF exactly. The old
    // "#10b981" default was a retired emerald from an earlier brand and was
    // never rendered
    // -- see the 20260822120000_pdf_theme_columns migration.
    pdf_color_scheme: "",
    pdf_background_color: "",
    pdf_text_color: "",
    pdf_muted_text_color: "",
    pdf_footer_text: "Thank you for your business!",
    show_pdf_branding: true, // Show Invoicium branding by default
    font_family: "helvetica",
    serpapi_key: "",
    review_link: "", // New review link field
    email_subject_template: defaultEmailSubjectTemplate,
    email_body_template: defaultEmailBodyTemplate,
    custom_template_config: initialCustomTemplateConfig,
    stripe_account_id: null, // New field
    stripe_account_status: null, // New field
    // Whether a client may approve or decline from the public quote link.
    // Default true because that is how the product already behaves; a
    // business-level switch that silently changed the behaviour of links
    // already sitting in clients' inboxes would be a worse default.
    allow_client_quote_approval: true,
  };

  const [formData, setFormData] = useState(initialFormData);
  const [previewTemplate, setPreviewTemplate] = useState(null);

  useEffect(() => {
    loadSettings();

    // Check URL params for tab selection
    const urlParams = new URLSearchParams(window.location.search);
    const tabParam = urlParams.get("tab");
    if (tabParam) {
      setActiveTab(tabParam);
    }
  }, []);

  // Check Stripe status once on load — use a ref to prevent re-triggering on every settings update
  const stripeCheckedRef = React.useRef(false);
  useEffect(() => {
    if (
      settings?.stripe_account_id &&
      settings.stripe_account_status !== "active" &&
      !stripeCheckedRef.current
    ) {
      stripeCheckedRef.current = true;
      checkStripeAccountStatus();
    }
  }, [settings?.stripe_account_id]); // Only watch account_id — not status, to avoid loops

  const toggleDarkMode = (mode) => {
    if (mode === "system") {
      // "System" resets to the product default, which is light — matching the
      // marketing site. Dark stays available as an explicit choice below.
      localStorage.removeItem("invoicium-dark-mode");
      setDarkMode(false);
      document.documentElement.classList.remove("dark");
    } else {
      const isDark = mode === "dark";
      localStorage.setItem("invoicium-dark-mode", isDark.toString());
      setDarkMode(isDark);
      document.documentElement.classList.toggle("dark", isDark);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (newPassword.length < 12) {
      setSaveMessage("Failed: Password must be at least 12 characters.");
      setTimeout(() => setSaveMessage(null), 3000);
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setSaveMessage("Failed: Passwords do not match.");
      setTimeout(() => setSaveMessage(null), 3000);
      return;
    }
    setChangingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });
      if (error) throw error;
      setNewPassword("");
      setConfirmNewPassword("");
      setSaveMessage("Password updated successfully.");
    } catch (err) {
      console.error("Change password error:", err);
      setSaveMessage(`Failed: ${err?.message || "Could not update password."}`);
    } finally {
      setChangingPassword(false);
      setTimeout(() => setSaveMessage(null), 3000);
    }
  };

  const loadSettings = async () => {
    setLoading(true);
    try {
      const currentUser = await sdk.auth.me();
      setUser(currentUser); // Set user state

      const data = await sdk.entities.BusinessSettings.filter({
        user_id: currentUser.id,
      });

      if (data.length > 0) {
        const fetchedSettings = data[0];
        setSettings(fetchedSettings);
        setFormData({
          ...initialFormData, // Start with all initial defaults
          ...fetchedSettings, // Overlay with fetched settings
          // Deep merge for nested custom_template_config
          custom_template_config: {
            ...initialCustomTemplateConfig,
            ...fetchedSettings.custom_template_config,
          },
          // Ensure template fields fall back to defaults if empty in fetched data
          email_subject_template:
            fetchedSettings.email_subject_template ||
            defaultEmailSubjectTemplate,
          email_body_template:
            fetchedSettings.email_body_template || defaultEmailBodyTemplate,
          review_link:
            fetchedSettings.review_link || fetchedSettings.reviewLink || "", // Load review link with fallback
        });
        setLogoFile(null); // Clear any pending logo file after loading
      } else {
        setFormData(initialFormData); // No existing settings, use all defaults
        setLogoFile(null);
      }

      // Load subscription data
      const subscriptionData = await sdk.entities.Subscription.filter({
        user_id: currentUser.id,
      });
      if (subscriptionData.length > 0) {
        setSubscription(subscriptionData[0]);
      } else {
        setSubscription(null);
      }

      // Load billing history if subscribed
      if (
        subscriptionData.length > 0 &&
        subscriptionData[0].stripe_customer_id
      ) {
        loadBillingHistory();
      }

      // Load user specialty
      const specialtyData = await sdk.entities.UserSpecialty.filter({
        user_id: currentUser.id,
      });
      if (specialtyData.length > 0) {
        setUserSpecialty(specialtyData[0]);
      }
    } catch (error) {
      console.error("Error loading settings:", error);
      setSaveMessage("Failed to load settings. Please try again.");
      setTimeout(() => setSaveMessage(null), 3000);
    }
    setLoading(false);
  };

  const loadBillingHistory = async () => {
    try {
      setLoadingBilling(true);
      const response = await sdk.functions.invoke("getBillingHistory");
      // Normalise rather than storing the payload as-is. The billing tab reads
      // .invoices.length and .payment_methods.length unguarded, so a response
      // missing either key replaced the initial state with one that has no such
      // arrays and crashed the whole page on render. Keeping the shape correct
      // here means the render cannot be handed anything else, whatever the
      // endpoint returns.
      const data = response?.data ?? {};
      setBillingHistory({
        invoices: Array.isArray(data.invoices) ? data.invoices : [],
        payment_methods: Array.isArray(data.payment_methods)
          ? data.payment_methods
          : [],
      });
    } catch (error) {
      console.error("Error loading billing history:", error);
    } finally {
      setLoadingBilling(false);
    }
  };

  const handleConnectStripe = async () => {
    setConnectingStripe(true);
    try {
      const response = await sdk.functions.invoke(
        "createStripeConnectAccount",
        {
          return_url: window.location.href,
          refresh_url: window.location.href,
        },
      );

      if (response.data?.url) {
        window.location.href = response.data.url;
      } else {
        // Edge Function failures arrive as { success: false, error } rather
        // than throwing, so read the server's message instead of discarding it.
        throw new Error(response.data?.error || "No onboarding URL received");
      }
    } catch (error) {
      console.error("Stripe Connect error:", error);
      setSaveMessage(
        error.message || "Failed to connect Stripe account. Please try again.",
      );
      setTimeout(() => setSaveMessage(null), 3000);
    } finally {
      setConnectingStripe(false);
    }
  };

  const checkStripeAccountStatus = async () => {
    try {
      const response = await sdk.functions.invoke("checkStripeStatus");

      if (response.data?.status) {
        // Update local state directly — do NOT call loadSettings() as it triggers a full-page reload spinner
        if (response.data.status !== settings?.stripe_account_status) {
          setSettings((prev) =>
            prev
              ? {
                  ...prev,
                  stripe_account_status: response.data.status,
                  stripe_onboarding_completed:
                    response.data.status === "active",
                }
              : prev,
          );
        }

        if (response.data.status === "active") {
          setSaveMessage(
            "✅ Stripe account is active and ready to accept payments!",
          );
        } else if (response.data.status === "pending") {
          setSaveMessage(
            "ℹ️ Stripe onboarding is pending. Please complete setup on Stripe.",
          );
        }
        setTimeout(() => setSaveMessage(null), 4000);
      }
    } catch (error) {
      console.error("Error checking Stripe status:", error);
      // Silently fail on background check — don't show error to user for auto-checks
    }
  };

  const handleDisconnectStripe = async () => {
    if (
      !confirm(
        "Are you sure you want to disconnect your Stripe account? You won't be able to accept payments until you reconnect.",
      )
    ) {
      return;
    }

    setDisconnectingStripe(true);
    try {
      if (settings) {
        await sdk.entities.BusinessSettings.update(settings.id, {
          stripe_account_id: null,
          stripe_account_status: "not_connected",
          stripe_onboarding_completed: false,
        });
        setSaveMessage("Stripe account disconnected successfully!");
        setTimeout(() => setSaveMessage(null), 3000);
        await loadSettings();
      }
    } catch (error) {
      console.error("Error disconnecting Stripe:", error);
      setSaveMessage("Failed to disconnect Stripe account. Please try again.");
      setTimeout(() => setSaveMessage(null), 3000);
    } finally {
      setDisconnectingStripe(false);
    }
  };

  const handleLogoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setLogoFile(file); // Store the file object itself
    setFormData((prev) => ({ ...prev, logo_url: URL.createObjectURL(file) })); // Create a temporary URL for immediate preview
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setSaveMessage(null); // Clear any previous messages

    try {
      const currentUser = await sdk.auth.me();
      let finalLogoUrl = formData.logo_url; // Start with the current URL in formData

      if (logoFile) {
        // If a new logo file was selected by the user
        setUploadingLogo(true);
        const uploadResult = await sdk.integrations.Core.UploadFile({
          file: logoFile,
        });
        finalLogoUrl = uploadResult.file_url; // Use the URL from the successful upload
        setUploadingLogo(false);
      } else if (formData.logo_url === "") {
        // If the user explicitly cleared the logo (formData.logo_url became empty)
        finalLogoUrl = null;
      }
      // If logoFile is null and formData.logo_url is not empty, it means the existing logo URL should be kept.

      const settingsToSave = {
        ...formData,
        user_id: currentUser.id, // Associate settings with the current user
        logo_url: finalLogoUrl, // Use the updated logo URL (new, existing, or null)
      };

      if (settings) {
        await sdk.entities.BusinessSettings.update(settings.id, settingsToSave);
      } else {
        await sdk.entities.BusinessSettings.create(settingsToSave);
      }

      setSaveMessage("Settings saved successfully!");
      setTimeout(() => setSaveMessage(null), 3000);
      loadSettings(); // Reload settings to ensure UI is in sync with saved data
    } catch (error) {
      console.error("Error saving settings:", error);
      setSaveMessage("Failed to save settings. Please try again.");
      setTimeout(() => setSaveMessage(null), 3000);
    } finally {
      setSaving(false);
    }
  };

  const handleResetToDefaults = async () => {
    setResetting(true);
    setSaveMessage(null); // Clear any previous messages
    try {
      const currentUser = await sdk.auth.me(); // Need user ID for resetting specific settings
      const resetData = {
        ...initialFormData, // Use the base initial defaults
        business_name: formData.business_name, // Keep business name from current form
        user_id: currentUser.id, // Ensure user_id is maintained for the reset data
      };

      if (settings) {
        await sdk.entities.BusinessSettings.update(settings.id, resetData);
      } else {
        // If no settings exist yet, create them with defaults (keeping business name)
        await sdk.entities.BusinessSettings.create(resetData);
      }

      setFormData(resetData);
      setLogoFile(null); // Clear any temporary logo file
      setResetDialog(false);
      setSaveMessage("Settings reset to defaults!");
      setTimeout(() => setSaveMessage(null), 3000);
      await loadSettings(); // Reload to ensure UI reflects database state
    } catch (error) {
      console.error("Error resetting settings:", error);
      setSaveMessage("Failed to reset settings. Please try again.");
      setTimeout(() => setSaveMessage(null), 3000);
    } finally {
      setResetting(false);
    }
  };

  const templateOptions = [
    {
      id: "professional",
      name: "Professional",
      description:
        "Detailed layout with clear sections for company and client info",
      preview: "📄 Full layout with From/Bill To sections",
    },
    {
      id: "compact",
      name: "Compact",
      description: "Clean design with logo support and order details focus",
      preview: "📋 Modern single-page with logo placement",
    },
    {
      id: "simple",
      name: "Simple",
      description: "Minimalist invoice perfect for quick billing",
      preview: "📝 Streamlined one-page format",
    },
    {
      id: "custom",
      name: "Custom Template",
      description:
        "Build your own template with customizable sections and styling",
      preview: "🎨 Your custom design",
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] bg-surface-sunken dark:bg-surface-inverted-deep">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-success-600 dark:border-success-500"></div>
      </div>
    );
  }

  return (
    <div className="px-4 py-4 sm:px-6 sm:py-6 lg:px-8 lg:py-8 max-w-5xl mx-auto bg-surface-sunken dark:bg-surface-inverted-deep min-h-screen">
      {/* Feature Tour Modal */}
      <FeatureTour
        isOpen={showFeatureTour}
        onClose={() => setShowFeatureTour(false)}
        onComplete={() => setShowFeatureTour(false)}
      />

      {/* Mobile Header */}
      <div className="lg:hidden mb-5">
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="w-10 h-10 rounded-xl bg-success-600 flex items-center justify-center shadow-lg flex-shrink-0">
              <Building2 className="w-5 h-5 text-content-inverted" />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl font-black text-content dark:text-content-inverted tracking-tight">
                Settings
              </h1>
              <p className="text-xs text-content-muted dark:text-content-subtle">
                Business configuration
              </p>
            </div>
          </div>
          <Button
            type="submit"
            disabled={saving || uploadingLogo}
            className="bg-brand hover:bg-brand-hover h-9 px-4 text-sm font-semibold shadow-lg flex-shrink-0"
            form="settings-form"
          >
            {saving || uploadingLogo ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              "Save"
            )}
          </Button>
        </div>
      </div>

      {/* Desktop Header */}
      <div className="hidden lg:block mb-8">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="min-w-0 flex-1">
            <h1 className="text-3xl font-black text-content dark:text-content-inverted mb-1">
              Business Settings
            </h1>
            <p className="text-content-body dark:text-content-subtle">
              Configure your business information and invoice templates
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowFeatureTour(true)}
              className="gap-2 border-success-300 dark:border-success-700 text-success-700 dark:text-success-400 hover:bg-success-50 dark:hover:bg-success-900/30"
            >
              <BookOpen className="w-4 h-4" />
              Feature Tour
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setResetDialog(true)}
              className="gap-2 border-line-strong dark:border-ink-700 dark:text-ink-300 dark:hover:bg-ink-800"
            >
              <RotateCcw className="w-4 h-4" />
              Reset to Defaults
            </Button>
            <Button
              type="submit"
              disabled={saving || uploadingLogo}
              className="bg-brand hover:bg-brand-hover min-w-[120px]"
              form="settings-form"
            >
              {saving || uploadingLogo ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {uploadingLogo ? "Uploading..." : "Saving..."}
                </>
              ) : (
                "Save Settings"
              )}
            </Button>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} id="settings-form">
        {activeTab === null ? (
          <SettingsHub
            onOpen={setActiveTab}
            stripeConnected={settings?.stripe_account_status === "active"}
          />
        ) : (
          <>
            <button
              type="button"
              onClick={() => setActiveTab(null)}
              className="mb-6 inline-flex items-center gap-1.5 text-sm font-semibold text-content-muted transition-colors hover:text-content dark:text-content-subtle dark:hover:text-content-inverted"
            >
              <ArrowLeft className="h-4 w-4" />
              All settings
            </button>
            <Tabs
              value={activeTab}
              onValueChange={setActiveTab}
              className="space-y-6"
            >
              {/* Desktop tabs */}
              <TabsList className="hidden md:flex w-full overflow-x-auto scrollbar-hide bg-ink-100 dark:bg-ink-800 p-1 rounded-lg justify-start">
                <TabsTrigger
                  value="business"
                  className="text-sm px-3 py-2 whitespace-nowrap flex-1 text-ink-700 data-[state=active]:bg-surface data-[state=active]:text-content dark:data-[state=active]:bg-ink-700 dark:text-ink-300 dark:data-[state=active]:text-content-inverted"
                >
                  Business
                </TabsTrigger>
                <TabsTrigger
                  value="security"
                  className="text-sm px-3 py-2 whitespace-nowrap flex-1 text-ink-700 data-[state=active]:bg-surface data-[state=active]:text-content dark:data-[state=active]:bg-ink-700 dark:text-ink-300 dark:data-[state=active]:text-content-inverted"
                >
                  Security
                </TabsTrigger>
                <TabsTrigger
                  value="billing"
                  className="text-sm px-3 py-2 whitespace-nowrap flex-1 text-ink-700 data-[state=active]:bg-surface data-[state=active]:text-content dark:data-[state=active]:bg-ink-700 dark:text-ink-300 dark:data-[state=active]:text-content-inverted"
                >
                  Billing
                </TabsTrigger>
                <TabsTrigger
                  value="payments"
                  className="text-sm px-3 py-2 whitespace-nowrap flex-1 text-ink-700 data-[state=active]:bg-surface data-[state=active]:text-content dark:data-[state=active]:bg-ink-700 dark:text-ink-300 dark:data-[state=active]:text-content-inverted"
                >
                  Payments
                </TabsTrigger>
                <TabsTrigger
                  value="calendar"
                  className="text-sm px-3 py-2 whitespace-nowrap flex-1 text-ink-700 data-[state=active]:bg-surface data-[state=active]:text-content dark:data-[state=active]:bg-ink-700 dark:text-ink-300 dark:data-[state=active]:text-content-inverted"
                >
                  Calendar
                </TabsTrigger>
                <TabsTrigger
                  value="notifications"
                  className="text-sm px-3 py-2 whitespace-nowrap flex-1 text-ink-700 data-[state=active]:bg-surface data-[state=active]:text-content dark:data-[state=active]:bg-ink-700 dark:text-ink-300 dark:data-[state=active]:text-content-inverted"
                >
                  Notifications
                </TabsTrigger>
                <TabsTrigger
                  value="appearance"
                  className="text-sm px-3 py-2 whitespace-nowrap flex-1 text-ink-700 data-[state=active]:bg-surface data-[state=active]:text-content dark:data-[state=active]:bg-ink-700 dark:text-ink-300 dark:data-[state=active]:text-content-inverted"
                >
                  Appearance
                </TabsTrigger>
                <TabsTrigger
                  value="template"
                  className="text-sm px-3 py-2 whitespace-nowrap flex-1 text-ink-700 data-[state=active]:bg-surface data-[state=active]:text-content dark:data-[state=active]:bg-ink-700 dark:text-ink-300 dark:data-[state=active]:text-content-inverted"
                >
                  PDF Templates
                </TabsTrigger>
                <TabsTrigger
                  value="legal"
                  className="text-sm px-3 py-2 whitespace-nowrap flex-1 text-ink-700 data-[state=active]:bg-surface data-[state=active]:text-content dark:data-[state=active]:bg-ink-700 dark:text-ink-300 dark:data-[state=active]:text-content-inverted"
                >
                  Legal
                </TabsTrigger>
                <TabsTrigger
                  value="contact"
                  className="text-sm px-3 py-2 whitespace-nowrap flex-1 text-ink-700 data-[state=active]:bg-surface data-[state=active]:text-content dark:data-[state=active]:bg-ink-700 dark:text-ink-300 dark:data-[state=active]:text-content-inverted"
                >
                  Contact
                </TabsTrigger>
              </TabsList>

              {/* Mobile scrollable tab pills */}
              <div className="md:hidden -mx-4 px-4">
                <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                  {[
                    { value: "business", label: "Business" },
                    { value: "security", label: "Security" },
                    { value: "billing", label: "Billing" },
                    { value: "payments", label: "Payments" },
                    { value: "calendar", label: "Calendar" },
                    { value: "notifications", label: "Alerts" },
                    { value: "appearance", label: "Theme" },
                    { value: "template", label: "PDF" },
                    { value: "legal", label: "Legal" },
                    { value: "contact", label: "Support" },
                  ].map((tab) => (
                    <button
                      key={tab.value}
                      type="button"
                      onClick={() => setActiveTab(tab.value)}
                      className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-semibold transition-all ${
                        activeTab === tab.value
                          ? "bg-success-600 text-content-inverted shadow-md shadow-success-500/20"
                          : "bg-surface dark:bg-ink-800 text-content-body dark:text-content-subtle border border-line dark:border-ink-700"
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Business Information Tab */}
              <TabsContent value="business">
                <Card className="border-none shadow-lg bg-surface dark:bg-surface-inverted dark:border dark:border-ink-800">
                  <CardHeader>
                    <CardTitle className="text-content dark:text-content-inverted">
                      Business Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <Label
                          htmlFor="business_name"
                          className="text-ink-700 dark:text-ink-300"
                        >
                          Business Name *
                        </Label>
                        <Input
                          id="business_name"
                          value={formData.business_name ?? ""}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              business_name: e.target.value,
                            })
                          }
                          required
                          className="bg-surface dark:bg-ink-800 border-line-strong dark:border-ink-700 text-content dark:text-content-inverted"
                        />
                      </div>
                      <div>
                        <Label
                          htmlFor="email"
                          className="text-ink-700 dark:text-ink-300"
                        >
                          Email
                        </Label>
                        <Input
                          id="email"
                          type="email"
                          value={formData.email ?? ""}
                          onChange={(e) =>
                            setFormData({ ...formData, email: e.target.value })
                          }
                          className="bg-surface dark:bg-ink-800 border-line-strong dark:border-ink-700 text-content dark:text-content-inverted"
                        />
                      </div>
                    </div>

                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <Label
                          htmlFor="phone"
                          className="text-ink-700 dark:text-ink-300"
                        >
                          Phone
                        </Label>
                        <Input
                          id="phone"
                          value={formData.phone ?? ""}
                          onChange={(e) =>
                            setFormData({ ...formData, phone: e.target.value })
                          }
                          className="bg-surface dark:bg-ink-800 border-line-strong dark:border-ink-700 text-content dark:text-content-inverted"
                        />
                      </div>
                      <div>
                        <Label
                          htmlFor="website"
                          className="text-ink-700 dark:text-ink-300"
                        >
                          Website
                        </Label>
                        <Input
                          id="website"
                          value={formData.website ?? ""}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              website: e.target.value,
                            })
                          }
                          placeholder="https://yourcompany.com"
                          className="bg-surface dark:bg-ink-800 border-line-strong dark:border-ink-700 text-content dark:text-content-inverted"
                        />
                      </div>
                    </div>

                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <Label
                          htmlFor="tax_rate"
                          className="text-ink-700 dark:text-ink-300"
                        >
                          Default Tax Rate (%)
                        </Label>
                        <Input
                          id="tax_rate"
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="0"
                          value={formData.tax_rate || ""}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              tax_rate:
                                e.target.value === ""
                                  ? 0
                                  : parseFloat(e.target.value) || 0,
                            })
                          }
                          className="bg-surface dark:bg-ink-800 border-line-strong dark:border-ink-700 text-content dark:text-content-inverted"
                        />
                      </div>
                      <div>
                        <Label
                          htmlFor="hourly_rate"
                          className="text-ink-700 dark:text-ink-300"
                        >
                          Hourly Labor Rate ($)
                        </Label>
                        <Input
                          id="hourly_rate"
                          type="number"
                          min="0"
                          step="0.01"
                          value={formData.hourly_rate ?? ""}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              hourly_rate: parseFloat(e.target.value) || 0,
                            })
                          }
                          placeholder="e.g., 75.00"
                          className="bg-surface dark:bg-ink-800 border-line-strong dark:border-ink-700 text-content dark:text-content-inverted"
                        />

                        <p className="text-sm text-content-muted dark:text-content-subtle mt-1">
                          Your default hourly rate for labor calculations
                        </p>
                      </div>
                    </div>

                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <Label
                          htmlFor="invoice_prefix"
                          className="text-ink-700 dark:text-ink-300"
                        >
                          Invoice Number Prefix
                        </Label>
                        <Input
                          id="invoice_prefix"
                          value={formData.invoice_prefix ?? ""}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              invoice_prefix: e.target.value,
                            })
                          }
                          placeholder="e.g., INV, INVOICE"
                          className="bg-surface dark:bg-ink-800 border-line-strong dark:border-ink-700 text-content dark:text-content-inverted"
                        />
                      </div>
                      <div>
                        <Label
                          htmlFor="payment_terms"
                          className="text-ink-700 dark:text-ink-300"
                        >
                          Default Payment Terms
                        </Label>
                        <Input
                          id="payment_terms"
                          value={formData.payment_terms ?? ""}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              payment_terms: e.target.value,
                            })
                          }
                          placeholder="e.g., Net 30, Due on Receipt, Payment due within 15 days"
                          className="bg-surface dark:bg-ink-800 border-line-strong dark:border-ink-700 text-content dark:text-content-inverted"
                        />

                        <p className="text-sm text-content-muted dark:text-content-subtle mt-1">
                          This will be the default for new invoices (can be
                          customized per invoice)
                        </p>
                      </div>
                    </div>

                    {/*
                      Whether clients can respond to a quote from its public
                      link. Sits with the document defaults rather than in a
                      section of its own -- it is a default for how documents
                      behave once they leave here, which is what everything else
                      in this block is.

                      The switch only controls what the CLIENT'S page offers.
                      get-public-quote reads this column to decide whether to
                      send the capabilities, and approve-quote reads it again
                      before accepting a response, because hiding a button is
                      not a control -- the endpoint is reachable directly by
                      anyone holding the link.
                    */}
                    <div className="flex items-start justify-between gap-4 rounded-lg border border-line dark:border-ink-700 p-4">
                      <div className="flex-1">
                        <Label
                          htmlFor="allow_client_quote_approval"
                          className="text-ink-700 dark:text-ink-300 cursor-pointer"
                        >
                          Let clients approve or decline quotes online
                        </Label>
                        <p className="text-sm text-content-muted dark:text-content-subtle mt-1">
                          {formData.allow_client_quote_approval === false
                            ? "Clients can view and download their quote, but not respond to it. You set the status yourself."
                            : "Adds Approve and Decline buttons to the quote link you send. Each one asks the client to type their name to confirm, and records who responded."}
                        </p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer flex-shrink-0 mt-1">
                        <input
                          type="checkbox"
                          id="allow_client_quote_approval"
                          checked={formData.allow_client_quote_approval !== false}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              allow_client_quote_approval: e.target.checked,
                            })
                          }
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-ink-200 dark:bg-ink-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-success-300 dark:peer-focus:ring-success-700 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-content-inverted after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-surface after:border-line-strong dark:after:border-ink-600 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-success-600 dark:peer-checked:bg-success-600 dark:after:bg-surface-inverted"></div>
                      </label>
                    </div>

                    <div>
                      <Label
                        htmlFor="address"
                        className="text-ink-700 dark:text-ink-300"
                      >
                        Business Address
                      </Label>
                      <Textarea
                        id="address"
                        value={formData.address ?? ""}
                        onChange={(e) =>
                          setFormData({ ...formData, address: e.target.value })
                        }
                        rows={3}
                        placeholder="Street Address, City, Province, Postal Code"
                        className="bg-surface dark:bg-ink-800 border-line-strong dark:border-ink-700 text-content dark:text-content-inverted"
                      />
                    </div>

                    <div>
                      <Label
                        htmlFor="logo"
                        className="text-ink-700 dark:text-ink-300"
                      >
                        Business Logo
                      </Label>
                      <div className="flex flex-col gap-4">
                        {formData.logo_url && (
                          <div className="flex items-center gap-4">
                            <img
                              src={formData.logo_url}
                              alt="Logo"
                              className="w-32 h-32 object-contain border dark:border-ink-700 rounded p-2 bg-surface dark:bg-ink-800"
                            />
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => {
                                setFormData({ ...formData, logo_url: "" }); // Clear the URL
                                setLogoFile(null); // Clear the file object as well
                              }}
                              className="text-danger-600 dark:text-danger-400 hover:text-danger-700 dark:hover:text-danger-300 border-danger-300 dark:border-danger-800"
                            >
                              Remove Logo
                            </Button>
                          </div>
                        )}
                        <label className="cursor-pointer">
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleLogoUpload}
                            className="hidden"
                          />

                          <div className="flex items-center gap-2 px-4 py-2 border dark:border-ink-700 rounded-lg hover:bg-surface-sunken dark:hover:bg-ink-800 transition-colors w-fit bg-surface dark:bg-ink-800">
                            {uploadingLogo ? (
                              <Loader2 className="w-4 h-4 animate-spin text-content-body dark:text-content-subtle" />
                            ) : (
                              <Upload className="w-4 h-4 text-content-body dark:text-content-subtle" />
                            )}
                            <span className="text-sm text-ink-700 dark:text-ink-300">
                              {uploadingLogo
                                ? "Uploading..."
                                : formData.logo_url
                                  ? "Change Logo"
                                  : "Upload Logo"}
                            </span>
                          </div>
                        </label>
                      </div>
                      <p className="text-xs text-content-muted dark:text-content-subtle mt-2 flex items-start gap-1">
                        <Info className="w-3 h-3 mt-0.5 flex-shrink-0" />
                        <span>
                          Upload a square logo for best results. The logo will
                          appear on your invoices and quotes.
                        </span>
                      </p>
                    </div>

                    <div>
                      <Label
                        htmlFor="review_link"
                        className="text-ink-700 dark:text-ink-300"
                      >
                        Customer Review Link (Optional)
                      </Label>
                      <Input
                        id="review_link"
                        value={formData.review_link || ""}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            review_link: e.target.value,
                          })
                        }
                        placeholder="https://g.page/r/..."
                        className="bg-surface dark:bg-ink-800 border-line-strong dark:border-ink-700 text-content dark:text-content-inverted"
                      />

                      <p className="text-sm text-content-muted dark:text-content-subtle mt-1">
                        Add your Google, Yelp, or Facebook review link. This
                        will be included in invoice SMS notifications.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Security Tab */}
              <TabsContent value="security">
                <Card className="border-none shadow-lg bg-surface dark:bg-surface-inverted dark:border dark:border-ink-800">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-content dark:text-content-inverted">
                      <Lock className="w-5 h-5 text-success-600 dark:text-success-400" />
                      Security
                    </CardTitle>
                    <p className="text-sm text-content-body dark:text-content-subtle">
                      Change the password used to sign in to Invoicium
                    </p>
                  </CardHeader>
                  <CardContent>
                    <div className="max-w-sm space-y-4">
                      <div>
                        <Label
                          htmlFor="new-password"
                          className="text-ink-700 dark:text-ink-300"
                        >
                          New Password
                        </Label>
                        <Input
                          id="new-password"
                          type="password"
                          autoComplete="new-password"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          placeholder="••••••••••••"
                          className="mt-1.5"
                        />
                        <PasswordStrength
                          value={newPassword}
                          className="mt-3"
                        />
                      </div>
                      <div>
                        <Label
                          htmlFor="confirm-new-password"
                          className="text-ink-700 dark:text-ink-300"
                        >
                          Confirm New Password
                        </Label>
                        <Input
                          id="confirm-new-password"
                          type="password"
                          autoComplete="new-password"
                          value={confirmNewPassword}
                          onChange={(e) =>
                            setConfirmNewPassword(e.target.value)
                          }
                          placeholder="••••••••••••"
                          className="mt-1.5"
                        />
                      </div>
                      <Button
                        type="button"
                        onClick={handleChangePassword}
                        disabled={changingPassword || !newPassword}
                        className="bg-brand hover:bg-brand-hover text-content-inverted"
                      >
                        {changingPassword && (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        )}
                        Update Password
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* NEW: Billing Tab */}
              <TabsContent value="billing">
                <Card className="border-none shadow-lg bg-surface dark:bg-surface-inverted dark:border dark:border-ink-800">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-content dark:text-content-inverted">
                      <CreditCard className="w-5 h-5" />
                      Subscription & Billing
                    </CardTitle>
                    <p className="text-sm text-content-body dark:text-content-subtle">
                      Manage your Invoicium subscription plan
                    </p>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {subscription ? (
                      <>
                        {/* Current Plan Card */}
                        <Card className="border-2 border-success-200 dark:border-success-800 bg-success-50/30 dark:bg-success-900/20">
                          <CardContent className="mx-1 pt-0 p-6">
                            <div className="flex items-start justify-between mb-4">
                              <div>
                                <h3 className="text-2xl font-black text-content dark:text-content-inverted capitalize mb-1">
                                  {subscription.plan_name} Plan
                                </h3>
                                <p className="text-sm text-content-body dark:text-content-subtle capitalize">
                                  {subscription.billing_cycle === "yearly"
                                    ? "Annual"
                                    : "Monthly"}{" "}
                                  Billing
                                </p>
                              </div>
                              <Badge
                                className={`${
                                  subscription.status === "active"
                                    ? "bg-success-100 text-success-700 dark:bg-success-900 dark:text-success-300 hover:bg-success-100 dark:hover:bg-success-900"
                                    : subscription.status === "trial" ||
                                        subscription.status === "trialing"
                                      ? "bg-info-100 text-info-700 dark:bg-info-900 dark:text-info-300 hover:bg-info-100 dark:hover:bg-info-900"
                                      : "bg-ink-100 text-ink-700 dark:bg-ink-800 dark:text-ink-300 hover:bg-ink-100 dark:hover:bg-ink-800"
                                }`}
                              >
                                {subscription.status === "trialing"
                                  ? "Trial"
                                  : subscription.status}
                              </Badge>
                            </div>

                            <div className="grid md:grid-cols-2 gap-4 mb-4">
                              <div>
                                <p className="text-sm text-content-body dark:text-content-subtle">
                                  Invoice Limit
                                </p>
                                <p className="text-lg font-semibold text-content dark:text-content-inverted">
                                  {isUnlimited(subscription)
                                    ? "Unlimited"
                                    : `${getTransactionAllowance(subscription)} / month`}
                                </p>
                              </div>
                              <div>
                                <p className="text-sm text-content-body dark:text-content-subtle">
                                  Invoices Used This Month
                                </p>
                                <p className="text-lg font-semibold text-content dark:text-content-inverted">
                                  {subscription.transactions_used_this_month !==
                                    undefined &&
                                  subscription.transactions_used_this_month !==
                                    null ? (
                                    subscription.transactions_used_this_month
                                  ) : (
                                    <span className="text-danger-600 dark:text-danger-400">
                                      Not Set
                                    </span>
                                  )}
                                </p>
                              </div>
                              <div>
                                <p className="text-sm text-content-body dark:text-content-subtle">
                                  Platform Processing Fee
                                </p>
                                <p className="text-lg font-semibold text-content dark:text-content-inverted">
                                  {getProcessingFeePercent(subscription)}%
                                </p>
                              </div>
                            </div>

                            {subscription.next_billing_date && (
                              <div className="pt-4 border-t border-success-200 dark:border-success-800">
                                <p className="text-sm text-content-body dark:text-content-subtle">
                                  Next Billing Date
                                </p>
                                <p className="font-medium text-content dark:text-content-inverted">
                                  {format(
                                    new Date(subscription.next_billing_date),
                                    "MMMM d, yyyy",
                                  )}
                                </p>
                              </div>
                            )}
                          </CardContent>
                        </Card>

                        {/*
                          The "Subscription Limits Not Configured / Auto-Fix Now"
                          card lived here. Removed, not repaired.

                          It called fixSubscriptionLimits, which was a
                          client-side stub returning success:true -- so the
                          button reported "Fixed 1 subscription(s) successfully!"
                          having done nothing.

                          It was also aimed at the wrong problem. The limits are
                          not missing; they are WRONG, because stripe-webhook and
                          confirm-and-activate wrote a stale table (essential 75
                          vs 100, professional 250/1%% vs 300/0.75%%, enterprise
                          500/1%% vs 750/0.5%%). Both now derive from
                          _shared/plan-limits.ts, and check-plan-parity.cjs fails
                          the build if that drifts from config/plans.js.

                          Reads go through getTransactionAllowance(), which
                          resolves from plan_name and never returns less than the
                          stored value, so a stale row cannot cap a paying user.
                          There is nothing left for a repair button to repair.
                        */}

                        {/* Change Plan Button */}
                        <div className="flex justify-center">
                          <Link to={createPageUrl("Pricing")}>
                            <Button
                              size="lg"
                              className="bg-brand hover:bg-brand-hover dark:bg-brand dark:hover:bg-brand-hover"
                            >
                              <ArrowRight className="w-4 h-4 mr-2" />
                              View All Plans & Change Plan
                            </Button>
                          </Link>
                        </div>

                        {/* Manage Billing */}
                        <Card className="bg-brand-50 border-brand-200 dark:border-brand-800 dark:bg-brand-900/20">
                          <CardHeader>
                            <CardTitle className="text-lg flex items-center gap-2 text-content dark:text-content-inverted">
                              <CreditCard className="w-5 h-5 text-brand-600 dark:text-brand-400" />
                              Billing Management
                            </CardTitle>
                            <p className="text-sm text-content-body dark:text-content-subtle">
                              Manage your payment methods, view invoices, and
                              update billing details
                            </p>
                          </CardHeader>
                          <CardContent className="space-y-4">
                            <Button
                              onClick={async () => {
                                try {
                                  setLoading(true);
                                  const response = await sdk.functions.invoke(
                                    "getStripeCustomerPortal",
                                  );
                                  if (response.data?.url) {
                                    window.location.href = response.data.url;
                                  } else {
                                    // The SDK reports Edge Function failures as
                                    // { success: false, error } rather than
                                    // throwing, so read the server's own message
                                    // instead of replacing it with a generic one.
                                    throw new Error(
                                      response.data?.error ||
                                        "No portal URL received",
                                    );
                                  }
                                } catch (error) {
                                  console.error("Portal error:", error);
                                  setSaveMessage(
                                    error.message ||
                                      "Failed to open billing portal",
                                  );
                                  setTimeout(() => setSaveMessage(null), 6000);
                                } finally {
                                  setLoading(false);
                                }
                              }}
                              disabled={loading}
                              className="w-full bg-brand-600 hover:bg-brand dark:bg-brand dark:hover:bg-brand-hover"
                            >
                              {loading ? (
                                <>
                                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                  Opening...
                                </>
                              ) : (
                                <>
                                  <ExternalLink className="w-4 h-4 mr-2" />
                                  Open Stripe Billing Portal
                                </>
                              )}
                            </Button>

                            <div className="p-3 bg-surface dark:bg-ink-800 rounded-lg border dark:border-ink-700">
                              <p className="text-sm text-ink-700 dark:text-ink-300 font-medium mb-2">
                                In the portal you can:
                              </p>
                              <ul className="text-xs text-content-body dark:text-content-subtle space-y-1">
                                <li>• Update payment method</li>
                                <li>• View and download all invoices</li>
                                <li>• Update billing information</li>
                                <li>• View payment history</li>
                                <li>• Cancel subscription (if needed)</li>
                              </ul>
                            </div>
                          </CardContent>
                        </Card>

                        {/* Billing History */}
                        <Card className="border-line dark:border-ink-800 bg-surface dark:bg-surface-inverted">
                          <CardHeader>
                            <div className="flex items-center justify-between">
                              <CardTitle className="text-lg flex items-center gap-2 text-content dark:text-content-inverted">
                                <File className="w-5 h-5 text-content-body dark:text-content-subtle" />
                                Recent Billing History
                              </CardTitle>
                              <Button
                                onClick={loadBillingHistory}
                                variant="outline"
                                size="sm"
                                disabled={loadingBilling}
                                className="dark:border-ink-700 dark:text-ink-300 dark:hover:bg-ink-800"
                              >
                                {loadingBilling ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <>
                                    <RotateCcw className="w-4 h-4 mr-2" />
                                    Refresh
                                  </>
                                )}
                              </Button>
                            </div>
                          </CardHeader>
                          <CardContent>
                            {loadingBilling ? (
                              <div className="py-8 text-center">
                                <Loader2 className="w-8 h-8 animate-spin mx-auto text-content-subtle dark:text-content-body dark:dark:text-ink-300" />
                              </div>
                            ) : billingHistory.invoices.length > 0 ? (
                              <div className="space-y-3">
                                {billingHistory.invoices
                                  .slice(0, 10)
                                  .map((invoice) => (
                                    <div
                                      key={invoice.id}
                                      className="flex items-center justify-between p-4 border dark:border-ink-700 rounded-lg hover:bg-surface-sunken dark:hover:bg-ink-800 transition-colors bg-surface dark:bg-ink-800/50"
                                    >
                                      <div className="flex-1">
                                        <div className="flex items-center gap-3">
                                          <div
                                            className={`w-2 h-2 rounded-full ${
                                              invoice.paid
                                                ? "bg-success-500"
                                                : invoice.status === "open"
                                                  ? "bg-caution-500"
                                                  : "bg-danger-500"
                                            }`}
                                          />
                                          <div>
                                            <p className="font-medium text-content dark:text-content-inverted">
                                              {invoice.description}
                                            </p>
                                            <p className="text-sm text-content-muted dark:text-content-subtle">
                                              {format(
                                                new Date(
                                                  invoice.created * 1000,
                                                ),
                                                "MMM d, yyyy",
                                              )}
                                            </p>
                                          </div>
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-4">
                                        <div className="text-right">
                                          <p className="font-semibold text-content dark:text-content-inverted">
                                            ${invoice.amount.toFixed(2)}{" "}
                                            {invoice.currency}
                                          </p>
                                          <p
                                            className={`text-xs font-medium ${
                                              invoice.paid
                                                ? "text-success-600 dark:text-success-400"
                                                : invoice.status === "open"
                                                  ? "text-caution-600 dark:text-caution-400"
                                                  : "text-danger-600 dark:text-danger-400"
                                            }`}
                                          >
                                            {invoice.paid
                                              ? "Paid"
                                              : invoice.status === "open"
                                                ? "Open"
                                                : "Failed"}
                                          </p>
                                        </div>
                                        {invoice.invoice_pdf && (
                                          <a
                                            href={invoice.invoice_pdf}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="p-2 hover:bg-ink-100 dark:hover:bg-ink-700 rounded-lg transition-colors"
                                          >
                                            <Download className="w-4 h-4 text-content-body dark:text-content-subtle" />
                                          </a>
                                        )}
                                      </div>
                                    </div>
                                  ))}
                              </div>
                            ) : (
                              <div className="text-center py-8">
                                <File className="w-12 h-12 text-ink-300 dark:text-ink-700 mx-auto mb-3 dark:dark:text-ink-300" />
                                <p className="text-content-body dark:text-content-subtle">
                                  No billing history available
                                </p>
                                <p className="text-sm text-content-muted dark:text-content-muted mt-1">
                                  Your invoices will appear here after your
                                  first payment
                                </p>
                              </div>
                            )}
                          </CardContent>
                        </Card>

                        {/* Payment Methods */}
                        {billingHistory.payment_methods.length > 0 && (
                          <Card className="border-line dark:border-ink-800 bg-surface dark:bg-surface-inverted">
                            <CardHeader>
                              <CardTitle className="text-lg flex items-center gap-2 text-content dark:text-content-inverted">
                                <CreditCard className="w-5 h-5 text-content-body dark:text-content-subtle" />
                                Payment Methods
                              </CardTitle>
                            </CardHeader>
                            <CardContent>
                              <div className="space-y-3">
                                {billingHistory.payment_methods.map((pm) => (
                                  <div
                                    key={pm.id}
                                    className="flex items-center justify-between p-4 border dark:border-ink-700 rounded-lg bg-surface dark:bg-ink-800/50"
                                  >
                                    <div className="flex items-center gap-3">
                                      <div className="w-10 h-10 rounded-lg bg-ink-100 dark:bg-ink-700 flex items-center justify-center">
                                        <CreditCard className="w-5 h-5 text-content-body dark:text-content-subtle" />
                                      </div>
                                      <div>
                                        <p className="font-medium text-content dark:text-content-inverted capitalize">
                                          {pm.brand} •••• {pm.last4}
                                        </p>
                                        <p className="text-sm text-content-muted dark:text-content-subtle">
                                          Expires {pm.exp_month}/{pm.exp_year}
                                        </p>
                                      </div>
                                    </div>
                                    {pm.is_default && (
                                      <Badge className="bg-success-100 text-success-700 dark:bg-success-900 dark:text-success-300 hover:bg-success-100 dark:hover:bg-success-900">
                                        Default
                                      </Badge>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </CardContent>
                          </Card>
                        )}
                      </>
                    ) : (
                      <div className="text-center py-12 bg-surface dark:bg-surface-inverted rounded-lg border dark:border-ink-800">
                        <CreditCard className="w-12 h-12 text-ink-300 dark:text-ink-700 mx-auto mb-4 dark:dark:text-ink-300" />
                        <h3 className="text-lg font-black text-content dark:text-content-inverted mb-2">
                          No Active Subscription
                        </h3>
                        <p className="text-content-body dark:text-content-subtle mb-6">
                          Choose a plan to start using Invoicium
                        </p>
                        <Link to={createPageUrl("Pricing")}>
                          <Button className="bg-brand hover:bg-brand-hover dark:bg-brand dark:hover:bg-brand-hover">
                            View Pricing Plans
                          </Button>
                        </Link>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Notifications Tab */}
              <TabsContent value="notifications">
                <div className="bg-surface dark:bg-surface-inverted rounded-lg border dark:border-ink-800">
                  <NotificationSettings />
                </div>
              </TabsContent>

              {/* Appearance Tab */}
              <TabsContent value="appearance">
                <Card className="border-none shadow-lg bg-surface dark:bg-surface-inverted dark:border dark:border-ink-800">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-content dark:text-content-inverted">
                      <Palette className="w-5 h-5 text-success-600 dark:text-success-400" />
                      Appearance
                    </CardTitle>
                    <p className="text-sm text-content-body dark:text-content-subtle">
                      Customize how Invoicium looks on your device
                    </p>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div>
                      <Label className="text-ink-700 dark:text-ink-300 mb-4 block">
                        Theme Preference
                      </Label>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        {[
                          {
                            id: "light",
                            icon: Sun,
                            label: "Light Mode",
                            desc: "Clean and bright interface",
                            color: "bg-warning-400",
                          },
                          {
                            id: "dark",
                            icon: Moon,
                            label: "Dark Mode",
                            desc: "Easy on the eyes",
                            color: "bg-brand-600",
                          },
                          {
                            id: "system",
                            icon: Monitor,
                            label: "System Default",
                            desc: "Follow device settings",
                            color: "bg-ink-600",
                          },
                        ].map((theme) => {
                          const Icon = theme.icon;
                          const stored = localStorage.getItem(
                            "invoicium-dark-mode",
                          );
                          const isSystem = stored === null;
                          const isActive =
                            (theme.id === "system" && isSystem) ||
                            (theme.id === "light" &&
                              !isSystem &&
                              stored === "false") ||
                            (theme.id === "dark" &&
                              !isSystem &&
                              stored === "true");

                          return (
                            <button
                              key={theme.id}
                              type="button"
                              onClick={() => toggleDarkMode(theme.id)}
                              className={`relative border-2 rounded-xl p-6 transition-all text-left ${
                                isActive
                                  ? "border-success-500 bg-success-50 dark:bg-success-900/30"
                                  : "border-line dark:border-ink-700 hover:border-line-strong dark:hover:border-ink-600 bg-surface dark:bg-ink-800"
                              }`}
                            >
                              {isActive && (
                                <div className="absolute top-3 right-3">
                                  <CheckCircle className="w-5 h-5 text-success-600 dark:text-success-400" />
                                </div>
                              )}

                              <div
                                className={`w-12 h-12 rounded-xl ${theme.color} flex items-center justify-center mb-4 shadow-lg`}
                              >
                                <Icon className="w-6 h-6 text-content-inverted" />
                              </div>

                              <h3 className="font-black text-content dark:text-content-inverted mb-1">
                                {theme.label}
                              </h3>
                              <p className="text-sm text-content-body dark:text-content-subtle">
                                {theme.desc}
                              </p>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="p-4 bg-brand-50 dark:bg-brand-900/20 rounded-lg border border-info-200 dark:border-info-800">
                      <div className="flex items-start gap-2">
                        <Info className="w-4 h-4 mt-0.5 flex-shrink-0 text-brand-700 dark:text-brand-400" />
                        <div className="text-sm text-info-800 dark:text-info-200">
                          <p className="font-medium mb-1">
                            Theme applies across all devices
                          </p>
                          <p className="text-xs text-brand-800 dark:text-brand-300">
                            Your theme preference is saved to your browser. Use
                            "System Default" to automatically match your
                            device's dark mode setting.
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Animated background ------------------------------- */}
                    <div>
                      <Label className="text-ink-700 dark:text-ink-300 mb-4 block">
                        Background
                      </Label>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={shaderBackground}
                        onClick={() => setShaderBackgroundEnabled(!shaderBackground)}
                        className={`flex w-full items-center gap-4 rounded-xl border-2 p-6 text-left transition-all ${
                          shaderBackground
                            ? "border-success-500 bg-success-50 dark:bg-success-900/30"
                            : "border-line bg-surface hover:border-line-strong dark:border-ink-700 dark:bg-ink-800 dark:hover:border-ink-600"
                        }`}
                      >
                        <span className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#1b6ba8] to-[#5ad2f4] shadow-lg">
                          <Waves className="h-5 w-5 text-white" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block font-bold text-content dark:text-content-inverted">
                            Animated background
                          </span>
                          <span className="block text-sm text-content-body dark:text-content-subtle">
                            A slow wave behind your pages instead of the flat
                            colour. Your cards and text are unchanged.
                          </span>
                        </span>
                        <span
                          className={`relative h-6 w-11 flex-shrink-0 rounded-full transition-colors ${
                            shaderBackground
                              ? "bg-success-600"
                              : "bg-ink-300 dark:bg-ink-600"
                          }`}
                        >
                          <span
                            className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
                              shaderBackground ? "left-[1.375rem]" : "left-0.5"
                            }`}
                          />
                        </span>
                      </button>
                      <p className="mt-2 text-xs text-content-muted dark:text-content-subtle">
                        Saved to this browser, like your theme. It pauses when
                        the tab is hidden or scrolled out of view, so it costs
                        nothing while you are not looking at it.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Google Calendar & Booking Tab */}
              <TabsContent value="calendar">
                <CalendarSettings
                  formData={formData}
                  setFormData={setFormData}
                  settings={settings}
                  setSaveMessage={setSaveMessage}
                  loadSettings={loadSettings}
                />
              </TabsContent>

              {/* NEW: Payments Tab */}
              <TabsContent value="payments">
                <Card className="border-none shadow-lg bg-surface dark:bg-surface-inverted dark:border dark:border-ink-800">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-content dark:text-content-inverted">
                      <CreditCard className="w-5 h-5" />
                      Payment Settings
                    </CardTitle>
                    <p className="text-sm text-content-body dark:text-content-subtle">
                      Connect your Stripe account to receive payments from
                      clients
                    </p>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* Stripe Connection Status */}
                    <div className="p-6 border-2 rounded-lg dark:border-ink-700 bg-surface dark:bg-ink-800/50">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-lg bg-brand-100 dark:bg-brand-900/50 flex items-center justify-center">
                            <CreditCard className="w-6 h-6 text-brand-600 dark:text-brand-400" />
                          </div>
                          <div>
                            <h3 className="font-black text-content dark:text-content-inverted">
                              Stripe Account
                            </h3>
                            <p className="text-sm text-content-body dark:text-content-subtle">
                              Accept credit card payments online
                            </p>
                          </div>
                        </div>
                        {settings?.stripe_account_status === "active" && (
                          <CheckCircle className="w-6 h-6 text-success-600 dark:text-success-400" />
                        )}
                      </div>

                      {settings?.stripe_account_status === "active" ? (
                        <div className="space-y-4">
                          <div className="p-4 bg-success-50 dark:bg-success-900/20 border border-success-200 dark:border-success-800 rounded-lg">
                            <p className="text-sm text-success-800 dark:text-success-200 font-medium flex items-center gap-2">
                              <CheckCircle className="w-4 h-4" />
                              Your Stripe account is connected and active!
                            </p>
                            <p className="text-xs text-success-700 dark:text-success-300 mt-1">
                              You can now send payment links to clients and
                              receive payments directly.
                            </p>
                          </div>

                          <div className="flex flex-col sm:flex-row gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              onClick={handleConnectStripe}
                              disabled={connectingStripe}
                              className="flex-1 dark:border-ink-700 dark:text-ink-300 dark:hover:bg-ink-800"
                            >
                              {connectingStripe ? (
                                <>
                                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                  Opening...
                                </>
                              ) : (
                                <>
                                  <ExternalLink className="w-4 h-4 mr-2" />
                                  Manage
                                </>
                              )}
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              onClick={checkStripeAccountStatus}
                              className="flex-1 dark:border-ink-700 dark:text-ink-300 dark:hover:bg-ink-800"
                            >
                              Refresh
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              onClick={handleDisconnectStripe}
                              disabled={disconnectingStripe}
                              className="flex-1 text-danger-600 dark:text-danger-400 hover:text-danger-700 dark:hover:text-danger-300 border-danger-300 dark:border-danger-800"
                            >
                              {disconnectingStripe ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                "Disconnect"
                              )}
                            </Button>
                          </div>
                        </div>
                      ) : settings?.stripe_account_status === "pending" ? (
                        <div className="space-y-4">
                          <div className="p-4 bg-caution-50 dark:bg-caution-900/20 border border-caution-200 dark:border-caution-800 rounded-lg">
                            <p className="text-sm text-caution-800 dark:text-caution-200 font-medium">
                              Stripe account setup in progress
                            </p>
                            <p className="text-xs text-caution-700 dark:text-caution-300 mt-1">
                              Complete your Stripe onboarding to start accepting
                              payments.
                            </p>
                          </div>

                          <Button
                            type="button"
                            onClick={handleConnectStripe}
                            disabled={connectingStripe}
                            className="w-full bg-brand-600 hover:bg-brand dark:bg-brand dark:hover:bg-brand-hover"
                          >
                            {connectingStripe ? (
                              <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Opening Stripe...
                              </>
                            ) : (
                              "Complete Stripe Setup"
                            )}
                          </Button>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          <div className="p-4 bg-brand-50 dark:bg-brand-900/20 border border-info-200 dark:border-info-800 rounded-lg">
                            <p className="text-sm text-info-800 dark:text-info-200 mb-2">
                              <strong>Why connect Stripe?</strong>
                            </p>
                            <ul className="text-xs text-brand-800 dark:text-brand-300 space-y-1">
                              <li>
                                • Generate payment links for your invoices
                              </li>
                              <li>
                                • Accept credit and debit card payments online
                              </li>
                              <li>
                                • Automatic payment tracking and invoice updates
                              </li>
                              <li>
                                • Receive payouts directly to your bank account
                              </li>
                              <li>
                                • Only 1% platform fee + Stripe's standard rates
                              </li>
                            </ul>
                          </div>

                          <Button
                            type="button"
                            onClick={handleConnectStripe}
                            disabled={connectingStripe}
                            className="w-full bg-brand-600 hover:bg-brand"
                          >
                            {connectingStripe ? (
                              <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Connecting...
                              </>
                            ) : (
                              <>
                                <CreditCard className="w-4 h-4 mr-2" />
                                Connect Stripe Account
                              </>
                            )}
                          </Button>

                          <p className="text-xs text-content-muted dark:text-content-subtle text-center">
                            You'll be redirected to Stripe to complete the
                            secure onboarding process
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Payment Information */}
                    <div className="p-4 bg-surface-sunken dark:bg-ink-800 rounded-lg border dark:border-ink-700">
                      <h4 className="font-semibold text-content dark:text-content-inverted mb-3">
                        Payment Processing Fees
                      </h4>
                      <div className="space-y-2 text-sm text-ink-700 dark:text-ink-300">
                        <div className="flex justify-between">
                          <span>Invoicium Platform Fee:</span>
                          <span className="font-medium">1%</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Stripe Processing Fee:</span>
                          <span className="font-medium">2.9% + $0.30</span>
                        </div>
                        <div className="pt-2 border-t dark:border-ink-700 flex justify-between font-semibold text-content dark:text-content-inverted">
                          <span>Total Fees:</span>
                          <span>~3.9% + $0.30 per transaction</span>
                        </div>
                      </div>
                      <p className="text-xs text-content-body dark:text-content-subtle mt-3">
                        Example: For a $100 invoice, you receive ~$96.10 after
                        fees
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* PDF Templates Tab */}
              <TabsContent value="template">
                <PdfTemplateSettings
                  formData={formData}
                  setFormData={setFormData}
                  settings={settings}
                  setPreviewTemplate={setPreviewTemplate}
                  showCustomPreview={showCustomPreview}
                  setShowCustomPreview={setShowCustomPreview}
                />
              </TabsContent>

              {/* Legal Tab */}
              <TabsContent value="legal">
                <Card className="border-none shadow-lg bg-surface dark:bg-surface-inverted dark:border dark:border-ink-800">
                  <CardHeader>
                    <CardTitle className="text-content dark:text-content-inverted">
                      Legal Documents
                    </CardTitle>
                    <p className="text-sm text-content-body dark:text-content-subtle">
                      View our legal policies and terms
                    </p>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-4">
                      <Card className="border border-line dark:border-ink-700 hover:border-success-300 dark:hover:border-success-700 hover:shadow-md transition-all bg-surface dark:bg-ink-800">
                        <CardContent className="p-6">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <h3 className="text-lg font-black text-content dark:text-content-inverted mb-2">
                                Terms of Service
                              </h3>
                              <p className="text-sm text-content-body dark:text-content-subtle mb-4">
                                Read our complete Terms of Service, including
                                refund policy, liability disclaimers, and user
                                responsibilities.
                              </p>
                              <Link to={createPageUrl("TermsOfService")}>
                                <Button
                                  variant="outline"
                                  className="gap-2 dark:border-ink-700 dark:text-ink-300 dark:hover:bg-ink-800"
                                >
                                  <FileText className="w-4 h-4" />
                                  View Terms of Service
                                </Button>
                              </Link>
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      <Card className="border border-line dark:border-ink-700 hover:border-success-300 dark:hover:border-success-700 hover:shadow-md transition-all bg-surface dark:bg-ink-800">
                        <CardContent className="p-6">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <h3 className="text-lg font-black text-content dark:text-content-inverted mb-2">
                                Privacy Policy
                              </h3>
                              <p className="text-sm text-content-body dark:text-content-subtle mb-4">
                                Learn how we collect, use, and protect your
                                data. Required for Google Play and App Store
                                compliance.
                              </p>
                              <Link to={createPageUrl("PrivacyPolicy")}>
                                <Button
                                  variant="outline"
                                  className="gap-2 dark:border-ink-700 dark:text-ink-300 dark:hover:bg-ink-800"
                                >
                                  <FileText className="w-4 h-4" />
                                  View Privacy Policy
                                </Button>
                              </Link>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </div>

                    <div className="mt-6 p-4 bg-brand-50 dark:bg-brand-900/20 rounded-lg border border-info-200 dark:border-info-800">
                      <p className="text-sm text-info-800 dark:text-info-200">
                        <strong>Note:</strong> By using Invoicium, you agree to
                        our Terms of Service. Please review them carefully.
                      </p>
                    </div>

                    {/* Delete Account Section */}
                    <Card className="border-2 border-danger-300 dark:border-danger-800 bg-danger-50 dark:bg-danger-900/20 mt-6">
                      <CardContent className="p-6">
                        <h3 className="text-lg font-black text-danger-900 dark:text-danger-200 mb-2">
                          Delete Account
                        </h3>
                        <p className="text-sm text-danger-800 dark:text-danger-300 mb-4">
                          Permanently delete your Invoicium account and all
                          associated data. This action cannot be undone.
                        </p>
                        <p className="text-xs text-danger-700 dark:text-danger-400 mb-4">
                          This will delete: all invoices, quotes, clients, jobs,
                          photos, and business settings.
                        </p>
                        <Button
                          type="button"
                          onClick={async () => {
                            if (
                              !confirm(
                                "Are you absolutely sure you want to delete your account? This will permanently delete all your data and cannot be undone. Type DELETE to confirm.",
                              )
                            ) {
                              return;
                            }

                            const confirmation = prompt(
                              "Type DELETE to confirm account deletion:",
                            );
                            if (confirmation !== "DELETE") {
                              alert(
                                "Account deletion cancelled. You must type DELETE exactly to confirm.",
                              );
                              return;
                            }

                            try {
                              setSaving(true);
                              // Delete all user data
                              const userId = user.id;

                              // Delete all related entities
                              await Promise.all([
                                sdk.entities.Invoice.filter({
                                  user_id: userId,
                                }).then((items) =>
                                  Promise.all(
                                    items.map((item) =>
                                      sdk.entities.Invoice.delete(item.id),
                                    ),
                                  ),
                                ),
                                sdk.entities.Quote.filter({
                                  user_id: userId,
                                }).then((items) =>
                                  Promise.all(
                                    items.map((item) =>
                                      sdk.entities.Quote.delete(item.id),
                                    ),
                                  ),
                                ),
                                sdk.entities.Client.filter({
                                  user_id: userId,
                                }).then((items) =>
                                  Promise.all(
                                    items.map((item) =>
                                      sdk.entities.Client.delete(item.id),
                                    ),
                                  ),
                                ),
                                sdk.entities.Job.filter({
                                  user_id: userId,
                                }).then((items) =>
                                  Promise.all(
                                    items.map((item) =>
                                      sdk.entities.Job.delete(item.id),
                                    ),
                                  ),
                                ),
                                sdk.entities.BusinessSettings.filter({
                                  user_id: userId,
                                }).then((items) =>
                                  Promise.all(
                                    items.map((item) =>
                                      sdk.entities.BusinessSettings.delete(
                                        item.id,
                                      ),
                                    ),
                                  ),
                                ),
                                sdk.entities.Subscription.filter({
                                  user_id: userId,
                                }).then((items) =>
                                  Promise.all(
                                    items.map((item) =>
                                      sdk.entities.Subscription.delete(item.id),
                                    ),
                                  ),
                                ),
                              ]);

                              // Logout and redirect
                              await sdk.auth.logout();
                              window.location.href = createPageUrl("Home");
                            } catch (error) {
                              console.error("Error deleting account:", error);
                              setSaveMessage(
                                "Failed to delete account. Please contact support.",
                              );
                              setTimeout(() => setSaveMessage(null), 5000);
                            } finally {
                              setSaving(false);
                            }
                          }}
                          className="bg-danger-600 hover:bg-danger-700 dark:bg-danger-700 dark:hover:bg-danger-600 text-content-inverted"
                          disabled={saving}
                        >
                          {saving ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              Deleting...
                            </>
                          ) : (
                            "Delete My Account"
                          )}
                        </Button>
                      </CardContent>
                    </Card>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Contact Tab */}
              <TabsContent value="contact">
                <Card className="border-none shadow-lg bg-surface dark:bg-surface-inverted dark:border dark:border-ink-800">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-content dark:text-content-inverted">
                      <MessageSquare className="w-5 h-5 text-success-600 dark:text-success-400" />
                      Contact Support
                    </CardTitle>
                    <p className="text-sm text-content-body dark:text-content-subtle">
                      Get help from the Invoicium team
                    </p>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="p-6 bg-success-50 rounded-lg border border-success-200 dark:border-success-800 dark:bg-success-900/20">
                      <h3 className="text-lg font-black text-content dark:text-content-inverted mb-2">
                        Need Help?
                      </h3>
                      <p className="text-ink-700 dark:text-ink-300 mb-4">
                        Our support team is here to help you with any questions
                        or issues you may have.
                      </p>
                      <div className="space-y-3">
                        <div className="flex items-center gap-3 text-ink-700 dark:text-ink-300">
                          <Mail className="w-5 h-5 text-success-600 dark:text-success-400" />
                          <div>
                            <p className="font-medium text-content dark:text-content-inverted">
                              Email Support
                            </p>
                            <a
                              href="mailto:support@invoicium.ca"
                              className="text-success-600 dark:text-success-400 hover:text-success-700 dark:hover:text-success-300"
                            >
                              support@invoicium.ca
                            </a>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 text-ink-700 dark:text-ink-300">
                          <Clock className="w-5 h-5 text-success-600 dark:text-success-400" />
                          <div>
                            <p className="font-medium text-content dark:text-content-inverted">
                              Response Time
                            </p>
                            <p className="text-sm text-content-body dark:text-content-subtle">
                              Usually within 24 hours
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-center">
                      <Link
                        to={createPageUrl("Contact")}
                        className="w-full max-w-md"
                      >
                        <Button
                          type="button"
                          className="w-full bg-brand hover:bg-brand-hover dark:bg-brand dark:hover:bg-brand-hover"
                        >
                          <Mail className="w-4 h-4 mr-2" />
                          Email Directly
                        </Button>
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </>
        )}
      </form>

      {/* Reset Dialog */}
      <Dialog open={resetDialog} onOpenChange={setResetDialog}>
        <DialogContent className="bg-surface dark:bg-surface-inverted border dark:border-ink-800">
          <DialogHeader>
            <DialogTitle className="text-content dark:text-content-inverted">
              Reset to Default Settings
            </DialogTitle>
            <DialogDescription className="text-content-body dark:text-content-subtle">
              This will reset all settings to their default values except your
              business name. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-3 mt-4">
            <Button
              variant="outline"
              onClick={() => setResetDialog(false)}
              disabled={resetting}
              className="dark:border-ink-700 dark:text-ink-300 dark:hover:bg-ink-800"
            >
              Cancel
            </Button>
            <Button
              onClick={handleResetToDefaults}
              disabled={resetting}
              className="bg-danger-600 hover:bg-danger-700 dark:bg-danger-700 dark:hover:bg-danger-600"
            >
              {resetting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Resetting...
                </>
              ) : (
                "Reset Settings"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Template Preview Modal */}
      <TemplatePreviewModal
        template={previewTemplate}
        isOpen={!!previewTemplate}
        onClose={() => setPreviewTemplate(null)}
        onSelect={(templateId) => {
          setFormData({ ...formData, invoice_template: templateId });
          setPreviewTemplate(null);
        }}
        isSelected={previewTemplate?.id === formData.invoice_template}
      />

      {/* Save Message Display */}
      {saveMessage && (
        <div
          className={`fixed bottom-24 lg:bottom-6 right-4 left-4 sm:left-auto sm:w-80 p-4 rounded-xl shadow-2xl text-content-inverted z-50 text-sm font-medium ${
            saveMessage.includes("Failed") ||
            saveMessage.includes("Error") ||
            saveMessage.includes("unknown")
              ? "bg-danger-500"
              : "bg-success-600"
          }`}
        >
          {saveMessage}
        </div>
      )}
    </div>
  );
}
