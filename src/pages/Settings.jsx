import React, { useState, useEffect } from "react";
import { sdk } from "@/api/sdk";
import { MAX_LOGO_BYTES, RENDERABLE_LOGO_TYPES } from "@/lib/invoiceBrand";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import SettingsTabNav from "@/components/settings/tabs/SettingsTabNav";
import usePasswordChange from "@/components/settings/tabs/usePasswordChange";
import SettingsHub from "@/components/settings/SettingsHub";
import { ArrowLeft, ArrowRight, CreditCard, ExternalLink, Loader2 } from "lucide-react";
import TemplatePreviewModal from "../components/invoice/TemplatePreviewModal";
import PdfTemplateSettings from "../components/settings/PdfTemplateSettings";
import FeatureTour from "../components/onboarding/FeatureTour";
import NotificationSettings from "../components/notifications/NotificationSettings";
import CalendarSettings from "../components/settings/CalendarSettings";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import SettingsMobileHeader from "@/components/settings/tabs/SettingsMobileHeader";
import SettingsDesktopHeader from "@/components/settings/tabs/SettingsDesktopHeader";
import BusinessInfoTab from "@/components/settings/tabs/BusinessInfoTab";
import SecurityTab from "@/components/settings/tabs/SecurityTab";
import CurrentPlanCard from "@/components/settings/tabs/CurrentPlanCard";
import BillingHistoryCard from "@/components/settings/tabs/BillingHistoryCard";
import PaymentMethodsCard from "@/components/settings/tabs/PaymentMethodsCard";
import NoSubscriptionState from "@/components/settings/tabs/NoSubscriptionState";
import AppearanceTab from "@/components/settings/tabs/AppearanceTab";
import PaymentsTab from "@/components/settings/tabs/PaymentsTab";
import LegalTab from "@/components/settings/tabs/LegalTab";
import ContactTab from "@/components/settings/tabs/ContactTab";
import ResetSettingsDialog from "@/components/settings/tabs/ResetSettingsDialog";
import SaveMessageToast from "@/components/settings/tabs/SaveMessageToast";

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
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [logoFile, setLogoFile] = useState(null); // The picked file, uploaded on save
  const [resetDialog, setResetDialog] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [saveMessage, setSaveMessage] = useState(null); // State for success/error messages
  const [connectingStripe, setConnectingStripe] = useState(false);
  const [disconnectingStripe, setDisconnectingStripe] = useState(false);
  const [showCustomPreview, setShowCustomPreview] = useState(false);
  const {
    newPassword, setNewPassword, confirmNewPassword, setConfirmNewPassword,
    changingPassword, showPasswordForm, setShowPasswordForm, handleChangePassword,
  } = usePasswordChange(setSaveMessage);
  const [subscription, setSubscription] = useState(null);
  const [user, setUser] = useState(null);
  // null shows the settings hub; a tab id shows that panel. The tab values
  // are unchanged, so every existing panel still works exactly as before.
  const [activeTab, setActiveTab] = useState(null);
  const [showFeatureTour, setShowFeatureTour] = useState(false);
  const [billingHistory, setBillingHistory] = useState({
    invoices: [],
    payment_methods: [],
  });
  const [loadingBilling, setLoadingBilling] = useState(false);

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
    review_link: "",
    email_subject_template: defaultEmailSubjectTemplate,
    email_body_template: defaultEmailBodyTemplate,
    custom_template_config: initialCustomTemplateConfig,
    stripe_account_id: null,
    stripe_account_status: null,
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

    // Checked here as well as in the accept attribute, because accept is a
    // filter in the file picker and not a guarantee -- a drag-drop or a
    // "All Files" selection walks straight past it. A logo the PDF renderer
    // cannot embed has to be refused at upload, where the person can see why,
    // rather than at render time where it fails an invoice.
    if (!RENDERABLE_LOGO_TYPES.includes(file.type)) {
      setSaveMessage(
        "Logos must be a PNG or JPEG. Other formats cannot be placed in a PDF.",
      );
      setTimeout(() => setSaveMessage(null), 5000);
      e.target.value = "";
      return;
    }

    // The same limit the PDF renderer applies, checked at the same place the
    // format is. It was missing, and the uploads bucket allows 10MB, so a
    // larger logo uploaded and saved cleanly and was then dropped silently by
    // every PDF -- the exact failure the format check above exists to prevent,
    // one field over.
    if (file.size > MAX_LOGO_BYTES) {
      const mb = (MAX_LOGO_BYTES / (1024 * 1024)).toFixed(0);
      setSaveMessage(
        `That logo is ${(file.size / (1024 * 1024)).toFixed(1)}MB. Logos must be under ${mb}MB or they cannot be placed in a PDF.`,
      );
      setTimeout(() => setSaveMessage(null), 5000);
      e.target.value = "";
      return;
    }

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
          // PUBLIC, deliberately. The logo is rendered inside emailed invoice
          // PDFs and on the public invoice page, both of which are opened by a
          // client with no session, often days later. A signed URL would have
          // expired by then and the invoice would arrive unbranded. Nothing
          // about a business logo is confidential -- it is on their van.
          visibility: "public",
        });
        setUploadingLogo(false);

        // UploadFile REPORTS failure rather than throwing -- deliberately, so
        // one bad image cannot abort a whole settings save. That only works if
        // the caller looks. This one did not: it assigned file_url straight
        // through, so a failed upload wrote logo_url: null and then announced
        // "Settings saved successfully!". The contractor believed they had a
        // logo, the database had nothing, and every invoice went out unbranded
        // with no way to find out why.
        if (!uploadResult?.success || !uploadResult.file_url) {
          setSaving(false);
          setSaveMessage(
            `Could not upload the logo${uploadResult?.error ? `: ${uploadResult.error}` : ""}. Nothing was saved — your previous logo is unchanged.`,
          );
          setTimeout(() => setSaveMessage(null), 6000);
          return;
        }
        finalLogoUrl = uploadResult.file_url;
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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] bg-surface-sunken dark:bg-surface-inverted-deep">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-success-600 dark:border-success-500"></div>
      </div>
    );
  }

  return (
    <div className="px-4 py-4 sm:px-6 sm:py-6 lg:px-8 lg:py-8 max-w-5xl mx-auto bg-surface-sunken dark:bg-surface-inverted-deep min-h-screen">
      <FeatureTour
        isOpen={showFeatureTour}
        onClose={() => setShowFeatureTour(false)}
        onComplete={() => setShowFeatureTour(false)}
      />

      <SettingsMobileHeader
        saving={saving}
        uploadingLogo={uploadingLogo}
      />

      <SettingsDesktopHeader
        saving={saving}
        setResetDialog={setResetDialog}
        setShowFeatureTour={setShowFeatureTour}
        uploadingLogo={uploadingLogo}
      />

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
              <SettingsTabNav activeTab={activeTab} setActiveTab={setActiveTab} />

              <BusinessInfoTab
                formData={formData}
                handleLogoUpload={handleLogoUpload}
                setFormData={setFormData}
                setLogoFile={setLogoFile}
                uploadingLogo={uploadingLogo}
              />

              <SecurityTab
                changingPassword={changingPassword}
                confirmNewPassword={confirmNewPassword}
                handleChangePassword={handleChangePassword}
                newPassword={newPassword}
                setConfirmNewPassword={setConfirmNewPassword}
                setNewPassword={setNewPassword}
                setShowPasswordForm={setShowPasswordForm}
                showPasswordForm={showPasswordForm}
                user={user}
              />

              {/* Billing Tab */}
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
                        <CurrentPlanCard
                          subscription={subscription}
                        />

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
                              {/* "Cancel subscription (if needed)" used to be
                                  the last bullet here. Cancelling now has its
                                  own page, so pointing at Stripe for it would
                                  send people to the version of that screen we
                                  do not control. The portal can still do it --
                                  we just no longer recommend it. */}
                              <ul className="text-xs text-content-body dark:text-content-subtle space-y-1">
                                <li>• Update payment method</li>
                                <li>• View and download all invoices</li>
                                <li>• Update billing information</li>
                                <li>• View payment history</li>
                              </ul>
                            </div>

                            {/* Deliberately quiet, and deliberately present.
                                Burying cancellation is what makes people
                                distrust a billing page; it does not keep them.
                                It is a plain link, at the bottom, under a
                                divider. */}
                            <div className="pt-2 border-t border-line dark:border-ink-700">
                              <Link
                                to={createPageUrl("CancelSubscription")}
                                className="text-xs font-medium text-content-muted hover:text-content dark:text-content-subtle dark:hover:text-content-inverted underline underline-offset-2"
                              >
                                Cancel subscription
                              </Link>
                            </div>
                          </CardContent>
                        </Card>

                        <BillingHistoryCard
                          billingHistory={billingHistory}
                          loadBillingHistory={loadBillingHistory}
                          loadingBilling={loadingBilling}
                        />

                        <PaymentMethodsCard
                          billingHistory={billingHistory}
                        />
                      </>
                    ) : (
                      <NoSubscriptionState />
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

              <AppearanceTab
              />

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

              <PaymentsTab
                checkStripeAccountStatus={checkStripeAccountStatus}
                connectingStripe={connectingStripe}
                disconnectingStripe={disconnectingStripe}
                handleConnectStripe={handleConnectStripe}
                handleDisconnectStripe={handleDisconnectStripe}
                settings={settings}
              />

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

              <LegalTab
                saving={saving}
                setSaveMessage={setSaveMessage}
                setSaving={setSaving}
                user={user}
              />

              <ContactTab />
            </Tabs>
          </>
        )}
      </form>

      <ResetSettingsDialog
        handleResetToDefaults={handleResetToDefaults}
        resetDialog={resetDialog}
        resetting={resetting}
        setResetDialog={setResetDialog}
      />

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

      <SaveMessageToast
        saveMessage={saveMessage}
      />
    </div>
  );
}
