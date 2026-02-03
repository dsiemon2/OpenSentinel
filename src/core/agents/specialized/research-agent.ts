import { AgentType, AGENT_SYSTEM_PROMPTS, AGENT_TOOL_PERMISSIONS } from "../agent-types";

export const RESEARCH_AGENT_CONFIG = {
  type: "research" as AgentType,
  name: "Research Agent",
  description: "Specialized agent for thorough research and information gathering",

  systemPrompt: AGENT_SYSTEM_PROMPTS.research,
  tools: AGENT_TOOL_PERMISSIONS.research,

  // Research-specific settings
  settings: {
    maxSearchQueries: 10,
    maxUrlsToVisit: 20,
    requireCitations: true,
    crossReferenceMinSources: 2,
    confidenceLevels: ["high", "medium", "low", "uncertain"],
  },

  // Research output format
  outputFormat: {
    sections: [
      "Executive Summary",
      "Key Findings",
      "Detailed Analysis",
      "Sources",
      "Confidence Assessment",
      "Further Research Suggestions",
    ],
    requireSourceCitations: true,
    maxLength: 5000,
  },

  // Research strategies
  strategies: {
    breadthFirst: {
      description: "Cast a wide net to gather diverse perspectives",
      maxSources: 15,
      depthPerSource: "shallow",
    },
    depthFirst: {
      description: "Deep dive into fewer, more authoritative sources",
      maxSources: 5,
      depthPerSource: "deep",
    },
    balanced: {
      description: "Balance between breadth and depth",
      maxSources: 10,
      depthPerSource: "medium",
    },
  },
};

// Research task templates
export const RESEARCH_TEMPLATES = {
  marketResearch: {
    name: "Market Research",
    objective: "Analyze market trends, competitors, and opportunities",
    sections: [
      "Market Overview",
      "Key Players",
      "Trends & Forecasts",
      "SWOT Analysis",
      "Recommendations",
    ],
  },
  technicalResearch: {
    name: "Technical Research",
    objective: "Deep dive into technical topics and implementations",
    sections: [
      "Overview",
      "Technical Details",
      "Pros & Cons",
      "Best Practices",
      "Code Examples",
      "Resources",
    ],
  },
  competitorAnalysis: {
    name: "Competitor Analysis",
    objective: "Analyze competitors and their strategies",
    sections: [
      "Competitor Overview",
      "Product Comparison",
      "Pricing Analysis",
      "Strengths & Weaknesses",
      "Market Position",
    ],
  },
  literatureReview: {
    name: "Literature Review",
    objective: "Comprehensive review of existing research and publications",
    sections: [
      "Introduction",
      "Methodology",
      "Key Themes",
      "Critical Analysis",
      "Gaps in Research",
      "Bibliography",
    ],
  },
};

// Research quality checkers
export function validateResearchOutput(output: string): {
  isValid: boolean;
  issues: string[];
  score: number;
} {
  const issues: string[] = [];
  let score = 100;

  // Check for citations
  if (!output.includes("Source") && !output.includes("Reference")) {
    issues.push("Missing source citations");
    score -= 20;
  }

  // Check for confidence levels
  if (!output.toLowerCase().includes("confidence")) {
    issues.push("Missing confidence assessment");
    score -= 10;
  }

  // Check minimum length
  if (output.length < 500) {
    issues.push("Research output too brief");
    score -= 15;
  }

  // Check for multiple perspectives
  const perspectiveKeywords = ["however", "alternatively", "on the other hand", "conversely"];
  const hasMultiplePerspectives = perspectiveKeywords.some((k) =>
    output.toLowerCase().includes(k)
  );
  if (!hasMultiplePerspectives) {
    issues.push("May be missing alternative perspectives");
    score -= 10;
  }

  return {
    isValid: issues.length === 0,
    issues,
    score: Math.max(0, score),
  };
}

// Research prompt builder
export function buildResearchPrompt(
  topic: string,
  template?: keyof typeof RESEARCH_TEMPLATES,
  additionalContext?: string
): string {
  let prompt = `Research Topic: ${topic}\n\n`;

  if (template && RESEARCH_TEMPLATES[template]) {
    const t = RESEARCH_TEMPLATES[template];
    prompt += `Research Type: ${t.name}\n`;
    prompt += `Objective: ${t.objective}\n`;
    prompt += `Expected Sections:\n${t.sections.map((s) => `- ${s}`).join("\n")}\n\n`;
  }

  if (additionalContext) {
    prompt += `Additional Context:\n${additionalContext}\n\n`;
  }

  prompt += `Please conduct thorough research following your guidelines and provide a comprehensive report.`;

  return prompt;
}

export default {
  RESEARCH_AGENT_CONFIG,
  RESEARCH_TEMPLATES,
  validateResearchOutput,
  buildResearchPrompt,
};
