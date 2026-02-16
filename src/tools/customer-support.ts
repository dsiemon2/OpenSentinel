/**
 * Customer Support — Ticket triage, response drafting, escalation routing
 *
 * Manages a simple in-memory support ticket system with automatic
 * priority detection, category assignment, and response suggestions.
 */

export interface Ticket {
  id: string;
  customer: string;
  email?: string;
  subject: string;
  description: string;
  category: TicketCategory;
  priority: TicketPriority;
  status: TicketStatus;
  assignee?: string;
  tags: string[];
  notes: TicketNote[];
  suggestedResponse?: string;
  createdAt: Date;
  updatedAt: Date;
  resolvedAt?: Date;
  escalatedAt?: Date;
}

export interface TicketNote {
  author: string;
  text: string;
  createdAt: Date;
}

export type TicketCategory =
  | "billing"
  | "technical"
  | "account"
  | "feature_request"
  | "bug_report"
  | "general"
  | "urgent"
  | "onboarding";

export type TicketPriority = "low" | "medium" | "high" | "critical";
export type TicketStatus = "new" | "open" | "in_progress" | "waiting" | "escalated" | "resolved" | "closed";

export interface TicketSummary {
  totalTickets: number;
  byStatus: Record<string, number>;
  byPriority: Record<string, number>;
  byCategory: Record<string, number>;
  avgResolutionTimeMs: number;
  openTickets: number;
  escalatedTickets: number;
  resolvedToday: number;
}

const tickets = new Map<string, Ticket>();
let ticketCounter = 0;

// Priority detection patterns
const PRIORITY_PATTERNS: Array<{ pattern: RegExp; priority: TicketPriority }> = [
  { pattern: /can'?t log\s*in|locked out|account.*compromised|hacked|unauthorized/i, priority: "critical" },
  { pattern: /data loss|data.*deleted|lost.*data|payment.*fail|charge.*wrong|double.*charge/i, priority: "critical" },
  { pattern: /not working|broken|crash|error|down|outage|bug/i, priority: "high" },
  { pattern: /slow|performance|timeout|loading/i, priority: "medium" },
  { pattern: /how to|question|help|wondering|feature.*request/i, priority: "low" },
];

// Category detection patterns
const CATEGORY_PATTERNS: Array<{ pattern: RegExp; category: TicketCategory }> = [
  { pattern: /billing|invoice|charge|payment|refund|subscription|plan|pricing|receipt/i, category: "billing" },
  { pattern: /bug|error|crash|not working|broken|issue|glitch/i, category: "bug_report" },
  { pattern: /feature|request|suggestion|wish|would be nice|add.*support/i, category: "feature_request" },
  { pattern: /account|login|password|reset|profile|settings|2fa|mfa/i, category: "account" },
  { pattern: /install|setup|getting started|onboard|tutorial|how do i/i, category: "onboarding" },
  { pattern: /api|integration|webhook|code|sdk|library|technical/i, category: "technical" },
  { pattern: /urgent|asap|emergency|critical|immediately/i, category: "urgent" },
];

// Escalation rules
const ESCALATION_RULES: Array<{ condition: (t: Ticket) => boolean; reason: string }> = [
  { condition: (t) => t.priority === "critical", reason: "Critical priority ticket" },
  { condition: (t) => t.category === "billing" && t.priority === "high", reason: "High-priority billing issue" },
  { condition: (t) => t.tags.includes("vip"), reason: "VIP customer" },
  {
    condition: (t) => {
      const ageMs = Date.now() - t.createdAt.getTime();
      return ageMs > 24 * 60 * 60 * 1000 && t.status === "open";
    },
    reason: "Ticket open for more than 24 hours",
  },
];

// Response templates
const RESPONSE_TEMPLATES: Record<string, string> = {
  billing: "Thank you for reaching out about your billing concern. I'd be happy to help review your account. Could you please provide your account email or invoice number so I can look into this for you?",
  bug_report: "Thank you for reporting this issue. I'm sorry for the inconvenience. Could you please share: 1) Steps to reproduce the issue, 2) Your browser/device, 3) Any error messages you're seeing? This will help us investigate and resolve it quickly.",
  feature_request: "Thank you for your feature suggestion! We appreciate your feedback. I've logged this request and our product team will review it. We'll update you if this feature gets prioritized for development.",
  account: "I understand you're having trouble with your account. For security, I'll need to verify your identity. Could you please confirm the email address associated with your account?",
  technical: "Thank you for reaching out about this technical issue. Let me help troubleshoot. Could you share: 1) What you're trying to do, 2) What's happening instead, 3) Any error messages or logs?",
  onboarding: "Welcome! I'd be happy to help you get started. Here are some helpful resources: 1) Our Getting Started guide, 2) Video tutorials, 3) API documentation. What specific area would you like help with?",
  general: "Thank you for contacting us. I'd be happy to help. Could you provide a bit more detail about your question so I can assist you better?",
  urgent: "I understand this is urgent. I'm prioritizing your request and will work on it right away. Please provide any additional details that might help us resolve this faster.",
};

function generateId(): string {
  ticketCounter++;
  return `TKT-${String(ticketCounter).padStart(4, "0")}`;
}

function detectPriority(text: string): TicketPriority {
  const combined = text.toLowerCase();
  for (const { pattern, priority } of PRIORITY_PATTERNS) {
    if (pattern.test(combined)) return priority;
  }
  return "medium";
}

function detectCategory(text: string): TicketCategory {
  const combined = text.toLowerCase();
  for (const { pattern, category } of CATEGORY_PATTERNS) {
    if (pattern.test(combined)) return category;
  }
  return "general";
}

function detectTags(text: string): string[] {
  const tags: string[] = [];
  const lower = text.toLowerCase();
  if (/vip|enterprise|premium|pro plan/i.test(lower)) tags.push("vip");
  if (/refund/i.test(lower)) tags.push("refund");
  if (/security|breach|hack/i.test(lower)) tags.push("security");
  if (/api|sdk|integration/i.test(lower)) tags.push("api");
  if (/mobile|ios|android|app/i.test(lower)) tags.push("mobile");
  if (/urgent|asap/i.test(lower)) tags.push("urgent");
  return tags;
}

function shouldEscalate(ticket: Ticket): { escalate: boolean; reason?: string } {
  for (const rule of ESCALATION_RULES) {
    if (rule.condition(ticket)) {
      return { escalate: true, reason: rule.reason };
    }
  }
  return { escalate: false };
}

/**
 * Create a new support ticket with auto-triage
 */
export function createTicket(
  customer: string,
  subject: string,
  description: string,
  opts?: { email?: string; category?: TicketCategory; priority?: TicketPriority }
): Ticket {
  const combined = `${subject} ${description}`;
  const category = opts?.category || detectCategory(combined);
  const priority = opts?.priority || detectPriority(combined);
  const tags = detectTags(combined);

  const ticket: Ticket = {
    id: generateId(),
    customer,
    email: opts?.email,
    subject,
    description,
    category,
    priority,
    status: "new",
    tags,
    notes: [],
    suggestedResponse: RESPONSE_TEMPLATES[category] || RESPONSE_TEMPLATES.general,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  // Check escalation
  const esc = shouldEscalate(ticket);
  if (esc.escalate) {
    ticket.status = "escalated";
    ticket.escalatedAt = new Date();
    ticket.notes.push({ author: "system", text: `Auto-escalated: ${esc.reason}`, createdAt: new Date() });
  }

  tickets.set(ticket.id, ticket);
  return ticket;
}

/**
 * Update an existing ticket
 */
export function updateTicket(
  ticketId: string,
  updates: {
    status?: TicketStatus;
    priority?: TicketPriority;
    category?: TicketCategory;
    assignee?: string;
    note?: string;
  }
): Ticket {
  const ticket = tickets.get(ticketId);
  if (!ticket) throw new Error(`Ticket not found: ${ticketId}`);

  if (updates.status) {
    ticket.status = updates.status;
    if (updates.status === "resolved" || updates.status === "closed") {
      ticket.resolvedAt = new Date();
    }
  }
  if (updates.priority) ticket.priority = updates.priority;
  if (updates.category) ticket.category = updates.category;
  if (updates.assignee) ticket.assignee = updates.assignee;
  if (updates.note) {
    ticket.notes.push({ author: updates.assignee || "agent", text: updates.note, createdAt: new Date() });
  }
  ticket.updatedAt = new Date();
  tickets.set(ticket.id, ticket);
  return ticket;
}

/**
 * Get a ticket by ID
 */
export function getTicket(ticketId: string): Ticket | undefined {
  return tickets.get(ticketId);
}

/**
 * List tickets with optional filters
 */
export function listTickets(filters?: {
  status?: TicketStatus;
  priority?: TicketPriority;
  category?: TicketCategory;
  customer?: string;
  assignee?: string;
}): Ticket[] {
  let result = Array.from(tickets.values());
  if (filters?.status) result = result.filter((t) => t.status === filters.status);
  if (filters?.priority) result = result.filter((t) => t.priority === filters.priority);
  if (filters?.category) result = result.filter((t) => t.category === filters.category);
  if (filters?.customer) result = result.filter((t) => t.customer.toLowerCase().includes(filters.customer!.toLowerCase()));
  if (filters?.assignee) result = result.filter((t) => t.assignee === filters.assignee);
  return result.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

/**
 * Get ticket summary/metrics
 */
export function getTicketSummary(): TicketSummary {
  const all = Array.from(tickets.values());
  const byStatus: Record<string, number> = {};
  const byPriority: Record<string, number> = {};
  const byCategory: Record<string, number> = {};

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let resolvedToday = 0;
  let totalResolutionTime = 0;
  let resolvedCount = 0;

  for (const t of all) {
    byStatus[t.status] = (byStatus[t.status] || 0) + 1;
    byPriority[t.priority] = (byPriority[t.priority] || 0) + 1;
    byCategory[t.category] = (byCategory[t.category] || 0) + 1;

    if (t.resolvedAt) {
      totalResolutionTime += t.resolvedAt.getTime() - t.createdAt.getTime();
      resolvedCount++;
      if (t.resolvedAt >= today) resolvedToday++;
    }
  }

  return {
    totalTickets: all.length,
    byStatus,
    byPriority,
    byCategory,
    avgResolutionTimeMs: resolvedCount > 0 ? totalResolutionTime / resolvedCount : 0,
    openTickets: all.filter((t) => !["resolved", "closed"].includes(t.status)).length,
    escalatedTickets: all.filter((t) => t.status === "escalated").length,
    resolvedToday,
  };
}

/**
 * Get suggested response for a ticket
 */
export function getSuggestedResponse(ticketId: string): string {
  const ticket = tickets.get(ticketId);
  if (!ticket) throw new Error(`Ticket not found: ${ticketId}`);
  return ticket.suggestedResponse || RESPONSE_TEMPLATES.general;
}

/**
 * Get tickets that need escalation
 */
export function getEscalationQueue(): Ticket[] {
  return Array.from(tickets.values()).filter((t) => {
    if (t.status === "resolved" || t.status === "closed") return false;
    return shouldEscalate(t).escalate;
  });
}

/**
 * Clear all tickets (for testing)
 */
export function clearTickets(): void {
  tickets.clear();
  ticketCounter = 0;
}
