import type { EmailMessage, EmailAttachment, EmailAddress } from "./imap-client";

export interface ParsedEmail {
  id: string;
  subject: string;
  from: EmailAddress[];
  to: EmailAddress[];
  cc: EmailAddress[];
  date: Date;
  body: {
    text: string;
    html: string;
    snippet: string;
  };
  thread: ThreadInfo;
  attachments: ParsedAttachment[];
  metadata: EmailMetadata;
}

export interface ThreadInfo {
  id: string;
  messageId: string;
  inReplyTo?: string;
  references: string[];
  position: number;
  isReply: boolean;
  isForward: boolean;
}

export interface ParsedAttachment {
  filename: string;
  contentType: string;
  size: number;
  isInline: boolean;
  cid?: string;
  content?: Buffer;
  extension: string;
  category: "image" | "document" | "archive" | "media" | "other";
}

export interface EmailMetadata {
  isRead: boolean;
  isFlagged: boolean;
  isSpam: boolean;
  isDraft: boolean;
  labels: string[];
  importance: "high" | "normal" | "low";
  hasAttachments: boolean;
  attachmentCount: number;
  totalAttachmentSize: number;
}

export interface EmailThread {
  id: string;
  subject: string;
  participants: EmailAddress[];
  messageCount: number;
  unreadCount: number;
  lastMessageDate: Date;
  firstMessageDate: Date;
  messages: ParsedEmail[];
  snippet: string;
}

export interface QuotedSection {
  level: number;
  content: string;
  attribution?: string;
}

export interface EmailBodyParts {
  newContent: string;
  quotedContent: QuotedSection[];
  signature?: string;
}

/**
 * Parse an email message into a more structured format
 */
export function parseEmail(email: EmailMessage): ParsedEmail {
  const isReply = email.subject.toLowerCase().startsWith("re:");
  const isForward = email.subject.toLowerCase().startsWith("fwd:") ||
                    email.subject.toLowerCase().startsWith("fw:");

  // Calculate attachment metadata
  const attachments = email.attachments.map(att => parseAttachment(att));
  const totalAttachmentSize = attachments.reduce((sum, att) => sum + att.size, 0);

  // Determine importance from headers or flags
  let importance: "high" | "normal" | "low" = "normal";
  const importanceHeader = email.headers.get("importance") ||
                           email.headers.get("x-priority");
  if (importanceHeader) {
    const lowerHeader = importanceHeader.toLowerCase();
    if (lowerHeader.includes("high") || lowerHeader === "1" || lowerHeader === "2") {
      importance = "high";
    } else if (lowerHeader.includes("low") || lowerHeader === "5") {
      importance = "low";
    }
  }

  return {
    id: email.id,
    subject: email.subject,
    from: email.from,
    to: email.to,
    cc: email.cc,
    date: email.date,
    body: {
      text: email.text,
      html: email.html,
      snippet: email.snippet || email.text.substring(0, 200).replace(/\s+/g, " ").trim(),
    },
    thread: {
      id: email.threadId || email.messageId,
      messageId: email.messageId,
      inReplyTo: email.inReplyTo,
      references: email.references,
      position: email.references.length,
      isReply,
      isForward,
    },
    attachments,
    metadata: {
      isRead: email.flags.includes("\\Seen"),
      isFlagged: email.flags.includes("\\Flagged"),
      isSpam: email.labels.includes("Spam") || email.labels.includes("Junk"),
      isDraft: email.flags.includes("\\Draft"),
      labels: email.labels,
      importance,
      hasAttachments: attachments.length > 0,
      attachmentCount: attachments.length,
      totalAttachmentSize,
    },
  };
}

/**
 * Parse an attachment into structured format
 */
export function parseAttachment(attachment: EmailAttachment): ParsedAttachment {
  const extension = attachment.filename.includes(".")
    ? attachment.filename.split(".").pop()?.toLowerCase() || ""
    : "";

  return {
    filename: attachment.filename,
    contentType: attachment.contentType,
    size: attachment.size,
    isInline: !!attachment.contentId,
    cid: attachment.contentId,
    content: attachment.content,
    extension,
    category: categorizeAttachment(attachment.contentType, extension),
  };
}

/**
 * Categorize an attachment by its type
 */
function categorizeAttachment(
  contentType: string,
  extension: string
): "image" | "document" | "archive" | "media" | "other" {
  const lowerContentType = contentType.toLowerCase();

  // Images
  if (lowerContentType.startsWith("image/")) {
    return "image";
  }

  // Documents
  const docExtensions = ["pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "txt", "rtf", "odt", "ods", "odp", "csv"];
  const docMimeTypes = [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats",
    "application/vnd.ms-",
    "text/plain",
    "text/csv",
    "application/vnd.oasis.opendocument",
  ];
  if (docExtensions.includes(extension) || docMimeTypes.some(m => lowerContentType.includes(m))) {
    return "document";
  }

  // Archives
  const archiveExtensions = ["zip", "rar", "7z", "tar", "gz", "bz2"];
  const archiveMimeTypes = ["application/zip", "application/x-rar", "application/x-7z", "application/gzip"];
  if (archiveExtensions.includes(extension) || archiveMimeTypes.some(m => lowerContentType.includes(m))) {
    return "archive";
  }

  // Media (audio/video)
  if (lowerContentType.startsWith("audio/") || lowerContentType.startsWith("video/")) {
    return "media";
  }

  return "other";
}

/**
 * Group emails into threads
 */
export function groupIntoThreads(emails: EmailMessage[]): EmailThread[] {
  const threadMap = new Map<string, EmailMessage[]>();

  // Group by thread ID (using references chain or Message-ID)
  for (const email of emails) {
    // Find the root message ID for this thread
    let threadId = email.threadId || email.messageId;

    if (email.references.length > 0) {
      // Use the first reference as the thread root
      threadId = email.references[0];
    }

    if (!threadMap.has(threadId)) {
      threadMap.set(threadId, []);
    }
    threadMap.get(threadId)!.push(email);
  }

  // Convert to EmailThread objects
  const threads: EmailThread[] = [];

  for (const [threadId, messages] of threadMap) {
    // Sort messages by date (oldest first)
    messages.sort((a, b) => a.date.getTime() - b.date.getTime());

    // Collect all participants
    const participantMap = new Map<string, EmailAddress>();
    for (const msg of messages) {
      for (const addr of [...msg.from, ...msg.to, ...msg.cc]) {
        if (!participantMap.has(addr.address)) {
          participantMap.set(addr.address, addr);
        }
      }
    }

    // Count unread
    const unreadCount = messages.filter(m => !m.flags.includes("\\Seen")).length;

    // Get the subject (use the original, non-reply subject if possible)
    let subject = messages[0].subject;
    for (const msg of messages) {
      const cleaned = cleanSubject(msg.subject);
      if (cleaned.length > 0 && !cleaned.toLowerCase().startsWith("re:")) {
        subject = msg.subject;
        break;
      }
    }

    threads.push({
      id: threadId,
      subject: cleanSubject(subject),
      participants: Array.from(participantMap.values()),
      messageCount: messages.length,
      unreadCount,
      lastMessageDate: messages[messages.length - 1].date,
      firstMessageDate: messages[0].date,
      messages: messages.map(parseEmail),
      snippet: messages[messages.length - 1].snippet ||
               messages[messages.length - 1].text.substring(0, 200).replace(/\s+/g, " ").trim(),
    });
  }

  // Sort threads by last message date (newest first)
  threads.sort((a, b) => b.lastMessageDate.getTime() - a.lastMessageDate.getTime());

  return threads;
}

/**
 * Clean a subject line (remove Re:, Fwd:, etc.)
 */
export function cleanSubject(subject: string): string {
  return subject
    .replace(/^(Re|Fwd|Fw):\s*/gi, "")
    .replace(/^\[.*?\]\s*/, "") // Remove list prefixes like [ListName]
    .trim();
}

/**
 * Parse email body to separate new content from quoted sections
 */
export function parseEmailBody(text: string): EmailBodyParts {
  const lines = text.split("\n");
  const newLines: string[] = [];
  const quotedSections: QuotedSection[] = [];
  let currentQuote: { level: number; lines: string[]; attribution?: string } | null = null;
  let signature: string | undefined;
  let inSignature = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Check for signature delimiter
    if (line.trim() === "--" || line.trim() === "-- ") {
      inSignature = true;
      signature = lines.slice(i + 1).join("\n").trim();
      break;
    }

    // Check for quote markers
    const quoteMatch = line.match(/^(>+)\s?/);

    if (quoteMatch) {
      const level = quoteMatch[1].length;
      const content = line.substring(quoteMatch[0].length);

      if (!currentQuote || currentQuote.level !== level) {
        // Save previous quote section
        if (currentQuote) {
          quotedSections.push({
            level: currentQuote.level,
            content: currentQuote.lines.join("\n"),
            attribution: currentQuote.attribution,
          });
        }
        currentQuote = { level, lines: [content] };
      } else {
        currentQuote.lines.push(content);
      }
    } else if (isAttributionLine(line)) {
      // This is an attribution line like "On Date, Person wrote:"
      if (currentQuote) {
        currentQuote.attribution = line;
      } else {
        // Start of a new quoted section
        currentQuote = { level: 1, lines: [], attribution: line };
      }
    } else {
      // Regular line
      if (currentQuote) {
        quotedSections.push({
          level: currentQuote.level,
          content: currentQuote.lines.join("\n"),
          attribution: currentQuote.attribution,
        });
        currentQuote = null;
      }
      newLines.push(line);
    }
  }

  // Don't forget the last quote section
  if (currentQuote) {
    quotedSections.push({
      level: currentQuote.level,
      content: currentQuote.lines.join("\n"),
      attribution: currentQuote.attribution,
    });
  }

  return {
    newContent: newLines.join("\n").trim(),
    quotedContent: quotedSections,
    signature,
  };
}

/**
 * Check if a line is an email attribution (e.g., "On Jan 1, Person wrote:")
 */
function isAttributionLine(line: string): boolean {
  const attributionPatterns = [
    /^On .+ wrote:$/i,
    /^On .+, .+ wrote:$/i,
    /^.+ wrote:$/i,
    /^-{3,}\s*Original Message\s*-{3,}$/i,
    /^-{3,}\s*Forwarded message\s*-{3,}$/i,
    /^From:\s*.+$/i,
    /^Sent:\s*.+$/i,
  ];

  return attributionPatterns.some(pattern => pattern.test(line.trim()));
}

/**
 * Extract email addresses from a text string
 */
export function extractEmailAddresses(text: string): string[] {
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  const matches = text.match(emailRegex) || [];
  return [...new Set(matches)];
}

/**
 * Extract URLs from email text
 */
export function extractUrls(text: string): string[] {
  const urlRegex = /https?:\/\/[^\s<>"\)]+/gi;
  const matches = text.match(urlRegex) || [];
  return [...new Set(matches)];
}

/**
 * Extract phone numbers from email text
 */
export function extractPhoneNumbers(text: string): string[] {
  const phoneRegex = /(?:\+\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g;
  const matches = text.match(phoneRegex) || [];
  return [...new Set(matches)];
}

/**
 * Get a summary of an email suitable for display
 */
export function getEmailSummary(email: EmailMessage | ParsedEmail): {
  from: string;
  subject: string;
  snippet: string;
  date: string;
  attachmentCount: number;
} {
  const fromAddr = email.from[0];
  const fromDisplay = fromAddr
    ? fromAddr.name || fromAddr.address
    : "Unknown";

  const snippet = "body" in email
    ? email.body.snippet
    : email.snippet || email.text.substring(0, 100);

  const attachmentCount = "metadata" in email
    ? email.metadata.attachmentCount
    : email.attachments.length;

  return {
    from: fromDisplay,
    subject: email.subject,
    snippet,
    date: formatEmailDate(email.date),
    attachmentCount,
  };
}

/**
 * Format a date for email display
 */
function formatEmailDate(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (days === 0) {
    // Today - show time
    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  } else if (days === 1) {
    return "Yesterday";
  } else if (days < 7) {
    // This week - show day name
    return date.toLocaleDateString("en-US", { weekday: "short" });
  } else if (date.getFullYear() === now.getFullYear()) {
    // This year - show month and day
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  } else {
    // Older - show full date
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }
}

/**
 * Calculate the size of an email in bytes
 */
export function calculateEmailSize(email: EmailMessage): number {
  let size = 0;

  // Text content
  size += new TextEncoder().encode(email.text).length;
  size += new TextEncoder().encode(email.html).length;

  // Headers (estimate)
  size += new TextEncoder().encode(email.subject).length;
  size += email.from.reduce((s, a) => s + (a.name?.length || 0) + a.address.length + 10, 0);
  size += email.to.reduce((s, a) => s + (a.name?.length || 0) + a.address.length + 10, 0);

  // Attachments
  size += email.attachments.reduce((s, a) => s + a.size, 0);

  return size;
}

/**
 * Check if an email matches a filter
 */
export function matchesFilter(
  email: EmailMessage | ParsedEmail,
  filter: {
    from?: string | RegExp;
    to?: string | RegExp;
    subject?: string | RegExp;
    body?: string | RegExp;
    hasAttachments?: boolean;
    isUnread?: boolean;
    isFlagged?: boolean;
    dateAfter?: Date;
    dateBefore?: Date;
  }
): boolean {
  const parsed = "metadata" in email ? email : parseEmail(email);

  // Check from
  if (filter.from) {
    const fromMatch = parsed.from.some(addr => {
      const str = `${addr.name} ${addr.address}`;
      return filter.from instanceof RegExp
        ? filter.from.test(str)
        : str.toLowerCase().includes(filter.from.toLowerCase());
    });
    if (!fromMatch) return false;
  }

  // Check to
  if (filter.to) {
    const toMatch = parsed.to.some(addr => {
      const str = `${addr.name} ${addr.address}`;
      return filter.to instanceof RegExp
        ? filter.to.test(str)
        : str.toLowerCase().includes(filter.to.toLowerCase());
    });
    if (!toMatch) return false;
  }

  // Check subject
  if (filter.subject) {
    const subjectMatch = filter.subject instanceof RegExp
      ? filter.subject.test(parsed.subject)
      : parsed.subject.toLowerCase().includes(filter.subject.toLowerCase());
    if (!subjectMatch) return false;
  }

  // Check body
  if (filter.body) {
    const bodyText = parsed.body.text;
    const bodyMatch = filter.body instanceof RegExp
      ? filter.body.test(bodyText)
      : bodyText.toLowerCase().includes(filter.body.toLowerCase());
    if (!bodyMatch) return false;
  }

  // Check attachments
  if (filter.hasAttachments !== undefined) {
    if (parsed.metadata.hasAttachments !== filter.hasAttachments) return false;
  }

  // Check read status
  if (filter.isUnread !== undefined) {
    if (parsed.metadata.isRead === filter.isUnread) return false;
  }

  // Check flagged status
  if (filter.isFlagged !== undefined) {
    if (parsed.metadata.isFlagged !== filter.isFlagged) return false;
  }

  // Check date range
  if (filter.dateAfter && parsed.date < filter.dateAfter) return false;
  if (filter.dateBefore && parsed.date > filter.dateBefore) return false;

  return true;
}

export default {
  parseEmail,
  parseAttachment,
  groupIntoThreads,
  cleanSubject,
  parseEmailBody,
  extractEmailAddresses,
  extractUrls,
  extractPhoneNumbers,
  getEmailSummary,
  calculateEmailSize,
  matchesFilter,
};
