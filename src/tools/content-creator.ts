/**
 * Content Creator - Multi-platform content from a single brief
 *
 * Takes a topic/brief and generates formatted content for multiple platforms.
 * Pure formatting/structuring tool — the AI brain does the actual writing.
 */

export type Platform = "blog" | "twitter" | "linkedin" | "email" | "instagram";

export interface ContentBrief {
  topic: string;
  tone?: "professional" | "casual" | "witty" | "authoritative" | "friendly";
  audience?: string;
  platforms: Platform[];
  keywords?: string[];
  callToAction?: string;
  maxLength?: Record<Platform, number>;
}

export interface PlatformContent {
  platform: Platform;
  title?: string;
  content: string;
  hashtags?: string[];
  characterCount: number;
  wordCount: number;
  format: string;
}

export interface ContentPackage {
  brief: {
    topic: string;
    tone: string;
    audience: string;
    platforms: Platform[];
  };
  content: PlatformContent[];
  summary: string;
}

const PLATFORM_DEFAULTS: Record<Platform, { maxChars: number; format: string }> = {
  blog: { maxChars: 5000, format: "markdown" },
  twitter: { maxChars: 280, format: "plain text (thread if needed)" },
  linkedin: { maxChars: 3000, format: "professional with line breaks" },
  email: { maxChars: 2000, format: "subject + body" },
  instagram: { maxChars: 2200, format: "casual with emoji + hashtags" },
};

/**
 * Build a structured prompt for the AI to generate multi-platform content.
 * This returns the prompt — the AI brain handles the actual generation.
 */
export function buildContentPrompt(brief: ContentBrief): string {
  const tone = brief.tone || "professional";
  const audience = brief.audience || "general audience";

  let prompt = `Generate content for the following platforms based on this brief:\n\n`;
  prompt += `**Topic:** ${brief.topic}\n`;
  prompt += `**Tone:** ${tone}\n`;
  prompt += `**Target Audience:** ${audience}\n`;

  if (brief.keywords?.length) {
    prompt += `**Keywords to include:** ${brief.keywords.join(", ")}\n`;
  }
  if (brief.callToAction) {
    prompt += `**Call to Action:** ${brief.callToAction}\n`;
  }

  prompt += `\nGenerate content for each platform below. Return as JSON:\n\n`;
  prompt += `{\n  "content": [\n`;

  for (const platform of brief.platforms) {
    const defaults = PLATFORM_DEFAULTS[platform];
    const maxChars = brief.maxLength?.[platform] || defaults.maxChars;

    prompt += `    {\n`;
    prompt += `      "platform": "${platform}",\n`;
    prompt += `      "title": "...",  // For blog/email, null for others\n`;
    prompt += `      "content": "...",  // Max ${maxChars} chars, format: ${defaults.format}\n`;
    prompt += `      "hashtags": ["...", "..."]  // 3-5 relevant hashtags\n`;
    prompt += `    },\n`;
  }

  prompt += `  ]\n}\n\n`;
  prompt += `Rules:\n`;
  prompt += `- Each platform's content should be unique, not just shortened versions\n`;
  prompt += `- Blog: Full article with intro, body, conclusion\n`;
  prompt += `- Twitter: Punchy, hook-driven, thread-ready (use \\n\\n for thread breaks)\n`;
  prompt += `- LinkedIn: Professional storytelling, insight-driven\n`;
  prompt += `- Email: Clear subject line on first line, then body\n`;
  prompt += `- Instagram: Visual-friendly language, relevant hashtags\n`;
  prompt += `- Match the ${tone} tone throughout\n`;

  return prompt;
}

/**
 * Parse the AI-generated content and package it with metadata
 */
export function packageContent(
  brief: ContentBrief,
  rawContent: PlatformContent[] | string
): ContentPackage {
  let content: PlatformContent[];

  if (typeof rawContent === "string") {
    // Try to parse JSON from the AI response
    try {
      const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        content = parsed.content || [];
      } else {
        content = [];
      }
    } catch {
      content = [];
    }
  } else {
    content = rawContent;
  }

  // Enrich with metadata
  const enriched = content.map((item) => ({
    ...item,
    characterCount: (item.content || "").length,
    wordCount: (item.content || "").split(/\s+/).filter(Boolean).length,
    format: PLATFORM_DEFAULTS[item.platform]?.format || "text",
  }));

  return {
    brief: {
      topic: brief.topic,
      tone: brief.tone || "professional",
      audience: brief.audience || "general audience",
      platforms: brief.platforms,
    },
    content: enriched,
    summary: `Generated ${enriched.length} piece(s) of content for: ${brief.platforms.join(", ")}. Topic: "${brief.topic}".`,
  };
}

/**
 * Get the platform constraints for the AI system prompt
 */
export function getPlatformConstraints(platforms: Platform[]): string {
  return platforms
    .map((p) => {
      const d = PLATFORM_DEFAULTS[p];
      return `- ${p}: max ${d.maxChars} chars, format: ${d.format}`;
    })
    .join("\n");
}
