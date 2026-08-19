import React, { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { sdk } from "@/api/sdk";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";

export default function ApproveQuote() {
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    handleApproval();
  }, []);

  const handleApproval = async () => {
    try {
      const urlParams = new URLSearchParams(location.search);
      const token = urlParams.get("token");

      if (!token) {
        setError("Invalid approval link");
        setLoading(false);
        return;
      }

      const response = await sdk.functions.invoke("approveQuote", { token });

      if (response.data?.success) {
        setResult(response.data);
      } else if (response.data?.already_approved) {
        setError("This quote was already approved");
      } else if (response.data?.expired) {
        setError("This quote has expired");
      } else {
        setError("Failed to approve quote");
      }
    } catch (err) {
      console.error("Approval error:", err);
      setError("An error occurred");
    }
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-surface-sunken flex items-center justify-center p-4">
        <div className="bg-surface rounded-lg shadow-lg p-8 max-w-md w-full text-center">
          <Loader2 className="w-12 h-12 text-accent-600 animate-spin mx-auto mb-4" />
          <h2 className="text-xl font-black text-content">Processing...</h2>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-surface-sunken flex items-center justify-center p-4">
        <div className="bg-surface rounded-lg shadow-lg p-8 max-w-md w-full text-center">
          <XCircle className="w-12 h-12 text-danger-600 mx-auto mb-4" />
          <h2 className="text-xl font-black text-content mb-2">{error}</h2>
          <p className="text-content-body text-sm">
            You can close this window.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-sunken flex items-center justify-center p-4">
      <div className="bg-surface rounded-lg shadow-lg p-8 max-w-md w-full text-center">
        <CheckCircle className="w-16 h-16 text-success-600 mx-auto mb-4" />
        <h1 className="text-2xl font-black text-content mb-2">
          Quote Approved!
        </h1>
        <p className="text-ink-700 mb-4">
          Thank you, <strong>{result?.client_name}</strong>!
        </p>
        <div className="bg-accent-50 rounded-lg p-4 mb-4">
          <p className="text-sm text-accent-900">
            <strong>{result?.business_name || "Your contractor"}</strong> has
            been notified and will contact you shortly.
          </p>
        </div>
        <p className="text-sm text-content-body">
          You can close this window now.
        </p>
      </div>
    </div>
  );
}
