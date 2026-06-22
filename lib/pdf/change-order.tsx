import React from 'react';
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Image,
  renderToBuffer,
} from '@react-pdf/renderer';
import type { LineItem } from '@/lib/supabase/types';
import { formatCents } from '@/lib/domain';

interface ChangeOrderPDFProps {
  orderNumber: number;
  date: string;
  agencyName: string;
  agencyEmail: string;
  logoUrl?: string;
  accentColor?: string;
  clientName: string;
  projectName: string;
  lineItems: LineItem[];
  totalCents: number;
  note?: string;
}

export async function renderChangeOrderPDF(props: ChangeOrderPDFProps): Promise<Buffer> {
  const accent = props.accentColor ?? '#1864ab';

  const styles = StyleSheet.create({
    page: { padding: 48, fontFamily: 'Helvetica', fontSize: 10, color: '#1a1a1a' },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 32 },
    logo: { width: 80, height: 'auto' },
    title: { fontSize: 20, fontFamily: 'Helvetica-Bold', color: accent },
    meta: { fontSize: 9, color: '#555', marginTop: 4 },
    section: { marginBottom: 20 },
    sectionLabel: { fontSize: 8, color: '#888', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 },
    row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 },
    tableHeader: {
      flexDirection: 'row',
      backgroundColor: accent,
      color: '#fff',
      padding: '6 8',
      fontFamily: 'Helvetica-Bold',
      fontSize: 9,
      borderRadius: 2,
      marginBottom: 2,
    },
    tableRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#eee', padding: '5 8' },
    colDescription: { flex: 3 },
    colQty: { flex: 1, textAlign: 'right' },
    colUnit: { flex: 1.5, textAlign: 'right' },
    colTotal: { flex: 1.5, textAlign: 'right' },
    totalLine: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      marginTop: 8,
      paddingTop: 8,
      borderTopWidth: 2,
      borderTopColor: accent,
    },
    totalLabel: { fontFamily: 'Helvetica-Bold', fontSize: 12, marginRight: 24 },
    totalAmount: { fontFamily: 'Helvetica-Bold', fontSize: 12, color: accent },
    noteBox: { backgroundColor: '#f5f5f5', padding: 10, borderRadius: 4, marginTop: 16 },
    signatureBlock: {
      marginTop: 32,
      flexDirection: 'row',
      gap: 40,
    },
    sigLine: { borderTopWidth: 1, borderTopColor: '#aaa', paddingTop: 4, flex: 1 },
    sigLabel: { fontSize: 8, color: '#888' },
    footer: { position: 'absolute', bottom: 32, left: 48, right: 48, flexDirection: 'row', justifyContent: 'space-between' },
    footerText: { fontSize: 8, color: '#aaa' },
  });

  const doc = (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            {props.logoUrl && <Image src={props.logoUrl} style={styles.logo} />}
            <Text style={styles.title}>Change Order #{props.orderNumber}</Text>
            <Text style={styles.meta}>Date: {props.date}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={{ fontFamily: 'Helvetica-Bold' }}>From: {props.agencyName}</Text>
            <Text style={styles.meta}>{props.agencyEmail}</Text>
            <Text style={{ marginTop: 8, fontFamily: 'Helvetica-Bold' }}>To: {props.clientName}</Text>
            <Text style={styles.meta}>Re: {props.projectName}</Text>
          </View>
        </View>

        {/* Line items table */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Scope Change Detail</Text>
          <View style={styles.tableHeader}>
            <Text style={styles.colDescription}>Description</Text>
            <Text style={styles.colQty}>Qty</Text>
            <Text style={styles.colUnit}>Unit Price</Text>
            <Text style={styles.colTotal}>Total</Text>
          </View>
          {props.lineItems.map((item, i) => (
            <View style={styles.tableRow} key={i}>
              <Text style={styles.colDescription}>{item.label}</Text>
              <Text style={styles.colQty}>{item.qty}</Text>
              <Text style={styles.colUnit}>{formatCents(item.unit_cents)}</Text>
              <Text style={styles.colTotal}>{formatCents(item.total_cents)}</Text>
            </View>
          ))}
        </View>

        {/* Total */}
        <View style={styles.totalLine}>
          <Text style={styles.totalLabel}>Total Due</Text>
          <Text style={styles.totalAmount}>{formatCents(props.totalCents)}</Text>
        </View>

        {/* Note */}
        {props.note && (
          <View style={styles.noteBox}>
            <Text style={styles.sectionLabel}>Notes / Terms</Text>
            <Text>{props.note}</Text>
          </View>
        )}

        {/* Signature block */}
        <View style={styles.signatureBlock}>
          <View style={styles.sigLine}>
            <Text style={styles.sigLabel}>Client Approval</Text>
          </View>
          <View style={styles.sigLine}>
            <Text style={styles.sigLabel}>Date</Text>
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>{props.agencyName} · {props.agencyEmail}</Text>
          <Text style={styles.footerText}>Generated by ScopeGuard</Text>
        </View>
      </Page>
    </Document>
  );

  return renderToBuffer(doc);
}
