import React from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { ArrowLeft, Shield } from "lucide-react";
import SEO from "@/components/seo/SEO";

const LAST_UPDATED = "March 28, 2026";

const Section = ({ title, children }) => (
  <section className="mb-10">
    <h2 className="text-xl font-black text-content dark:text-content-inverted mb-4 pb-2 border-b border-line dark:border-ink-700">
      {title}
    </h2>
    <div className="space-y-3 text-ink-700 dark:text-ink-300 leading-relaxed">
      {children}
    </div>
  </section>
);

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-surface-sunken dark:bg-surface-inverted-deep">
      <SEO
        title="Privacy Policy"
        description="Learn how Invoicium collects, uses, and protects your personal data. Our privacy policy for contractor invoicing users."
        canonical="https://invoicium.ca/PrivacyPolicy"
      />
      {/* Header */}
      <div className="bg-surface dark:bg-surface-inverted border-b border-line dark:border-ink-800 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-3">
          <Link
            to={createPageUrl("Home")}
            className="flex items-center gap-2 text-content-body dark:text-content-subtle hover:text-brand-700 dark:hover:text-brand-400 transition-colors text-sm font-medium"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </Link>
          <span className="text-ink-300 dark:text-content-body">|</span>
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-brand-700 dark:text-brand-400" />
            <span className="text-sm font-semibold text-content dark:text-content-inverted">
              Privacy Policy
            </span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-3xl mx-auto px-4 py-10">
        {/* Title block */}
        <div className="mb-10">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-xl bg-brand-100 dark:bg-brand-900/40 flex items-center justify-center flex-shrink-0">
              <Shield className="w-6 h-6 text-brand-700 dark:text-brand-400" />
            </div>
            <div>
              <h1 className="text-3xl sm:text-4xl font-black text-content dark:text-content-inverted tracking-tight">
                Privacy Policy
              </h1>
              <p className="text-sm text-content-muted dark:text-content-subtle">
                Last Updated: {LAST_UPDATED}
              </p>
            </div>
          </div>
          <div className="p-4 bg-brand-50 dark:bg-brand-900/20 rounded-xl border border-brand-200 dark:border-brand-800">
            <p className="text-sm text-brand-800 dark:text-brand-200">
              Your privacy matters to us. This Privacy Policy explains how{" "}
              <strong>Invoicium</strong> collects, uses, and protects your
              information when you use our app and services. Please read it
              carefully.
            </p>
          </div>
        </div>

        {/* 1. Introduction */}
        <Section title="1. Introduction">
          <p>
            Invoicium ("we," "us," or "our") is a business management platform
            designed specifically for contractors, tradespeople, and
            service-based businesses. Invoicium helps you create invoices,
            manage clients, track jobs, send quotes, and run your business more
            efficiently.
          </p>
          <p>
            This Privacy Policy applies to all users of the Invoicium mobile
            app, web application, and any related services (collectively, the
            "Service"). By using Invoicium, you agree to the collection and use
            of information in accordance with this policy.
          </p>
          <p>
            If you do not agree with this policy, please discontinue use of the
            Service and contact us at{" "}
            <a
              href="mailto:support@invoicium.ca"
              className="text-brand-700 dark:text-brand-400 hover:underline"
            >
              support@invoicium.ca
            </a>{" "}
            to request deletion of your data.
          </p>
        </Section>

        {/* 2. Information We Collect */}
        <Section title="2. Information We Collect">
          <p>
            We collect the following categories of information to provide and
            improve our Service:
          </p>

          <div className="mt-4 space-y-4">
            <div className="p-4 bg-surface dark:bg-ink-800 rounded-xl border border-line dark:border-ink-700">
              <h3 className="font-black text-content dark:text-content-inverted mb-2">
                Account Information
              </h3>
              <ul className="list-disc list-inside space-y-1 text-sm">
                <li>
                  Full name and email address (used for login and communication)
                </li>
                <li>Phone number (optional, used for SMS notifications)</li>
                <li>Business name, business address, and logo</li>
                <li>Profile preferences and app settings</li>
              </ul>
            </div>

            <div className="p-4 bg-surface dark:bg-ink-800 rounded-xl border border-line dark:border-ink-700">
              <h3 className="font-black text-content dark:text-content-inverted mb-2">
                Business Data
              </h3>
              <ul className="list-disc list-inside space-y-1 text-sm">
                <li>Client records: names, addresses, email, phone numbers</li>
                <li>
                  Invoices, quotes, and job details you create within the app
                </li>
                <li>Job photos, notes, and associated materials</li>
                <li>Expense records and receipts you upload</li>
                <li>Recurring invoice schedules and payment terms</li>
                <li>Crew member information and permission settings</li>
              </ul>
            </div>

            <div className="p-4 bg-surface dark:bg-ink-800 rounded-xl border border-line dark:border-ink-700">
              <h3 className="font-black text-content dark:text-content-inverted mb-2">
                Payment-Related Data
              </h3>
              <ul className="list-disc list-inside space-y-1 text-sm">
                <li>Subscription plan and billing status</li>
                <li>
                  Payment processing is handled by Stripe — we do not store your
                  full card number, CVV, or sensitive banking credentials
                  directly
                </li>
                <li>
                  Stripe customer ID and subscription ID for billing management
                </li>
                <li>
                  Connected Stripe account identifiers for contractors accepting
                  payments
                </li>
              </ul>
            </div>

            <div className="p-4 bg-surface dark:bg-ink-800 rounded-xl border border-line dark:border-ink-700">
              <h3 className="font-black text-content dark:text-content-inverted mb-2">
                Device & Usage Data
              </h3>
              <ul className="list-disc list-inside space-y-1 text-sm">
                <li>Device type, operating system, and browser type</li>
                <li>
                  App usage patterns and feature interactions (anonymized)
                </li>
                <li>IP address and general location data</li>
                <li>
                  Error logs and crash reports to help us improve reliability
                </li>
              </ul>
            </div>
          </div>
        </Section>

        {/* 3. How We Use Your Information */}
        <Section title="3. How We Use Your Information">
          <p>We use the information we collect for the following purposes:</p>
          <ul className="list-disc list-inside space-y-2 mt-3">
            <li>
              <strong>To provide the Service:</strong> Create and manage your
              invoices, quotes, jobs, and client records.
            </li>
            <li>
              <strong>To process payments:</strong> Facilitate subscription
              billing and enable you to accept payments from your clients via
              Stripe.
            </li>
            <li>
              <strong>To send notifications:</strong> Email, SMS, and in-app
              notifications for invoice updates, payment confirmations, due date
              reminders, and system alerts — based on your preferences.
            </li>
            <li>
              <strong>To support your team:</strong> Enable crew management
              features, assign tasks, and share relevant job information with
              authorized team members.
            </li>
            <li>
              <strong>To improve the app:</strong> Analyze usage patterns (in
              anonymized form) to fix bugs, optimize performance, and develop
              new features.
            </li>
            <li>
              <strong>To communicate with you:</strong> Respond to support
              requests, send important account updates, and notify you of policy
              changes.
            </li>
            <li>
              <strong>To comply with legal obligations:</strong> Maintain
              records as required by applicable law.
            </li>
          </ul>
          <p className="mt-3 text-sm text-content-body dark:text-content-subtle">
            We will never use your data for purposes that are inconsistent with
            this Privacy Policy without obtaining your explicit consent first.
          </p>
        </Section>

        {/* 4. Third-Party Services */}
        <Section title="4. Third-Party Services">
          <p>
            Invoicium integrates with carefully selected third-party services to
            deliver its features. Each provider operates under their own privacy
            policy and security standards:
          </p>
          <div className="mt-4 space-y-3">
            {[
              {
                name: "Stripe",
                role: "Payment processing and subscription billing",
                link: "https://stripe.com/privacy",
                detail:
                  "Handles all credit card processing, Stripe Connect accounts for contractors, and subscription management. We transmit relevant billing data to Stripe but do not store raw card details.",
              },
              {
                name: "Resend / Email Providers",
                role: "Transactional email delivery",
                link: "https://resend.com/privacy",
                detail:
                  "Used to send invoice emails, notification emails, and other transactional messages to you and your clients on your behalf.",
              },
              {
                /*
                  Both are named because both are currently REACHABLE: SMS goes
                  through Infobip by default, and _shared/sms.ts keeps a Twilio
                  branch behind the SMS_PROVIDER switch so a bad rollout can be
                  rolled back without a code revert.

                  This list is not decorative -- the "How We Share" section below
                  says data is shared with "the third-party services listed
                  above", so an omission here is a false statement about where a
                  contractor's clients' phone numbers actually go.

                  Drop Twilio from this entry in the same commit that deletes the
                  Twilio branch from _shared/sms.ts, and not before.
                */
                /*
                  OPEN, and deliberately not answered here: this policy states
                  no processing or storage JURISDICTION for any vendor. §6 lists
                  technical controls only, and there is no international-transfer
                  section. Infobip is EU-headquartered where Twilio is US, so
                  this change adds a fourth jurisdiction (with Stripe, Resend and
                  Supabase) to a disclosure that names none.

                  Nothing here became false -- nothing was ever claimed. But a
                  policy precise about the vendor and silent about where the data
                  goes is worth a deliberate decision, not a default. Needs a
                  human call on cross-border wording; not written into a
                  provider-swap commit.
                */
                name: "Infobip and Twilio",
                role: "SMS notifications",
                link: "https://www.infobip.com/policies/privacy-notice",
                detail:
                  "Used to send SMS notifications, including invoice and quote delivery, to phone numbers you provide. Messages are sent through Infobip; Twilio remains configured as a fallback provider.",
              },
              {
                name: "Google Calendar",
                role: "Calendar integration (optional)",
                link: "https://policies.google.com/privacy",
                detail:
                  "If you connect your Google Calendar, we access only the calendar events necessary to sync your job schedules. This connection is optional and can be revoked at any time.",
              },
              {
                name: "Invoicium Platform",
                role: "App infrastructure and hosting",
                link: "https://invoicium.ca",
                detail:
                  "Invoicium provides secure local storage, authentication, and backend infrastructure for your business.",
              },
            ].map((provider) => (
              <div
                key={provider.name}
                className="p-4 bg-surface dark:bg-ink-800 rounded-xl border border-line dark:border-ink-700"
              >
                <div className="flex items-start justify-between mb-1 gap-2">
                  <h3 className="font-black text-content dark:text-content-inverted">
                    {provider.name}
                  </h3>
                  <span className="text-xs text-success-600 dark:text-success-400 font-medium shrink-0">
                    {provider.role}
                  </span>
                </div>
                <p className="text-sm text-content-body dark:text-content-subtle mb-2">
                  {provider.detail}
                </p>
                <a
                  href={provider.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-info-600 dark:text-info-400 hover:underline"
                >
                  View {provider.name} Privacy Policy →
                </a>
              </div>
            ))}
          </div>
        </Section>

        {/* 5. Data Sharing */}
        <Section title="5. Data Sharing & Disclosure">
          <div className="p-4 bg-success-50 dark:bg-success-900/20 rounded-xl border border-success-200 dark:border-success-800 mb-4">
            <p className="font-semibold text-success-800 dark:text-success-200">
              🔒 We do not sell, rent, or trade your personal information to
              third parties. Ever.
            </p>
          </div>
          <p>We only share your data in the following limited circumstances:</p>
          <ul className="list-disc list-inside space-y-2 mt-3">
            <li>
              <strong>With service providers:</strong> We share data with the
              third-party services listed above solely to operate and improve
              Invoicium. These providers are contractually obligated to protect
              your data.
            </li>
            <li>
              <strong>With your team members:</strong> Business data is shared
              with crew members you invite and authorize within your Invoicium
              account, based on the permissions you set.
            </li>
            <li>
              <strong>With your clients:</strong> Invoice and quote information
              is shared with your clients via email, SMS, or shareable links —
              only as you direct.
            </li>
            <li>
              <strong>For legal compliance:</strong> We may disclose data if
              required by law, court order, or government authority, or to
              protect the rights, property, or safety of Invoicium, our users,
              or the public.
            </li>
            <li>
              <strong>Business transfers:</strong> In the event of a merger,
              acquisition, or sale of assets, user data may be transferred as
              part of that transaction. We will notify you before your data is
              subject to a materially different privacy policy.
            </li>
          </ul>
        </Section>

        {/* 6. Data Security */}
        <Section title="6. Data Security">
          <p>
            We take the security of your data seriously and implement reasonable
            technical and organizational measures to protect it against
            unauthorized access, alteration, disclosure, or destruction. These
            measures include:
          </p>
          <ul className="list-disc list-inside space-y-2 mt-3">
            <li>Encrypted data transmission using HTTPS/TLS</li>
            <li>Secure, access-controlled database infrastructure</li>
            <li>Authentication and authorization controls</li>
            <li>Regular security monitoring and review</li>
            <li>
              Limited employee access to user data on a need-to-know basis
            </li>
          </ul>
          <div className="mt-4 p-4 bg-warning-50 dark:bg-warning-900/20 rounded-xl border border-warning-200 dark:border-warning-800">
            <p className="text-sm text-warning-800 dark:text-warning-200">
              <strong>Important Disclaimer:</strong> No method of transmission
              over the internet or electronic storage is 100% secure. While we
              strive to protect your data using commercially reasonable means,
              we cannot guarantee absolute security. In the event of a data
              breach that affects your personal information, we will notify you
              as required by applicable law.
            </p>
          </div>
        </Section>

        {/* 7. Your Rights */}
        <Section title="7. Your Rights & Choices">
          <p>
            You have the following rights regarding your personal information:
          </p>
          <div className="mt-4 space-y-3">
            {[
              {
                right: "Access",
                desc: "You can view and export the data associated with your account at any time through the app.",
              },
              {
                right: "Correction",
                desc: "You can update your account information, business details, and client records directly within Invoicium.",
              },
              {
                right: "Deletion",
                desc: "You can delete your account and all associated data from the Settings > Legal section of the app. Individual records (invoices, clients, jobs) can be deleted individually at any time.",
              },
              {
                right: "Data Portability",
                desc: "You can export your data in CSV format from the dashboard.",
              },
              {
                right: "Opt-Out of Notifications",
                desc: "You can manage email and SMS notification preferences in Settings > Notifications.",
              },
              {
                right: "Withdraw Consent",
                desc: "You may withdraw consent for optional data processing (such as Google Calendar integration) at any time without affecting the lawfulness of prior processing.",
              },
            ].map((item) => (
              <div
                key={item.right}
                className="flex gap-3 p-3 bg-surface dark:bg-ink-800 rounded-lg border border-line dark:border-ink-700"
              >
                <span className="w-2 h-2 rounded-full bg-success-500 mt-2 shrink-0" />
                <div>
                  <span className="font-semibold text-content dark:text-content-inverted">
                    {item.right}:{" "}
                  </span>
                  <span className="text-content-body dark:text-content-subtle text-sm">
                    {item.desc}
                  </span>
                </div>
              </div>
            ))}
          </div>
          <p className="mt-4 text-sm">
            To exercise any of these rights, please contact us at{" "}
            <a
              href="mailto:support@invoicium.ca"
              className="text-brand-700 dark:text-brand-400 hover:underline"
            >
              support@invoicium.ca
            </a>
            . We will respond to your request within 30 days.
          </p>
        </Section>

        {/* 8. Data Retention */}
        <Section title="8. Data Retention">
          <p>
            We retain your personal data for as long as your account is active
            or as needed to provide you with our services. Specifically:
          </p>
          <ul className="list-disc list-inside space-y-2 mt-3">
            <li>
              Account and business data is retained until you delete your
              account.
            </li>
            <li>
              Invoice and financial records may be retained for up to 7 years to
              comply with accounting and tax record requirements, even after
              account deletion, unless you specifically request earlier deletion
              and there is no legal basis to retain them.
            </li>
            <li>Log and analytics data is typically retained for 90 days.</li>
            <li>
              Backup data may persist for up to 30 additional days after
              deletion requests are processed.
            </li>
          </ul>
          <p className="mt-3 text-sm text-content-body dark:text-content-subtle">
            When data is no longer needed, we securely delete or anonymize it.
          </p>
        </Section>

        {/* 9. Children's Privacy */}
        <Section title="9. Children's Privacy">
          <p>
            Invoicium is a professional business tool intended exclusively for
            use by individuals who are 18 years of age or older. We do not
            knowingly collect or solicit personal information from anyone under
            the age of 13.
          </p>
          <p>
            If we become aware that we have collected personal information from
            a child under age 13 without parental consent, we will delete that
            information as quickly as possible. If you believe that a minor has
            provided us with personal information, please contact us at{" "}
            <a
              href="mailto:support@invoicium.ca"
              className="text-brand-700 dark:text-brand-400 hover:underline"
            >
              support@invoicium.ca
            </a>
            .
          </p>
        </Section>

        {/* 10. Cookies & Tracking */}
        <Section title="10. Cookies & Local Storage">
          <p>
            Invoicium uses browser local storage and session-based cookies to
            maintain your login state, remember your preferences (such as dark
            mode), and provide a consistent experience across sessions. We do
            not use third-party advertising cookies or tracking pixels.
          </p>
          <ul className="list-disc list-inside space-y-2 mt-3">
            <li>Authentication tokens to keep you securely logged in</li>
            <li>UI preferences (e.g., theme, sidebar state)</li>
            <li>Session identifiers for security purposes</li>
          </ul>
          <p className="mt-3 text-sm text-content-body dark:text-content-subtle">
            You can clear local storage and cookies at any time through your
            browser settings, though this will log you out of the app.
          </p>
        </Section>

        {/* 11. Changes to Policy */}
        <Section title="11. Changes to This Privacy Policy">
          <p>
            We may update this Privacy Policy from time to time to reflect
            changes in our practices, technology, legal requirements, or for
            other operational reasons. When we make changes, we will:
          </p>
          <ul className="list-disc list-inside space-y-2 mt-3">
            <li>Update the "Last Updated" date at the top of this page</li>
            <li>
              Notify you of material changes via email or an in-app notification
            </li>
            <li>
              In some cases, ask for your renewed consent if required by
              applicable law
            </li>
          </ul>
          <p className="mt-3">
            We encourage you to review this Privacy Policy periodically. Your
            continued use of Invoicium after any changes constitutes your
            acceptance of the updated policy.
          </p>
        </Section>

        {/* 12. Contact */}
        <Section title="12. Contact Us">
          <p>
            If you have any questions, concerns, or requests regarding this
            Privacy Policy or our data practices, please don't hesitate to reach
            out. We are committed to addressing your concerns promptly.
          </p>
          <div className="mt-4 p-6 bg-surface dark:bg-ink-800 rounded-xl border border-line dark:border-ink-700">
            <h3 className="font-black text-content dark:text-content-inverted mb-3">
              Invoicium Privacy Contact
            </h3>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <span className="text-content-muted dark:text-content-subtle w-20">
                  Email:
                </span>
                <a
                  href="mailto:support@invoicium.ca"
                  className="text-brand-700 dark:text-brand-400 hover:underline font-medium"
                >
                  support@invoicium.ca
                </a>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-content-muted dark:text-content-subtle w-20">
                  App:
                </span>
                <a
                  href="https://invoicium.ca"
                  className="text-brand-700 dark:text-brand-400 hover:underline font-medium"
                >
                  invoicium.ca
                </a>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-content-muted dark:text-content-subtle w-20">
                  Response:
                </span>
                <span className="text-ink-700 dark:text-ink-300">
                  Within 30 business days
                </span>
              </div>
            </div>
          </div>
        </Section>

        {/* Footer */}
        <div className="mt-10 pt-6 border-t border-line dark:border-ink-700 text-center">
          <p className="text-sm text-content-muted dark:text-content-subtle">
            © {new Date().getFullYear()} Invoicium. All rights reserved.
          </p>
          <p className="text-xs text-content-subtle dark:text-content-muted mt-1">
            Last Updated: {LAST_UPDATED}
          </p>
          <div className="flex justify-center gap-4 mt-3">
            <Link
              to={createPageUrl("TermsOfService")}
              className="text-xs text-brand-700 dark:text-brand-400 hover:underline"
            >
              Terms of Service
            </Link>
            <span className="text-ink-300 dark:text-content-body">|</span>
            <a
              href="mailto:support@invoicium.ca"
              className="text-xs text-brand-700 dark:text-brand-400 hover:underline"
            >
              Contact Support
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
