import {
  FileText,
  Users,
  ClipboardList,
  Calendar,
  BarChart3,
  Settings,
  RefreshCw,
  CheckCircle2,
  BookOpen,
  CreditCard,
  Sparkles,
  Shield,
  Camera,
  Plus,
  Send,
} from "lucide-react";

/**
 * Every section of the tour, in order: what it says, what it shows, and the
 * feature (if any) a plan must include for it to appear at all.
 */
export const ALL_TOUR_SECTIONS = [
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
