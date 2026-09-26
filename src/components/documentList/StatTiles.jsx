import React from "react";
import KpiCard from "@/components/layout/KpiCard";

/*
 * The figures across the top of a document list page (Invoices, Quotes,
 * Recurring), drawn as the dashboard template's section cards.
 *
 * Value colours are still passed in -- an overdue count is red, paid is green
 * -- because that colour carries meaning. The chip and tile surfaces the old
 * design passed are accepted and ignored: the card is the surface now.
 */

/** One figure in the phone layout's 2x2 grid. `children` is the value. */
export function MobileStatTile({ icon, label, valueClassName, children }) {
  return <KpiCard compact icon={icon} label={label} value={children} valueClassName={valueClassName} />;
}

/** One figure in the desktop row. */
export function DesktopStatTile({ icon, label, valueClassName, children }) {
  return <KpiCard icon={icon} label={label} value={children} valueClassName={valueClassName} />;
}
