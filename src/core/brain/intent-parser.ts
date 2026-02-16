/**
 * Intent Parser — Local command handling without Claude API call
 *
 * Routes trivial commands (time, date, greeting, status, help)
 * locally, saving API costs on simple interactions.
 */

export interface ParsedIntent {
  intent: string;
  handled: boolean;
  response?: string;
  confidence: number; // 0-1
}

// Intent patterns: regex → { intent name, response generator }
interface IntentRule {
  patterns: RegExp[];
  intent: string;
  getResponse: () => string;
}

const INTENT_RULES: IntentRule[] = [
  {
    intent: "time",
    patterns: [
      /^what\s+time\s+is\s+it\??$/i,
      /^current\s+time\??$/i,
      /^what'?s?\s+the\s+time\??$/i,
      /^time\??$/i,
      /^tell\s+me\s+the\s+time$/i,
    ],
    getResponse: () => {
      const now = new Date();
      return `The current time is ${now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true })} (${Intl.DateTimeFormat().resolvedOptions().timeZone}).`;
    },
  },
  {
    intent: "date",
    patterns: [
      /^what\s+(date|day)\s+is\s+(it|today)\??$/i,
      /^today'?s?\s+date\??$/i,
      /^what'?s?\s+(the\s+)?date\s*\??$/i,
      /^current\s+date\??$/i,
    ],
    getResponse: () => {
      const now = new Date();
      return `Today is ${now.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}.`;
    },
  },
  {
    intent: "greeting",
    patterns: [
      /^(hello|hi|hey|howdy|greetings|good\s+(morning|afternoon|evening))[\s!.]*$/i,
      /^yo[\s!]*$/i,
      /^sup[\s!?]*$/i,
      /^what'?s?\s+up[\s!?]*$/i,
    ],
    getResponse: () => {
      const hour = new Date().getHours();
      const timeOfDay = hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening";
      const greetings = [
        `Good ${timeOfDay}! How can I help you today?`,
        `Hello! What can I do for you?`,
        `Good ${timeOfDay}! I'm ready to assist.`,
      ];
      return greetings[Math.floor(Math.random() * greetings.length)];
    },
  },
  {
    intent: "status",
    patterns: [
      /^(system\s+)?status[\s!?]*$/i,
      /^how\s+are\s+you[\s!?]*$/i,
      /^are\s+you\s+(ok|okay|alive|working)[\s!?]*$/i,
    ],
    getResponse: () => {
      const uptime = process.uptime();
      const hours = Math.floor(uptime / 3600);
      const minutes = Math.floor((uptime % 3600) / 60);
      const mem = process.memoryUsage();
      const heapMB = Math.round(mem.heapUsed / 1024 / 1024);
      return `All systems operational. Uptime: ${hours}h ${minutes}m. Memory: ${heapMB}MB heap used.`;
    },
  },
  {
    intent: "help",
    patterns: [
      /^help[\s!?]*$/i,
      /^what\s+can\s+you\s+do[\s!?]*$/i,
      /^commands[\s!?]*$/i,
      /^capabilities[\s!?]*$/i,
    ],
    getResponse: () => {
      return [
        "I can help you with:",
        "- Web search and browsing",
        "- File management (read, write, search)",
        "- Execute shell commands",
        "- Remember facts and preferences",
        "- Generate documents and reports",
        "- Analyze images and screenshots",
        "- Schedule tasks and reminders",
        "- Email management",
        "- Code assistance and debugging",
        "- And much more! Just ask.",
      ].join("\n");
    },
  },
  {
    intent: "thanks",
    patterns: [
      /^(thanks?|thank\s+you|ty|thx|appreciated?)[\s!.]*$/i,
      /^(cheers|ta)[\s!.]*$/i,
    ],
    getResponse: () => {
      const responses = [
        "You're welcome! Let me know if you need anything else.",
        "Happy to help! Anything else?",
        "No problem at all.",
      ];
      return responses[Math.floor(Math.random() * responses.length)];
    },
  },
];

export class IntentParser {
  private enabled: boolean;

  constructor(enabled = true) {
    this.enabled = enabled;
  }

  /**
   * Parse a message for local intent handling
   * Returns null if no intent matched (should go to Claude API)
   */
  parseIntent(message: string): ParsedIntent | null {
    if (!this.enabled) return null;

    const trimmed = message.trim();
    if (trimmed.length === 0) return null;

    // Skip if message is too long to be a simple command
    if (trimmed.length > 100) return null;

    for (const rule of INTENT_RULES) {
      for (const pattern of rule.patterns) {
        if (pattern.test(trimmed)) {
          return {
            intent: rule.intent,
            handled: true,
            response: rule.getResponse(),
            confidence: 1.0,
          };
        }
      }
    }

    return null;
  }

  /**
   * Get all supported intents
   */
  getSupportedIntents(): string[] {
    return INTENT_RULES.map((r) => r.intent);
  }

  /**
   * Get pattern count
   */
  getPatternCount(): number {
    return INTENT_RULES.reduce((sum, r) => sum + r.patterns.length, 0);
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  isEnabled(): boolean {
    return this.enabled;
  }
}

export const intentParser = new IntentParser();
