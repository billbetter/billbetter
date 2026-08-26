import React from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { DORMANT_FEATURE_CARDS } from "@/config/dormantFeatures";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Sparkles,
  Mic,
  FileText,
  Zap,
  DollarSign,
  Download,
  BarChart3,
  Users,
  Calendar,
  Shield,
  Clock,
  CheckCircle,
  ArrowRight,
} from "lucide-react";
import SEO from "@/components/seo/SEO";
import { Section, SectionHeading } from "@/components/marketing";

export default function Features() {
  const coreFeatures = [
    {
      icon: Sparkles,
      title: "AI-Powered Invoice Generation",
      description:
        "Describe your work in plain language and our AI instantly creates professional line items with accurate pricing. Perfect for electricians, plumbers, HVAC technicians, and all trades.",
      color: "bg-brand-500",
      benefits: [
        "Save 10+ minutes per invoice",
        "Automatic pricing suggestions",
        "Smart categorization",
      ],
    },
    {
      icon: Mic,
      title: "Voice-to-Invoice Creation",
      description:
        "Too busy on the job site? Just speak your invoice details and watch them transform into a polished, professional invoice in seconds. No typing required.",
      color: "bg-brand-600",
      benefits: [
        "Hands-free invoicing",
        "Works while driving",
        "Natural speech recognition",
      ],
    },
    {
      icon: FileText,
      title: "Professional PDF Generation",
      description:
        "Every invoice automatically becomes a beautiful, branded PDF. Customize templates, add your logo, and include payment terms. Send directly to clients via email or SMS.",
      color: "bg-success-500",
      benefits: ["Custom branding", "Multiple templates", "Instant delivery"],
    },
    {
      icon: Zap,
      title: "Instant Payment Links",
      description:
        "Integrated Stripe checkout means your clients can pay with one click. Accept credit cards, debit cards, and digital wallets. Get paid faster than ever.",
      color: "bg-alert-500",
      benefits: [
        "One-click payments",
        "Secure processing",
        "Automatic receipts",
      ],
    },
    {
      icon: FileText,
      title: "Professional Quotes & Estimates",
      description:
        "Create detailed quotes with materials lists, labor costs, and project timelines. Share approval links with clients and convert approved quotes to invoices instantly.",
      color: "bg-accent-500",
      benefits: [
        "Client approval workflow",
        "Material breakdowns",
        "One-click conversion",
      ],
    },
    {
      icon: BarChart3,
      title: "Business Analytics Dashboard",
      description:
        "Track revenue trends, client spending patterns, and job profitability. Visual charts and insights help you understand your business performance at a glance.",
      color: "bg-aqua-500",
      benefits: ["Revenue tracking", "Client insights", "Profit analysis"],
    },
    {
      icon: Calendar,
      title: "Job Scheduling & Calendar",
      description:
        "Schedule jobs, assign crew members, and sync with Google Calendar. Get notifications and keep your team organized with centralized scheduling.",
      color: "bg-brand-500",
      benefits: ["Calendar sync", "Team scheduling", "Appointment reminders"],
    },
    {
      icon: Users,
      title: "Client Management",
      description:
        "Store client contact information, track invoice history, and manage relationships all in one place. Quick access to past jobs and payment records.",
      color: "bg-magenta-500",
      benefits: ["Centralized contacts", "Invoice history", "Payment tracking"],
    },
    {
      icon: Shield,
      title: "Crew Management & Permissions",
      description:
        "Add team members, assign roles, and control what each person can access. Perfect for growing contracting businesses with multiple technicians.",
      color: "bg-warning-500",
      benefits: [
        "Role-based access",
        "Team collaboration",
        "Activity tracking",
      ],
    },
    {
      icon: Download,
      title: "Excel Export",
      description:
        "Export all your invoices, quotes, and financial data to Excel with one click. Perfect for accounting, tax preparation, and year-end reporting.",
      color: "bg-brand-500",
      benefits: ["Tax preparation", "Accounting integration", "Custom reports"],
    },
    {
      icon: Clock,
      title: "Time Tracking & Job Costing",
      description:
        "Track time spent on jobs, calculate labor costs automatically, and ensure profitability on every project. See real-time job profitability.",
      color: "bg-positive-500",
      benefits: [
        "Accurate billing",
        "Profitability tracking",
        "Labor cost calculation",
      ],
    },
    // Crew Management and Time Tracking cards are filtered out below while
    // those features are dormant. Left in place so switching them back on is
    // one edit to config/dormantFeatures.js, not a rewrite of this page.
  ].filter((f) => !DORMANT_FEATURE_CARDS.has(f.title));

  const tradeSpecific = [
    {
      trade: "Electricians",
      features: [
        "Materials pricing for electrical supplies",
        "Code-compliant invoice templates",
        "Safety inspection quotes",
      ],
    },
    {
      trade: "Plumbers",
      features: [
        "Plumbing fixture pricing",
        "Emergency service invoicing",
        "Maintenance contract billing",
      ],
    },
    {
      trade: "HVAC Technicians",
      features: [
        "HVAC equipment quotes",
        "Seasonal service plans",
        "Energy efficiency estimates",
      ],
    },
    {
      trade: "General Contractors",
      features: [
        "Project milestone billing",
        "Subcontractor management",
        "Multi-phase quotes",
      ],
    },
    {
      trade: "Landscapers",
      features: [
        "Seasonal service packages",
        "Material quantity calculations",
        "Recurring maintenance billing",
      ],
    },
    {
      trade: "Roofing Contractors",
      features: [
        "Square footage calculations",
        "Material estimates",
        "Insurance claim documentation",
      ],
    },
  ];

  return (
    <>
      <SEO
        title="Contractor Invoicing & Quoting Features"
        description="AI invoicing, voice-to-text, recurring billing, and professional quotes built for electricians, plumbers, HVAC, and all trades. Get paid faster."
        keywords="contractor invoice software, trade invoice features, ai invoicing, voice invoice, recurring billing, quote software, electrician invoicing, plumber invoicing"
      />

      <div className="min-h-screen bg-surface">
        {/* Hero Section */}
        <section className="relative border-b border-line overflow-hidden py-20 sm:py-28 px-4 sm:px-6 lg:px-8">
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[900px] h-[600px] bg-brand-300/25 rounded-full blur-[160px]" />
          </div>
          <div className="relative max-w-7xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-brand-50 border border-brand-200 text-brand-700 text-sm font-bold mb-8">
              <Sparkles className="w-4 h-4 flex-shrink-0" />
              Built for Contractors & Trades
            </div>

            <h1 className="text-[clamp(2.5rem,7vw,4.5rem)] font-black text-content mb-6 leading-[0.9] tracking-tight">
              AI Invoicing Software
              <br />
              <span className="text-brand-700">for Contractors</span>
            </h1>

            <p className="text-lg sm:text-xl text-content-body mb-10 max-w-3xl mx-auto leading-relaxed">
              Everything electricians, plumbers, HVAC technicians, and
              contractors need to create professional invoices, send quotes,
              track payments, and manage their business—all in one powerful
              platform.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 justify-center items-center mb-10">
              <Button
                onClick={() =>
                  (window.location.href = createPageUrl("Pricing"))
                }
                size="lg"
                className="bg-brand hover:bg-brand-hover text-content-inverted h-14 px-8 rounded-2xl font-black shadow-2xl shadow-brand-600/25 transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                Start Free Trial
                <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
              <Link to={createPageUrl("Contact")}>
                <Button
                  size="lg"
                  variant="outline"
                  className="h-14 px-8 rounded-lg border border-line bg-surface text-content-body hover:bg-surface-sunken hover:text-content font-black transition-colors"
                >
                  Schedule Demo
                </Button>
              </Link>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-5 text-sm">
              {[
                "7-day free trial",
                "No credit card required",
                "Cancel anytime",
              ].map((t) => (
                <div
                  key={t}
                  className="flex items-center gap-2 text-success-600 font-semibold"
                >
                  <CheckCircle className="w-4 h-4 flex-shrink-0" /> {t}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Core Features Grid */}
        <section className="py-20 px-4 sm:px-6 lg:px-8 bg-surface">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-3xl sm:text-5xl font-black text-content mb-4">
                Complete Invoicing & Quoting Solution
              </h2>
              <p className="text-xl text-content-body max-w-3xl mx-auto">
                Every feature you need to streamline your contracting business,
                from AI-powered invoice creation to instant online payments
                and professional quote management.
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              {coreFeatures.map((feature, index) => (
                <Card
                  key={index}
                  className="rounded-2xl group bg-surface border border-line hover:border-brand-300 shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden"
                >
                  <CardContent className="p-6">
                    <div
                      className={`w-14 h-14 rounded-2xl ${feature.color} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}
                    >
                      <feature.icon className="w-7 h-7 text-content-inverted" />
                    </div>
                    <h3 className="text-xl font-black text-content mb-3">
                      {feature.title}
                    </h3>
                    <p className="text-content-body mb-4">
                      {feature.description}
                    </p>
                    <ul className="space-y-2">
                      {feature.benefits.map((benefit, idx) => (
                        <li
                          key={idx}
                          className="flex items-center gap-2 text-sm text-content-body"
                        >
                          <CheckCircle className="w-4 h-4 text-success-600 flex-shrink-0" />
                          {benefit}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Trade-Specific Features */}
        <section className="py-20 px-4 sm:px-6 lg:px-8 bg-brand-50 border-y border-line">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-3xl sm:text-5xl font-black text-content mb-4">
                Designed for Your Trade
              </h2>
              <p className="text-xl text-content-body max-w-3xl mx-auto">
                Industry-specific features tailored for electricians, plumbers,
                HVAC contractors, and every trade in between. We understand your
                unique business needs.
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {tradeSpecific.map((item, index) => (
                <Card
                  key={index}
                  className="rounded-xl border-2 border-line-subtle hover:border-success-200 hover:shadow-lg transition-all"
                >
                  <CardContent className="p-6">
                    <h3 className="text-xl font-black text-content mb-4">
                      {item.trade}
                    </h3>
                    <ul className="space-y-3">
                      {item.features.map((feature, idx) => (
                        <li key={idx} className="flex items-start gap-3">
                          <CheckCircle className="w-5 h-5 text-success-600 flex-shrink-0 mt-0.5" />
                          <span className="text-content-body">{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Benefits Section */}
        <section className="py-20 px-4 sm:px-6 lg:px-8 bg-surface">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-3xl sm:text-5xl font-black text-content mb-4">
                Why Contractors Choose Invoicium
              </h2>
              <p className="text-xl text-content-body max-w-3xl mx-auto">
                Built by contractors, for contractors. We know what you need
                because we've been in your shoes.
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
              <div className="bg-success-50 p-8 rounded-2xl">
                <h3 className="text-2xl font-black text-content mb-4">
                  Save Time
                </h3>
                <p className="text-content-body mb-4">
                  Create invoices in under 60 seconds with AI assistance. Spend
                  less time on paperwork and more time on profitable work.
                </p>
                <ul className="space-y-2">
                  <li className="flex items-center gap-2 text-ink-700">
                    <CheckCircle className="w-5 h-5 text-success-600" />
                    10+ minutes saved per invoice
                  </li>
                  <li className="flex items-center gap-2 text-ink-700">
                    <CheckCircle className="w-5 h-5 text-success-600" />
                    Instant payment links
                  </li>
                  <li className="flex items-center gap-2 text-ink-700">
                    <CheckCircle className="w-5 h-5 text-success-600" />
                    Voice-to-text invoicing
                  </li>
                </ul>
              </div>

              <div className="bg-info-50 p-8 rounded-2xl">
                <h3 className="text-2xl font-black text-content mb-4">
                  Get Paid Faster
                </h3>
                <p className="text-content-body mb-4">
                  Instant payment links and one-tap reminders mean you get
                  paid in days, not weeks.
                </p>
                <ul className="space-y-2">
                  <li className="flex items-center gap-2 text-ink-700">
                    <CheckCircle className="w-5 h-5 text-success-600" />
                    One-click online payments
                  </li>
                  <li className="flex items-center gap-2 text-ink-700">
                    <CheckCircle className="w-5 h-5 text-success-600" />
                    One-tap overdue reminders
                  </li>
                  <li className="flex items-center gap-2 text-ink-700">
                    <CheckCircle className="w-5 h-5 text-success-600" />
                    Instant payment receipts
                  </li>
                </ul>
              </div>

              <div className="bg-brand-50 p-8 rounded-2xl">
                <h3 className="text-2xl font-black text-content mb-4">
                  Look Professional
                </h3>
                <p className="text-content-body mb-4">
                  Branded invoices, polished quotes, and professional
                  communication build trust with clients.
                </p>
                <ul className="space-y-2">
                  <li className="flex items-center gap-2 text-ink-700">
                    <CheckCircle className="w-5 h-5 text-success-600" />
                    Custom branded PDFs
                  </li>
                  <li className="flex items-center gap-2 text-ink-700">
                    <CheckCircle className="w-5 h-5 text-success-600" />
                    Professional templates
                  </li>
                  <li className="flex items-center gap-2 text-ink-700">
                    <CheckCircle className="w-5 h-5 text-success-600" />
                    Consistent branding
                  </li>
                </ul>
              </div>

              <div className="bg-warning-50 p-8 rounded-2xl">
                <h3 className="text-2xl font-black text-content mb-4">
                  Grow Your Business
                </h3>
                <p className="text-content-body mb-4">
                  Analytics, insights, and automation help you scale from solo
                  contractor to full team operation.
                </p>
                <ul className="space-y-2">
                  <li className="flex items-center gap-2 text-ink-700">
                    <CheckCircle className="w-5 h-5 text-success-600" />
                    Revenue analytics
                  </li>
                  <li className="flex items-center gap-2 text-ink-700">
                    <CheckCircle className="w-5 h-5 text-success-600" />
                    Team management
                  </li>
                  <li className="flex items-center gap-2 text-ink-700">
                    <CheckCircle className="w-5 h-5 text-success-600" />
                    Client tracking
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <Section tone="dark" pad="lg" width="3xl" ambient="emerald">
          <div className="text-center">
            <SectionHeading
              invert
              title="Ready to Simplify Your Invoicing?"
              subtitle="Join hundreds of contractors who've streamlined their billing with Invoicium. Start your free 7-day trial today—no credit card required."
              className="mb-10"
            />
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button
                onClick={() =>
                  (window.location.href = createPageUrl("Pricing"))
                }
                variant="brandOnDark"
                size="brand"
              >
                View Pricing Plans
                <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
              <Link to={createPageUrl("Contact")}>
                <Button
                  size="brand"
                  className="w-full border border-ink-700 bg-ink-800 text-ink-200 hover:bg-ink-700 hover:text-content-inverted font-bold transition-colors"
                >
                  Contact Sales
                </Button>
              </Link>
            </div>
          </div>
        </Section>
      </div>
    </>
  );
}
