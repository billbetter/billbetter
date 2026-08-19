import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Eye, CheckCircle, Palette, Info } from "lucide-react";
import CustomTemplatePreview from "@/components/invoice/CustomTemplatePreview";

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

export default function PdfTemplateSettings({
  formData,
  setFormData,
  settings,
  setPreviewTemplate,
  showCustomPreview,
  setShowCustomPreview,
}) {
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
            <div>
              <Label className="text-ink-700 dark:text-ink-300">
                Brand Color (Hex)
              </Label>
              <div className="flex gap-2">
                <Input
                  type="text"
                  value={formData.pdf_color_scheme}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      pdf_color_scheme: e.target.value,
                    })
                  }
                  placeholder="#10b981"
                  className="bg-surface dark:bg-ink-800 border-line-strong dark:border-ink-700 text-content dark:text-content-inverted"
                />
                <div
                  className="w-12 h-10 rounded border dark:border-ink-700"
                  style={{ backgroundColor: formData.pdf_color_scheme }}
                />
              </div>
            </div>

            <div>
              <Label className="text-ink-700 dark:text-ink-300">
                Company Name Font
              </Label>
              <select
                value={formData.font_family}
                onChange={(e) =>
                  setFormData({ ...formData, font_family: e.target.value })
                }
                className="w-full px-3 py-2 border border-line-strong dark:border-ink-700 rounded-md focus:outline-none focus:ring-2 focus:ring-success-500 bg-surface dark:bg-ink-800 text-content dark:text-content-inverted"
              >
                <option value="helvetica">Helvetica (Modern & Clean)</option>
                <option value="arial">Arial (Simple & Professional)</option>
                <option value="times">Times New Roman (Classic)</option>
                <option value="courier">Courier (Typewriter Style)</option>
                <option value="georgia">Georgia (Elegant Serif)</option>
                <option value="verdana">Verdana (Clear & Readable)</option>
                <option value="palatino">
                  Palatino (Classic & Sophisticated)
                </option>
              </select>
              <div className="mt-3 p-4 bg-surface-sunken dark:bg-ink-800 rounded-lg border dark:border-ink-700">
                <p className="text-xs text-content-muted dark:text-content-subtle mb-2">
                  Preview:
                </p>
                <p
                  style={{
                    fontFamily:
                      formData.font_family === "times"
                        ? "Times New Roman, serif"
                        : formData.font_family === "courier"
                          ? "Courier New, monospace"
                          : formData.font_family === "georgia"
                            ? "Georgia, serif"
                            : formData.font_family === "verdana"
                              ? "Verdana, sans-serif"
                              : formData.font_family === "palatino"
                                ? "Palatino, serif"
                                : "Helvetica, Arial, sans-serif",
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
                checked={formData.show_pdf_branding !== false}
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
                  Display Invoicium branding at the bottom of invoices and
                  quotes
                </p>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
