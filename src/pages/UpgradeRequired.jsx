import React from "react";
import { useLocation, Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Lock, Sparkles, ArrowRight, CheckCircle } from "lucide-react";

export default function UpgradeRequired() {
  const location = useLocation();
  const featureName = location.state?.featureName || "this feature";
  const requiredPlan = location.state?.requiredPlan || "higher plan";

  return (
    <div className="min-h-screen bg-surface-sunken flex items-center justify-center p-4">
      <Card className="max-w-2xl w-full border-2 border-warning-200 shadow-2xl">
        <CardContent className="p-8 sm:p-12 text-center">
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-warning-400 flex items-center justify-center shadow-xl">
            <Lock className="w-10 h-10 text-content-inverted" />
          </div>

          <h1 className="text-3xl sm:text-4xl font-black text-content mb-4 flex items-center justify-center gap-3">
            <Sparkles className="w-8 h-8 text-warning-500" />
            Upgrade Required
          </h1>

          <p className="text-xl text-ink-700 mb-6">
            If you want to use{" "}
            <span className="font-bold text-warning-600">{featureName}</span>,
            you'll need to upgrade your plan.
          </p>

          <Card className="bg-warning-50/40 border-warning-200 mb-8">
            <CardContent className="p-6">
              <p className="text-ink-800 mb-4">
                This feature is available on the{" "}
                <span className="font-bold text-warning-600">
                  {requiredPlan}
                </span>{" "}
                plan and higher.
              </p>

              <div className="space-y-3 text-left">
                <div className="flex items-start gap-2">
                  <CheckCircle className="w-5 h-5 text-success-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-ink-700">
                    Unlock powerful features to grow your business
                  </p>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle className="w-5 h-5 text-success-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-ink-700">
                    All plans include unlimited clients and custom branding
                  </p>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle className="w-5 h-5 text-success-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-ink-700">
                    Only 1% payment processing fee on all paid plans
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to={createPageUrl("Dashboard")}>
              <Button variant="outline" size="lg" className="w-full sm:w-auto">
                Go Back
              </Button>
            </Link>
            <Link to={createPageUrl("Pricing")}>
              <Button
                size="lg"
                className="w-full sm:w-auto bg-warning-500 text-content shadow-lg"
              >
                <ArrowRight className="w-5 h-5 mr-2" />
                View Plans & Upgrade
              </Button>
            </Link>
          </div>

          <p className="text-sm text-content-body mt-8">
            Questions?{" "}
            <a
              href="mailto:support@invoicium.ca"
              className="text-warning-600 hover:underline font-medium"
            >
              Contact Support
            </a>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
