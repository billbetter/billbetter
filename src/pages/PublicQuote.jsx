import React, { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { sdk } from "@/api/sdk";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, XCircle } from "lucide-react";
import { format, differenceInDays } from "date-fns";
import SEO from "@/components/seo/SEO";

export default function PublicQuote() {
  const [searchParams] = useSearchParams();
  const publicId = searchParams.get("id");

  const [quote, setQuote] = useState(null);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (publicId) {
      loadData();
    } else {
      setLoading(false);
    }
  }, [publicId]);

  const loadData = async () => {
    try {
      const [quoteData, settingsData] = await Promise.all([
        sdk.entities.Quote.filter({ public_id: publicId }),
        sdk.entities.BusinessSettings.list(),
      ]);

      if (quoteData.length > 0) setQuote(quoteData[0]);
      // settingsData[0] is the wrong row: it takes the FIRST BusinessSettings
      // row rather than the one belonging to this quote's owner, so it would
      // show a client another contractor's name, logo and address.
      //
      // It is unreachable today. Both queries above run with the anon key, and
      // the RLS policies resolve to false for an anonymous caller --
      // has_app_access(null) is false, and accessible_owner_ids(null) yields a
      // single NULL so `user_id IN (NULL)` is never true. Verified by direct
      // anonymous request: both return 200 [] against tables that do hold rows.
      // So these arrays are always empty and this page always renders
      // "Quote Not Found" -- a live outage, not a leak.
      //
      // THE TRAP: the obvious fix for blank branding is to loosen the anon
      // policy on BusinessSettings. Do not. That would make this line reachable
      // and turn a dormant bug into a cross-tenant branding leak, while also
      // exposing every business's address, phone and tax details. The fix is a
      // service-role edge function that resolves settings BY the quote's
      // user_id and returns a narrowed payload. See docs/invoice-links-plan.md.
      if (settingsData.length > 0) setSettings(settingsData[0]);
    } catch (error) {
      console.error("Error loading data:", error);
    }
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-surface-sunken flex items-center justify-center">
        <Loader2 className="w-12 h-12 animate-spin text-accent-600" />
      </div>
    );
  }

  if (!quote) {
    return (
      <div className="min-h-screen bg-surface-sunken flex items-center justify-center p-4">
        <div className="text-center">
          <XCircle className="w-16 h-16 text-danger-500 mx-auto mb-4" />
          <h1 className="text-2xl font-black text-ink-800">Quote Not Found</h1>
          <p className="text-content-body mt-2">
            This link may be invalid or the quote has been removed.
          </p>
        </div>
      </div>
    );
  }

  const isActionable = quote.status === "sent";
  const isExpired =
    differenceInDays(new Date(quote.expiry_date), new Date()) < 0;

  return (
    <div className="min-h-screen bg-surface-sunken p-4 sm:p-8">
      <SEO
        title={`Quote #${quote.quote_number}`}
        description={`View and approve your quote from ${settings?.business_name || "Invoicium"}.`}
        noindex={true}
      />
      <div className="max-w-4xl mx-auto">
        <header className="mb-8 text-center">
          {settings?.logo_url && (
            <img
              src={settings.logo_url}
              alt="Logo"
              className="w-24 h-auto mx-auto mb-4"
            />
          )}
          <h1 className="text-3xl font-black text-content">
            Quote from {settings?.business_name || "Us"}
          </h1>
          <p className="text-content-body">Quote #{quote.quote_number}</p>
        </header>

        {quote.status !== "sent" && (
          <Card className="mb-6 shadow-lg">
            <CardContent className="p-6 text-center">
              <p className="font-semibold text-lg text-ink-800">
                This quote was {quote.status} on{" "}
                {format(new Date(quote.updated_date), "MMMM d, yyyy")}.
              </p>
            </CardContent>
          </Card>
        )}

        {isExpired && isActionable && (
          <Card className="mb-6 shadow-lg bg-caution-50">
            <CardContent className="p-6 text-center">
              <p className="font-semibold text-lg text-caution-800">
                This quote has expired. Please contact us for a new one.
              </p>
            </CardContent>
          </Card>
        )}

        <div className="p-8 bg-surface rounded-lg shadow-lg">
          <div className="grid grid-cols-2 gap-8 mb-8">
            <div>
              <h2 className="text-sm text-content-muted mb-1">Quote For</h2>
              <p className="font-semibold text-content">{quote.client_name}</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-content-muted mb-1">Issued Date</p>
              <p className="font-semibold text-content">
                {format(new Date(quote.date_issued), "PP")}
              </p>
              <p className="text-sm text-content-muted mb-1 mt-2">
                Expiry Date
              </p>
              <p className="font-semibold text-content">
                {format(new Date(quote.expiry_date), "PP")}
              </p>
            </div>
          </div>

          <div className="space-y-2">
            {quote.items.map((item, index) => (
              <div
                key={index}
                className="flex justify-between items-start py-3 border-b last:border-b-0"
              >
                <div>
                  <p className="font-medium text-content">{item.description}</p>
                  <p className="text-sm text-content-body">
                    {item.quantity} × ${item.rate.toFixed(2)}
                  </p>
                </div>
                <p className="font-medium text-content">
                  ${item.amount.toFixed(2)}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-6 pt-6 border-t-2 space-y-2">
            <div className="flex justify-between text-content-body">
              <span>Subtotal</span>
              <span>${quote.subtotal.toFixed(2)}</span>
            </div>
            {quote.tax_rate > 0 && (
              <div className="flex justify-between text-content-body">
                <span>Tax ({quote.tax_rate}%)</span>
                <span>${quote.tax_amount.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between text-2xl font-bold text-content pt-2">
              <span>Total</span>
              <span>${quote.total.toFixed(2)}</span>
            </div>
          </div>

          {quote.notes && (
            <div className="mt-8 pt-6 border-t">
              <h3 className="font-black text-ink-800 mb-2">Notes</h3>
              <p className="text-content-body whitespace-pre-wrap">
                {quote.notes}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
