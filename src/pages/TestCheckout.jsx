import React, { useState } from "react";
import { sdk } from "@/api/sdk";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function TestCheckout() {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const testCheckout = async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      console.log("Testing createCheckoutSession...");

      const response = await sdk.functions.invoke("createCheckoutSession", {
        priceId: "price_1SPvB0BeVqmwJBExAU3yZVP5", // Starter monthly
        planName: "starter",
        billingCycle: "monthly",
      });

      console.log("Raw response:", response);
      setResult(JSON.stringify(response, null, 2));

      if (response?.data?.url) {
        console.log("✅ Success! Checkout URL:", response.data.url);
      } else {
        console.error("❌ No checkout URL in response");
      }
    } catch (err) {
      console.error("❌ Error:", err);
      setError(err.message || "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle>Test Stripe Checkout</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button onClick={testCheckout} disabled={loading}>
            {loading ? "Testing..." : "Test createCheckoutSession"}
          </Button>

          {result && (
            <div className="bg-positive-50 border border-positive-200 rounded p-4 dark:bg-positive-900/20 dark:border-positive-800/50">
              <h3 className="font-black text-positive-900 mb-2">
                ✅ Response:
              </h3>
              <pre className="text-xs overflow-auto">{result}</pre>
            </div>
          )}

          {error && (
            <div className="bg-danger-50 border border-danger-200 rounded p-4 dark:bg-danger-900/20 dark:border-danger-800/50">
              <h3 className="font-black text-danger-900 mb-2">❌ Error:</h3>
              <pre className="text-xs">{error}</pre>
            </div>
          )}

          <div className="bg-info-50 border border-info-200 rounded p-4 dark:bg-info-900/20 dark:border-info-800/50">
            <h3 className="font-black text-info-900 mb-2">📋 Instructions:</h3>
            <ol className="text-sm space-y-1 list-decimal list-inside">
              <li>Click "Test createCheckoutSession"</li>
              <li>Check browser console (F12)</li>
              <li>Look for detailed logs</li>
              <li>Share the response/error with me</li>
            </ol>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
