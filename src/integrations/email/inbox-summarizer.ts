import { chat } from "../../core/brain";
import type { EmailMessage } from "./imap-client";
import { parseEmail, groupIntoThreads, cleanSubject, parseEmailBody } from "./email-parser";
import type { ParsedEmail, EmailThread } from "./email-parser";

export interface InboxSummary {
  totalEmails: number;
  unreadCount: number;
  importantCount: number;
  categories: CategorySummary[];
  urgentItems: UrgentItem[];
  actionItems: ActionItem[];
  summary: string;
  generatedAt: Date;
}

export interface CategorySummary {
  name: string;
  count: number;
  unreadCount: number;
  topSenders: string[];
  description: string;
}

export interface UrgentItem {
  emailId: string;
  subject: string;
  from: string;
  reason: string;
  suggestedAction: string;
}

export interface ActionItem {
  emailId: string;
  subject: string;
  from: string;
  action: string;
  priority: "high" | "medium" | "low";
  dueDate?: Date;
  context: string;
}

export interface EmailCategorization {
  category: string;
  confidence: number;
  reason: string;
}

export interface ThreadSummary {
  threadId: string;
  subject: string;
  participantCount: number;
  messageCount: number;
  summary: string;
  currentStatus: string;
  nextSteps: string[];
  keyDecisions: string[];
  openQuestions: string[];
}

const CATEGORIZATION_PROMPT = `You are an email categorization assistant. Analyze the following email and categorize it.

Categories:
- urgent: Time-sensitive, requires immediate attention
- action_required: Requires a response or action from the user
- informational: FYI, newsletters, updates that don't require action
- meeting: Calendar invites, meeting-related emails
- financial: Invoices, receipts, financial statements
- social: Personal emails, social notifications
- marketing: Promotional emails, newsletters
- support: Customer support, help desk emails
- work: Work-related emails that aren't urgent
- spam: Potential spam or unwanted emails

Email:
From: {{from}}
Subject: {{subject}}
Date: {{date}}
Snippet: {{snippet}}

Respond in JSON format:
{
  "category": "category_name",
  "confidence": 0.0-1.0,
  "reason": "brief explanation"
}`;

const ACTION_EXTRACTION_PROMPT = `You are an email assistant that extracts action items. Analyze the following email and identify any actions the recipient needs to take.

Email:
From: {{from}}
Subject: {{subject}}
Date: {{date}}
Body: {{body}}

For each action item found, provide:
- action: A clear, concise description of what needs to be done
- priority: high (urgent/deadline), medium (important but not urgent), or low (when convenient)
- dueDate: If a specific date/time is mentioned (ISO format or null)
- context: Brief context from the email

Respond in JSON format:
{
  "actions": [
    {
      "action": "description",
      "priority": "high|medium|low",
      "dueDate": "ISO date or null",
      "context": "brief context"
    }
  ]
}

If no actions are required, return: { "actions": [] }`;

const INBOX_SUMMARY_PROMPT = `You are an email assistant providing a daily inbox summary. Based on the following email statistics and categories, provide a brief, helpful summary.

Statistics:
- Total emails: {{totalEmails}}
- Unread: {{unreadCount}}
- Important: {{importantCount}}

Categories:
{{categories}}

Urgent items:
{{urgentItems}}

Provide a 2-3 sentence summary that:
1. Highlights the most important items requiring attention
2. Notes any patterns or notable senders
3. Suggests prioritization if there are many items

Keep it concise and actionable.`;

const THREAD_SUMMARY_PROMPT = `You are an email assistant that summarizes email threads. Analyze the following email thread and provide a comprehensive summary.

Thread: {{subject}}
Participants: {{participants}}
Messages: {{messageCount}}

Messages (oldest to newest):
{{messages}}

Provide a summary including:
1. Brief summary of the entire conversation (2-3 sentences)
2. Current status of the discussion
3. Key decisions made (if any)
4. Open questions that need resolution
5. Suggested next steps

Respond in JSON format:
{
  "summary": "conversation summary",
  "currentStatus": "status description",
  "keyDecisions": ["decision 1", "decision 2"],
  "openQuestions": ["question 1", "question 2"],
  "nextSteps": ["step 1", "step 2"]
}`;

/**
 * Categorize a single email using AI
 */
export async function categorizeEmail(email: EmailMessage | ParsedEmail): Promise<EmailCategorization> {
  const parsed = "metadata" in email ? email : parseEmail(email);

  const fromDisplay = parsed.from[0]
    ? `${parsed.from[0].name || ""} <${parsed.from[0].address}>`.trim()
    : "Unknown";

  const prompt = CATEGORIZATION_PROMPT
    .replace("{{from}}", fromDisplay)
    .replace("{{subject}}", parsed.subject)
    .replace("{{date}}", parsed.date.toISOString())
    .replace("{{snippet}}", parsed.body.snippet);

  try {
    const response = await chat(
      [{ role: "user", content: prompt }],
      "You are a helpful email categorization assistant. Always respond with valid JSON."
    );

    const result = JSON.parse(response.content);
    return {
      category: result.category || "informational",
      confidence: result.confidence || 0.5,
      reason: result.reason || "",
    };
  } catch (err) {
    console.error("Failed to categorize email:", err);
    return {
      category: "informational",
      confidence: 0.5,
      reason: "Failed to categorize",
    };
  }
}

/**
 * Extract action items from an email using AI
 */
export async function extractActionItems(email: EmailMessage | ParsedEmail): Promise<ActionItem[]> {
  const parsed = "metadata" in email ? email : parseEmail(email);

  const fromDisplay = parsed.from[0]
    ? `${parsed.from[0].name || ""} <${parsed.from[0].address}>`.trim()
    : "Unknown";

  // Parse the email body to get just the new content (not quoted parts)
  const bodyParts = parseEmailBody(parsed.body.text);
  const relevantBody = bodyParts.newContent || parsed.body.text.substring(0, 2000);

  const prompt = ACTION_EXTRACTION_PROMPT
    .replace("{{from}}", fromDisplay)
    .replace("{{subject}}", parsed.subject)
    .replace("{{date}}", parsed.date.toISOString())
    .replace("{{body}}", relevantBody);

  try {
    const response = await chat(
      [{ role: "user", content: prompt }],
      "You are a helpful email assistant that extracts action items. Always respond with valid JSON."
    );

    const result = JSON.parse(response.content);

    return (result.actions || []).map((action: {
      action: string;
      priority: string;
      dueDate?: string | null;
      context: string;
    }) => ({
      emailId: parsed.id,
      subject: parsed.subject,
      from: fromDisplay,
      action: action.action,
      priority: (["high", "medium", "low"].includes(action.priority) ? action.priority : "medium") as "high" | "medium" | "low",
      dueDate: action.dueDate ? new Date(action.dueDate) : undefined,
      context: action.context,
    }));
  } catch (err) {
    console.error("Failed to extract action items:", err);
    return [];
  }
}

/**
 * Summarize an email thread using AI
 */
export async function summarizeThread(thread: EmailThread): Promise<ThreadSummary> {
  const participants = thread.participants
    .map(p => p.name || p.address)
    .slice(0, 10)
    .join(", ");

  // Build message content (limited to avoid token limits)
  const messageContent = thread.messages
    .slice(-10) // Last 10 messages
    .map((msg, idx) => {
      const from = msg.from[0]?.name || msg.from[0]?.address || "Unknown";
      const bodyParts = parseEmailBody(msg.body.text);
      const content = (bodyParts.newContent || msg.body.snippet).substring(0, 500);
      return `[${idx + 1}] From: ${from}\nDate: ${msg.date.toISOString()}\n${content}`;
    })
    .join("\n\n---\n\n");

  const prompt = THREAD_SUMMARY_PROMPT
    .replace("{{subject}}", thread.subject)
    .replace("{{participants}}", participants)
    .replace("{{messageCount}}", String(thread.messageCount))
    .replace("{{messages}}", messageContent);

  try {
    const response = await chat(
      [{ role: "user", content: prompt }],
      "You are a helpful email assistant that summarizes email threads. Always respond with valid JSON."
    );

    const result = JSON.parse(response.content);

    return {
      threadId: thread.id,
      subject: thread.subject,
      participantCount: thread.participants.length,
      messageCount: thread.messageCount,
      summary: result.summary || "No summary available",
      currentStatus: result.currentStatus || "Unknown",
      nextSteps: result.nextSteps || [],
      keyDecisions: result.keyDecisions || [],
      openQuestions: result.openQuestions || [],
    };
  } catch (err) {
    console.error("Failed to summarize thread:", err);
    return {
      threadId: thread.id,
      subject: thread.subject,
      participantCount: thread.participants.length,
      messageCount: thread.messageCount,
      summary: "Failed to generate summary",
      currentStatus: "Unknown",
      nextSteps: [],
      keyDecisions: [],
      openQuestions: [],
    };
  }
}

/**
 * Generate a comprehensive inbox summary
 */
export async function summarizeInbox(emails: EmailMessage[]): Promise<InboxSummary> {
  // Parse and categorize all emails
  const parsedEmails = emails.map(parseEmail);
  const categorizations = await Promise.all(
    parsedEmails.slice(0, 100).map(async email => ({
      email,
      categorization: await categorizeEmail(email),
    }))
  );

  // Count statistics
  const totalEmails = emails.length;
  const unreadCount = parsedEmails.filter(e => !e.metadata.isRead).length;
  const importantCount = categorizations.filter(
    c => c.categorization.category === "urgent" || c.categorization.category === "action_required"
  ).length;

  // Group by category
  const categoryMap = new Map<string, { emails: ParsedEmail[]; senders: Set<string> }>();

  for (const { email, categorization } of categorizations) {
    const cat = categorization.category;
    if (!categoryMap.has(cat)) {
      categoryMap.set(cat, { emails: [], senders: new Set() });
    }
    const entry = categoryMap.get(cat)!;
    entry.emails.push(email);
    if (email.from[0]) {
      entry.senders.add(email.from[0].name || email.from[0].address);
    }
  }

  const categories: CategorySummary[] = [];
  for (const [name, data] of categoryMap) {
    categories.push({
      name,
      count: data.emails.length,
      unreadCount: data.emails.filter(e => !e.metadata.isRead).length,
      topSenders: Array.from(data.senders).slice(0, 5),
      description: getCategoryDescription(name),
    });
  }

  // Sort categories by count
  categories.sort((a, b) => b.count - a.count);

  // Identify urgent items
  const urgentItems: UrgentItem[] = [];
  for (const { email, categorization } of categorizations) {
    if (categorization.category === "urgent") {
      urgentItems.push({
        emailId: email.id,
        subject: email.subject,
        from: email.from[0]?.name || email.from[0]?.address || "Unknown",
        reason: categorization.reason,
        suggestedAction: "Review and respond as soon as possible",
      });
    }
  }

  // Extract action items from action_required emails
  const actionItems: ActionItem[] = [];
  const actionRequiredEmails = categorizations
    .filter(c => c.categorization.category === "action_required")
    .slice(0, 10);

  for (const { email } of actionRequiredEmails) {
    const items = await extractActionItems(email);
    actionItems.push(...items);
  }

  // Sort action items by priority
  actionItems.sort((a, b) => {
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });

  // Generate summary text
  const categoriesText = categories
    .map(c => `- ${c.name}: ${c.count} emails (${c.unreadCount} unread)`)
    .join("\n");

  const urgentText = urgentItems.length > 0
    ? urgentItems.map(u => `- "${u.subject}" from ${u.from}`).join("\n")
    : "None";

  const summaryPrompt = INBOX_SUMMARY_PROMPT
    .replace("{{totalEmails}}", String(totalEmails))
    .replace("{{unreadCount}}", String(unreadCount))
    .replace("{{importantCount}}", String(importantCount))
    .replace("{{categories}}", categoriesText)
    .replace("{{urgentItems}}", urgentText);

  let summary = "";
  try {
    const response = await chat(
      [{ role: "user", content: summaryPrompt }],
      "You are a helpful email assistant providing inbox summaries. Be concise and actionable."
    );
    summary = response.content;
  } catch (err) {
    console.error("Failed to generate summary:", err);
    summary = `You have ${totalEmails} emails, ${unreadCount} unread. ${importantCount} require attention.`;
  }

  return {
    totalEmails,
    unreadCount,
    importantCount,
    categories,
    urgentItems,
    actionItems: actionItems.slice(0, 20),
    summary,
    generatedAt: new Date(),
  };
}

/**
 * Generate a daily digest summary
 */
export async function generateDailyDigest(emails: EmailMessage[]): Promise<string> {
  const summary = await summarizeInbox(emails);

  let digest = `# Daily Email Digest\n\n`;
  digest += `*Generated: ${summary.generatedAt.toLocaleString()}*\n\n`;

  // Overview
  digest += `## Overview\n\n`;
  digest += `${summary.summary}\n\n`;
  digest += `- **Total Emails:** ${summary.totalEmails}\n`;
  digest += `- **Unread:** ${summary.unreadCount}\n`;
  digest += `- **Needs Attention:** ${summary.importantCount}\n\n`;

  // Urgent items
  if (summary.urgentItems.length > 0) {
    digest += `## Urgent\n\n`;
    for (const item of summary.urgentItems) {
      digest += `- **${item.subject}** from ${item.from}\n`;
      digest += `  *${item.reason}*\n\n`;
    }
  }

  // Action items
  if (summary.actionItems.length > 0) {
    digest += `## Action Items\n\n`;
    for (const item of summary.actionItems) {
      const priority = item.priority === "high" ? "!!!" : item.priority === "medium" ? "!!" : "!";
      digest += `- [${priority}] **${item.action}**\n`;
      digest += `  From: ${item.from} | ${item.context}\n`;
      if (item.dueDate) {
        digest += `  Due: ${item.dueDate.toLocaleDateString()}\n`;
      }
      digest += "\n";
    }
  }

  // Categories breakdown
  digest += `## By Category\n\n`;
  for (const cat of summary.categories.slice(0, 8)) {
    digest += `- **${cat.name}:** ${cat.count} emails`;
    if (cat.unreadCount > 0) {
      digest += ` (${cat.unreadCount} unread)`;
    }
    digest += "\n";
    if (cat.topSenders.length > 0) {
      digest += `  Top senders: ${cat.topSenders.slice(0, 3).join(", ")}\n`;
    }
  }

  return digest;
}

/**
 * Smart reply suggestions for an email
 */
export async function suggestReplies(email: EmailMessage | ParsedEmail): Promise<string[]> {
  const parsed = "metadata" in email ? email : parseEmail(email);

  const fromDisplay = parsed.from[0]
    ? `${parsed.from[0].name || ""} <${parsed.from[0].address}>`.trim()
    : "Unknown";

  const bodyParts = parseEmailBody(parsed.body.text);
  const relevantBody = (bodyParts.newContent || parsed.body.text).substring(0, 1500);

  const prompt = `You are an email assistant suggesting reply options. Based on the following email, suggest 3 brief reply options ranging from formal to casual.

Email:
From: ${fromDisplay}
Subject: ${parsed.subject}
Body: ${relevantBody}

Provide 3 reply suggestions:
1. A brief, professional response
2. A friendly but complete response
3. A quick, informal response

Respond in JSON format:
{
  "replies": ["reply 1", "reply 2", "reply 3"]
}`;

  try {
    const response = await chat(
      [{ role: "user", content: prompt }],
      "You are a helpful email assistant. Always respond with valid JSON."
    );

    const result = JSON.parse(response.content);
    return result.replies || [];
  } catch (err) {
    console.error("Failed to suggest replies:", err);
    return [];
  }
}

/**
 * Analyze email sentiment
 */
export async function analyzeSentiment(email: EmailMessage | ParsedEmail): Promise<{
  sentiment: "positive" | "negative" | "neutral";
  confidence: number;
  tone: string;
  keyPhrases: string[];
}> {
  const parsed = "metadata" in email ? email : parseEmail(email);

  const bodyParts = parseEmailBody(parsed.body.text);
  const relevantBody = (bodyParts.newContent || parsed.body.text).substring(0, 1500);

  const prompt = `Analyze the sentiment and tone of this email:

Subject: ${parsed.subject}
Body: ${relevantBody}

Respond in JSON format:
{
  "sentiment": "positive|negative|neutral",
  "confidence": 0.0-1.0,
  "tone": "brief description of tone (e.g., 'urgent', 'friendly', 'formal', 'frustrated')",
  "keyPhrases": ["phrase1", "phrase2", "phrase3"]
}`;

  try {
    const response = await chat(
      [{ role: "user", content: prompt }],
      "You are a helpful sentiment analysis assistant. Always respond with valid JSON."
    );

    const result = JSON.parse(response.content);
    return {
      sentiment: result.sentiment || "neutral",
      confidence: result.confidence || 0.5,
      tone: result.tone || "neutral",
      keyPhrases: result.keyPhrases || [],
    };
  } catch (err) {
    console.error("Failed to analyze sentiment:", err);
    return {
      sentiment: "neutral",
      confidence: 0.5,
      tone: "neutral",
      keyPhrases: [],
    };
  }
}

/**
 * Get description for a category
 */
function getCategoryDescription(category: string): string {
  const descriptions: Record<string, string> = {
    urgent: "Time-sensitive emails requiring immediate attention",
    action_required: "Emails that need your response or action",
    informational: "FYI emails and updates",
    meeting: "Calendar invites and meeting-related emails",
    financial: "Invoices, receipts, and financial communications",
    social: "Personal and social notifications",
    marketing: "Promotional emails and newsletters",
    support: "Customer support and help desk communications",
    work: "Work-related emails",
    spam: "Potentially unwanted emails",
  };
  return descriptions[category] || "Other emails";
}

export default {
  categorizeEmail,
  extractActionItems,
  summarizeThread,
  summarizeInbox,
  generateDailyDigest,
  suggestReplies,
  analyzeSentiment,
};
