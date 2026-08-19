// AI-style follow-up message generator for the Chase Invoice feature.
// Produces tone-appropriate email + SMS copy based on how late the invoice is.

const TONE_PRESETS = {
  friendly: {
    label: "Friendly nudge",
    description: "Warm, casual - best for a first reminder",
    accent: "emerald",
  },
  professional: {
    label: "Professional",
    description: "Polite but direct - best at 7-14 days late",
    accent: "blue",
  },
  firm: {
    label: "Firm",
    description: "Clear and assertive - best at 15-30 days late",
    accent: "amber",
  },
  final: {
    label: "Final notice",
    description: "Last reminder before escalation - 30+ days late",
    accent: "red",
  },
};

const recommendToneForDays = (daysOverdue) => {
  if (daysOverdue <= 0) return "friendly";
  if (daysOverdue <= 7) return "friendly";
  if (daysOverdue <= 14) return "professional";
  if (daysOverdue <= 30) return "firm";
  return "final";
};

const formatMoney = (amount) =>
  Number(amount || 0).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  });

const firstName = (fullName = "") => (fullName.split(" ")[0] || fullName || "there");

const buildEmail = ({ tone, invoice, business, daysOverdue, paymentLink }) => {
  const clientName = firstName(invoice.client_name);
  const businessName = business?.business_name || "our team";
  const total = formatMoney(invoice.total);
  const number = invoice.invoice_number || `#${(invoice.id || "").slice(0, 6).toUpperCase()}`;
  const link = paymentLink || invoice.payment_link || "";
  const linkLine = link
    ? `\n\nPay securely in one click: ${link}`
    : "";

  if (tone === "friendly") {
    return {
      subject: `Quick reminder about invoice ${number}`,
      body:
`Hi ${clientName},

Hope you're doing well! Just a friendly reminder that invoice ${number} for ${total} is on our books and ${daysOverdue > 0 ? `${daysOverdue} day${daysOverdue === 1 ? '' : 's'} past due` : 'coming due soon'}.

If you've already sent payment, please ignore this - and thank you! Otherwise, no rush, just let us know if you need anything from us to wrap it up.${linkLine}

Appreciate you,
${businessName}`,
    };
  }

  if (tone === "professional") {
    return {
      subject: `Payment reminder - invoice ${number}`,
      body:
`Hi ${clientName},

I'm following up on invoice ${number} for ${total}, which is now ${daysOverdue} day${daysOverdue === 1 ? '' : 's'} past due.

Could you please confirm when we can expect payment? If there are any questions about the invoice or you need a copy resent, I'm happy to help.${linkLine}

Thanks,
${businessName}`,
    };
  }

  if (tone === "firm") {
    return {
      subject: `Action needed: invoice ${number} (${daysOverdue} days overdue)`,
      body:
`Hi ${clientName},

Invoice ${number} for ${total} is now ${daysOverdue} days overdue and requires your attention.

To keep things moving, please settle the balance this week or reply with a date we can expect payment. We want to avoid any disruption to upcoming work or services.${linkLine}

Thank you,
${businessName}`,
    };
  }

  // final
  return {
    subject: `Final notice: invoice ${number}`,
    body:
`Hi ${clientName},

This is a final reminder that invoice ${number} for ${total} is now ${daysOverdue} days overdue.

Please make payment within 5 business days to avoid further action, including late fees and pause of any active work. If you'd like to discuss a payment plan, reply to this email today and we'll work something out.${linkLine}

Regards,
${businessName}`,
  };
};

const buildSMS = ({ tone, invoice, business, daysOverdue, paymentLink }) => {
  const clientName = firstName(invoice.client_name);
  const total = formatMoney(invoice.total);
  const number = invoice.invoice_number || `#${(invoice.id || "").slice(0, 6).toUpperCase()}`;
  const businessName = business?.business_name || "Invoicium";
  const link = paymentLink || invoice.payment_link || "";
  const linkPart = link ? ` Pay: ${link}` : "";

  if (tone === "friendly") {
    return `Hi ${clientName}, friendly reminder from ${businessName}: invoice ${number} for ${total} is ${daysOverdue > 0 ? `${daysOverdue}d past due` : 'coming due'}.${linkPart} Thanks!`;
  }
  if (tone === "professional") {
    return `Hi ${clientName}, ${businessName} here. Invoice ${number} (${total}) is ${daysOverdue}d overdue. Could you confirm when we'll receive payment?${linkPart}`;
  }
  if (tone === "firm") {
    return `Hi ${clientName}, ${businessName}: invoice ${number} for ${total} is ${daysOverdue}d overdue. Please settle this week to avoid delays.${linkPart}`;
  }
  return `${businessName} FINAL NOTICE: invoice ${number} (${total}) is ${daysOverdue}d overdue. Please pay within 5 business days.${linkPart}`;
};

export const generateFollowUp = ({ invoice, business, tone, paymentLink }) => {
  const dueDate = invoice?.due_date ? new Date(invoice.due_date) : null;
  const daysOverdue = dueDate
    ? Math.max(0, Math.floor((Date.now() - dueDate.getTime()) / (1000 * 60 * 60 * 24)))
    : 0;
  const resolvedTone = tone || recommendToneForDays(daysOverdue);
  return {
    tone: resolvedTone,
    daysOverdue,
    email: buildEmail({ tone: resolvedTone, invoice, business, daysOverdue, paymentLink }),
    sms: buildSMS({ tone: resolvedTone, invoice, business, daysOverdue, paymentLink }),
  };
};

export const TONES = TONE_PRESETS;
export { recommendToneForDays };

// Default escalation cadence used by the scheduler UI
export const DEFAULT_SEQUENCE = [
  { day: 1, tone: "friendly", channel: "email", label: "Friendly nudge" },
  { day: 7, tone: "professional", channel: "email", label: "Professional follow-up" },
  { day: 14, tone: "professional", channel: "sms", label: "SMS check-in" },
  { day: 21, tone: "firm", channel: "email", label: "Firm reminder" },
  { day: 30, tone: "final", channel: "email", label: "Final notice" },
];
