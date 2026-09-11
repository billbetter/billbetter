import React from "react";
import { ClipboardList, PlusCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import QuoteCard from "@/components/quote/list/QuoteCard";

/** The phone layout's quote list: one card per quote. */
export default function QuoteCardList({
  filteredQuotes,
  searchTerm,
  setConvertDialog,
  setMobileMenuOpen,
  statusFilter,
}) {
  return (
    <div className="lg:hidden space-y-3">
      {filteredQuotes.length === 0 ? (
        <div className="bg-surface dark:bg-ink-800 rounded-xl border border-line dark:border-ink-700 p-8 text-center shadow-sm">
          <div className="w-16 h-16 rounded-full bg-ink-100 dark:bg-ink-700 flex items-center justify-center mx-auto mb-3">
            <ClipboardList className="w-8 h-8 text-content-subtle dark:text-content-muted" />
          </div>
          <h3 className="text-lg font-black text-content dark:text-content-inverted mb-1">
            {searchTerm || statusFilter !== "all"
              ? "No quotes found"
              : "No quotes yet"}
          </h3>
          <p className="text-sm text-content-muted dark:text-content-subtle mb-4">
            {searchTerm || statusFilter !== "all"
              ? "Adjust your filters"
              : "Create your first quote"}
          </p>
          {!searchTerm && statusFilter === "all" && (
            <Link to={createPageUrl("CreateQuote")}>
              <Button className="h-11 px-6 bg-brand hover:bg-brand-hover text-content-inverted rounded-xl font-semibold">
                <PlusCircle className="w-5 h-5 mr-2" />
                Create Quote
              </Button>
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredQuotes.map((quote) => (
            <QuoteCard
              key={quote.id}
              quote={quote}
              setConvertDialog={setConvertDialog}
              setMobileMenuOpen={setMobileMenuOpen}
            />
          ))}
        </div>
      )}
    </div>
  );
}
