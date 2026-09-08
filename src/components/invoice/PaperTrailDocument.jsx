// The printable record of delivery and activity.
//
// -- Why this looks nothing like the invoice templates ----------------------
//
// The three invoice layouts exist to make a business look good: their logo,
// their colours, their font. This document has the opposite job. It is read by
// somebody who has a reason to disbelieve it -- the client who says they never
// received anything, or whoever they have asked to look at it -- and a branded,
// designed page reads as marketing produced by the party making the claim.
//
// So: black on white, no theme, no accent colour, one typeface. The business
// name appears as identification rather than as a letterhead. What persuades
// here is the structure of the thing, not its styling.
//
// -- It says what it cannot prove ------------------------------------------
//
// Every row carries who is attesting to it, and the notes at the foot spell
// out the difference in plain words. A record that presented the contractor's
// own "marked as sent" beside the client's observed page-open, with nothing to
// separate them, would invite exactly one question -- and lose the whole
// document when it got asked.

import React from "react";
import { Document, Page, View, Text, StyleSheet } from "@react-pdf/renderer";
import "@/lib/invoicePdfFont";

const INK = "#111827";
const MUTED = "#6b7280";
const LINE = "#d1d5db";
const RULE = "#111827";

const styles = StyleSheet.create({
  page: {
    fontFamily: "Inter",
    fontSize: 9.5,
    color: INK,
    backgroundColor: "#ffffff",
    paddingTop: 44,
    paddingBottom: 60,
    paddingHorizontal: 46,
  },

  title: { fontSize: 17, fontWeight: "bold", letterSpacing: -0.2 },
  subtitle: { fontSize: 9, color: MUTED, marginTop: 3 },
  issuer: { fontSize: 9, color: MUTED, marginTop: 1 },
  headRule: { borderBottomWidth: 1.5, borderBottomColor: RULE, marginTop: 12, marginBottom: 16 },

  sectionLabel: {
    fontSize: 7.5,
    letterSpacing: 1.1,
    color: MUTED,
    fontWeight: "bold",
    marginBottom: 6,
  },

  factGrid: { flexDirection: "row", flexWrap: "wrap", marginBottom: 18 },
  fact: { width: "33.33%", marginBottom: 10, paddingRight: 8 },
  factLabel: { fontSize: 7.5, color: MUTED, letterSpacing: 0.4, marginBottom: 2 },
  factValue: { fontSize: 10, fontWeight: "bold" },

  finding: {
    borderWidth: 1,
    borderColor: LINE,
    padding: 11,
    marginBottom: 18,
  },
  findingHead: { fontSize: 11, fontWeight: "bold", marginBottom: 3 },
  findingBody: { fontSize: 9, color: MUTED, lineHeight: 1.45 },

  tHead: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: RULE,
    paddingBottom: 5,
  },
  tHeadCell: { fontSize: 7.5, letterSpacing: 0.6, color: MUTED, fontWeight: "bold" },
  row: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: LINE,
    paddingVertical: 7,
  },
  cell: { fontSize: 8.5, lineHeight: 1.35 },
  cellMuted: { fontSize: 8, color: MUTED, lineHeight: 1.35 },

  cNo: { width: "6%" },
  cWhen: { width: "22%" },
  cWhat: { width: "44%", paddingRight: 8 },
  cWho: { width: "28%" },

  note: { fontSize: 8, color: MUTED, lineHeight: 1.5, marginBottom: 4 },

  footer: {
    position: "absolute",
    bottom: 26,
    left: 46,
    right: 46,
    borderTopWidth: 0.5,
    borderTopColor: LINE,
    paddingTop: 7,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  footText: { fontSize: 7.5, color: MUTED },
  mono: { fontSize: 7.5, color: INK },
});

/**
 * @param {object} p
 * @param {object} p.doc        one row from paper_trail_summary()
 * @param {Array}  p.rows       entryView() results, oldest first
 * @param {string} p.businessName
 * @param {object} p.summary    trailStrength() result
 * @param {string} p.reference  short record reference
 * @param {object|null} p.chain verifyChain() result
 * @param {string} p.timeZone
 * @param {string} p.generatedAt
 */
export default function PaperTrailDocument({
  doc,
  rows = [],
  businessName,
  summary,
  reference,
  chain,
  timeZone,
  generatedAt,
}) {
  const kindWord = doc?.document_type === "quote" ? "Quote" : "Invoice";

  return (
    <Document
      title={`Record of delivery -- ${doc?.document_number || ""}`}
      author="Invoicium"
    >
      <Page size="A4" style={styles.page}>
        <View>
          <Text style={styles.title}>Record of Delivery and Activity</Text>
          <Text style={styles.subtitle}>
            {kindWord} {doc?.document_number || ""} · {doc?.client_name || "No client recorded"}
          </Text>
          <Text style={styles.issuer}>
            Issued by Invoicium on behalf of {businessName || "the account holder"} ·{" "}
            {generatedAt}
          </Text>
        </View>
        <View style={styles.headRule} />

        <Text style={styles.sectionLabel}>THE DOCUMENT</Text>
        <View style={styles.factGrid}>
          <Fact label="TYPE" value={kindWord} />
          <Fact label="NUMBER" value={doc?.document_number || "--"} />
          <Fact
            label="AMOUNT"
            value={
              doc?.amount == null
                ? "--"
                : `$${Number(doc.amount).toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}`
            }
          />
          <Fact label="CLIENT" value={doc?.client_name || "--"} />
          <Fact label="SENT" value={summary?.sentAtText || "Not recorded as sent"} />
          <Fact
            label="FIRST OPENED BY CLIENT"
            value={summary?.firstOpenedText || "Never opened"}
          />
        </View>

        <View style={styles.finding}>
          <Text style={styles.findingHead}>{summary?.headline}</Text>
          <Text style={styles.findingBody}>
            {rows.length} {rows.length === 1 ? "entry is" : "entries are"} recorded
            below. {summary?.witnessed || 0} of {rows.length} were observed
            directly by Invoicium rather than entered by the account holder --
            these are marked &quot;Invoicium (observed)&quot; and are the entries the
            account holder had no part in creating.
          </Text>
        </View>

        <Text style={styles.sectionLabel}>THE RECORD</Text>
        <View style={styles.tHead}>
          <Text style={[styles.tHeadCell, styles.cNo]}>#</Text>
          <Text style={[styles.tHeadCell, styles.cWhen]}>DATE AND TIME</Text>
          <Text style={[styles.tHeadCell, styles.cWhat]}>WHAT HAPPENED</Text>
          <Text style={[styles.tHeadCell, styles.cWho]}>ATTESTED BY</Text>
        </View>

        {rows.map((r, i) => (
          <View key={r.id || i} style={styles.row} wrap={false}>
            <Text style={[styles.cell, styles.cNo]}>{i + 1}</Text>
            <View style={styles.cWhen}>
              <Text style={styles.cell}>{r.occurredText}</Text>
              {r.backdated && (
                <Text style={styles.cellMuted}>entered {r.recordedText}</Text>
              )}
            </View>
            <View style={styles.cWhat}>
              <Text style={styles.cell}>{r.label}</Text>
              {r.detail ? <Text style={styles.cellMuted}>{r.detail}</Text> : null}
            </View>
            <Text style={[styles.cell, styles.cWho]}>{r.attestation}</Text>
          </View>
        ))}

        <View style={{ marginTop: 18 }}>
          <Text style={styles.sectionLabel}>HOW TO READ THIS</Text>
          <Text style={styles.note}>
            Invoicium (observed) -- Invoicium recorded this itself, from an event
            it saw happen: a request from the client&apos;s own browser for the
            document link, the client&apos;s approval of a quote, or a card payment
            settled by Stripe. The account holder cannot create, alter or
            backdate these.
          </Text>
          <Text style={styles.note}>
            Account holder -- an action taken in Invoicium by the account holder.
            The date and time are Invoicium&apos;s, taken from its own clock at the
            moment the action happened, and cannot be edited afterwards; the
            action itself is theirs. Where a date was entered later than the date
            it refers to, the entry says so.
          </Text>
          <Text style={styles.note}>
            Reconstructed -- rebuilt from the document&apos;s own stored fields when
            this log was first created, and fixed from that point forward. The
            date shown is the one the document was carrying at that time.
          </Text>
          <Text style={[styles.note, { marginTop: 8 }]}>
            Entries cannot be edited or deleted by the account holder, by
            Invoicium staff, or by Invoicium&apos;s own servers: the database refuses
            every such change. Each entry is cryptographically linked to the one
            before it, so removing or altering any entry invalidates every entry
            that follows.
            {chain?.entries
              ? ` This account's chain of ${chain.entries} entries was verified ${
                  chain.intact ? "intact" : "AS BROKEN"
                } when this document was produced.`
              : ""}
          </Text>
          <Text style={styles.note}>
            All times are shown in {timeZone}. Opening the attached PDF copy of
            a document is not recorded; only opening the link is.
          </Text>
        </View>

        <View style={styles.footer} fixed>
          <Text style={styles.footText}>
            Record reference <Text style={styles.mono}>{reference || "--"}</Text> ·
            generated {generatedAt}
          </Text>
          <Text
            style={styles.footText}
            render={({ pageNumber, totalPages }) => `${pageNumber} of ${totalPages}`}
          />
        </View>
      </Page>
    </Document>
  );
}

function Fact({ label, value }) {
  return (
    <View style={styles.fact}>
      <Text style={styles.factLabel}>{label}</Text>
      <Text style={styles.factValue}>{value}</Text>
    </View>
  );
}
