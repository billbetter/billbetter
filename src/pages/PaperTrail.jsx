/**
 * The paper trail: what Invoicium can testify to about each document.
 *
 * Reached from Get Paid, because that is where a contractor already is when a
 * client has stopped answering. It is the same journey -- chase, then escalate,
 * then prove -- and a separate nav item would have split it in two.
 *
 * -- What this screen is careful about -------------------------------------
 *
 * Not overstating. Every entry is sealed and every timestamp is ours, but only
 * some entries are things Invoicium WITNESSED rather than things the contractor
 * did. The distinction is on every row and in the summary, because a document
 * that quietly blends the two would fall apart the first time anyone with a
 * reason to push back read it properly -- taking the genuinely strong evidence
 * down with it.
 *
 * The headline number is therefore "the client opened it N times", not "23
 * events recorded".
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Download,
  Eye,
  FileText,
  Loader2,
  Lock,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

import { sdk } from "@/api/sdk";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import PullToRefresh from "@/components/utils/PullToRefresh";
import { canAccessFeature, getMinimumPlanForFeature } from "@/components/utils/permissions";
import {
  PaperTrailUnavailable,
  SOURCE_EXPLAINERS,
  entryView,
  loadDocumentTrail,
  loadTrailSummary,
  recordReference,
  trailStrength,
  verifyChain,
} from "@/lib/paperTrail";
import { deliverPdf } from "@/lib/pdfDelivery";

const money = (n) =>
  Number(n || 0).toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  });

/**
 * `new Date(null)` is the epoch, not an invalid date, so a null timestamp would
 * render as a confident "1 Jan 1970" -- in a banner whose entire job is to make
 * the record look trustworthy. Both formatters take anything and answer "--".
 */
const asDate = (v) => {
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v;
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
};

const longDate = (v) => {
  const d = asDate(v);
  return d ? format(d, "d MMM yyyy 'at' h:mm a") : "--";
};
const shortDate = (v) => {
  const d = asDate(v);
  return d ? format(d, "d MMM yyyy") : "--";
};

const FILTERS = [
  { id: "all", label: "Everything" },
  { id: "unopened", label: "Never opened" },
  { id: "opened", label: "Opened by client" },
  { id: "invoice", label: "Invoices" },
  { id: "quote", label: "Quotes" },
];

export default function PaperTrail() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [allowed, setAllowed] = useState(false);
  const [unavailable, setUnavailable] = useState("");
  const [error, setError] = useState("");
  const [docs, setDocs] = useState([]);
  const [chain, setChain] = useState(null);
  const [settings, setSettings] = useState(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");

  const [openDoc, setOpenDoc] = useState(null);
  const [entries, setEntries] = useState([]);
  const [entriesLoading, setEntriesLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError("");
    try {
      const user = await sdk.auth.me();
      const [subs, settingsRows] = await Promise.all([
        sdk.entities.Subscription.filter({ user_id: user.id }).catch(() => []),
        sdk.entities.BusinessSettings.filter({ user_id: user.id }).catch(() => []),
      ]);
      const subscription = subs?.[0] || null;
      setSettings(settingsRows?.[0] || null);

      const canRead = canAccessFeature(subscription, "paper_trail");
      setAllowed(canRead);
      if (!canRead) return;

      const [summary, verification] = await Promise.all([
        loadTrailSummary(),
        // A failed verification must not blank the page: the entries are still
        // worth reading, and "we could not check the chain" is a different
        // statement from "the chain is broken".
        verifyChain().catch(() => null),
      ]);
      setDocs(summary);
      setChain(verification);
      setUnavailable("");
    } catch (e) {
      if (e instanceof PaperTrailUnavailable) setUnavailable(e.message);
      else setError(e?.message || "Could not load the record.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openRecord = async (doc) => {
    setOpenDoc(doc);
    setEntries([]);
    setEntriesLoading(true);
    try {
      const rows = await loadDocumentTrail(doc.document_id);
      setEntries(rows.map(entryView));
    } catch (e) {
      setError(e?.message || "Could not open that record.");
      setOpenDoc(null);
    } finally {
      setEntriesLoading(false);
    }
  };

  const exportRecord = async () => {
    if (!openDoc || !entries.length) return;
    setExporting(true);
    try {
      const { renderPaperTrailPdf } = await import("@/lib/paperTrailPdf");
      const url = await renderPaperTrailPdf({
        document: openDoc,
        entries,
        settings,
        chain,
      });
      await deliverPdf(url, {
        filename: `Record-${openDoc.document_number || openDoc.document_id.slice(0, 8)}.pdf`,
      });
    } catch (e) {
      setError(e?.message || "Could not build the record document.");
    } finally {
      setExporting(false);
    }
  };

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return docs
      .filter((d) => {
        if (filter === "invoice" || filter === "quote") return d.document_type === filter;
        if (filter === "opened") return Number(d.views || 0) > 0;
        if (filter === "unopened") return Number(d.views || 0) === 0;
        return true;
      })
      .filter((d) => {
        if (!q) return true;
        return (
          String(d.document_number || "").toLowerCase().includes(q) ||
          String(d.client_name || "").toLowerCase().includes(q)
        );
      })
      .sort((a, b) => new Date(b.last_at).getTime() - new Date(a.last_at).getTime());
  }, [docs, search, filter]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-success-600 dark:text-success-400" />
      </div>
    );
  }

  if (!allowed) return <LockedPanel />;

  return (
    <PullToRefresh onRefresh={() => load(true)}>
      <div className="min-h-screen bg-surface-sunken dark:bg-surface-inverted-deep">
        <div className="max-w-[1100px] mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-8 space-y-6">
          <Header onRefresh={() => load(true)} refreshing={refreshing} />

          {unavailable ? (
            <Notice tone="warn" icon={AlertTriangle} title="Not switched on yet">
              {unavailable}
            </Notice>
          ) : (
            <>
              <ChainBanner chain={chain} />

              {error && (
                <Notice tone="warn" icon={AlertTriangle} title="Something went wrong">
                  {error}
                </Notice>
              )}

              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-content-muted" />
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Invoice number or client name"
                    className="pl-9 h-11 rounded-xl dark:bg-ink-800"
                  />
                </div>
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {FILTERS.map((f) => (
                    <button
                      key={f.id}
                      onClick={() => setFilter(f.id)}
                      className={`h-11 px-4 rounded-xl text-sm font-semibold whitespace-nowrap border transition-colors ${
                        filter === f.id
                          ? "bg-content dark:bg-content-inverted text-content-inverted dark:text-content border-transparent"
                          : "bg-surface dark:bg-ink-800 text-content-body dark:text-content-subtle border-line dark:border-ink-700"
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

              {visible.length === 0 ? (
                <EmptyState hasAny={docs.length > 0} />
              ) : (
                <div className="space-y-3">
                  {visible.map((d) => (
                    <DocumentRow key={d.document_id} doc={d} onOpen={() => openRecord(d)} />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <RecordDialog
        doc={openDoc}
        entries={entries}
        loading={entriesLoading}
        exporting={exporting}
        onExport={exportRecord}
        onClose={() => setOpenDoc(null)}
      />
    </PullToRefresh>
  );
}

// ---------------------------------------------------------------------------

function Header({ onRefresh, refreshing }) {
  return (
    <div>
      <Link
        to={createPageUrl("ChaseInvoice")}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-content-muted dark:text-content-subtle hover:text-content dark:hover:text-content-inverted mb-4"
      >
        <ArrowLeft className="w-4 h-4" />
        Get Paid
      </Link>
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-content dark:bg-ink-700 flex items-center justify-center flex-shrink-0">
            <ShieldCheck className="w-6 h-6 text-content-inverted" />
          </div>
          <div>
            <h1 className="text-2xl lg:text-3xl font-black text-content dark:text-content-inverted tracking-tight">
              Paper Trail
            </h1>
            <p className="text-sm text-content-muted dark:text-content-subtle mt-1 font-medium max-w-2xl">
              A record of what you sent and when, kept by Invoicium. You cannot
              edit it and neither can we -- which is the only reason it is worth
              anything to anyone else.
            </p>
          </div>
        </div>
        <Button
          onClick={onRefresh}
          variant="outline"
          size="icon"
          disabled={refreshing}
          className="h-10 w-10 rounded-xl border-line dark:border-ink-700 dark:bg-ink-800 flex-shrink-0"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
        </Button>
      </div>
    </div>
  );
}

/**
 * The verification result, stated plainly.
 *
 * Shown even when everything is fine. A check that only appears on failure
 * gives the reader no reason to believe it ever ran.
 */
function ChainBanner({ chain }) {
  if (!chain) return null;
  if (!chain.entries) return null;

  if (!chain.intact) {
    return (
      <Notice tone="warn" icon={AlertTriangle} title="This record does not verify">
        The sealed log fails its own integrity check from entry #
        {chain.firstBrokenSeq} onwards. Do not rely on it until we have looked at
        it -- please contact support.
      </Notice>
    );
  }

  return (
    <div className="rounded-2xl border border-success-200 dark:border-success-800 bg-success-50 dark:bg-success-900/20 p-4 flex items-start gap-3">
      <CheckCircle2 className="w-5 h-5 text-success-600 dark:text-success-400 flex-shrink-0 mt-0.5" />
      <div className="text-sm">
        <p className="font-bold text-content dark:text-content-inverted">
          {chain.entries} sealed {chain.entries === 1 ? "entry" : "entries"}, all verified
        </p>
        <p className="text-content-body dark:text-content-subtle mt-0.5">
          Each entry is cryptographically linked to the one before it, so
          changing or removing any of them breaks every entry that follows.
          Checked just now, covering {shortDate(chain.sealedFrom)} to {shortDate(chain.sealedTo)}.
        </p>
      </div>
    </div>
  );
}

function DocumentRow({ doc, onOpen }) {
  const views = Number(doc.views || 0);
  const witnessed = Number(doc.witnessed || 0);
  const sentAt = doc.sent_at ? new Date(doc.sent_at) : null;
  const openedAt = doc.first_viewed_at ? new Date(doc.first_viewed_at) : null;

  return (
    <button
      onClick={onOpen}
      className="w-full text-left bg-surface dark:bg-surface-inverted rounded-2xl border border-line-subtle dark:border-ink-800 p-4 sm:p-5 hover:border-line dark:hover:border-ink-700 transition-colors"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-black text-content dark:text-content-inverted">
              {doc.document_number || "(no number)"}
            </span>
            <span className="text-xs font-bold uppercase tracking-wide px-2 py-0.5 rounded-md bg-surface-sunken dark:bg-ink-800 text-content-muted dark:text-content-subtle">
              {doc.document_type}
            </span>
            {doc.amount != null && (
              <span className="text-sm font-semibold text-content-body dark:text-content-subtle">
                {money(doc.amount)}
              </span>
            )}
          </div>
          <p className="text-sm text-content-muted dark:text-content-subtle mt-1 truncate">
            {doc.client_name || "No client name"}
          </p>

          <div className="flex items-center gap-x-4 gap-y-1 flex-wrap mt-3 text-sm">
            <span className="text-content-body dark:text-content-subtle">
              {sentAt ? `Sent ${shortDate(sentAt)}` : "Not sent"}
            </span>
            {views > 0 ? (
              <span className="inline-flex items-center gap-1.5 font-semibold text-info-700 dark:text-info-400">
                <Eye className="w-4 h-4" />
                Opened {views === 1 ? "once" : `${views}×`}
                {openedAt ? `, first ${shortDate(openedAt)}` : ""}
              </span>
            ) : (
              <span className="text-content-muted dark:text-content-subtle">
                Never opened from the link
              </span>
            )}
          </div>
        </div>

        <div className="text-right flex-shrink-0">
          <p className="text-2xl font-black text-content dark:text-content-inverted leading-none">
            {doc.entries}
          </p>
          <p className="text-[11px] uppercase tracking-wide font-bold text-content-muted dark:text-content-subtle mt-1">
            entries
          </p>
          {witnessed > 0 && (
            <p className="text-[11px] font-bold text-success-700 dark:text-success-400 mt-1">
              {witnessed} witnessed
            </p>
          )}
        </div>
      </div>
    </button>
  );
}

function RecordDialog({ doc, entries, loading, exporting, onExport, onClose }) {
  const strength = useMemo(() => trailStrength(entries), [entries]);
  const reference = useMemo(() => recordReference(entries), [entries]);
  if (!doc) return null;

  return (
    <Dialog open={Boolean(doc)} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[88vh] overflow-y-auto dark:bg-ink-900">
        <DialogHeader>
          <DialogTitle className="text-xl font-black">
            {doc.document_number || "Record"} · {doc.client_name || "No client"}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="py-16 flex justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-content-muted" />
          </div>
        ) : (
          <div className="space-y-5">
            <div className="rounded-xl bg-surface-sunken dark:bg-ink-800 p-4">
              <p className="font-bold text-content dark:text-content-inverted">
                {strength.headline}
              </p>
              <p className="text-sm text-content-body dark:text-content-subtle mt-1">
                {strength.entries} sealed{" "}
                {strength.entries === 1 ? "entry" : "entries"},{" "}
                {strength.witnessed} of which
                {strength.witnessed === 1 ? " was" : " were"} witnessed by
                Invoicium rather than entered by you.
              </p>
              {reference && (
                <p className="text-xs font-mono text-content-muted dark:text-content-subtle mt-2">
                  Record reference {reference}
                </p>
              )}
            </div>

            <ol className="space-y-3">
              {entries.map((e) => (
                <EntryRow key={e.id} entry={e} />
              ))}
            </ol>

            <div className="flex justify-end gap-2 pt-2 border-t border-line-subtle dark:border-ink-800">
              <Button variant="outline" onClick={onClose} className="dark:bg-ink-800">
                Close
              </Button>
              <Button onClick={onExport} disabled={exporting || !entries.length}>
                {exporting ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Download className="w-4 h-4 mr-2" />
                )}
                Download the record
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function EntryRow({ entry }) {
  const witnessed = entry.witnessed;
  return (
    <li className="flex gap-3">
      <div
        className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${
          witnessed ? "bg-success-500" : "bg-line dark:bg-ink-600"
        }`}
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-3 flex-wrap">
          <span className="font-bold text-content dark:text-content-inverted">
            {entry.label}
          </span>
          <span className="text-xs text-content-muted dark:text-content-subtle">
            {longDate(entry.occurred)}
          </span>
        </div>
        {entry.detail && (
          <p className="text-sm text-content-body dark:text-content-subtle mt-0.5">
            {entry.detail}
          </p>
        )}
        <p
          className={`text-xs mt-1 ${
            witnessed
              ? "text-success-700 dark:text-success-400 font-semibold"
              : "text-content-muted dark:text-content-subtle"
          }`}
          title={SOURCE_EXPLAINERS[entry.source]}
        >
          {entry.sourceLabel}
          {entry.backdated &&
            ` · entered ${longDate(entry.recorded)}, after the date shown`}
        </p>
      </div>
    </li>
  );
}

function EmptyState({ hasAny }) {
  return (
    <div className="bg-surface dark:bg-surface-inverted rounded-2xl border border-line-subtle dark:border-ink-800 py-16 px-6 text-center">
      <FileText className="w-10 h-10 mx-auto text-content-muted dark:text-content-subtle mb-3" />
      <h3 className="font-black text-content dark:text-content-inverted">
        {hasAny ? "Nothing matches that" : "Nothing recorded yet"}
      </h3>
      <p className="text-sm text-content-muted dark:text-content-subtle mt-1 max-w-md mx-auto">
        {hasAny
          ? "Try a different filter or search."
          : "Send an invoice or a quote and the record starts building itself. You do not have to turn anything on."}
      </p>
    </div>
  );
}

function Notice({ tone, icon: Icon, title, children }) {
  const warn = tone === "warn";
  return (
    <div
      className={`rounded-2xl border p-4 flex items-start gap-3 ${
        warn
          ? "border-warning-200 dark:border-warning-800 bg-warning-50 dark:bg-warning-900/20"
          : "border-line dark:border-ink-700 bg-surface dark:bg-ink-800"
      }`}
    >
      <Icon
        className={`w-5 h-5 flex-shrink-0 mt-0.5 ${
          warn ? "text-warning-600 dark:text-warning-400" : "text-content-muted"
        }`}
      />
      <div className="text-sm">
        <p className="font-bold text-content dark:text-content-inverted">{title}</p>
        <p className="text-content-body dark:text-content-subtle mt-0.5">{children}</p>
      </div>
    </div>
  );
}

/**
 * The upsell.
 *
 * It leads with the fact that the record already exists, because that is both
 * true -- the database triggers run on every account regardless of plan -- and
 * the only version of this pitch that helps somebody who is in a dispute TODAY.
 * "Upgrade and we will start recording" would be useless to exactly the person
 * most likely to pay.
 */
function LockedPanel() {
  const plan = getMinimumPlanForFeature("paper_trail");
  return (
    <div className="min-h-screen bg-surface-sunken dark:bg-surface-inverted-deep">
      <div className="max-w-2xl mx-auto px-4 py-16">
        <div className="bg-surface dark:bg-surface-inverted rounded-2xl border border-line-subtle dark:border-ink-800 p-8 text-center">
          <div className="w-14 h-14 rounded-2xl bg-content dark:bg-ink-700 flex items-center justify-center mx-auto mb-5">
            <Lock className="w-7 h-7 text-content-inverted" />
          </div>
          <h1 className="text-2xl font-black text-content dark:text-content-inverted">
            Paper Trail
          </h1>
          <p className="text-content-body dark:text-content-subtle mt-3">
            When a client says they never got the invoice, or that they never
            agreed to the quote, this is the answer. Invoicium keeps its own
            record of what you sent, when you sent it, and every time the client
            opened it -- and it is read-only to you, which is exactly why it
            means something to anyone else.
          </p>
          <div className="mt-6 rounded-xl bg-success-50 dark:bg-success-900/20 border border-success-200 dark:border-success-800 p-4 text-left flex gap-3">
            <Sparkles className="w-5 h-5 text-success-600 dark:text-success-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-content-body dark:text-content-subtle">
              <span className="font-bold text-content dark:text-content-inverted">
                Your record is already being kept.
              </span>{" "}
              Invoicium has been recording this for every invoice and quote on
              your account from the day you started, whatever plan you are on.
              Upgrading unlocks reading and exporting it -- including for the
              invoice you are arguing about right now.
            </p>
          </div>
          <Link to={createPageUrl("Pricing")}>
            <Button className="mt-6 h-12 px-6 rounded-xl font-semibold">
              Unlock with {plan}
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
