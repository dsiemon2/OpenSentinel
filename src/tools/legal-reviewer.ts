/**
 * Legal Reviewer — Contract analysis, risk flagging, clause detection
 *
 * Scans text documents for common legal patterns, risky clauses,
 * and provides structured analysis. Not a substitute for legal advice.
 */

export interface LegalAnalysis {
  documentType: string;
  wordCount: number;
  clauses: DetectedClause[];
  risks: RiskFlag[];
  keyTerms: KeyTerm[];
  parties: string[];
  dates: string[];
  amounts: string[];
  score: number; // 0-100, higher = less risky
  recommendations: string[];
  summary: string;
  disclaimer: string;
}

export interface DetectedClause {
  type: string;
  text: string;
  location: number; // approximate word position
  concern: "none" | "low" | "medium" | "high";
}

export interface RiskFlag {
  severity: "low" | "medium" | "high";
  category: string;
  description: string;
  suggestion: string;
}

export interface KeyTerm {
  term: string;
  definition?: string;
  occurrences: number;
}

const RISKY_PATTERNS: Array<{ pattern: RegExp; type: string; severity: RiskFlag["severity"]; description: string; suggestion: string }> = [
  { pattern: /indemnif/i, type: "Indemnification", severity: "high", description: "Indemnification clause found — you may be liable for damages", suggestion: "Review scope of indemnification and ensure mutual indemnification" },
  { pattern: /non.?compete/i, type: "Non-Compete", severity: "high", description: "Non-compete clause restricts future work", suggestion: "Check duration, geographic scope, and reasonableness" },
  { pattern: /auto.?renew/i, type: "Auto-Renewal", severity: "medium", description: "Contract auto-renews — easy to miss cancellation window", suggestion: "Note the cancellation window and set a calendar reminder" },
  { pattern: /liquidated damages/i, type: "Liquidated Damages", severity: "high", description: "Pre-set penalty amount if contract is breached", suggestion: "Verify the amount is reasonable and proportional" },
  { pattern: /unlimited liability/i, type: "Unlimited Liability", severity: "high", description: "No cap on liability exposure", suggestion: "Negotiate a liability cap (typically 1-2x contract value)" },
  { pattern: /sole discretion/i, type: "Sole Discretion", severity: "medium", description: "One party can make unilateral decisions", suggestion: "Request mutual consent or reasonable standard" },
  { pattern: /waive.*right/i, type: "Rights Waiver", severity: "medium", description: "Waiver of rights clause detected", suggestion: "Understand exactly which rights are being waived" },
  { pattern: /intellectual property.*assign/i, type: "IP Assignment", severity: "high", description: "IP assignment clause — may transfer your IP rights", suggestion: "Ensure work-for-hire scope is clearly defined" },
  { pattern: /termination.*without.*cause/i, type: "Termination Without Cause", severity: "medium", description: "Can be terminated without reason", suggestion: "Negotiate notice period and termination fees" },
  { pattern: /confidential/i, type: "Confidentiality", severity: "low", description: "Confidentiality obligations", suggestion: "Review duration and scope of confidentiality requirements" },
  { pattern: /force majeure/i, type: "Force Majeure", severity: "low", description: "Force majeure clause present", suggestion: "Verify it covers relevant scenarios (pandemic, etc.)" },
  { pattern: /governing law/i, type: "Governing Law", severity: "low", description: "Jurisdiction clause found", suggestion: "Ensure the jurisdiction is favorable to you" },
  { pattern: /arbitration/i, type: "Arbitration", severity: "medium", description: "Mandatory arbitration instead of court", suggestion: "Consider whether arbitration is advantageous for your position" },
  { pattern: /non.?solicitation/i, type: "Non-Solicitation", severity: "medium", description: "Restricts hiring/soliciting employees or clients", suggestion: "Check duration and scope" },
  { pattern: /penalty|penalt/i, type: "Penalty Clause", severity: "medium", description: "Penalty clause detected", suggestion: "Verify penalties are reasonable and proportional" },
];

const CLAUSE_PATTERNS: Array<{ pattern: RegExp; type: string }> = [
  { pattern: /payment.*terms|net \d+|due.*upon/i, type: "Payment Terms" },
  { pattern: /warranty|warrant/i, type: "Warranty" },
  { pattern: /limitation of liability/i, type: "Liability Limitation" },
  { pattern: /term.*agreement|effective date/i, type: "Term/Duration" },
  { pattern: /dispute resolution/i, type: "Dispute Resolution" },
  { pattern: /amendment|modif/i, type: "Amendment" },
  { pattern: /assignment/i, type: "Assignment" },
  { pattern: /severability/i, type: "Severability" },
  { pattern: /entire agreement/i, type: "Entire Agreement" },
  { pattern: /notice.*shall.*be/i, type: "Notice Requirements" },
];

/**
 * Analyze a document for legal risks and key clauses
 */
export function reviewDocument(text: string): LegalAnalysis {
  const words = text.split(/\s+/).filter(Boolean);
  const wordCount = words.length;
  let score = 100;

  // Detect document type
  const documentType = detectDocumentType(text);

  // Find risky patterns
  const risks: RiskFlag[] = [];
  for (const rp of RISKY_PATTERNS) {
    if (rp.pattern.test(text)) {
      risks.push({
        severity: rp.severity,
        category: rp.type,
        description: rp.description,
        suggestion: rp.suggestion,
      });
      if (rp.severity === "high") score -= 10;
      else if (rp.severity === "medium") score -= 5;
      else score -= 2;
    }
  }

  // Detect clauses
  const clauses: DetectedClause[] = [];
  const sentences = text.split(/[.!?]+/);
  for (let i = 0; i < sentences.length; i++) {
    const sentence = sentences[i].trim();
    if (sentence.length < 10) continue;

    for (const cp of CLAUSE_PATTERNS) {
      if (cp.pattern.test(sentence)) {
        const risk = risks.find((r) => sentence.toLowerCase().includes(r.category.toLowerCase()));
        clauses.push({
          type: cp.type,
          text: sentence.slice(0, 200),
          location: Math.round((i / sentences.length) * wordCount),
          concern: risk ? risk.severity === "high" ? "high" : risk.severity === "medium" ? "medium" : "low" : "none",
        });
      }
    }
  }

  // Extract parties (look for "Party A", company names, etc.)
  const parties = extractParties(text);

  // Extract dates
  const dates = extractDates(text);

  // Extract monetary amounts
  const amounts = extractAmounts(text);

  // Extract key terms
  const keyTerms = extractKeyTerms(text);

  // Generate recommendations
  const recommendations: string[] = [];
  const highRisks = risks.filter((r) => r.severity === "high");
  if (highRisks.length > 0) {
    recommendations.push(`Review ${highRisks.length} high-risk clause(s): ${highRisks.map((r) => r.category).join(", ")}`);
  }
  if (!risks.some((r) => r.category === "Liability Limitation")) {
    recommendations.push("No liability limitation clause found — consider adding one");
  }
  if (parties.length < 2) {
    recommendations.push("Could not identify both parties — verify all parties are clearly named");
  }
  if (dates.length === 0) {
    recommendations.push("No dates detected — ensure effective date and termination date are specified");
  }

  score = Math.max(0, Math.min(100, score));
  const riskLevel = score >= 80 ? "Low Risk" : score >= 60 ? "Moderate Risk" : "High Risk";

  return {
    documentType,
    wordCount,
    clauses,
    risks,
    keyTerms,
    parties,
    dates,
    amounts,
    score,
    recommendations,
    summary: `${documentType} — ${wordCount} words. Risk Score: ${score}/100 (${riskLevel}). ${risks.length} risk flag(s), ${clauses.length} clause(s) detected.`,
    disclaimer: "This analysis is for informational purposes only and does not constitute legal advice. Consult a qualified attorney for legal matters.",
  };
}

function detectDocumentType(text: string): string {
  const lower = text.toLowerCase();
  if (/employment agreement|employment contract/i.test(lower)) return "Employment Agreement";
  if (/non.?disclosure|nda/i.test(lower)) return "Non-Disclosure Agreement";
  if (/service agreement|services agreement/i.test(lower)) return "Service Agreement";
  if (/terms of service|terms and conditions/i.test(lower)) return "Terms of Service";
  if (/privacy policy/i.test(lower)) return "Privacy Policy";
  if (/lease agreement|rental agreement/i.test(lower)) return "Lease Agreement";
  if (/purchase agreement|sale agreement/i.test(lower)) return "Purchase Agreement";
  if (/license agreement|software license/i.test(lower)) return "License Agreement";
  if (/partnership agreement/i.test(lower)) return "Partnership Agreement";
  if (/contract|agreement/i.test(lower)) return "Contract/Agreement";
  return "General Document";
}

function extractParties(text: string): string[] {
  const parties: string[] = [];
  const patterns = [
    /(?:between|by and between)\s+["']?([A-Z][A-Za-z\s&,]+?)["']?\s+(?:and|,)/gi,
    /(?:party\s*[ab"']?\s*[:]\s*)([A-Z][A-Za-z\s&,]+)/gi,
    /(?:hereinafter|referred to as)\s+["']([^"']+)["']/gi,
  ];

  for (const pattern of patterns) {
    const matches = text.matchAll(pattern);
    for (const match of matches) {
      if (match[1]) parties.push(match[1].trim());
    }
  }

  return [...new Set(parties)].slice(0, 10);
}

function extractDates(text: string): string[] {
  const datePatterns = [
    /\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/g,
    /\b\d{4}-\d{2}-\d{2}\b/g,
    /\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}\b/gi,
  ];

  const dates: string[] = [];
  for (const pattern of datePatterns) {
    const matches = text.match(pattern);
    if (matches) dates.push(...matches);
  }
  return [...new Set(dates)].slice(0, 10);
}

function extractAmounts(text: string): string[] {
  const amountPattern = /\$[\d,]+(?:\.\d{2})?|\b\d{1,3}(?:,\d{3})*(?:\.\d{2})?\s*(?:dollars|USD)\b/gi;
  const matches = text.match(amountPattern);
  return matches ? [...new Set(matches)].slice(0, 10) : [];
}

function extractKeyTerms(text: string): KeyTerm[] {
  const legalTerms = [
    "indemnification", "liability", "termination", "confidentiality",
    "warranty", "breach", "force majeure", "arbitration", "jurisdiction",
    "intellectual property", "assignment", "amendment", "severability",
    "damages", "negligence", "compliance", "representation",
  ];

  const lower = text.toLowerCase();
  return legalTerms
    .map((term) => {
      const count = (lower.match(new RegExp(term, "gi")) || []).length;
      return { term, occurrences: count };
    })
    .filter((t) => t.occurrences > 0)
    .sort((a, b) => b.occurrences - a.occurrences);
}
