import React from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, FileText } from "lucide-react";
import SEO from "@/components/seo/SEO";

export default function TermsOfService() {
  /*
    audit:light-only — deliberately no dark: variants on this page.

    TermsOfService is in Layout.jsx's `publicPages`, so it renders inside the
    signed-out marketing shell, and that shell is light in both themes by an
    explicit decision (see the audit:light-only marker at Layout.jsx:427):
    visitors who are not signed in have expressed no theme preference.

    Adding dark: variants here does not make the page dark -- it makes the BODY
    dark while the marketing header above it stays white, which reads as a bug
    rather than as dark mode. Measured, not guessed.

    PrivacyPolicy is NOT in publicPages, so it renders standalone and IS
    theme-aware. That asymmetry is real and is the reason the two legal pages
    do not match. Resolving it means picking one side for both, which is a
    product decision rather than a styling one.
  */
  return (
    <div className="min-h-screen bg-surface-sunken py-12 px-4 sm:px-6 lg:px-8">
      <SEO
        title="Terms of Service"
        description="Read Invoicium's Terms of Service. Understand the rules and guidelines for using our contractor invoicing platform."
        canonical="https://invoicium.ca/TermsOfService"
      />
      <div className="max-w-4xl mx-auto">
        <Link to={createPageUrl("Home")}>
          <Button
            variant="ghost"
            className="mb-6 hover:bg-ink-100 dark:hover:bg-ink-800 text-content dark:text-content-inverted"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Home
          </Button>
        </Link>

        <Card className="rounded-2xl border border-line shadow-sm bg-surface dark:bg-surface-inverted">
          <CardContent className="p-8 sm:p-12">
            <div className="flex items-center gap-4 mb-8">
              <div className="w-16 h-16 rounded-2xl bg-brand-100 flex items-center justify-center flex-shrink-0">
                <FileText className="w-8 h-8 text-brand-700" />
              </div>
              <div>
                <h1 className="text-3xl sm:text-4xl font-black text-content dark:text-content-inverted tracking-tight">
                  Terms of Service
                </h1>
                <p className="text-content-body dark:text-content-subtle mt-1">
                  Last Updated: January 21, 2026
                </p>
              </div>
            </div>

            <div className="prose prose-gray dark:prose-invert max-w-none">
              <p className="text-ink-700 dark:text-ink-300 mb-6">
                These Terms of Service ("Terms") constitute a legally binding
                agreement between you ("User," "you," or "your") and Invoicium
                Inc. ("Invoicium," "we," "us," or "our"), governing your access
                to and use of the Invoicium platform, website, mobile
                applications, APIs, integrations, and related services
                (collectively, the "Service").
              </p>

              <p className="text-ink-700 dark:text-ink-300 mb-8 font-semibold">
                By accessing or using Invoicium, you confirm that you have read,
                understood, and agreed to be legally bound by these Terms. If
                you do not agree, you must not use the Service.
              </p>

              {/* Section 1 */}
              <h2 className="text-xl font-black text-content mt-10 mb-4 pb-2 border-b border-line">
                1. Description of the Service
              </h2>
              <p className="text-ink-700 dark:text-ink-300 mb-4">
                Invoicium is a software-as-a-service (SaaS) platform that
                provides tools for:
              </p>
              <ul className="list-disc pl-6 mb-6 space-y-2 text-ink-700 dark:text-ink-300">
                <li>creating invoices, estimates, and quotes</li>
                <li>managing contractor workflows</li>
                <li>client communication and notifications</li>
                <li>record tracking and document storage</li>
                <li>automation features</li>
                <li>optional third-party integrations</li>
              </ul>
              <p className="text-ink-700 dark:text-ink-300 mb-4 font-semibold">
                Invoicium does NOT:
              </p>
              <ul className="list-disc pl-6 mb-6 space-y-2 text-ink-700 dark:text-ink-300">
                <li>process payments</li>
                <li>guarantee payment collection</li>
                <li>enforce invoices</li>
                <li>act as a bank, escrow, or payment intermediary</li>
                <li>verify client identity</li>
                <li>guarantee accuracy of calculations</li>
                <li>guarantee system uptime</li>
                <li>provide accounting, tax, legal, or financial advice</li>
              </ul>
              <p className="text-ink-700 dark:text-ink-300 mb-6 font-semibold">
                Invoicium provides software tools only.
              </p>

              {/* Section 2 */}
              <h2 className="text-xl font-black text-content mt-10 mb-4 pb-2 border-b border-line">
                2. Eligibility
              </h2>
              <p className="text-ink-700 dark:text-ink-300 mb-2">You must:</p>
              <ul className="list-disc pl-6 mb-6 space-y-2 text-ink-700 dark:text-ink-300">
                <li>be at least 18 years old</li>
                <li>have legal authority to operate a business</li>
                <li>comply with all applicable laws</li>
                <li>provide accurate account information</li>
              </ul>
              <p className="text-ink-700 dark:text-ink-300 mb-6">
                Invoicium may suspend or terminate accounts at any time for
                violations.
              </p>

              {/* Section 3 */}
              <h2 className="text-xl font-black text-content mt-10 mb-4 pb-2 border-b border-line">
                3. Account Responsibility
              </h2>
              <p className="text-ink-700 dark:text-ink-300 mb-2">
                You are solely responsible for:
              </p>
              <ul className="list-disc pl-6 mb-6 space-y-2 text-ink-700 dark:text-ink-300">
                <li>all activity under your account</li>
                <li>maintaining password security</li>
                <li>permissions assigned to employees or crew members</li>
                <li>actions taken by anyone using your login</li>
                <li>
                  all invoices, quotes, data, and communications generated
                </li>
              </ul>
              <p className="text-ink-700 dark:text-ink-300 mb-6">
                Invoicium assumes no responsibility for unauthorized access
                caused by user negligence.
              </p>

              {/* Section 4 */}
              <h2 className="text-xl font-black text-content mt-10 mb-4 pb-2 border-b border-line">
                4. Independent Contractor Relationship
              </h2>
              <p className="text-ink-700 dark:text-ink-300 mb-2">
                Nothing in these Terms creates:
              </p>
              <ul className="list-disc pl-6 mb-6 space-y-2 text-ink-700 dark:text-ink-300">
                <li>an employment relationship</li>
                <li>a partnership</li>
                <li>a joint venture</li>
                <li>an agency relationship</li>
              </ul>
              <p className="text-ink-700 dark:text-ink-300 mb-6">
                You are not an employee, representative, or agent of Invoicium.
              </p>

              {/* Section 5 */}
              <h2 className="text-xl font-black text-content mt-10 mb-4 pb-2 border-b border-line">
                5. No Guarantee of Payment or Revenue
              </h2>
              <p className="text-ink-700 dark:text-ink-300 mb-2">
                Invoicium does not guarantee:
              </p>
              <ul className="list-disc pl-6 mb-6 space-y-2 text-ink-700 dark:text-ink-300">
                <li>that invoices will be paid</li>
                <li>that clients will respond</li>
                <li>that estimates will be approved</li>
                <li>that follow-ups will succeed</li>
                <li>that any revenue will be generated</li>
              </ul>
              <p className="text-ink-700 dark:text-ink-300 mb-4">
                All financial outcomes depend solely on your business practices
                and clients.
              </p>
              <p className="text-ink-700 dark:text-ink-300 mb-2 font-semibold">
                Invoicium is not liable for:
              </p>
              <ul className="list-disc pl-6 mb-6 space-y-2 text-ink-700 dark:text-ink-300">
                <li>unpaid invoices</li>
                <li>late payments</li>
                <li>chargebacks</li>
                <li>client disputes</li>
                <li>lost income</li>
                <li>business interruption</li>
              </ul>

              {/* Section 6 */}
              <h2 className="text-xl font-black text-content mt-10 mb-4 pb-2 border-b border-line">
                6. Third-Party Services & Integrations
              </h2>
              <p className="text-ink-700 dark:text-ink-300 mb-4">
                Invoicium may integrate with third-party services including but
                not limited to:
              </p>
              <ul className="list-disc pl-6 mb-4 space-y-2 text-ink-700 dark:text-ink-300">
                <li>SMS providers (e.g., Infobip, Twilio)</li>
                <li>email platforms</li>
                <li>scheduling tools</li>
                <li>payment processors</li>
                <li>automation APIs</li>
              </ul>
              <p className="text-ink-700 mb-2 font-semibold">Invoicium:</p>
              <ul className="list-disc pl-6 mb-6 space-y-2 text-ink-700">
                <li>does not control third-party systems</li>
                <li>is not responsible for outages or failures</li>
                <li>does not guarantee integration uptime</li>
                <li>does not endorse third-party services</li>
              </ul>
              <p className="text-ink-700 mb-6">
                All third-party services are governed by their own terms.
              </p>

              {/* Section 7 */}
              <h2 className="text-xl font-black text-content mt-10 mb-4 pb-2 border-b border-line">
                7. Service Availability & Downtime
              </h2>
              <p className="text-ink-700 mb-4">
                The Service is provided "as is" and "as available."
              </p>
              <p className="text-ink-700 mb-2">
                Invoicium makes no guarantees regarding:
              </p>
              <ul className="list-disc pl-6 mb-4 space-y-2 text-ink-700">
                <li>uptime</li>
                <li>availability</li>
                <li>speed</li>
                <li>performance</li>
                <li>reliability</li>
              </ul>
              <p className="text-ink-700 mb-2">
                Service interruptions may occur due to:
              </p>
              <ul className="list-disc pl-6 mb-6 space-y-2 text-ink-700">
                <li>maintenance</li>
                <li>updates</li>
                <li>server outages</li>
                <li>hosting failures</li>
                <li>internet disruptions</li>
                <li>cyber incidents</li>
                <li>force majeure events</li>
              </ul>
              <p className="text-ink-700 mb-6">
                Invoicium is not liable for any losses caused by downtime.
              </p>

              {/* Section 8 */}
              <h2 className="text-xl font-black text-content mt-10 mb-4 pb-2 border-b border-line">
                8. Bugs, Errors, and Software Limitations
              </h2>
              <p className="text-ink-700 mb-2">You acknowledge that:</p>
              <ul className="list-disc pl-6 mb-4 space-y-2 text-ink-700">
                <li>software may contain bugs</li>
                <li>calculations may contain errors</li>
                <li>automations may fail</li>
                <li>notifications may not deliver</li>
                <li>features may behave unpredictably</li>
              </ul>
              <p className="text-ink-700 mb-2">
                Invoicium does not warrant that the Service will be:
              </p>
              <ul className="list-disc pl-6 mb-6 space-y-2 text-ink-700">
                <li>error-free</li>
                <li>uninterrupted</li>
                <li>accurate</li>
                <li>secure</li>
              </ul>
              <p className="text-ink-700 mb-6">
                You agree to independently verify all data before relying on it.
              </p>

              {/* Section 9 */}
              <h2 className="text-xl font-black text-content mt-10 mb-4 pb-2 border-b border-line">
                9. Data Storage & Loss
              </h2>
              <p className="text-ink-700 mb-4">
                Invoicium may store user data but does not guarantee data
                preservation.
              </p>
              <p className="text-ink-700 mb-2">
                You are solely responsible for:
              </p>
              <ul className="list-disc pl-6 mb-4 space-y-2 text-ink-700">
                <li>backing up invoices</li>
                <li>exporting records</li>
                <li>maintaining copies</li>
              </ul>
              <p className="text-ink-700 mb-2">
                Invoicium is not responsible for:
              </p>
              <ul className="list-disc pl-6 mb-6 space-y-2 text-ink-700">
                <li>accidental deletion</li>
                <li>corruption</li>
                <li>synchronization failures</li>
                <li>cyber incidents</li>
                <li>server loss</li>
              </ul>

              {/* Section 10 */}
              <h2 className="text-xl font-black text-content mt-10 mb-4 pb-2 border-b border-line">
                10. User Content
              </h2>
              <p className="text-ink-700 mb-4">
                You retain ownership of content you upload.
              </p>
              <p className="text-ink-700 mb-2">
                However, you grant Invoicium a worldwide, royalty-free license
                to:
              </p>
              <ul className="list-disc pl-6 mb-6 space-y-2 text-ink-700">
                <li>host</li>
                <li>store</li>
                <li>process</li>
                <li>transmit</li>
                <li>display</li>
              </ul>
              <p className="text-ink-700 mb-4">
                solely to operate the Service.
              </p>
              <p className="text-ink-700 mb-6">
                You represent that you have all rights to upload such content.
              </p>

              {/* Section 11 */}
              <h2 className="text-xl font-black text-content mt-10 mb-4 pb-2 border-b border-line">
                11. Prohibited Uses
              </h2>
              <p className="text-ink-700 mb-2">You may not:</p>
              <ul className="list-disc pl-6 mb-6 space-y-2 text-ink-700">
                <li>violate laws or regulations</li>
                <li>transmit fraudulent invoices</li>
                <li>impersonate others</li>
                <li>misuse client data</li>
                <li>attempt to hack or reverse engineer</li>
                <li>overload or disrupt systems</li>
                <li>resell without authorization</li>
              </ul>
              <p className="text-ink-700 mb-6">
                Violation may result in immediate termination.
              </p>

              {/* Section 12 */}
              <h2 className="text-xl font-black text-content mt-10 mb-4 pb-2 border-b border-line">
                12. Subscription Plans & Fees
              </h2>
              <p className="text-ink-700 mb-2">Paid plans may include:</p>
              <ul className="list-disc pl-6 mb-4 space-y-2 text-ink-700">
                <li>monthly or annual fees</li>
                <li>integration usage limits</li>
                <li>automation quotas</li>
                <li>feature restrictions</li>
              </ul>
              <p className="text-ink-700 mb-2">All fees are:</p>
              <ul className="list-disc pl-6 mb-6 space-y-2 text-ink-700">
                <li>non-refundable</li>
                <li>billed in advance</li>
                <li>subject to change</li>
              </ul>
              <p className="text-ink-700 mb-6">
                Failure to pay may result in suspension.
              </p>

              {/* Section 13 */}
              <h2 className="text-xl font-black text-content mt-10 mb-4 pb-2 border-b border-line">
                13. No Refund Policy
              </h2>
              <p className="text-ink-700 mb-2">
                All payments are final and non-refundable, including but not
                limited to:
              </p>
              <ul className="list-disc pl-6 mb-6 space-y-2 text-ink-700">
                <li>unused time</li>
                <li>feature dissatisfaction</li>
                <li>bugs</li>
                <li>downtime</li>
                <li>user error</li>
              </ul>

              {/* Section 14 */}
              <h2 className="text-xl font-black text-content mt-10 mb-4 pb-2 border-b border-line">
                14. Intellectual Property
              </h2>
              <p className="text-ink-700 mb-4">
                All Invoicium software, branding, logos, designs, and code are
                owned by Invoicium.
              </p>
              <p className="text-ink-700 mb-6">
                You receive a limited, non-exclusive, revocable license to use
                the Service. No ownership rights are transferred.
              </p>

              {/* Section 15 */}
              <h2 className="text-xl font-black text-content mt-10 mb-4 pb-2 border-b border-line">
                15. Confidentiality
              </h2>
              <p className="text-ink-700 mb-2">You agree not to disclose:</p>
              <ul className="list-disc pl-6 mb-6 space-y-2 text-ink-700">
                <li>proprietary systems</li>
                <li>automation logic</li>
                <li>platform architecture</li>
                <li>internal workflows</li>
              </ul>

              {/* Section 16 */}
              <h2 className="text-xl font-black text-content mt-10 mb-4 pb-2 border-b border-line">
                16. Termination
              </h2>
              <p className="text-ink-700 mb-4">
                Invoicium may suspend or terminate accounts at any time:
              </p>
              <ul className="list-disc pl-6 mb-4 space-y-2 text-ink-700">
                <li>with or without notice</li>
                <li>with or without cause</li>
              </ul>
              <p className="text-ink-700 mb-2">Upon termination:</p>
              <ul className="list-disc pl-6 mb-6 space-y-2 text-ink-700">
                <li>access ends immediately</li>
                <li>data may be deleted</li>
                <li>outstanding fees remain owed</li>
              </ul>

              {/* Section 17 */}
              <h2 className="text-xl font-black text-content mt-10 mb-4 pb-2 border-b border-line">
                17. Disclaimer of Warranties
              </h2>
              <p className="text-ink-700 mb-4 font-semibold">
                TO THE MAXIMUM EXTENT PERMITTED BY LAW:
              </p>
              <p className="text-ink-700 mb-4">
                THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE."
              </p>
              <p className="text-ink-700 mb-2">
                INVOICIUM DISCLAIMS ALL WARRANTIES, INCLUDING:
              </p>
              <ul className="list-disc pl-6 mb-6 space-y-2 text-ink-700">
                <li>merchantability</li>
                <li>fitness for a particular purpose</li>
                <li>non-infringement</li>
                <li>accuracy</li>
                <li>reliability</li>
              </ul>

              {/* Section 18 */}
              <h2 className="text-xl font-black text-content mt-10 mb-4 pb-2 border-b border-line">
                18. Limitation of Liability
              </h2>
              <p className="text-ink-700 mb-4 font-semibold">
                TO THE MAXIMUM EXTENT PERMITTED BY LAW:
              </p>
              <p className="text-ink-700 mb-2">
                INVOICIUM SHALL NOT BE LIABLE FOR:
              </p>
              <ul className="list-disc pl-6 mb-6 space-y-2 text-ink-700">
                <li>lost profits</li>
                <li>lost revenue</li>
                <li>unpaid invoices</li>
                <li>data loss</li>
                <li>downtime damages</li>
                <li>business interruption</li>
                <li>client disputes</li>
                <li>indirect or consequential damages</li>
              </ul>
              <p className="text-ink-700 mb-6 font-semibold">
                TOTAL LIABILITY SHALL NOT EXCEED THE AMOUNT PAID TO INVOICIUM IN
                THE PRIOR 30 DAYS — OR $0 IF NO FEES WERE PAID.
              </p>

              {/* Section 19 */}
              <h2 className="text-xl font-black text-content mt-10 mb-4 pb-2 border-b border-line">
                19. Indemnification
              </h2>
              <p className="text-ink-700 mb-2">
                You agree to indemnify and hold harmless Invoicium from all
                claims arising from:
              </p>
              <ul className="list-disc pl-6 mb-6 space-y-2 text-ink-700">
                <li>your business activities</li>
                <li>your invoices</li>
                <li>your clients</li>
                <li>your misuse of the Service</li>
                <li>legal violations</li>
                <li>tax obligations</li>
              </ul>
              <p className="text-ink-700 mb-6">Including attorney fees.</p>

              {/* Section 20 */}
              <h2 className="text-xl font-black text-content mt-10 mb-4 pb-2 border-b border-line">
                20. Arbitration Agreement
              </h2>
              <p className="text-ink-700 mb-4">
                Any dispute shall be resolved by binding arbitration, not court.
              </p>
              <p className="text-ink-700 mb-2">You waive:</p>
              <ul className="list-disc pl-6 mb-6 space-y-2 text-ink-700">
                <li>jury trial</li>
                <li>class actions</li>
                <li>representative actions</li>
              </ul>
              <p className="text-ink-700 mb-6">
                Arbitration shall occur in Ontario, Canada, unless prohibited by
                law.
              </p>

              {/* Section 21 */}
              <h2 className="text-xl font-black text-content mt-10 mb-4 pb-2 border-b border-line">
                21. Class Action Waiver
              </h2>
              <p className="text-ink-700 mb-4">
                You may bring claims only in your individual capacity.
              </p>
              <p className="text-ink-700 mb-2">You may not participate in:</p>
              <ul className="list-disc pl-6 mb-6 space-y-2 text-ink-700">
                <li>class actions</li>
                <li>collective actions</li>
                <li>representative lawsuits</li>
              </ul>

              {/* Section 22 */}
              <h2 className="text-xl font-black text-content mt-10 mb-4 pb-2 border-b border-line">
                22. Force Majeure
              </h2>
              <p className="text-ink-700 mb-2">
                Invoicium is not liable for failures caused by:
              </p>
              <ul className="list-disc pl-6 mb-6 space-y-2 text-ink-700">
                <li>acts of God</li>
                <li>internet outages</li>
                <li>power failures</li>
                <li>war</li>
                <li>strikes</li>
                <li>pandemics</li>
                <li>government actions</li>
              </ul>

              {/* Section 23 */}
              <h2 className="text-xl font-black text-content mt-10 mb-4 pb-2 border-b border-line">
                23. Modifications
              </h2>
              <p className="text-ink-700 mb-4">
                Invoicium may update these Terms at any time.
              </p>
              <p className="text-ink-700 mb-6">
                Continued use constitutes acceptance.
              </p>

              {/* Section 24 */}
              <h2 className="text-xl font-black text-content mt-10 mb-4 pb-2 border-b border-line">
                24. Governing Law
              </h2>
              <p className="text-ink-700 mb-6">
                These Terms are governed by the laws of Ontario, Canada, without
                regard to conflict-of-law principles.
              </p>

              {/* Section 25 */}
              <h2 className="text-xl font-black text-content mt-10 mb-4 pb-2 border-b border-line">
                25. Entire Agreement
              </h2>
              <p className="text-ink-700 mb-6">
                These Terms constitute the entire agreement between you and
                Invoicium.
              </p>

              {/* Section 26 */}
              <h2 className="text-xl font-black text-content mt-10 mb-4 pb-2 border-b border-line">
                26. Contact Information
              </h2>
              <p className="text-ink-700 mb-2 font-semibold">Invoicium Inc.</p>
              <p className="text-ink-700 mb-6">support@invoicium.ca</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
