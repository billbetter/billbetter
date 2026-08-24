import React, { useState, useEffect } from "react";
import { sdk } from "@/api/sdk";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import {
  FileText,
  Users,
  ClipboardList,
  Calendar,
  BarChart3,
  Settings,
  RefreshCw,
  ChevronRight,
  ChevronLeft,
  X,
  Zap,
  CheckCircle2,
  Play,
  BookOpen,
  CreditCard,
  Sparkles,
  Shield,
  Camera,
  Plus,
  Send,
  Lock,
} from "lucide-react";
import { createPageUrl } from "@/utils";
import { useNavigate } from "react-router-dom";
import { canAccessFeature } from "@/components/utils/permissions";
import { isFeatureDormant } from "@/config/dormantFeatures";
import { Badge } from "@/components/ui/badge";

const ALL_TOUR_SECTIONS = [
  {
    id: "welcome",
    title: "Welcome to Invoicium",
    subtitle: "Learn the platform in minutes",
    icon: BookOpen,
    color: "bg-success-500",
    requiredFeature: null,
    slides: [
      {
        title: "Your Complete Business Hub",
        description:
          "Invoicium helps contractors manage invoices, quotes, clients, and jobs — all in one place.",
        image: "🏠",
        tips: [
          "Navigate using the sidebar or mobile menu",
          "Quick access to create invoices anytime",
          "Your data syncs automatically across all devices",
        ],
      },
    ],
  },
  {
    id: "invoices",
    title: "Creating Invoices",
    subtitle: "Get paid faster with professional invoices",
    icon: FileText,
    color: "bg-brand-600",
    requiredFeature: "basic_invoicing",
    slides: [
      {
        title: "Create Your First Invoice",
        description:
          "Walk through creating a professional invoice step by step.",
        image: "📄",
        tips: [
          "Select a client from your client list",
          "Add line items with descriptions, quantities, and rates",
          "Tax is calculated automatically based on your settings",
        ],
        simulation: {
          type: "invoice_form",
          steps: [
            { label: "Select Client", icon: Users },
            { label: "Add Line Items", icon: Plus },
            { label: "Review & Send", icon: Send },
          ],
        },
      },
      {
        title: "AI Assistant",
        description:
          'Just say: "I need $2,500 for a bathroom renovation" and AI fills out your invoice.',
        image: "🤖",
        tips: [
          "AI understands natural language descriptions",
          "Specify total amount and AI creates itemized breakdown",
          "Voice input works hands-free on site",
        ],
        simulation: {
          type: "ai_demo",
          example: {
            input: "I want $2,500 for kitchen cabinet installation",
            output: [
              { description: "Cabinet installation labor", amount: 1200 },
              { description: "Hardware and mounting supplies", amount: 800 },
              { description: "Finishing and cleanup", amount: 500 },
            ],
            total: 2500,
          },
        },
      },
      {
        title: "Send & Get Paid",
        description:
          "After creating your invoice, send it via email or SMS with a payment link.",
        image: "💰",
        tips: [
          "Email includes professional PDF",
          "SMS delivers secure payment link",
          "Client can pay with credit card instantly",
        ],
        simulation: {
          type: "payment_flow",
          result:
            "Invoice sent! Client receives email with PDF and payment link.",
        },
      },
    ],
  },
  {
    id: "recurring",
    title: "Recurring Invoices",
    subtitle: "Automate your billing cycle",
    icon: RefreshCw,
    color: "bg-brand-500",
    requiredFeature: "recurring_invoices",
    minimumPlan: "Essential",
    slides: [
      {
        title: "Automate Your Billing",
        description:
          "Set up recurring invoices for regular maintenance contracts and retainer clients.",
        image: "🔄",
        tips: [
          "Choose frequency: weekly, monthly, quarterly, or yearly",
          "Invoices are created and sent automatically",
          "Edit or pause anytime",
        ],
        simulation: {
          type: "recurring_schedule",
          example: {
            client: "ABC Property Management",
            service: "Monthly HVAC Maintenance",
            amount: 450,
            frequency: "Monthly",
            nextInvoice: "Mar 1, 2026",
          },
        },
      },
    ],
  },
  {
    id: "quotes",
    title: "Professional Quotes",
    subtitle: "Win more jobs with detailed estimates",
    icon: ClipboardList,
    color: "bg-warning-500",
    requiredFeature: "quotes",
    slides: [
      {
        title: "Create Winning Quotes",
        description:
          "Send professional quotes with AI-powered camera analysis for accurate estimates.",
        image: "📋",
        tips: [
          "Take a photo of the job site for AI analysis",
          "AI suggests materials, labor, and pricing",
          "Send via email or SMS with PDF attachment",
        ],
        simulation: {
          type: "quote_camera",
          steps: [
            { label: "Take Photo", icon: Camera },
            { label: "AI Analyzes", icon: Sparkles },
            { label: "Review & Send", icon: Send },
          ],
        },
      },
    ],
  },
  {
    id: "clients",
    title: "Client Management",
    subtitle: "Keep all client info organized",
    icon: Users,
    color: "bg-aqua-500",
    requiredFeature: "client_management",
    slides: [
      {
        title: "Your Client Database",
        description:
          "All your client info in one place with complete payment history.",
        image: "👥",
        tips: [
          "Search by name, email, or phone",
          "View total invoiced and outstanding balance",
          "Add custom notes for each client",
        ],
        simulation: {
          type: "client_card",
          example: {
            name: "John's Construction",
            email: "john@construction.com",
            phone: "+1 (555) 123-4567",
            totalInvoiced: "$15,240",
            lastInvoice: "Dec 10, 2025",
          },
        },
      },
    ],
  },
  {
    id: "crew",
    title: "Crew Management",
    subtitle: "Manage your team with role-based access",
    icon: Shield,
    color: "bg-brand-500",
    requiredFeature: "crew_management",
    minimumPlan: "Professional",
    slides: [
      {
        title: "Invite Your Team",
        description:
          "Add crew members and control what they can see and do in the app.",
        image: "👷",
        tips: [
          "Send email invitations to crew members",
          "Set custom roles and permissions",
          "Assign jobs, invoices, and quotes to specific crew",
        ],
        simulation: {
          type: "crew_roles",
          example: [
            { role: "Manager", permissions: "Full access except billing" },
            { role: "Supervisor", permissions: "Create jobs & quotes" },
            { role: "Employee", permissions: "View assigned tasks only" },
          ],
        },
      },
    ],
  },
  {
    id: "calendar",
    title: "Calendar & Scheduling",
    subtitle: "Sync with Google Calendar",
    icon: Calendar,
    color: "bg-positive-500",
    requiredFeature: null,
    slides: [
      {
        title: "Connect Google Calendar",
        description:
          "Sync your schedule to see appointments, jobs, and deadlines in one place.",
        image: "📅",
        tips: [
          "Jobs automatically appear on your calendar",
          "Set appointment reminders",
          "Share calendar with your crew",
        ],
        simulation: {
          type: "google_calendar_connect",
          steps: [
            "Go to Settings → Calendar",
            "Click 'Connect Google Calendar'",
            "Sign in and grant permissions",
          ],
        },
      },
    ],
  },
  {
    id: "stripe",
    title: "Accept Online Payments",
    subtitle: "Get paid faster with Stripe",
    icon: CreditCard,
    color: "bg-brand-500",
    requiredFeature: null,
    slides: [
      {
        title: "Connect Stripe",
        description:
          "Accept credit card payments from clients directly through your invoices.",
        image: "💳",
        tips: [
          "Clients pay with one click",
          "Automatic payment tracking",
          "Funds go directly to your bank",
        ],
      },
      {
        title: "Set Up Your Stripe Account",
        description:
          "Connect or create your Stripe account to start accepting payments.",
        image: "🏦",
        tips: [
          "Click the button below to connect",
          "Complete Stripe's secure onboarding",
          "Start accepting payments immediately",
        ],
        inputFields: "stripe",
      },
    ],
  },
  {
    id: "analytics",
    title: "Business Analytics",
    subtitle: "Track your performance with AI insights",
    icon: BarChart3,
    color: "bg-blush-500",
    requiredFeature: "analytics_dashboard",
    minimumPlan: "Essential",
    slides: [
      {
        title: "Your Business Dashboard",
        description:
          "Get AI-powered insights into your revenue, clients, and growth trends.",
        image: "📈",
        tips: [
          "View revenue trends over time",
          "Identify your most profitable job types",
          "AI suggests areas to improve",
        ],
        simulation: {
          type: "analytics_chart",
          data: {
            monthlyRevenue: "$18,500",
            topClient: "ABC Corp ($5,200)",
            avgInvoice: "$1,850",
            trend: "+23% vs last month",
          },
        },
      },
    ],
  },
  {
    id: "settings",
    title: "Customize Your Setup",
    subtitle: "Make Invoicium yours",
    icon: Settings,
    color: "bg-ink-500",
    requiredFeature: null,
    slides: [
      {
        title: "Personalize Everything",
        description:
          "Add your logo, customize invoice templates, and set up payment processing.",
        image: "⚙️",
        tips: [
          "Upload your business logo",
          "Choose from invoice templates",
          "Connect Stripe for online payments",
        ],
      },
    ],
  },
  {
    id: "complete",
    title: "You're Ready!",
    subtitle: "Start growing your business",
    icon: CheckCircle2,
    color: "bg-success-500",
    requiredFeature: null,
    slides: [
      {
        title: "All Set!",
        description:
          "You now know how to use Invoicium's features. Time to get to work!",
        image: "🎉",
        tips: [
          "Create your first invoice now",
          "Access this tour anytime from Settings",
          "We're here to help if you need us",
        ],
      },
    ],
  },
];

// Dark-safe reusable components
const SimCard = ({ children }) => (
  <div className="rounded-xl border border-ink-600 bg-ink-800 p-3.5">
    {children}
  </div>
);

const StepRow = ({
  icon: Icon,
  label,
  iconBg = "bg-success-800",
  iconColor = "text-success-300",
}) => (
  <div className="flex items-center gap-3 p-2.5 bg-ink-700 rounded-lg border border-ink-600">
    <div
      className={`w-7 h-7 rounded-full ${iconBg} flex items-center justify-center flex-shrink-0`}
    >
      <Icon className={`w-3.5 h-3.5 ${iconColor}`} />
    </div>
    <span className="text-sm font-medium text-ink-100">{label}</span>
  </div>
);

export default function FeatureTour({ isOpen, onClose, onComplete }) {
  const [currentSection, setCurrentSection] = useState(0);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [connectingStripe, setConnectingStripe] = useState(false);
  const [stripeConnected, setStripeConnected] = useState(false);
  const [subscription, setSubscription] = useState(null);
  const [showInteractiveDemo, setShowInteractiveDemo] = useState(false);
  const [demoStep, setDemoStep] = useState(0);
  const [demoClient, setDemoClient] = useState("");
  const [demoItems, setDemoItems] = useState([
    { description: "", quantity: 1, rate: 0 },
  ]);
  const [demoAiInput, setDemoAiInput] = useState("");
  const [quotePhotoUploaded, setQuotePhotoUploaded] = useState(false);
  const [quoteAnalyzing, setQuoteAnalyzing] = useState(false);
  const [quoteAnalyzed, setQuoteAnalyzed] = useState(false);
  const [quoteSending, setQuoteSending] = useState(false);
  const [quoteSent, setQuoteSent] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const loadData = async () => {
      try {
        const user = await sdk.auth.me();
        const subscriptionData = await sdk.entities.Subscription.filter({
          user_id: user.id,
        });
        if (subscriptionData.length > 0) setSubscription(subscriptionData[0]);
        const settings = await sdk.entities.BusinessSettings.filter({
          user_id: user.id,
        });
        if (
          settings.length > 0 &&
          settings[0].stripe_account_status === "active"
        )
          setStripeConnected(true);
      } catch (error) {}
    };
    if (isOpen) loadData();
  }, [isOpen]);

  // Dormant sections are removed before either split. canAccessFeature already
  // refuses them, but that alone would only move them into LOCKED_SECTIONS --
  // where they would be advertised as "upgrade to unlock", which is the one
  // thing a switched-off feature must never do.
  const LIVE_TOUR_SECTIONS = ALL_TOUR_SECTIONS.filter(
    (s) => !isFeatureDormant(s.requiredFeature),
  );
  const TOUR_SECTIONS = LIVE_TOUR_SECTIONS.filter(
    (s) =>
      !s.requiredFeature || canAccessFeature(subscription, s.requiredFeature),
  );
  const LOCKED_SECTIONS = LIVE_TOUR_SECTIONS.filter(
    (s) =>
      s.requiredFeature && !canAccessFeature(subscription, s.requiredFeature),
  );

  const section = TOUR_SECTIONS[currentSection];
  const slide = section?.slides[currentSlide];
  const SectionIcon = section?.icon;

  if (!section || !slide) return null;

  const totalSlides = TOUR_SECTIONS.reduce(
    (acc, s) => acc + s.slides.length,
    0,
  );
  const currentTotalSlide =
    TOUR_SECTIONS.slice(0, currentSection).reduce(
      (acc, s) => acc + s.slides.length,
      0,
    ) +
    currentSlide +
    1;
  const isFirstSlide = currentSection === 0 && currentSlide === 0;
  const isLastSlide =
    currentSection === TOUR_SECTIONS.length - 1 &&
    currentSlide === section.slides.length - 1;
  const progress = (currentTotalSlide / totalSlides) * 100;

  const handleNext = () => {
    if (currentSlide < section.slides.length - 1)
      setCurrentSlide(currentSlide + 1);
    else if (currentSection < TOUR_SECTIONS.length - 1) {
      setCurrentSection(currentSection + 1);
      setCurrentSlide(0);
    } else handleComplete();
  };
  const handleBack = () => {
    if (currentSlide > 0) setCurrentSlide(currentSlide - 1);
    else if (currentSection > 0) {
      const prev = TOUR_SECTIONS[currentSection - 1];
      setCurrentSection(currentSection - 1);
      setCurrentSlide(prev.slides.length - 1);
    }
  };
  const handleSkip = async () => {
    try {
      await sdk.auth.updateMe({ feature_tour_completed: true });
    } catch (e) {}
    onClose();
  };
  const handleComplete = async () => {
    try {
      await sdk.auth.updateMe({ feature_tour_completed: true });
    } catch (e) {}
    onComplete?.();
    onClose();
  };
  const jumpToSection = (i) => {
    setCurrentSection(i);
    setCurrentSlide(0);
  };

  const handleTryItNow = () => {
    setShowInteractiveDemo(true);
    setDemoStep(0);
    setDemoClient("");
    setDemoItems([{ description: "", quantity: 1, rate: 0 }]);
    setDemoAiInput("");
    setQuotePhotoUploaded(false);
    setQuoteAnalyzing(false);
    setQuoteAnalyzed(false);
    setQuoteSending(false);
    setQuoteSent(false);
  };
  const handleDemoClose = () => {
    setShowInteractiveDemo(false);
    setDemoStep(0);
  };
  const handleDemoAiSubmit = () => {
    if (
      demoAiInput.toLowerCase().includes("2500") ||
      demoAiInput.toLowerCase().includes("2,500") ||
      demoAiInput.toLowerCase().includes("cabinet")
    ) {
      setDemoItems([
        { description: "Cabinet installation labor", quantity: 1, rate: 1200 },
        {
          description: "Hardware and mounting supplies",
          quantity: 1,
          rate: 800,
        },
        { description: "Finishing and cleanup", quantity: 1, rate: 500 },
      ]);
    } else if (demoAiInput.toLowerCase().includes("bathroom")) {
      setDemoItems([
        { description: "Bathroom renovation labor", quantity: 1, rate: 1500 },
        { description: "Materials and fixtures", quantity: 1, rate: 800 },
        { description: "Plumbing work", quantity: 1, rate: 600 },
      ]);
    } else {
      setDemoItems([
        { description: "Labor", quantity: 1, rate: 500 },
        { description: "Materials", quantity: 1, rate: 300 },
      ]);
    }
    setDemoStep(demoStep + 1);
  };
  const handleQuotePhotoUpload = () => {
    setQuotePhotoUploaded(true);
    setQuoteAnalyzing(true);
    setTimeout(() => {
      setQuoteAnalyzing(false);
      setQuoteAnalyzed(true);
    }, 2000);
  };
  const handleQuoteSend = () => {
    setQuoteSending(true);
    setTimeout(() => {
      setQuoteSending(false);
      setQuoteSent(true);
    }, 2000);
  };
  const handleConnectStripe = async () => {
    setConnectingStripe(true);
    try {
      const response = await sdk.functions.invoke(
        "createStripeConnectAccount",
        { return_url: window.location.href, refresh_url: window.location.href },
      );
      if (response.data?.url) window.open(response.data.url, "_blank");
    } catch (error) {
      alert("Failed to connect Stripe. Please try again.");
    } finally {
      setConnectingStripe(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl p-0 overflow-hidden max-h-[90vh] shadow-2xl bg-surface-inverted border border-ink-700">
        {/* Progress Bar */}
        <div className="h-1 bg-ink-700">
          <div
            className="h-full bg-success-500 transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="flex flex-col sm:flex-row overflow-hidden">
          {/* Sidebar */}
          <div className="hidden sm:flex flex-col w-44 bg-surface-inverted-deep border-r border-ink-700 p-3 max-h-[calc(90vh-4px)] overflow-y-auto flex-shrink-0">
            <p className="text-[10px] font-bold text-content-muted uppercase tracking-widest mb-3 px-2">
              Features
            </p>
            <div className="space-y-0.5">
              {TOUR_SECTIONS.map((s, i) => {
                const Icon = s.icon;
                const isActive = i === currentSection;
                const isDone = i < currentSection;
                return (
                  <button
                    key={s.id}
                    onClick={() => jumpToSection(i)}
                    className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-left text-xs transition-all ${
                      isActive
                        ? "bg-success-600 text-content-inverted font-semibold"
                        : isDone
                          ? "text-success-400 hover:bg-ink-800"
                          : "text-content-subtle hover:bg-ink-800 hover:text-ink-200"
                    }`}
                  >
                    {isDone ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-success-400 flex-shrink-0" />
                    ) : (
                      <Icon
                        className={`w-3.5 h-3.5 flex-shrink-0 ${isActive ? "text-content-inverted" : ""}`}
                      />
                    )}
                    <span className="truncate">
                      {s.id === "welcome"
                        ? "Intro"
                        : s.id === "complete"
                          ? "Done"
                          : s.title.split(" ")[0]}
                    </span>
                  </button>
                );
              })}
            </div>

            {LOCKED_SECTIONS.length > 0 && (
              <>
                <div className="border-t border-ink-700 my-3" />
                <p className="text-[10px] font-bold text-content-muted uppercase tracking-widest mb-2 px-2 flex items-center gap-1">
                  <Lock className="w-2.5 h-2.5" /> Upgrade
                </p>
                <div className="space-y-0.5">
                  {LOCKED_SECTIONS.map((s) => (
                    <div
                      key={s.id}
                      className="flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs text-content-body dark:text-ink-300"
                    >
                      <Lock className="w-3.5 h-3.5 flex-shrink-0" />
                      <span className="truncate flex-1">
                        {s.title.split(" ")[0]}
                      </span>
                      <Badge
                        variant="outline"
                        className="text-[9px] px-1 py-0 border-warning-700 text-warning-400 bg-transparent"
                      >
                        {s.minimumPlan}
                      </Badge>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Main Content */}
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto p-5 max-h-[calc(90vh-60px)]">
              {/* Header */}
              <div className="flex items-start justify-between mb-5">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-10 h-10 ${section.color} rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm`}
                  >
                    <SectionIcon className="w-5 h-5 text-content-inverted" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-content-inverted leading-tight">
                      {section.title}
                    </h2>
                    <p className="text-xs text-content-subtle mt-0.5">
                      {section.subtitle}
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleSkip}
                  className="text-ink-300 hover:text-ink-300 transition-colors p-1.5 rounded-lg hover:bg-ink-800"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Slide Content */}
              <div className="text-center mb-5">
                <div className="text-5xl mb-3">{slide.image}</div>
                <h3 className="text-lg font-bold text-content-inverted mb-1.5">
                  {slide.title}
                </h3>
                <p className="text-sm text-content-subtle max-w-sm mx-auto leading-relaxed">
                  {slide.description}
                </p>
              </div>

              {/* Simulation Block */}
              {slide.simulation && (
                <div className="mb-4 rounded-xl border border-ink-700 bg-ink-800 p-4">
                  {slide.simulation.type === "invoice_form" && (
                    <div className="space-y-2">
                      {slide.simulation.steps.map((step, idx) => (
                        <StepRow
                          key={idx}
                          icon={step.icon}
                          label={step.label}
                        />
                      ))}
                      <Button
                        onClick={() => handleTryItNow("invoice")}
                        className="w-full mt-2 bg-brand hover:bg-brand-hover text-content-inverted gap-2"
                      >
                        <Play className="w-3.5 h-3.5" /> Try Interactive Demo
                      </Button>
                    </div>
                  )}

                  {slide.simulation.type === "ai_demo" && (
                    <div className="space-y-3">
                      <SimCard>
                        <p className="text-xs font-bold text-content-muted uppercase tracking-wider mb-1.5">
                          You say:
                        </p>
                        <p className="text-sm text-ink-100 italic">
                          "{slide.simulation.example.input}"
                        </p>
                      </SimCard>
                      <div className="flex justify-center">
                        <Sparkles className="w-5 h-5 text-success-400" />
                      </div>
                      <SimCard>
                        <p className="text-xs font-bold text-content-muted uppercase tracking-wider mb-2">
                          AI creates:
                        </p>
                        <div className="space-y-1.5">
                          {slide.simulation.example.output.map((item, idx) => (
                            <div
                              key={idx}
                              className="flex items-center justify-between text-sm py-1 border-b border-ink-700 last:border-0"
                            >
                              <span className="text-ink-300">
                                {item.description}
                              </span>
                              <span className="font-semibold text-content-inverted">
                                ${item.amount}
                              </span>
                            </div>
                          ))}
                          <div className="flex items-center justify-between text-sm font-bold pt-2 border-t border-ink-600 mt-1">
                            <span className="text-content-inverted">Total</span>
                            <span className="text-success-400 text-base">
                              ${slide.simulation.example.total}
                            </span>
                          </div>
                        </div>
                      </SimCard>
                    </div>
                  )}

                  {slide.simulation.type === "payment_flow" && (
                    <div className="flex items-center gap-2.5 p-3 bg-success-900/30 border border-success-700 rounded-lg">
                      <CheckCircle2 className="w-4 h-4 text-success-400 flex-shrink-0" />
                      <p className="text-sm font-medium text-success-300">
                        {slide.simulation.result}
                      </p>
                    </div>
                  )}

                  {slide.simulation.type === "recurring_schedule" && (
                    <SimCard>
                      <div className="flex items-center gap-2 mb-3">
                        <RefreshCw className="w-4 h-4 text-brand-400" />
                        <span className="text-sm font-semibold text-content-inverted">
                          {slide.simulation.example.service}
                        </span>
                      </div>
                      {[
                        {
                          label: "Client",
                          value: slide.simulation.example.client,
                        },
                        {
                          label: "Amount",
                          value: `$${slide.simulation.example.amount}/mo`,
                        },
                        {
                          label: "Next Invoice",
                          value: slide.simulation.example.nextInvoice,
                        },
                      ].map(({ label, value }) => (
                        <div
                          key={label}
                          className="flex justify-between text-sm py-1.5 border-b border-ink-700 last:border-0"
                        >
                          <span className="text-content-subtle">{label}</span>
                          <span className="font-semibold text-content-inverted">
                            {value}
                          </span>
                        </div>
                      ))}
                    </SimCard>
                  )}

                  {slide.simulation.type === "quote_camera" && (
                    <div className="space-y-2">
                      {slide.simulation.steps.map((step, idx) => (
                        <StepRow
                          key={idx}
                          icon={step.icon}
                          label={step.label}
                          iconBg="bg-warning-800"
                          iconColor="text-warning-300"
                        />
                      ))}
                      <Button
                        onClick={() => handleTryItNow("quote")}
                        className="w-full mt-2 bg-warning-500 hover:bg-warning-600 text-content gap-2"
                      >
                        <Play className="w-3.5 h-3.5" /> Try Interactive Demo
                      </Button>
                    </div>
                  )}

                  {slide.simulation.type === "client_card" && (
                    <SimCard>
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-9 h-9 rounded-full bg-aqua-800 flex items-center justify-center">
                          <Users className="w-4 h-4 text-aqua-300" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-content-inverted">
                            {slide.simulation.example.name}
                          </p>
                          <p className="text-xs text-content-subtle">
                            {slide.simulation.example.email}
                          </p>
                        </div>
                      </div>
                      {[
                        {
                          label: "Phone",
                          value: slide.simulation.example.phone,
                        },
                        {
                          label: "Total Invoiced",
                          value: slide.simulation.example.totalInvoiced,
                        },
                        {
                          label: "Last Invoice",
                          value: slide.simulation.example.lastInvoice,
                        },
                      ].map(({ label, value }) => (
                        <div
                          key={label}
                          className="flex justify-between text-sm py-1.5 border-b border-ink-700 last:border-0"
                        >
                          <span className="text-content-subtle">{label}</span>
                          <span className="font-semibold text-content-inverted">
                            {value}
                          </span>
                        </div>
                      ))}
                    </SimCard>
                  )}

                  {slide.simulation.type === "crew_roles" && (
                    <div className="space-y-2">
                      {slide.simulation.example.map((role, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between p-2.5 bg-ink-700 rounded-lg border border-ink-600"
                        >
                          <div className="flex items-center gap-2">
                            <Shield className="w-3.5 h-3.5 text-brand-400" />
                            <span className="text-sm font-semibold text-content-inverted">
                              {role.role}
                            </span>
                          </div>
                          <span className="text-xs text-content-subtle">
                            {role.permissions}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {slide.simulation.type === "analytics_chart" && (
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        {
                          label: "Monthly Revenue",
                          value: slide.simulation.data.monthlyRevenue,
                          color: "text-success-400",
                        },
                        {
                          label: "Avg Invoice",
                          value: slide.simulation.data.avgInvoice,
                          color: "text-info-400",
                        },
                        {
                          label: "Top Client",
                          value: slide.simulation.data.topClient,
                          color: "text-content-inverted",
                        },
                        {
                          label: "Growth",
                          value: `↗ ${slide.simulation.data.trend}`,
                          color: "text-blush-400",
                        },
                      ].map(({ label, value, color }) => (
                        <div
                          key={label}
                          className="p-3 bg-ink-700 rounded-lg border border-ink-600"
                        >
                          <p className="text-xs text-content-subtle mb-1">
                            {label}
                          </p>
                          <p
                            className={`text-sm font-bold leading-tight ${color}`}
                          >
                            {value}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}

                  {slide.simulation.type === "google_calendar_connect" && (
                    <div className="space-y-2">
                      {slide.simulation.steps.map((step, idx) => (
                        <div
                          key={idx}
                          className="flex items-start gap-2.5 p-2.5 bg-ink-700 rounded-lg border border-ink-600"
                        >
                          <div className="w-5 h-5 rounded-full bg-positive-800 flex items-center justify-center flex-shrink-0 mt-0.5">
                            <span className="text-[10px] font-bold text-positive-300">
                              {idx + 1}
                            </span>
                          </div>
                          <span className="text-sm text-ink-200">{step}</span>
                        </div>
                      ))}
                      <Button
                        onClick={() => {
                          onClose();
                          navigate(createPageUrl("Settings") + "?tab=calendar");
                        }}
                        className="w-full mt-1 bg-positive-700 hover:bg-positive-700 text-content-inverted gap-2"
                      >
                        <Calendar className="w-3.5 h-3.5" /> Go to Calendar
                        Settings
                      </Button>
                    </div>
                  )}
                </div>
              )}

              {/* Stripe Connect */}
              {slide.inputFields === "stripe" && (
                <div className="mb-4 p-4 rounded-xl border border-ink-700 bg-ink-800">
                  {stripeConnected ? (
                    <div className="flex items-center gap-2 text-sm text-success-300 bg-success-900/30 border border-success-700 rounded-lg p-3">
                      <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                      <span className="font-medium">
                        Stripe account connected!
                      </span>
                    </div>
                  ) : (
                    <>
                      <Button
                        onClick={handleConnectStripe}
                        disabled={connectingStripe}
                        className="w-full bg-brand-700 hover:bg-brand text-content-inverted gap-2"
                      >
                        <CreditCard className="w-3.5 h-3.5" />
                        {connectingStripe
                          ? "Connecting..."
                          : "Connect Stripe Account"}
                      </Button>
                      <p className="text-xs text-content-muted text-center mt-2">
                        Redirected to Stripe for secure onboarding
                      </p>
                    </>
                  )}
                </div>
              )}

              {/* Tips */}
              <div className="rounded-xl border border-warning-700/50 bg-warning-900/20 p-4">
                <p className="text-xs font-bold text-warning-400 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                  <Zap className="w-3 h-3" /> Pro Tips
                </p>
                <ul className="space-y-2">
                  {slide.tips.map((tip, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-2 text-sm text-ink-300"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 text-success-400 flex-shrink-0 mt-0.5" />
                      <span>{tip}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between px-5 py-3 border-t border-ink-700 bg-surface-inverted flex-shrink-0">
              <div>
                {!isFirstSlide && (
                  <Button
                    variant="ghost"
                    onClick={handleBack}
                    className="gap-1 text-sm text-content-subtle hover:text-content-inverted hover:bg-ink-800 h-9 px-3"
                  >
                    <ChevronLeft className="w-4 h-4" /> Back
                  </Button>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-content-muted">
                  {currentTotalSlide}/{totalSlides}
                </span>
                {!isLastSlide && (
                  <Button
                    variant="ghost"
                    onClick={handleSkip}
                    className="text-xs text-ink-300 hover:text-content-inverted hover:bg-ink-700 h-8 px-3 border border-ink-600"
                  >
                    Skip tour
                  </Button>
                )}
                <Button
                  onClick={handleNext}
                  className="bg-brand hover:bg-brand-hover text-content-inverted gap-1.5 h-9 px-4 text-sm shadow-sm"
                >
                  {isLastSlide ? (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5" /> Get Started
                    </>
                  ) : isFirstSlide ? (
                    <>
                      Start Tour <Play className="w-3.5 h-3.5" />
                    </>
                  ) : (
                    <>
                      Next <ChevronRight className="w-3.5 h-3.5" />
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Interactive Demo Overlay */}
        {showInteractiveDemo && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <div className="bg-surface-inverted rounded-2xl max-w-lg w-full max-h-[90vh] overflow-hidden shadow-2xl border border-ink-700 flex flex-col">
              <div className="px-5 py-4 bg-success-700 flex items-center justify-between flex-shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-surface/20 flex items-center justify-center dark:bg-surface-inverted/20">
                    <Play className="w-4 h-4 text-content-inverted" />
                  </div>
                  <div>
                    <h3 className="font-bold text-content-inverted text-sm">
                      Interactive Demo
                    </h3>
                    <p className="text-xs text-success-200">Try it yourself</p>
                  </div>
                </div>
                <button
                  onClick={handleDemoClose}
                  className="text-content-inverted/70 hover:text-content-inverted transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-5 bg-surface-inverted">
                {section.id === "invoices" && (
                  <div className="space-y-4">
                    {demoStep === 0 && (
                      <div className="space-y-4">
                        <div className="text-center">
                          <div className="text-4xl mb-2">📝</div>
                          <h3 className="text-lg font-bold text-content-inverted">
                            Create Your First Invoice
                          </h3>
                          <p className="text-sm text-content-subtle mt-1">
                            Walk through each step together
                          </p>
                        </div>
                        <div className="p-4 rounded-xl border border-ink-700 bg-ink-800">
                          <div className="flex items-center gap-2 mb-3">
                            <div className="w-7 h-7 rounded-full bg-info-600 flex items-center justify-center">
                              <span className="text-content-inverted text-xs font-bold">
                                1
                              </span>
                            </div>
                            <h4 className="font-semibold text-content-inverted text-sm">
                              Select a Client
                            </h4>
                          </div>
                          <Label className="text-xs font-semibold text-ink-300 mb-1.5 block">
                            Client *
                          </Label>
                          <select
                            value={demoClient}
                            onChange={(e) => {
                              setDemoClient(e.target.value);
                              if (e.target.value)
                                setTimeout(() => setDemoStep(1), 500);
                            }}
                            className="w-full p-2.5 rounded-lg border border-ink-600 bg-ink-700 text-sm text-content-inverted focus:outline-none focus:ring-2 focus:ring-success-500"
                          >
                            <option value="">Select a client...</option>
                            <option value="client1">
                              ABC Construction Co.
                            </option>
                            <option value="client2">
                              John's Property Management
                            </option>
                            <option value="client3">Smith Renovations</option>
                          </select>
                          {!demoClient && (
                            <p className="text-xs text-success-400 mt-1.5 font-medium">
                              ↑ Try selecting a client
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                    {demoStep === 1 && (
                      <div className="space-y-4">
                        <div className="p-4 rounded-xl border border-ink-700 bg-ink-800">
                          <div className="flex items-center gap-2 mb-3">
                            <div className="w-7 h-7 rounded-full bg-brand-600 flex items-center justify-center">
                              <span className="text-content-inverted text-xs font-bold">
                                2
                              </span>
                            </div>
                            <h4 className="font-semibold text-content-inverted text-sm">
                              Use AI Assistant (Optional)
                            </h4>
                          </div>
                          <div className="flex items-center gap-2 mb-2">
                            <Sparkles className="w-4 h-4 text-brand-400" />
                            <span className="text-sm font-medium text-ink-200">
                              Describe the work
                            </span>
                          </div>
                          <Input
                            value={demoAiInput}
                            onChange={(e) => setDemoAiInput(e.target.value)}
                            placeholder="e.g., I want $2,500 for kitchen cabinets"
                            className="mb-2 text-sm bg-ink-700 border-ink-600 text-content-inverted placeholder-ink-500"
                          />
                          <Button
                            onClick={handleDemoAiSubmit}
                            disabled={!demoAiInput}
                            className="w-full bg-brand-700 hover:bg-brand text-content-inverted gap-2 text-sm"
                          >
                            <Sparkles className="w-3.5 h-3.5" /> Generate Items
                          </Button>
                          {!demoAiInput && (
                            <p className="text-xs text-brand-400 mt-1 font-medium">
                              ↑ Try typing a description
                            </p>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <Button
                            onClick={() => setDemoStep(0)}
                            variant="outline"
                            className="flex-1 text-sm border-ink-600 text-ink-300 hover:bg-ink-800 hover:text-content-inverted"
                          >
                            Back
                          </Button>
                          <Button
                            onClick={() => setDemoStep(2)}
                            className="flex-1 bg-ink-600 hover:bg-ink-500 text-content-inverted text-sm"
                          >
                            Skip AI →
                          </Button>
                        </div>
                      </div>
                    )}
                    {demoStep === 2 && (
                      <div className="space-y-4">
                        <div className="p-4 rounded-xl border border-ink-700 bg-ink-800">
                          <div className="flex items-center gap-2 mb-3">
                            <div className="w-7 h-7 rounded-full bg-success-600 flex items-center justify-center">
                              <CheckCircle2 className="w-4 h-4 text-content-inverted" />
                            </div>
                            <h4 className="font-semibold text-content-inverted text-sm">
                              Review & Send
                            </h4>
                          </div>
                          <div className="space-y-1.5 mb-3">
                            <div className="flex justify-between text-sm">
                              <span className="text-content-subtle">
                                Client:
                              </span>
                              <span className="font-semibold text-content-inverted">
                                ABC Construction Co.
                              </span>
                            </div>
                            {demoItems.map((item, idx) => (
                              <div
                                key={idx}
                                className="flex justify-between text-sm border-t border-ink-700 pt-1.5"
                              >
                                <span className="text-ink-300 truncate flex-1">
                                  {item.description || "Service"}
                                </span>
                                <span className="font-semibold text-content-inverted ml-2">
                                  ${item.rate}
                                </span>
                              </div>
                            ))}
                            <div className="flex justify-between text-sm font-bold pt-2 border-t border-ink-600">
                              <span className="text-content-inverted">
                                Total
                              </span>
                              <span className="text-success-400">
                                $
                                {demoItems
                                  .reduce((s, i) => s + i.rate, 0)
                                  .toFixed(2)}
                              </span>
                            </div>
                          </div>
                          <Button className="w-full bg-brand hover:bg-brand-hover text-content-inverted gap-2 text-sm">
                            <Send className="w-3.5 h-3.5" /> Create & Send
                            Invoice
                          </Button>
                          <p className="text-xs text-center text-content-muted mt-2">
                            ✅ Sent via email & SMS to client
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            onClick={() => setDemoStep(1)}
                            variant="outline"
                            className="flex-1 text-sm border-ink-600 text-ink-300 hover:bg-ink-800 hover:text-content-inverted"
                          >
                            Back
                          </Button>
                          <Button
                            onClick={handleDemoClose}
                            className="flex-1 bg-brand hover:bg-brand-hover text-content-inverted text-sm"
                          >
                            Finish Demo
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {section.id === "quotes" && (
                  <div className="space-y-4">
                    {demoStep === 0 && (
                      <div className="space-y-4">
                        <div className="text-center">
                          <div className="text-4xl mb-2">📋</div>
                          <h3 className="text-lg font-bold text-content-inverted">
                            Create a Quote
                          </h3>
                          <p className="text-sm text-content-subtle mt-1">
                            AI camera analysis for instant estimates
                          </p>
                        </div>
                        <div className="p-4 rounded-xl border border-ink-700 bg-ink-800">
                          <div className="flex items-center gap-2 mb-3">
                            <div className="w-7 h-7 rounded-full bg-warning-500 flex items-center justify-center">
                              <span className="text-content-inverted text-xs font-bold">
                                1
                              </span>
                            </div>
                            <h4 className="font-semibold text-content-inverted text-sm">
                              Upload Job Site Photo
                            </h4>
                          </div>
                          {!quotePhotoUploaded ? (
                            <button
                              onClick={handleQuotePhotoUpload}
                              className="w-full aspect-video rounded-lg border-2 border-dashed border-warning-600 bg-ink-700 flex items-center justify-center hover:bg-ink-600 transition-colors cursor-pointer"
                            >
                              <div className="text-center p-4">
                                <Camera className="w-10 h-10 text-warning-400 mx-auto mb-2" />
                                <p className="text-sm font-medium text-ink-200">
                                  Click to Upload Photo
                                </p>
                                <p className="text-xs text-warning-400 mt-1">
                                  Try the demo!
                                </p>
                              </div>
                            </button>
                          ) : (
                            <div className="relative">
                              <img
                                src="https://images.unsplash.com/photo-1552321554-5fefe8c9ef14?w=800&q=80"
                                alt="Bathroom"
                                className="w-full aspect-video object-cover rounded-lg"
                              />
                              <div className="absolute top-2 right-2 bg-success-700 text-content-inverted text-xs px-2 py-1 rounded-full flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3" /> Ready
                              </div>
                            </div>
                          )}
                        </div>
                        {quotePhotoUploaded && (
                          <Button
                            onClick={() => setDemoStep(1)}
                            className="w-full bg-warning-500 hover:bg-warning-600 text-content gap-2 text-sm"
                          >
                            <Sparkles className="w-3.5 h-3.5" /> Analyze with AI
                            →
                          </Button>
                        )}
                      </div>
                    )}
                    {demoStep === 1 && (
                      <div className="space-y-4">
                        <div className="text-center">
                          <Sparkles className="w-10 h-10 text-brand-400 mx-auto mb-2" />
                          <h3 className="text-lg font-bold text-content-inverted">
                            AI Analyzing...
                          </h3>
                          <p className="text-sm text-content-subtle">
                            Computer vision detecting work scope
                          </p>
                        </div>
                        <div className="p-4 rounded-xl border border-ink-700 bg-ink-800 space-y-2">
                          {[
                            "🛁 Detecting bathroom fixtures...",
                            "🔧 Identifying work needed...",
                            "📦 Finding materials & prices...",
                            "⏱️ Estimating labor hours...",
                          ].map((step, idx) => (
                            <div
                              key={idx}
                              className="flex items-center justify-between p-2.5 bg-ink-700 rounded-lg border border-ink-600"
                            >
                              <span className="text-sm text-ink-200">
                                {step}
                              </span>
                              {idx < 3 ? (
                                <CheckCircle2 className="w-4 h-4 text-success-400" />
                              ) : (
                                <div className="w-4 h-4 border-2 border-brand-400 border-t-transparent rounded-full animate-spin" />
                              )}
                            </div>
                          ))}
                        </div>
                        <Button
                          onClick={() => setDemoStep(2)}
                          className="w-full bg-brand-700 hover:bg-brand text-content-inverted gap-2 text-sm"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" /> View Results
                          →
                        </Button>
                      </div>
                    )}
                    {demoStep === 2 && (
                      <div className="space-y-4">
                        <div className="text-center">
                          <div className="text-4xl mb-2">✨</div>
                          <h3 className="text-lg font-bold text-content-inverted">
                            Quote Generated!
                          </h3>
                        </div>
                        <div className="p-4 rounded-xl border border-ink-700 bg-ink-800">
                          <p className="text-sm font-bold text-content-inverted mb-3">
                            Bathroom Renovation
                          </p>
                          <div className="space-y-1.5">
                            {[
                              ["Porcelain tile (120 sq ft)", "$680"],
                              ["Vanity & sink combo", "$850"],
                              ["Toilet, fixtures & supplies", "$720"],
                              ["Labor (24hrs @ $75/hr)", "$1,800"],
                            ].map(([item, price]) => (
                              <div
                                key={item}
                                className="flex justify-between text-sm py-1.5 border-b border-ink-700 last:border-0"
                              >
                                <span className="text-ink-300">{item}</span>
                                <span className="font-semibold text-content-inverted">
                                  {price}
                                </span>
                              </div>
                            ))}
                            <div className="flex justify-between text-sm font-bold pt-2 border-t border-ink-600">
                              <span className="text-content-inverted">
                                Total
                              </span>
                              <span className="text-success-400 text-base">
                                $4,050
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            onClick={() => setDemoStep(1)}
                            variant="outline"
                            className="flex-1 text-sm border-ink-600 text-ink-300 hover:bg-ink-800 hover:text-content-inverted"
                          >
                            Back
                          </Button>
                          <Button
                            onClick={() => setDemoStep(3)}
                            className="flex-1 bg-brand hover:bg-brand-hover text-content-inverted text-sm"
                          >
                            Send Quote →
                          </Button>
                        </div>
                      </div>
                    )}
                    {demoStep === 3 && (
                      <div className="space-y-4">
                        <div className="text-center">
                          <div className="text-4xl mb-2">📧</div>
                          <h3 className="text-lg font-bold text-content-inverted">
                            Send to Client
                          </h3>
                        </div>
                        <div className="p-4 rounded-xl border border-ink-700 bg-ink-800 space-y-2">
                          {[
                            "📧 Email with PDF attachment",
                            "📱 SMS with approval link",
                            "✅ One-click approval button",
                            "📅 Google Calendar booking link",
                          ].map((item) => (
                            <div
                              key={item}
                              className="flex items-center gap-2 text-sm py-1.5"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5 text-success-400 flex-shrink-0" />
                              <span className="text-ink-200">{item}</span>
                            </div>
                          ))}
                        </div>
                        {!quoteSending && !quoteSent && (
                          <Button
                            onClick={handleQuoteSend}
                            className="w-full bg-brand hover:bg-brand-hover text-content-inverted gap-2 text-sm"
                          >
                            <Send className="w-3.5 h-3.5" /> Send Quote to
                            Client
                          </Button>
                        )}
                        {quoteSending && (
                          <div className="flex items-center justify-center gap-2 p-3 rounded-lg border border-ink-700 bg-ink-800">
                            <div className="w-4 h-4 border-2 border-info-400 border-t-transparent rounded-full animate-spin" />
                            <span className="text-sm text-ink-200">
                              Sending...
                            </span>
                          </div>
                        )}
                        {quoteSent && (
                          <div className="flex items-center gap-2 p-3 rounded-lg border border-success-700 bg-success-900/30">
                            <CheckCircle2 className="w-4 h-4 text-success-400" />
                            <span className="text-sm font-medium text-success-300">
                              Quote sent successfully!
                            </span>
                          </div>
                        )}
                        <div className="flex gap-2">
                          <Button
                            onClick={() => setDemoStep(2)}
                            variant="outline"
                            className="flex-1 text-sm border-ink-600 text-ink-300 hover:bg-ink-800 hover:text-content-inverted"
                          >
                            Back
                          </Button>
                          <Button
                            onClick={handleDemoClose}
                            className="flex-1 bg-brand hover:bg-brand-hover text-content-inverted text-sm"
                          >
                            Finish
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
