import React from "react";
import { Check, Plus, Search, Sparkles, X } from "lucide-react";
import { initials } from "@/components/billing/quickBill/initials";

/** Step 0: pick a client from the list, search it, or type a new one. */
export default function ClientStep({
  filteredClients,
  isQuote,
  newClientEmail,
  newClientName,
  search,
  selectedClient,
  setNewClientEmail,
  setNewClientName,
  setSearch,
  setSelectedClient,
  setShowNewClient,
  showNewClient,
}) {
  return (
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
  );
}
