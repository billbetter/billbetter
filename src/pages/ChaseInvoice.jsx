import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { format, differenceInCalendarDays } from "date-fns";
import {
  AlertCircle,
  ArrowRight,
  Bot,
  CalendarClock,
  CheckCircle2,
  Clock,
  Copy,
  CreditCard,
  Loader2,
  Mail,
  MessageSquare,
  Phone,
  PlayCircle,
  RefreshCw,
  Search,
  Send,
  Wallet,
  TrendingUp,
  TimerReset,
  Zap,
} from "lucide-react";
import PullToRefresh from "@/components/utils/PullToRefresh";

import { sdk } from "@/api/sdk";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  DEFAULT_SEQUENCE,
  TONES,
  generateFollowUp,
} from "@/components/invoice/chaseFollowUp";

const STORAGE_KEY = "invoicium_chase_recovery_state_v2";

const readRecoveryState = () => {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { reminders: [], activeSequences: {} };
    const parsed = JSON.parse(raw);
    return {
      reminders: Array.isArray(parsed.reminders) ? parsed.reminders : [],
      activeSequences: parsed.activeSequences || {},
    };
  } catch {
    return { reminders: [], activeSequences: {} };
  }
};

const writeRecoveryState = (reminders, activeSequences) => {
  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ reminders, activeSequences }),
    );
  } catch {
    // local persistence is best-effort
  }
};

const formatCurrency = (n) =>
  Number(n || 0).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  });

const formatCurrencyShort = (n) =>
  Number(n || 0).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });

/*
  A due date is a calendar day, not an instant.

  Both invoice forms write it as a bare "YYYY-MM-DD" -- CreateInvoice from an
  <input type="date">, QuickBillFlow from format(..., "yyyy-MM-dd") -- and
  `new Date("2026-09-24")` parses that as midnight UTC, which is the 23rd at
  20:00 for anyone west of Greenwich. The bucket, the countdown and the printed
  date would all name the day before the one that was typed. Splitting the
  digits and building a local midnight keeps the day as written.

  Values that carry a real time of day are left alone and parsed as before:
  those are instants and their local day is the correct reading of them.
*/
const CALENDAR_DATE = /^\d{4}-\d{2}-\d{2}$/;

const dueDateOf = (invoice) => {
  const raw = invoice?.due_date;
  if (!raw) return null;
  if (typeof raw === "string" && CALENDAR_DATE.test(raw)) {
    const [year, month, day] = raw.split("-").map(Number);
    return new Date(year, month - 1, day);
  }
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

// Signed distance to the due date: negative once it has passed, positive
// while it is still ahead, 0 on the day itself. null when the invoice has no
// due date at all, which is not the same as "due today" and must not be
// bucketed as though it were.
const daysToDueOf = (invoice) => {
  const due = dueDateOf(invoice);
  if (!due) return null;
  return differenceInCalendarDays(due, new Date());
};

const daysOverdueOf = (invoice) => {
  const toDue = daysToDueOf(invoice);
  if (toDue === null) return 0;
  return Math.max(0, -toDue);
};

const getInvoiceNumber = (invoice) =>
  invoice?.invoice_number ||
  `INV-${String(invoice?.id || "")
    .slice(0, 6)
    .toUpperCase()}`;

const getContactMethod = (invoice) => {
  if (invoice?.client_email) return "email";
  if (invoice?.client_phone) return "sms";
  return "missing";
};

const getFallbackPaymentLink = (invoice) => {
  if (typeof window === "undefined") return "";
  return `${window.location.origin}${createPageUrl("InvoiceDetail")}?id=${invoice.id}`;
};

export default function ChaseInvoice() {
  const [invoices, setInvoices] = useState([]);
  const [settings, setSettings] = useState(null);
  const [reminders, setReminders] = useState([]);
  const [activeSequences, setActiveSequences] = useState({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [bucketFilter, setBucketFilter] = useState("all");
  const [composeDialog, setComposeDialog] = useState({
    open: false,
    invoice: null,
  });
  const [composeTone, setComposeTone] = useState("friendly");
  const [composeChannel, setComposeChannel] = useState("email");
  const [draft, setDraft] = useState({ subject: "", body: "", sms: "" });
  const [sending, setSending] = useState(false);
  const [bulkSending, setBulkSending] = useState(false);
  const [sequenceStarting, setSequenceStarting] = useState(null);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    const saved = readRecoveryState();
    setReminders(saved.reminders);
    setActiveSequences(saved.activeSequences);
    loadData();
  }, []);

  const persistState = (nextReminders, nextSequences) => {
    setReminders(nextReminders);
    setActiveSequences(nextSequences);
    writeRecoveryState(nextReminders, nextSequences);
  };

  const showToast = (message, type = "success") => {
    setToast({ message, type });
    window.setTimeout(() => setToast(null), 3600);
  };

  const loadData = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const user = await sdk.auth.me();
      const [invoiceData, settingsData] = await Promise.all([
        sdk.entities.Invoice.filter({ user_id: user.id }, "-created_date", 200),
        sdk.entities.BusinessSettings.filter({ user_id: user.id }),
      ]);

      setInvoices(
        invoiceData.map((invoice) => {
          // Same day math as the buckets and the row badge. Comparing raw
          // instants instead flipped an invoice due today to "overdue" the
          // moment it loaded, because a bare "2026-09-04" parses as midnight
          // UTC -- already in the past for most of the working day.
          const isPastDue =
            invoice.status === "sent" && daysOverdueOf(invoice) > 0;
          return isPastDue ? { ...invoice, status: "overdue" } : invoice;
        }),
      );
      setSettings(settingsData[0] || null);
    } catch (err) {
      console.error("Failed to load chase data", err);
      showToast("Could not load invoice data.", "error");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const chaseInvoices = useMemo(
    () =>
      invoices
        .filter((invoice) => ["sent", "overdue"].includes(invoice.status))
        .map((invoice) => ({
          ...invoice,
          daysOverdue: daysOverdueOf(invoice),
          daysToDue: daysToDueOf(invoice),
        })),
    [invoices],
  );

  /*
    Buckets are a distance from the due date, not a lateness score.

    They used to run off `daysOverdue`, which is clamped at 0, so every invoice
    that had not come due yet collapsed into "Due soon" and the four day-range
    chips were permanently empty. Picking one returned nothing and read as a
    broken filter -- which is exactly what it looked like on an account whose
    invoices are all still ahead of their due date.

    The ranges now measure |daysToDue|, so "8-14 days" means eight to fourteen
    days FROM the due date and catches an invoice due next week as readily as
    one that went late last week. Which side of the date an invoice sits on is
    never hidden by this -- every row carries a "Due in Nd" or "Nd overdue"
    badge -- and `overdue` stays as its own chip for the pure chase view.

    These are overlapping slices, not a partition: an invoice ten days late is
    in both `overdue` and `d8_14`, so the counts across the row do not add up
    to All. That is the point of a filter row rather than a segmented control.
  */
  const buckets = useMemo(() => {
    const make = (label, list) => ({
      label,
      count: list.length,
      total: list.reduce((sum, invoice) => sum + (invoice.total || 0), 0),
      list,
    });

    // A missing due date has no distance to measure, so it belongs to no
    // range. It still shows under All, which is where it can be noticed and
    // given a date.
    const inRange = (min, max) =>
      chaseInvoices.filter((invoice) => {
        if (invoice.daysToDue === null) return false;
        const distance = Math.abs(invoice.daysToDue);
        return distance >= min && distance <= max;
      });

    return {
      overdue: make(
        "Overdue",
        chaseInvoices.filter((invoice) => invoice.daysOverdue > 0),
      ),
      due_today: make(
        "Due today",
        chaseInvoices.filter((invoice) => invoice.daysToDue === 0),
      ),
      d1_7: make("1–7 days", inRange(1, 7)),
      d8_14: make("8–14 days", inRange(8, 14)),
      d15_30: make("15–30 days", inRange(15, 30)),
      d30plus: make("30+ days", inRange(31, Infinity)),
    };
  }, [chaseInvoices]);

  const stats = useMemo(() => {
    const overdue = chaseInvoices.filter((invoice) => invoice.daysOverdue > 0);
    const contactReady = overdue.filter(
      (invoice) => getContactMethod(invoice) !== "missing",
    );
    const totalOutstanding = chaseInvoices.reduce(
      (sum, invoice) => sum + (invoice.total || 0),
      0,
    );
    const totalOverdue = overdue.reduce(
      (sum, invoice) => sum + (invoice.total || 0),
      0,
    );
    const paidTotal = invoices
      .filter((invoice) => invoice.status === "paid")
      .reduce((sum, invoice) => sum + (invoice.total || 0), 0);
    const oldest = overdue.reduce(
      (max, invoice) => Math.max(max, invoice.daysOverdue),
      0,
    );

    return {
      contactReady: contactReady.length,
      oldest,
      overdueCount: overdue.length,
      paidTotal,
      totalOutstanding,
      totalOverdue,
    };
  }, [chaseInvoices, invoices]);

  const filteredList = useMemo(() => {
    let list = chaseInvoices;
    if (bucketFilter !== "all") {
      list = buckets[bucketFilter]?.list || [];
    }

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      list = list.filter(
        (invoice) =>
          invoice.client_name?.toLowerCase().includes(q) ||
          invoice.invoice_number?.toLowerCase().includes(q),
      );
    }

    /*
      Latest first, then soonest, then biggest.

      Sorting on `daysOverdue` alone was fine while the list only ever held
      late invoices, but it is clamped at 0, so every not-yet-due invoice tied
      at 0 and fell back to amount -- one due tomorrow sat below one due in two
      months if the second was worth more. Ordering on `daysToDue` ascending
      puts the most urgent end of the queue at the top in both directions,
      which is what "sorted by how late" means once the queue reaches forward
      of today. Undated invoices have nothing to sort by and sink to the
      bottom, above nothing but the amount tiebreak.
    */
    const NO_DUE_DATE = Number.MAX_SAFE_INTEGER;
    return [...list].sort((a, b) => {
      const aDue = a.daysToDue ?? NO_DUE_DATE;
      const bDue = b.daysToDue ?? NO_DUE_DATE;
      if (aDue !== bDue) return aDue - bDue;
      return (b.total || 0) - (a.total || 0);
    });
  }, [bucketFilter, buckets, chaseInvoices, searchTerm]);

  const ensurePaymentLink = async (invoice) => {
    // Don't generate or include payment links unless contractor has connected Stripe
    if (settings?.stripe_account_status !== "active") return "";

    if (invoice?.payment_link && invoice.payment_link !== "#")
      return invoice.payment_link;

    let paymentLink = "";
    try {
      const response = await sdk.functions.invoke("createInvoicePaymentLink", {
        invoice_id: invoice.id,
      });
      if (
        response?.data?.success &&
        response.data.payment_link &&
        response.data.payment_link !== "#"
      ) {
        paymentLink = response.data.payment_link;
      }
    } catch (err) {
      console.warn("Payment link generation failed", err);
    }

    if (!paymentLink) paymentLink = getFallbackPaymentLink(invoice);

    setInvoices((prev) =>
      prev.map((item) =>
        item.id === invoice.id ? { ...item, payment_link: paymentLink } : item,
      ),
    );

    try {
      await sdk.entities.Invoice.update(invoice.id, {
        payment_link: paymentLink,
      });
    } catch (err) {
      console.warn("Could not persist payment link", err);
    }

    return paymentLink;
  };

  const appendPaymentLink = (message, paymentLink) => {
    if (!paymentLink || message.includes(paymentLink)) return message;
    return `${message}\n\nPay securely here: ${paymentLink}`;
  };

  const openCompose = (invoice) => {
    const method = getContactMethod(invoice);
    const draftMsg = generateFollowUp({ invoice, business: settings });

    setComposeTone(draftMsg.tone);
    setComposeChannel(method === "sms" ? "sms" : "email");
    setDraft({
      subject: draftMsg.email.subject,
      body: draftMsg.email.body,
      sms: draftMsg.sms,
    });
    setComposeDialog({ open: true, invoice });
  };

  const regenerate = (tone) => {
    if (!composeDialog.invoice) return;
    const draftMsg = generateFollowUp({
      invoice: composeDialog.invoice,
      business: settings,
      tone,
    });
    setComposeTone(tone);
    setDraft({
      subject: draftMsg.email.subject,
      body: draftMsg.email.body,
      sms: draftMsg.sms,
    });
  };

  const recordReminder = (
    invoice,
    channel,
    tone,
    deliveryStatus,
    errorMessage = "",
  ) => {
    const nextReminder = {
      id: `rem_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      amount: invoice.total || 0,
      channel,
      client_name: invoice.client_name,
      delivery_status: deliveryStatus,
      error_message: errorMessage,
      invoice_id: invoice.id,
      invoice_number: getInvoiceNumber(invoice),
      sent_at: new Date().toISOString(),
      tone,
    };

    setReminders((current) => {
      const nextReminders = [nextReminder, ...current].slice(0, 60);
      writeRecoveryState(nextReminders, activeSequences);
      return nextReminders;
    });

    return nextReminder;
  };

  const deliverReminder = async ({
    invoice,
    channel,
    tone,
    emailSubject,
    emailBody,
    smsBody,
    paymentLink,
  }) => {
    const fnName = channel === "email" ? "sendInvoiceEmail" : "sendInvoiceSMS";
    const payload =
      channel === "email"
        ? {
            invoice_id: invoice.id,
            payment_link: paymentLink,
            subject: emailSubject,
            body: emailBody,
            to: invoice.client_email,
            tone,
          }
        : {
            invoice_id: invoice.id,
            message: smsBody,
            payment_link: paymentLink,
            to: invoice.client_phone,
            tone,
          };

    try {
      const response = await sdk.functions.invoke(fnName, payload);
      if (response?.data?.success) return { status: "sent", error: "" };
      return {
        status: "queued",
        error:
          response?.data?.error || "Delivery integration is not connected.",
      };
    } catch (err) {
      return {
        status: "queued",
        error: err?.message || "Delivery integration is not connected.",
      };
    }
  };

  const sendReminder = async () => {
    const invoice = composeDialog.invoice;
    if (!invoice) return;

    const hasRecipient =
      composeChannel === "email"
        ? Boolean(invoice.client_email)
        : Boolean(invoice.client_phone);
    if (!hasRecipient) {
      showToast("Add a client email or phone number first.", "error");
      return;
    }

    setSending(true);
    try {
      const paymentLink = await ensurePaymentLink(invoice);
      const emailBody = appendPaymentLink(draft.body, paymentLink);
      const smsBody = appendPaymentLink(draft.sms, paymentLink);
      const delivery = await deliverReminder({
        invoice,
        channel: composeChannel,
        tone: composeTone,
        emailSubject: draft.subject,
        emailBody,
        smsBody,
        paymentLink,
      });

      recordReminder(
        invoice,
        composeChannel,
        composeTone,
        delivery.status,
        delivery.error,
      );
      setComposeDialog({ open: false, invoice: null });

      if (delivery.status === "sent") {
        showToast(`Reminder sent to ${invoice.client_name}.`);
      } else {
        showToast(
          "Reminder queued. Connect delivery integrations for live sends.",
          "warning",
        );
      }
    } finally {
      setSending(false);
    }
  };

  const sendBulk = async () => {
    const targets = filteredList
      .filter(
        (invoice) =>
          invoice.daysOverdue > 0 && getContactMethod(invoice) !== "missing",
      )
      .slice(0, 25);

    if (targets.length === 0) {
      showToast("No reachable overdue invoices.", "error");
      return;
    }

    setBulkSending(true);
    let sentCount = 0;
    let queuedCount = 0;

    for (const invoice of targets) {
      const channel = getContactMethod(invoice) === "sms" ? "sms" : "email";
      const paymentLink = await ensurePaymentLink(invoice);
      const message = generateFollowUp({
        invoice,
        business: settings,
        paymentLink,
      });
      const delivery = await deliverReminder({
        invoice,
        channel,
        tone: message.tone,
        emailSubject: message.email.subject,
        emailBody: message.email.body,
        smsBody: message.sms,
        paymentLink,
      });

      recordReminder(
        invoice,
        channel,
        message.tone,
        delivery.status,
        delivery.error,
      );
      if (delivery.status === "sent") sentCount++;
      else queuedCount++;
    }

    setBulkSending(false);
    if (queuedCount > 0) {
      showToast(`${sentCount} sent, ${queuedCount} queued.`, "warning");
    } else {
      showToast(`${sentCount} reminder${sentCount === 1 ? "" : "s"} sent.`);
    }
  };

  const startSequence = async (invoice) => {
    if (getContactMethod(invoice) === "missing") {
      showToast("Add a client email or phone number first.", "error");
      return;
    }

    setSequenceStarting(invoice.id);
    const paymentLink = await ensurePaymentLink(invoice);
    const nextSequences = {
      ...activeSequences,
      [invoice.id]: {
        invoice_id: invoice.id,
        client_name: invoice.client_name,
        invoice_number: getInvoiceNumber(invoice),
        payment_link: paymentLink,
        started_at: new Date().toISOString(),
        next_step_day: DEFAULT_SEQUENCE[0].day,
      },
    };
    persistState(reminders, nextSequences);
    setSequenceStarting(null);
    showToast(`Auto-pilot started for ${invoice.client_name}.`);
  };

  const copyToClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      showToast("Copied.");
    } catch {
      showToast("Could not copy.", "error");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-surface-sunken dark:bg-surface-inverted-deep">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-surface dark:bg-ink-800 shadow-lg flex items-center justify-center border border-line-subtle dark:border-ink-700">
            <Loader2 className="w-8 h-8 animate-spin text-success-600 dark:text-success-400" />
          </div>
          <div className="text-center">
            <p className="text-content dark:text-content-inverted font-semibold text-base">
              Loading recovery
            </p>
            <p className="text-content-muted dark:text-content-subtle text-sm mt-1">
              Please wait a moment...
            </p>
          </div>
        </div>
      </div>
    );
  }

  const bucketKeys = [
    "overdue",
    "due_today",
    "d1_7",
    "d8_14",
    "d15_30",
    "d30plus",
  ];

  return (
    <PullToRefresh onRefresh={() => loadData(true)}>
      <div className="min-h-screen bg-surface-sunken dark:bg-surface-inverted-deep">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-8 space-y-6">
          {/* Mobile Header */}
          <div className="lg:hidden">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-success-600 flex items-center justify-center shadow-lg shadow-success-200 dark:shadow-success-900/30">
                  <Zap className="w-5 h-5 text-content-inverted" />
                </div>
                <div>
                  <h1 className="text-2xl font-black text-content dark:text-content-inverted tracking-tight">
                    Get Paid
                  </h1>
                  <p className="text-sm text-content-muted dark:text-content-subtle font-medium">
                    {chaseInvoices.length} open · {stats.overdueCount} overdue
                  </p>
                </div>
              </div>
              <Button
                onClick={() => loadData(true)}
                variant="outline"
                size="icon"
                disabled={refreshing}
                className="h-10 w-10 rounded-xl border-line dark:border-ink-700 bg-surface dark:bg-ink-800 shadow-sm active:scale-95 transition-all hover:bg-surface-sunken dark:hover:bg-ink-700"
              >
                <RefreshCw
                  className={`w-4 h-4 text-content-body dark:text-content-subtle ${refreshing ? "animate-spin" : ""}`}
                />
              </Button>
            </div>

            {/* Mobile Stats */}
            <div className="grid grid-cols-2 gap-3 mb-6">
              <MobileStat
                icon={Wallet}
                tone="emerald"
                label="Outstanding"
                value={formatCurrencyShort(stats.totalOutstanding)}
              />
              <MobileStat
                icon={AlertCircle}
                tone="red"
                label="Overdue"
                value={formatCurrencyShort(stats.totalOverdue)}
                emphasize={stats.overdueCount > 0}
              />
              <MobileStat
                icon={TimerReset}
                tone="amber"
                label="Oldest"
                value={stats.oldest > 0 ? `${stats.oldest}d` : "—"}
              />
              <MobileStat
                icon={TrendingUp}
                tone="blue"
                label="Recovered"
                value={formatCurrencyShort(stats.paidTotal)}
              />
            </div>

            <Button
              onClick={sendBulk}
              disabled={bulkSending || stats.contactReady === 0}
              className="w-full h-12 bg-brand hover:bg-brand-hover dark:bg-brand dark:hover:bg-brand-hover text-content-inverted rounded-xl font-semibold shadow-sm active:scale-[0.98] transition-all disabled:opacity-50"
            >
              {bulkSending ? (
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              ) : (
                <PlayCircle className="w-5 h-5 mr-2" />
              )}
              {bulkSending
                ? "Sending Reminders..."
                : stats.contactReady > 0
                  ? `Chase ${stats.contactReady} Overdue ${stats.contactReady === 1 ? "Invoice" : "Invoices"}`
                  : "Nothing to Chase"}
            </Button>
          </div>

          {/* Desktop Header */}
          <div className="hidden lg:block">
            <div className="bg-surface dark:bg-surface-inverted rounded-2xl border border-line-subtle dark:border-ink-800 p-6 shadow-sm">
              <div className="flex items-start justify-between mb-8">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-success-600 flex items-center justify-center shadow-lg shadow-success-200 dark:shadow-success-900/30">
                    <Zap className="w-6 h-6 text-content-inverted" />
                  </div>
                  <div>
                    <h1 className="text-3xl font-black text-content dark:text-content-inverted tracking-tight">
                      Get Paid
                    </h1>
                    <p className="text-sm text-content-muted dark:text-content-subtle mt-1 font-medium">
                      Recover outstanding invoices with one-click reminders
                    </p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <Button
                    onClick={() => loadData(true)}
                    variant="outline"
                    disabled={refreshing}
                    className="h-10 px-4 rounded-xl border-line dark:border-ink-700 text-sm font-medium shadow-sm hover:bg-surface-sunken dark:hover:bg-ink-700 active:scale-95 transition-all dark:bg-ink-800 dark:text-ink-300"
                  >
                    <RefreshCw
                      className={`w-4 h-4 mr-2 ${refreshing ? "animate-spin" : ""}`}
                    />
                    Refresh
                  </Button>
                  <Button
                    onClick={sendBulk}
                    disabled={bulkSending || stats.contactReady === 0}
                    className="bg-brand hover:bg-brand-hover dark:bg-brand dark:hover:bg-brand-hover text-content-inverted h-10 px-5 text-sm font-semibold rounded-xl shadow-sm active:scale-95 transition-all disabled:opacity-50"
                  >
                    {bulkSending ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <PlayCircle className="w-4 h-4 mr-2" />
                    )}
                    {bulkSending
                      ? "Sending..."
                      : `Chase ${stats.contactReady} ${stats.contactReady === 1 ? "Invoice" : "Invoices"}`}
                  </Button>
                </div>
              </div>

              {/* Desktop Stats with Icons */}
              <div className="grid grid-cols-4 gap-8">
                <div className="border-r border-line-subtle dark:border-ink-700 pr-8">
                  <div className="flex items-center gap-2 mb-2">
                    <Wallet className="w-4 h-4 text-content-subtle dark:text-content-muted" />
                    <p className="text-xs font-bold text-content-subtle dark:text-content-muted uppercase tracking-wider">
                      Outstanding
                    </p>
                  </div>
                  <p className="text-3xl font-bold text-content dark:text-content-inverted">
                    {formatCurrencyShort(stats.totalOutstanding)}
                  </p>
                  <p className="text-xs text-content-muted dark:text-content-subtle mt-1 font-medium">
                    {chaseInvoices.length} open invoices
                  </p>
                </div>
                <div className="border-r border-line-subtle dark:border-ink-700 pr-8">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertCircle className="w-4 h-4 text-danger-400 dark:text-danger-500" />
                    <p className="text-xs font-bold text-content-subtle dark:text-content-muted uppercase tracking-wider">
                      Overdue
                    </p>
                  </div>
                  <p
                    className={`text-3xl font-bold ${stats.overdueCount > 0 ? "text-danger-600 dark:text-danger-400" : "text-content dark:text-content-inverted"}`}
                  >
                    {formatCurrencyShort(stats.totalOverdue)}
                  </p>
                  <p className="text-xs text-content-muted dark:text-content-subtle mt-1 font-medium">
                    {stats.overdueCount} late
                  </p>
                </div>
                <div className="border-r border-line-subtle dark:border-ink-700 pr-8">
                  <div className="flex items-center gap-2 mb-2">
                    <TimerReset className="w-4 h-4 text-warning-400 dark:text-warning-500" />
                    <p className="text-xs font-bold text-content-subtle dark:text-content-muted uppercase tracking-wider">
                      Oldest Overdue
                    </p>
                  </div>
                  <p
                    className={`text-3xl font-bold ${stats.oldest > 30 ? "text-warning-600 dark:text-warning-400" : "text-content dark:text-content-inverted"}`}
                  >
                    {stats.oldest > 0 ? `${stats.oldest}d` : "—"}
                  </p>
                  <p className="text-xs text-content-muted dark:text-content-subtle mt-1 font-medium">
                    {stats.oldest > 0 ? "needs attention" : "all current"}
                  </p>
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingUp className="w-4 h-4 text-success-400 dark:text-success-500" />
                    <p className="text-xs font-bold text-content-subtle dark:text-content-muted uppercase tracking-wider">
                      Recovered
                    </p>
                  </div>
                  <p className="text-3xl font-bold text-success-600 dark:text-success-400">
                    {formatCurrencyShort(stats.paidTotal)}
                  </p>
                  <p className="text-xs text-content-muted dark:text-content-subtle mt-1 font-medium">
                    all-time paid
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Search and Filter */}
          <div className="bg-surface dark:bg-surface-inverted rounded-xl border border-line-subtle dark:border-ink-800 p-4 shadow-sm">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1 relative group">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-content-subtle w-4 h-4 group-focus-within:text-content-body dark:group-focus-within:text-ink-300 transition-colors" />
                <Input
                  placeholder="Search by client or invoice number..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 h-11 border-line dark:border-ink-700 dark:bg-surface-inverted dark:text-content-inverted rounded-xl text-sm focus-visible:ring-2 focus-visible:ring-ink-200 dark:focus-visible:ring-ink-700"
                />
              </div>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <BucketTab
                label="All"
                count={chaseInvoices.length}
                active={bucketFilter === "all"}
                onClick={() => setBucketFilter("all")}
              />
              {bucketKeys.map((key) => (
                <BucketTab
                  key={key}
                  label={buckets[key].label}
                  count={buckets[key].count}
                  active={bucketFilter === key}
                  onClick={() => setBucketFilter(key)}
                />
              ))}
            </div>
          </div>

          {/* Body grid: list + sidebar */}
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
            <div className="space-y-6 min-w-0">
              <div className="bg-surface dark:bg-surface-inverted rounded-xl border border-line-subtle dark:border-ink-800 overflow-hidden shadow-sm">
                <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-line-subtle dark:border-ink-800">
                  <div className="min-w-0">
                    <h2 className="text-base font-black text-content dark:text-content-inverted">
                      Recovery Queue
                    </h2>
                    <p className="text-xs text-content-muted dark:text-content-subtle mt-0.5">
                      Sorted by how late, then how soon, then by amount
                    </p>
                  </div>
                  <span className="text-xs font-semibold text-content-body dark:text-content-subtle px-2.5 py-1 rounded-full bg-ink-100 dark:bg-ink-800">
                    {filteredList.length}
                  </span>
                </div>

                {filteredList.length === 0 ? (
                  <EmptyState
                    filterLabel={
                      bucketFilter === "all"
                        ? null
                        : buckets[bucketFilter]?.label
                    }
                    hasSearch={Boolean(searchTerm.trim())}
                    onClearFilters={() => {
                      setBucketFilter("all");
                      setSearchTerm("");
                    }}
                  />
                ) : (
                  <ul className="divide-y divide-line-subtle dark:divide-ink-800">
                    {filteredList.map((invoice) => (
                      <ChaseRow
                        key={invoice.id}
                        invoice={invoice}
                        isSequenceActive={Boolean(activeSequences[invoice.id])}
                        sequenceStarting={sequenceStarting === invoice.id}
                        onChase={() => openCompose(invoice)}
                        onSchedule={() => startSequence(invoice)}
                      />
                    ))}
                  </ul>
                )}
              </div>
            </div>

            <aside className="space-y-6 lg:sticky lg:top-6 lg:self-start">
              <SequencePanel
                activeCount={Object.keys(activeSequences).length}
              />
              <ActivityPanel reminders={reminders} />
            </aside>
          </div>

          <ComposeDialog
            composeChannel={composeChannel}
            composeDialog={composeDialog}
            composeTone={composeTone}
            copyToClipboard={copyToClipboard}
            draft={draft}
            regenerate={regenerate}
            sendReminder={sendReminder}
            sending={sending}
            setComposeChannel={setComposeChannel}
            setComposeDialog={setComposeDialog}
            setDraft={setDraft}
          />

          {toast && (
            <div
              className={`fixed bottom-24 left-1/2 z-50 max-w-[calc(100vw-2rem)] -translate-x-1/2 rounded-xl border px-4 py-3 text-sm font-semibold shadow-lg lg:bottom-6 ${
                toast.type === "error"
                  ? "border-danger-200 bg-danger-50 text-danger-800 dark:border-danger-900/60 dark:bg-danger-950/60 dark:text-danger-200"
                  : toast.type === "warning"
                    ? "border-warning-200 bg-warning-50 text-warning-900 dark:border-warning-900/60 dark:bg-warning-950/60 dark:text-warning-200"
                    : "border-line bg-surface text-content dark:border-ink-800 dark:bg-surface-inverted dark:text-content-inverted"
              }`}
              role="status"
            >
              {toast.message}
            </div>
          )}
        </div>
      </div>
    </PullToRefresh>
  );
}

/* ──────────────────────────────────────────────────────────────
 Subcomponents
 ────────────────────────────────────────────────────────────── */

const MOBILE_STAT_TONES = {
  emerald: {
    bg: "bg-success-50 dark:bg-success-900/30",
    icon: "text-success-600 dark:text-success-400",
    value: "text-content dark:text-content-inverted",
    emphasizedValue: "text-success-600 dark:text-success-400",
  },
  red: {
    bg: "bg-danger-50 dark:bg-danger-900/30",
    icon: "text-danger-600 dark:text-danger-400",
    value: "text-content dark:text-content-inverted",
    emphasizedValue: "text-danger-600 dark:text-danger-400",
  },
  amber: {
    bg: "bg-warning-50 dark:bg-warning-900/30",
    icon: "text-warning-600 dark:text-warning-400",
    value: "text-content dark:text-content-inverted",
    emphasizedValue: "text-warning-600 dark:text-warning-400",
  },
  blue: {
    bg: "bg-info-50 dark:bg-info-900/30",
    icon: "text-brand-700 dark:text-brand-400",
    value: "text-content dark:text-content-inverted",
    emphasizedValue: "text-brand-700 dark:text-brand-400",
  },
};

const MobileStat = ({ icon: Icon, tone, label, value, emphasize = false }) => {
  const t = MOBILE_STAT_TONES[tone] || MOBILE_STAT_TONES.emerald;
  return (
    <div className="bg-surface dark:bg-surface-inverted rounded-2xl border border-line-subtle dark:border-ink-800 p-4 shadow-sm">
      <div className="flex items-center gap-2 mb-2">
        <div
          className={`w-8 h-8 rounded-lg ${t.bg} flex items-center justify-center`}
        >
          <Icon className={`w-4 h-4 ${t.icon}`} />
        </div>
        <p className="text-xs font-semibold text-content-subtle dark:text-content-muted uppercase tracking-wider">
          {label}
        </p>
      </div>
      <p
        className={`text-xl font-bold ${emphasize ? t.emphasizedValue : t.value}`}
      >
        {value}
      </p>
    </div>
  );
};

const BucketTab = ({ label, count, active, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all active:scale-95 ${
      active
        ? "bg-success-600 text-content-inverted shadow-sm"
        : "bg-surface-sunken dark:bg-ink-800 text-ink-700 dark:text-ink-300 hover:bg-ink-100 dark:hover:bg-ink-700 border border-line-subtle dark:border-ink-700"
    }`}
  >
    <span>{label}</span>
    <span
      className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
        active
          ? "bg-surface/20 text-content-inverted"
          : "bg-surface dark:bg-surface-inverted text-content-body dark:text-content-subtle"
      }`}
    >
      {count}
    </span>
  </button>
);

const ChaseRow = ({
  invoice,
  isSequenceActive,
  sequenceStarting,
  onChase,
  onSchedule,
}) => {
  const method = getContactMethod(invoice);
  const isOverdue = invoice.daysOverdue > 0;
  const isHot = invoice.daysOverdue > 30;

  const indicator = isHot
    ? "bg-danger-500"
    : isOverdue
      ? "bg-warning-500"
      : "bg-brand-600";
  const pillClass = isHot
    ? "bg-danger-50 text-danger-700 dark:bg-danger-900/30 dark:text-danger-300"
    : isOverdue
      ? "bg-warning-50 text-warning-700 dark:bg-warning-900/30 dark:text-warning-300"
      : "bg-info-50 text-info-700 dark:bg-info-900/30 dark:text-info-300";
  // "Due soon" told you nothing about how soon, which is the one thing the
  // day-range chips filter on -- a row due in four days and one due in four
  // weeks read identically. The countdown makes the bucket a row landed in
  // legible from the row itself.
  const stateLabel = isOverdue
    ? `${invoice.daysOverdue}d overdue`
    : invoice.daysToDue === null
      ? "No due date"
      : invoice.daysToDue === 0
        ? "Due today"
        : `Due in ${invoice.daysToDue}d`;
  const StateIcon = isOverdue ? AlertCircle : Clock;

  return (
    <li className="group hover:bg-surface-sunken/70 dark:hover:bg-ink-800/40 transition-colors">
      <div className="flex items-stretch">
        <div className={`w-1 ${indicator}`} />
        <div className="flex-1 min-w-0 px-4 sm:px-5 py-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-5">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-black text-content dark:text-content-inverted text-sm sm:text-base truncate">
                  {invoice.client_name || "Unnamed client"}
                </h3>
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold ${pillClass}`}
                >
                  <StateIcon className="w-3 h-3" />
                  {stateLabel}
                </span>
                {isSequenceActive && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-success-50 text-success-700 dark:bg-success-900/30 dark:text-success-300">
                    <Bot className="w-3 h-3" />
                    Auto-pilot
                  </span>
                )}
              </div>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-medium text-content-muted dark:text-content-subtle">
                <span className="font-semibold text-ink-700 dark:text-ink-300">
                  {getInvoiceNumber(invoice)}
                </span>
                <span aria-hidden>·</span>
                <span>
                  Due{" "}
                  {dueDateOf(invoice)
                    ? format(dueDateOf(invoice), "MMM d")
                    : "—"}
                </span>
                <span aria-hidden>·</span>
                <span className="inline-flex items-center gap-1">
                  {method === "email" ? (
                    <>
                      <Mail className="w-3.5 h-3.5" />
                      Email ready
                    </>
                  ) : method === "sms" ? (
                    <>
                      <Phone className="w-3.5 h-3.5" />
                      SMS ready
                    </>
                  ) : (
                    <span className="text-warning-600 dark:text-warning-400 inline-flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5" />
                      Add contact
                    </span>
                  )}
                </span>
                <span aria-hidden>·</span>
                <span className="inline-flex items-center gap-1">
                  <CreditCard className="w-3.5 h-3.5" />
                  {invoice.payment_link ? "Pay link" : "Pay link on send"}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between sm:justify-end gap-3 sm:flex-shrink-0">
              <p className="font-bold text-content dark:text-content-inverted text-base sm:text-lg whitespace-nowrap tabular-nums">
                {formatCurrency(invoice.total)}
              </p>
              <div className="flex gap-2">
                <Button
                  onClick={onSchedule}
                  variant="outline"
                  disabled={
                    isSequenceActive || sequenceStarting || method === "missing"
                  }
                  className="h-9 px-3 text-xs font-semibold border-line dark:border-ink-700 dark:bg-ink-800 dark:text-ink-300 rounded-lg hover:bg-surface-sunken dark:hover:bg-ink-700 disabled:opacity-50"
                >
                  {sequenceStarting ? (
                    <Loader2 className="mr-1.5 w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <CalendarClock className="mr-1.5 w-3.5 h-3.5" />
                  )}
                  {isSequenceActive ? "Active" : "Auto"}
                </Button>
                <Button
                  onClick={onChase}
                  disabled={method === "missing"}
                  className="h-9 px-4 text-xs font-bold bg-brand hover:bg-brand-hover text-content-inverted rounded-lg shadow-sm disabled:opacity-50"
                >
                  <Send className="mr-1.5 w-3.5 h-3.5" />
                  Chase
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </li>
  );
};

const SequencePanel = ({ activeCount }) => (
  <section className="bg-surface dark:bg-surface-inverted rounded-xl border border-line-subtle dark:border-ink-800 overflow-hidden shadow-sm">
    <header className="flex items-start justify-between gap-3 px-5 py-4 border-b border-line-subtle dark:border-ink-800">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-success-50 dark:bg-success-900/30 flex items-center justify-center">
          <Bot className="w-4 h-4 text-success-600 dark:text-success-400" />
        </div>
        <div>
          <h2 className="text-base font-black text-content dark:text-content-inverted">
            Auto-pilot
          </h2>
          <p className="text-xs text-content-muted dark:text-content-subtle mt-0.5">
            Default reminder cadence
          </p>
        </div>
      </div>
      <span className="inline-flex items-center gap-1 rounded-full bg-success-50 dark:bg-success-900/30 px-2.5 py-1 text-[11px] font-bold text-success-700 dark:text-success-400">
        {activeCount} active
      </span>
    </header>

    <ol className="divide-y divide-line-subtle dark:divide-ink-800">
      {DEFAULT_SEQUENCE.map((step, index) => (
        <li
          key={`${step.day}-${step.channel}-${step.tone}`}
          className="flex items-center gap-3 px-5 py-3"
        >
          <span className="inline-flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-ink-100 dark:bg-ink-800 text-[11px] font-bold text-ink-700 dark:text-ink-300">
            {index + 1}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-content dark:text-content-inverted">
              Day {step.day}{" "}
              <span className="font-medium text-content-muted dark:text-content-subtle">
                · {step.label}
              </span>
            </p>
            <p className="truncate text-xs text-content-muted dark:text-content-subtle mt-0.5">
              {TONES[step.tone]?.label || step.tone}
            </p>
          </div>
          {step.channel === "email" ? (
            <Mail className="w-3.5 h-3.5 flex-shrink-0 text-content-subtle" />
          ) : (
            <MessageSquare className="w-3.5 h-3.5 flex-shrink-0 text-content-subtle" />
          )}
        </li>
      ))}
    </ol>
  </section>
);

const ActivityPanel = ({ reminders }) => (
  <section className="bg-surface dark:bg-surface-inverted rounded-xl border border-line-subtle dark:border-ink-800 overflow-hidden shadow-sm">
    <header className="flex items-center justify-between gap-3 px-5 py-4 border-b border-line-subtle dark:border-ink-800">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-info-50 dark:bg-info-900/30 flex items-center justify-center">
          <Clock className="w-4 h-4 text-brand-700 dark:text-brand-400" />
        </div>
        <div>
          <h2 className="text-base font-black text-content dark:text-content-inverted">
            Activity
          </h2>
          <p className="text-xs text-content-muted dark:text-content-subtle mt-0.5">
            Recent reminders
          </p>
        </div>
      </div>
    </header>

    {reminders.length === 0 ? (
      <div className="px-5 py-10 text-center">
        <div className="w-12 h-12 rounded-full bg-ink-100 dark:bg-ink-800 flex items-center justify-center mx-auto mb-3">
          <Clock className="w-5 h-5 text-content-subtle dark:text-content-muted" />
        </div>
        <p className="text-sm font-semibold text-ink-700 dark:text-ink-300">
          No reminders yet
        </p>
        <p className="text-xs text-content-muted dark:text-content-subtle mt-1">
          Send your first chase to see it here.
        </p>
      </div>
    ) : (
      <ul className="max-h-[420px] divide-y divide-line-subtle overflow-y-auto custom-scrollbar dark:divide-ink-800">
        {reminders.map((reminder) => {
          const sent = reminder.delivery_status === "sent";
          return (
            <li key={reminder.id} className="px-5 py-3.5">
              <div className="flex items-start gap-3">
                <div
                  className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl ${
                    sent
                      ? "bg-success-50 dark:bg-success-900/30"
                      : "bg-warning-50 dark:bg-warning-900/30"
                  }`}
                >
                  {reminder.channel === "email" ? (
                    <Mail
                      className={`w-4 h-4 ${sent ? "text-success-600 dark:text-success-400" : "text-warning-600 dark:text-warning-400"}`}
                    />
                  ) : (
                    <MessageSquare
                      className={`w-4 h-4 ${sent ? "text-success-600 dark:text-success-400" : "text-warning-600 dark:text-warning-400"}`}
                    />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-bold text-content dark:text-content-inverted">
                      {reminder.client_name}
                    </p>
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                        sent
                          ? "bg-success-50 text-success-700 dark:bg-success-900/30 dark:text-success-300"
                          : "bg-warning-50 text-warning-700 dark:bg-warning-900/30 dark:text-warning-300"
                      }`}
                    >
                      {reminder.delivery_status}
                    </span>
                  </div>
                  <p className="truncate text-xs font-medium text-content-muted dark:text-content-subtle mt-0.5">
                    {reminder.invoice_number} ·{" "}
                    {formatCurrency(reminder.amount)} · {reminder.tone}
                  </p>
                  <p className="mt-1 text-[11px] font-medium text-content-subtle dark:text-content-muted">
                    {format(new Date(reminder.sent_at), "MMM d, h:mm a")}
                  </p>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    )}
  </section>
);

const ComposeDialog = ({
  composeChannel,
  composeDialog,
  composeTone,
  copyToClipboard,
  draft,
  regenerate,
  sendReminder,
  sending,
  setComposeChannel,
  setComposeDialog,
  setDraft,
}) => {
  const invoice = composeDialog.invoice;
  const canEmail = Boolean(invoice?.client_email);
  const canSms = Boolean(invoice?.client_phone);
  const hasRecipient = composeChannel === "email" ? canEmail : canSms;

  return (
    <Dialog
      open={composeDialog.open}
      onOpenChange={(open) =>
        !open && setComposeDialog({ open: false, invoice: null })
      }
    >
      <DialogContent className="sm:max-w-2xl rounded-2xl border border-line dark:border-ink-700 bg-surface dark:bg-surface-inverted p-0 shadow-2xl">
        <header className="px-6 py-5 border-b border-line-subtle dark:border-ink-800">
          <DialogHeader className="flex-row items-center gap-4 space-y-0 text-left">
            <div className="w-12 h-12 rounded-2xl bg-success-600 flex items-center justify-center shadow-lg shadow-success-200 dark:shadow-success-900/30 flex-shrink-0">
              <Send className="w-5 h-5 text-content-inverted" />
            </div>
            <div className="min-w-0 flex-1">
              <DialogTitle className="text-lg font-bold text-content dark:text-content-inverted tracking-tight">
                Send Reminder
              </DialogTitle>
              <DialogDescription className="text-sm text-content-muted dark:text-content-subtle mt-0.5 truncate">
                {invoice ? (
                  <>
                    {invoice.client_name} · {getInvoiceNumber(invoice)} ·{" "}
                    <span className="font-semibold text-ink-700 dark:text-ink-300">
                      {formatCurrency(invoice.total)}
                    </span>
                    {invoice.daysOverdue > 0 && (
                      <span className="ml-1 text-warning-700 dark:text-warning-400 font-semibold">
                        · {invoice.daysOverdue}d overdue
                      </span>
                    )}
                  </>
                ) : (
                  "Draft a follow-up"
                )}
              </DialogDescription>
            </div>
          </DialogHeader>
        </header>

        <div className="space-y-5 px-5 py-5">
          {/* Tone */}
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wider text-content-muted dark:text-content-subtle">
              Tone
            </p>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(TONES).map(([key, tone]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => regenerate(key)}
                  className={`rounded-lg border px-3 py-2.5 text-left transition-colors ${
                    composeTone === key
                      ? "border-success-500 bg-success-50/50 dark:border-success-400 dark:bg-success-900/20"
                      : "border-line bg-surface hover:border-line-strong dark:border-ink-800 dark:bg-surface-inverted-deep dark:hover:border-ink-700"
                  }`}
                >
                  <p className="text-sm font-medium text-content dark:text-content-inverted">
                    {tone.label}
                  </p>
                  <p className="mt-0.5 line-clamp-2 text-xs text-content-muted dark:text-content-subtle">
                    {tone.description}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {/* Channel */}
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wider text-content-muted dark:text-content-subtle">
              Channel
            </p>
            <div className="inline-flex rounded-lg border border-line bg-surface-sunken p-0.5 dark:border-ink-800 dark:bg-surface-inverted-deep">
              <button
                type="button"
                onClick={() => setComposeChannel("email")}
                disabled={!canEmail}
                className={`inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                  composeChannel === "email"
                    ? "bg-surface text-content shadow-sm dark:bg-surface-inverted dark:text-content-inverted"
                    : "text-content-body dark:text-content-subtle"
                }`}
              >
                <Mail className="h-3.5 w-3.5" />
                Email
              </button>
              <button
                type="button"
                onClick={() => setComposeChannel("sms")}
                disabled={!canSms}
                className={`inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                  composeChannel === "sms"
                    ? "bg-surface text-content shadow-sm dark:bg-surface-inverted dark:text-content-inverted"
                    : "text-content-body dark:text-content-subtle"
                }`}
              >
                <MessageSquare className="h-3.5 w-3.5" />
                SMS
              </button>
            </div>
            {!canEmail && !canSms && (
              <p className="mt-2 text-xs text-warning-700 dark:text-warning-400">
                Add an email or phone to this client before sending.
              </p>
            )}
          </div>

          {/* Editor */}
          {composeChannel === "email" ? (
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-content-muted dark:text-content-subtle">
                  Subject
                </label>
                <Input
                  value={draft.subject}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      subject: event.target.value,
                    }))
                  }
                  className="h-10 rounded-lg border-line bg-surface text-sm dark:border-ink-800 dark:bg-surface-inverted-deep dark:text-content-inverted"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-content-muted dark:text-content-subtle">
                  Message
                </label>
                <Textarea
                  value={draft.body}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      body: event.target.value,
                    }))
                  }
                  rows={9}
                  className="rounded-lg border-line bg-surface text-sm leading-6 dark:border-ink-800 dark:bg-surface-inverted-deep dark:text-content-inverted"
                />
              </div>
              <p className="flex items-center gap-1.5 text-xs text-content-muted dark:text-content-subtle">
                <CreditCard className="h-3.5 w-3.5" />
                Payment link is appended automatically before send.
              </p>
            </div>
          ) : (
            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-content-muted dark:text-content-subtle">
                Message
              </label>
              <Textarea
                value={draft.sms}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    sms: event.target.value,
                  }))
                }
                rows={5}
                className="rounded-lg border-line bg-surface text-sm leading-6 dark:border-ink-800 dark:bg-surface-inverted-deep dark:text-content-inverted"
              />
              <p className="mt-1 text-xs text-content-muted dark:text-content-subtle">
                {draft.sms.length} characters
              </p>
            </div>
          )}
        </div>

        <footer className="flex flex-col-reverse gap-2 border-t border-line-subtle px-5 py-4 dark:border-ink-800 sm:flex-row sm:justify-end">
          <Button
            variant="outline"
            className="h-10 rounded-lg border-line text-sm font-medium dark:border-ink-800"
            onClick={() =>
              copyToClipboard(
                composeChannel === "email"
                  ? `${draft.subject}\n\n${draft.body}`
                  : draft.sms,
              )
            }
          >
            <Copy className="mr-2 h-4 w-4" />
            Copy
          </Button>
          <Button
            onClick={sendReminder}
            disabled={sending || !hasRecipient}
            className="h-10 rounded-lg bg-success-700 text-sm font-semibold text-content-inverted hover:bg-success-700 disabled:opacity-50"
          >
            {sending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Send className="mr-2 h-4 w-4" />
            )}
            {sending ? "Sending" : "Send reminder"}
          </Button>
        </footer>
      </DialogContent>
    </Dialog>
  );
};

/*
  Two different empty lists, and saying "All caught up" for both is a lie half
  the time. An account with nothing outstanding is caught up; an account whose
  queue is full but whose current filter matches none of it is not, and telling
  it that is how a working filter gets read as a broken one. Name the filter
  that emptied the list and offer the way back out of it.
*/
const EmptyState = ({ filterLabel, hasSearch, onClearFilters }) => {
  const isFiltered = Boolean(filterLabel) || hasSearch;

  return (
    <div className="text-center py-16 px-6">
      <div
        className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${
          isFiltered
            ? "bg-ink-100 dark:bg-ink-800"
            : "bg-success-50 dark:bg-success-900/30"
        }`}
      >
        {isFiltered ? (
          <Search className="w-8 h-8 text-content-muted dark:text-content-subtle" />
        ) : (
          <CheckCircle2 className="w-8 h-8 text-success-600 dark:text-success-400" />
        )}
      </div>
      <h3 className="text-lg font-black text-content dark:text-content-inverted mb-2">
        {isFiltered ? "Nothing in this view" : "All caught up"}
      </h3>
      <p className="text-sm text-content-muted dark:text-content-subtle mb-6">
        {!isFiltered
          ? "No outstanding invoices to chase."
          : filterLabel && hasSearch
            ? `No invoice matches "${filterLabel}" and that search.`
            : filterLabel
              ? `No invoice falls in "${filterLabel}" right now.`
              : "No invoice matches that search."}
      </p>
      {isFiltered ? (
        <Button
          variant="outline"
          onClick={onClearFilters}
          className="h-10 px-5 rounded-xl border-line dark:border-ink-700 text-sm font-semibold dark:bg-ink-800 dark:text-ink-300"
        >
          Show all invoices
        </Button>
      ) : (
        <Link to={createPageUrl("Invoices")}>
          <Button
            variant="outline"
            className="h-10 px-5 rounded-xl border-line dark:border-ink-700 text-sm font-semibold dark:bg-ink-800 dark:text-ink-300"
          >
            View all invoices
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </Link>
      )}
    </div>
  );
};
