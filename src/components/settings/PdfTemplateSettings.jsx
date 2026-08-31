import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Eye, CheckCircle, Palette } from "lucide-react";
import CustomTemplatePreview from "@/components/invoice/CustomTemplatePreview";
import InvoiceThemePreview from "@/components/invoice/InvoiceThemePreview";
import {
  contrastRatio,
  normalizeHex,
  resolveInvoiceTheme,
} from "@/lib/invoiceTheme";
import { PDF_FONT_OPTIONS, resolvePdfFont } from "@/lib/invoiceBrand";

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

// The four colours InvoiceTheme exposes. `fallback` is only what the native
// swatch shows while the field is empty -- it is never written to the row, so an
// untouched field stays NULL and keeps deriving from the background.
const PDF_THEME_FIELDS = [
  {
    key: "pdf_color_scheme",
    label: "Brand Color",
    fallback: "#000000",
    hint: "Header bars, section titles and the totals box.",
  },
  {
    key: "pdf_background_color",
    label: "Page Background",
    fallback: "#ffffff",
    hint: "The paper colour. Leave empty for white.",
  },
  {
    key: "pdf_text_color",
    label: "Body Text",
    fallback: "#000000",
    hint: "Leave empty to follow the background automatically.",
  },
  {
    key: "pdf_muted_text_color",
    label: "Labels & Secondary Text",
    fallback: "#595959",
    hint: "Leave empty to derive from the body text and background.",
  },
];

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
    id: "detailed",
    name: "Detailed",
    description:
      "Grouped sections with subtotals, PO and job refs, terms and signature lines",
    preview: "📐 Multi-section layout for commercial jobs",
  },
  {
    id: "custom",
    name: "Custom Template",
    description:
      "Build your own template with customizable sections and styling",
    preview: "🎨 Your custom design",
  },
];

export default function PdfTemplateSettings({
  formData,
  setFormData,
  settings,
  setPreviewTemplate,
  showCustomPreview,
  setShowCustomPreview,
}) {
  const [showThemePreview, setShowThemePreview] = React.useState(false);

  // The same resolution the PDF itself uses, so the swatch below is not a
  // second opinion about what will print.
  const previewTheme = resolveInvoiceTheme(formData);

  return (
    <Card className="border-none shadow-lg bg-surface dark:bg-surface-inverted dark:border dark:border-ink-800">
      <CardHeader>
        <CardTitle className="text-content dark:text-content-inverted">
          PDF Invoice Templates & Customization
        </CardTitle>
        <p className="text-sm text-content-body dark:text-content-subtle">
          Select your invoice layout and customize PDF appearance
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid md:grid-cols-2 gap-4">
          {templateOptions.map((template) => (
            <div
              key={template.id}
              className={`relative border-2 rounded-lg p-6 transition-all cursor-pointer ${
                formData.invoice_template === template.id
                  ? "border-success-500 bg-success-50 dark:bg-success-900/30 dark:border-success-500"
                  : "border-line dark:border-ink-600 hover:border-line-strong dark:hover:border-ink-400 bg-surface dark:bg-ink-800"
              }`}
              onClick={() =>
                setFormData({ ...formData, invoice_template: template.id })
              }
            >
              {formData.invoice_template === template.id && (
                <div className="absolute top-3 right-3">
                  <CheckCircle className="w-6 h-6 text-success-600 dark:text-success-400" />
                </div>
              )}
              <div className="text-4xl mb-3">
                {template.preview.split(" ")[0]}
              </div>
              <h3 className="text-lg font-semibold text-content dark:text-content-inverted mb-2">
                {template.name}
              </h3>
              <p className="text-sm text-content-body dark:text-ink-300 mb-3">
                {template.description}
              </p>
              <p className="text-xs text-content-muted dark:text-content-subtle mb-4">
                {template.preview}
              </p>
              {template.id !== "custom" && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    setPreviewTemplate(template);
                  }}
                  className="gap-1 dark:border-ink-700 dark:text-ink-300 dark:hover:bg-ink-800"
                >
                  <Eye className="w-3 h-3" /> Preview
                </Button>
              )}
            </div>
          ))}
        </div>

        {formData.invoice_template === "custom" && (
          <Card className="border-2 border-success-200 dark:border-success-800 bg-success-50/30 dark:bg-success-900/20 mt-6">
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <CardTitle className="flex items-center gap-2 text-base sm:text-lg text-content dark:text-content-inverted">
                    <Palette className="w-4 h-4 sm:w-5 sm:h-5 text-success-600 dark:text-success-400" />
                    Customize Your Template
                  </CardTitle>
                  <p className="text-xs sm:text-sm text-content-body dark:text-content-subtle">
                    Configure which sections to show and how they look
                  </p>
                </div>
                <Button
                  type="button"
                  onClick={() => setShowCustomPreview(!showCustomPreview)}
                  className="bg-brand hover:bg-brand-hover gap-2 w-full sm:w-auto text-sm"
                >
                  <Eye className="w-4 h-4" />
                  {showCustomPreview ? "Hide" : "Show"} Preview
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {showCustomPreview && (
                <div className="mb-6 p-2 sm:p-4 bg-surface dark:bg-ink-800 rounded-lg border-2 border-success-300 dark:border-success-700">
                  <h4 className="font-semibold text-content dark:text-content-inverted mb-4 flex items-center gap-2 text-sm">
                    <Eye className="w-4 h-4 text-success-600" /> Live Preview
                  </h4>
                  <CustomTemplatePreview
                    config={formData.custom_template_config}
                    settings={settings || formData}
                  />
                </div>
              )}

              <div>
                <h4 className="font-semibold text-content dark:text-content-inverted mb-3 text-sm">
                  Show/Hide Sections
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[
                    { key: "show_logo", label: "Show Logo" },
                    {
                      key: "show_company_address",
                      label: "Show Company Address",
                    },
                    {
                      key: "show_client_address",
                      label: "Show Client Address",
                    },
                    {
                      key: "show_invoice_details",
                      label: "Show Invoice Details",
                    },
                    { key: "show_payment_info", label: "Show Payment Info" },
                    { key: "show_notes", label: "Show Notes Section" },
                  ].map(({ key, label }) => (
                    <label
                      key={key}
                      className="flex items-center gap-2 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={formData.custom_template_config?.[key] ?? true}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            custom_template_config: {
                              ...initialCustomTemplateConfig,
                              ...(formData.custom_template_config || {}),
                              [key]: e.target.checked,
                            },
                          })
                        }
                        className="w-4 h-4 text-success-700 dark:text-success-400 rounded border-line-strong dark:border-ink-700 bg-surface dark:bg-ink-800"
                      />
                      <span className="text-sm text-ink-700 dark:text-ink-300">
                        {label}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="font-semibold text-content dark:text-content-inverted mb-3 text-sm">
                  Layout Style
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    {
                      val: "two-column",
                      label: "Two Column",
                      desc: "Side-by-side",
                    },
                    {
                      val: "single-column",
                      label: "Single Column",
                      desc: "Stacked",
                    },
                  ].map(({ val, label, desc }) => (
                    <div
                      key={val}
                      className={`border-2 rounded-lg p-3 cursor-pointer transition-all ${formData.custom_template_config?.layout_style === val ? "border-success-500 bg-success-50 dark:bg-success-900/30" : "border-line dark:border-ink-700 bg-surface dark:bg-ink-800"}`}
                      onClick={() =>
                        setFormData({
                          ...formData,
                          custom_template_config: {
                            ...initialCustomTemplateConfig,
                            ...(formData.custom_template_config || {}),
                            layout_style: val,
                          },
                        })
                      }
                    >
                      <div className="text-sm font-medium text-content dark:text-content-inverted">
                        {label}
                      </div>
                      <div className="text-xs text-content-muted dark:text-content-subtle">
                        {desc}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="font-semibold text-content dark:text-content-inverted mb-3 text-sm">
                  Header Style
                </h4>
                <div className="grid grid-cols-3 gap-3">
                  {["modern", "classic", "minimal"].map((style) => (
                    <div
                      key={style}
                      className={`border-2 rounded-lg p-3 cursor-pointer transition-all ${formData.custom_template_config?.header_style === style ? "border-success-500 bg-success-50 dark:bg-success-900/30" : "border-line dark:border-ink-700 bg-surface dark:bg-ink-800"}`}
                      onClick={() =>
                        setFormData({
                          ...formData,
                          custom_template_config: {
                            ...initialCustomTemplateConfig,
                            ...(formData.custom_template_config || {}),
                            header_style: style,
                          },
                        })
                      }
                    >
                      <div className="text-sm font-medium text-content dark:text-content-inverted capitalize">
                        {style}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="font-semibold text-content dark:text-content-inverted mb-3 text-sm">
                  Color Scheme
                </h4>
                <div className="grid sm:grid-cols-2 gap-4">
                  {[
                    {
                      key: "accent_color",
                      label: "Accent Color",
                      default: "#10b981",
                    },
                    {
                      key: "secondary_color",
                      label: "Secondary Color",
                      default: "#6b7280",
                    },
                  ].map(({ key, label, default: def }) => (
                    <div key={key}>
                      <Label className="text-sm text-ink-700 dark:text-ink-300">
                        {label}
                      </Label>
                      <div className="flex gap-2 mt-1">
                        <Input
                          type="color"
                          value={formData.custom_template_config?.[key] || def}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              custom_template_config: {
                                ...initialCustomTemplateConfig,
                                ...(formData.custom_template_config || {}),
                                [key]: e.target.value,
                              },
                            })
                          }
                          className="w-16 h-10 p-0 bg-transparent border-0"
                        />
                        <Input
                          value={formData.custom_template_config?.[key] || def}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              custom_template_config: {
                                ...initialCustomTemplateConfig,
                                ...(formData.custom_template_config || {}),
                                [key]: e.target.value,
                              },
                            })
                          }
                          className="flex-1 bg-surface dark:bg-ink-800 border-line-strong dark:border-ink-700 text-content dark:text-content-inverted"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="mt-6 p-4 bg-brand-50 dark:bg-brand-900/20 rounded-lg border border-info-200 dark:border-info-800">
          <h4 className="font-medium text-info-900 dark:text-info-200 mb-2">
            Selected:{" "}
            {
              templateOptions.find((t) => t.id === formData.invoice_template)
                ?.name
            }
          </h4>
          <p className="text-sm text-brand-800 dark:text-brand-300">
            {formData.invoice_template === "custom"
              ? "Your custom template will use the settings configured above."
              : "This template will be used for all new invoices."}
          </p>
        </div>

        {/* PDF Style Customization */}
        <div className="mt-8 pt-8 border-t border-line dark:border-ink-700">
          <h3 className="text-lg font-semibold text-content dark:text-content-inverted mb-4 flex items-center gap-2">
            <Palette className="w-5 h-5 text-success-600 dark:text-success-400" />
            PDF Style Customization
          </h3>
          <div className="space-y-4">
            {/* Invoice PDF colours. Each row is a native swatch plus the hex,
                matching the custom-template pickers above. An empty field means
                "not set" -- invoiceTheme.js then derives that colour from the
                background rather than assuming a white page. */}
            {PDF_THEME_FIELDS.map(({ key, label, hint, fallback }) => (
              <div key={key}>
                <Label className="text-ink-700 dark:text-ink-300">{label}</Label>
                <div className="flex gap-2 mt-1">
                  <Input
                    type="color"
                    aria-label={`${label} swatch`}
                    value={normalizeHex(formData[key]) || fallback}
                    onChange={(e) =>
                      setFormData({ ...formData, [key]: e.target.value })
                    }
                    className="w-16 h-10 p-0 bg-transparent border-0 shrink-0"
                  />
                  <Input
                    type="text"
                    value={formData[key] ?? ""}
                    onChange={(e) =>
                      setFormData({ ...formData, [key]: e.target.value })
                    }
                    placeholder={fallback}
                    className="bg-surface dark:bg-ink-800 border-line-strong dark:border-ink-700 text-content dark:text-content-inverted"
                  />
                  {formData[key] ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setFormData({ ...formData, [key]: "" })}
                      className="shrink-0 text-content-muted"
                    >
                      Reset
                    </Button>
                  ) : null}
                </div>
                <p className="text-xs text-content-muted dark:text-content-subtle mt-1">
                  {hint}
                </p>
              </div>
            ))}

            {/* The filled bars draw their text in whichever of black/white reads
                better on the brand colour, so this is what will actually print. */}
            <div className="rounded-lg border border-line dark:border-ink-700 p-3">
              <p className="text-xs font-semibold text-content-muted mb-2">
                Contrast check
              </p>
              <div
                className="rounded px-3 py-2 text-sm font-bold flex justify-between"
                style={{
                  backgroundColor: previewTheme.primaryColor,
                  color: previewTheme.onPrimaryColor,
                }}
              >
                <span>Total Due</span>
                <span>$2,945.60</span>
              </div>
              <p className="text-xs text-content-muted mt-2">
                Text on your brand colour is set to{" "}
                {previewTheme.onPrimaryColor === "#ffffff" ? "white" : "black"}{" "}
                automatically (
                {contrastRatio(
                  previewTheme.primaryColor,
                  previewTheme.onPrimaryColor,
                ).toFixed(1)}
                :1 contrast).
                {previewTheme.accentColor !== previewTheme.primaryColor
                  ? " Your brand colour is too light to read as a rule or border on this background, so those fall back to the body colour."
                  : ""}
              </p>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-ink-700 dark:text-ink-300">
                  Live preview
                </Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowThemePreview((v) => !v)}
                  className="gap-1 dark:border-ink-700 dark:text-ink-300"
                >
                  <Eye className="w-3 h-3" />
                  {showThemePreview ? "Hide" : "Show"}
                </Button>
              </div>
              {showThemePreview ? (
                <InvoiceThemePreview settings={{ ...settings, ...formData }} />
              ) : (
                <p className="text-xs text-content-muted dark:text-content-subtle">
                  Renders a sample invoice with your colours, using the template
                  selected above.
                </p>
              )}
            </div>

            {/* Three families, not seven.
                This offered Helvetica, Arial, Times, Courier, Georgia, Verdana
                and Palatino. A PDF has three standard families -- Helvetica,
                Times and Courier -- and anything else has to be embedded as a
                font file; this app ships one, Inter. So four of those seven
                could never have rendered as themselves, and the setting was
                read by no template at all, so none of them rendered as anything.
                The retired names still resolve (see PDF_FONT_ALIASES), and the
                select shows what the row actually resolves to. */}
            <div>
              <Label className="text-ink-700 dark:text-ink-300">
                Document font
              </Label>
              <select
                value={resolvePdfFont(formData).id}
                onChange={(e) =>
                  setFormData({ ...formData, font_family: e.target.value })
                }
                className="w-full px-3 py-2 border border-line-strong dark:border-ink-700 rounded-md focus:outline-none focus:ring-2 focus:ring-success-500 bg-surface dark:bg-ink-800 text-content dark:text-content-inverted"
              >
                {PDF_FONT_OPTIONS.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.label}
                  </option>
                ))}
              </select>
              <p className="text-xs text-content-muted dark:text-content-subtle mt-1.5">
                {PDF_FONT_OPTIONS.find(
                  (f) => f.id === resolvePdfFont(formData).id,
                )?.hint}{" "}
                Applies to the whole document, on invoices and quotes.
              </p>
              <div className="mt-3 p-4 bg-surface-sunken dark:bg-ink-800 rounded-lg border dark:border-ink-700">
                <p className="text-xs text-content-muted dark:text-content-subtle mb-2">
                  Preview:
                </p>
                <p
                  style={{
                    // The browser stand-ins for the three PDF families. Inter
                    // is the app's own face and is already loaded.
                    fontFamily:
                      resolvePdfFont(formData).id === "times"
                        ? "'Times New Roman', Times, serif"
                        : resolvePdfFont(formData).id === "courier"
                          ? "'Courier New', Courier, monospace"
                          : "Inter, Helvetica, Arial, sans-serif",
                    fontSize: "18px",
                    fontWeight: "bold",
                  }}
                  className="text-content dark:text-content-inverted"
                >
                  {formData.business_name || "Your Company Name"}
                </p>
              </div>
            </div>

            <div>
              <Label className="text-ink-700 dark:text-ink-300">
                Footer Message
              </Label>
              <p className="text-xs text-content-muted dark:text-content-subtle mb-2">
                Printed at the bottom of every invoice and quote, in place of
                "Thank you for your business."
              </p>
              <Textarea
                value={formData.pdf_footer_text}
                onChange={(e) =>
                  setFormData({ ...formData, pdf_footer_text: e.target.value })
                }
                rows={2}
                placeholder="Thank you for your business!"
                className="bg-surface dark:bg-ink-800 border-line-strong dark:border-ink-700 text-content dark:text-content-inverted"
              />
            </div>

            <div className="flex items-center gap-3 p-4 border border-line dark:border-ink-700 rounded-lg bg-surface dark:bg-ink-800">
              <input
                type="checkbox"
                id="show_pdf_branding"
                /* `=== true`, not `!== false`. This read as ticked on every
                   account with a null column while nothing printed the line --
                   so rendering it as labelled would have put our name on every
                   existing customer's invoices, on documents already going to
                   their clients, without anyone choosing it. Off unless
                   somebody switches it on. */
                checked={formData.show_pdf_branding === true}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    show_pdf_branding: e.target.checked,
                  })
                }
                className="w-4 h-4 text-success-600 rounded border-line-strong dark:border-ink-700"
              />
              <div className="flex-1">
                <Label
                  htmlFor="show_pdf_branding"
                  className="cursor-pointer font-medium text-content dark:text-content-inverted"
                >
                  Show "Powered By Invoicium" on PDFs
                </Label>
                <p className="text-xs text-content-muted dark:text-content-subtle mt-0.5">
                  Off by default. Tick this to add a small "Powered by
                  Invoicium" line at the bottom of your invoices and quotes.
                </p>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
