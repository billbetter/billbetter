import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft, CheckCircle2, ClipboardList, Loader2, Plus, Send, Trash2, X,
} from "lucide-react";
import { createPageUrl } from "@/utils";
import { sdk } from "@/api/sdk";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  DEFAULT_STAGES, validateStages, buildStages, buildStagePrefill,
  nextReleasableStage, releasedTotal, remainingTotal, isPlanFullyBilled,
} from "@/lib/paymentPlan";

/**
 * Progress invoicing: deposit and milestone billing for bigger jobs.
 *
 * A plan is a schedule, not a document. Releasing a stage produces an ordinary
 * invoice -- which is why there is no "plan invoice" anywhere in the product:
 * the public link, Stripe checkout, overdue status, batch send and the
 * reminder queue all work on stage invoices because there is nothing special
 * about them.
 *
 * The arithmetic lives in lib/paymentPlan.js and is tested there. This file is
 * the screen.
 */

const money = (n) =>
  new Intl.NumberFormat(undefined, { style: "currency", currency: "CAD" })
    .format(Number(n) || 0);

export default function PaymentPlans() {
  const navigate = useNavigate();
  const [plans, setPlans] = useState([]);
  const [clients, setClients] = useState([]);
  const [settings, setSettings] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState({ mode: "list", plan: null });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const [form, setForm] = useState({
    title: "", client_id: "", total_amount: "", tax_rate: "", notes: "",
    stages: DEFAULT_STAGES.map((s) => ({ ...s })),
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const me = await sdk.auth.me();
      setUser(me);
      const [planRows, clientRows, settingRows] = await Promise.all([
        sdk.entities.PaymentPlan.filter({ user_id: me.id }).catch(() => []),
        sdk.entities.Client.filter({ user_id: me.id }).catch(() => []),
        sdk.entities.BusinessSettings.filter({ user_id: me.id }).catch(() => []),
      ]);
      setPlans(Array.isArray(planRows) ? planRows : []);
      setClients(Array.isArray(clientRows) ? clientRows : []);
      setSettings(settingRows?.[0] || null);
    } catch (err) {
      console.error("Could not load payment plans:", err);
      setError(err?.message || "Could not load payment plans.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const validation = validateStages(form.stages);
  const previewStages = validation.ok
    ? buildStages(parseFloat(form.total_amount) || 0, form.stages)
    : [];

  const handleCreate = async () => {
    setError(null);
    if (!validation.ok) { setError(validation.reason); return; }
    if (!(parseFloat(form.total_amount) > 0)) {
      setError("Enter the total value of the work.");
      return;
    }
    const client = clients.find((c) => c.id === form.client_id) || null;
    setSaving(true);
    try {
      const created = await sdk.entities.PaymentPlan.create({
        user_id: user.id,
        client_id: form.client_id || null,
        client_name: client?.name || "",
        title: form.title.trim(),
        total_amount: parseFloat(form.total_amount) || 0,
        tax_rate: parseFloat(form.tax_rate) || 0,
        notes: form.notes,
        stages: buildStages(parseFloat(form.total_amount) || 0, form.stages),
        status: "active",
      });
      await load();
      setView({ mode: "detail", plan: created });
    } catch (err) {
      console.error("Could not create plan:", err);
      setError(err?.message || "Could not create the plan.");
    } finally {
      setSaving(false);
    }
  };

  /**
   * Release the next stage as a real invoice.
   *
   * Navigates to the invoice form rather than writing the invoice here, and
   * the stage is marked released by CreateInvoice AFTER the save succeeds.
   * Marking it here would leave a plan claiming an invoice that was never
   * created if the contractor backed out -- which is exactly the bug the quote
   * flow still has.
   */
  const handleRelease = async (plan) => {
    const stage = nextReleasableStage(plan);
    if (!stage) return;
    const client = clients.find((c) => c.id === plan.client_id) || null;
    const prefillData = buildStagePrefill({ plan, stage, client });
    if (!prefillData) return;
    navigate(createPageUrl("CreateInvoice"), { state: { prefillData } });
  };

  const handleDelete = async (plan) => {
    if (!window.confirm(
      `Delete the plan "${plan.title || "Untitled"}"? Invoices already issued from it are not affected.`,
    )) return;
    try {
      await sdk.entities.PaymentPlan.delete(plan.id);
      setView({ mode: "list", plan: null });
      await load();
    } catch (err) {
      setError(err?.message || "Could not delete the plan.");
    }
  };

  const setStage = (i, patch) =>
    setForm((f) => ({
      ...f,
      stages: f.stages.map((s, idx) => (idx === i ? { ...s, ...patch } : s)),
    }));

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-content-muted" />
      </div>
    );
  }

  // ---- Create -----------------------------------------------------------
  if (view.mode === "create") {
    const totalPct = form.stages.reduce((s, x) => s + (Number(x.percent) || 0), 0);
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:py-10">
        <button
          type="button"
          onClick={() => setView({ mode: "list", plan: null })}
          className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-content-muted hover:text-content dark:text-content-subtle"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Payment plans
        </button>

        <h1 className="text-2xl font-black tracking-tight text-content dark:text-content-inverted sm:text-3xl">
          New payment plan
        </h1>
        <p className="mt-1 text-sm text-content-body dark:text-content-subtle">
          Split a bigger job into a deposit and milestones. Each stage becomes a
          normal invoice when you release it.
        </p>

        <div className="mt-6 space-y-5 rounded-2xl border border-line bg-surface p-5 dark:border-ink-700 dark:bg-surface-inverted sm:p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label className="text-ink-700 dark:text-ink-300">Job or project</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Kitchen remodel"
                className="mt-1.5"
              />
            </div>
            <div>
              <Label className="text-ink-700 dark:text-ink-300">Client</Label>
              <Select
                value={form.client_id}
                onValueChange={(v) => setForm({ ...form, client_id: v })}
              >
                <SelectTrigger className="mt-1.5">
                  <SelectValue placeholder="Choose a client" />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-ink-700 dark:text-ink-300">Total value</Label>
              <Input
                type="number" min="0" step="0.01"
                value={form.total_amount}
                onChange={(e) => setForm({ ...form, total_amount: e.target.value })}
                placeholder="12000.00"
                className="mt-1.5"
              />
            </div>
            <div>
              <Label className="text-ink-700 dark:text-ink-300">
                Tax rate % (optional)
              </Label>
              <Input
                type="number" min="0" step="0.01"
                value={form.tax_rate}
                onChange={(e) => setForm({ ...form, tax_rate: e.target.value })}
                placeholder={settings?.tax_rate ? String(settings.tax_rate) : "0"}
                className="mt-1.5"
              />
            </div>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <Label className="text-ink-700 dark:text-ink-300">Stages</Label>
              <span
                className={`text-sm font-bold ${
                  totalPct === 100
                    ? "text-success-600 dark:text-success-400"
                    : "text-caution-700 dark:text-caution-400"
                }`}
              >
                {Math.round(totalPct * 100) / 100}%
              </span>
            </div>

            <div className="space-y-2">
              {form.stages.map((s, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input
                    value={s.label}
                    onChange={(e) => setStage(i, { label: e.target.value })}
                    placeholder="Stage name"
                    className="flex-1"
                  />
                  <Input
                    type="number" min="0" step="0.01"
                    value={s.percent}
                    onChange={(e) => setStage(i, { percent: e.target.value })}
                    className="w-24"
                  />
                  <span className="text-sm text-content-muted">%</span>
                  <span className="w-28 text-right text-sm font-semibold text-content dark:text-content-inverted">
                    {previewStages[i] ? money(previewStages[i].amount) : "—"}
                  </span>
                  <Button
                    type="button" variant="ghost" size="sm"
                    disabled={form.stages.length <= 1}
                    onClick={() =>
                      setForm((f) => ({ ...f, stages: f.stages.filter((_, idx) => idx !== i) }))}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>

            <Button
              type="button" variant="outline" size="sm"
              onClick={() =>
                setForm((f) => ({ ...f, stages: [...f.stages, { label: "", percent: 0 }] }))}
              className="mt-3 dark:border-ink-700 dark:text-ink-300"
            >
              <Plus className="mr-1.5 h-3.5 w-3.5" /> Add stage
            </Button>

            {/* The stages must total exactly 100%, and the last one absorbs
                rounding so the parts always add back to the contract. Both are
                enforced in lib/paymentPlan.js; this only reports it. */}
            {!validation.ok && (
              <p className="mt-3 text-sm font-medium text-caution-700 dark:text-caution-400">
                {validation.reason}
              </p>
            )}
          </div>

          {error && (
            <p className="text-sm font-medium text-danger-600 dark:text-danger-400">{error}</p>
          )}

          <div className="flex gap-2">
            <Button
              onClick={handleCreate}
              disabled={saving || !validation.ok}
              className="bg-brand hover:bg-brand-hover text-content-inverted"
            >
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create plan
            </Button>
            <Button
              variant="ghost"
              onClick={() => setView({ mode: "list", plan: null })}
              disabled={saving}
            >
              Cancel
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ---- Detail -----------------------------------------------------------
  if (view.mode === "detail" && view.plan) {
    const plan = plans.find((p) => p.id === view.plan.id) || view.plan;
    const stages = plan.stages || [];
    const next = nextReleasableStage(plan);
    const billed = releasedTotal(stages);
    const pct = plan.total_amount ? (billed / plan.total_amount) * 100 : 0;

    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:py-10">
        <button
          type="button"
          onClick={() => setView({ mode: "list", plan: null })}
          className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-content-muted hover:text-content dark:text-content-subtle"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Payment plans
        </button>

        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-content dark:text-content-inverted sm:text-3xl">
              {plan.title || "Payment plan"}
            </h1>
            <p className="mt-1 text-sm text-content-body dark:text-content-subtle">
              {plan.client_name || "No client"} · {money(plan.total_amount)} total
            </p>
          </div>
          <Button
            variant="ghost"
            onClick={() => handleDelete(plan)}
            className="text-danger-600 hover:bg-danger-50 dark:text-danger-400"
          >
            <Trash2 className="mr-2 h-4 w-4" /> Delete
          </Button>
        </div>

        <div className="mt-6 rounded-2xl border border-line bg-surface p-5 dark:border-ink-700 dark:bg-surface-inverted sm:p-6">
          <div className="mb-1 flex items-baseline justify-between">
            <span className="text-sm font-semibold text-content dark:text-content-inverted">
              {money(billed)} invoiced
            </span>
            <span className="text-sm text-content-muted dark:text-content-subtle">
              {money(remainingTotal(plan))} to go
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-ink-100 dark:bg-ink-800">
            <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${pct}%` }} />
          </div>

          <div className="mt-6 space-y-3">
            {stages.map((s) => (
              <div
                key={s.id}
                className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4 ${
                  s.released_at
                    ? "border-success-200 bg-success-50/40 dark:border-success-800 dark:bg-success-900/20"
                    : "border-line bg-surface-sunken dark:border-ink-700 dark:bg-ink-800/50"
                }`}
              >
                <div className="min-w-0">
                  <p className="font-semibold text-content dark:text-content-inverted">
                    {s.label}{" "}
                    <span className="text-content-muted dark:text-content-subtle">
                      · {s.percent}%
                    </span>
                  </p>
                  <p className="text-sm text-content-body dark:text-content-subtle">
                    {money(s.amount)}
                    {s.released_at ? " · invoiced" : " · not yet billed"}
                  </p>
                </div>
                {s.released_at ? (
                  <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-success-700 dark:text-success-400">
                    <CheckCircle2 className="h-4 w-4" /> Released
                  </span>
                ) : next && next.id === s.id ? (
                  <Button
                    onClick={() => handleRelease(plan)}
                    className="bg-brand hover:bg-brand-hover text-content-inverted"
                  >
                    <Send className="mr-2 h-4 w-4" /> Release
                  </Button>
                ) : (
                  // Strictly in order: the schedule IS the agreement, and
                  // billing a later stage first charges for something the
                  // client has not agreed is due yet.
                  <span className="text-sm text-content-muted dark:text-content-subtle">
                    Waiting on earlier stages
                  </span>
                )}
              </div>
            ))}
          </div>

          {isPlanFullyBilled(plan) && (
            <p className="mt-5 rounded-lg bg-success-50 p-3 text-sm font-medium text-success-800 dark:bg-success-900/20 dark:text-success-300">
              Every stage has been invoiced. Payment is tracked on the invoices
              themselves.
            </p>
          )}
        </div>
      </div>
    );
  }

  // ---- List -------------------------------------------------------------
  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:py-10">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-black tracking-tight text-content dark:text-content-inverted sm:text-3xl">
            <ClipboardList className="h-7 w-7 text-brand-600" />
            Payment plans
          </h1>
          <p className="mt-1 text-sm text-content-body dark:text-content-subtle">
            Deposit and milestone billing for bigger jobs.
          </p>
        </div>
        <Button
          onClick={() => { setError(null); setView({ mode: "create", plan: null }); }}
          className="bg-brand hover:bg-brand-hover text-content-inverted"
        >
          <Plus className="mr-2 h-4 w-4" /> New plan
        </Button>
      </div>

      {error && (
        <p className="mt-4 rounded-lg border border-danger-200 bg-danger-50 p-3 text-sm text-danger-700 dark:border-danger-800 dark:bg-danger-900/20 dark:text-danger-300">
          {error}
        </p>
      )}

      {plans.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-line bg-surface p-10 text-center dark:border-ink-700 dark:bg-surface-inverted">
          <ClipboardList className="mx-auto mb-4 h-10 w-10 text-content-subtle" />
          <h2 className="text-lg font-bold text-content dark:text-content-inverted">
            No payment plans yet
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-content-body dark:text-content-subtle">
            On a big job, bill a deposit up front and the rest at milestones.
            Each stage becomes a normal invoice, so it can be sent, paid online
            and chased like any other.
          </p>
        </div>
      ) : (
        <div className="mt-6 space-y-3">
          {plans.map((plan) => {
            const billed = releasedTotal(plan.stages || []);
            const pct = plan.total_amount ? (billed / plan.total_amount) * 100 : 0;
            const next = nextReleasableStage(plan);
            return (
              <button
                key={plan.id}
                type="button"
                onClick={() => setView({ mode: "detail", plan })}
                className="w-full rounded-xl border border-line bg-surface p-4 text-left transition-colors hover:border-line-strong dark:border-ink-700 dark:bg-surface-inverted dark:hover:border-ink-600"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-bold text-content dark:text-content-inverted">
                      {plan.title || "Untitled plan"}
                    </p>
                    <p className="text-sm text-content-body dark:text-content-subtle">
                      {plan.client_name || "No client"} · {money(plan.total_amount)}
                    </p>
                  </div>
                  <p className="text-sm font-medium text-content-body dark:text-content-subtle">
                    {next ? `Next: ${next.label}` : "Fully invoiced"}
                  </p>
                </div>
                <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-ink-100 dark:bg-ink-800">
                  <div className="h-full rounded-full bg-brand" style={{ width: `${pct}%` }} />
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
