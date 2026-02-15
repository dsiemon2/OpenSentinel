import { AgentType, AGENT_SYSTEM_PROMPTS, AGENT_TOOL_PERMISSIONS } from "../agent-types";

export const OSINT_AGENT_CONFIG = {
  type: "osint" as AgentType,
  name: "OSINT Agent",
  description: "Specialized agent for open source intelligence gathering, entity investigation, and relationship mapping using public records",

  systemPrompt: AGENT_SYSTEM_PROMPTS.osint,
  tools: AGENT_TOOL_PERMISSIONS.osint,

  settings: {
    maxApiCalls: 50,
    maxEntitiesPerInvestigation: 200,
    requireProvenance: true,
    autoEnrichDepth: 2,
    confidenceThreshold: 0.7,
    sources: ["fec", "irs990", "usaspending", "sec", "opencorporates"],
  },

  outputFormat: {
    sections: [
      "Target Overview",
      "Financial Connections",
      "Organizational Structure",
      "Political Contributions",
      "Government Contracts",
      "Regulatory Filings",
      "Relationship Map",
      "Key Findings",
      "Confidence Assessment",
      "Recommended Next Steps",
    ],
    requireProvenance: true,
    maxLength: 10000,
  },

  strategies: {
    financialTrace: {
      description: "Trace money flows through political and business entities",
      primarySources: ["fec", "usaspending", "irs990"],
    },
    corporateStructure: {
      description: "Map corporate hierarchies and officer networks",
      primarySources: ["opencorporates", "sec"],
    },
    politicalNetwork: {
      description: "Map political donation networks and lobbying connections",
      primarySources: ["fec", "irs990"],
    },
    fullProfile: {
      description: "Comprehensive investigation using all sources",
      primarySources: ["fec", "irs990", "usaspending", "sec", "opencorporates"],
    },
  },
};

export const OSINT_TEMPLATES = {
  personInvestigation: {
    name: "Person Investigation",
    objective: "Build a comprehensive profile of an individual's public financial and organizational connections",
    steps: [
      "Search FEC for political donations",
      "Search OpenCorporates for officer positions",
      "Search SEC for insider transactions",
      "Cross-reference organizations found",
      "Enrich all discovered entities",
      "Build relationship graph",
      "Analyze financial patterns",
      "Generate intelligence report",
    ],
  },
  organizationInvestigation: {
    name: "Organization Investigation",
    objective: "Map an organization's financial flows, government contracts, and leadership network",
    steps: [
      "Search IRS 990 for nonprofit filings and grants",
      "Search USAspending for federal contracts",
      "Search SEC for corporate filings",
      "Search OpenCorporates for corporate structure",
      "Identify officers and board members",
      "Cross-reference with FEC for political activity",
      "Map financial flow graph",
      "Generate intelligence report",
    ],
  },
  financialFlowAnalysis: {
    name: "Financial Flow Analysis",
    objective: "Trace money flows between entities through grants, donations, and contracts",
    steps: [
      "Identify root funding source",
      "Search IRS 990 for grant disbursements",
      "Search USAspending for government funding",
      "Map pass-through organizations",
      "Build Sankey flow graph",
      "Identify concentrations and patterns",
      "Generate financial flow report",
    ],
  },
  politicalInfluenceMapping: {
    name: "Political Influence Mapping",
    objective: "Map political donation networks and organizational influence",
    steps: [
      "Search FEC for donor history",
      "Identify connected committees and PACs",
      "Cross-reference with IRS 990 for nonprofit political activity",
      "Map donor-to-candidate relationships",
      "Identify bundlers and intermediaries",
      "Analyze donation timing patterns",
      "Generate influence map report",
    ],
  },
};

export function validateOSINTOutput(output: string): {
  isValid: boolean;
  issues: string[];
  score: number;
} {
  const issues: string[] = [];
  let score = 100;

  // Check for provenance/source references
  const sourceKeywords = ["source:", "fec", "irs 990", "usaspending", "sec", "opencorporates", "ein:", "cik:"];
  const hasProvenance = sourceKeywords.some((k) => output.toLowerCase().includes(k));
  if (!hasProvenance) {
    issues.push("Missing data source provenance");
    score -= 25;
  }

  // Check for confidence assessment
  if (!output.toLowerCase().includes("confidence")) {
    issues.push("Missing confidence assessment");
    score -= 15;
  }

  // Check for financial data
  const hasFinancialData = /\$[\d,]+/.test(output) || output.toLowerCase().includes("amount");
  if (!hasFinancialData) {
    issues.push("No financial figures cited");
    score -= 10;
  }

  // Check minimum length (OSINT reports should be substantial)
  if (output.length < 1000) {
    issues.push("Investigation output too brief");
    score -= 15;
  }

  // Check for relationship descriptions
  const relationKeywords = ["connected to", "related to", "officer of", "donated to", "funded", "contracted"];
  const hasRelationships = relationKeywords.some((k) => output.toLowerCase().includes(k));
  if (!hasRelationships) {
    issues.push("Missing entity relationship descriptions");
    score -= 10;
  }

  // Check for entity identifiers
  const hasIdentifiers = /\b\d{2}-\d{7}\b/.test(output) || /\bEIN\b/i.test(output) || /\bCIK\b/i.test(output);
  if (!hasIdentifiers) {
    issues.push("No entity identifiers (EIN, CIK) referenced");
    score -= 5;
  }

  return {
    isValid: issues.length === 0,
    issues,
    score: Math.max(0, score),
  };
}

export function buildOSINTPrompt(
  target: string,
  investigationType?: keyof typeof OSINT_TEMPLATES,
  additionalContext?: string
): string {
  let prompt = `Investigation Target: ${target}\n\n`;

  if (investigationType && OSINT_TEMPLATES[investigationType]) {
    const t = OSINT_TEMPLATES[investigationType];
    prompt += `Investigation Type: ${t.name}\n`;
    prompt += `Objective: ${t.objective}\n`;
    prompt += `Steps:\n${t.steps.map((s, i) => `${i + 1}. ${s}`).join("\n")}\n\n`;
  }

  if (additionalContext) {
    prompt += `Additional Context:\n${additionalContext}\n\n`;
  }

  prompt += `Conduct a thorough OSINT investigation following your guidelines. Use osint_search to query public records, osint_enrich to build the knowledge graph, osint_graph to query relationships, and osint_analyze to generate insights. Report findings with provenance and confidence levels.`;

  return prompt;
}

export default {
  OSINT_AGENT_CONFIG,
  OSINT_TEMPLATES,
  validateOSINTOutput,
  buildOSINTPrompt,
};
