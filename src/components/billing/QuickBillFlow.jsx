import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { sdk } from "@/api/sdk";
import { issuedPatch } from "@/lib/invoiceIssued";
import { InvokeLLM } from "@/integrations/Core";
import { LINE_ITEMS } from "@/lib/ai/schemas";
import { applyRequestedTotal } from "@/lib/ai/lineItems";
import { unscannableReason } from "@/lib/ai/schemas";
import { aiFailureMessage } from "@/lib/ai/failure";
import { format, addDays } from "date-fns";
import {
  Loader2,
} from "lucide-react";
import { generateQuotePDF } from "@/functions/generateQuotePDF";
import { generateInvoicePDF } from "@/functions/generateInvoicePDF";
import { moneyFormatter } from "@/lib/money";
import { SHELL_POSITION } from "@/components/billing/quickBill/shell";
import QuickBillDoneScreen from "@/components/billing/quickBill/QuickBillDoneScreen";
import QuickBillHeader from "@/components/billing/quickBill/QuickBillHeader";
import ClientStep from "@/components/billing/quickBill/ClientStep";
import DescribeStep from "@/components/billing/quickBill/DescribeStep";
import ReviewStep from "@/components/billing/quickBill/ReviewStep";
import QuickBillCta from "@/components/billing/quickBill/QuickBillCta";

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
  const formatMoney = moneyFormatter(settings?.currency, {
    maximumFractionDigits: 2,
  });

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
    // Not just "is it an image": HEIC is an image and the model cannot read
    // one, so it would upload, preview, and come back as an empty estimate.
    const reason = unscannableReason(file);
    if (reason) {
      setAiError(reason);
      e.target.value = "";
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
        // Private bucket (the default), and only file_url is used: this photo
        // is handed to the model and never written to a row, so the signed URL
        // is exactly the right lifetime for it.
        const upload = await sdk.integrations.Core.UploadFile({
          file: photoFile,
        });
        // Stop rather than carry on without it. UploadFile reports failure
        // instead of throwing, so this used to fall through with uploadedUrl
        // null: no photo reached the model, and it wrote a plausible invoice
        // from nothing while the contractor watched their photo in the preview.
        if (!upload?.success || !upload.file_url) {
          setAiError(
            `That photo could not be uploaded${upload?.error ? `: ${upload.error}` : ""}, so it was not read. Try again, or describe the job instead.`,
          );
          setAiLoading(false);
          return;
        }
        uploadedUrl = upload.file_url;
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

      // Same correction as CreateInvoice and CreateQuote: "honor them" in the
      // prompt above is a request, not a guarantee. Runs before the filter so a
      // scaled line is what gets kept.
      const items = applyRequestedTotal(response?.items || [], description)
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
            // Quote already carries its own date_issued and sets it elsewhere;
            // only the invoice branch needs stamping here.
            await updateFn(created.id, {
              status: "sent",
              ...(isQuote ? {} : issuedPatch(created)),
            });
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

  if (done) {
    return (
      <QuickBillDoneScreen
        didSend={didSend}
        formatMoney={formatMoney}
        isQuote={isQuote}
        newClientName={newClientName}
        selectedClient={selectedClient}
        totalAmount={totalAmount}
      />
    );
  }

  if (loading) {
    return (
      <div
        className={`${SHELL_POSITION} z-[60] bg-surface-sunken dark:bg-surface-inverted-deep flex items-center justify-center`}
      >
        <Loader2 className="w-7 h-7 text-success-600 animate-spin" />
      </div>
    );
  }

  return (
    /*
      Full-bleed backdrop, constrained column.

      This flow was built phone-first and the shell was `fixed inset-0 ... flex
      flex-col` -- no width limit. On a phone that is correct and is the whole
      point. On a desktop it stretched every control across the full viewport:
      at 1280px the client search box, the "Add new client" tile and the
      Continue button were each 1240px wide, which is why the Quote and Invoice
      shortcuts looked broken while every other page looked fine.

      The backdrop fills whatever SHELL_POSITION leaves it so the flow still
      covers the page behind it; only the content column is capped and centred.
      max-w-xl because the steps are a single column of stacked controls --
      widening it past a comfortable reading measure would not add information,
      just travel.
    */
    <div
      className={`${SHELL_POSITION} z-[60] bg-surface-sunken dark:bg-surface-inverted-deep flex justify-center`}
    >
      <div className="flex flex-col w-full max-w-xl sm:border-x sm:border-line/60 sm:dark:border-ink-800/60">
      <QuickBillHeader
        goBack={goBack}
        step={step}
      />

      {/* Sliding viewport */}
      <div className="flex-1 overflow-hidden relative">
        <div
          className="absolute inset-0 flex transition-transform duration-300 ease-out"
          style={{ transform: `translateX(-${step * 100}%)` }}
        >
          <ClientStep
            filteredClients={filteredClients}
            isQuote={isQuote}
            newClientEmail={newClientEmail}
            newClientName={newClientName}
            search={search}
            selectedClient={selectedClient}
            setNewClientEmail={setNewClientEmail}
            setNewClientName={setNewClientName}
            setSearch={setSearch}
            setSelectedClient={setSelectedClient}
            setShowNewClient={setShowNewClient}
            showNewClient={showNewClient}
          />

          <DescribeStep
            aiError={aiError}
            description={description}
            handleClearPhoto={handleClearPhoto}
            handlePhotoSelect={handlePhotoSelect}
            photoPreview={photoPreview}
            setDescription={setDescription}
          />

          <ReviewStep
            addBlankItem={addBlankItem}
            aiItems={aiItems}
            aiNotes={aiNotes}
            dueDate={dueDate}
            formatMoney={formatMoney}
            isQuote={isQuote}
            newClientEmail={newClientEmail}
            newClientName={newClientName}
            removeItem={removeItem}
            selectedClient={selectedClient}
            setDueDate={setDueDate}
            setStep={setStep}
            totalAmount={totalAmount}
            updateItem={updateItem}
          />
        </div>
      </div>

      <QuickBillCta
        aiItems={aiItems}
        aiLoading={aiLoading}
        canGenerate={canGenerate}
        creating={creating}
        formatMoney={formatMoney}
        goNext={goNext}
        handleGenerate={handleGenerate}
        handleSubmit={handleSubmit}
        hasClient={hasClient}
        isQuote={isQuote}
        newClientEmail={newClientEmail}
        photoFile={photoFile}
        photoUrl={photoUrl}
        selectedClient={selectedClient}
        sendStatus={sendStatus}
        step={step}
        totalAmount={totalAmount}
      />
      </div>
    </div>
  );
}
