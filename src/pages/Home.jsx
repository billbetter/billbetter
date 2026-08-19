import React, { useState, useEffect, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { hasAppAccess } from "@/lib/access";
import { sdk } from "@/api/sdk";
import { Button } from "@/components/ui/button";
import IPhoneMockup from "@/components/ui/iphone-mockup";
import SEO from "@/components/seo/SEO";
import InstallPWA from "@/components/pwa/InstallPWA";
import {
  FileText,
  DollarSign,
  CheckCircle,
  ArrowRight,
  RefreshCw,
  Zap,
  Shield,
  Star,
  Smartphone,
  HardHat,
  Clock,
  Send,
  Bell,
  Eye,
  CreditCard,
  Building2,
} from "lucide-react";

const useInView = (options = {}) => {
  const [isInView, setIsInView] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1, ...options },
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);
  return [ref, isInView];
};

const FadeIn = ({ children, delay = 0, className = "" }) => {
  const [ref, isInView] = useInView();
  return (
    <div
      ref={ref}
      className={`transition-all duration-700 ${className} ${isInView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
};

export default function Home() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [subscription, setSubscription] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const currentUser = await sdk.auth.me();
      setUser(currentUser);
      if (!currentUser) {
        setLoading(false);
        return;
      }
      const subscriptionData = await sdk.entities.Subscription.filter({
        user_id: currentUser.id,
      });
      if (subscriptionData.length > 0) {
        const sub = subscriptionData[0];
        setSubscription(sub);
        if (hasAppAccess(sub)) {
          navigate(createPageUrl("Dashboard"), { replace: true });
          return;
        }
      } else {
        navigate(createPageUrl("Dashboard"), { replace: true });
        return;
      }
    } catch (error) {
      console.error("Home auth check error:", error);
      if (
        error?.code === "PGRST205" ||
        error?.message?.includes("Could not find the table")
      ) {
        navigate(createPageUrl("Dashboard"), { replace: true });
        return;
      }
      setUser(null);
      setSubscription(null);
    } finally {
      setLoading(false);
    }
  };

  const handleGetStarted = () => {
    if (user) {
      if (hasAppAccess(subscription)) navigate(createPageUrl("Dashboard"));
      else navigate(createPageUrl("Pricing"));
    } else {
      sdk.auth.redirectToLogin(createPageUrl("Pricing"));
    }
  };

  const handleLogin = () =>
    sdk.auth.redirectToLogin(createPageUrl("Dashboard"));
  const handleViewPricing = () => navigate(createPageUrl("Pricing"));
  const handleLogout = async () => {
    try {
      await sdk.auth.logout();
      window.location.href = window.location.origin + createPageUrl("Home");
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  const marqueeItems = [
    { text: "Invoice in 30 seconds", icon: Zap },
    { text: "Clients pay without an app", icon: Smartphone },
    { text: "Auto payment reminders", icon: Bell },
    { text: "Card · e-Transfer · Bank", icon: CreditCard },
    { text: "Track every invoice view", icon: Eye },
    { text: "Send by text, email, or link", icon: Send },
  ];

  const features = [
    {
      icon: Zap,
      accent: "violet",
      subtitle: "From truck to paid — before you leave the site",
      title: "Invoice in 30 Seconds",
      desc: "Add your services, hours, and materials. Tax calculates automatically. Send it before you even start your truck.",
      steps: [
        "Add services + hours",
        "Tax calculated automatically",
        "Send — they get it instantly",
      ],
    },
    {
      icon: Smartphone,
      accent: "emerald",
      subtitle: "No apps. No friction. Just a tap.",
      title: "Clients Pay by Link",
      desc: "Your client gets a link — by text, email, or however you send it. They open it on any phone and pay in one tap. No account needed.",
      steps: [
        "Send the invoice link",
        "Client opens on any phone",
        "Payment hits your account",
      ],
    },
    {
      icon: Bell,
      accent: "violet",
      subtitle: "The system follows up so you don't have to",
      title: "Auto-Reminders. Zero Chasing.",
      desc: "Haven't been paid by day 3, 7, or 14? Invoicium sends a polite reminder automatically. You stay professional. You get paid.",
      steps: [
        "Set your reminder schedule",
        "System sends at the right time",
        "Get notified when paid",
      ],
    },
  ];

  const trades = [
    "Electrical",
    "HVAC",
    "Plumbing",
    "Carpentry",
    "Landscaping",
    "Roofing",
    "Painting",
    "Flooring",
    "General Contracting",
    "Cleaning",
  ];

  const testimonials = [
    {
      quote:
        "I used to spend Sunday nights doing invoices. Now I send them from my truck before I drive away. Got paid same day last week.",
      name: "Mike T.",
      trade: "Electrician · 14 years",
      stars: 5,
    },
    {
      quote:
        "My clients are older guys who don't download apps. With Invoicium they just click the link and pay. No excuses anymore.",
      name: "Derek S.",
      trade: "HVAC Tech · 8 years",
      stars: 5,
    },
    {
      quote:
        "I was owed over $12,000 in unpaid invoices. Set up the reminders, got paid within a week. This thing pays for itself.",
      name: "Jason M.",
      trade: "Plumber · 11 years",
      stars: 5,
    },
  ];

  const pricingPlans = [
    {
      name: "Free",
      price: 0,
      features: [
        "10 documents (lifetime)",
        "Manual invoices & quotes",
        "Client management",
        "Email support",
      ],
      cta: "Start Free",
      isFree: true,
    },
    {
      name: "Core",
      price: 24,
      features: [
        "30 transactions/mo",
        "AI assistance",
        "Online payments",
        "Photo attachments",
      ],
      cta: "Get Core",
    },
    {
      name: "Essential",
      price: 39,
      features: [
        "75 transactions/mo",
        "Analytics dashboard",
        "Recurring invoices",
        "Job tracking",
      ],
      cta: "Get Essential",
    },
    {
      name: "Professional",
      price: 79,
      features: [
        "250 transactions/mo",
        "Custom templates",
        "Priority support",
        "Advanced reporting",
      ],
      cta: "Get Professional",
      popular: true,
    },
    {
      name: "Enterprise",
      price: 99,
      features: [
        "500 transactions/mo",
        "Crew management",
        "White-label options",
        "Dedicated support",
      ],
      cta: "Get Enterprise",
    },
  ];

  return (
    <>
      <SEO
        title="Invoicium – Get Paid Today | Contractor Invoicing"
        description="Stop chasing payments. Create invoices in 30 seconds, get paid instantly. The #1 invoicing app for contractors."
        keywords="contractor invoicing, get paid faster, invoice app, contractor billing, field service software"
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "SoftwareApplication",
          name: "Invoicium",
          applicationCategory: "BusinessApplication",
        }}
      />

      <style>{`
 @keyframes marquee { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
 .marquee-track { animation: marquee 30s linear infinite; }
 .marquee-track:hover { animation-play-state: paused; }
 @keyframes floatA { 0%,100% { transform: translateY(0px); } 50% { transform: translateY(-8px); } }
 @keyframes floatB { 0%,100% { transform: translateY(0px); } 50% { transform: translateY(-6px); } }
 .float-a { animation: floatA 3.2s ease-in-out infinite; }
 .float-b { animation: floatB 3.8s ease-in-out infinite 0.6s; }
 @keyframes pulseRing { 0%,100% { box-shadow: 0 0 0 0 rgba(2,132,199,0.18), 0 30px 70px rgba(15,23,42,0.18); } 50% { box-shadow: 0 0 0 12px rgba(2,132,199,0), 0 30px 70px rgba(15,23,42,0.18); } }
 .phone-glow { animation: pulseRing 3.5s ease-in-out infinite; }
 @keyframes scrollInvoice { 0%,100% { transform: translateY(0); } 45%,55% { transform: translateY(-52%); } }
 .scroll-invoice { animation: scrollInvoice 14s ease-in-out infinite; }
 @keyframes liveDot { 0%,100% { opacity: 1; } 50% { opacity: 0.3; } }
 .live-dot { animation: liveDot 1.4s ease-in-out infinite; }
 `}</style>

      <div className="bg-surface overflow-x-hidden w-full">
        {/* ── HERO ─────────────────────────────────────────────── */}
        <section className="relative min-h-[calc(100vh-64px)] flex items-center overflow-hidden">
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute -top-40 right-0 w-[900px] h-[900px] bg-brand-300/25 rounded-full blur-[160px]" />
            <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-success-200/30 rounded-full blur-[140px]" />
          </div>

          <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-24 w-full">
            <div className="grid lg:grid-cols-[1fr_auto] gap-10 lg:gap-20 items-center">
              {/* Copy */}
              <div className="max-w-2xl">
                <FadeIn>
                  <div className="inline-flex items-center gap-2 bg-brand-50 border border-brand-200 text-brand-700 px-4 py-2 rounded-full text-sm font-bold mb-8">
                    <HardHat className="w-4 h-4 flex-shrink-0" />
                    Built for the trades. Not accountants.
                  </div>
                </FadeIn>

                <FadeIn delay={80}>
                  <h1 className="text-[clamp(3.5rem,10vw,7rem)] font-black text-content leading-[0.88] mb-6 tracking-tight">
                    GET PAID
                    <br />
                    <span className="text-brand-700">TODAY.</span>
                  </h1>
                </FadeIn>

                <FadeIn delay={160}>
                  <p className="text-xl sm:text-2xl text-content-body mb-4 leading-relaxed font-medium">
                    Invoice in{" "}
                    <span className="text-content font-black">30 seconds.</span>{" "}
                    Clients pay by link —{" "}
                    <span className="text-content font-black">
                      no app needed.
                    </span>{" "}
                    Reminders go out{" "}
                    <span className="text-content font-black">
                      automatically.
                    </span>
                  </p>
                </FadeIn>

                <FadeIn delay={240}>
                  <p className="text-content-muted mb-10 text-lg">
                    The invoicing app for electricians, plumbers, HVAC techs,
                    and every trade tired of chasing money.
                  </p>
                </FadeIn>

                <FadeIn delay={320}>
                  <div className="flex flex-col sm:flex-row gap-3 mb-10">
                    {loading ? (
                      <Button
                        disabled
                        size="lg"
                        className="bg-ink-200 text-content-body h-14 px-8 rounded-2xl font-black"
                      >
                        <RefreshCw className="mr-2 w-5 h-5 animate-spin" />{" "}
                        Loading...
                      </Button>
                    ) : user ? (
                      <Button
                        onClick={() => navigate(createPageUrl("Dashboard"))}
                        size="lg"
                        className="bg-brand text-content-inverted h-14 px-8 rounded-2xl font-black shadow-2xl shadow-brand-600/25 transition-all hover:scale-[1.02] active:scale-[0.98]"
                      >
                        Go to Dashboard <ArrowRight className="ml-2 w-5 h-5" />
                      </Button>
                    ) : (
                      <>
                        <Button
                          onClick={handleGetStarted}
                          size="lg"
                          className="bg-brand text-content-inverted h-14 px-8 rounded-2xl font-black shadow-2xl shadow-brand-600/25 transition-all hover:scale-[1.02] active:scale-[0.98]"
                        >
                          Start Free Trial{" "}
                          <ArrowRight className="ml-2 w-5 h-5" />
                        </Button>
                        <Button
                          onClick={handleLogin}
                          size="lg"
                          variant="outline"
                          className="h-14 px-8 rounded-lg border border-line bg-surface text-content-body hover:bg-surface-sunken hover:text-content font-black transition-colors"
                        >
                          Sign In
                        </Button>
                      </>
                    )}
                  </div>
                </FadeIn>

                <FadeIn delay={400}>
                  <div className="flex flex-wrap gap-5 text-sm">
                    {[
                      "No credit card required",
                      "7-day free trial",
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
                </FadeIn>
              </div>

              {/* Phone mockup */}
              <div className="hidden lg:flex justify-center relative">
                <FadeIn delay={200}>
                  <div className="relative">
                    {/* Payment badge */}
                    <div className="float-a absolute -top-6 -right-8 bg-success-700 text-content-inverted px-4 py-3 rounded-2xl shadow-2xl shadow-success-500/40 z-20">
                      <div className="flex items-center gap-2.5">
                        <DollarSign className="w-6 h-6 flex-shrink-0" />
                        <div>
                          <p className="text-[10px] font-semibold opacity-80">
                            Payment Received
                          </p>
                          <p className="text-xl font-black">$6,045.50</p>
                        </div>
                      </div>
                    </div>

                    {/* Speed badge */}
                    <div className="float-b absolute -bottom-6 -left-8 bg-surface border border-line text-content px-4 py-2.5 rounded-xl shadow-xl z-20 flex items-center gap-2.5">
                      <div className="w-8 h-8 bg-brand-100 rounded-lg flex items-center justify-center flex-shrink-0">
                        <Zap className="w-4 h-4 text-brand-700" />
                      </div>
                      <div>
                        <p className="text-[10px] text-content-muted font-medium">
                          Invoice created in
                        </p>
                        <p className="font-black text-sm">28 seconds</p>
                      </div>
                    </div>

                    {/* Phone */}
                    <IPhoneMockup
                      model="15-pro"
                      color="black"
                      scale={0.72}
                      screenBg="#ffffff"
                      safeArea={false}
                      showHomeIndicator={true}
                      shadow="0 24px 60px rgba(0,0,0,0.55), 0 4px 12px rgba(0,0,0,0.3)"
                      className="phone-glow"
                    >
                      {/* Scrolling invoice content */}
                      <div
                        className="absolute inset-0 overflow-hidden bg-surface"
                        style={{
                          maskImage:
                            "linear-gradient(to bottom, transparent 0%, black 6%, black 92%, transparent 100%)",
                        }}
                      >
                        {/* Status bar */}
                        <div className="flex items-center justify-between px-6 pt-4 pb-1 bg-surface">
                          <span className="text-[13px] font-bold text-content">
                            9:41
                          </span>
                          <div className="w-5 h-3 border-2 border-ink-900 rounded-sm relative">
                            <div className="absolute inset-[1.5px] right-[2px] bg-surface-inverted rounded-[1px]" />
                          </div>
                        </div>

                        <div className="scroll-invoice px-5 pt-2 pb-10">
                          {/* Header */}
                          <div className="flex items-center justify-between mb-3 pb-2 border-b border-line-subtle">
                            <div>
                              <p className="text-[22px] font-black text-content leading-none">
                                INVOICE
                              </p>
                              <p className="text-[10px] text-content-subtle font-semibold mt-0.5">
                                INV-453694
                              </p>
                            </div>
                            <div className="flex items-center gap-1">
                              <div className="w-7 h-7 bg-brand-600 rounded-lg" />
                              <span className="text-[13px] font-black text-content">
                                Invoicium
                              </span>
                            </div>
                          </div>

                          {/* Business info */}
                          <div className="mb-3">
                            <p className="text-[12px] font-black text-content">
                              Invoicium
                            </p>
                            <p className="text-[10px] text-content-muted">
                              Youremail@Domain.com
                            </p>
                          </div>

                          {/* Bill To */}
                          <div className="bg-surface-sunken rounded-xl p-2.5 mb-3">
                            <p className="text-[9px] text-content-subtle font-bold uppercase tracking-widest mb-1">
                              Bill To
                            </p>
                            <p className="text-[13px] font-black text-content">
                              Example
                            </p>
                            <p className="text-[10px] text-content-muted">
                              client@gmail.com
                            </p>
                            <p className="text-[10px] text-content-muted">
                              +18000000000
                            </p>
                          </div>

                          {/* Dates row */}
                          <div className="grid grid-cols-3 gap-2 mb-3">
                            {[
                              ["Invoice #", "INV-453694"],
                              ["Date Issued", "2025-12-27"],
                              ["Due Date", "2026-01-25"],
                            ].map(([l, v]) => (
                              <div
                                key={l}
                                className="bg-surface-sunken rounded-lg p-1.5"
                              >
                                <p className="text-[8px] text-content-subtle font-semibold">
                                  {l}
                                </p>
                                <p className="text-[9px] font-bold text-content leading-tight">
                                  {v}
                                </p>
                              </div>
                            ))}
                          </div>

                          {/* Services */}
                          <p className="text-[9px] text-content-subtle font-bold uppercase tracking-widest mb-1.5">
                            Description of Services
                          </p>
                          <div className="border border-line-subtle rounded-xl overflow-hidden mb-3">
                            <div className="grid grid-cols-[1fr_auto] bg-surface-sunken px-2.5 py-1.5">
                              <p className="text-[8px] font-bold text-content-muted">
                                Item / Service
                              </p>
                              <p className="text-[8px] font-bold text-content-muted">
                                Amount
                              </p>
                            </div>
                            {[
                              ["AC Unit Installation", "$3,500.00"],
                              ["Ductwork Installation", "$800.00"],
                              ["Electrical Connection", "$300.00"],
                              ["Labor Hours (10 hrs @ $75)", "$750.00"],
                            ].map(([item, amt], i) => (
                              <div
                                key={item}
                                className={`grid grid-cols-[1fr_auto] px-2.5 py-2 ${i < 3 ? "border-b border-ink-50" : ""}`}
                              >
                                <p className="text-[10px] font-medium text-ink-800 pr-2">
                                  {item}
                                </p>
                                <p className="text-[10px] font-bold text-content">
                                  {amt}
                                </p>
                              </div>
                            ))}
                          </div>

                          {/* Totals */}
                          <div className="bg-surface-sunken rounded-xl p-2.5 mb-3">
                            <div className="flex justify-between text-[10px] mb-1.5">
                              <span className="text-content-muted">
                                Subtotal
                              </span>
                              <span className="font-semibold text-ink-800">
                                $5,350.00
                              </span>
                            </div>
                            <div className="flex justify-between text-[10px] mb-2">
                              <span className="text-content-muted">
                                Tax (13%)
                              </span>
                              <span className="font-semibold text-ink-800">
                                $695.50
                              </span>
                            </div>
                            <div className="flex justify-between border-t border-line pt-2">
                              <span className="text-[12px] font-black text-content">
                                Total Due
                              </span>
                              <span className="text-[13px] font-black text-success-600">
                                $6,045.50
                              </span>
                            </div>
                          </div>

                          {/* Payment info */}
                          <div className="mb-3">
                            <p className="text-[10px] font-black text-content mb-1">
                              Payment Information
                            </p>
                            <p className="text-[9px] text-content-muted">
                              Accepted Methods: e-Transfer, Credit Card, Bank
                              Transfer
                            </p>
                            <p className="text-[9px] text-content-muted mt-0.5">
                              Reference: Include invoice number (INV-453694)
                            </p>
                          </div>

                          {/* Notes */}
                          <div className="bg-warning-50 rounded-xl p-2.5 mb-3">
                            <p className="text-[10px] font-black text-content mb-1">
                              Notes / Terms
                            </p>
                            <p className="text-[9px] text-content-body">
                              • To be paid within 14 days
                            </p>
                          </div>

                          <p className="text-center text-[9px] text-ink-300 mt-2">
                            Powered by Invoicium
                          </p>
                        </div>
                      </div>
                    </IPhoneMockup>
                  </div>
                </FadeIn>
              </div>
            </div>

            {/* Trade tags */}
            <FadeIn delay={480}>
              <div className="mt-12 pt-8 border-t border-line flex flex-wrap gap-2 items-center">
                <p className="text-content-muted text-xs font-semibold uppercase tracking-widest mr-2">
                  Trusted by:
                </p>
                {trades.map((trade) => (
                  <span
                    key={trade}
                    className="text-xs text-content-body bg-surface-sunken border border-line px-3 py-1.5 rounded-lg hover:border-brand-300 hover:text-content transition-all cursor-default flex items-center gap-1.5"
                  >
                    <HardHat className="w-3 h-3 text-brand-600 flex-shrink-0" />{" "}
                    {trade}
                  </span>
                ))}
              </div>
            </FadeIn>
          </div>
        </section>

        {/* ── MARQUEE STRIP ────────────────────────────────────── */}
        <div className="border-y border-line bg-brand-50 py-4 overflow-hidden">
          <div className="flex marquee-track gap-0 w-max select-none">
            {[...marqueeItems, ...marqueeItems].map((item, i) => (
              <div
                key={i}
                className="flex items-center gap-2 px-8 text-sm font-semibold whitespace-nowrap"
              >
                <item.icon className="w-4 h-4 text-brand-700 flex-shrink-0" />
                <span className="text-ink-700">{item.text}</span>
                <span className="text-ink-300 ml-8">◆</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── PROBLEM STATEMENT ────────────────────────────────── */}
        <section className="py-20 sm:py-32 bg-surface relative overflow-hidden">
          <div className="absolute inset-0 pointer-events-none"></div>
          <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <FadeIn>
              <p className="text-brand-700 font-bold text-sm uppercase tracking-widest mb-6">
                The Reality
              </p>
              <h2 className="text-3xl sm:text-5xl lg:text-6xl font-black text-content mb-6 leading-tight">
                You finished the job.
                <br />
                <span className="text-content-subtle">
                  Why haven't you been paid?
                </span>
              </h2>
              <p className="text-content-body text-lg sm:text-xl max-w-2xl mx-auto mb-12 leading-relaxed">
                Paper invoices get lost. Emails get ignored. "The check is in
                the mail" turns into weeks of waiting. Contractors lose
                thousands every year from delayed payments alone.
              </p>
            </FadeIn>

            <FadeIn delay={100}>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-3xl mx-auto mb-8">
                {[
                  {
                    stat: "47 days",
                    label: "Average time to get paid without software",
                  },
                  {
                    stat: "$18K",
                    label: "Average outstanding receivables for a contractor",
                  },
                  {
                    stat: "3 hrs",
                    label: "Per week spent invoicing and chasing payments",
                  },
                ].map((item, i) => (
                  <div
                    key={i}
                    className="bg-danger-50 border border-danger-200 rounded-2xl p-5 text-center"
                  >
                    <p className="text-3xl font-black text-danger-600 mb-1">
                      {item.stat}
                    </p>
                    <p className="text-content-body text-sm leading-tight">
                      {item.label}
                    </p>
                  </div>
                ))}
              </div>
            </FadeIn>

            <FadeIn delay={200}>
              <div className="inline-flex items-center gap-2 bg-success-50 border border-success-200 text-success-700 px-5 py-3 rounded-xl font-semibold">
                <CheckCircle className="w-5 h-5 flex-shrink-0" />
                Invoicium contractors get paid in an average of 2 days
              </div>
            </FadeIn>
          </div>
        </section>

        {/* ── FEATURES — 3 BIG CARDS ───────────────────────────── */}
        <section className="py-20 sm:py-32 bg-brand-50 relative overflow-hidden">
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-0 right-0 w-[600px] h-[500px] bg-brand-200/30 rounded-full blur-[120px]" />
            <div className="absolute bottom-0 left-0 w-[500px] h-[400px] bg-success-200/25 rounded-full blur-[100px]" />
          </div>
          <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <FadeIn>
              <div className="text-center mb-16">
                <p className="text-brand-700 font-bold text-sm uppercase tracking-widest mb-4">
                  How Invoicium Works
                </p>
                <h2 className="text-3xl sm:text-5xl font-black text-content mb-4">
                  Three Things.
                  <br />
                  <span className="text-brand-700">That's All It Takes.</span>
                </h2>
                <p className="text-content-body text-lg max-w-xl mx-auto">
                  No training. No complicated setup. Open the app, get paid.
                </p>
              </div>
            </FadeIn>

            <div className="space-y-5">
              {features.map((feature, idx) => (
                <FadeIn key={idx} delay={idx * 100}>
                  <div
                    className={`rounded-3xl border overflow-hidden transition-all duration-300 shadow-sm ${
                      feature.accent === "violet"
                        ? "bg-brand-50 border-brand-200 hover:border-brand-400"
                        : "bg-success-50 border-success-200 hover:border-success-400"
                    }`}
                  >
                    <div className="p-8 sm:p-10 grid sm:grid-cols-[auto_1fr] gap-6 sm:gap-10 items-center">
                      <div
                        className={`w-16 h-16 rounded-2xl flex items-center justify-center flex-shrink-0 ${
                          feature.accent === "violet"
                            ? "bg-brand-100"
                            : "bg-success-100"
                        }`}
                      >
                        <feature.icon
                          className={`w-8 h-8 ${feature.accent === "violet" ? "text-brand-700" : "text-success-600"}`}
                        />
                      </div>

                      <div className="grid sm:grid-cols-[1fr_auto] gap-6 sm:gap-10 items-center w-full">
                        <div>
                          <p
                            className={`text-xs font-bold uppercase tracking-widest mb-1 ${feature.accent === "violet" ? "text-brand-700" : "text-success-600"}`}
                          >
                            {feature.subtitle}
                          </p>
                          <h3 className="text-2xl sm:text-3xl font-black text-content mb-3">
                            {feature.title}
                          </h3>
                          <p className="text-content-body text-base leading-relaxed max-w-lg">
                            {feature.desc}
                          </p>
                        </div>
                        <div className="flex sm:flex-col gap-3 flex-shrink-0">
                          {feature.steps.map((step, si) => (
                            <div key={si} className="flex items-center gap-3">
                              <div
                                className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-black ${
                                  feature.accent === "violet"
                                    ? "bg-brand-100 text-brand-700"
                                    : "bg-success-100 text-success-600"
                                }`}
                              >
                                {si + 1}
                              </div>
                              <p className="text-ink-700 text-sm font-medium whitespace-nowrap">
                                {step}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </FadeIn>
              ))}
            </div>
          </div>
        </section>

        {/* ── PAYMENT METHODS ──────────────────────────────────── */}
        <section className="py-16 sm:py-24 bg-surface border-t border-line-subtle">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <FadeIn>
              <div className="text-center mb-12">
                <p className="text-brand-700 font-bold text-sm uppercase tracking-widest mb-4">
                  Payment Methods
                </p>
                <h2 className="text-3xl sm:text-4xl font-black text-content mb-4">
                  Every Way Clients Want to Pay
                </h2>
                <p className="text-content-body max-w-xl mx-auto">
                  No more "I only have cash." Your invoice link accepts
                  everything.
                </p>
              </div>
            </FadeIn>

            <FadeIn delay={100}>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                {[
                  {
                    icon: CreditCard,
                    color: "violet",
                    title: "Credit & Debit Card",
                    desc: "Visa, Mastercard, Amex. Clients pay in seconds on any device.",
                  },
                  {
                    icon: Building2,
                    color: "emerald",
                    title: "e-Transfer",
                    desc: "Popular in Canada. Clients send directly from their banking app.",
                  },
                  {
                    icon: DollarSign,
                    color: "violet",
                    title: "Bank Transfer",
                    desc: "ACH / direct deposit. Great for larger commercial jobs.",
                  },
                ].map((m, i) => (
                  <div
                    key={i}
                    className={`rounded-2xl p-6 border text-center ${
                      m.color === "violet"
                        ? "bg-brand-50 border-brand-200"
                        : "bg-success-50 border-success-200"
                    }`}
                  >
                    <div
                      className={`w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-4 ${
                        m.color === "violet" ? "bg-brand-100" : "bg-success-100"
                      }`}
                    >
                      <m.icon
                        className={`w-6 h-6 ${m.color === "violet" ? "text-brand-700" : "text-success-600"}`}
                      />
                    </div>
                    <h3 className="font-bold text-content mb-2">{m.title}</h3>
                    <p className="text-content-body text-sm leading-relaxed">
                      {m.desc}
                    </p>
                  </div>
                ))}
              </div>
            </FadeIn>

            <FadeIn delay={200}>
              <div className="bg-surface-sunken border border-line rounded-2xl p-5 sm:p-6">
                <div className="flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left">
                  <div className="w-12 h-12 bg-success-100 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Smartphone className="w-6 h-6 text-success-600" />
                  </div>
                  <div>
                    <h3 className="font-black text-content mb-1">
                      Apple Pay & Google Pay ready
                    </h3>
                    <p className="text-content-body text-sm">
                      Your clients can pay in one tap. No card number typing, no
                      friction.
                    </p>
                  </div>
                  <div className="sm:ml-auto flex gap-2 flex-shrink-0">
                    <div className="bg-black text-content-inverted px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5">
                      <svg
                        viewBox="0 0 24 24"
                        className="w-4 h-4"
                        fill="currentColor"
                      >
                        <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
                      </svg>
                      Apple Pay
                    </div>
                    <div className="bg-surface border border-line-strong text-content px-3 py-1.5 rounded-lg text-xs font-bold">
                      G Pay
                    </div>
                  </div>
                </div>
              </div>
            </FadeIn>
          </div>
        </section>

        {/* ── TRACK EVERYTHING ─────────────────────────────────── */}
        <section className="py-20 sm:py-32 bg-brand-50 relative overflow-hidden">
          <div className="absolute inset-0 pointer-events-none"></div>
          <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
              <FadeIn>
                <p className="text-brand-700 font-bold text-sm uppercase tracking-widest mb-4">
                  Invoice Tracking
                </p>
                <h2 className="text-3xl sm:text-5xl font-black text-content mb-6 leading-tight">
                  Know the Second
                  <br />
                  They Open It.
                </h2>
                <p className="text-content-body text-lg leading-relaxed mb-8">
                  Stop wondering if they got your invoice. Invoicium shows you
                  exactly when it was opened, how many times, and whether
                  payment is on the way — all in real time.
                </p>
                <div className="space-y-4">
                  {[
                    {
                      icon: Eye,
                      text: "Real-time open tracking — see when they viewed it",
                    },
                    {
                      icon: Bell,
                      text: "Auto-reminders at day 3, 7, and 14 if unpaid",
                    },
                    {
                      icon: CheckCircle,
                      text: "Instant notification when payment lands",
                    },
                  ].map((item, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <div className="w-9 h-9 bg-brand-100 rounded-xl flex items-center justify-center flex-shrink-0">
                        <item.icon className="w-5 h-5 text-brand-700" />
                      </div>
                      <p className="text-ink-700 font-medium">{item.text}</p>
                    </div>
                  ))}
                </div>
              </FadeIn>

              {/* Activity feed */}
              <FadeIn delay={150}>
                <div className="bg-surface rounded-3xl border border-line overflow-hidden shadow-xl">
                  <div className="bg-surface-sunken px-5 py-4 border-b border-line flex items-center gap-3">
                    <div className="w-8 h-8 bg-brand-100 rounded-lg flex items-center justify-center">
                      <Eye className="w-4 h-4 text-brand-700" />
                    </div>
                    <div>
                      <p className="font-bold text-content text-sm">
                        Invoice Activity
                      </p>
                      <p className="text-content-muted text-xs">
                        Real-time updates
                      </p>
                    </div>
                    <div className="ml-auto flex items-center gap-1.5">
                      <div className="live-dot w-2 h-2 bg-success-500 rounded-full" />
                      <span className="text-success-600 text-xs font-semibold">
                        Live
                      </span>
                    </div>
                  </div>

                  <div className="divide-y divide-line-subtle">
                    {[
                      {
                        time: "2 min ago",
                        event: "Sarah Johnson opened INV-089",
                        icon: Eye,
                        color: "violet",
                        sub: "3rd time viewing",
                      },
                      {
                        time: "1 hr ago",
                        event: "Auto-reminder sent to Mike Chen",
                        icon: Bell,
                        color: "amber",
                        sub: "Invoice overdue 7 days",
                      },
                      {
                        time: "3 hrs ago",
                        event: "Payment received — $2,840.00",
                        icon: DollarSign,
                        color: "emerald",
                        sub: "INV-087 · Derek Wilson",
                      },
                      {
                        time: "Yesterday",
                        event: "INV-089 delivered via text",
                        icon: Send,
                        color: "violet",
                        sub: "Sent to +1 647 555 0183",
                      },
                      {
                        time: "Yesterday",
                        event: "Payment received — $6,320.00",
                        icon: DollarSign,
                        color: "emerald",
                        sub: "INV-085 · Tony Ruiz",
                      },
                    ].map((item, i) => (
                      <div
                        key={i}
                        className="flex items-start gap-4 px-5 py-4 hover:bg-surface-sunken transition-colors"
                      >
                        <div
                          className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5 ${
                            item.color === "emerald"
                              ? "bg-success-100"
                              : item.color === "amber"
                                ? "bg-warning-100"
                                : "bg-brand-100"
                          }`}
                        >
                          <item.icon
                            className={`w-4 h-4 ${
                              item.color === "emerald"
                                ? "text-success-600"
                                : item.color === "amber"
                                  ? "text-warning-600"
                                  : "text-brand-700"
                            }`}
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-content truncate">
                            {item.event}
                          </p>
                          <p className="text-xs text-content-muted">
                            {item.sub}
                          </p>
                        </div>
                        <p className="text-xs text-content-subtle flex-shrink-0">
                          {item.time}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </FadeIn>
            </div>
          </div>
        </section>

        {/* ── HOW IT WORKS ─────────────────────────────────────── */}
        <section className="py-20 sm:py-32 bg-surface relative overflow-hidden">
          <div className="absolute inset-0 pointer-events-none"></div>
          <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <FadeIn>
              <div className="text-center mb-16">
                <p className="text-success-600 font-bold text-sm uppercase tracking-widest mb-4">
                  Get Started Today
                </p>
                <h2 className="text-3xl sm:text-5xl font-black text-content mb-4">
                  3 Steps. Then Done.
                </h2>
                <p className="text-content-body text-lg">
                  No training. No setup calls. Open the app and go.
                </p>
              </div>
            </FadeIn>

            <div className="grid sm:grid-cols-3 gap-6 sm:gap-4 relative">
              <div className="hidden sm:block absolute top-12 left-[22%] right-[22%] h-px bg-brand-400/50" />
              {[
                {
                  n: "1",
                  icon: FileText,
                  color: "bg-brand",
                  title: "Build Your Invoice",
                  desc: "Add services, hours, and materials. Tax auto-calculates. Done in under a minute.",
                },
                {
                  n: "2",
                  icon: Send,
                  color: "bg-accent-600",
                  title: "Send by Text or Email",
                  desc: "Client gets a professional invoice with a one-click payment link. No app needed on their end.",
                },
                {
                  n: "3",
                  icon: DollarSign,
                  color: "bg-success-600",
                  title: "Money in Your Account",
                  desc: "Client pays by card, Apple Pay, or e-Transfer. Funds deposit directly to you.",
                },
              ].map((step, i) => (
                <FadeIn key={i} delay={i * 120}>
                  <div className="text-center relative z-10">
                    <div
                      className={`inline-flex items-center justify-center w-24 h-24 rounded-full ${step.color} shadow-xl mb-6`}
                    >
                      <span className="text-content-inverted text-4xl font-black">
                        {step.n}
                      </span>
                    </div>
                    <h3 className="text-xl font-black text-content mb-3">
                      {step.title}
                    </h3>
                    <p className="text-content-body text-sm leading-relaxed">
                      {step.desc}
                    </p>
                  </div>
                </FadeIn>
              ))}
            </div>

            <FadeIn delay={400}>
              <div className="text-center mt-14">
                <Button
                  onClick={handleGetStarted}
                  size="lg"
                  className="bg-brand text-content-inverted h-14 px-10 rounded-2xl font-black shadow-2xl shadow-brand-600/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
                >
                  Start Getting Paid Today{" "}
                  <ArrowRight className="ml-2 w-5 h-5" />
                </Button>
              </div>
            </FadeIn>
          </div>
        </section>

        {/* ── TESTIMONIALS ─────────────────────────────────────── */}
        <section className="py-20 sm:py-32 bg-brand-50 relative overflow-hidden">
          <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <FadeIn>
              <div className="text-center mb-14">
                <p className="text-brand-700 font-bold text-sm uppercase tracking-widest mb-4">
                  From the Field
                </p>
                <h2 className="text-3xl sm:text-5xl font-black text-content">
                  Contractors Love It.
                </h2>
              </div>
            </FadeIn>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              {testimonials.map((t, i) => (
                <FadeIn key={i} delay={i * 100}>
                  <div className="bg-surface rounded-2xl p-6 border border-line hover:border-brand-300 shadow-sm hover:shadow-md transition-all h-full flex flex-col">
                    <div className="flex gap-1 mb-4">
                      {[...Array(t.stars)].map((_, si) => (
                        <Star
                          key={si}
                          className="w-4 h-4 text-warning-400 fill-current"
                        />
                      ))}
                    </div>
                    <blockquote className="text-ink-700 leading-relaxed flex-1 mb-6 text-[15px]">
                      "{t.quote}"
                    </blockquote>
                    <div className="flex items-center gap-3 pt-4 border-t border-line-subtle">
                      <div className="w-10 h-10 bg-brand rounded-full flex items-center justify-center flex-shrink-0">
                        <span className="text-content-inverted text-sm font-black">
                          {t.name[0]}
                        </span>
                      </div>
                      <div>
                        <p className="font-bold text-content text-sm">
                          {t.name}
                        </p>
                        <p className="text-content-muted text-xs">{t.trade}</p>
                      </div>
                    </div>
                  </div>
                </FadeIn>
              ))}
            </div>
          </div>
        </section>

        {/* ── PRICING ──────────────────────────────────────────── */}
        <section className="py-20 sm:py-32 bg-surface relative overflow-hidden">
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[350px] bg-brand-200/25 rounded-full blur-[100px]" />
          </div>
          <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <FadeIn>
              <div className="text-center mb-14">
                <p className="text-brand-700 font-bold text-sm uppercase tracking-widest mb-4">
                  Pricing
                </p>
                <h2 className="text-3xl sm:text-5xl font-black text-content mb-4">
                  Start Free. Upgrade When Ready.
                </h2>
                <p className="text-content-body text-lg">
                  No contracts. No surprises. Cancel any time.
                </p>
              </div>
            </FadeIn>

            {/* Desktop 5-col */}
            <div className="hidden lg:grid lg:grid-cols-5 gap-4 items-start">
              {pricingPlans.map((plan, i) => (
                <FadeIn key={i} delay={i * 60}>
                  <div
                    className={`relative rounded-2xl p-5 border transition-all hover:-translate-y-1 duration-300 ${
                      plan.popular
                        ? "ring-2 ring-brand-600 bg-surface shadow-2xl shadow-brand-600/15 scale-[1.04] z-10"
                        : "bg-surface border-line hover:border-line-strong shadow-sm"
                    }`}
                  >
                    {plan.popular && (
                      <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-brand text-content-inverted text-[10px] font-bold px-3 py-1 rounded-full flex items-center gap-1 whitespace-nowrap">
                        <Star className="w-3 h-3 fill-current" /> MOST POPULAR
                      </div>
                    )}
                    {plan.isFree && (
                      <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-ink-700 text-content-inverted text-[10px] font-bold px-3 py-1 rounded-full whitespace-nowrap">
                        NO RISK
                      </div>
                    )}
                    <div className="pt-2">
                      <h3 className="font-black text-content mb-1">
                        {plan.name}
                      </h3>
                      <div className="mb-4 mt-2">
                        <span
                          className={`text-3xl font-black ${plan.popular ? "text-brand-700" : "text-content"}`}
                        >
                          ${plan.price}
                        </span>
                        {!plan.isFree && (
                          <span className="text-content-muted text-xs">
                            /mo
                          </span>
                        )}
                      </div>
                      <ul className="space-y-2 mb-5 text-xs">
                        {plan.features.map((f, fi) => (
                          <li
                            key={fi}
                            className="flex items-start gap-2 text-content-body"
                          >
                            <CheckCircle className="w-3.5 h-3.5 text-success-500 flex-shrink-0 mt-0.5" />{" "}
                            {f}
                          </li>
                        ))}
                      </ul>
                      <Button
                        onClick={
                          plan.isFree ? handleGetStarted : handleViewPricing
                        }
                        className={`w-full h-10 rounded-xl text-xs font-bold transition-all ${
                          plan.popular
                            ? "bg-brand text-content-inverted shadow-lg"
                            : "bg-surface-inverted hover:bg-ink-800 text-content-inverted"
                        }`}
                      >
                        {plan.cta}
                      </Button>
                    </div>
                  </div>
                </FadeIn>
              ))}
            </div>

            {/* Mobile */}
            <div className="lg:hidden space-y-4">
              <FadeIn>
                <div className="relative bg-surface rounded-2xl p-6 ring-2 ring-brand-600 shadow-2xl shadow-brand-600/15">
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-brand text-content-inverted text-xs font-bold px-4 py-1 rounded-full flex items-center gap-1 whitespace-nowrap">
                    <Star className="w-3 h-3 fill-current" /> MOST POPULAR
                  </div>
                  <div className="text-center pt-2 mb-5">
                    <h3 className="text-xl font-black text-content mb-1">
                      Professional
                    </h3>
                    <div className="flex items-baseline justify-center gap-1">
                      <span className="text-4xl font-black text-brand-700">
                        $79
                      </span>
                      <span className="text-content-muted text-sm">/mo</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 mb-5">
                    {[
                      "250 transactions/mo",
                      "Custom templates",
                      "Priority support",
                      "Advanced reporting",
                    ].map((f, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-2 text-sm text-ink-700"
                      >
                        <CheckCircle className="w-4 h-4 text-success-500 flex-shrink-0" />{" "}
                        {f}
                      </div>
                    ))}
                  </div>
                  <Button
                    onClick={handleViewPricing}
                    className="w-full h-12 rounded-xl font-black bg-brand text-content-inverted"
                  >
                    Get Professional
                  </Button>
                </div>
              </FadeIn>
              <div className="grid grid-cols-2 gap-3">
                {pricingPlans
                  .filter((p) => !p.popular)
                  .map((plan, i) => (
                    <FadeIn key={i} delay={i * 60}>
                      <div className="bg-surface rounded-xl p-4 border border-line shadow-sm">
                        <h3 className="font-bold text-content mb-1">
                          {plan.name}
                        </h3>
                        <div className="text-2xl font-black text-content mb-2">
                          ${plan.price}
                          {!plan.isFree && (
                            <span className="text-xs text-content-muted font-normal">
                              /mo
                            </span>
                          )}
                        </div>
                        <ul className="space-y-1 mb-3">
                          {plan.features.slice(0, 2).map((f, fi) => (
                            <li
                              key={fi}
                              className="flex items-start gap-1.5 text-xs text-content-body"
                            >
                              <CheckCircle className="w-3 h-3 text-success-500 flex-shrink-0 mt-0.5" />{" "}
                              {f}
                            </li>
                          ))}
                        </ul>
                        <Button
                          onClick={
                            plan.isFree ? handleGetStarted : handleViewPricing
                          }
                          className="w-full h-9 rounded-lg text-xs font-bold bg-surface-inverted hover:bg-ink-800 text-content-inverted"
                        >
                          {plan.cta}
                        </Button>
                      </div>
                    </FadeIn>
                  ))}
              </div>
            </div>

            <FadeIn delay={400}>
              <div className="mt-10 text-center">
                <Button
                  onClick={handleViewPricing}
                  variant="outline"
                  className="px-8 h-12 rounded-lg border border-line bg-surface text-content-body hover:bg-surface-sunken hover:text-content font-semibold transition-colors"
                >
                  Compare All Plans <ArrowRight className="ml-2 w-4 h-4" />
                </Button>
              </div>
            </FadeIn>
          </div>
        </section>

        {/* ── FINAL CTA ────────────────────────────────────────── */}
        <section className="relative py-24 sm:py-40 bg-surface-inverted overflow-hidden">
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[800px] h-[300px] bg-success-500/10 rounded-full blur-[100px]" />
          </div>

          <div className="relative max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <FadeIn>
              <h2 className="text-4xl sm:text-6xl lg:text-7xl font-black text-content-inverted mb-6 leading-[0.9] tracking-tight">
                Stop Waiting.
                <br />
                <span className="text-brand-400">Get Paid Today.</span>
              </h2>
            </FadeIn>

            <FadeIn delay={100}>
              <p className="text-ink-300 text-lg sm:text-xl mb-10 max-w-xl mx-auto">
                Join thousands of contractors who invoice in seconds and get
                paid in hours. First 7 days free.
              </p>
            </FadeIn>

            <FadeIn delay={200}>
              {loading ? (
                <Button
                  disabled
                  className="bg-ink-700 text-ink-300 h-16 px-10 rounded-2xl font-black w-full sm:w-auto"
                >
                  <RefreshCw className="mr-2 w-5 h-5 animate-spin" /> Loading...
                </Button>
              ) : user ? (
                <Button
                  onClick={() => navigate(createPageUrl("Dashboard"))}
                  size="lg"
                  className="bg-brand-500 text-content h-16 px-14 rounded-2xl font-black text-lg shadow-2xl shadow-brand-500/30 hover:scale-[1.02] transition-all w-full sm:w-auto"
                >
                  Go to Dashboard <ArrowRight className="ml-2 w-6 h-6" />
                </Button>
              ) : (
                <Button
                  onClick={handleGetStarted}
                  size="lg"
                  className="bg-brand-500 text-content h-16 px-14 rounded-2xl font-black text-lg shadow-2xl shadow-brand-500/30 hover:scale-[1.02] active:scale-[0.98] transition-all w-full sm:w-auto"
                >
                  Create Free Account <ArrowRight className="ml-2 w-6 h-6" />
                </Button>
              )}
            </FadeIn>

            <FadeIn delay={300}>
              <div className="flex flex-wrap justify-center gap-6 mt-8 text-sm text-content-subtle font-semibold">
                {[
                  { icon: Shield, text: "Cancel Anytime" },
                  { icon: CheckCircle, text: "No Credit Card Required" },
                  { icon: Clock, text: "Setup in 2 Minutes" },
                ].map(({ icon: Icon, text }) => (
                  <div key={text} className="flex items-center gap-2">
                    <Icon className="w-4 h-4 text-brand-400 flex-shrink-0" />{" "}
                    {text}
                  </div>
                ))}
              </div>
            </FadeIn>

            <FadeIn delay={400}>
              <div className="mt-12">
                <InstallPWA />
              </div>
            </FadeIn>
          </div>
        </section>

        {/* ── FOOTER ───────────────────────────────────────────── */}
        <footer className="bg-surface-inverted-deep border-t border-ink-800 py-12 sm:py-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-12">
              <div className="col-span-2">
                <div className="flex items-center gap-2.5 mb-4">
                  <img
                    src="/logo-icon.png"
                    alt="Invoicium"
                    className="w-10 h-10 object-contain"
                  />
                  <span className="text-2xl font-black text-content-inverted">
                    Invoicium
                  </span>
                </div>
                <p className="text-content-subtle text-sm leading-relaxed max-w-xs mb-3">
                  The invoicing app built for contractors who work hard and want
                  to get paid faster.
                </p>
                <p className="text-brand-400 font-black text-sm">
                  Get Paid Today.
                </p>
              </div>

              <div>
                <h4 className="font-bold text-ink-300 mb-4 text-xs uppercase tracking-widest">
                  Product
                </h4>
                <ul className="space-y-2.5 text-content-subtle text-sm">
                  {[
                    ["Pricing", "Pricing"],
                    ["Features", "Features"],
                  ].map(([label, page]) => (
                    <li key={page}>
                      <Link
                        to={createPageUrl(page)}
                        className="hover:text-brand-400 transition-colors font-medium"
                      >
                        {label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <h4 className="font-bold text-ink-300 mb-4 text-xs uppercase tracking-widest">
                  Support
                </h4>
                <ul className="space-y-2.5 text-content-subtle text-sm">
                  {[
                    ["Contact", "Contact"],
                    ["Privacy", "PrivacyPolicy"],
                  ].map(([label, page]) => (
                    <li key={page}>
                      <Link
                        to={createPageUrl(page)}
                        className="hover:text-brand-400 transition-colors font-medium"
                      >
                        {label}
                      </Link>
                    </li>
                  ))}
                  <li>
                    <button
                      onClick={() =>
                        window.open(
                          "https://calendar.app.google/oMcQbdWok7g1wYrm9",
                          "_blank",
                        )
                      }
                      className="hover:text-brand-400 transition-colors font-medium"
                    >
                      Book a Demo
                    </button>
                  </li>
                </ul>
              </div>
            </div>

            <div className="pt-6 border-t border-ink-800 flex flex-col sm:flex-row justify-between items-center gap-4 text-xs text-content-muted">
              <p className="font-medium">
                © 2026 Invoicium. All rights reserved.
              </p>
              <div>
                {loading ? (
                  <span>...</span>
                ) : user ? (
                  <button
                    onClick={handleLogout}
                    className="hover:text-brand-400 font-bold transition-colors"
                  >
                    Logout
                  </button>
                ) : (
                  <button
                    onClick={handleLogin}
                    className="hover:text-brand-400 font-bold transition-colors"
                  >
                    Login
                  </button>
                )}
              </div>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
}
