import { useState, useEffect } from "react";
import { sdk } from "@/api/sdk";

/**
 * The quote QuoteDetail shows, and its client, loaded by quote id.
 * `loadQuoteData` reloads both; `setQuote` lets a send mark the quote sent.
 */
export default function useQuoteDetailData(quoteId) {
  const [quote, setQuote] = useState(null);
  const [client, setClient] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (quoteId) {
      loadQuoteData();
    }
  }, [quoteId]);

  const loadQuoteData = async () => {
    setLoading(true);
    setError(null);
    try {
      const user = await sdk.auth.me();

      const [quoteResults, clientResults] = await Promise.all([
        sdk.entities.Quote.filter({ id: quoteId }),
        sdk.entities.Client.filter({ user_id: user.id }),
      ]);

      if (quoteResults.length > 0) {
        const q = quoteResults[0];
        setQuote(q);
        const relatedClient = clientResults.find((c) => c.id === q.client_id);
        setClient(relatedClient || null);
      } else {
        setError("Quote not found.");
      }
    } catch (e) {
      console.error("Error loading quote:", e);
      setError("Failed to load quote details.");
    }
    setLoading(false);
  };

  return { quote, setQuote, client, loading, error, loadQuoteData };
}
