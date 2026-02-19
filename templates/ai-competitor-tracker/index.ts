/**
 * AI Competitor Tracker Agent
 *
 * Monitors competitors' products, pricing, features, hiring,
 * and public communications. Generates competitive intelligence reports.
 */

import { configure, ready, chatWithTools, storeMemory, searchMemories, type Message } from "opensentinel";

configure({
  CLAUDE_API_KEY: process.env.CLAUDE_API_KEY || "",
  DATABASE_URL: process.env.DATABASE_URL || "",
});
await ready();

interface Competitor {
  name: string;
  website: string;
  pricingPage?: string;
  changelogPage?: string;
  blogUrl?: string;
  githubOrg?: string;
  twitterHandle?: string;
}

interface CompetitorIntel {
  competitor: Competitor;
  timestamp: Date;
  productUpdates: string[];
  pricingChanges: string[];
  hiringSignals: string[];
  contentStrategy: string;
  strengths: string[];
  weaknesses: string[];
  threatLevel: "low" | "medium" | "high";
}

// Research a competitor
async function gatherIntel(competitor: Competitor): Promise<CompetitorIntel> {
  // Check past intel for comparison
  let pastIntel = "";
  try {
    const memories = await searchMemories(
      competitor.name,
      "competitor-tracker",
      3
    );
    if (memories.length > 0) {
      pastIntel = `\n\nPrevious intel:\n${memories.map((m: any) => `- ${m.content}`).join("\n")}`;
    }
  } catch {
    // Memory optional
  }

  const messages: Message[] = [
    {
      role: "user",
      content: `Research this competitor thoroughly. Use web search to find current information.

COMPETITOR: ${competitor.name}
Website: ${competitor.website}
${competitor.pricingPage ? `Pricing: ${competitor.pricingPage}` : ""}
${competitor.changelogPage ? `Changelog: ${competitor.changelogPage}` : ""}
${competitor.blogUrl ? `Blog: ${competitor.blogUrl}` : ""}
${competitor.githubOrg ? `GitHub: ${competitor.githubOrg}` : ""}
${competitor.twitterHandle ? `Twitter: @${competitor.twitterHandle}` : ""}
${pastIntel}

Research and return JSON with:
- productUpdates: array of recent product changes, new features, or releases (last 30 days)
- pricingChanges: array of any pricing model changes or new tiers
- hiringSignals: array of notable job postings (what roles = what they're building next)
- contentStrategy: one paragraph on their content/marketing approach
- strengths: array of their current advantages
- weaknesses: array of their vulnerabilities or gaps
- threatLevel: "low" | "medium" | "high" based on how directly they compete

Return ONLY valid JSON.`,
    },
  ];

  const response = await chatWithTools(messages, "competitor-tracker");

  try {
    const parsed = JSON.parse(response.content);
    return {
      competitor,
      timestamp: new Date(),
      productUpdates: parsed.productUpdates || [],
      pricingChanges: parsed.pricingChanges || [],
      hiringSignals: parsed.hiringSignals || [],
      contentStrategy: parsed.contentStrategy || "",
      strengths: parsed.strengths || [],
      weaknesses: parsed.weaknesses || [],
      threatLevel: parsed.threatLevel || "medium",
    };
  } catch {
    return {
      competitor,
      timestamp: new Date(),
      productUpdates: [],
      pricingChanges: [],
      hiringSignals: [],
      contentStrategy: response.content.slice(0, 500),
      strengths: [],
      weaknesses: [],
      threatLevel: "medium",
    };
  }
}

// Generate a competitive landscape report
async function generateLandscapeReport(
  intel: CompetitorIntel[],
  ourProduct: string
): Promise<string> {
  const messages: Message[] = [
    {
      role: "user",
      content: `Generate a competitive landscape report.

OUR PRODUCT: ${ourProduct}

COMPETITOR INTEL:
${JSON.stringify(
  intel.map((i) => ({
    name: i.competitor.name,
    threatLevel: i.threatLevel,
    recentUpdates: i.productUpdates.length,
    strengths: i.strengths,
    weaknesses: i.weaknesses,
    hiringFocus: i.hiringSignals,
  })),
  null,
  2
)}

Format:
1. Executive Summary (3 sentences)
2. Threat Matrix (table: Competitor | Threat Level | Key Move | Our Advantage)
3. Feature Gap Analysis — what are competitors building that we're not?
4. Pricing Intelligence — how do we compare?
5. Strategic Recommendations (3-5 specific actions we should take)
6. Opportunities — competitor weaknesses we can exploit

Keep it actionable. Under 500 words.`,
    },
  ];

  const response = await chatWithTools(messages, "competitor-tracker");
  return response.content;
}

async function main() {
  console.log("OpenSentinel Competitor Tracker starting...\n");

  const ourProduct =
    "OpenSentinel — self-hosted AI agent platform with memory, orchestration, and multi-channel deployment";

  // Define competitors — customize for your market
  const competitors: Competitor[] = [
    {
      name: "LangChain",
      website: "https://langchain.com",
      githubOrg: "langchain-ai",
      twitterHandle: "LangChainAI",
      blogUrl: "https://blog.langchain.dev",
    },
    {
      name: "CrewAI",
      website: "https://crewai.com",
      githubOrg: "crewAIInc",
      twitterHandle: "craborado",
    },
    {
      name: "AutoGPT",
      website: "https://agpt.co",
      githubOrg: "Significant-Gravitas",
      twitterHandle: "Auto_GPT",
    },
  ];

  const allIntel: CompetitorIntel[] = [];

  for (const competitor of competitors) {
    console.log(`Researching: ${competitor.name}...`);
    const intel = await gatherIntel(competitor);
    allIntel.push(intel);

    const threat =
      intel.threatLevel === "high" ? "[HIGH]" : intel.threatLevel === "medium" ? "[MED]" : "[LOW]";
    console.log(`  ${threat} ${competitor.name}`);
    console.log(`  Updates: ${intel.productUpdates.length} | Hiring: ${intel.hiringSignals.length}`);
    if (intel.productUpdates.length > 0) {
      console.log(`  Latest: ${intel.productUpdates[0]}`);
    }
    console.log();

    // Store for trend tracking
    try {
      await storeMemory({
        userId: "competitor-tracker",
        content: `${competitor.name} (${new Date().toLocaleDateString()}): Threat=${intel.threatLevel}. Updates: ${intel.productUpdates.slice(0, 2).join("; ")}. Hiring: ${intel.hiringSignals.slice(0, 2).join("; ")}`,
        type: "episodic",
        importance: 7,
        source: "competitor-intel",
      });
    } catch {
      // Memory optional
    }
  }

  // Landscape report
  console.log("=".repeat(60));
  console.log("COMPETITIVE LANDSCAPE REPORT");
  console.log("=".repeat(60));
  const report = await generateLandscapeReport(allIntel, ourProduct);
  console.log(report);
}

main().catch(console.error);
