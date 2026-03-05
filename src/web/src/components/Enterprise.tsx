import { CSSProperties } from "react";

const CHECK = "\u2705";
const CROSS = "\u274C";

interface FeatureCard {
  title: string;
  description: string;
}

const FEATURES: FeatureCard[] = [
  {
    title: "Authentication",
    description:
      "2FA/TOTP, gateway tokens, per-platform allowlists (7 platforms), RBAC, SSO",
  },
  {
    title: "Encryption",
    description:
      "AES-256 field-level encryption, encrypted vault, GDPR data export & deletion",
  },
  {
    title: "Audit Trail",
    description:
      "Database-backed logging, HMAC-signed tamper-proof entries, queryable by user/action/date",
  },
  {
    title: "Observability",
    description:
      "Prometheus metrics, cost tracking, quality scoring, anomaly detection, circuit breaker",
  },
  {
    title: "Security Controls",
    description:
      "Prompt injection guard, tool sandboxing, OWASP Agentic compliance, rate limiting",
  },
  {
    title: "Infrastructure",
    description:
      "PostgreSQL 16 + pgvector, Redis 7, multi-stage Docker, non-root containers",
  },
];

interface ComparisonRow {
  feature: string;
  opensentinel: string;
  values: boolean[];
}

const COMPARISON: ComparisonRow[] = [
  { feature: "Database (PostgreSQL)", opensentinel: "PostgreSQL", values: [false, false, false, false, false] },
  { feature: "Field Encryption", opensentinel: "AES-256", values: [false, false, false, false, false] },
  { feature: "2FA", opensentinel: "TOTP", values: [false, false, false, false, false] },
  { feature: "RBAC", opensentinel: "Full", values: [false, false, false, false, false] },
  { feature: "SSO", opensentinel: "SAML/OIDC", values: [false, false, false, false, false] },
  { feature: "Audit Logging", opensentinel: "HMAC-signed", values: [false, false, false, false, false] },
  { feature: "GDPR Tools", opensentinel: "Export+Delete", values: [false, false, false, false, false] },
  { feature: "Prompt Injection Guard", opensentinel: "Built-in", values: [false, false, false, false, false] },
  { feature: "Tool Sandboxing", opensentinel: "Full", values: [false, false, false, false, false] },
  { feature: "Prometheus Metrics", opensentinel: "Native", values: [false, false, false, false, false] },
];

const COMPETITORS = ["OpenClaw", "ZeroClaw", "PicoClaw", "Leon", "PyGPT"];

const styles: Record<string, CSSProperties> = {
  container: {
    padding: 24,
    maxWidth: 1200,
    margin: "0 auto",
    color: "var(--text-primary)",
  },
  header: {
    textAlign: "center" as const,
    marginBottom: 40,
  },
  title: {
    fontSize: "2rem",
    fontWeight: 700,
    margin: 0,
    color: "var(--text-primary)",
  },
  subtitle: {
    fontSize: "1.1rem",
    color: "var(--text-secondary)",
    marginTop: 8,
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))",
    gap: 16,
    marginBottom: 48,
  },
  card: {
    background: "var(--bg-secondary)",
    border: "1px solid var(--border)",
    borderRadius: 8,
    padding: 20,
  },
  cardTitle: {
    fontSize: "1.1rem",
    fontWeight: 600,
    color: "var(--accent)",
    margin: 0,
    marginBottom: 8,
  },
  cardDesc: {
    fontSize: "0.9rem",
    color: "var(--text-secondary)",
    margin: 0,
    lineHeight: 1.5,
  },
  sectionTitle: {
    fontSize: "1.4rem",
    fontWeight: 600,
    marginBottom: 16,
    color: "var(--text-primary)",
  },
  tableWrap: {
    overflowX: "auto" as const,
    marginBottom: 48,
  },
  table: {
    width: "100%",
    borderCollapse: "collapse" as const,
    fontSize: "0.9rem",
  },
  th: {
    textAlign: "left" as const,
    padding: "10px 14px",
    borderBottom: "2px solid var(--border)",
    color: "var(--text-secondary)",
    fontWeight: 600,
    whiteSpace: "nowrap" as const,
  },
  thAccent: {
    textAlign: "left" as const,
    padding: "10px 14px",
    borderBottom: "2px solid var(--accent)",
    color: "var(--accent)",
    fontWeight: 700,
    whiteSpace: "nowrap" as const,
  },
  td: {
    padding: "10px 14px",
    borderBottom: "1px solid var(--border)",
    color: "var(--text-primary)",
  },
  tdCenter: {
    padding: "10px 14px",
    borderBottom: "1px solid var(--border)",
    textAlign: "center" as const,
    fontSize: "1rem",
  },
  soc2: {
    background: "var(--bg-tertiary)",
    border: "1px solid var(--accent)",
    borderRadius: 8,
    padding: 24,
    textAlign: "center" as const,
    maxWidth: 480,
    margin: "0 auto",
  },
  soc2Title: {
    fontSize: "1.5rem",
    fontWeight: 700,
    color: "var(--accent)",
    margin: 0,
    marginBottom: 8,
  },
  soc2Note: {
    fontSize: "0.95rem",
    color: "var(--text-secondary)",
    margin: 0,
  },
};

export default function Enterprise() {
  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <h1 style={styles.title}>Enterprise Security &amp; Compliance</h1>
        <p style={styles.subtitle}>
          Production-grade security controls that no other self-hosted AI
          assistant offers
        </p>
      </div>

      {/* Feature Cards */}
      <div style={styles.grid}>
        {FEATURES.map((f) => (
          <div key={f.title} style={styles.card}>
            <h3 style={styles.cardTitle}>{f.title}</h3>
            <p style={styles.cardDesc}>{f.description}</p>
          </div>
        ))}
      </div>

      {/* Comparison Table */}
      <h2 style={styles.sectionTitle}>Comparison vs Competitors</h2>
      <div style={styles.tableWrap}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Feature</th>
              <th style={styles.thAccent}>OpenSentinel</th>
              {COMPETITORS.map((c) => (
                <th key={c} style={styles.th}>
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {COMPARISON.map((row) => (
              <tr key={row.feature}>
                <td style={styles.td}>{row.feature}</td>
                <td style={{ ...styles.tdCenter, color: "#22c55e", fontWeight: 600 }}>
                  {CHECK} {row.opensentinel}
                </td>
                {row.values.map((v, i) => (
                  <td key={i} style={styles.tdCenter}>
                    {v ? CHECK : CROSS}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* SOC 2 Readiness */}
      <div style={styles.soc2}>
        <h3 style={styles.soc2Title}>SOC 2 Ready</h3>
        <p style={styles.soc2Note}>
          26 of 28 Trust Service Criteria controls mapped and implemented
        </p>
      </div>
    </div>
  );
}
