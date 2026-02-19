/**
 * AI Legal Reviewer Agent
 *
 * Reviews contracts and legal documents, flags risks,
 * extracts key terms, and suggests amendments.
 * NOT a substitute for legal counsel.
 */

import { configure, ready, chatWithTools, type Message } from "opensentinel";

configure({
  CLAUDE_API_KEY: process.env.CLAUDE_API_KEY || "",
});
await ready();

interface Contract {
  title: string;
  type: "saas" | "nda" | "employment" | "vendor" | "partnership" | "lease" | "other";
  content: string;
  ourParty: string;
  counterparty: string;
}

interface ContractReview {
  title: string;
  riskLevel: "low" | "medium" | "high";
  summary: string;
  keyTerms: KeyTerm[];
  risks: Risk[];
  missingClauses: string[];
  suggestedAmendments: string[];
  deadlines: Deadline[];
}

interface KeyTerm {
  term: string;
  value: string;
  section: string;
}

interface Risk {
  severity: "critical" | "warning" | "info";
  clause: string;
  description: string;
  recommendation: string;
}

interface Deadline {
  description: string;
  date: string;
  isAutoRenewal: boolean;
}

// Review a contract
async function reviewContract(contract: Contract): Promise<ContractReview> {
  const messages: Message[] = [
    {
      role: "user",
      content: `Review this ${contract.type} contract from the perspective of ${contract.ourParty}.

TITLE: ${contract.title}
OUR PARTY: ${contract.ourParty}
COUNTERPARTY: ${contract.counterparty}
TYPE: ${contract.type}

CONTRACT TEXT:
${contract.content.slice(0, 10000)}

Analyze and return JSON with:

summary: 3-4 sentence plain-English summary of what this contract does

riskLevel: overall "low" | "medium" | "high"

keyTerms: array of { term, value, section } for:
- Payment terms (amount, frequency, net days)
- Contract duration and renewal terms
- Termination conditions and notice periods
- Liability caps
- IP ownership
- Non-compete/non-solicit scope
- Data handling and privacy obligations
- SLA commitments (for SaaS)
- Indemnification scope

risks: array of { severity, clause, description, recommendation } for:
CRITICAL: Unlimited liability, one-sided termination, IP assignment traps, non-compete overreach, auto-renewal without notice
WARNING: Vague performance metrics, missing SLA credits, broad change-of-terms clauses, excessive audit rights
INFO: Standard but negotiable terms, missing nice-to-have clauses

missingClauses: array of clauses that should be present but aren't (e.g., force majeure, dispute resolution, data breach notification)

suggestedAmendments: array of specific amendment language we should propose

deadlines: array of { description, date, isAutoRenewal } for all time-sensitive items

Return ONLY valid JSON.`,
    },
  ];

  const response = await chatWithTools(messages, "legal-reviewer");

  try {
    const parsed = JSON.parse(response.content);
    return {
      title: contract.title,
      riskLevel: parsed.riskLevel || "medium",
      summary: parsed.summary || "",
      keyTerms: parsed.keyTerms || [],
      risks: parsed.risks || [],
      missingClauses: parsed.missingClauses || [],
      suggestedAmendments: parsed.suggestedAmendments || [],
      deadlines: parsed.deadlines || [],
    };
  } catch {
    return {
      title: contract.title,
      riskLevel: "medium",
      summary: response.content.slice(0, 500),
      keyTerms: [],
      risks: [],
      missingClauses: [],
      suggestedAmendments: [],
      deadlines: [],
    };
  }
}

// Compare two contracts (e.g., their version vs our preferred terms)
async function compareContracts(
  theirVersion: string,
  ourTerms: string
): Promise<string> {
  const messages: Message[] = [
    {
      role: "user",
      content: `Compare these two contract versions and highlight the differences.

THEIR VERSION:
${theirVersion.slice(0, 5000)}

OUR PREFERRED TERMS:
${ourTerms.slice(0, 5000)}

For each difference:
1. Which clause differs
2. What they want vs what we want
3. Who benefits more from their version
4. Recommended negotiation position (accept / negotiate / reject)

Format as a clear comparison table.`,
    },
  ];

  const response = await chatWithTools(messages, "legal-reviewer");
  return response.content;
}

async function main() {
  console.log("OpenSentinel Legal Reviewer starting...\n");
  console.log("DISCLAIMER: This is an AI analysis tool, not legal advice.\n");

  // Example contract — replace with your actual contract text
  const contract: Contract = {
    title: "SaaS Service Agreement — CloudTech Platform",
    type: "saas",
    ourParty: "Acme Inc",
    counterparty: "CloudTech Solutions LLC",
    content: `SAAS SERVICE AGREEMENT

This Software as a Service Agreement ("Agreement") is entered into as of January 15, 2026 by and between CloudTech Solutions LLC ("Provider") and Acme Inc ("Customer").

1. SERVICES
Provider shall provide Customer access to the CloudTech Platform ("Service") as described in Exhibit A. Provider may modify the Service at any time with or without notice.

2. FEES AND PAYMENT
Customer shall pay $2,500 per month for up to 100 user seats. Additional seats are $30/user/month. Fees increase automatically by 10% on each anniversary. Payment is due within 15 days of invoice. Late payments accrue interest at 1.5% per month.

3. TERM AND RENEWAL
This Agreement begins on the Effective Date and continues for 24 months ("Initial Term"). The Agreement automatically renews for successive 12-month periods unless either party provides written notice of non-renewal at least 90 days before the end of the current term.

4. TERMINATION
Provider may terminate this Agreement immediately for any reason upon 30 days written notice. Customer may terminate only for material breach with a 60-day cure period. Upon termination, all unpaid fees for the remainder of the term become immediately due.

5. DATA
Provider shall have a worldwide, perpetual, irrevocable license to use, modify, and distribute any data uploaded to the Service for purposes of improving Provider's products and services. Customer data will be deleted 30 days after termination.

6. LIABILITY
PROVIDER'S TOTAL LIABILITY SHALL NOT EXCEED THE FEES PAID BY CUSTOMER IN THE PRIOR 3 MONTHS. IN NO EVENT SHALL PROVIDER BE LIABLE FOR ANY INDIRECT, INCIDENTAL, OR CONSEQUENTIAL DAMAGES.

Customer shall indemnify and hold harmless Provider from any and all claims arising from Customer's use of the Service, without limitation.

7. SLA
Provider targets 99% uptime but makes no guarantees regarding availability. No credits or refunds will be issued for downtime.

8. INTELLECTUAL PROPERTY
Any customizations, integrations, or workflows built by Customer on the Platform shall be owned by Provider.

9. GOVERNING LAW
This Agreement shall be governed by the laws of the State of Delaware. Any disputes shall be resolved exclusively in Provider's local courts.`,
  };

  console.log(`Reviewing: ${contract.title}`);
  console.log(`Our party: ${contract.ourParty} vs ${contract.counterparty}`);
  console.log("-".repeat(60));

  const review = await reviewContract(contract);

  // Risk level
  const riskIcon = review.riskLevel === "high" ? "[!!!]" : review.riskLevel === "medium" ? "[!!]" : "[!]";
  console.log(`\nRisk Level: ${riskIcon} ${review.riskLevel.toUpperCase()}\n`);
  console.log(`Summary: ${review.summary}\n`);

  // Key terms
  if (review.keyTerms.length > 0) {
    console.log("KEY TERMS:");
    for (const term of review.keyTerms) {
      console.log(`  ${term.term}: ${term.value} (${term.section})`);
    }
    console.log();
  }

  // Risks
  if (review.risks.length > 0) {
    console.log("RISKS:");
    for (const risk of review.risks) {
      const icon = risk.severity === "critical" ? "[CRIT]" : risk.severity === "warning" ? "[WARN]" : "[INFO]";
      console.log(`  ${icon} ${risk.clause}`);
      console.log(`        ${risk.description}`);
      console.log(`        -> ${risk.recommendation}`);
    }
    console.log();
  }

  // Missing clauses
  if (review.missingClauses.length > 0) {
    console.log("MISSING CLAUSES:");
    for (const clause of review.missingClauses) {
      console.log(`  [-] ${clause}`);
    }
    console.log();
  }

  // Suggested amendments
  if (review.suggestedAmendments.length > 0) {
    console.log("SUGGESTED AMENDMENTS:");
    for (let i = 0; i < review.suggestedAmendments.length; i++) {
      console.log(`  ${i + 1}. ${review.suggestedAmendments[i]}`);
    }
    console.log();
  }

  // Deadlines
  if (review.deadlines.length > 0) {
    console.log("DEADLINES:");
    for (const d of review.deadlines) {
      const flag = d.isAutoRenewal ? " [AUTO-RENEW]" : "";
      console.log(`  ${d.date}: ${d.description}${flag}`);
    }
  }
}

main().catch(console.error);
