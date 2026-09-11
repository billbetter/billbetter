import React from "react";
import PublicLinkControls from "@/components/invoice/PublicLinkControls";

/** Side column: the client-facing link controls. */
export default function QuoteDetailSidebar({
  loadQuoteData,
  quote,
}) {
  return (
    <div className="lg:col-span-1 space-y-6">
      {/*
        The hosted quote page a client actually opens. Until now nothing
        rendered a link to it at all: publicUrl was computed here and never
        used, and public_id was never written in the first place, so the
        page was unreachable even by its owner.
      */}
      <PublicLinkControls
        document={quote}
        kind="quote"
        onChange={loadQuoteData}
      />
    </div>
  );
}
