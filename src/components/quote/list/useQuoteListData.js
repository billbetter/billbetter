import { useEffect, useState } from "react";
import { sdk } from "@/api/sdk";

/**
 * The quote list's rows, loaded on mount and refreshed every 10 seconds so a
 * client's response by SMS shows up without a reload. `loadData(true)` is a
 * refresh (spins the refresh control, keeps the list on screen).
 */
export default function useQuoteListData() {
  const [quotes, setQuotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadData();

    // Auto-refresh every 10 seconds to catch SMS-based status updates
    const interval = setInterval(() => {
      loadData(true);
    }, 10000);

    return () => clearInterval(interval);
  }, []);

  const loadData = async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const user = await sdk.auth.me();

      const quoteData = await sdk.entities.Quote.filter(
        { user_id: user.id },
        "-created_date",
      );

      setQuotes(quoteData);
    } catch (error) {
      console.error("Error loading data:", error);
    }

    setLoading(false);
    setRefreshing(false);
  };

  return { quotes, loading, refreshing, loadData };
}
