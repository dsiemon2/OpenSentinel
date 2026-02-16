/**
 * DNS Lookup — Domain information and DNS record analysis
 *
 * Query DNS records, WHOIS-like info, and check propagation.
 * Uses shell dig/nslookup commands on the server.
 */

import { executeCommand } from "./shell";

export interface DNSResult {
  domain: string;
  records: DNSRecord[];
  summary: string;
  queriedAt: string;
}

export interface DNSRecord {
  type: string;
  name: string;
  value: string;
  ttl?: number;
}

export interface DomainInfo {
  domain: string;
  ip?: string;
  mx: string[];
  ns: string[];
  txt: string[];
  cname?: string;
  hasSSL: boolean;
  hasSPF: boolean;
  hasDKIM: boolean;
  hasDMARC: boolean;
  summary: string;
}

/**
 * Look up DNS records for a domain
 */
export async function lookupDNS(
  domain: string,
  recordTypes?: string[]
): Promise<DNSResult> {
  const types = recordTypes || ["A", "AAAA", "MX", "NS", "TXT", "CNAME"];
  const records: DNSRecord[] = [];

  for (const type of types) {
    try {
      const result = await executeCommand(`dig +short ${type} ${domain}`);
      if (result.success && result.stdout.trim()) {
        const lines = result.stdout.trim().split("\n").filter(Boolean);
        for (const line of lines) {
          records.push({
            type,
            name: domain,
            value: line.trim().replace(/\.$/,""),
          });
        }
      }
    } catch {
      // dig not available or failed
    }
  }

  return {
    domain,
    records,
    summary: `${domain}: Found ${records.length} DNS record(s) across ${types.length} type(s).`,
    queriedAt: new Date().toISOString(),
  };
}

/**
 * Get comprehensive domain info including email security
 */
export async function getDomainInfo(domain: string): Promise<DomainInfo> {
  const dns = await lookupDNS(domain, ["A", "MX", "NS", "TXT", "CNAME"]);

  const ip = dns.records.find((r) => r.type === "A")?.value;
  const mx = dns.records.filter((r) => r.type === "MX").map((r) => r.value);
  const ns = dns.records.filter((r) => r.type === "NS").map((r) => r.value);
  const txt = dns.records.filter((r) => r.type === "TXT").map((r) => r.value);
  const cname = dns.records.find((r) => r.type === "CNAME")?.value;

  const hasSPF = txt.some((t) => t.includes("v=spf1"));
  const hasDMARC = await checkDMARC(domain);
  const hasDKIM = await checkDKIM(domain);

  // Quick SSL check
  let hasSSL = false;
  try {
    const sslCheck = await executeCommand(`echo | timeout 5 openssl s_client -connect ${domain}:443 -servername ${domain} 2>/dev/null | head -1`);
    hasSSL = sslCheck.success && sslCheck.stdout.includes("CONNECTED");
  } catch {
    hasSSL = false;
  }

  const issues: string[] = [];
  if (!hasSPF) issues.push("No SPF record");
  if (!hasDMARC) issues.push("No DMARC record");
  if (!hasSSL) issues.push("No SSL/TLS");
  if (mx.length === 0) issues.push("No MX records");

  return {
    domain,
    ip,
    mx,
    ns,
    txt,
    cname,
    hasSSL,
    hasSPF,
    hasDKIM,
    hasDMARC,
    summary: `${domain}: IP ${ip || "N/A"}, ${mx.length} MX, ${ns.length} NS, SSL: ${hasSSL ? "Yes" : "No"}, SPF: ${hasSPF ? "Yes" : "No"}, DMARC: ${hasDMARC ? "Yes" : "No"}. ${issues.length > 0 ? "Issues: " + issues.join(", ") : "All checks passed."}`,
  };
}

async function checkDMARC(domain: string): Promise<boolean> {
  try {
    const result = await executeCommand(`dig +short TXT _dmarc.${domain}`);
    return result.success && result.stdout.includes("v=DMARC1");
  } catch {
    return false;
  }
}

async function checkDKIM(domain: string): Promise<boolean> {
  // Check common DKIM selectors
  const selectors = ["default", "google", "selector1", "selector2", "mail", "dkim"];
  for (const sel of selectors) {
    try {
      const result = await executeCommand(`dig +short TXT ${sel}._domainkey.${domain}`);
      if (result.success && result.stdout.includes("v=DKIM1")) return true;
    } catch {
      continue;
    }
  }
  return false;
}
