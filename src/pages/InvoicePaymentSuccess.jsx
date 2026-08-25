import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { sdk } from "@/api/sdk";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle, Receipt, Download, Home, Loader2 } from "lucide-react";

export default function InvoicePaymentSuccess() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [invoice, setInvoice] = useState(null);
  const [sessionId, setSessionId] = useState(null);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const sid = urlParams.get("session_id");
    setSessionId(sid);

    if (sid) {
      verifyPayment(sid);
    } else {
      setLoading(false);
    }
  }, []);

  const verifyPayment = async (sid) => {
    try {
      console.log("🔍 Verifying payment for session:", sid);

      // Wait a bit for webhook to process
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Find invoice by session ID using backend function
      const response = await sdk.functions.invoke("getInvoiceBySession", {
        session_id: sid,
      });

      if (response.data && response.data.success && !response.data.error) {
        setInvoice(response.data);
        console.log("✅ Invoice found and payment verified");
      } else {
        // The stub returned a fabricated invoice (INV-000, total 0) and this
        // branch rendered it as a receipt -- to someone who had just paid.
        // Leaving `invoice` null shows the generic thank-you instead, which is
        // true: the payment succeeded, we just cannot show the detail yet.
        console.warn("Invoice lookup unavailable for session", sid);
      }
    } catch (error) {
      console.error("❌ Error verifying payment:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-surface-sunken flex items-center justify-center p-4">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-success-600 animate-spin mx-auto mb-4" />
          <p className="text-content-body">Verifying your payment...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-sunken py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-success-100 mb-6">
            <CheckCircle className="w-12 h-12 text-success-600" />
          </div>
          <h1 className="text-4xl sm:text-5xl font-black text-content mb-4">
            Payment Successful! 🎉
          </h1>
          <p className="text-xl text-content-body mb-2">
            Thank you for your payment
          </p>
          <p className="text-content-muted">
            Your payment has been processed successfully
          </p>
        </div>

        <Card className="border-2 border-success-200 shadow-xl mb-8">
          <CardHeader className="bg-success-50 border-b">
            <CardTitle className="flex items-center gap-2 text-success-900">
              <Receipt className="w-5 h-5" />
              Payment Details
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            {invoice ? (
              <>
                <div className="flex justify-between items-center border-b pb-3">
                  <span className="text-content-body">Invoice Number</span>
                  <span className="font-semibold text-content">
                    {invoice.invoice_number}
                  </span>
                </div>
                <div className="flex justify-between items-center border-b pb-3">
                  <span className="text-content-body">Amount Paid</span>
                  <span className="font-bold text-success-600 text-xl">
                    ${invoice.total?.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between items-center border-b pb-3">
                  <span className="text-content-body">Payment Date</span>
                  <span className="font-semibold text-content">
                    {new Date().toLocaleDateString("en-US", {
                      month: "long",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-content-body">Status</span>
                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium bg-success-100 text-success-700">
                    <CheckCircle className="w-4 h-4" />
                    Paid
                  </span>
                </div>

                {invoice.pdf_url && (
                  <div className="pt-4 border-t">
                    <Button
                      onClick={() => window.open(invoice.pdf_url, "_blank")}
                      variant="outline"
                      className="w-full border-success-200 hover:bg-success-50"
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Download Invoice Receipt
                    </Button>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-8">
                <p className="text-content-body mb-4">
                  Your payment was successful!
                </p>
                {sessionId && (
                  <p className="text-xs text-content-muted">
                    Session ID:{" "}
                    <code className="bg-ink-100 px-2 py-1 rounded">
                      {sessionId}
                    </code>
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card className="bg-info-50 border-info-200">
            <CardContent className="p-6">
              <div className="flex items-start gap-3">
                <Receipt className="w-5 h-5 text-info-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-black text-info-900 mb-1">
                    Receipt & Confirmation
                  </h3>
                  <p className="text-sm text-info-800 mb-2">
                    A payment confirmation has been sent to your email. Please
                    keep it for your records.
                  </p>
                  <p className="text-xs text-info-700">
                    Questions? Contact us at{" "}
                    <a
                      href="mailto:support@invoicium.ca"
                      className="font-semibold underline hover:text-info-900"
                    >
                      support@invoicium.ca
                    </a>
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="text-center">
            <Button
              onClick={() => (window.location.href = "/")}
              size="lg"
              className="bg-brand hover:bg-brand-hover px-8"
            >
              <Home className="w-5 h-5 mr-2" />
              Return to Home
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
