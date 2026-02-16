/**
 * Email Assistant — Inbox triage, reply drafting, action extraction
 *
 * Provides local email analysis without needing AI calls.
 * Categorizes emails, extracts action items, drafts reply templates,
 * and generates inbox summaries. Complements the check_email/send_email tools.
 */

export interface EmailTriageResult {
  category: EmailCategory;
  priority: EmailPriority;
  actionRequired: boolean;
  suggestedActions: string[];
  suggestedReply?: string;
  tags: string[];
}

export interface ActionItem {
  action: string;
  source: string; // email subject or sender
  priority: EmailPriority;
  dueDate?: string;
}

export interface InboxDigest {
  totalAnalyzed: number;
  categories: Record<string, number>;
  priorities: Record<string, number>;
  actionItems: ActionItem[];
  urgentCount: number;
  needsReplyCount: number;
  summary: string;
}

export type EmailCategory =
  | "urgent"
  | "action_required"
  | "meeting"
  | "billing"
  | "newsletter"
  | "social"
  | "marketing"
  | "support"
  | "personal"
  | "automated"
  | "spam"
  | "general";

export type EmailPriority = "critical" | "high" | "medium" | "low";

interface EmailInput {
  from: string;
  subject: string;
  body?: string;
  date?: string;
}

// Category patterns
const CATEGORY_PATTERNS: Array<{ pattern: RegExp; category: EmailCategory }> = [
  { pattern: /unsubscribe|newsletter|digest|weekly roundup|daily digest/i, category: "newsletter" },
  { pattern: /invoice|receipt|payment|billing|subscription|charge/i, category: "billing" },
  { pattern: /calendar|invite|meeting|schedule|appointment|rsvp|zoom|teams meeting/i, category: "meeting" },
  { pattern: /noreply|no-reply|donotreply|automated|notification/i, category: "automated" },
  { pattern: /twitter|facebook|linkedin|instagram|social|friend request|mentioned you/i, category: "social" },
  { pattern: /sale|discount|offer|promo|deal|limited time|% off|free trial/i, category: "marketing" },
  { pattern: /support|ticket|case #|help desk|customer service/i, category: "support" },
  { pattern: /urgent|asap|immediately|critical|time.?sensitive/i, category: "urgent" },
];

// Priority patterns
const PRIORITY_PATTERNS: Array<{ pattern: RegExp; priority: EmailPriority }> = [
  { pattern: /urgent|critical|emergency|asap|immediately|time.?sensitive/i, priority: "critical" },
  { pattern: /important|action required|respond|reply needed|deadline|due today/i, priority: "high" },
  { pattern: /fyi|newsletter|digest|automated|notification/i, priority: "low" },
];

// Action detection patterns
const ACTION_PATTERNS: Array<{ pattern: RegExp; action: string }> = [
  { pattern: /please (respond|reply|confirm|approve|review|sign|submit)/i, action: "Reply/respond required" },
  { pattern: /action required|action needed/i, action: "Action required" },
  { pattern: /rsvp|please confirm your attendance/i, action: "RSVP to event" },
  { pattern: /sign.*document|e-?sign|docusign/i, action: "Sign document" },
  { pattern: /review.*attached|attached.*review|please review/i, action: "Review attachment" },
  { pattern: /pay.*invoice|payment.*due|invoice attached/i, action: "Pay invoice" },
  { pattern: /schedule.*call|book.*meeting|set up.*time/i, action: "Schedule meeting" },
  { pattern: /deadline.*(\w+ \d+|\d+\/\d+)/i, action: "Meet deadline" },
  { pattern: /update your|change your|reset your/i, action: "Update account/settings" },
];

// Reply templates
const REPLY_TEMPLATES: Record<string, string> = {
  meeting: "Thanks for the invite. I'll review my calendar and confirm shortly.",
  billing: "Thank you, I've received this. I'll review the details and follow up if I have any questions.",
  action_required: "Thank you for sending this over. I'll take care of it and get back to you shortly.",
  support: "Thanks for the update. I appreciate you looking into this.",
  urgent: "Received — I'll prioritize this and respond as soon as possible.",
  general: "Thank you for your email. I'll review and get back to you.",
};

// Spam indicators
const SPAM_INDICATORS = [
  /you('ve)? won|congratulations.*winner/i,
  /click here.*claim|claim your prize/i,
  /nigerian prince|foreign lottery/i,
  /viagra|cialis|enlargement/i,
  /\$\d+[,.]?\d*\s*(million|billion)/i,
  /wire transfer|western union|money gram/i,
];

/**
 * Triage a single email — categorize, prioritize, extract actions
 */
export function triageEmail(email: EmailInput): EmailTriageResult {
  const text = `${email.from} ${email.subject} ${email.body || ""}`;

  // Check spam first
  if (SPAM_INDICATORS.some((p) => p.test(text))) {
    return {
      category: "spam",
      priority: "low",
      actionRequired: false,
      suggestedActions: ["Mark as spam", "Delete"],
      tags: ["spam"],
    };
  }

  // Detect category
  let category: EmailCategory = "general";
  for (const { pattern, category: cat } of CATEGORY_PATTERNS) {
    if (pattern.test(text)) {
      category = cat;
      break;
    }
  }

  // Detect priority
  let priority: EmailPriority = "medium";
  for (const { pattern, priority: pri } of PRIORITY_PATTERNS) {
    if (pattern.test(text)) {
      priority = pri;
      break;
    }
  }
  // Newsletters and marketing are always low
  if (category === "newsletter" || category === "marketing" || category === "social") {
    priority = "low";
  }

  // Detect actions
  const suggestedActions: string[] = [];
  for (const { pattern, action } of ACTION_PATTERNS) {
    if (pattern.test(text)) {
      suggestedActions.push(action);
    }
  }

  const actionRequired = suggestedActions.length > 0 || category === "urgent" || category === "action_required";
  if (actionRequired && suggestedActions.length === 0) {
    suggestedActions.push("Review and respond");
  }

  // Tags
  const tags: string[] = [category];
  if (priority === "critical" || priority === "high") tags.push("important");
  if (email.body && email.body.length > 2000) tags.push("long");
  if (/attach/i.test(text)) tags.push("has-attachment");

  // Suggested reply
  const suggestedReply = REPLY_TEMPLATES[category] || REPLY_TEMPLATES.general;

  return {
    category,
    priority,
    actionRequired,
    suggestedActions,
    suggestedReply: actionRequired ? suggestedReply : undefined,
    tags,
  };
}

/**
 * Extract action items from email text
 */
export function extractActions(emails: EmailInput[]): ActionItem[] {
  const actions: ActionItem[] = [];

  for (const email of emails) {
    const text = `${email.subject} ${email.body || ""}`;

    for (const { pattern, action } of ACTION_PATTERNS) {
      if (pattern.test(text)) {
        // Try to find a date
        const dateMatch = text.match(/(?:by|before|due|deadline)\s+(\w+\s+\d{1,2}(?:,?\s+\d{4})?|\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)/i);

        actions.push({
          action,
          source: `${email.from}: ${email.subject}`,
          priority: triageEmail(email).priority,
          dueDate: dateMatch ? dateMatch[1] : undefined,
        });
      }
    }
  }

  // Sort by priority
  const priorityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
  return actions.sort((a, b) => (priorityOrder[a.priority] ?? 2) - (priorityOrder[b.priority] ?? 2));
}

/**
 * Generate a digest from multiple emails
 */
export function generateDigest(emails: EmailInput[]): InboxDigest {
  const categories: Record<string, number> = {};
  const priorities: Record<string, number> = {};
  let urgentCount = 0;
  let needsReplyCount = 0;

  for (const email of emails) {
    const triage = triageEmail(email);
    categories[triage.category] = (categories[triage.category] || 0) + 1;
    priorities[triage.priority] = (priorities[triage.priority] || 0) + 1;
    if (triage.category === "urgent" || triage.priority === "critical") urgentCount++;
    if (triage.actionRequired) needsReplyCount++;
  }

  const actionItems = extractActions(emails);

  // Build summary
  const parts: string[] = [`${emails.length} emails analyzed.`];
  if (urgentCount > 0) parts.push(`${urgentCount} urgent.`);
  if (needsReplyCount > 0) parts.push(`${needsReplyCount} need a reply.`);
  if (actionItems.length > 0) parts.push(`${actionItems.length} action items extracted.`);

  const topCategories = Object.entries(categories)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([cat, count]) => `${cat}: ${count}`)
    .join(", ");
  if (topCategories) parts.push(`Top categories: ${topCategories}.`);

  return {
    totalAnalyzed: emails.length,
    categories,
    priorities,
    actionItems,
    urgentCount,
    needsReplyCount,
    summary: parts.join(" "),
  };
}

/**
 * Draft a reply based on email content
 */
export function draftReply(email: EmailInput, style: "formal" | "friendly" | "brief" = "friendly"): string {
  const triage = triageEmail(email);
  const senderName = email.from.split(/[<@]/)[0].trim() || "there";

  const greetings: Record<string, string> = {
    formal: `Dear ${senderName},`,
    friendly: `Hi ${senderName},`,
    brief: `Hi,`,
  };

  const closings: Record<string, string> = {
    formal: "Best regards,",
    friendly: "Thanks,",
    brief: "Thanks!",
  };

  const body = triage.suggestedReply || REPLY_TEMPLATES.general;
  return `${greetings[style]}\n\n${body}\n\n${closings[style]}`;
}
