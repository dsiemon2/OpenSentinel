/**
 * AI Email Assistant Agent
 *
 * Triages your inbox, categorizes emails, drafts replies,
 * extracts action items, and generates daily email summaries.
 */

import { configure, chatWithTools, type Message } from "opensentinel";

configure({
  CLAUDE_API_KEY: process.env.CLAUDE_API_KEY || "",
});

interface Email {
  id: string;
  from: string;
  to: string;
  subject: string;
  body: string;
  date: Date;
  isRead: boolean;
  hasAttachments: boolean;
}

interface TriagedEmail {
  email: Email;
  category: "urgent" | "important" | "fyi" | "newsletter" | "spam" | "personal";
  priority: number; // 1-5, 1 = highest
  summary: string;
  actionItems: string[];
  draftReply?: string;
  needsReply: boolean;
  suggestedLabel: string;
}

// Triage a single email
async function triageEmail(email: Email, userContext: string): Promise<TriagedEmail> {
  const messages: Message[] = [
    {
      role: "user",
      content: `Triage this email. Return a JSON object.

FROM: ${email.from}
TO: ${email.to}
SUBJECT: ${email.subject}
DATE: ${email.date.toISOString()}
ATTACHMENTS: ${email.hasAttachments ? "Yes" : "No"}

BODY:
${email.body.slice(0, 3000)}

USER CONTEXT: ${userContext}

Return JSON with:
- category: "urgent" | "important" | "fyi" | "newsletter" | "spam" | "personal"
- priority: 1-5 (1 = highest)
- summary: one-sentence summary
- actionItems: array of specific action items extracted from the email
- needsReply: boolean
- suggestedLabel: a Gmail/Outlook style label for organizing

Urgent = needs response within hours (client escalation, outage, deadline today)
Important = needs response within 1-2 days (colleague requests, meeting follow-ups)
FYI = informational, no action needed
Newsletter = marketing, digests, subscriptions

Return ONLY valid JSON.`,
    },
  ];

  const response = await chatWithTools(messages, "email-assistant");

  let parsed: any = {};
  try {
    parsed = JSON.parse(response.content);
  } catch {
    parsed = {
      category: "fyi",
      priority: 3,
      summary: "Could not parse",
      actionItems: [],
      needsReply: false,
      suggestedLabel: "inbox",
    };
  }

  // Draft reply for emails that need one
  let draftReply: string | undefined;
  if (parsed.needsReply) {
    draftReply = await draftEmailReply(email, parsed.summary, userContext);
  }

  return {
    email,
    category: parsed.category,
    priority: parsed.priority,
    summary: parsed.summary,
    actionItems: parsed.actionItems || [],
    draftReply,
    needsReply: parsed.needsReply,
    suggestedLabel: parsed.suggestedLabel,
  };
}

// Draft a reply
async function draftEmailReply(
  email: Email,
  contextSummary: string,
  userContext: string
): Promise<string> {
  const messages: Message[] = [
    {
      role: "user",
      content: `Draft a reply to this email.

FROM: ${email.from}
SUBJECT: ${email.subject}
CONTEXT: ${contextSummary}

ORIGINAL EMAIL:
${email.body.slice(0, 2000)}

USER CONTEXT: ${userContext}

Rules:
- Match the tone of the original (formal -> formal, casual -> casual)
- Be concise — under 100 words for simple replies
- Address every question or request in the original
- Include a clear next step or call to action
- Don't over-apologize or use filler phrases
- Sign off with just a first name`,
    },
  ];

  const response = await chatWithTools(messages, "email-assistant");
  return response.content;
}

// Generate daily inbox summary
async function generateDailySummary(triaged: TriagedEmail[]): Promise<string> {
  const messages: Message[] = [
    {
      role: "user",
      content: `Generate a daily email briefing from these triaged emails.

${JSON.stringify(
  triaged.map((t) => ({
    from: t.email.from,
    subject: t.email.subject,
    category: t.category,
    priority: t.priority,
    summary: t.summary,
    actionItems: t.actionItems,
    needsReply: t.needsReply,
  })),
  null,
  2
)}

Format:
1. One-line overview (e.g., "14 emails: 2 urgent, 5 need replies, 3 newsletters")
2. URGENT section (if any)
3. NEEDS REPLY section with draft summaries
4. ACTION ITEMS compiled across all emails
5. FYI/Newsletter highlights (one line each)

Keep it scannable — this is a morning briefing, not a novel.`,
    },
  ];

  const response = await chatWithTools(messages, "email-assistant");
  return response.content;
}

async function main() {
  console.log("OpenSentinel Email Assistant starting...\n");

  const userContext =
    "I'm a startup founder. My company is called Acme AI. I'm focused on product and fundraising. My assistant handles scheduling.";

  // Example emails — in production, fetch via IMAP
  const emails: Email[] = [
    {
      id: "1",
      from: "investor@vcfirm.com",
      to: "me@acme.ai",
      subject: "Re: Series A follow-up",
      body: "Hi, thanks for the great pitch yesterday. The partners discussed and we'd like to move forward with due diligence. Can you send over your data room link and schedule a call with your CFO this week? We're looking at closing decisions by end of month.",
      date: new Date(),
      isRead: false,
      hasAttachments: false,
    },
    {
      id: "2",
      from: "alerts@monitoring.io",
      to: "me@acme.ai",
      subject: "ALERT: API error rate spike",
      body: "Your API error rate has exceeded 5% threshold. Current rate: 8.2%. Started 15 minutes ago. Top errors: 503 Service Unavailable (72%), 500 Internal Server Error (28%). Affected endpoints: /api/v2/chat, /api/v2/agents.",
      date: new Date(),
      isRead: false,
      hasAttachments: false,
    },
    {
      id: "3",
      from: "sarah@team.acme.ai",
      to: "me@acme.ai",
      subject: "Design review for new dashboard",
      body: "Hey! Attached are the mockups for the new analytics dashboard. Would love your feedback before we start implementation next week. Main changes: new chart components, real-time data widgets, and a redesigned sidebar. Let me know if you want to do a quick walkthrough.",
      date: new Date(),
      isRead: false,
      hasAttachments: true,
    },
    {
      id: "4",
      from: "newsletter@techcrunch.com",
      to: "me@acme.ai",
      subject: "TechCrunch Daily: AI agents are eating SaaS",
      body: "Today's top stories: 1. Anthropic raises $5B Series E. 2. OpenAI launches agent marketplace. 3. Three AI startups hit $1B ARR in under 2 years. Plus: Why the next wave of unicorns will be agent-first...",
      date: new Date(),
      isRead: false,
      hasAttachments: false,
    },
    {
      id: "5",
      from: "mike@bigclient.com",
      to: "me@acme.ai",
      subject: "Contract renewal discussion",
      body: "Our annual contract is up for renewal next month. We've been happy with the product but have some concerns about the recent pricing changes. Can we schedule a call to discuss options? We're considering increasing our seat count from 50 to 200 if the pricing works out.",
      date: new Date(),
      isRead: false,
      hasAttachments: false,
    },
  ];

  // Triage all emails
  const triaged: TriagedEmail[] = [];
  for (const email of emails) {
    console.log(`Triaging: "${email.subject}" from ${email.from}`);
    const result = await triageEmail(email, userContext);
    triaged.push(result);
    console.log(`  -> ${result.category.toUpperCase()} (priority ${result.priority}) ${result.needsReply ? "[NEEDS REPLY]" : ""}`);
    console.log(`     ${result.summary}`);
    if (result.actionItems.length > 0) {
      console.log(`     Actions: ${result.actionItems.join("; ")}`);
    }
    console.log();
  }

  // Sort by priority
  triaged.sort((a, b) => a.priority - b.priority);

  // Daily summary
  console.log("=".repeat(60));
  console.log("DAILY EMAIL BRIEFING");
  console.log("=".repeat(60));
  const summary = await generateDailySummary(triaged);
  console.log(summary);

  // Show draft replies
  const needsReply = triaged.filter((t) => t.draftReply);
  if (needsReply.length > 0) {
    console.log("\n" + "=".repeat(60));
    console.log("DRAFT REPLIES");
    console.log("=".repeat(60));
    for (const t of needsReply) {
      console.log(`\nTo: ${t.email.from}`);
      console.log(`Re: ${t.email.subject}`);
      console.log("-".repeat(40));
      console.log(t.draftReply);
    }
  }
}

main().catch(console.error);
