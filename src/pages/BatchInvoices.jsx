/**
 * Raise many invoices at once: from a list of clients, or from a spreadsheet.
 *
 * -- Why both doors lead to the same room ----------------------------------
 *
 * Picking six clients and applying a maintenance line, and uploading a CSV a
 * bookkeeper exported, are the same job with different inputs. Both produce a
 * `plan` (see src/lib/invoiceImport.js) and both hand it to the same review
 * table and the same creation path -- so the validation, the money, the client
 * matching and the numbering exist once. Two paths would be two sets of rules
 * that agree until the day they do not.
 *
 * -- Nothing is created until the review screen ---------------------------
 *
 * The plan is worked out in the browser and shown in full first: every
 * prospective invoice, its client, its total, and what is wrong with it if
 * anything. Creating thirty invoices is easy to do and tedious to undo -- there
 * is no batch delete -- so the screen that commits is deliberately a second
 * screen.
 *
 * Everything is created as a DRAFT and nothing is sent. Sending is the batch
 * send that already exists on the Invoices page, which is a separate decision
 * with its own confirmation.
 */

import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { sdk } from "@/api/sdk";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  FileSpreadsheet,
  Loader2,
  Plus,
  Trash2,
  Upload,
  Users,
} from "lucide-react";
import { isUnlimited } from "@/components/utils/permissions";
import {
  IMPORT_FIELDS,
  allocateInvoiceNumbers,
  buildImportPlan,
  buildPlanFromClients,
  createInvoiceBatch,
  detectDelimiter,
  guessColumnMapping,
  looksLikeHeaderRow,
  parseDelimited,
} from "@/lib/invoiceImport";

const money = (n) =>
  `$${Number(n || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const EMPTY_ITEM = { description: "", quantity: "1", rate: "" };

export default function BatchInvoices() {
  const navigate = useNavigate();

  const [mode, setMode] = useState("clients"); // 'clients' | 'import'
  const [step, setStep] = useState("source"); // 'source' | 'review' | 'done'

  const [user, setUser] = useState(null);
  const [clients, setClients] = useState([]);
  const [settings, setSettings] = useState(null);
  const [subscription, setSubscription] = useState(null);
  const [existingNumbers, setExistingNumbers] = useState([]);
  const [loading, setLoading] = useState(true);

  // -- Pick-clients mode
  const [search, setSearch] = useState("");
  const [chosenIds, setChosenIds] = useState(() => new Set());
  const [items, setItems] = useState([{ ...EMPTY_ITEM }]);
  const [dueDate, setDueDate] = useState("");
  const [taxRate, setTaxRate] = useState("");
  const [notes, setNotes] = useState("");

  // -- Import mode
  const [rawText, setRawText] = useState("");
  const [fileName, setFileName] = useState("");
  const [mapping, setMapping] = useState({});
  const [hasHeader, setHasHeader] = useState(true);
  const [parseError, setParseError] = useState("");

  // -- Review / run
  const [createMissingClients, setCreateMissingClients] = useState(true);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [outcome, setOutcome] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const me = await sdk.auth.me();
        setUser(me);
        const [clientRows, settingRows, subRows, invoiceRows] = await Promise.all([
          sdk.entities.Client.filter({ user_id: me.id }).catch(() => []),
          sdk.entities.BusinessSettings.filter({ user_id: me.id }).catch(() => []),
          sdk.entities.Subscription.filter({ user_id: me.id }).catch(() => []),
          // Only for the numbering: a batch must not reuse a number that is
          // already on an invoice. Cheap -- list() drops pdf_url.
          sdk.entities.Invoice.filter({ user_id: me.id }).catch(() => []),
        ]);
        setClients(clientRows || []);
        setSettings(settingRows?.[0] || null);
        setSubscription(subRows?.[0] || null);
        setExistingNumbers((invoiceRows || []).map((i) => i.invoice_number).filter(Boolean));
      } catch (err) {
        console.error("Could not load batch data:", err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // ---- Parsing the pasted / uploaded text -------------------------------

  const parsed = useMemo(() => {
    if (mode !== "import" || !rawText.trim()) return null;
    try {
      const rows = parseDelimited(rawText);
      if (!rows.length) return null;
      return { rows, delimiter: detectDelimiter(rawText) };
    } catch (err) {
      return { rows: [], error: err?.message || "Could not read that file" };
    }
  }, [mode, rawText]);

  // The header guess is offered once and then left alone, so a user who
  // corrects a column mapping does not have it overwritten on the next render.
  useEffect(() => {
    if (!parsed?.rows?.length) return;
    const first = parsed.rows[0];
    const isHeader = looksLikeHeaderRow(first);
    setHasHeader(isHeader);
    setMapping(isHeader ? guessColumnMapping(first) : {});
  }, [parsed?.rows]);

  const headers = parsed?.rows?.[0] || [];
  const dataRows = useMemo(
    () => (parsed?.rows ? (hasHeader ? parsed.rows.slice(1) : parsed.rows) : []),
    [parsed?.rows, hasHeader],
  );

  const plan = useMemo(() => {
    if (mode === "import") {
      if (!dataRows.length) return null;
      return buildImportPlan(dataRows, mapping, { clients, settings });
    }
    const picked = clients.filter((c) => chosenIds.has(c.id));
    if (!picked.length) return null;
    return buildPlanFromClients(
      picked,
      {
        items: items.map((i) => ({
          description: i.description,
          quantity: Number(i.quantity) || 0,
          rate: Number(i.rate) || 0,
        })),
        tax_rate: taxRate === "" ? undefined : Number(taxRate),
        due_date: dueDate || null,
        notes,
      },
      { settings },
    );
  }, [mode, dataRows, mapping, clients, settings, chosenIds, items, taxRate, dueDate, notes]);

  // Only meaningful when importing. `mapping` is empty in pick-clients mode --
  // there are no columns to map -- so computing this unconditionally made every
  // required field look unmapped and left the Review button permanently
  // disabled on that half of the screen.
  const missingRequired =
    mode === "import"
      ? IMPORT_FIELDS.filter((f) => f.required && mapping[f.key] === undefined)
      : [];

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setParseError("");
    try {
      const text = await file.text();
      setRawText(text);
      setFileName(file.name);
    } catch (err) {
      setParseError(err?.message || "Could not read that file");
    }
    e.target.value = "";
  };

  const filteredClients = clients.filter((c) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      String(c.name || "").toLowerCase().includes(q) ||
      String(c.email || "").toLowerCase().includes(q)
    );
  });

  const toggleClient = (id) => {
    setChosenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const setItem = (index, patch) =>
    setItems((prev) => prev.map((it, i) => (i === index ? { ...it, ...patch } : it)));

  // ---- Creating ---------------------------------------------------------

  const run = async () => {
    if (!plan || !user) return;
    setRunning(true);
    setProgress(0);

    const ready = plan.invoices.filter((i) => i.ok);
    // Allocated for the WHOLE batch up front. The per-invoice scheme is
    // `${prefix}-${Date.now().slice(-6)}`, and thirty invoices created in a
    // loop can land in the same millisecond and all get the same number.
    const numbers = allocateInvoiceNumbers(
      settings?.invoice_prefix || "INV",
      ready.length,
      existingNumbers,
    );

    const summary = await createInvoiceBatch(
      plan,
      {
        userId: user.id,
        invoiceNumbers: numbers,
        createMissingClients,
        createInvoice: (payload) => sdk.entities.Invoice.create(payload),
        createClient: (payload) => sdk.entities.Client.create(payload),
      },
      (done) => setProgress(done),
    );

    // Usage is counted the same way CreateInvoice counts it, so a batch is not
    // a free way past the monthly allowance. Nothing is BLOCKED here -- this is
    // bookkeeping, not enforcement.
    try {
      if (summary.created > 0 && subscription && !isUnlimited(subscription)) {
        await sdk.entities.Subscription.update(subscription.id, {
          transactions_used_this_month:
            (subscription.transactions_used_this_month || 0) + summary.created,
          invoices_used_this_month:
            (subscription.invoices_used_this_month || 0) + summary.created,
        });
      }
    } catch (err) {
      // A counter that failed to move must not make created invoices look
      // like they failed.
      console.error("Could not update usage counters:", err);
    }

    setOutcome(summary);
    setStep("done");
    setRunning(false);
  };

  // ---- Render -----------------------------------------------------------

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-surface-sunken dark:bg-surface-inverted-deep">
        <Loader2 className="w-8 h-8 animate-spin text-brand-700 dark:text-brand-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-sunken dark:bg-surface-inverted-deep p-4 sm:p-6 lg:p-8">
      <div className="max-w-5xl mx-auto">
        <Button
          variant="ghost"
          onClick={() => (step === "source" ? navigate(createPageUrl("Invoices")) : setStep("source"))}
          className="mb-4 text-ink-700 dark:text-ink-200"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          {step === "source" ? "Back to Invoices" : "Back"}
        </Button>

        <h1 className="text-3xl font-black text-content dark:text-content-inverted mb-1">
          Batch invoices
        </h1>
        <p className="text-content-body dark:text-ink-300 mb-6">
          Raise several at once. Everything is created as a draft — nothing is
          sent until you send it.
        </p>

        {step === "source" && (
          <>
            {/* Which door */}
            <div className="grid sm:grid-cols-2 gap-3 mb-6">
              <button
                onClick={() => setMode("clients")}
                className={`text-left p-4 rounded-xl border-2 transition-all ${
                  mode === "clients"
                    ? "border-brand bg-brand-50 dark:bg-brand-900/20"
                    : "border-line dark:border-ink-700 bg-surface dark:bg-surface-inverted hover:border-line-strong"
                }`}
              >
                <Users className="w-5 h-5 mb-2 text-brand-700 dark:text-brand-400" />
                <p className="font-bold text-content dark:text-content-inverted">Pick clients</p>
                <p className="text-sm text-content-muted dark:text-content-subtle mt-0.5">
                  The same line items billed to several clients at once.
                </p>
              </button>
              <button
                onClick={() => setMode("import")}
                className={`text-left p-4 rounded-xl border-2 transition-all ${
                  mode === "import"
                    ? "border-brand bg-brand-50 dark:bg-brand-900/20"
                    : "border-line dark:border-ink-700 bg-surface dark:bg-surface-inverted hover:border-line-strong"
                }`}
              >
                <FileSpreadsheet className="w-5 h-5 mb-2 text-brand-700 dark:text-brand-400" />
                <p className="font-bold text-content dark:text-content-inverted">
                  Import a spreadsheet
                </p>
                <p className="text-sm text-content-muted dark:text-content-subtle mt-0.5">
                  A CSV from Excel, Sheets or Numbers.
                </p>
              </button>
            </div>

            {mode === "clients" ? (
              <div className="space-y-6">
                <section className="bg-surface dark:bg-surface-inverted rounded-xl border border-line dark:border-ink-700 p-4 sm:p-5">
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="font-bold text-content dark:text-content-inverted">
                      Who is being billed
                    </h2>
                    <span className="text-sm text-content-muted dark:text-content-subtle">
                      {chosenIds.size} selected
                    </span>
                  </div>
                  <Input
                    placeholder="Search clients…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="mb-3 h-11"
                  />
                  {clients.length === 0 ? (
                    <p className="text-sm text-content-muted dark:text-content-subtle py-6 text-center">
                      No clients yet.{" "}
                      <Link className="underline" to={createPageUrl("Clients")}>
                        Add one first
                      </Link>
                      , or import a spreadsheet.
                    </p>
                  ) : (
                    <div className="max-h-72 overflow-y-auto divide-y divide-line-subtle dark:divide-ink-700">
                      {filteredClients.map((c) => (
                        <label
                          key={c.id}
                          className="flex items-center gap-3 py-2.5 cursor-pointer"
                        >
                          <Checkbox
                            checked={chosenIds.has(c.id)}
                            onCheckedChange={() => toggleClient(c.id)}
                          />
                          <span className="min-w-0">
                            <span className="block font-medium text-content dark:text-content-inverted truncate">
                              {c.name}
                            </span>
                            <span className="block text-xs text-content-muted dark:text-content-subtle truncate">
                              {c.email || "No email on file"}
                            </span>
                          </span>
                        </label>
                      ))}
                    </div>
                  )}
                </section>

                <section className="bg-surface dark:bg-surface-inverted rounded-xl border border-line dark:border-ink-700 p-4 sm:p-5">
                  <h2 className="font-bold text-content dark:text-content-inverted mb-1">
                    What they are being billed for
                  </h2>
                  <p className="text-sm text-content-muted dark:text-content-subtle mb-4">
                    These lines go on every invoice in the batch.
                  </p>
                  {items.map((it, i) => (
                    <div key={i} className="flex flex-col sm:flex-row gap-2 mb-2">
                      <Input
                        placeholder="Description"
                        value={it.description}
                        onChange={(e) => setItem(i, { description: e.target.value })}
                        className="flex-1 h-11"
                      />
                      <Input
                        placeholder="Qty"
                        inputMode="decimal"
                        value={it.quantity}
                        onChange={(e) => setItem(i, { quantity: e.target.value })}
                        className="sm:w-24 h-11"
                      />
                      <Input
                        placeholder="Rate"
                        inputMode="decimal"
                        value={it.rate}
                        onChange={(e) => setItem(i, { rate: e.target.value })}
                        className="sm:w-32 h-11"
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-11 w-11 text-danger-600 dark:text-danger-400"
                        onClick={() =>
                          setItems((prev) =>
                            prev.length === 1 ? [{ ...EMPTY_ITEM }] : prev.filter((_, x) => x !== i),
                          )
                        }
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                  <Button
                    variant="outline"
                    onClick={() => setItems((prev) => [...prev, { ...EMPTY_ITEM }])}
                    className="mt-2"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add line
                  </Button>

                  <div className="grid sm:grid-cols-2 gap-4 mt-5">
                    <div>
                      <Label>Due date</Label>
                      <Input
                        type="date"
                        value={dueDate}
                        onChange={(e) => setDueDate(e.target.value)}
                        className="h-11 mt-1"
                      />
                    </div>
                    <div>
                      <Label>Tax rate %</Label>
                      <Input
                        inputMode="decimal"
                        placeholder={`${settings?.tax_rate ?? 0} (your default)`}
                        value={taxRate}
                        onChange={(e) => setTaxRate(e.target.value)}
                        className="h-11 mt-1"
                      />
                    </div>
                  </div>
                  <div className="mt-4">
                    <Label>Notes</Label>
                    <Textarea
                      rows={2}
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      className="mt-1"
                    />
                  </div>
                </section>
              </div>
            ) : (
              <div className="space-y-6">
                <section className="bg-surface dark:bg-surface-inverted rounded-xl border border-line dark:border-ink-700 p-4 sm:p-5">
                  <h2 className="font-bold text-content dark:text-content-inverted mb-1">
                    Your file
                  </h2>
                  <p className="text-sm text-content-muted dark:text-content-subtle mb-4">
                    CSV or tab-separated. In Excel: File ▸ Save As ▸ CSV UTF-8.
                    In Sheets: File ▸ Download ▸ .csv. One row per line item —
                    rows for the same client become one invoice.
                  </p>

                  <label className="cursor-pointer inline-block">
                    <input
                      type="file"
                      accept=".csv,.tsv,.txt,text/csv,text/tab-separated-values,text/plain"
                      onChange={handleFile}
                      className="hidden"
                    />
                    <span className="inline-flex items-center gap-2 px-4 py-2.5 border dark:border-ink-700 rounded-lg bg-surface dark:bg-ink-800 hover:bg-surface-sunken dark:hover:bg-ink-700 text-sm font-medium text-ink-700 dark:text-ink-300">
                      <Upload className="w-4 h-4" />
                      {fileName || "Choose a file"}
                    </span>
                  </label>

                  <p className="text-xs text-content-muted dark:text-content-subtle mt-4 mb-1">
                    …or paste the rows here:
                  </p>
                  <Textarea
                    rows={5}
                    value={rawText}
                    onChange={(e) => {
                      setRawText(e.target.value);
                      setFileName("");
                    }}
                    placeholder={"client,description,qty,rate,due date\nDana Reyes,Site visit,2,150,2026-04-30"}
                    className="font-mono text-xs"
                  />
                  {parseError && (
                    <p className="text-sm text-danger-600 dark:text-danger-400 mt-2">{parseError}</p>
                  )}
                </section>

                {parsed?.rows?.length > 0 && (
                  <section className="bg-surface dark:bg-surface-inverted rounded-xl border border-line dark:border-ink-700 p-4 sm:p-5">
                    <h2 className="font-bold text-content dark:text-content-inverted mb-1">
                      Which column is which
                    </h2>
                    <p className="text-sm text-content-muted dark:text-content-subtle mb-4">
                      {dataRows.length} row{dataRows.length === 1 ? "" : "s"} of data
                      {parsed.delimiter === "\t" ? ", tab-separated" : ""}.
                    </p>

                    <label className="flex items-center gap-2 mb-4 cursor-pointer">
                      <Checkbox
                        checked={hasHeader}
                        onCheckedChange={(v) => setHasHeader(Boolean(v))}
                      />
                      <span className="text-sm text-ink-700 dark:text-ink-300">
                        The first row is column headings
                      </span>
                    </label>

                    <div className="grid sm:grid-cols-2 gap-3">
                      {IMPORT_FIELDS.map((field) => (
                        <div key={field.key}>
                          <Label className="text-xs">
                            {field.label}
                            {field.required && (
                              <span className="text-danger-600 dark:text-danger-400"> *</span>
                            )}
                          </Label>
                          <Select
                            value={
                              mapping[field.key] === undefined ? "none" : String(mapping[field.key])
                            }
                            onValueChange={(v) =>
                              setMapping((prev) => {
                                const next = { ...prev };
                                if (v === "none") delete next[field.key];
                                else next[field.key] = Number(v);
                                return next;
                              })
                            }
                          >
                            <SelectTrigger className="h-10 mt-1">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">— not in my file —</SelectItem>
                              {(hasHeader ? headers : headers.map((_, i) => `Column ${i + 1}`)).map(
                                (h, i) => (
                                  <SelectItem key={i} value={String(i)}>
                                    {String(h || `Column ${i + 1}`)}
                                  </SelectItem>
                                ),
                              )}
                            </SelectContent>
                          </Select>
                          {field.hint && (
                            <p className="text-xs text-content-muted dark:text-content-subtle mt-1">
                              {field.hint}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>

                    {missingRequired.length > 0 && (
                      <p className="text-sm text-alert-700 dark:text-alert-400 mt-4">
                        Still needed: {missingRequired.map((f) => f.label).join(", ")}
                      </p>
                    )}
                  </section>
                )}
              </div>
            )}

            <div className="flex justify-end mt-6">
              <Button
                disabled={!plan || plan.invoices.length === 0 || missingRequired.length > 0}
                onClick={() => setStep("review")}
                className="bg-brand hover:bg-brand-hover text-content-inverted h-11 px-6 rounded-xl font-semibold"
              >
                Review {plan?.invoices?.length || 0} invoice
                {plan?.invoices?.length === 1 ? "" : "s"}
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </>
        )}

        {step === "review" && plan && (
          <div className="space-y-4">
            {/* A file whose dates could be read either way says which reading
                it took, rather than picking one and hoping. */}
            {plan.ambiguousDates && (
              <div className="rounded-xl border border-alert-200 dark:border-alert-800 bg-alert-50 dark:bg-alert-900/20 p-4 flex gap-3">
                <AlertCircle className="w-5 h-5 text-alert-600 dark:text-alert-400 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-content-body dark:text-ink-300">
                  Your dates are written like 03/04/2026 and nothing in the file
                  says which number is the month. They have been read as{" "}
                  <strong>
                    {plan.dateOrder === "mdy" ? "month/day/year" : "day/month/year"}
                  </strong>
                  . Check the due dates below before creating.
                </p>
              </div>
            )}

            <div className="bg-surface dark:bg-surface-inverted rounded-xl border border-line dark:border-ink-700 overflow-hidden">
              <div className="p-4 border-b border-line dark:border-ink-700 flex flex-wrap items-center gap-x-4 gap-y-1">
                <span className="font-bold text-content dark:text-content-inverted">
                  {plan.counts.ok} ready
                </span>
                {plan.counts.blocked > 0 && (
                  <span className="text-danger-600 dark:text-danger-400 font-medium">
                    {plan.counts.blocked} cannot be created
                  </span>
                )}
                <span className="ml-auto text-content-body dark:text-ink-300">
                  {money(
                    plan.invoices.filter((i) => i.ok).reduce((s, i) => s + i.total, 0),
                  )}{" "}
                  total
                </span>
              </div>

              <div className="max-h-[28rem] overflow-y-auto divide-y divide-line-subtle dark:divide-ink-700">
                {plan.invoices.map((inv) => (
                  <div key={inv.key} className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="font-semibold text-content dark:text-content-inverted truncate">
                          {inv.clientName || "(no client)"}
                          {inv.isNewClient && (
                            <span className="ml-2 text-xs font-bold px-2 py-0.5 rounded-full bg-info-50 dark:bg-info-900/30 text-info-700 dark:text-info-400">
                              new client
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-content-muted dark:text-content-subtle mt-0.5">
                          {inv.items.length} line{inv.items.length === 1 ? "" : "s"}
                          {inv.reference ? ` · ${inv.reference}` : ""}
                          {inv.due_date ? ` · due ${inv.due_date}` : " · no due date"}
                          {inv.lines.length ? ` · row${inv.lines.length === 1 ? "" : "s"} ${inv.lines.join(", ")}` : ""}
                        </p>
                        {inv.errors.map((e, i) => (
                          <p key={i} className="text-xs text-danger-600 dark:text-danger-400 mt-1">
                            {e}
                          </p>
                        ))}
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="font-bold text-content dark:text-content-inverted">
                          {money(inv.total)}
                        </p>
                        {inv.ok ? (
                          <CheckCircle2 className="w-4 h-4 text-success-600 dark:text-success-400 inline-block mt-1" />
                        ) : (
                          <AlertCircle className="w-4 h-4 text-danger-600 dark:text-danger-400 inline-block mt-1" />
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {plan.counts.newClients > 0 && (
              <label className="flex items-start gap-3 p-4 rounded-xl border border-line dark:border-ink-700 bg-surface dark:bg-surface-inverted cursor-pointer">
                <Checkbox
                  checked={createMissingClients}
                  onCheckedChange={(v) => setCreateMissingClients(Boolean(v))}
                />
                <span>
                  <span className="block font-medium text-content dark:text-content-inverted">
                    Also create {plan.counts.newClients} client
                    {plan.counts.newClients === 1 ? "" : "s"} that do not exist yet
                  </span>
                  {/* Opt-in on purpose. Creating clients silently from a
                      spreadsheet is how an account fills with near-duplicates
                      that nobody notices until the list is unusable. */}
                  <span className="block text-xs text-content-muted dark:text-content-subtle mt-0.5">
                    Untick if a name is spelled differently in your file — those
                    invoices will be skipped instead of adding a duplicate client.
                  </span>
                </span>
              </label>
            )}

            <div className="flex flex-wrap justify-end gap-3">
              <Button variant="outline" onClick={() => setStep("source")} disabled={running}>
                Back
              </Button>
              <Button
                onClick={run}
                disabled={running || plan.counts.ok === 0}
                className="bg-brand hover:bg-brand-hover text-content-inverted h-11 px-6 rounded-xl font-semibold"
              >
                {running ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Creating {progress} of {plan.counts.ok}…
                  </>
                ) : (
                  `Create ${plan.counts.ok} draft${plan.counts.ok === 1 ? "" : "s"}`
                )}
              </Button>
            </div>
          </div>
        )}

        {step === "done" && outcome && (
          <div className="bg-surface dark:bg-surface-inverted rounded-xl border border-line dark:border-ink-700 p-6">
            <CheckCircle2 className="w-10 h-10 text-success-600 dark:text-success-400 mb-3" />
            <h2 className="text-xl font-black text-content dark:text-content-inverted mb-1">
              {outcome.created} draft{outcome.created === 1 ? "" : "s"} created
            </h2>
            <p className="text-content-body dark:text-ink-300">
              {outcome.clientsCreated > 0 &&
                `${outcome.clientsCreated} new client${outcome.clientsCreated === 1 ? "" : "s"} added. `}
              Nothing has been sent. Select them on the Invoices page to send the
              batch when you are ready.
            </p>

            {/* Named per invoice rather than summarised as a count, because the
                only useful next action is dealing with the specific ones that
                failed, and a contractor cannot do that from a number. */}
            {outcome.failed > 0 && (
              <div className="mt-4 rounded-lg border border-danger-200 dark:border-danger-800 bg-danger-50 dark:bg-danger-900/20 p-4">
                <p className="font-semibold text-danger-700 dark:text-danger-400 mb-2">
                  {outcome.failed} were not created
                </p>
                {outcome.results
                  .filter((r) => !r.created)
                  .map((r, i) => (
                    <p key={i} className="text-sm text-content-body dark:text-ink-300">
                      {r.clientName || "(no client)"} — {r.error}
                    </p>
                  ))}
              </div>
            )}

            <div className="flex gap-3 mt-6">
              <Button
                onClick={() => navigate(createPageUrl("Invoices"))}
                className="bg-brand hover:bg-brand-hover text-content-inverted"
              >
                Go to Invoices
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setOutcome(null);
                  setStep("source");
                  setChosenIds(new Set());
                  setRawText("");
                  setFileName("");
                }}
              >
                Start another batch
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
