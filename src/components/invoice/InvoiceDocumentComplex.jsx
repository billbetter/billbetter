// InvoiceDocumentComplex.jsx
// Detailed invoice layout: logo block, PO/job refs, grouped line-item sections,
// per-section subtotals, multiple tax lines, discount, payment-details box,
// terms, signature lines, and page numbers in the footer.
//
// Converted from the upstream TSX draft for this codebase: JSX with JSDoc
// instead of TS types, the shared Inter registration from
// src/lib/invoicePdfFont.js, and colours from the business theme instead of
// module constants. Layout, spacing and type sizes are unchanged.
//
// NOTE: this template takes a RICHER shape than the other two -- `sections` and
// `taxes` arrays rather than a flat `lineItems` + single `taxRate`. Several of
// its fields have no column behind them yet (see mapInvoiceToComplexPdfData in
// src/lib/invoicePdfData.js), so they render empty or as an em dash until the
// schema grows to carry them.

import React from "react";
import { Document, Page, View, Text, Image, StyleSheet } from "@react-pdf/renderer";
import { resolveInvoiceTheme } from "@/lib/invoiceTheme";
import "@/lib/invoicePdfFont";

// Colour roles in this layout:
//   primaryColor   -> filled bars (section titles, the grand-total row)
//   onPrimaryColor -> text sitting on those bars, auto black or white
//   accentColor    -> strong structural borders, falls back when primary is pale
//   subtleFill     -> the tinted table-head band
const makeStyles = (t, fontFamily = "Inter") =>
  StyleSheet.create({
    page: {
      // Per-business; Inter is the previous hardcoded value, so an untouched
      // row renders exactly as before.
      fontFamily,
      fontSize: 8.5,
      color: t.textColor,
      backgroundColor: t.pageFill,
      padding: 34,
      paddingBottom: 60,
    },

    headerRow: { flexDirection: "row", justifyContent: "space-between" },
    logoBox: {
      width: 46,
      height: 46,
      borderWidth: 1,
      borderColor: t.accentColor,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 6,
    },
    logoText: { fontSize: 7, color: t.mutedTextColor, textAlign: "center" },
    // The real logo, when there is one. Height-only so the aspect ratio holds.
    logo: { height: 46, maxWidth: 170, objectFit: "contain", marginBottom: 6 },
    brand: { fontSize: 15, fontWeight: "bold" },
    small: { fontSize: 8, color: t.mutedTextColor, marginTop: 1 },

    infoBox: { borderWidth: 1, borderColor: t.accentColor, padding: 8, width: 220 },
    infoTitle: { fontSize: 13, fontWeight: "bold", textAlign: "right", marginBottom: 6 },
    infoRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      paddingVertical: 1.5,
      borderBottomWidth: 0.5,
      borderBottomColor: t.lineColor,
    },
    infoRowLast: {
      flexDirection: "row",
      justifyContent: "space-between",
      paddingVertical: 1.5,
    },
    infoLabel: { fontSize: 7.5, color: t.mutedTextColor },
    infoValue: { fontSize: 7.5, fontWeight: "bold" },

    rule: { borderBottomWidth: 1.5, borderBottomColor: t.accentColor, marginVertical: 14 },

    threeCol: { flexDirection: "row", justifyContent: "space-between" },
    col: { width: "31%" },
    label: {
      fontSize: 7,
      color: t.mutedTextColor,
      fontWeight: "bold",
      letterSpacing: 0.8,
      marginBottom: 3,
      textTransform: "uppercase",
    },
    value: { fontSize: 8.5, marginTop: 1 },
    valueBold: { fontSize: 9, fontWeight: "bold" },

    sectionTitleRow: {
      flexDirection: "row",
      backgroundColor: t.primaryColor,
      paddingVertical: 5,
      paddingHorizontal: 6,
      marginTop: 12,
    },
    sectionTitle: { color: t.onPrimaryColor, fontSize: 8.5, fontWeight: "bold" },
    tableHeadRow: {
      flexDirection: "row",
      backgroundColor: t.subtleFill,
      paddingVertical: 4,
      paddingHorizontal: 6,
    },
    tableHeadCell: { fontSize: 7.5, color: t.mutedTextColor, fontWeight: "bold" },
    row: {
      flexDirection: "row",
      paddingVertical: 4.5,
      paddingHorizontal: 6,
      borderBottomWidth: 0.5,
      borderBottomColor: t.lineColor,
    },
    cell: { fontSize: 8.5 },
    colDesc: { width: "46%" },
    colQty: { width: "12%", textAlign: "center" },
    colUnit: { width: "14%", textAlign: "right" },
    colRate: { width: "14%", textAlign: "right" },
    colAmount: { width: "14%", textAlign: "right" },
    sectionSubtotalRow: {
      flexDirection: "row",
      justifyContent: "flex-end",
      paddingVertical: 4,
      paddingHorizontal: 6,
    },
    sectionSubtotalLabel: { fontSize: 8, color: t.mutedTextColor, marginRight: 20 },
    sectionSubtotalValue: { fontSize: 8, fontWeight: "bold" },

    totalsWrap: { flexDirection: "row", justifyContent: "space-between", marginTop: 18 },
    bankBox: { width: "48%", borderWidth: 1, borderColor: t.lineColor, padding: 10 },
    bankTitle: { fontSize: 7.5, fontWeight: "bold", letterSpacing: 0.8, marginBottom: 5 },
    bankLine: { fontSize: 8, color: t.mutedTextColor, marginTop: 2 },

    totalsBox: { width: "44%" },
    totalRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 3 },
    totalLabel: { fontSize: 8.5, color: t.mutedTextColor },
    totalValue: { fontSize: 8.5 },
    grandRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      backgroundColor: t.primaryColor,
      paddingVertical: 6,
      paddingHorizontal: 8,
      marginTop: 4,
    },
    grandLabel: { fontSize: 9.5, color: t.onPrimaryColor, fontWeight: "bold" },
    grandValue: { fontSize: 9.5, color: t.onPrimaryColor, fontWeight: "bold" },

    termsWrap: { marginTop: 20 },
    termsTitle: { fontSize: 7.5, fontWeight: "bold", letterSpacing: 0.8, marginBottom: 4 },
    termsText: { fontSize: 7.5, color: t.mutedTextColor, lineHeight: 1.5 },

    sigWrap: { flexDirection: "row", justifyContent: "space-between", marginTop: 30 },
    sigCol: { width: "45%" },
    sigLine: { borderBottomWidth: 1, borderBottomColor: t.accentColor, height: 28 },
    sigLabel: { fontSize: 7.5, color: t.mutedTextColor, marginTop: 3 },

    footer: {
      position: "absolute",
      bottom: 24,
      left: 34,
      right: 34,
      flexDirection: "row",
      justifyContent: "space-between",
      borderTopWidth: 0.5,
      borderTopColor: t.lineColor,
      paddingTop: 6,
    },
    footerText: { fontSize: 7, color: t.mutedTextColor },
    // The business's own footer message, above the fixed page-number bar.
    ownFooter: {
      marginTop: 18,
      fontSize: 8,
      color: t.mutedTextColor,
      textAlign: "center",
    },
    poweredBy: {
      marginTop: 4,
      fontSize: 7,
      color: t.mutedTextColor,
      textAlign: "center",
    },
  });

/**
 * @typedef {Object} ComplexLineItem
 * @property {string}  description
 * @property {number}  qty
 * @property {string} [unit]   e.g. "hrs", "sq ft", "ea"
 * @property {number}  rate
 */

/**
 * @typedef {Object} ComplexSection
 * @property {string} title             e.g. "Materials", "Labour"
 * @property {ComplexLineItem[]} lineItems
 */

/**
 * @typedef {Object} TaxLine
 * @property {string} label   e.g. "GST (5%)"
 * @property {number} rate    FRACTION, e.g. 0.05
 */

/**
 * @typedef {Object} ComplexInvoiceData
 * @property {string}  businessName
 * @property {string}  businessAddress
 * @property {string}  businessContact
 * @property {string} [businessNumber]  GST/HST registration number
 * @property {string}  invoiceNumber
 * @property {string}  invoiceDate
 * @property {string}  dueDate
 * @property {string} [poNumber]
 * @property {string} [jobReference]
 * @property {string}  clientName
 * @property {string} [clientCompany]
 * @property {string} [clientAddress]
 * @property {string} [clientContact]
 * @property {string} [jobLocation]
 * @property {string} [projectManager]
 * @property {ComplexSection[]} sections
 * @property {{label: string, amount: number}} [discount]  flat dollar amount
 * @property {TaxLine[]} taxes
 * @property {string[]} [bankDetails]
 * @property {string} [terms]
 * @property {boolean} [requireSignature]
 * @property {import("@/lib/invoiceTheme").InvoiceTheme} [theme]
 */

const money = (n) =>
  `$${Number(n || 0).toLocaleString("en-CA", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const lineTotal = (li) => Number(li?.qty || 0) * Number(li?.rate || 0);

/** @param {ComplexInvoiceData} data */
export const InvoiceDocumentComplex = (data) => {
  const styles = makeStyles(resolveInvoiceTheme(data.theme), data.fontFamily);

  const sections = Array.isArray(data.sections) ? data.sections : [];
  const taxes = Array.isArray(data.taxes) ? data.taxes : [];

  const sectionSubtotals = sections.map((sec) =>
    (Array.isArray(sec?.lineItems) ? sec.lineItems : []).reduce(
      (sum, li) => sum + lineTotal(li),
      0,
    ),
  );
  const subtotal = sectionSubtotals.reduce((a, b) => a + b, 0);
  const discountAmount = Number(data.discount?.amount || 0);
  // Tax is charged on the discounted amount, not the gross.
  const taxableBase = subtotal - discountAmount;
  const taxAmounts = taxes.map((t) => taxableBase * Number(t?.rate || 0));
  const total = taxableBase + taxAmounts.reduce((a, b) => a + b, 0);

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        {/* Header */}
        <View style={styles.headerRow}>
          <View>
            {/* The real logo when one is uploaded. This was a bordered box
                containing the word "LOGO" -- printed on the actual PDF a client
                received, not a design placeholder someone forgot in a mock.
                With no logo it now renders nothing rather than an empty box
                announcing the absence. */}
            {data.logo ? <Image style={styles.logo} src={data.logo} /> : null}
            <Text style={styles.brand}>{data.businessName}</Text>
            <Text style={styles.small}>{data.businessAddress}</Text>
            <Text style={styles.small}>{data.businessContact}</Text>
            {data.businessNumber ? (
              <Text style={styles.small}>GST/HST #: {data.businessNumber}</Text>
            ) : null}
          </View>

          <View>
            <Text style={styles.infoTitle}>{data.documentTitle || "INVOICE"}</Text>
            <View style={styles.infoBox}>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>{data.documentLabel || "Invoice"} #</Text>
                <Text style={styles.infoValue}>{data.invoiceNumber}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Date</Text>
                <Text style={styles.infoValue}>{data.invoiceDate}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>{data.dueDateLabel || "Due"}</Text>
                <Text style={styles.infoValue}>{data.dueDate}</Text>
              </View>
              {data.poNumber ? (
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>PO #</Text>
                  <Text style={styles.infoValue}>{data.poNumber}</Text>
                </View>
              ) : null}
              <View style={styles.infoRowLast}>
                <Text style={styles.infoLabel}>Job Ref</Text>
                <Text style={styles.infoValue}>{data.jobReference ?? "—"}</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.rule} />

        {/* Bill to / job / PM */}
        <View style={styles.threeCol}>
          <View style={styles.col}>
            <Text style={styles.label}>Bill To</Text>
            <Text style={styles.valueBold}>{data.clientName}</Text>
            {data.clientCompany ? <Text style={styles.value}>{data.clientCompany}</Text> : null}
            {data.clientAddress ? <Text style={styles.value}>{data.clientAddress}</Text> : null}
            {data.clientContact ? <Text style={styles.value}>{data.clientContact}</Text> : null}
          </View>
          <View style={styles.col}>
            <Text style={styles.label}>Job Location</Text>
            <Text style={styles.value}>{data.jobLocation ?? "Same as billing address"}</Text>
          </View>
          <View style={styles.col}>
            <Text style={styles.label}>Project Manager</Text>
            <Text style={styles.value}>{data.projectManager ?? "—"}</Text>
          </View>
        </View>

        {/* Grouped line items */}
        {sections.map((sec, si) => (
          <View key={si}>
            <View style={styles.sectionTitleRow} wrap={false}>
              <Text style={styles.sectionTitle}>{sec?.title}</Text>
            </View>
            <View style={styles.tableHeadRow} wrap={false}>
              <Text style={[styles.tableHeadCell, styles.colDesc]}>Description</Text>
              <Text style={[styles.tableHeadCell, styles.colQty]}>Qty</Text>
              <Text style={[styles.tableHeadCell, styles.colUnit]}>Unit</Text>
              <Text style={[styles.tableHeadCell, styles.colRate]}>Rate</Text>
              <Text style={[styles.tableHeadCell, styles.colAmount]}>Amount</Text>
            </View>
            {(Array.isArray(sec?.lineItems) ? sec.lineItems : []).map((li, i) => (
              <View style={styles.row} key={i} wrap={false}>
                <Text style={[styles.cell, styles.colDesc]}>{li.description}</Text>
                <Text style={[styles.cell, styles.colQty]}>{li.qty}</Text>
                <Text style={[styles.cell, styles.colUnit]}>{li.unit ?? "ea"}</Text>
                <Text style={[styles.cell, styles.colRate]}>{money(li.rate)}</Text>
                <Text style={[styles.cell, styles.colAmount]}>{money(lineTotal(li))}</Text>
              </View>
            ))}
            <View style={styles.sectionSubtotalRow}>
              <Text style={styles.sectionSubtotalLabel}>Section Subtotal</Text>
              <Text style={styles.sectionSubtotalValue}>{money(sectionSubtotals[si])}</Text>
            </View>
          </View>
        ))}

        {/* Totals + payment details */}
        <View style={styles.totalsWrap} wrap={false}>
          <View style={styles.bankBox}>
            <Text style={styles.bankTitle}>PAYMENT DETAILS</Text>
            {(data.bankDetails ?? []).map((line, i) => (
              <Text style={styles.bankLine} key={i}>
                {line}
              </Text>
            ))}
          </View>

          <View style={styles.totalsBox}>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Subtotal</Text>
              <Text style={styles.totalValue}>{money(subtotal)}</Text>
            </View>
            {data.discount ? (
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>{data.discount.label}</Text>
                <Text style={styles.totalValue}>-{money(discountAmount)}</Text>
              </View>
            ) : null}
            {taxes.map((t, i) => (
              <View style={styles.totalRow} key={i}>
                <Text style={styles.totalLabel}>{t.label}</Text>
                <Text style={styles.totalValue}>{money(taxAmounts[i])}</Text>
              </View>
            ))}
            <View style={styles.grandRow}>
              <Text style={styles.grandLabel}>{data.totalLabel || "Total Due"}</Text>
              <Text style={styles.grandValue}>{money(total)}</Text>
            </View>
          </View>
        </View>

        {data.terms ? (
          <View style={styles.termsWrap}>
            <Text style={styles.termsTitle}>TERMS &amp; CONDITIONS</Text>
            <Text style={styles.termsText}>{data.terms}</Text>
          </View>
        ) : null}

        {data.requireSignature ? (
          <View style={styles.sigWrap} wrap={false}>
            <View style={styles.sigCol}>
              <View style={styles.sigLine} />
              <Text style={styles.sigLabel}>Contractor Signature / Date</Text>
            </View>
            <View style={styles.sigCol}>
              <View style={styles.sigLine} />
              <Text style={styles.sigLabel}>Client Signature / Date</Text>
            </View>
          </View>
        ) : null}

        {data.footerText ? (
          <Text style={styles.ownFooter}>{data.footerText}</Text>
        ) : null}
        {data.showPoweredBy ? (
          <Text style={styles.poweredBy}>Powered by Invoicium</Text>
        ) : null}

        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>
            {data.businessName} — {data.documentLabel || "Invoice"} {data.invoiceNumber}
          </Text>
          <Text
            style={styles.footerText}
            render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
          />
        </View>
      </Page>
    </Document>
  );
};

export default InvoiceDocumentComplex;
