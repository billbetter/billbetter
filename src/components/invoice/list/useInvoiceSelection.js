import { useState } from "react";
import { batchSendEligibility } from "@/lib/invoiceBatch";

/**
 * Which invoices are ticked for a batch send, and what that selection allows.
 *
 * Selection is off until asked for. Checkboxes on every row by default turn
 * a list you mostly READ into a form, and the common action here is opening
 * one invoice, not mailing twelve.
 */
export default function useInvoiceSelection(filteredInvoices) {
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(() => new Set());

  /** Eligibility for every visible invoice, keyed by id. */
  const eligibility = new Map(
    filteredInvoices.map((inv) => [inv.id, batchSendEligibility(inv)]),
  );

  // Selection is kept as ids, so filtering or searching mid-selection cannot
  // silently drop an invoice from the batch. But only what is currently
  // VISIBLE and eligible can actually be sent -- sending something the user
  // can no longer see would be the worse surprise.
  const selectableIds = filteredInvoices
    .filter((inv) => eligibility.get(inv.id)?.ok)
    .map((inv) => inv.id);
  const chosen = filteredInvoices.filter(
    (inv) => selectedIds.has(inv.id) && eligibility.get(inv.id)?.ok,
  );
  const resendCount = chosen.filter(
    (inv) => eligibility.get(inv.id)?.kind === "resend",
  ).length;
  const allSelectableChosen =
    selectableIds.length > 0 && selectableIds.every((id) => selectedIds.has(id));

  const toggleOne = (id) =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const toggleAll = () =>
    setSelectedIds((prev) =>
      allSelectableChosen ? new Set() : new Set([...prev, ...selectableIds]),
    );

  const exitSelectMode = () => {
    setSelectMode(false);
    setSelectedIds(new Set());
  };

  return {
    selectMode,
    setSelectMode,
    selectedIds,
    setSelectedIds,
    eligibility,
    selectableIds,
    chosen,
    resendCount,
    allSelectableChosen,
    toggleOne,
    toggleAll,
    exitSelectMode,
  };
}
