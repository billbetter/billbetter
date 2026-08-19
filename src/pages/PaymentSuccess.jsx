import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { sdk } from "@/api/sdk";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle,
  ArrowRight,
  FileText,
  Users,
  Settings,
  Sparkles,
  Calendar,
  CreditCard,
  Mail,
  Loader2,
  AlertCircle,
} from "lucide-react";

export default function PaymentSuccess() {
  const navigate = useNavigate();
  // Updated state variables as per the outline
  const [sessionId, setSessionId] = useState(null);
  const [subscriptionReady, setSubscriptionReady] = useState(false);
  const [loading, setLoading] = useState(true); // Replaces checkingSubscription
  const [countdown, setCountdown] = useState(10); // Initial 10 seconds for countdown
  const [redirecting, setRedirecting] = useState(false);
  const [error, setError] = useState(null); // Replaces errorMsg, now stores an object or string

  // Removed `attempts` and `activated` useRefs as they are no longer needed with the new retry logic.

  // Replaced the initial useEffect hook with combined logic
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const sid = urlParams.get("session_id");
    setSessionId(sid);

    console.log("═══════════════════════════════════════");
    console.log("🚀 PaymentSuccess Page Loaded");
    console.log("📋 Session ID from URL:", sid);
    console.log("═══════════════════════════════════════");

    (async () => {
      // Ensure user session is alive before proceeding with payment verification
      try {
        await sdk.auth.me(); // This will attempt to refresh tokens if needed
        console.log("✅ User session active.");
      } catch (authError) {
        console.warn(
          "⚠️ User session might not be active or refresh failed initially:",
          authError.message,
        );
        // Continue anyway; subsequent API calls (`confirmPayment`, `checkDB`) will also trigger auth logic
      }

      if (sid) {
        console.log("🔄 Starting payment confirmation with session ID...");
        confirmPayment(sid);
      } else {
        console.log(
          "⚠️ No session ID found in URL. Checking database directly for subscription...",
        );
        setError(
          "No session ID found in URL. Checking your account for an existing subscription.",
        );
        // Do not set loading to false here, as checkDB will manage the loading state
        checkDB(); // Always try DB check as a fallback if no session_id is present
      }
    })();
  }, []); // Empty dependency array means this runs once on component mount

  // Replaced the countdown/redirect useEffect hook
  useEffect(() => {
    if (subscriptionReady && countdown > 0) {
      const timer = setTimeout(() => {
        setCountdown(countdown - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else if (subscriptionReady && countdown === 0 && !redirecting) {
      setRedirecting(true);
      console.log(`⏱️ Countdown finished, redirecting to Dashboard.`);
      navigate(createPageUrl("Dashboard") + "?from=payment");
    }
  }, [subscriptionReady, countdown, navigate, redirecting]);

  // Replaced confirmPayment function
  const confirmPayment = async (sid, retryCount = 0) => {
    setLoading(true); // Ensure loading is true when confirmation process starts
    try {
      console.log("═══════════════════════════════════════");
      console.log(
        `🔄 Payment confirmation attempt ${retryCount + 1}/8 for session:`,
        sid,
      );
      console.log("═══════════════════════════════════════");

      const response = await sdk.functions.invoke("confirmAndActivate", {
        session_id: sid,
      });

      console.log("📦 Response from confirmAndActivate:", response);

      if (
        response?.data?.ok === false &&
        response?.data?.status === "pending"
      ) {
        if (retryCount < 8) {
          // Increased retry attempts
          const delay = (2 + retryCount) * 1000; // Exponential backoff for retries
          console.log(
            `⏳ Status: pending, retrying in ${delay / 1000}s... (attempt ${retryCount + 2}/8)`,
          );
          setError(`Payment pending. Retrying in ${delay / 1000} seconds...`);
          setTimeout(() => confirmPayment(sid, retryCount + 1), delay);
        } else {
          console.log(
            "⏱️ Max retries for session ID confirmation reached, checking database directly...",
          );
          setError(
            "Payment verification is taking longer than expected. Checking database directly.",
          );
          await checkDB(); // Fallback to DB check if max retries for API confirmation reached
        }
      } else if (response?.data?.ok) {
        console.log("✅ Payment confirmed successfully!");
        console.log("📊 Subscription details:", {
          plan: response.data.plan_name,
          limit: response.data.monthly_invoice_limit,
          overage: response.data.overage_fee_per_invoice,
          processing: response.data.payment_processing_fee,
        });
        subscriptionActivated(); // Trigger activation process
      } else {
        // Handle unexpected responses where 'ok' is not true and status is not 'pending'
        throw new Error(
          response?.data?.error ||
            `Unknown error from confirmAndActivate. Status: ${response?.data?.status || "N/A"}`,
        );
      }
    } catch (err) {
      console.error("❌ Error in confirmPayment:", err);

      if (retryCount < 8) {
        // Increased retry attempts on error
        const delay = (3 + retryCount) * 1000; // Exponential backoff for retries
        console.log(
          `🔁 Retrying in ${delay / 1000}s... (attempt ${retryCount + 2}/8)`,
        );
        setError(
          `A network error occurred: ${err.message}. Retrying... (${retryCount + 1}/8)`,
        );
        setTimeout(() => confirmPayment(sid, retryCount + 1), delay);
      } else {
        console.log("⏱️ Max retries reached after error, checking database...");
        setError(
          `Failed to confirm payment via API after multiple attempts: ${err.message}. Checking database now.`,
        );
        await checkDB(); // Fallback to DB check if max retries on error reached
      }
    }
  };

  // Replaced checkDB function
  const checkDB = async () => {
    setLoading(true); // Ensure loading is true when checking DB
    try {
      console.log("🔍 Checking database for active subscription...");
      const user = await sdk.auth.me(); // Get current user info to find subscriptions

      // ✅ Add a delay for database propagation, as transactions might not be immediately visible
      await new Promise((resolve) => setTimeout(resolve, 2000));

      const subscriptions = await sdk.entities.Subscription.filter({
        user_id: user.id,
      });

      console.log("📊 Found subscriptions:", subscriptions.length);

      if (subscriptions.length > 0) {
        const sub = subscriptions[0]; // Assuming one active subscription per user is sufficient
        console.log("✅ Subscription found in database:", {
          plan: sub.plan_name,
          status: sub.status,
          limit: sub.monthly_invoice_limit,
          overage: sub.overage_fee_per_invoice,
          processing: sub.payment_processing_fee,
        });

        if (
          sub.status === "active" ||
          sub.status === "trial" ||
          sub.status === "trialing"
        ) {
          subscriptionActivated(); // Trigger activation process
        } else {
          setError(
            `Subscription found but its status is: "${sub.status}". Please refresh the page or contact support.`,
          );
          setLoading(false); // Stop loading, indicate an issue
        }
      } else {
        setError(
          "Payment completed but no active subscription found in your account. Please refresh the page or contact support.",
        );
        setLoading(false); // Stop loading, indicate an issue
      }
    } catch (err) {
      console.error("❌ Database check error:", err);
      setError(
        `Could not verify subscription in the database: ${err.message}. Please refresh the page or contact support.`,
      );
      setLoading(false); // Stop loading, indicate an error
    }
  };

  // Replaced subscriptionActivated function
  const subscriptionActivated = () => {
    console.log("🎉 Subscription activated - UI updated");
    setSubscriptionReady(true);
    setLoading(false); // Stop loading
    setCountdown(5); // Set countdown to 5 seconds for redirect
  };

  // Replaced handleRedirectToDashboard function with handleGoToDashboard
  const handleGoToDashboard = () => {
    setRedirecting(true);
    console.log("🚀 Manually redirecting to Dashboard...");
    navigate(createPageUrl("Dashboard") + "?from=payment");
  };

  const features = [
    {
      icon: FileText,
      title: "Create Your First Invoice",
      description: "Start creating professional invoices in minutes",
      action: () => navigate(createPageUrl("CreateInvoice")),
      buttonText: "Create Invoice",
    },
    {
      icon: Users,
      title: "Add Your Clients",
      description: "Import or add clients to get started quickly",
      action: () => navigate(createPageUrl("Clients")),
      buttonText: "Manage Clients",
    },
    {
      icon: Settings,
      title: "Customize Your Settings",
      description: "Set up your business info and invoice templates",
      action: () => navigate(createPageUrl("Settings")),
      buttonText: "Go to Settings",
    },
  ];

  return (
    <div className="min-h-screen bg-surface-sunken py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-success-100 mb-6">
            <CheckCircle className="w-16 h-16 text-success-600" />
          </div>
          <h1 className="text-4xl sm:text-5xl font-black text-content mb-4">
            Payment Successful! 🎉
          </h1>
          <p className="text-xl text-content-body mb-2">
            Welcome to Invoicium Premium
          </p>
          <p className="text-content-muted">
            Your subscription is now active and ready to use
          </p>

          {/* Conditional rendering for loading state */}
          {loading && !subscriptionReady && (
            <div className="mt-6 p-4 bg-info-50 rounded-lg border border-info-200 inline-block">
              <p className="text-sm text-info-800 flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Verifying payment and activating subscription...
              </p>
            </div>
          )}

          {/* Conditional rendering for error/not ready state */}
          {!loading && !subscriptionReady && (
            <div className="mt-6 p-4 bg-caution-50 rounded-lg border border-caution-200 inline-block max-w-md">
              <div className="flex items-start gap-2 mb-3">
                <AlertCircle className="w-5 h-5 text-caution-600 flex-shrink-0 mt-0.5" />
                <div className="text-left">
                  <p className="text-sm text-caution-800 font-semibold">
                    {error
                      ? "Payment verification failed or timed out."
                      : "Still waiting for activation."}
                  </p>
                  {error && (
                    <p className="text-xs text-caution-700 mt-1">{error}</p>
                  )}
                  <p className="text-xs text-caution-700 mt-2">
                    If this persists, please try again or contact support.
                  </p>
                </div>
              </div>
              <div className="flex gap-2 justify-center mt-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setError(null); // Clear current error
                    setLoading(true); // Re-initiate loading state
                    if (sessionId)
                      confirmPayment(sessionId); // Try payment confirmation again if session ID exists
                    else checkDB(); // Otherwise, re-check DB
                  }}
                  disabled={loading} // Disable the button while already loading
                >
                  {loading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    "Try Again"
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* Conditional rendering for successful activation */}
          {subscriptionReady && !redirecting && (
            <div className="mt-6 p-4 bg-success-50 rounded-lg border border-success-200 inline-block">
              <p className="text-sm text-success-800 flex items-center gap-2">
                <CheckCircle className="w-4 h-4" />
                Subscription activated! Redirecting in {countdown} seconds...
              </p>
            </div>
          )}
        </div>

        <Card className="border-2 border-success-200 shadow-xl mb-8">
          <CardHeader className="bg-success-50 border-b">
            <CardTitle className="flex items-center gap-2 text-success-900">
              <Sparkles className="w-5 h-5" />
              Subscription Confirmed
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-success-100 flex items-center justify-center flex-shrink-0">
                  {subscriptionReady ? (
                    <CheckCircle className="w-5 h-5 text-success-600" />
                  ) : (
                    <Loader2 className="w-5 h-5 text-success-600 animate-spin" />
                  )}
                </div>
                <div>
                  <p className="text-sm text-content-body">Status</p>
                  <p className="font-semibold text-content">
                    {subscriptionReady ? "Active" : "Activating..."}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-info-100 flex items-center justify-center flex-shrink-0">
                  <Calendar className="w-5 h-5 text-info-600" />
                </div>
                <div>
                  <p className="text-sm text-content-body">Billing Starts</p>
                  <p className="font-semibold text-content">
                    {new Date().toLocaleDateString("en-US", {
                      month: "long",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-brand-100 flex items-center justify-center flex-shrink-0">
                  <CreditCard className="w-5 h-5 text-brand-600" />
                </div>
                <div>
                  <p className="text-sm text-content-body">Payment Method</p>
                  <p className="font-semibold text-content">Card on file</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-alert-100 flex items-center justify-center flex-shrink-0">
                  <Mail className="w-5 h-5 text-alert-600" />
                </div>
                <div>
                  <p className="text-sm text-content-body">Confirmation</p>
                  <p className="font-semibold text-content">Email sent</p>
                </div>
              </div>
            </div>

            {sessionId && (
              <div className="pt-4 border-t">
                <p className="text-xs text-content-muted">
                  Session ID:{" "}
                  <code className="bg-ink-100 px-2 py-1 rounded">
                    {sessionId}
                  </code>
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="mb-8">
          <h2 className="text-2xl font-black text-content mb-6 text-center">
            What's Next?
          </h2>
          <div className="grid md:grid-cols-3 gap-6">
            {features.map((feature, index) => (
              <Card
                key={index}
                className="border-none shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105"
              >
                <CardContent className="p-6 text-center">
                  <div className="w-14 h-14 rounded-xl bg-success-100 flex items-center justify-center mx-auto mb-4">
                    <feature.icon className="w-7 h-7 text-success-600" />
                  </div>
                  <h3 className="text-lg font-black text-content mb-2">
                    {feature.title}
                  </h3>
                  <p className="text-sm text-content-body mb-4">
                    {feature.description}
                  </p>
                  <Button
                    onClick={feature.action}
                    variant="outline"
                    disabled={!subscriptionReady}
                    className="w-full border-success-200 hover:bg-success-50 hover:border-success-300"
                  >
                    {feature.buttonText}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        <div className="text-center">
          <Button
            onClick={handleGoToDashboard}
            size="lg"
            disabled={!subscriptionReady || redirecting}
            className="bg-brand hover:bg-brand-hover text-lg px-10 py-6 rounded-xl shadow-lg hover:shadow-xl transition-all gap-2"
          >
            {redirecting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" /> Redirecting...
              </>
            ) : !subscriptionReady ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" /> Activating...
              </>
            ) : (
              <>
                Go to Dashboard Now <ArrowRight className="w-5 h-5" />
              </>
            )}
          </Button>
          {subscriptionReady && !redirecting && (
            <p className="text-sm text-content-muted mt-3">
              Or wait {countdown} seconds for automatic redirect
            </p>
          )}
        </div>

        <Card className="mt-8 bg-info-50 border-info-200">
          <CardContent className="p-6">
            <div className="flex items-start gap-3">
              <Sparkles className="w-5 h-5 text-info-600 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-black text-info-900 mb-2">
                  You're All Set! 🎊
                </h3>
                <p className="text-sm text-info-800 mb-3">
                  Your account is configured and ready. You'll stay signed in
                  automatically across all your devices. Start creating invoices
                  right away!
                </p>
                <div className="flex flex-wrap gap-2">
                  <Badge className="bg-info-100 text-info-700 border-info-300">
                    Auto sign-in enabled
                  </Badge>
                  <Badge className="bg-info-100 text-info-700 border-info-300">
                    Email support included
                  </Badge>
                  <Badge className="bg-info-100 text-info-700 border-info-300">
                    Setup assistance available
                  </Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
