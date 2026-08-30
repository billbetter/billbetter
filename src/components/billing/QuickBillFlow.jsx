import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { sdk } from "@/api/sdk";
import { InvokeLLM } from "@/integrations/Core";
import { LINE_ITEMS } from "@/lib/ai/schemas";
import { aiFailureMessage } from "@/lib/ai/failure";
import { format, addDays } from "date-fns";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Plus,
  Loader2,
  Search,
  X,
  Sparkles,
  Wand2,
  Lock,
  ShieldCheck,
  Camera,
  Upload,
  Trash2,
  Calendar as CalendarIcon,
  Send,
  Mail,
  MessageSquare,
} from "lucide-react";
import { generateQuotePDF } from "@/functions/generateQuotePDF";
import { generateInvoicePDF } from "@/functions/generateInvoicePDF";

const formatMoney = (n) =>
  Number(n || 0).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const initials = (name = "") =>
  name
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase() || "?";

export default function QuickBillFlow({ mode = "invoice" }) {
  const isQuote = mode === "quote";
  const navigate = useNavigate();

  const [step, setStep] = useState(0); // 0 = client, 1 = describe, 2 = checkout
  const [user, setUser] = useState(null);
  const [settings, setSettings] = useState(null);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [done, setDone] = useState(false);

  // Step 0 — client
  const [selectedClient, setSelectedClient] = useState(null);
  const [newClientName, setNewClientName] = useState("");
  const [newClientEmail, setNewClientEmail] = useState("");
  const [showNewClient, setShowNewClient] = useState(false);
  const [search, setSearch] = useState("");

  // Step 1 — describe (photo + description)
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [photoUrl, setPhotoUrl] = useState(null); // uploaded url cached
  const [description, setDescription] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");

  // Step 2 — items (AI-generated, editable)
  const [aiItems, setAiItems] = useState([]);
  const [aiNotes, setAiNotes] = useState("");
  const [dueDate, setDueDate] = useState(() =>
    format(addDays(new Date(), 30), "yyyy-MM-dd"),
  );
  const [sendStatus, setSendStatus] = useState("idle"); // idle | creating | sending | done-sent | done-draft
  const [didSend, setDidSend] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const u = await sdk.auth.me();
        setUser(u);
        const [c, s] = await Promise.all([
          sdk.entities.Client.filter({ user_id: u.id }, "-created_date", 50),
          sdk.entities.BusinessSettings.filter({ user_id: u.id }),
        ]);
        setClients(c || []);
        setSettings(s.length > 0 ? s[0] : null);
      } catch (e) {
        console.error("QuickBill load error:", e);
      }
      setLoading(false);
    })();
  }, []);

  // Cleanup blob URL on unmount or photo change
  useEffect(() => {
    return () => {
      if (photoPreview) URL.revokeObjectURL(photoPreview);
    };
  }, [photoPreview]);

  const filteredClients = useMemo(() => {
    if (!search.trim()) return clients;
    const q = search.toLowerCase();
    return clients.filter(
      (c) =>
        c.name?.toLowerCase().includes(q) || c.email?.toLowerCase().includes(q),
    );
  }, [clients, search]);

  const totalAmount = useMemo(
    () =>
      aiItems.reduce(
        (sum, item) =>
          sum +
          (Number(item.amount) ||
            (Number(item.quantity) || 0) * (Number(item.rate) || 0)),
        0,
      ),
    [aiItems],
  );

  const hasClient =
    !!selectedClient || (showNewClient && newClientName.trim().length > 0);
  const canGenerate = !!photoFile || description.trim().length > 0;

  // ----- Navigation -----
  const goBack = () => {
    if (creating || aiLoading) return;
    if (step === 0) {
      navigate(-1);
    } else {
      setStep((s) => s - 1);
    }
  };

  const goNext = () => {
    if (step === 0 && !hasClient) return;
    setStep((s) => Math.min(s + 1, 2));
  };

  // ----- Photo handlers -----
  const handlePhotoSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setAiError("That doesn't look like an image.");
      return;
    }
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
    setPhotoUrl(null);
    setAiError("");
    e.target.value = ""; // allow re-select of same file
  };

  const handleClearPhoto = () => {
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhotoFile(null);
    setPhotoPreview(null);
    setPhotoUrl(null);
  };

  // ----- AI generation -----
  const handleGenerate = async () => {
    if (!canGenerate || aiLoading) return;
    setAiLoading(true);
    setAiError("");
    try {
      let uploadedUrl = photoUrl;
      if (photoFile && !uploadedUrl) {
        const upload = await sdk.integrations.Core.UploadFile({
          file: photoFile,
        });
        uploadedUrl = upload?.file_url || null;
        setPhotoUrl(uploadedUrl);
      }

      const docNoun = isQuote ? "quote" : "invoice";
      const promptText = `You are an expert estimator helping a contractor build a ${docNoun}.${
        uploadedUrl ? " Carefully analyze the attached job-site photo." : ""
      }

${
  description
    ? `Contractor's description: "${description}"`
    : "There is no written description — work from the photo alone."
}

Produce 2-5 ${docNoun} line items that match the work. Use realistic 2025 US market rates. Each item must have:
- description: short professional name (3-6 words, e.g. "Pressure-treated 2x4", "Labor: framing")
- quantity: a number (units or hours)
- rate: per-unit price as a number, NOT pre-multiplied

CRITICAL RULES:
- quantity × rate = the line total. Do NOT pre-multiply.
- Labor lines: rate is $/hr, quantity is hours.
- Material lines: rate is per unit, quantity is units.
- If the contractor mentioned an exact total or specific prices, honor them.
- Keep it concise — split only when meaningful.

Also write a single short note (1 sentence max) summarizing the scope.

Return JSON only.`;

      const response = await InvokeLLM({
        prompt: promptText,
        ...(uploadedUrl && { file_urls: [uploadedUrl] }),
        response_json_schema: LINE_ITEMS,
      });

      const items = (response?.items || [])
        .map((it) => {
          const q = Number(it.quantity) || 0;
          const r = Number(it.rate) || 0;
          return {
            description: (it.description || "").trim() || "Service",
            quantity: q,
            rate: r,
            amount: q * r,
          };
        })
        .filter((it) => it.amount > 0);

      if (items.length === 0) {
        setAiError(
          "AI couldn't read that. Try a clearer description or photo.",
        );
      } else {
        setAiItems(items);
        setAiNotes((response?.notes || "").trim());
        setStep(2);
      }
    } catch (e) {
      console.error("AI generate error:", e);
      setAiError(aiFailureMessage(e, "this bill"));
    }
    setAiLoading(false);
  };

  // ----- Item editing on checkout -----
  const updateItem = (idx, field, value) => {
    setAiItems((items) =>
      items.map((it, i) => {
        if (i !== idx) return it;
        const next = { ...it, [field]: value };
        if (field === "quantity" || field === "rate") {
          next.amount = (Number(next.quantity) || 0) * (Number(next.rate) || 0);
        }
        return next;
      }),
    );
  };

  const removeItem = (idx) => {
    setAiItems((items) => items.filter((_, i) => i !== idx));
  };

  const addBlankItem = () => {
    setAiItems((items) => [
      ...items,
      { description: "", quantity: 1, rate: 0, amount: 0 },
    ]);
  };

  // ----- Submit (create + optionally send) -----
  const handleSubmit = async (sendNow = false) => {
    if (creating) return;
    if (aiItems.length === 0) {
      setAiError("Add at least one line item.");
      return;
    }
    setCreating(true);
    setSendStatus("creating");
    try {
      let client = selectedClient;
      if (!client) {
        client = await sdk.entities.Client.create({
          user_id: user.id,
          name: newClientName.trim(),
          email: newClientEmail.trim() || null,
        });
      }

      const total = Math.round(totalAmount * 100) / 100;
      const items = aiItems.map((it) => ({
        description: it.description,
        quantity: Number(it.quantity) || 0,
        rate: Number(it.rate) || 0,
        amount:
          Math.round(
            (Number(it.quantity) || 0) * (Number(it.rate) || 0) * 100,
          ) / 100,
      }));

      let created;
      let docNumber;
      if (isQuote) {
        docNumber = `${settings?.quote_prefix || "QTE"}-${Date.now()
          .toString()
          .slice(-6)}`;
        created = await sdk.entities.Quote.create({
          user_id: user.id,
          quote_number: docNumber,
          client_id: client.id,
          client_name: client.name,
          client_email: client.email || "",
          items,
          subtotal: total,
          tax_rate: 0,
          tax_amount: 0,
          total,
          date_issued: format(new Date(), "yyyy-MM-dd"),
          expiry_date: dueDate,
          notes: aiNotes || "This quote is valid until the expiry date shown.",
          status: "draft",
        });
      } else {
        docNumber = `${settings?.invoice_prefix || "INV"}-${Date.now()
          .toString()
          .slice(-6)}`;
        created = await sdk.entities.Invoice.create({
          user_id: user.id,
          invoice_number: docNumber,
          client_id: client.id,
          client_name: client.name,
          client_email: client.email || "",
          items,
          subtotal: total,
          tax_rate: 0,
          tax_amount: 0,
          total,
          due_date: dueDate,
          payment_terms: "",
          notes: aiNotes || "",
          status: "draft",
          delivery_method: "download",
        });
      }

      // Optional: send the document
      let sentSuccessfully = false;
      if (sendNow && (client.email || client.phone)) {
        setSendStatus("sending");
        try {
          // 1. Generate PDF
          let pdfUrl = null;
          try {
            const payload = isQuote
              ? {
                  quote: {
                    ...created,
                    quote_number: docNumber,
                    items,
                    total,
                    expiry_date: dueDate,
                  },
                  settings,
                }
              : {
                  invoice: {
                    ...created,
                    invoice_number: docNumber,
                    items,
                    total,
                    due_date: dueDate,
                  },
                  settings,
                };
            const pdfResponse = isQuote
              ? await generateQuotePDF(payload)
              : await generateInvoicePDF(payload);
            if (pdfResponse?.data?.pdf_url) {
              pdfUrl = pdfResponse.data.pdf_url;
              const updateFn = isQuote
                ? sdk.entities.Quote.update
                : sdk.entities.Invoice.update;
              await updateFn(created.id, {
                pdf_url: pdfUrl,
                pdf_generated_at: new Date().toISOString(),
              });
            }
          } catch (pdfErr) {
            console.error("PDF generation failed:", pdfErr);
          }

          // 2. Generate payment link (invoice only, requires Stripe connected)
          let paymentLink = null;
          if (!isQuote && settings?.stripe_account_status === "active") {
            try {
              const linkRes = await sdk.functions.invoke(
                "createInvoicePaymentLink",
                { invoice_id: created.id },
              );
              paymentLink = linkRes?.data?.payment_link || null;
            } catch (linkErr) {
              console.error("Payment link failed:", linkErr);
            }
          }

          // 3. Send via SMS / Email
          let smsOk = false;
          let emailOk = false;

          if (client.phone) {
            try {
              const smsFn = isQuote ? "sendQuoteSMS" : "sendInvoiceSMS";
              const smsPayload = isQuote
                ? {
                    quote_id: created.id,
                    client_phone: client.phone,
                    client_name: client.name,
                    quote_number: docNumber,
                    total,
                    pdf_url: pdfUrl,
                  }
                : {
                    invoice_id: created.id,
                    client_phone: client.phone,
                    client_name: client.name,
                    invoice_number: docNumber,
                    total,
                    payment_link: paymentLink,
                  };
              const smsRes = await sdk.functions.invoke(smsFn, smsPayload);
              smsOk = smsRes?.data?.success !== false;
            } catch (smsErr) {
              console.error("SMS failed:", smsErr);
            }
          }

          if (client.email) {
            try {
              const emailFn = isQuote ? "sendQuoteEmail" : "sendInvoiceEmail";
              const emailPayload = isQuote
                ? {
                    quote_id: created.id,
                    client_email: client.email,
                    client_name: client.name,
                    quote_number: docNumber,
                    total,
                    pdf_url: pdfUrl,
                    expiry_date: dueDate,
                    owner_id: user.id,
                  }
                : {
                    invoice_id: created.id,
                    client_email: client.email,
                    client_name: client.name,
                    invoice_number: docNumber,
                    total,
                    pdf_url: pdfUrl,
                    payment_link: paymentLink,
                  };
              const emailRes = await sdk.functions.invoke(
                emailFn,
                emailPayload,
              );
              emailOk = emailRes?.data?.success !== false;
            } catch (emailErr) {
              console.error("Email failed:", emailErr);
            }
          }

          if (smsOk || emailOk) {
            const updateFn = isQuote
              ? sdk.entities.Quote.update
              : sdk.entities.Invoice.update;
            await updateFn(created.id, { status: "sent" });
            sentSuccessfully = true;
          }
        } catch (sendErr) {
          console.error("Send pipeline error:", sendErr);
        }
      }

      setDidSend(sentSuccessfully);
      setSendStatus(sentSuccessfully ? "done-sent" : "done-draft");
      setDone(true);
      setTimeout(() => {
        const detailPage = isQuote ? "QuoteDetail" : "InvoiceDetail";
        navigate(createPageUrl(`${detailPage}?id=${created.id}`));
      }, 1500);
    } catch (e) {
      console.error("QuickBill create error:", e);
      // Include the server's reason. A bare "please try again" sent us chasing
      // the wrong code path for a round trip -- the real cause was a missing
      // column, which the message had already been told and then discarded.
      const detail = e?.message || e?.error_description || "";
      alert(
        `Couldn't create ${isQuote ? "quote" : "invoice"}.` +
          (detail ? `

Details: ${detail}` : " Please try again."),
      );
      setCreating(false);
      setSendStatus("idle");
    }
  };

  // ----- Done state -----
  if (done) {
    const clientName = selectedClient?.name || newClientName;
    const noun = isQuote ? "Quote" : "Invoice";
    const title = didSend ? `${noun} sent` : `${noun} saved`;
    const Icon = didSend ? Send : Check;
    return (
      <div className="fixed inset-0 z-[80] bg-surface dark:bg-surface-inverted-deep flex items-center justify-center px-6">
        <div className="flex flex-col items-center gap-6">
          <div className="relative">
            <div className="absolute inset-0 rounded-full bg-success-400/30 blur-2xl scale-150 animate-pulse" />
            <div className="relative w-24 h-24 rounded-full bg-success-500 flex items-center justify-center shadow-2xl shadow-success-300/50 dark:shadow-success-900/50">
              <Icon
                className="w-12 h-12 text-content-inverted"
                strokeWidth={2.5}
              />
            </div>
          </div>
          <div className="text-center">
            <h2 className="text-2xl font-bold text-content dark:text-content-inverted">
              {title}
            </h2>
            <p className="text-content-muted dark:text-content-subtle mt-1.5 text-base">
              {formatMoney(totalAmount)} · {clientName}
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="fixed inset-0 z-[60] bg-surface-sunken dark:bg-surface-inverted-deep flex items-center justify-center">
        <Loader2 className="w-7 h-7 text-success-600 animate-spin" />
      </div>
    );
  }

  const titleByStep = [
    "New " + (isQuote ? "quote" : "invoice"),
    "Describe the work",
    "Review",
  ];

  return (
    <div className="fixed inset-0 z-[60] bg-surface-sunken dark:bg-surface-inverted-deep flex flex-col">
      {/* Header */}
      <div
        className="flex items-center justify-between px-5 pb-3"
        style={{ paddingTop: "max(env(safe-area-inset-top), 1.25rem)" }}
      >
        <button
          onClick={goBack}
          className="w-11 h-11 rounded-full flex items-center justify-center bg-surface dark:bg-surface-inverted border border-line/80 dark:border-ink-800 shadow-sm active:scale-95 transition-transform"
          aria-label="Back"
        >
          <ArrowLeft className="w-5 h-5 text-ink-700 dark:text-ink-300" />
        </button>

        <div className="flex items-center gap-1.5">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i === step
                  ? "w-7 bg-success-500"
                  : i < step
                    ? "w-1.5 bg-success-500"
                    : "w-1.5 bg-ink-300 dark:bg-ink-700"
              }`}
            />
          ))}
        </div>

        <div className="w-11" />
      </div>

      {/* Sliding viewport */}
      <div className="flex-1 overflow-hidden relative">
        <div
          className="absolute inset-0 flex transition-transform duration-300 ease-out"
          style={{ transform: `translateX(-${step * 100}%)` }}
        >
          {/* ===== Step 0: Client ===== */}
          <div className="w-full flex-shrink-0 overflow-y-auto px-5 pb-6">
            <div className="flex items-center gap-2 mt-2">
              <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-widest text-success-600 dark:text-success-400">
                <Sparkles className="w-3 h-3" />
                AI {isQuote ? "Quote" : "Invoice"}
              </span>
            </div>
            <h1 className="text-3xl font-bold text-content dark:text-content-inverted tracking-tight mt-1">
              Who's it for?
            </h1>
            <p className="text-content-muted dark:text-content-subtle mt-1.5 text-base">
              Pick a client or add a new one.
            </p>

            {!showNewClient && (
              <>
                <div className="mt-5 relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-content-subtle" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search clients"
                    className="w-full h-14 pl-12 pr-4 rounded-2xl bg-surface dark:bg-surface-inverted border border-line dark:border-ink-800 text-base text-content dark:text-content-inverted placeholder:text-content-muted focus:outline-none focus:ring-2 focus:ring-success-500/20 focus:border-success-500 transition"
                  />
                </div>

                <button
                  onClick={() => {
                    setShowNewClient(true);
                    setSelectedClient(null);
                  }}
                  className="mt-3 w-full h-14 rounded-2xl border-2 border-dashed border-line-strong dark:border-ink-700 flex items-center justify-center gap-2 text-success-700 dark:text-success-400 font-semibold text-base active:scale-[0.99] hover:border-success-400 dark:hover:border-success-600 hover:bg-success-50/40 dark:hover:bg-success-900/10 transition"
                >
                  <Plus className="w-5 h-5" />
                  Add new client
                </button>

                <div className="mt-4 space-y-1.5">
                  {filteredClients.length === 0 && (
                    <div className="py-12 text-center text-content-subtle dark:text-content-muted">
                      <p className="text-sm">
                        {search
                          ? "No clients match your search"
                          : "No clients yet — add one above"}
                      </p>
                    </div>
                  )}
                  {filteredClients.map((c) => {
                    const isSelected = selectedClient?.id === c.id;
                    return (
                      <button
                        key={c.id}
                        onClick={() => setSelectedClient(c)}
                        className={`w-full flex items-center gap-3 p-3 rounded-2xl transition active:scale-[0.99] ${
                          isSelected
                            ? "bg-success-50 dark:bg-success-900/20 ring-2 ring-success-500"
                            : "bg-surface dark:bg-surface-inverted border border-line-subtle dark:border-ink-800 hover:bg-surface-sunken dark:hover:bg-ink-800/50"
                        }`}
                      >
                        <div
                          className={`w-11 h-11 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0 ${
                            isSelected
                              ? "bg-success-600 text-content-inverted"
                              : "bg-ink-100 dark:bg-ink-800 text-content-body dark:text-ink-300"
                          }`}
                        >
                          {initials(c.name)}
                        </div>
                        <div className="flex-1 text-left min-w-0">
                          <p className="font-semibold text-content dark:text-content-inverted text-base truncate">
                            {c.name}
                          </p>
                          {c.email && (
                            <p className="text-sm text-content-muted dark:text-content-subtle truncate">
                              {c.email}
                            </p>
                          )}
                        </div>
                        {isSelected && (
                          <Check className="w-5 h-5 text-success-600 flex-shrink-0" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </>
            )}

            {showNewClient && (
              <div className="mt-5 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs uppercase tracking-widest font-semibold text-content-subtle">
                    New client
                  </p>
                  <button
                    onClick={() => {
                      setShowNewClient(false);
                      setNewClientName("");
                      setNewClientEmail("");
                    }}
                    className="w-8 h-8 flex items-center justify-center rounded-full text-content-subtle active:bg-ink-100 dark:active:bg-ink-800"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <input
                  type="text"
                  value={newClientName}
                  onChange={(e) => setNewClientName(e.target.value)}
                  placeholder="Client name"
                  autoFocus
                  className="w-full h-14 px-4 rounded-2xl bg-surface dark:bg-surface-inverted border border-line dark:border-ink-800 text-base text-content dark:text-content-inverted placeholder:text-content-muted focus:outline-none focus:ring-2 focus:ring-success-500/20 focus:border-success-500 transition"
                />
                <input
                  type="email"
                  value={newClientEmail}
                  onChange={(e) => setNewClientEmail(e.target.value)}
                  placeholder="Email (optional)"
                  className="w-full h-14 px-4 rounded-2xl bg-surface dark:bg-surface-inverted border border-line dark:border-ink-800 text-base text-content dark:text-content-inverted placeholder:text-content-muted focus:outline-none focus:ring-2 focus:ring-success-500/20 focus:border-success-500 transition"
                />
              </div>
            )}
          </div>

          {/* ===== Step 1: Describe the work ===== */}
          <div className="w-full flex-shrink-0 overflow-y-auto px-5 pb-6">
            <div className="flex items-center gap-2 mt-2">
              <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-widest text-success-600 dark:text-success-400">
                <Sparkles className="w-3 h-3" />
                AI Builder
              </span>
            </div>
            <h1 className="text-3xl font-bold text-content dark:text-content-inverted tracking-tight mt-1">
              Describe the work
            </h1>
            <p className="text-content-muted dark:text-content-subtle mt-1.5 text-base">
              Snap a photo, write a sentence, or both. AI does the rest.
            </p>

            {/* Photo block */}
            <div className="mt-5">
              <p className="text-[11px] font-bold uppercase tracking-widest text-content-subtle mb-2">
                Photo
              </p>
              {photoPreview ? (
                <div className="relative rounded-2xl overflow-hidden bg-ink-100 dark:bg-surface-inverted border border-line dark:border-ink-800">
                  <img
                    src={photoPreview}
                    alt="Job"
                    className="w-full h-56 object-cover"
                  />
                  <button
                    onClick={handleClearPhoto}
                    className="absolute top-3 right-3 w-9 h-9 rounded-full bg-black/60 backdrop-blur-sm text-content-inverted flex items-center justify-center active:scale-95 transition"
                    aria-label="Remove photo"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2.5">
                  <label className="cursor-pointer">
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={handlePhotoSelect}
                      className="hidden"
                    />
                    <div className="h-28 rounded-2xl border-2 border-dashed border-line-strong dark:border-ink-700 bg-surface dark:bg-surface-inverted flex flex-col items-center justify-center gap-1.5 active:scale-[0.98] hover:border-success-400 dark:hover:border-success-600 hover:bg-success-50/40 dark:hover:bg-success-900/10 transition">
                      <Camera className="w-6 h-6 text-success-600 dark:text-success-400" />
                      <span className="text-xs font-semibold text-ink-700 dark:text-ink-300">
                        Take photo
                      </span>
                    </div>
                  </label>
                  <label className="cursor-pointer">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handlePhotoSelect}
                      className="hidden"
                    />
                    <div className="h-28 rounded-2xl border-2 border-dashed border-line-strong dark:border-ink-700 bg-surface dark:bg-surface-inverted flex flex-col items-center justify-center gap-1.5 active:scale-[0.98] hover:border-success-400 dark:hover:border-success-600 hover:bg-success-50/40 dark:hover:bg-success-900/10 transition">
                      <Upload className="w-6 h-6 text-success-600 dark:text-success-400" />
                      <span className="text-xs font-semibold text-ink-700 dark:text-ink-300">
                        Upload
                      </span>
                    </div>
                  </label>
                </div>
              )}
            </div>

            {/* Description */}
            <div className="mt-5">
              <p className="text-[11px] font-bold uppercase tracking-widest text-content-subtle mb-2">
                Description
              </p>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder='e.g. "Replaced 12 ft of rotted deck boards with pressure-treated lumber, 3 hours labor"'
                rows={4}
                className="w-full resize-none px-4 py-3 rounded-2xl bg-surface dark:bg-surface-inverted border border-line dark:border-ink-800 text-base text-content dark:text-content-inverted placeholder:text-content-muted focus:outline-none focus:ring-2 focus:ring-success-500/30 focus:border-success-500 transition"
              />
              <p className="mt-2 text-xs text-content-subtle dark:text-content-muted">
                The more detail (hours, materials, totals), the more accurate.
              </p>
            </div>

            {aiError && (
              <div className="mt-4 px-4 py-3 rounded-xl bg-danger-50 dark:bg-danger-900/20 border border-danger-100 dark:border-danger-900/40">
                <p className="text-sm text-danger-600 dark:text-danger-400">
                  {aiError}
                </p>
              </div>
            )}
          </div>

          {/* ===== Step 2: Checkout / Review ===== */}
          <div className="w-full flex-shrink-0 overflow-y-auto px-5 pb-6">
            <div className="flex items-center gap-2 mt-2">
              <span className="text-[11px] font-bold uppercase tracking-widest text-success-600 dark:text-success-400">
                {isQuote ? "Quote review" : "Checkout"}
              </span>
              <div className="flex items-center gap-1 text-[11px] text-content-subtle">
                <Lock className="w-3 h-3" />
                Secure draft
              </div>
            </div>
            <h1 className="text-3xl font-bold text-content dark:text-content-inverted tracking-tight mt-1">
              {isQuote ? "Send quote" : "Send invoice"}
            </h1>

            {/* Total card */}
            <div className="mt-5 rounded-3xl bg-success-700 p-6 text-content-inverted shadow-xl shadow-success-200/50 dark:shadow-success-900/30 relative overflow-hidden">
              <div className="absolute -top-12 -right-12 w-40 h-40 rounded-full bg-surface/10 blur-2xl dark:bg-surface-inverted/10" />
              <div className="absolute -bottom-16 -left-12 w-44 h-44 rounded-full bg-accent-300/20 blur-2xl" />
              <div className="relative">
                <p className="text-[11px] font-bold uppercase tracking-widest text-success-100">
                  {isQuote ? "Estimate total" : "Total due"}
                </p>
                <p className="mt-2 text-5xl font-bold tracking-tight tabular-nums leading-none">
                  {formatMoney(totalAmount)}
                </p>
                <label className="mt-4 flex items-center justify-between text-sm gap-3 cursor-pointer group/date">
                  <span className="text-success-50/80 flex items-center gap-1.5">
                    <CalendarIcon className="w-3.5 h-3.5" />
                    {isQuote ? "Valid through" : "Due date"}
                  </span>
                  <span className="relative">
                    <span className="font-semibold text-content-inverted underline decoration-success-200/40 underline-offset-4 group-hover/date:decoration-white transition">
                      {dueDate
                        ? format(new Date(dueDate + "T00:00:00"), "MMM d, yyyy")
                        : "Pick a date"}
                    </span>
                    <input
                      type="date"
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                      min={format(new Date(), "yyyy-MM-dd")}
                      className="absolute inset-0 opacity-0 cursor-pointer w-full"
                      aria-label={isQuote ? "Expiry date" : "Due date"}
                    />
                  </span>
                </label>

                {/* Quick date presets */}
                <div className="mt-3 flex gap-1.5 flex-wrap">
                  {[7, 14, 30, 60].map((days) => {
                    const presetDate = format(
                      addDays(new Date(), days),
                      "yyyy-MM-dd",
                    );
                    const isActive = dueDate === presetDate;
                    return (
                      <button
                        key={days}
                        type="button"
                        onClick={() => setDueDate(presetDate)}
                        className={`px-2.5 py-1 rounded-full text-[11px] font-semibold transition ${
                          isActive
                            ? "bg-surface text-success-700"
                            : "bg-surface/15 text-content-inverted hover:bg-surface/25"
                        }`}
                      >
                        {days}d
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Line items */}
            <div className="mt-4 rounded-2xl bg-surface dark:bg-surface-inverted border border-line-subtle dark:border-ink-800 overflow-hidden">
              <div className="px-4 py-3 border-b border-line-subtle dark:border-ink-800 flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-widest text-content-subtle">
                  Line items
                </span>
                <button
                  onClick={() => setStep(1)}
                  className="text-xs font-semibold text-success-600 dark:text-success-400 active:opacity-60"
                >
                  Regenerate
                </button>
              </div>
              <div className="divide-y divide-line-subtle dark:divide-ink-800">
                {aiItems.map((item, idx) => (
                  <div key={idx} className="p-4 space-y-2.5">
                    <div className="flex items-start gap-2">
                      <input
                        type="text"
                        value={item.description}
                        onChange={(e) =>
                          updateItem(idx, "description", e.target.value)
                        }
                        className="flex-1 bg-transparent text-sm font-semibold text-content dark:text-content-inverted focus:outline-none"
                        placeholder="Description"
                      />
                      <button
                        onClick={() => removeItem(idx)}
                        className="w-7 h-7 flex items-center justify-center rounded-full text-ink-300 active:bg-danger-50 active:text-danger-500 dark:active:bg-danger-900/20 transition"
                        aria-label="Remove item"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <input
                        type="number"
                        inputMode="decimal"
                        step="0.5"
                        value={item.quantity}
                        onChange={(e) =>
                          updateItem(
                            idx,
                            "quantity",
                            parseFloat(e.target.value) || 0,
                          )
                        }
                        className="w-16 h-9 px-2 rounded-lg bg-surface-sunken dark:bg-ink-800 border border-line-subtle dark:border-ink-700 text-center tabular-nums focus:outline-none focus:ring-1 focus:ring-success-500"
                      />
                      <span className="text-content-subtle">×</span>
                      <div className="relative flex-1 max-w-[110px]">
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-content-subtle text-sm">
                          $
                        </span>
                        <input
                          type="number"
                          inputMode="decimal"
                          step="0.01"
                          value={item.rate}
                          onChange={(e) =>
                            updateItem(
                              idx,
                              "rate",
                              parseFloat(e.target.value) || 0,
                            )
                          }
                          className="w-full h-9 pl-5 pr-2 rounded-lg bg-surface-sunken dark:bg-ink-800 border border-line-subtle dark:border-ink-700 tabular-nums focus:outline-none focus:ring-1 focus:ring-success-500"
                        />
                      </div>
                      <span className="ml-auto text-sm font-bold text-content dark:text-content-inverted tabular-nums">
                        {formatMoney(item.amount)}
                      </span>
                    </div>
                  </div>
                ))}
                <button
                  onClick={addBlankItem}
                  className="w-full px-4 py-3 text-sm font-semibold text-success-600 dark:text-success-400 flex items-center justify-center gap-1.5 active:bg-surface-sunken dark:active:bg-ink-800/50 transition"
                >
                  <Plus className="w-4 h-4" />
                  Add line item
                </button>
              </div>
              <div className="px-4 py-3 border-t border-line-subtle dark:border-ink-800 flex items-center justify-between bg-surface-sunken/60 dark:bg-ink-800/30">
                <span className="text-sm font-bold text-content dark:text-content-inverted">
                  Total
                </span>
                <span className="text-base font-bold text-content dark:text-content-inverted tabular-nums">
                  {formatMoney(totalAmount)}
                </span>
              </div>
            </div>

            {/* AI notes */}
            {aiNotes && (
              <div className="mt-3 px-4 py-3 rounded-xl bg-success-50 dark:bg-success-900/20 border border-success-100 dark:border-success-900/40">
                <p className="text-[11px] font-bold uppercase tracking-widest text-success-700 dark:text-success-300 mb-1">
                  AI note
                </p>
                <p className="text-sm text-success-900 dark:text-success-100">
                  {aiNotes}
                </p>
              </div>
            )}

            {/* Bill-to */}
            <button
              onClick={() => setStep(0)}
              className="mt-3 w-full rounded-2xl bg-surface dark:bg-surface-inverted border border-line-subtle dark:border-ink-800 p-4 flex items-center gap-3 active:bg-surface-sunken dark:active:bg-ink-800/50 transition text-left"
            >
              <div className="w-11 h-11 rounded-full bg-ink-100 dark:bg-ink-800 flex items-center justify-center font-bold text-sm text-content-body dark:text-ink-300 flex-shrink-0">
                {initials(selectedClient?.name || newClientName)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-bold uppercase tracking-widest text-content-subtle">
                  {isQuote ? "Quote for" : "Bill to"}
                </p>
                <p className="font-semibold text-content dark:text-content-inverted truncate">
                  {selectedClient?.name || newClientName}
                </p>
                {(selectedClient?.email || newClientEmail) && (
                  <p className="text-xs text-content-muted dark:text-content-subtle truncate">
                    {selectedClient?.email || newClientEmail}
                  </p>
                )}
              </div>
              <ArrowRight className="w-4 h-4 text-ink-300 flex-shrink-0" />
            </button>

            <div className="mt-4 flex items-center justify-center gap-1.5 text-[11px] text-content-subtle dark:text-content-muted">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Saved as draft · You can edit before sending</span>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom CTA */}
      <div
        className="px-5 pt-3 bg-surface-sunken dark:bg-ink-800"
        style={{ paddingBottom: "max(env(safe-area-inset-bottom), 1.25rem)" }}
      >
        {step === 0 && (
          <button
            onClick={goNext}
            disabled={!hasClient}
            className="w-full h-14 rounded-2xl bg-success-700 text-content-inverted font-bold text-base disabled:bg-ink-200 dark:disabled:bg-ink-800 disabled:text-content-subtle disabled:shadow-none active:scale-[0.98] transition shadow-lg shadow-success-300/40 dark:shadow-success-900/30 flex items-center justify-center gap-2"
          >
            Continue
            <ArrowRight className="w-5 h-5" />
          </button>
        )}

        {step === 1 && (
          <button
            onClick={handleGenerate}
            disabled={!canGenerate || aiLoading}
            className="w-full h-14 rounded-2xl bg-success-700 text-content-inverted font-bold text-base disabled:text-content-subtle disabled:shadow-none active:scale-[0.98] transition shadow-lg shadow-success-300/40 dark:shadow-success-900/30 flex items-center justify-center gap-2"
          >
            {aiLoading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                {photoFile && !photoUrl
                  ? "Uploading photo..."
                  : "Reading the job..."}
              </>
            ) : (
              <>
                <Wand2 className="w-5 h-5" />
                Generate with AI
              </>
            )}
          </button>
        )}

        {step === 2 &&
          (() => {
            const clientForSend = selectedClient || {
              email: newClientEmail,
              phone: null,
            };
            const canSend = !!(clientForSend.email || clientForSend.phone);
            const channelText =
              clientForSend.email && clientForSend.phone
                ? "email + SMS"
                : clientForSend.email
                  ? "email"
                  : clientForSend.phone
                    ? "SMS"
                    : "";

            if (creating) {
              const label =
                sendStatus === "sending"
                  ? `Sending via ${channelText || "email"}...`
                  : `Creating ${isQuote ? "quote" : "invoice"}...`;
              return (
                <button
                  disabled
                  className="w-full h-14 rounded-2xl bg-success-700 text-content-inverted font-bold text-base shadow-lg shadow-success-300/40 dark:shadow-success-900/30 flex items-center justify-center gap-2 opacity-90"
                >
                  <Loader2 className="w-5 h-5 animate-spin" />
                  {label}
                </button>
              );
            }

            return (
              <div className="space-y-2">
                <button
                  onClick={() => handleSubmit(canSend)}
                  disabled={aiItems.length === 0}
                  className="w-full h-14 rounded-2xl bg-success-700 text-content-inverted font-bold text-base active:scale-[0.98] transition shadow-lg shadow-success-300/40 dark:shadow-success-900/30 flex items-center justify-between px-5 disabled:opacity-60"
                >
                  <span className="flex items-center gap-2">
                    {canSend ? (
                      <Send className="w-5 h-5" strokeWidth={2.5} />
                    ) : (
                      <Check className="w-5 h-5" strokeWidth={3} />
                    )}
                    {canSend
                      ? `Send ${isQuote ? "quote" : "invoice"}`
                      : `Save ${isQuote ? "quote" : "invoice"}`}
                  </span>
                  <span className="font-bold tabular-nums">
                    {formatMoney(totalAmount)}
                  </span>
                </button>

                {canSend ? (
                  <div className="flex items-center justify-center gap-3">
                    <div className="flex items-center gap-1 text-[11px] text-content-muted dark:text-content-subtle">
                      {clientForSend.email && (
                        <span className="inline-flex items-center gap-1">
                          <Mail className="w-3 h-3" />
                          Email
                        </span>
                      )}
                      {clientForSend.email && clientForSend.phone && (
                        <span className="text-ink-300 dark:text-content-body dark:dark:text-ink-300">
                          ·
                        </span>
                      )}
                      {clientForSend.phone && (
                        <span className="inline-flex items-center gap-1">
                          <MessageSquare className="w-3 h-3" />
                          SMS
                        </span>
                      )}
                    </div>
                    <span className="text-ink-300 dark:text-content-body text-[11px] dark:dark:text-ink-300">
                      |
                    </span>
                    <button
                      onClick={() => handleSubmit(false)}
                      className="text-[11px] font-semibold text-content-muted dark:text-content-subtle active:text-success-600 transition"
                    >
                      Save as draft
                    </button>
                  </div>
                ) : (
                  <p className="text-center text-[11px] text-content-subtle dark:text-content-muted">
                    Add an email or phone to the client to send automatically
                  </p>
                )}
              </div>
            );
          })()}
      </div>
    </div>
  );
}
