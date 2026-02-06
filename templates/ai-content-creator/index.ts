/**
 * AI Content Creator Agent
 *
 * Generates blog posts, social media threads, and newsletters
 * from topics, URLs, or raw notes. Adapts tone per platform.
 */

import { configure, chatWithTools, type Message } from "opensentinel";

configure({
  CLAUDE_API_KEY: process.env.CLAUDE_API_KEY || "",
});

interface ContentBrief {
  topic: string;
  audience: string;
  tone: "professional" | "casual" | "technical" | "provocative";
  sourceUrls?: string[];
  notes?: string;
}

interface ContentPack {
  blogPost: string;
  twitterThread: string;
  linkedInPost: string;
  newsletter: string;
  seoTitle: string;
  seoDescription: string;
}

// Research a topic before writing
async function researchTopic(brief: ContentBrief): Promise<string> {
  const sourceContext = brief.sourceUrls?.length
    ? `\n\nAlso research these URLs for additional context:\n${brief.sourceUrls.map((u) => `- ${u}`).join("\n")}`
    : "";

  const messages: Message[] = [
    {
      role: "user",
      content: `Research the following topic for a content piece. Find key facts, data points, recent developments, and interesting angles.

Topic: ${brief.topic}
Target audience: ${brief.audience}
${brief.notes ? `Author notes: ${brief.notes}` : ""}${sourceContext}

Return:
1. Key facts and statistics (with sources)
2. Recent developments (last 30 days)
3. Common misconceptions to address
4. Unique angles not covered by most content
5. Relevant quotes from industry leaders

Be thorough — this research drives all the content.`,
    },
  ];

  const response = await chatWithTools(messages, "content-creator");
  return response.content;
}

// Generate a full content pack from research
async function generateContentPack(
  brief: ContentBrief,
  research: string
): Promise<ContentPack> {
  // Blog post
  const blogMessages: Message[] = [
    {
      role: "user",
      content: `Write a blog post based on this research.

Topic: ${brief.topic}
Audience: ${brief.audience}
Tone: ${brief.tone}

Research:
${research.slice(0, 3000)}

Requirements:
- 800-1200 words
- Strong hook in the first paragraph
- Use subheadings for scannability
- Include 2-3 data points from the research
- End with a clear takeaway or CTA
- Format in Markdown`,
    },
  ];

  const blogResponse = await chatWithTools(blogMessages, "content-creator");

  // Twitter/X thread
  const twitterMessages: Message[] = [
    {
      role: "user",
      content: `Convert this blog content into a Twitter/X thread (7-10 tweets).

Blog: ${blogResponse.content.slice(0, 2000)}

Rules:
- First tweet is the hook (must stop the scroll)
- Each tweet stands alone but flows as a narrative
- Use short sentences and line breaks
- Include 1-2 data points
- Last tweet = CTA or takeaway
- Number each tweet (1/, 2/, etc.)
- No hashtags in the thread body, add 3 relevant ones at the end`,
    },
  ];

  const twitterResponse = await chatWithTools(twitterMessages, "content-creator");

  // LinkedIn post
  const linkedInMessages: Message[] = [
    {
      role: "user",
      content: `Adapt this blog content into a single LinkedIn post.

Blog: ${blogResponse.content.slice(0, 2000)}

Rules:
- 150-250 words
- Open with a bold statement or counterintuitive insight
- Use line breaks generously (LinkedIn favors whitespace)
- Include a personal angle or "lesson learned" framing
- End with a question to drive comments
- Professional but not corporate
- No emojis in headers`,
    },
  ];

  const linkedInResponse = await chatWithTools(linkedInMessages, "content-creator");

  // Newsletter blurb
  const newsletterMessages: Message[] = [
    {
      role: "user",
      content: `Write a newsletter section about this topic. This goes into a weekly digest.

Blog: ${blogResponse.content.slice(0, 2000)}

Format:
- Subject line suggestion (compelling, under 50 chars)
- 3-4 paragraph summary
- "Why it matters" callout
- Link CTA: "Read the full breakdown"
- Conversational tone, like writing to a smart friend`,
    },
  ];

  const newsletterResponse = await chatWithTools(newsletterMessages, "content-creator");

  // SEO metadata
  const seoMessages: Message[] = [
    {
      role: "user",
      content: `Generate SEO metadata for this blog post.

Title of post: ${brief.topic}
Content: ${blogResponse.content.slice(0, 1000)}

Return:
1. SEO title (under 60 characters, include primary keyword)
2. Meta description (under 155 characters, compelling, includes keyword)

Format:
TITLE: [title here]
DESCRIPTION: [description here]`,
    },
  ];

  const seoResponse = await chatWithTools(seoMessages, "content-creator");

  const seoTitle =
    seoResponse.content.match(/TITLE:\s*(.+)/)?.[1] || brief.topic;
  const seoDescription =
    seoResponse.content.match(/DESCRIPTION:\s*(.+)/)?.[1] || "";

  return {
    blogPost: blogResponse.content,
    twitterThread: twitterResponse.content,
    linkedInPost: linkedInResponse.content,
    newsletter: newsletterResponse.content,
    seoTitle,
    seoDescription,
  };
}

async function main() {
  console.log("OpenSentinel Content Creator starting...\n");

  const brief: ContentBrief = {
    topic: "Why AI Agents Will Replace SaaS Dashboards",
    audience:
      "Technical founders, CTOs, and senior engineers building software products",
    tone: "provocative",
    notes:
      "The thesis is that instead of humans checking dashboards, AI agents will monitor, decide, and act autonomously. SaaS becomes the API layer, not the UI layer.",
  };

  // Research
  console.log(`Researching: "${brief.topic}"...\n`);
  const research = await researchTopic(brief);
  console.log("Research complete.\n");

  // Generate all content
  console.log("Generating content pack...\n");
  const pack = await generateContentPack(brief, research);

  // Output
  console.log("=".repeat(60));
  console.log("BLOG POST");
  console.log("=".repeat(60));
  console.log(pack.blogPost);

  console.log("\n" + "=".repeat(60));
  console.log("TWITTER/X THREAD");
  console.log("=".repeat(60));
  console.log(pack.twitterThread);

  console.log("\n" + "=".repeat(60));
  console.log("LINKEDIN POST");
  console.log("=".repeat(60));
  console.log(pack.linkedInPost);

  console.log("\n" + "=".repeat(60));
  console.log("NEWSLETTER SECTION");
  console.log("=".repeat(60));
  console.log(pack.newsletter);

  console.log("\n" + "=".repeat(60));
  console.log("SEO METADATA");
  console.log("=".repeat(60));
  console.log(`Title: ${pack.seoTitle}`);
  console.log(`Description: ${pack.seoDescription}`);
}

main().catch(console.error);
