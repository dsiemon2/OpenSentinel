/**
 * AI Social Listener Agent
 *
 * Monitors social media and web mentions of your brand,
 * analyzes sentiment, detects trends, and flags issues.
 */

import { configure, chatWithTools, storeMemory, searchMemories, type Message } from "opensentinel";

configure({
  CLAUDE_API_KEY: process.env.CLAUDE_API_KEY || "",
  DATABASE_URL: process.env.DATABASE_URL || "",
});

interface Brand {
  name: string;
  aliases: string[]; // Alternative names, common misspellings
  competitors: string[];
  keywords: string[]; // Industry terms to monitor
}

interface Mention {
  source: string;
  content: string;
  sentiment: "positive" | "neutral" | "negative";
  reach: "low" | "medium" | "high";
  requiresResponse: boolean;
  suggestedResponse?: string;
}

interface SocialReport {
  brand: string;
  timestamp: Date;
  mentions: Mention[];
  sentimentBreakdown: { positive: number; neutral: number; negative: number };
  trendingTopics: string[];
  competitorMentions: { name: string; sentiment: string; context: string }[];
  alerts: string[];
  opportunities: string[];
}

// Search for brand mentions across platforms
async function findMentions(brand: Brand): Promise<Mention[]> {
  const searchTerms = [brand.name, ...brand.aliases].join('" OR "');

  const messages: Message[] = [
    {
      role: "user",
      content: `Search for recent mentions of "${searchTerms}" across social media and the web.

Search for:
1. Twitter/X posts mentioning "${brand.name}"
2. Reddit threads about "${brand.name}"
3. Hacker News discussions
4. Blog posts or articles
5. GitHub issues or discussions

For each mention found, return JSON array with:
- source: platform/url
- content: the actual text (truncated to 200 chars)
- sentiment: "positive" | "neutral" | "negative"
- reach: "low" (< 100 followers/upvotes) | "medium" (100-1000) | "high" (1000+)
- requiresResponse: boolean (true if it's a question, complaint, or opportunity)

Find at least 5-10 mentions. Return ONLY valid JSON array.`,
    },
  ];

  const response = await chatWithTools(messages, "social-listener");

  try {
    return JSON.parse(response.content);
  } catch {
    return [];
  }
}

// Analyze competitor mentions
async function trackCompetitors(brand: Brand): Promise<{ name: string; sentiment: string; context: string }[]> {
  const messages: Message[] = [
    {
      role: "user",
      content: `Search for recent discussions comparing or mentioning these competitors: ${brand.competitors.join(", ")}

Look for:
1. Comparison posts ("X vs Y")
2. Migration stories ("Switched from X to Y")
3. Complaints about competitors (our opportunities)
4. Praise for competitors (threats to monitor)

Return JSON array of { name, sentiment ("positive"/"negative"/"neutral"), context (one-sentence summary) }.
Return ONLY valid JSON array.`,
    },
  ];

  const response = await chatWithTools(messages, "social-listener");

  try {
    return JSON.parse(response.content);
  } catch {
    return [];
  }
}

// Draft responses for mentions that need them
async function draftResponse(mention: Mention, brand: Brand): Promise<string> {
  const messages: Message[] = [
    {
      role: "user",
      content: `Draft a response to this ${mention.sentiment} mention of ${brand.name}.

Source: ${mention.source}
Content: ${mention.content}

Rules:
- Match the platform's tone (Twitter = concise, Reddit = detailed, HN = technical)
- If negative: acknowledge, don't be defensive, offer help
- If positive: thank them genuinely, amplify
- If question: answer directly, link to docs if relevant
- Never sound like a corporate bot
- Under 280 characters for Twitter, under 200 words for others`,
    },
  ];

  const response = await chatWithTools(messages, "social-listener");
  return response.content;
}

// Detect emerging trends in your space
async function detectTrends(brand: Brand): Promise<string[]> {
  const messages: Message[] = [
    {
      role: "user",
      content: `Search for trending topics in the ${brand.keywords.join(", ")} space.

Look at:
1. Trending GitHub repos in related categories
2. Popular recent posts on relevant subreddits
3. Trending topics on tech Twitter
4. Recent Hacker News front-page items in this space

Return JSON array of trending topic strings (5-10 items).
Each should be specific: "Anthropic's MCP protocol adoption" not "AI is growing".
Return ONLY valid JSON array.`,
    },
  ];

  const response = await chatWithTools(messages, "social-listener");

  try {
    return JSON.parse(response.content);
  } catch {
    return [];
  }
}

async function main() {
  console.log("OpenSentinel Social Listener starting...\n");

  const brand: Brand = {
    name: "OpenSentinel",
    aliases: ["Open Sentinel", "opensentinel"],
    competitors: ["LangChain", "AutoGPT", "CrewAI"],
    keywords: ["AI agents", "autonomous AI", "AI automation", "LLM orchestration"],
  };

  // Find mentions
  console.log(`Searching for mentions of "${brand.name}"...`);
  const mentions = await findMentions(brand);
  console.log(`Found ${mentions.length} mentions\n`);

  // Draft responses for mentions that need them
  for (const mention of mentions) {
    if (mention.requiresResponse) {
      mention.suggestedResponse = await draftResponse(mention, brand);
    }
  }

  // Track competitors
  console.log("Tracking competitor mentions...");
  const competitorMentions = await trackCompetitors(brand);

  // Detect trends
  console.log("Detecting trending topics...");
  const trends = await detectTrends(brand);

  // Compile report
  const positive = mentions.filter((m) => m.sentiment === "positive").length;
  const neutral = mentions.filter((m) => m.sentiment === "neutral").length;
  const negative = mentions.filter((m) => m.sentiment === "negative").length;

  const alerts = mentions
    .filter((m) => m.sentiment === "negative" && m.reach === "high")
    .map((m) => `High-reach negative mention on ${m.source}: ${m.content.slice(0, 100)}`);

  const opportunities = mentions
    .filter((m) => m.sentiment === "positive" && m.reach === "high")
    .map((m) => `Amplify: ${m.content.slice(0, 100)} (${m.source})`);

  // Output
  console.log("\n" + "=".repeat(60));
  console.log("SOCIAL LISTENING REPORT");
  console.log("=".repeat(60));

  console.log(`\nSentiment: ${positive} positive | ${neutral} neutral | ${negative} negative`);

  if (alerts.length > 0) {
    console.log("\nALERTS:");
    for (const alert of alerts) {
      console.log(`  [!] ${alert}`);
    }
  }

  if (opportunities.length > 0) {
    console.log("\nOPPORTUNITIES:");
    for (const opp of opportunities) {
      console.log(`  [+] ${opp}`);
    }
  }

  console.log("\nTRENDING IN YOUR SPACE:");
  for (const trend of trends) {
    console.log(`  - ${trend}`);
  }

  if (competitorMentions.length > 0) {
    console.log("\nCOMPETITOR INTEL:");
    for (const cm of competitorMentions) {
      console.log(`  ${cm.name} (${cm.sentiment}): ${cm.context}`);
    }
  }

  // Show response drafts
  const needsResponse = mentions.filter((m) => m.suggestedResponse);
  if (needsResponse.length > 0) {
    console.log("\nDRAFT RESPONSES:");
    for (const m of needsResponse) {
      console.log(`\n  Source: ${m.source}`);
      console.log(`  Mention: ${m.content.slice(0, 100)}...`);
      console.log(`  Response: ${m.suggestedResponse}`);
    }
  }

  // Store for trend analysis
  try {
    await storeMemory({
      userId: "social-listener",
      content: `Social scan (${new Date().toLocaleDateString()}): ${mentions.length} mentions (${positive}+/${neutral}n/${negative}-). Trends: ${trends.slice(0, 3).join(", ")}`,
      type: "episodic",
      importance: 5,
      source: "social-listening",
    });
  } catch {
    // Memory optional
  }
}

main().catch(console.error);
