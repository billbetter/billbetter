import React, { useMemo, useState } from "react";
import {
  Search,
  UserCog,
  Bell,
  Palette,
  Building2,
  ReceiptText,
  FileText,
  Scale,
  CreditCard,
  Landmark,
  CalendarClock,
  LifeBuoy,
  ArrowRight,
} from "lucide-react";

/**
 * Settings landing page: grouped cards instead of a ten-item tab strip.
 *
 * Cards drive the existing `activeTab` state rather than routing anywhere new.
 * The panels themselves are untouched, so no setting can be lost in the
 * redesign -- every card points at a tab that already exists.
 *
 * Card chrome is deliberately absent (no border, no fill) so the grid reads as
 * whitespace and hierarchy. The one bordered variant is reserved for a single
 * promotional card, which is why `highlight` is a property of the card rather
 * than a separate component.
 *
 * Icon tints use the brand ramp (--brand-700 #0369A1), not the purple of the
 * reference design -- Invoicium's accent is sky blue.
 */

const SECTIONS = [
  {
    title: "Personal settings",
    cards: [
      {
        tab: "security",
        icon: UserCog,
        title: "Profile and password",
        description: "Update your sign-in email and change your password.",
      },
      {
        tab: "notifications",
        icon: Bell,
        title: "Notifications",
        description:
          "Choose which emails you receive and how often analytics are sent.",
      },
      {
        tab: "appearance",
        icon: Palette,
        title: "Appearance",
        description:
          "Light or dark theme, and the animated page background.",
      },
    ],
  },
  {
    title: "Business settings",
    cards: [
      {
        tab: "business",
        icon: Building2,
        title: "Business details",
        description:
          "Company name, contact details, address and the logo on your invoices.",
      },
      {
        tab: "business",
        icon: ReceiptText,
        title: "Invoice and quote defaults",
        description:
          "Tax rate, hourly rate, invoice numbering, payment terms, and whether clients can approve quotes online.",
      },
      {
        tab: "template",
        icon: FileText,
        title: "PDF templates",
        description: "Pick the template clients see when you send a document.",
      },
      {
        tab: "legal",
        icon: Scale,
        title: "Legal",
        description: "Terms of service and privacy policy for your account.",
      },
    ],
  },
  {
    title: "Payments and billing",
    cards: [
      {
        tab: "billing",
        icon: CreditCard,
        title: "Subscription and billing",
        description:
          "Your plan, payment method and billing history via the Stripe portal.",
      },
      {
        tab: "payments",
        icon: Landmark,
        title: "Getting paid",
        description:
          "Connect Stripe so clients can pay invoices by card and money reaches you.",
      },
      {
        tab: "calendar",
        icon: CalendarClock,
        title: "Calendar sync",
        description:
          "Connect Google Calendar to keep jobs and bookings in sync.",
      },
    ],
  },
  {
    title: "Help",
    cards: [
      {
        tab: "contact",
        icon: LifeBuoy,
        title: "Contact support",
        description:
          "Get in touch if something isn't working the way it should.",
      },
    ],
  },
];

function SettingCard({ card, onOpen }) {
  const Icon = card.icon;
  const base =
    "group flex w-full items-start gap-4 rounded-xl p-3 text-left transition-colors";

  if (card.highlight) {
    return (
      <button
        type="button"
        onClick={() => onOpen(card.tab)}
        className={`${base} border border-line dark:border-ink-700 bg-brand-50/60 dark:bg-brand-900/15 hover:border-brand-300 dark:hover:border-brand-700`}
      >
        <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-brand-100 dark:bg-brand-900/40">
          <Icon className="h-[18px] w-[18px] text-brand-700 dark:text-brand-300" />
        </span>
        <span className="min-w-0">
          <span className="flex items-center gap-1.5 font-bold text-brand-700 dark:text-brand-300">
            {card.title}
            <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
          </span>
          <span className="mt-1 block text-sm leading-relaxed text-content-muted dark:text-content-subtle">
            {card.description}
          </span>
        </span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => onOpen(card.tab)}
      className={`${base} hover:bg-surface-sunken dark:hover:bg-ink-800`}
    >
      <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-brand-100 dark:bg-brand-900/30">
        <Icon className="h-[18px] w-[18px] text-brand-700 dark:text-brand-300" />
      </span>
      <span className="min-w-0">
        <span className="block font-bold text-brand-700 group-hover:underline dark:text-brand-300">
          {card.title}
        </span>
        <span className="mt-1 block text-sm leading-relaxed text-content-muted dark:text-content-subtle">
          {card.description}
        </span>
      </span>
    </button>
  );
}

export default function SettingsHub({ onOpen, stripeConnected = true }) {
  const [query, setQuery] = useState("");

  const sections = useMemo(() => {
    // A single promotional card, shown only while it is actually actionable.
    // An upsell for something already done is just clutter.
    const withPromo = SECTIONS.map((s) =>
      s.title === "Payments and billing" && !stripeConnected
        ? {
            ...s,
            cards: s.cards.map((c) =>
              c.tab === "payments" ? { ...c, highlight: true } : c,
            ),
          }
        : s,
    );

    const q = query.trim().toLowerCase();
    if (!q) return withPromo;
    return withPromo
      .map((s) => ({
        ...s,
        cards: s.cards.filter(
          (c) =>
            c.title.toLowerCase().includes(q) ||
            c.description.toLowerCase().includes(q),
        ),
      }))
      .filter((s) => s.cards.length > 0);
  }, [query, stripeConnected]);

  return (
    <div className="space-y-10">
      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-content-muted dark:text-content-subtle" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search settings"
          aria-label="Search settings"
          className="h-11 w-full rounded-xl border border-line bg-surface pl-10 pr-4 text-sm text-content placeholder:text-content-subtle focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 dark:border-ink-700 dark:bg-ink-800 dark:text-content-inverted"
        />
      </div>

      {sections.length === 0 ? (
        <p className="text-sm text-content-muted dark:text-content-subtle">
          No settings match “{query}”.
        </p>
      ) : (
        sections.map((section) => (
          <section key={section.title}>
            <h2 className="mb-4 text-base font-black tracking-tight text-content dark:text-content-inverted">
              {section.title}
            </h2>
            <div className="grid grid-cols-1 gap-x-8 gap-y-2 md:grid-cols-2 lg:grid-cols-3">
              {section.cards.map((card) => (
                <SettingCard key={card.title} card={card} onOpen={onOpen} />
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
