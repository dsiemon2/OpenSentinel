/**
 * Meeting Assistant — Transcript summaries, action items, weekly digests
 *
 * Processes meeting transcripts/notes to extract summaries, decisions,
 * action items with owners, and generates weekly meeting digests.
 */

export interface Meeting {
  id: string;
  title: string;
  date: Date;
  duration?: number; // minutes
  attendees: string[];
  transcript?: string;
  notes?: string;
  summary?: string;
  decisions: string[];
  actionItems: MeetingAction[];
  tags: string[];
}

export interface MeetingAction {
  action: string;
  owner?: string;
  deadline?: string;
  priority: "high" | "medium" | "low";
  status: "pending" | "in_progress" | "done";
}

export interface WeeklyDigest {
  weekOf: string;
  totalMeetings: number;
  totalDuration: number;
  allDecisions: string[];
  allActions: MeetingAction[];
  pendingActions: MeetingAction[];
  meetingSummaries: Array<{ title: string; date: string; summary: string }>;
  digest: string;
}

const meetings = new Map<string, Meeting>();
let meetingCounter = 0;

// Action patterns — detect action items from text
const ACTION_PATTERNS: Array<{ pattern: RegExp; extractOwner: boolean }> = [
  { pattern: /(?:action[:\s]*)?(\w+)\s+(?:will|should|needs to|is going to|to)\s+(.+)/gi, extractOwner: true },
  { pattern: /TODO[:\s]+(.+)/gi, extractOwner: false },
  { pattern: /action item[:\s]+(.+)/gi, extractOwner: false },
  { pattern: /\[AI?\]\s*(.+)/gi, extractOwner: false },
  { pattern: /(?:assigned to|owner:)\s*(\w+)[:\s]+(.+)/gi, extractOwner: true },
];

// Decision patterns
const DECISION_PATTERNS = [
  /(?:decided|agreed|decision)[:\s]+(.+)/gi,
  /(?:we(?:'ll| will))\s+(?:go with|use|adopt|proceed with)\s+(.+)/gi,
  /(?:approved|confirmed)[:\s]+(.+)/gi,
  /(?:the plan is to|going forward,?)\s+(.+)/gi,
];

// Attendee detection
const ATTENDEE_PATTERNS = [
  /(?:attendees|participants|present)[:\s]+(.+)/gi,
  /(?:joined|attending)[:\s]+(.+)/gi,
];

function generateId(): string {
  meetingCounter++;
  return `MTG-${String(meetingCounter).padStart(4, "0")}`;
}

function extractSentences(text: string): string[] {
  return text
    .split(/[.!?\n]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 5);
}

/**
 * Extract action items from meeting text
 */
export function extractActionItems(text: string): MeetingAction[] {
  const actions: MeetingAction[] = [];
  const seen = new Set<string>();

  // Check each line/sentence for action patterns
  const lines = text.split(/\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Direct action markers
    if (/^[-*]\s*(TODO|Action|AI|TASK)[:\s]/i.test(trimmed)) {
      const actionText = trimmed.replace(/^[-*]\s*(TODO|Action|AI|TASK)[:\s]*/i, "").trim();
      if (actionText && !seen.has(actionText.toLowerCase())) {
        seen.add(actionText.toLowerCase());
        // Try to extract owner
        const ownerMatch = actionText.match(/^(\w+)[:\s]+(.+)/);
        actions.push({
          action: ownerMatch ? ownerMatch[2].trim() : actionText,
          owner: ownerMatch ? ownerMatch[1] : undefined,
          priority: /urgent|asap|critical/i.test(actionText) ? "high" : "medium",
          status: "pending",
        });
      }
    }

    // "X will do Y" pattern
    const willMatch = trimmed.match(/(\w+)\s+will\s+(.{10,})/i);
    if (willMatch) {
      const owner = willMatch[1];
      const action = willMatch[2].replace(/[.!]$/, "").trim();
      const key = action.toLowerCase();
      if (!seen.has(key) && !/^(it|this|that|there|we|they|he|she)$/i.test(owner)) {
        seen.add(key);
        actions.push({
          action,
          owner,
          priority: "medium",
          status: "pending",
        });
      }
    }

    // Deadline detection within action items
    const deadlineMatch = trimmed.match(/(?:by|before|due|deadline)\s+([\w\s,]+\d{1,4})/i);
    if (deadlineMatch && actions.length > 0) {
      const lastAction = actions[actions.length - 1];
      if (!lastAction.deadline) {
        lastAction.deadline = deadlineMatch[1].trim();
      }
    }
  }

  return actions;
}

/**
 * Extract decisions from meeting text
 */
export function extractDecisions(text: string): string[] {
  const decisions: string[] = [];
  const seen = new Set<string>();

  for (const pattern of DECISION_PATTERNS) {
    // Reset regex state
    pattern.lastIndex = 0;
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const decision = (match[1] || match[2] || "").replace(/[.!]$/, "").trim();
      const key = decision.toLowerCase();
      if (decision.length > 5 && !seen.has(key)) {
        seen.add(key);
        decisions.push(decision);
      }
    }
  }

  return decisions;
}

/**
 * Generate a summary from meeting text
 */
export function summarizeMeeting(text: string): string {
  const sentences = extractSentences(text);
  if (sentences.length === 0) return "No content to summarize.";

  // Simple extractive summary: pick key sentences
  const scored = sentences.map((s) => {
    let score = 0;
    // Prioritize sentences with key indicators
    if (/decided|agreed|conclusion|result|outcome/i.test(s)) score += 3;
    if (/action|todo|task|next step/i.test(s)) score += 2;
    if (/important|key|critical|major/i.test(s)) score += 2;
    if (/discussed|talked about|covered|reviewed/i.test(s)) score += 1;
    // Longer sentences tend to be more informative
    if (s.length > 50) score += 1;
    return { sentence: s, score };
  });

  scored.sort((a, b) => b.score - a.score);
  const topSentences = scored.slice(0, Math.min(5, sentences.length));
  // Re-order by original position
  topSentences.sort((a, b) => sentences.indexOf(a.sentence) - sentences.indexOf(b.sentence));

  return topSentences.map((s) => s.sentence).join(". ") + ".";
}

/**
 * Create and process a meeting record
 */
export function addMeeting(
  title: string,
  opts?: {
    date?: Date;
    duration?: number;
    attendees?: string[];
    transcript?: string;
    notes?: string;
    tags?: string[];
  }
): Meeting {
  const text = opts?.transcript || opts?.notes || "";
  const id = generateId();

  // Auto-extract attendees if not provided
  let attendees = opts?.attendees || [];
  if (attendees.length === 0 && text) {
    for (const pattern of ATTENDEE_PATTERNS) {
      pattern.lastIndex = 0;
      const match = pattern.exec(text);
      if (match) {
        attendees = match[1].split(/[,;&]+/).map((a) => a.trim()).filter((a) => a.length > 1);
        break;
      }
    }
  }

  const meeting: Meeting = {
    id,
    title,
    date: opts?.date || new Date(),
    duration: opts?.duration,
    attendees,
    transcript: opts?.transcript,
    notes: opts?.notes,
    summary: text ? summarizeMeeting(text) : undefined,
    decisions: text ? extractDecisions(text) : [],
    actionItems: text ? extractActionItems(text) : [],
    tags: opts?.tags || [],
  };

  meetings.set(id, meeting);
  return meeting;
}

/**
 * Get a meeting by ID
 */
export function getMeeting(id: string): Meeting | undefined {
  return meetings.get(id);
}

/**
 * List meetings with optional date filter
 */
export function listMeetings(opts?: { since?: Date; until?: Date; tag?: string }): Meeting[] {
  let result = Array.from(meetings.values());
  if (opts?.since) result = result.filter((m) => m.date >= opts.since!);
  if (opts?.until) result = result.filter((m) => m.date <= opts.until!);
  if (opts?.tag) result = result.filter((m) => m.tags.includes(opts.tag!));
  return result.sort((a, b) => b.date.getTime() - a.date.getTime());
}

/**
 * Update action item status
 */
export function updateAction(meetingId: string, actionIndex: number, status: "pending" | "in_progress" | "done"): MeetingAction {
  const meeting = meetings.get(meetingId);
  if (!meeting) throw new Error(`Meeting not found: ${meetingId}`);
  if (actionIndex < 0 || actionIndex >= meeting.actionItems.length) throw new Error(`Invalid action index: ${actionIndex}`);
  meeting.actionItems[actionIndex].status = status;
  return meeting.actionItems[actionIndex];
}

/**
 * Get all pending action items across all meetings
 */
export function getAllPendingActions(): Array<MeetingAction & { meetingId: string; meetingTitle: string }> {
  const pending: Array<MeetingAction & { meetingId: string; meetingTitle: string }> = [];
  for (const [id, meeting] of meetings) {
    for (const action of meeting.actionItems) {
      if (action.status !== "done") {
        pending.push({ ...action, meetingId: id, meetingTitle: meeting.title });
      }
    }
  }
  return pending.sort((a, b) => {
    const priorityOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };
    return (priorityOrder[a.priority] ?? 1) - (priorityOrder[b.priority] ?? 1);
  });
}

/**
 * Generate a weekly digest
 */
export function getWeeklyDigest(weekStart?: Date): WeeklyDigest {
  const start = weekStart || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const end = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000);

  const weekMeetings = listMeetings({ since: start, until: end });
  const allDecisions: string[] = [];
  const allActions: MeetingAction[] = [];

  for (const m of weekMeetings) {
    allDecisions.push(...m.decisions);
    allActions.push(...m.actionItems);
  }

  const pendingActions = allActions.filter((a) => a.status !== "done");
  const totalDuration = weekMeetings.reduce((sum, m) => sum + (m.duration || 0), 0);

  const summaries = weekMeetings.map((m) => ({
    title: m.title,
    date: m.date.toISOString().split("T")[0],
    summary: m.summary || "No summary available",
  }));

  const parts: string[] = [];
  parts.push(`Week of ${start.toISOString().split("T")[0]}: ${weekMeetings.length} meeting(s), ${totalDuration} min total.`);
  if (allDecisions.length > 0) parts.push(`${allDecisions.length} decision(s) made.`);
  if (pendingActions.length > 0) parts.push(`${pendingActions.length} pending action(s).`);

  return {
    weekOf: start.toISOString().split("T")[0],
    totalMeetings: weekMeetings.length,
    totalDuration,
    allDecisions,
    allActions,
    pendingActions,
    meetingSummaries: summaries,
    digest: parts.join(" "),
  };
}

/**
 * Clear all meetings (for testing)
 */
export function clearMeetings(): void {
  meetings.clear();
  meetingCounter = 0;
}
