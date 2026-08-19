import React from "react";
import {
  Calendar,
  Clock,
  Video,
  CheckCircle,
  ArrowRight,
  Star,
  Users,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import SEO from "@/components/seo/SEO";

export default function BookDemo() {
  const handleBooking = () => {
    window.open("https://calendar.app.google/oMcQbdWok7g1wYrm9", "_blank");
  };

  return (
    <>
      <SEO
        title="Book a Free 1-on-1 Demo | Invoicium"
        description="Schedule a free personalized demo of Invoicium. See how our invoicing platform can transform your contractor business in just 30 minutes."
      />

      <div className="min-h-screen bg-surface">
        {/* Hero Section */}
        <div className="relative overflow-hidden border-b border-line">
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[900px] h-[600px] bg-brand-300/25 rounded-full blur-[160px]" />
          </div>
          <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-14 sm:pt-24 pb-12 sm:pb-20 text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold mb-8 bg-success-50 text-success-700 border border-success-200">
              <Star className="w-4 h-4 flex-shrink-0 fill-current" />
              100% Free · No Commitment
            </div>

            <h1 className="text-[clamp(2.5rem,7vw,4.5rem)] font-black text-content mb-6 leading-[0.9] tracking-tight">
              See Invoicium in Action —<br />
              <span className="text-brand-700">Just for You</span>
            </h1>

            <p className="text-lg sm:text-xl text-content-body max-w-2xl mx-auto mb-10 leading-relaxed">
              Book a free 30-minute 1-on-1 demo with our team. We'll walk you
              through everything Invoicium can do for your business and answer
              any questions live.
            </p>

            <Button
              onClick={handleBooking}
              className="bg-brand hover:bg-brand-hover text-content-inverted text-base sm:text-lg h-14 px-8 sm:px-10 rounded-2xl font-black shadow-2xl shadow-brand-600/25 transition-all hover:scale-[1.02] active:scale-[0.98] w-full sm:w-auto"
            >
              <Calendar className="w-5 h-5 mr-2 flex-shrink-0" />
              Book My Free Demo
              <ArrowRight className="w-5 h-5 ml-2 flex-shrink-0" />
            </Button>

            <p className="text-content-muted text-sm mt-4">
              Pick a time that works for you — instant confirmation
            </p>
          </div>
        </div>

        {/* What to Expect */}
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
            {[
              {
                icon: Clock,
                title: "30 Minutes",
                description:
                  "A focused, no-fluff walkthrough tailored to your business needs.",
              },
              {
                icon: Video,
                title: "Live & Personal",
                description:
                  "1-on-1 with a real person — not a pre-recorded video or chatbot.",
              },
              {
                icon: Zap,
                title: "See Everything",
                description:
                  "Invoicing, AI tools, payments, crew management, and more — live.",
              },
            ].map((item, i) => (
              <div
                key={i}
                className="bg-surface border border-line hover:border-brand-300 rounded-2xl p-6 flex sm:flex-col items-center sm:text-center gap-4 sm:gap-0 shadow-sm hover:shadow-md transition-all"
              >
                <div className="w-12 h-12 rounded-xl bg-brand-100 flex items-center justify-center flex-shrink-0 sm:mx-auto sm:mb-4">
                  <item.icon className="w-6 h-6 text-brand-700" />
                </div>
                <div>
                  <h3 className="text-content font-black text-lg sm:mb-2">
                    {item.title}
                  </h3>
                  <p className="text-content-body text-sm leading-relaxed">
                    {item.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* What We'll Cover */}
        <div className="bg-brand-50 border-y border-line py-12 sm:py-20">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="bg-surface border border-line rounded-3xl p-6 sm:p-10 shadow-sm">
              <div className="flex items-center gap-3 mb-6 sm:mb-8">
                <div className="w-10 h-10 rounded-xl bg-brand-100 flex items-center justify-center flex-shrink-0">
                  <Users className="w-5 h-5 text-brand-700" />
                </div>
                <h2 className="text-2xl font-black text-content">
                  What We'll Cover
                </h2>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                {[
                  "Creating and sending professional invoices",
                  "AI-powered quote & invoice generation",
                  "Online payment setup with Stripe",
                  "Job tracking & photo documentation",
                  "Recurring invoices & automations",
                  "Crew management & permissions",
                  "Analytics & business insights",
                  "Your specific questions & use case",
                ].map((item, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 text-success-500 flex-shrink-0 mt-0.5" />
                    <span className="text-ink-700 text-sm font-medium">
                      {item}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* CTA Bottom */}
        <div className="relative py-20 sm:py-28 bg-surface-inverted overflow-hidden">
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[800px] h-[300px] bg-success-500/10 rounded-full blur-[100px]" />
          </div>
          <div className="relative max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="text-3xl sm:text-5xl font-black text-content-inverted mb-4 leading-tight">
              Ready to see it live?
            </h2>
            <p className="text-ink-300 text-base sm:text-lg mb-8 max-w-xl mx-auto">
              Pick a time that works for you. It's completely free and there's
              no pressure to sign up.
            </p>
            <Button
              onClick={handleBooking}
              className="bg-brand-500 hover:bg-brand-400 text-content text-base sm:text-lg h-14 px-10 rounded-2xl font-black shadow-2xl shadow-brand-500/30 transition-all hover:scale-[1.02] active:scale-[0.98] w-full sm:w-auto"
            >
              <Calendar className="w-5 h-5 mr-2 flex-shrink-0" />
              Book My Free Demo
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
