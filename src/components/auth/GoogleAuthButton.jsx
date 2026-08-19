import React, { useState } from "react";
import { Loader2 } from "lucide-react";
import { sdk } from "@/api/sdk";
import { Button } from "@/components/ui/button";

const isGoogleAuthEnabled = import.meta.env.VITE_ENABLE_GOOGLE_AUTH !== "false";

function GoogleMark() {
  return (
    <span
      className="flex h-5 w-5 items-center justify-center rounded-full bg-surface text-sm font-bold shadow-sm"
      aria-hidden="true"
    >
      <span className="text-info-600">G</span>
    </span>
  );
}

export default function GoogleAuthButton({
  returnUrl,
  label = "Continue with Google",
  className = "",
  onError,
}) {
  const [loading, setLoading] = useState(false);

  if (!isGoogleAuthEnabled) return null;

  const handleClick = async () => {
    setLoading(true);

    try {
      await sdk.auth.signInWithGoogle(returnUrl);
    } catch (err) {
      setLoading(false);
      onError?.(err);
    }
  };

  return (
    <Button
      type="button"
      variant="outline"
      onClick={handleClick}
      disabled={loading}
      className={`w-full h-11 rounded-lg border border-line bg-surface text-ink-700 hover:bg-surface-sunken hover:text-content font-semibold shadow-sm ${className}`}
    >
      {loading ? (
        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
      ) : (
        <GoogleMark />
      )}
      <span className="ml-2">{loading ? "Opening Google..." : label}</span>
    </Button>
  );
}
