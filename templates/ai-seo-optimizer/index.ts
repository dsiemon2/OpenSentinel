/**
 * AI SEO Optimizer Agent
 *
 * Audits web pages for SEO issues, researches keywords,
 * generates optimized content suggestions, and tracks rankings.
 */

import { configure, chatWithTools, type Message } from "opensentinel";

configure({
  CLAUDE_API_KEY: process.env.CLAUDE_API_KEY || "",
});

interface Page {
  url: string;
  targetKeyword: string;
  title?: string;
  description?: string;
}

interface SEOAudit {
  url: string;
  score: number; // 0-100
  issues: SEOIssue[];
  opportunities: string[];
  optimizedTitle: string;
  optimizedDescription: string;
  contentSuggestions: string[];
  keywordAnalysis: KeywordData;
}

interface SEOIssue {
  severity: "critical" | "warning" | "info";
  category: "technical" | "content" | "meta" | "performance" | "mobile";
  description: string;
  fix: string;
}

interface KeywordData {
  primary: string;
  related: string[];
  questions: string[];
  longTail: string[];
}

// Audit a page for SEO issues
async function auditPage(page: Page): Promise<SEOAudit> {
  // Fetch and analyze the page
  const messages: Message[] = [
    {
      role: "user",
      content: `Perform a comprehensive SEO audit of this page. Fetch the URL and analyze its content.

URL: ${page.url}
Target Keyword: ${page.targetKeyword}
${page.title ? `Current Title: ${page.title}` : ""}
${page.description ? `Current Description: ${page.description}` : ""}

Analyze and return JSON with:

score: 0-100 overall SEO score

issues: array of { severity, category, description, fix } for:
TECHNICAL:
- Missing or incorrect canonical URL
- Broken internal links
- Missing sitemap/robots.txt references
- Slow-loading indicators (large images, no lazy loading)
- Missing HTTPS

CONTENT:
- Keyword density (target: 1-2%)
- Heading structure (H1, H2, H3 hierarchy)
- Content length (thin content < 300 words)
- Missing alt text on images
- Duplicate content signals
- Internal linking opportunities

META:
- Title tag length (optimal: 50-60 chars) and keyword placement
- Meta description length (optimal: 150-160 chars)
- Missing Open Graph tags
- Missing structured data

opportunities: array of quick-win improvements

optimizedTitle: suggested title tag (under 60 chars, keyword near front)
optimizedDescription: suggested meta description (150-160 chars, includes keyword, has CTA)

contentSuggestions: array of content improvements to boost rankings

Return ONLY valid JSON.`,
    },
  ];

  const response = await chatWithTools(messages, "seo-optimizer");

  let parsed: any = {};
  try {
    parsed = JSON.parse(response.content);
  } catch {
    parsed = { score: 50, issues: [], opportunities: [], contentSuggestions: [] };
  }

  // Keyword research
  const keywordData = await researchKeywords(page.targetKeyword);

  return {
    url: page.url,
    score: parsed.score || 50,
    issues: parsed.issues || [],
    opportunities: parsed.opportunities || [],
    optimizedTitle: parsed.optimizedTitle || page.title || "",
    optimizedDescription: parsed.optimizedDescription || page.description || "",
    contentSuggestions: parsed.contentSuggestions || [],
    keywordAnalysis: keywordData,
  };
}

// Research keywords and find related terms
async function researchKeywords(primaryKeyword: string): Promise<KeywordData> {
  const messages: Message[] = [
    {
      role: "user",
      content: `Research this keyword for SEO content planning.

Primary keyword: "${primaryKeyword}"

Search the web to find:
1. Related keywords (semantically similar, same intent)
2. "People also ask" questions about this topic
3. Long-tail keyword variations (3-5 word phrases)
4. Current top-ranking content angles for this keyword

Return JSON with:
- primary: "${primaryKeyword}"
- related: array of 8-10 related keywords
- questions: array of 5-8 questions people ask
- longTail: array of 8-10 long-tail variations

Return ONLY valid JSON.`,
    },
  ];

  const response = await chatWithTools(messages, "seo-optimizer");

  try {
    return JSON.parse(response.content);
  } catch {
    return {
      primary: primaryKeyword,
      related: [],
      questions: [],
      longTail: [],
    };
  }
}

// Generate an SEO-optimized content outline
async function generateContentOutline(
  keyword: string,
  keywordData: KeywordData,
  audit: SEOAudit
): Promise<string> {
  const messages: Message[] = [
    {
      role: "user",
      content: `Create an SEO-optimized content outline to rank for "${keyword}".

Related keywords to include: ${keywordData.related.join(", ")}
Questions to answer: ${keywordData.questions.join("; ")}
Long-tail targets: ${keywordData.longTail.slice(0, 5).join(", ")}

Current page issues: ${audit.contentSuggestions.join("; ")}

Generate:
1. Optimized H1 (includes primary keyword)
2. Full heading structure (H2s and H3s)
3. Key points to cover under each section
4. Where to naturally include keywords (don't keyword stuff)
5. Suggested word count for each section
6. Internal linking opportunities
7. FAQ section based on "People also ask" questions

Format as a clean Markdown outline a writer can follow.`,
    },
  ];

  const response = await chatWithTools(messages, "seo-optimizer");
  return response.content;
}

async function main() {
  console.log("OpenSentinel SEO Optimizer starting...\n");

  // Pages to audit — replace with your own
  const pages: Page[] = [
    {
      url: "https://example.com/blog/ai-agents-guide",
      targetKeyword: "AI agents",
      title: "A Guide to AI Agents",
      description: "Learn about AI agents and how they work.",
    },
    {
      url: "https://example.com/features",
      targetKeyword: "AI automation platform",
    },
  ];

  for (const page of pages) {
    console.log(`\nAuditing: ${page.url}`);
    console.log(`Target keyword: "${page.targetKeyword}"`);
    console.log("-".repeat(60));

    const audit = await auditPage(page);

    // Score
    const scoreBar = "=".repeat(Math.floor(audit.score / 5)) + " ".repeat(20 - Math.floor(audit.score / 5));
    console.log(`\nSEO Score: [${scoreBar}] ${audit.score}/100\n`);

    // Issues by severity
    const critical = audit.issues.filter((i) => i.severity === "critical");
    const warnings = audit.issues.filter((i) => i.severity === "warning");
    const info = audit.issues.filter((i) => i.severity === "info");

    if (critical.length > 0) {
      console.log("CRITICAL ISSUES:");
      for (const issue of critical) {
        console.log(`  [!] ${issue.description}`);
        console.log(`      Fix: ${issue.fix}`);
      }
    }
    if (warnings.length > 0) {
      console.log("WARNINGS:");
      for (const issue of warnings) {
        console.log(`  [*] ${issue.description}`);
        console.log(`      Fix: ${issue.fix}`);
      }
    }

    // Optimized meta
    console.log("\nOPTIMIZED META:");
    console.log(`  Title: ${audit.optimizedTitle}`);
    console.log(`  Description: ${audit.optimizedDescription}`);

    // Keywords
    console.log("\nKEYWORD ANALYSIS:");
    console.log(`  Related: ${audit.keywordAnalysis.related.slice(0, 5).join(", ")}`);
    console.log(`  Questions: ${audit.keywordAnalysis.questions.slice(0, 3).join("; ")}`);
    console.log(`  Long-tail: ${audit.keywordAnalysis.longTail.slice(0, 3).join(", ")}`);

    // Content outline
    console.log("\nCONTENT OUTLINE:");
    const outline = await generateContentOutline(
      page.targetKeyword,
      audit.keywordAnalysis,
      audit
    );
    console.log(outline);
  }
}

main().catch(console.error);
