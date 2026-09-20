// Server-only: @react-pdf/renderer components are not React DOM — never import from 'use client' files.
import ReactPDF, { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

// Suppress unused import warning — ReactPDF namespace needed for DocumentProps
void ReactPDF;

const styles = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 10,
    lineHeight: 1.7,
    paddingTop: 72,
    paddingBottom: 72,
    paddingHorizontal: 80,
    color: '#1a1a1a',
  },
  titleBlock: {
    marginBottom: 24,
    alignItems: 'center',
  },
  title: {
    fontSize: 14,
    fontFamily: 'Helvetica-Bold',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 9,
    color: '#555555',
    textAlign: 'center',
    lineHeight: 1.5,
  },
  divider: {
    borderBottomWidth: 1.5,
    borderBottomColor: '#1a1a1a',
    marginVertical: 18,
  },
  thinDivider: {
    borderBottomWidth: 0.5,
    borderBottomColor: '#cccccc',
    marginVertical: 12,
  },
  body: {
    fontSize: 10,
    lineHeight: 1.75,
    whiteSpace: 'pre-wrap',
  },
  footer: {
    position: 'absolute',
    bottom: 40,
    left: 80,
    right: 80,
    borderTopWidth: 0.5,
    borderTopColor: '#cccccc',
    paddingTop: 8,
  },
  footerText: {
    fontSize: 7,
    color: '#999999',
    textAlign: 'center',
  },
  auditRow: {
    flexDirection: 'row',
    marginBottom: 4,
    flexWrap: 'wrap',
  },
  auditLabel: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: '#555555',
    width: 110,
  },
  auditValue: {
    fontSize: 8,
    color: '#1a1a1a',
    flex: 1,
    flexWrap: 'wrap',
  },
  sectionHeader: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 9,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    color: '#555555',
    marginBottom: 6,
    marginTop: 16,
  },
});

interface AgreementPDFProps {
  rawContent: string;
  tenantName: string;
  address: string;
  city: string;
  state: string;
  roomLabel: string;
  agreementId: string;
  status: string;
  // Audit trail
  contentHash?: string | null;
  signedAt?: Date | null;
  signedByIp?: string | null;
  txHash?: string | null;
}

export function AgreementPDF({
  rawContent,
  tenantName,
  address,
  city,
  state,
  roomLabel,
  agreementId,
  status,
  contentHash,
  signedAt,
  txHash,
}: AgreementPDFProps) {
  // Split at paragraph breaks to avoid one giant Text block (pdfkit memory)
  const paragraphs = rawContent.split(/\n\n+/).filter(Boolean);

  return (
    <Document
      title={`Tenancy Agreement — ${tenantName}`}
      author="RentalEase Malaysia"
      subject="Residential Tenancy Agreement"
      creator="RentalEase Malaysia (rentalease.my)"
    >
      <Page size="A4" style={styles.page}>
        {/* Title */}
        <View style={styles.titleBlock}>
          <Text style={styles.title}>Residential Tenancy Agreement</Text>
          <Text style={styles.subtitle}>
            {address}, {city}, {state}{'\n'}
            Room: {roomLabel}{'  ·  '}Tenant: {tenantName}
          </Text>
        </View>

        <View style={styles.divider} />

        {/* Body — rendered as paragraphs for memory efficiency */}
        {paragraphs.map((para, i) => (
          <Text key={i} style={[styles.body, { marginBottom: 6 }]}>
            {para.replace(/\n/g, '\n')}
          </Text>
        ))}

        <View style={styles.divider} />

        {/* Audit trail — only rendered if signed */}
        {contentHash && (
          <View>
            <Text style={styles.sectionHeader}>Signing Audit Trail</Text>
            <View style={styles.auditRow}>
              <Text style={styles.auditLabel}>Document ID</Text>
              <Text style={styles.auditValue}>{agreementId}</Text>
            </View>
            <View style={styles.auditRow}>
              <Text style={styles.auditLabel}>Status</Text>
              <Text style={styles.auditValue}>{status}</Text>
            </View>
            {signedAt && (
              <View style={styles.auditRow}>
                <Text style={styles.auditLabel}>Signed At (UTC)</Text>
                <Text style={styles.auditValue}>{new Date(signedAt).toISOString()}</Text>
              </View>
            )}
            <View style={styles.auditRow}>
              <Text style={styles.auditLabel}>SHA-256 Hash</Text>
              <Text style={styles.auditValue}>{contentHash}</Text>
            </View>
            {txHash && (
              <View style={styles.auditRow}>
                <Text style={styles.auditLabel}>Blockchain Tx</Text>
                <Text style={styles.auditValue}>{txHash}</Text>
              </View>
            )}
          </View>
        )}

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>
            Generated by RentalEase Malaysia  ·  Document ID: {agreementId}  ·  Status: {status}
          </Text>
        </View>
      </Page>
    </Document>
  );
}
