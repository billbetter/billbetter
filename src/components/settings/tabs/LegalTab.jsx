import React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";
import { TabsContent } from "@/components/ui/tabs";
import { createPageUrl } from "@/utils";
import { sdk } from "@/api/sdk";

/** Links to the legal documents, and account deletion. */
export default function LegalTab({
  saving,
  setSaveMessage,
  setSaving,
  user,
}) {
  return (
    <TabsContent value="legal">
      <Card className="border-none shadow-lg bg-surface dark:bg-surface-inverted dark:border dark:border-ink-800">
        <CardHeader>
          <CardTitle className="text-content dark:text-content-inverted">
            Legal Documents
          </CardTitle>
          <p className="text-sm text-content-body dark:text-content-subtle">
            View our legal policies and terms
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4">
            <Card className="border border-line dark:border-ink-700 hover:border-success-300 dark:hover:border-success-700 hover:shadow-md transition-all bg-surface dark:bg-ink-800">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="text-lg font-black text-content dark:text-content-inverted mb-2">
                      Terms of Service
                    </h3>
                    <p className="text-sm text-content-body dark:text-content-subtle mb-4">
                      Read our complete Terms of Service, including
                      refund policy, liability disclaimers, and user
                      responsibilities.
                    </p>
                    <Link to={createPageUrl("TermsOfService")}>
                      <Button
                        variant="outline"
                        className="gap-2 dark:border-ink-700 dark:text-ink-300 dark:hover:bg-ink-800"
                      >
                        <FileText className="w-4 h-4" />
                        View Terms of Service
                      </Button>
                    </Link>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border border-line dark:border-ink-700 hover:border-success-300 dark:hover:border-success-700 hover:shadow-md transition-all bg-surface dark:bg-ink-800">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="text-lg font-black text-content dark:text-content-inverted mb-2">
                      Privacy Policy
                    </h3>
                    <p className="text-sm text-content-body dark:text-content-subtle mb-4">
                      Learn how we collect, use, and protect your
                      data. Required for Google Play and App Store
                      compliance.
                    </p>
                    <Link to={createPageUrl("PrivacyPolicy")}>
                      <Button
                        variant="outline"
                        className="gap-2 dark:border-ink-700 dark:text-ink-300 dark:hover:bg-ink-800"
                      >
                        <FileText className="w-4 h-4" />
                        View Privacy Policy
                      </Button>
                    </Link>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="mt-6 p-4 bg-brand-50 dark:bg-brand-900/20 rounded-lg border border-info-200 dark:border-info-800">
            <p className="text-sm text-info-800 dark:text-info-200">
              <strong>Note:</strong> By using Invoicium, you agree to
              our Terms of Service. Please review them carefully.
            </p>
          </div>

          {/* Delete Account Section */}
          <Card className="border-2 border-danger-300 dark:border-danger-800 bg-danger-50 dark:bg-danger-900/20 mt-6">
            <CardContent className="p-6">
              <h3 className="text-lg font-black text-danger-900 dark:text-danger-200 mb-2">
                Delete Account
              </h3>
              <p className="text-sm text-danger-800 dark:text-danger-300 mb-4">
                Permanently delete your Invoicium account and all
                associated data. This action cannot be undone.
              </p>
              <p className="text-xs text-danger-700 dark:text-danger-400 mb-4">
                This will delete: all invoices, quotes, clients, jobs,
                photos, and business settings.
              </p>
              <Button
                type="button"
                onClick={async () => {
                  if (
                    !confirm(
                      "Are you absolutely sure you want to delete your account? This will permanently delete all your data and cannot be undone. Type DELETE to confirm.",
                    )
                  ) {
                    return;
                  }

                  const confirmation = prompt(
                    "Type DELETE to confirm account deletion:",
                  );
                  if (confirmation !== "DELETE") {
                    alert(
                      "Account deletion cancelled. You must type DELETE exactly to confirm.",
                    );
                    return;
                  }

                  try {
                    setSaving(true);
                    // Delete all user data
                    const userId = user.id;

                    // Delete all related entities
                    await Promise.all([
                      sdk.entities.Invoice.filter({
                        user_id: userId,
                      }).then((items) =>
                        Promise.all(
                          items.map((item) =>
                            sdk.entities.Invoice.delete(item.id),
                          ),
                        ),
                      ),
                      sdk.entities.Quote.filter({
                        user_id: userId,
                      }).then((items) =>
                        Promise.all(
                          items.map((item) =>
                            sdk.entities.Quote.delete(item.id),
                          ),
                        ),
                      ),
                      sdk.entities.Client.filter({
                        user_id: userId,
                      }).then((items) =>
                        Promise.all(
                          items.map((item) =>
                            sdk.entities.Client.delete(item.id),
                          ),
                        ),
                      ),
                      sdk.entities.Job.filter({
                        user_id: userId,
                      }).then((items) =>
                        Promise.all(
                          items.map((item) =>
                            sdk.entities.Job.delete(item.id),
                          ),
                        ),
                      ),
                      sdk.entities.BusinessSettings.filter({
                        user_id: userId,
                      }).then((items) =>
                        Promise.all(
                          items.map((item) =>
                            sdk.entities.BusinessSettings.delete(
                              item.id,
                            ),
                          ),
                        ),
                      ),
                      sdk.entities.Subscription.filter({
                        user_id: userId,
                      }).then((items) =>
                        Promise.all(
                          items.map((item) =>
                            sdk.entities.Subscription.delete(item.id),
                          ),
                        ),
                      ),
                    ]);

                    // Logout and redirect
                    await sdk.auth.logout();
                    window.location.href = createPageUrl("Home");
                  } catch (error) {
                    console.error("Error deleting account:", error);
                    setSaveMessage(
                      "Failed to delete account. Please contact support.",
                    );
                    setTimeout(() => setSaveMessage(null), 5000);
                  } finally {
                    setSaving(false);
                  }
                }}
                className="bg-danger-600 hover:bg-danger-700 dark:bg-danger-700 dark:hover:bg-danger-600 text-content-inverted"
                disabled={saving}
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  "Delete My Account"
                )}
              </Button>
            </CardContent>
          </Card>
        </CardContent>
      </Card>
    </TabsContent>
  );
}
