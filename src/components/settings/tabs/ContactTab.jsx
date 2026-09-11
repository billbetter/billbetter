import React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock, Mail, MessageSquare } from "lucide-react";
import { Link } from "react-router-dom";
import { TabsContent } from "@/components/ui/tabs";
import { createPageUrl } from "@/utils";

/** How to reach support. */
export default function ContactTab() {
  return (
    <TabsContent value="contact">
      <Card className="border-none shadow-lg bg-surface dark:bg-surface-inverted dark:border dark:border-ink-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-content dark:text-content-inverted">
            <MessageSquare className="w-5 h-5 text-success-600 dark:text-success-400" />
            Contact Support
          </CardTitle>
          <p className="text-sm text-content-body dark:text-content-subtle">
            Get help from the Invoicium team
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="p-6 bg-success-50 rounded-lg border border-success-200 dark:border-success-800 dark:bg-success-900/20">
            <h3 className="text-lg font-black text-content dark:text-content-inverted mb-2">
              Need Help?
            </h3>
            <p className="text-ink-700 dark:text-ink-300 mb-4">
              Our support team is here to help you with any questions
              or issues you may have.
            </p>
            <div className="space-y-3">
              <div className="flex items-center gap-3 text-ink-700 dark:text-ink-300">
                <Mail className="w-5 h-5 text-success-600 dark:text-success-400" />
                <div>
                  <p className="font-medium text-content dark:text-content-inverted">
                    Email Support
                  </p>
                  <a
                    href="mailto:support@invoicium.ca"
                    className="text-success-600 dark:text-success-400 hover:text-success-700 dark:hover:text-success-300"
                  >
                    support@invoicium.ca
                  </a>
                </div>
              </div>
              <div className="flex items-center gap-3 text-ink-700 dark:text-ink-300">
                <Clock className="w-5 h-5 text-success-600 dark:text-success-400" />
                <div>
                  <p className="font-medium text-content dark:text-content-inverted">
                    Response Time
                  </p>
                  <p className="text-sm text-content-body dark:text-content-subtle">
                    Usually within 24 hours
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-center">
            <Link
              to={createPageUrl("Contact")}
              className="w-full max-w-md"
            >
              <Button
                type="button"
                className="w-full bg-brand hover:bg-brand-hover dark:bg-brand dark:hover:bg-brand-hover"
              >
                <Mail className="w-4 h-4 mr-2" />
                Email Directly
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </TabsContent>
  );
}
