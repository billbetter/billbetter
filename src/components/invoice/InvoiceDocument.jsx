// InvoiceDocument.jsx
// Renders an Invoicium invoice as a PDF using @react-pdf/renderer.
//
// This renders in the BROWSER, not on a server: the app is a Vite SPA and the
// only backend is Supabase Edge Functions (Deno), where the Node dependencies
// of @react-pdf/renderer do not run. See src/lib/invoicePdf.js for the callers.

import React from "react";
import { resolveInvoiceTheme } from "@/lib/invoiceTheme";
import {
  Document,
  Page,
  View,
  Text,
  Image,
  StyleSheet,
  Font,
} from "@react-pdf/renderer";

// ---- Inter font ----
// Static TTFs live in public/fonts, so these resolve against the app origin at
// runtime. Registered once at module load; react-pdf caches by family name.
Font.register({
  family: "Inter",
  fonts: [
    { src: "/fonts/Inter-Regular.ttf", fontWeight: "normal" },
    { src: "/fonts/Inter-Bold.ttf", fontWeight: "bold" },
    { src: "/fonts/Inter-Italic.ttf", fontWeight: "normal", fontStyle: "italic" },
  ],
  });

// No hyphenation dictionary is loaded for Inter, and the default hyphenator
// splits long line-item descriptions mid-word. Keep words intact instead.
Font.registerHyphenationCallback((word) => [word]);

// Colours come from the business's theme rather than module constants, so the
// StyleSheet has to be built per-render instead of once at module load. Layout,
// spacing and type sizes are untouched -- only colour is themeable.
const makeStyles = (t, fontFamily = "Inter") =>
  StyleSheet.create({
    page: {
      // Per-business. Inter unless the row says otherwise, which is what every
      // PDF rendered as before the font setting was wired to anything -- so a
      // business that never chose one is unchanged.
      fontFamily,
      fontSize: 9.5,
      color: t.textColor,
      backgroundColor: t.pageFill,
      padding: 36,
    },
    headerRow: {
      flexDirection: "row",
      justifyContent: "space-between",
    },
    brand: { fontSize: 17, fontWeight: "bold" },
    // Height only: react-pdf scales the width to match, so a wide wordmark and
    // a square badge both come out the right shape. maxWidth stops a banner
    // logo running under the invoice number on the right.
    logo: { height: 34, maxWidth: 180, objectFit: "contain", marginBottom: 6 },
    small: { fontSize: 9, color: t.mutedTextColor, marginTop: 2 },
    invoiceTitle: { fontSize: 17, fontWeight: "bold", textAlign: "right" },
    metaRow: { fontSize: 9, textAlign: "right", marginTop: 3 },
    metaLabel: { color: t.mutedTextColor },
    metaValue: { fontWeight: "bold" },
    rule: {
      borderBottomWidth: 1,
      borderBottomColor: t.lineColor,
      marginVertical: 14,
    },
    twoCol: { flexDirection: "row", justifyContent: "space-between" },
    col: { width: "48%" },
    label: {
      fontSize: 7.5,
      color: t.mutedTextColor,
      fontWeight: "bold",
      letterSpacing: 1,
      marginBottom: 3,
      textTransform: "uppercase",
    },
    value: { fontSize: 10, marginTop: 1 },
    valueBold: { fontSize: 10, fontWeight: "bold", marginTop: 1 },

    table: { marginTop: 18 },
    tableHeaderRow: {
      flexDirection: "row",
      backgroundColor: t.primaryColor,
      paddingVertical: 6,
      paddingHorizontal: 6,
    },
    tableHeaderCell: { color: t.onPrimaryColor, fontWeight: "bold", fontSize: 9 },
    tableRow: {
      flexDirection: "row",
      paddingVertical: 6,
      paddingHorizontal: 6,
      borderBottomWidth: 0.5,
      borderBottomColor: t.lineColor,
    },
    tableCell: { fontSize: 9.5 },
    colDesc: { width: "50%" },
    colQty: { width: "12%", textAlign: "center" },
    colRate: { width: "19%", textAlign: "right" },
    colAmount: { width: "19%", textAlign: "right" },

    totals: { marginTop: 14, alignItems: "flex-end" },
    totalRow: {
      flexDirection: "row",
      width: 220,
      justifyContent: "space-between",
      paddingVertical: 4,
    },
    totalLabel: { fontSize: 9.5, color: t.mutedTextColor },
    totalValue: { fontSize: 9.5, fontWeight: "bold" },
    grandTotalRow: {
      flexDirection: "row",
      width: 220,
      justifyContent: "space-between",
      backgroundColor: t.primaryColor,
      paddingVertical: 6,
      paddingHorizontal: 8,
      marginTop: 2,
    },
    grandTotalLabel: { fontSize: 10, color: t.onPrimaryColor, fontWeight: "bold" },
    grandTotalValue: { fontSize: 10, color: t.onPrimaryColor, fontWeight: "bold" },

    notes: { marginTop: 24 },
    notesText: { fontSize: 9, color: t.mutedTextColor, fontStyle: "italic", marginTop: 4 },
    footer: {
      marginTop: 30,
      borderTopWidth: 0.5,
      borderTopColor: t.lineColor,
      paddingTop: 10,
      textAlign: "center",
      fontSize: 9,
      color: t.mutedTextColor,
      fontStyle: "italic",
    },
    poweredBy: {
      marginTop: 6,
      textAlign: "center",
      fontSize: 7.5,
      color: t.mutedTextColor,
    },
});

/**
 * @typedef {Object} InvoiceLineItem
 * @property {string} description
 * @property {number} qty
 * @property {number} rate   dollars
 */

/**
 * @typedef {Object} InvoiceData
 * @property {string}  businessName
 * @property {string}  businessAddress
 * @property {string}  businessContact   "phone - email - website"
 * @property {string}  invoiceNumber
 * @property {string}  invoiceDate       pre-formatted, e.g. "Aug 20, 2026"
 * @property {string}  dueDate
 * @property {string}  clientName
 * @property {string} [clientCompany]
 * @property {string} [clientAddress]
 * @property {string} [clientContact]
 * @property {string} [jobLocation]
 * @property {string} [terms]            e.g. "Due on receipt"
 * @property {InvoiceLineItem[]} lineItems
 * @property {number}  taxRate           FRACTION, e.g. 0.13 for 13% -- pass 0 to omit tax.
 *                                       The DB stores Invoice.tax_rate as a PERCENT (13);
 *                                       src/lib/invoicePdfData.js converts it.
 * @property {string} [paymentDetails]
 * @property {string} [notes]
 * @property {import("@/lib/invoiceTheme").InvoiceTheme} [theme]
 *            Per-business colours. Omit for the default black-on-white look.
 */

const money = (n) =>
  `$${Number(n || 0).toLocaleString("en-CA", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

/** @param {InvoiceData} data */
export const InvoiceDocument = (data) => {
  // resolveInvoiceTheme fills every missing or malformed field from the default
  // theme, so an unthemed business renders exactly as it did before.
  const styles = makeStyles(resolveInvoiceTheme(data.theme), data.fontFamily);

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
        {/* Header */}
        <View style={styles.headerRow}>
          <View>
            {/* The contractor's logo and the contractor's name.
                This block used to read "INVOICIUM" at 17pt with the business
                name beneath it in 9pt grey -- so the default template, the one
                most invoices use, was branded for us rather than for the person
                whose work it bills. */}
            {data.logo ? <Image style={styles.logo} src={data.logo} /> : null}
            <Text style={styles.brand}>{data.businessName}</Text>
            <Text style={styles.small}>{data.businessAddress}</Text>
            <Text style={styles.small}>{data.businessContact}</Text>
          </View>
          <View>
            <Text style={styles.invoiceTitle}>{data.documentTitle || "INVOICE"}</Text>
            <Text style={styles.metaRow}>
              <Text style={styles.metaLabel}>{data.documentLabel || "Invoice"} #: </Text>
              <Text style={styles.metaValue}>{data.invoiceNumber}</Text>
            </Text>
            <Text style={styles.metaRow}>
              <Text style={styles.metaLabel}>Date: </Text>
              {data.invoiceDate}
            </Text>
            <Text style={styles.metaRow}>
              <Text style={styles.metaLabel}>{data.dueDateLabel || "Due"}: </Text>
              {data.dueDate}
            </Text>
          </View>
        </View>

        <View style={styles.rule} />

        {/* Bill to / job info */}
        <View style={styles.twoCol}>
          <View style={styles.col}>
            <Text style={styles.label}>Bill To</Text>
            <Text style={styles.valueBold}>{data.clientName}</Text>
            {data.clientCompany ? <Text style={styles.value}>{data.clientCompany}</Text> : null}
            {data.clientAddress ? <Text style={styles.value}>{data.clientAddress}</Text> : null}
            {data.clientContact ? <Text style={styles.value}>{data.clientContact}</Text> : null}
          </View>
          <View style={styles.col}>
            {data.jobLocation ? (
              <>
                <Text style={styles.label}>Job / Service Location</Text>
                <Text style={styles.value}>{data.jobLocation}</Text>
              </>
            ) : null}
            <Text style={[styles.label, { marginTop: data.jobLocation ? 10 : 0 }]}>Terms</Text>
            <Text style={styles.value}>{data.terms ?? "Due on receipt"}</Text>
          </View>
        </View>

        {/* Line items */}
        <View style={styles.table}>
          <View style={styles.tableHeaderRow} fixed>
            <Text style={[styles.tableHeaderCell, styles.colDesc]}>Description</Text>
            <Text style={[styles.tableHeaderCell, styles.colQty]}>Qty</Text>
            <Text style={[styles.tableHeaderCell, styles.colRate]}>Rate</Text>
            <Text style={[styles.tableHeaderCell, styles.colAmount]}>Amount</Text>
          </View>
          {lineItems.map((li, i) => (
            <View style={styles.tableRow} key={i} wrap={false}>
              <Text style={[styles.tableCell, styles.colDesc]}>{li.description}</Text>
              <Text style={[styles.tableCell, styles.colQty]}>{li.qty}</Text>
              <Text style={[styles.tableCell, styles.colRate]}>{money(li.rate)}</Text>
              <Text style={[styles.tableCell, styles.colAmount]}>
                {money(Number(li.qty || 0) * Number(li.rate || 0))}
              </Text>
            </View>
          ))}
        </View>

        {/* Totals -- computed here, not a live field, so the PDF is always self-consistent */}
        <View style={styles.totals} wrap={false}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Subtotal</Text>
            <Text style={styles.totalValue}>{money(subtotal)}</Text>
          </View>
          {data.taxRate ? (
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>HST / Tax ({Math.round(data.taxRate * 100)}%)</Text>
              <Text style={styles.totalValue}>{money(tax)}</Text>
            </View>
          ) : null}
          <View style={styles.grandTotalRow}>
            <Text style={styles.grandTotalLabel}>{data.totalLabel || "Total Due"}</Text>
            <Text style={styles.grandTotalValue}>{money(total)}</Text>
          </View>
        </View>

        {/* Payment details / notes */}
        <View style={styles.notes}>
          {data.paymentDetails ? (
            <>
              <Text style={styles.label}>Payment Details</Text>
              <Text style={styles.value}>{data.paymentDetails}</Text>
            </>
          ) : null}
          {data.notes ? (
            <>
              <Text style={[styles.label, { marginTop: 10 }]}>Notes</Text>
              <Text style={styles.notesText}>{data.notes}</Text>
            </>
          ) : null}
        </View>

        {/* The business's own footer line, from the Footer Message setting --
            a field that existed, saved, and was read by nothing. Falls back to
            the line this template always printed. */}
        <Text style={styles.footer}>
          {data.footerText || "Thank you for your business."}
        </Text>
        {data.showPoweredBy ? (
          <Text style={styles.poweredBy}>Powered by Invoicium</Text>
        ) : null}
      </Page>
    </Document>
  );
};

export default InvoiceDocument;
