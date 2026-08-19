import React, { useState, useEffect } from "react";
import { sdk } from "@/api/sdk";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert } from "@/components/ui/alert";
import {
  Phone,
  Lock,
  Loader2,
  CheckCircle,
  AlertCircle,
  LogOut,
} from "lucide-react";

export default function PhoneVerification() {
  const navigate = useNavigate();
  const [step, setStep] = useState("phone"); // 'phone' or 'code'
  const [phoneNumber, setPhoneNumber] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [attemptsRemaining, setAttemptsRemaining] = useState(5);
  const [checkingAuth, setCheckingAuth] = useState(true);

  // Check if user is logged in, if not redirect to login
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const user = await sdk.auth.me();
        if (!user) {
          // Not logged in, redirect to home
          navigate(createPageUrl("Home"));
        }
        setCheckingAuth(false);
      } catch (error) {
        // Auth check failed, redirect to home
        navigate(createPageUrl("Home"));
      }
    };
    checkAuth();
  }, [navigate]);

  const handleSendCode = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await sdk.functions.invoke("sendPhoneVerification", {
        phone_number: phoneNumber,
      });

      if (response.data?.success) {
        setSuccess("Verification code sent! Check your phone.");
        setStep("code");
        setTimeout(() => setSuccess(null), 3000);
      } else {
        throw new Error(response.data?.error || "Failed to send code");
      }
    } catch (err) {
      console.error("Send code error:", err);
      setError(err.message || "Failed to send verification code");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await sdk.functions.invoke("verifyPhoneCode", {
        code: verificationCode,
      });

      if (response.data?.success) {
        setSuccess("Phone verified successfully! Redirecting...");

        // Send welcome email (don't block on this)
        try {
          await sdk.functions.invoke("sendWelcomeEmail");
        } catch (emailError) {
          console.error("Welcome email failed:", emailError);
          // Continue anyway - email failure shouldn't block login
        }

        // Wait for backend to propagate user update
        await new Promise((resolve) => setTimeout(resolve, 1000));

        // Check if user was trying to select a plan (stored in localStorage)
        const pendingPlan = localStorage.getItem("pending_plan_selection");

        // Use window.location for hard redirect to force full page reload and auth refresh
        if (pendingPlan) {
          // Clear the stored plan selection
          localStorage.removeItem("pending_plan_selection");
          window.location.href =
            window.location.origin + createPageUrl("Pricing");
        } else {
          // Normal flow - go to dashboard
          window.location.href =
            window.location.origin + createPageUrl("Dashboard");
        }
      } else {
        throw new Error(response.data?.error || "Invalid code");
      }
    } catch (err) {
      console.error("Verify code error:", err);
      setError(err.message || "Failed to verify code");

      // Check if error response has attempts remaining
      if (err.response?.data?.attempts_remaining !== undefined) {
        setAttemptsRemaining(err.response.data.attempts_remaining);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResendCode = async () => {
    setVerificationCode("");
    setError(null);
    setAttemptsRemaining(5);
    await handleSendCode({ preventDefault: () => {} });
  };

  const handleLogout = async () => {
    try {
      await sdk.auth.logout();
      navigate(createPageUrl("Home"));
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  if (checkingAuth) {
    return (
      <div className="min-h-screen bg-surface-sunken flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-success-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-sunken flex items-center justify-center p-4">
      <Card className="w-full max-w-md border-none shadow-2xl">
        <CardHeader className="text-center">
          <div className="w-16 h-16 bg-success-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Lock className="w-8 h-8 text-success-600" />
          </div>
          <CardTitle className="text-2xl font-black text-content">
            {step === "phone"
              ? "Account Verification Required"
              : "Enter Verification Code"}
          </CardTitle>
          <p className="text-sm text-content-body mt-2">
            {step === "phone"
              ? "You must verify your phone number to access your account"
              : `We sent a 6-digit code to ${phoneNumber}`}
          </p>
          <div className="mt-3 p-3 bg-warning-50 border border-warning-200 rounded-lg">
            <p className="text-xs text-warning-800 font-medium">
              ⚠️ Your account is restricted until verification is complete
            </p>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {error && (
            <Alert className="bg-danger-50 border-danger-200 text-danger-800">
              <AlertCircle className="w-4 h-4" />
              <span className="ml-2">{error}</span>
            </Alert>
          )}

          {success && (
            <Alert className="bg-success-50 border-success-200 text-success-800">
              <CheckCircle className="w-4 h-4" />
              <span className="ml-2">{success}</span>
            </Alert>
          )}

          {step === "phone" ? (
            <form onSubmit={handleSendCode} className="space-y-4">
              <div>
                <Label htmlFor="phone">Phone Number</Label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="+1 234 567 8900"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  required
                  className="mt-1"
                />
                <p className="text-xs text-content-muted mt-1">
                  Include country code (e.g., +1 for US/Canada)
                </p>
              </div>

              <Button
                type="submit"
                disabled={loading || !phoneNumber}
                className="w-full bg-brand hover:bg-brand-hover"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Sending Code...
                  </>
                ) : (
                  <>
                    <Lock className="w-4 h-4 mr-2" />
                    Send Verification Code
                  </>
                )}
              </Button>
            </form>
          ) : (
            <form onSubmit={handleVerifyCode} className="space-y-4">
              <div>
                <Label htmlFor="code">Verification Code</Label>
                <Input
                  id="code"
                  type="text"
                  placeholder="123456"
                  value={verificationCode}
                  onChange={(e) =>
                    setVerificationCode(
                      e.target.value.replace(/\D/g, "").slice(0, 6),
                    )
                  }
                  required
                  className="mt-1 text-center text-2xl tracking-widest font-mono"
                  maxLength={6}
                />
                {attemptsRemaining < 5 && (
                  <p className="text-xs text-alert-600 mt-1">
                    {attemptsRemaining} attempts remaining
                  </p>
                )}
              </div>

              <Button
                type="submit"
                disabled={loading || verificationCode.length !== 6}
                className="w-full bg-brand hover:bg-brand-hover"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Verifying...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Verify Phone Number
                  </>
                )}
              </Button>

              <div className="text-center">
                <button
                  type="button"
                  onClick={handleResendCode}
                  disabled={loading}
                  className="text-sm text-success-600 hover:text-success-700 font-medium"
                >
                  Didn't receive the code? Resend
                </button>
              </div>

              <div className="text-center">
                <button
                  type="button"
                  onClick={() => {
                    setStep("phone");
                    setVerificationCode("");
                    setError(null);
                  }}
                  className="text-sm text-content-body hover:text-ink-700"
                >
                  Change phone number
                </button>
              </div>
            </form>
          )}

          <div className="pt-4 border-t border-line">
            <Button
              onClick={handleLogout}
              variant="outline"
              className="w-full text-danger-700 border-danger-200 hover:bg-danger-50"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Cancel & Logout
            </Button>
            <p className="text-xs text-content-muted text-center mt-2">
              You'll need to register again to create a new account
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
