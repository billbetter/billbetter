// InvoiceDocumentSimple.jsx
// Minimal invoice layout: generous whitespace, thin rules, no filled bars.
//
// Converted from the upstream TSX draft for this codebase: JSX with JSDoc
// instead of TS types (components.json sets "tsx": false and there is no
// tsconfig), the shared Inter registration from src/lib/invoicePdfFont.js
// instead of its own, and colours from the business theme instead of module
// constants. Layout, spacing and type sizes are unchanged from the draft.
//
// Takes the same InvoiceData shape as InvoiceDocument.jsx, so
// mapInvoiceToPdfData feeds both without a second mapper.

import React from "react";
import { Document, Page, View, Text, StyleSheet } from "@react-pdf/renderer";
import { resolveInvoiceTheme } from "@/lib/invoiceTheme";
import "@/lib/invoicePdfFont";

const makeStyles = (t) =>
  StyleSheet.create({
    page: {
      fontFamily: "Inter",
      fontSize: 10,
      color: t.textColor,
      backgroundColor: t.pageFill,
      padding: 50,
    },
    headerRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
    },
    brand: { fontSize: 14, fontWeight: "bold", letterSpacing: 0.5 },
    metaBlock: { alignItems: "flex-end" },
    metaTitle: { fontSize: 13, fontWeight: "bold" },
    metaLine: { fontSize: 9, color: t.mutedTextColor, marginTop: 2 },
    metaLineValue: { color: t.textColor },

    rule: { borderBottomWidth: 1, borderBottomColor: t.lineColor, marginVertical: 24 },

    billTo: { marginBottom: 30 },
    billLabel: { fontSize: 8, color: t.mutedTextColor, letterSpacing: 1, marginBottom: 4 },
    billName: { fontSize: 11, fontWeight: "bold" },
    billLine: { fontSize: 9.5, color: t.mutedTextColor, marginTop: 1 },

    // The one place the brand colour shows in this layout: the rule under the
    // table head and the one above the total. accentColor falls back to the body
    // colour when the brand colour is too pale to see on the page.
    tableHeader: {
      flexDirection: "row",
      paddingBottom: 8,
      borderBottomWidth: 1,
      borderBottomColor: t.accentColor,
    },
    tableHeadCell: {
      fontSize: 8,
      color: t.mutedTextColor,
      letterSpacing: 0.5,
      textTransform: "uppercase",
    },
    row: {
      flexDirection: "row",
      paddingVertical: 10,
      borderBottomWidth: 0.5,
      borderBottomColor: t.lineColor,
    },
    cell: { fontSize: 10 },
    colDesc: { width: "55%" },
    colQty: { width: "13%", textAlign: "center" },
    colRate: { width: "16%", textAlign: "right" },
    colAmount: { width: "16%", textAlign: "right" },

    totals: { marginTop: 20, alignItems: "flex-end" },
    totalRow: {
      flexDirection: "row",
      width: 180,
      justifyContent: "space-between",
      paddingVertical: 3,
    },
    totalLabel: { fontSize: 9.5, color: t.mutedTextColor },
    totalValue: { fontSize: 9.5 },
    totalRowFinal: {
      flexDirection: "row",
      width: 180,
      justifyContent: "space-between",
      paddingTop: 8,
      marginTop: 4,
      borderTopWidth: 1,
      borderTopColor: t.accentColor,
    },
    totalLabelFinal: { fontSize: 11, fontWeight: "bold" },
    totalValueFinal: { fontSize: 11, fontWeight: "bold" },

    footer: { marginTop: 50, fontSize: 8.5, color: t.mutedTextColor },
    footerLine: { marginTop: 2 },
  });

const money = (n) =>
  `$${Number(n || 0).toLocaleString("en-CA", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

/**
 * @param {import("./InvoiceDocument").InvoiceData} data
 */
export const InvoiceDocumentSimple = (data) => {
  const styles = makeStyles(resolveInvoiceTheme(data.theme));

  const lineItems = Array.isArray(data.lineItems) ? data.lineItems : [];
  const subtotal = lineItems.reduce(
    (sum, li) => sum + Number(li.qty || 0) * Number(li.rate || 0),
    0,
  );
  const tax = subtotal * (data.taxRate ?? 0);
  const total = subtotal + tax;

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.brand}>{data.businessName}</Text>
            <Text style={styles.metaLine}>{data.businessContact}</Text>
          </View>
          <View style={styles.metaBlock}>
            <Text style={styles.metaTitle}>Invoice {data.invoiceNumber}</Text>
            <Text style={styles.metaLine}>
              Issued <Text style={styles.metaLineValue}>{data.invoiceDate}</Text>
            </Text>
            <Text style={styles.metaLine}>
              Due <Text style={styles.metaLineValue}>{data.dueDate}</Text>
            </Text>
          </View>
        </View>

        <View style={styles.rule} />

        <View style={styles.billTo}>
          <Text style={styles.billLabel}>BILLED TO</Text>
          <Text style={styles.billName}>{data.clientName}</Text>
          {data.clientAddress ? (
            <Text style={styles.billLine}>{data.clientAddress}</Text>
          ) : null}
        </View>

        <View style={styles.tableHeader} fixed>
          <Text style={[styles.tableHeadCell, styles.colDesc]}>Description</Text>
          <Text style={[styles.tableHeadCell, styles.colQty]}>Qty</Text>
          <Text style={[styles.tableHeadCell, styles.colRate]}>Rate</Text>
          <Text style={[styles.tableHeadCell, styles.colAmount]}>Amount</Text>
        </View>
        {lineItems.map((li, i) => (
          <View style={styles.row} key={i} wrap={false}>
            <Text style={[styles.cell, styles.colDesc]}>{li.description}</Text>
            <Text style={[styles.cell, styles.colQty]}>{li.qty}</Text>
            <Text style={[styles.cell, styles.colRate]}>{money(li.rate)}</Text>
            <Text style={[styles.cell, styles.colAmount]}>
              {money(Number(li.qty || 0) * Number(li.rate || 0))}
            </Text>
          </View>
        ))}

        <View style={styles.totals} wrap={false}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Subtotal</Text>
            <Text style={styles.totalValue}>{money(subtotal)}</Text>
          </View>
          {data.taxRate ? (
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Tax ({Math.round(data.taxRate * 100)}%)</Text>
              <Text style={styles.totalValue}>{money(tax)}</Text>
            </View>
          ) : null}
          <View style={styles.totalRowFinal}>
            <Text style={styles.totalLabelFinal}>Total</Text>
            <Text style={styles.totalValueFinal}>{money(total)}</Text>
          </View>
        </View>

        <View style={styles.footer}>
          {data.paymentDetails ? (
            <Text style={styles.footerLine}>{data.paymentDetails}</Text>
          ) : null}
          {data.notes ? <Text style={styles.footerLine}>{data.notes}</Text> : null}
          <Text style={styles.footerLine}>Thank you.</Text>
        </View>
      </Page>
    </Document>
  );
};

export default InvoiceDocumentSimple;
