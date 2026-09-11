import React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Info, Loader2, Upload } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TabsContent } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

/** Business details, document defaults, the logo and the review link. */
export default function BusinessInfoTab({
  formData,
  handleLogoUpload,
  setFormData,
  setLogoFile,
  uploadingLogo,
}) {
  return (
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
                {/* PNG and JPEG only, not image/*.
                    The logo is embedded in the PDF, and react-pdf can
                    embed those two formats and no others. An SVG or
                    WebP makes the renderer throw mid-render, which
                    fails the WHOLE invoice -- so accepting one here
                    would let a contractor break their own invoicing
                    with a logo upload, and find out at the point they
                    tried to bill someone. */}
                <input
                  type="file"
                  accept="image/png,image/jpeg"
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
  );
}
