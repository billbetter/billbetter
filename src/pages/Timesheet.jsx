/**
 * Time tracking.
 *
 * The Features page has sold "Time Tracking & Job Costing" the whole time, and
 * Job already carried estimated_hours / hourly_rate / labor_cost / actual_cost
 * with a profitability chart reading them -- but there was no way to record an
 * hour, so labor_cost was whatever someone typed. This is the input those
 * fields were always waiting for.
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { sdk } from "@/api/sdk";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Clock,
  Play,
  Square,
  Plus,
  Loader2,
  Trash2,
  AlertCircle,
  Timer,
  DollarSign,
  FileText,
} from "lucide-react";
import { format, startOfWeek } from "date-fns";
import FeatureGate from "@/components/access/FeatureGate";
import { getBusinessContext, can } from "@/lib/crew";
import {
  clockIn,
  clockOut,
  entryCost,
  entryMinutes,
  formatDuration,
  getRunningEntry,
  logManualEntry,
  recalculateJobCost,
  summariseByJob,
  billableEntries,
  entriesToLineItems,
} from "@/lib/timeTracking";

const money = (n) =>
  new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" }).format(
    Number(n) || 0,
  );

/**
 * The live clock.
 *
 * Ticks once a second purely so the running duration moves; every other number
 * on the page is derived from stored values and does not need it.
 */
function useNow(active) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!active) return undefined;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [active]);
  return now;
}

function TimesheetInner() {
  const [ctx, setCtx] = useState(null);
  const [entries, setEntries] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [running, setRunning] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [selectedJobId, setSelectedJobId] = useState("");
  const [manualOpen, setManualOpen] = useState(false);
  const [manual, setManual] = useState({
    job_id: "",
    date: format(new Date(), "yyyy-MM-dd"),
    hours: "",
    notes: "",
  });

  const navigate = useNavigate();
  const now = useNow(Boolean(running));

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const context = await getBusinessContext();
      setCtx(context);

      // An employee sees only their own hours; anyone who can view the team's
      // sees the business's. The RLS policy allows both -- this is the product
      // decision about which is useful, not a security boundary.
      const filters = can(context, "view_all_time")
        ? { user_id: context.ownerId }
        : { member_user_id: context.authUserId };

      const [entryRows, jobRows, live] = await Promise.all([
        sdk.entities.TimeEntry.filter(filters, "-started_at", 200),
        sdk.entities.Job.filter({ user_id: context.ownerId }, "-created_date", 100),
        getRunningEntry(),
      ]);

      setEntries(entryRows || []);
      setJobs(jobRows || []);
      setRunning(live);
      if (live?.job_id) setSelectedJobId(live.job_id);
    } catch (err) {
      console.error("Timesheet: load failed", err);
      setError(err.message || "Could not load your timesheet.");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const jobsById = useMemo(
    () => Object.fromEntries(jobs.map((j) => [j.id, j])),
    [jobs],
  );

  const closed = useMemo(() => entries.filter((e) => e.ended_at), [entries]);

  const weekTotals = useMemo(() => {
    const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
    const thisWeek = closed.filter(
      (e) => new Date(e.started_at).getTime() >= weekStart.getTime(),
    );
    return {
      minutes: thisWeek.reduce((s, e) => s + entryMinutes(e), 0),
      cost: thisWeek.reduce((s, e) => s + entryCost(e), 0),
      unbilled: closed
        .filter((e) => e.billable && !e.invoiced)
        .reduce((s, e) => s + entryCost(e), 0),
    };
  }, [closed]);

  const byJob = useMemo(() => summariseByJob(closed), [closed]);

  const unbilledCount = useMemo(() => billableEntries(entries).length, [entries]);

  const start = async () => {
    setBusy(true);
    setError(null);
    try {
      const job = selectedJobId ? jobsById[selectedJobId] : null;
      const entry = await clockIn({ job });
      setRunning(entry);
      setEntries((prev) => [entry, ...prev]);
    } catch (err) {
      setError(err.message || "Could not start the clock.");
    }
    setBusy(false);
  };

  const stop = async () => {
    if (!running) return;
    setBusy(true);
    setError(null);
    try {
      const stopped = await clockOut(running);
      setRunning(null);
      setEntries((prev) =>
        prev.map((e) => (e.id === stopped.id ? stopped : e)),
      );
      if (stopped.job_id) await recalculateJobCost(stopped.job_id);
    } catch (err) {
      setError(err.message || "Could not stop the clock.");
    }
    setBusy(false);
  };

  const addManual = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const job = manual.job_id ? jobsById[manual.job_id] : null;
      const entry = await logManualEntry({
        job,
        startedAt: new Date(`${manual.date}T09:00:00`),
        minutes: Math.round(Number(manual.hours) * 60),
        notes: manual.notes,
      });
      setEntries((prev) => [entry, ...prev]);
      if (entry.job_id) await recalculateJobCost(entry.job_id);
      setManualOpen(false);
      setManual({
        job_id: "",
        date: format(new Date(), "yyyy-MM-dd"),
        hours: "",
        notes: "",
      });
    } catch (err) {
      setError(err.message || "Could not save that entry.");
    }
    setBusy(false);
  };

  const remove = async (entry) => {
    setBusy(true);
    try {
      await sdk.entities.TimeEntry.delete(entry.id);
      setEntries((prev) => prev.filter((e) => e.id !== entry.id));
      if (entry.job_id) await recalculateJobCost(entry.job_id);
    } catch (err) {
      setError(err.message || "Could not delete that entry.");
    }
    setBusy(false);
  };

  /**
   * Hand unbilled hours to the invoice screen.
   *
   * Nothing is marked billed here -- CreateInvoice does that after the invoice
   * row exists, so backing out of that screen leaves the hours billable.
   */
  const billHours = () => {
    const unbilled = billableEntries(entries);
    if (!unbilled.length) return;

    const items = entriesToLineItems(unbilled, jobsById);
    const subtotal = items.reduce((sum, li) => sum + li.amount, 0);

    // One client or none: hours across two clients cannot become one invoice,
    // so in that case the invoice opens unassigned rather than guessing wrong.
    const clientIds = [...new Set(unbilled.map((e) => e.client_id).filter(Boolean))];
    const client = clientIds.length === 1 ? clientIds[0] : "";

    navigate(createPageUrl("CreateInvoice"), {
      state: {
        prefillData: {
          client_id: client,
          client_name: "",
          client_email: "",
          items: items.map(({ description, quantity, rate, amount }) => ({
            description,
            quantity,
            rate,
            amount,
          })),
          subtotal,
          tax_rate: 0,
          tax_amount: 0,
          total: subtotal,
          status: "draft",
          time_entry_ids: items.flatMap((li) => li.time_entry_ids),
        },
      },
    });
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-content-400" />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:py-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-black tracking-tight text-content sm:text-3xl">
            <Clock className="h-7 w-7 text-brand-600" />
            Time
          </h1>
          <p className="mt-1 text-sm text-content-500">
            {can(ctx, "view_all_time")
              ? "Hours logged against your jobs, and what they cost."
              : "Your hours on the team's jobs."}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="gap-2"
            onClick={() => setManualOpen(true)}
          >
            <Plus className="h-4 w-4" />
            Add hours
          </Button>
          {unbilledCount > 0 && can(ctx, "manage_invoices") ? (
            <Button className="gap-2" onClick={billHours}>
              <FileText className="h-4 w-4" />
              Bill {unbilledCount} {unbilledCount === 1 ? "entry" : "entries"}
            </Button>
          ) : null}
        </div>
      </div>

      {error ? (
        <div className="mt-4 flex items-center gap-2 rounded-lg bg-danger-50 px-3 py-2 text-sm text-danger-800">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          {error}
        </div>
      ) : null}

      {/* -- The clock --------------------------------------------------- */}
      <Card className="mt-6 border-2 border-brand-200">
        <CardContent className="flex flex-wrap items-center gap-4 p-5">
          <div
            className={`flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-full ${
              running ? "bg-success-100" : "bg-surface-200"
            }`}
          >
            <Timer
              className={`h-7 w-7 ${running ? "text-success-700" : "text-content-400"}`}
            />
          </div>

          <div className="min-w-0 flex-1">
            {running ? (
              <>
                <p className="font-mono text-3xl font-black tabular-nums text-content">
                  {formatDuration(entryMinutes(running, now))}
                </p>
                <p className="truncate text-sm text-content-500">
                  {running.job_id
                    ? jobsById[running.job_id]?.job_title || "Job"
                    : "No job selected"}{" "}
                  · started {format(new Date(running.started_at), "HH:mm")}
                </p>
              </>
            ) : (
              <>
                <p className="text-lg font-bold text-content">Not clocked in</p>
                <select
                  value={selectedJobId}
                  onChange={(e) => setSelectedJobId(e.target.value)}
                  aria-label="Job to track against"
                  className="mt-2 h-9 w-full max-w-xs rounded-md border border-line bg-surface px-2 text-sm text-content"
                >
                  <option value="">No job — general work</option>
                  {jobs.map((job) => (
                    <option key={job.id} value={job.id}>
                      {job.job_title}
                    </option>
                  ))}
                </select>
              </>
            )}
          </div>

          {running ? (
            <Button
              onClick={stop}
              disabled={busy}
              variant="destructive"
              className="gap-2"
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Square className="h-4 w-4" />
              )}
              Clock out
            </Button>
          ) : (
            <Button onClick={start} disabled={busy} className="gap-2">
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Play className="h-4 w-4" />
              )}
              Clock in
            </Button>
          )}
        </CardContent>
      </Card>

      {/* -- Totals ------------------------------------------------------ */}
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-bold uppercase tracking-wider text-content-400">
              This week
            </p>
            <p className="mt-1 text-2xl font-black tabular-nums text-content">
              {formatDuration(weekTotals.minutes)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-bold uppercase tracking-wider text-content-400">
              Labour cost
            </p>
            <p className="mt-1 text-2xl font-black tabular-nums text-content">
              {money(weekTotals.cost)}
            </p>
          </CardContent>
        </Card>
        <Card className="col-span-2 sm:col-span-1">
          <CardContent className="p-4">
            <p className="text-xs font-bold uppercase tracking-wider text-content-400">
              Not yet invoiced
            </p>
            <p className="mt-1 flex items-center gap-1 text-2xl font-black tabular-nums text-brand-700">
              <DollarSign className="h-5 w-5" />
              {money(weekTotals.unbilled).replace("$", "")}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* -- Per job ----------------------------------------------------- */}
      {byJob.length > 0 ? (
        <section className="mt-8">
          <h2 className="text-xs font-bold uppercase tracking-wider text-content-400">
            By job
          </h2>
          <Card className="mt-3">
            <CardContent className="divide-y divide-line p-0">
              {byJob.map((group) => (
                <div
                  key={group.jobId || "unassigned"}
                  className="flex items-center justify-between gap-4 p-4"
                >
                  <span className="min-w-0 truncate font-semibold text-content">
                    {group.jobId
                      ? jobsById[group.jobId]?.job_title || "Job"
                      : "General work"}
                  </span>
                  <span className="flex flex-shrink-0 items-center gap-4 text-sm">
                    <span className="tabular-nums text-content-500">
                      {formatDuration(group.minutes)}
                    </span>
                    <span className="w-20 text-right font-bold tabular-nums text-content">
                      {money(group.cost)}
                    </span>
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>
        </section>
      ) : null}

      {/* -- Entries ----------------------------------------------------- */}
      <section className="mt-8">
        <h2 className="text-xs font-bold uppercase tracking-wider text-content-400">
          Recent entries
        </h2>
        {closed.length === 0 ? (
          <Card className="mt-3">
            <CardContent className="p-8 text-center">
              <Clock className="mx-auto h-10 w-10 text-content-300" />
              <p className="mt-3 font-semibold text-content">No hours yet</p>
              <p className="mt-1 text-sm text-content-500">
                Clock in above, or add hours you've already worked.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="mt-3 space-y-2">
            {closed.slice(0, 50).map((entry) => (
              <Card key={entry.id}>
                <CardContent className="flex flex-wrap items-center gap-3 p-4">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-content">
                      {entry.job_id
                        ? jobsById[entry.job_id]?.job_title || "Job"
                        : "General work"}
                    </p>
                    <p className="truncate text-xs text-content-500">
                      {format(new Date(entry.started_at), "EEE d MMM, HH:mm")}
                      {can(ctx, "view_all_time") && entry.member_name
                        ? ` · ${entry.member_name}`
                        : ""}
                      {entry.notes ? ` · ${entry.notes}` : ""}
                    </p>
                  </div>

                  {entry.invoiced ? (
                    <Badge variant="secondary" className="border-0 bg-success-100 text-success-800">
                      Invoiced
                    </Badge>
                  ) : null}

                  <span className="tabular-nums font-bold text-content">
                    {formatDuration(entryMinutes(entry))}
                  </span>
                  <span className="w-20 text-right tabular-nums text-content-500">
                    {money(entryCost(entry))}
                  </span>

                  {!entry.invoiced ? (
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Delete entry"
                      disabled={busy}
                      onClick={() => remove(entry)}
                    >
                      <Trash2 className="h-4 w-4 text-danger-600" />
                    </Button>
                  ) : null}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* -- Manual entry ------------------------------------------------ */}
      <Dialog open={manualOpen} onOpenChange={setManualOpen}>
        <DialogContent>
          <form onSubmit={addManual}>
            <DialogHeader>
              <DialogTitle>Add hours</DialogTitle>
              <DialogDescription>
                For work already done — no clock needed.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div>
                <Label htmlFor="manual-job">Job</Label>
                <select
                  id="manual-job"
                  value={manual.job_id}
                  onChange={(e) => setManual({ ...manual, job_id: e.target.value })}
                  className="mt-1 h-10 w-full rounded-md border border-line bg-surface px-3 text-sm text-content"
                >
                  <option value="">No job — general work</option>
                  {jobs.map((job) => (
                    <option key={job.id} value={job.id}>
                      {job.job_title}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="manual-date">Date</Label>
                  <Input
                    id="manual-date"
                    type="date"
                    required
                    value={manual.date}
                    onChange={(e) => setManual({ ...manual, date: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="manual-hours">Hours</Label>
                  <Input
                    id="manual-hours"
                    type="number"
                    step="0.25"
                    min="0.25"
                    required
                    value={manual.hours}
                    onChange={(e) => setManual({ ...manual, hours: e.target.value })}
                    placeholder="3.5"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="manual-notes">Notes (optional)</Label>
                <Input
                  id="manual-notes"
                  value={manual.notes}
                  onChange={(e) => setManual({ ...manual, notes: e.target.value })}
                  placeholder="Second coat, upstairs"
                />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setManualOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={busy} className="gap-2">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Save
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function Timesheet() {
  return (
    <FeatureGate feature="time_tracking" title="Time Tracking">
      <TimesheetInner />
    </FeatureGate>
  );
}
