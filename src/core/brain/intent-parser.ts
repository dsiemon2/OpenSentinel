/**
 * Intent Parser — Local command handling without Claude API call
 *
 * Routes trivial commands (time, date, greeting, status, help)
 * locally, saving API costs on simple interactions.
 *
 * Uses Naive Bayes (Algorithm #7) as a secondary classifier that
 * learns from successful matches over time, catching fuzzy variations
 * that regex patterns miss.
 */

import { NaiveBayesClassifier } from "../ml/naive-bayes";

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
  private classifier: NaiveBayesClassifier;
  private classifierTrained = false;
  private trainingCount = 0;
  // Minimum confidence from Naive Bayes to accept (higher than regex since it's fuzzy)
  private mlConfidenceThreshold = 0.7;

  constructor(enabled = true) {
    this.enabled = enabled;
    this.classifier = new NaiveBayesClassifier({ alpha: 1.0 });
    this.seedClassifier();
  }

  /**
   * Seed the Naive Bayes classifier with examples from the regex patterns.
   * This gives it initial training data so it can generalize to unseen phrasings.
   */
  private seedClassifier(): void {
    const trainingExamples: Array<{ text: string; label: string }> = [
      // time
      { text: "what time is it", label: "time" },
      { text: "current time", label: "time" },
      { text: "whats the time", label: "time" },
      { text: "tell me the time", label: "time" },
      { text: "what time do you have", label: "time" },
      { text: "time please", label: "time" },
      // date
      { text: "what date is it", label: "date" },
      { text: "todays date", label: "date" },
      { text: "what day is today", label: "date" },
      { text: "current date", label: "date" },
      { text: "what is today", label: "date" },
      // greeting
      { text: "hello", label: "greeting" },
      { text: "hi there", label: "greeting" },
      { text: "hey", label: "greeting" },
      { text: "good morning", label: "greeting" },
      { text: "good afternoon", label: "greeting" },
      { text: "whats up", label: "greeting" },
      { text: "howdy", label: "greeting" },
      // status
      { text: "system status", label: "status" },
      { text: "how are you", label: "status" },
      { text: "are you working", label: "status" },
      { text: "are you alive", label: "status" },
      { text: "status check", label: "status" },
      // help
      { text: "help", label: "help" },
      { text: "what can you do", label: "help" },
      { text: "commands", label: "help" },
      { text: "capabilities", label: "help" },
      { text: "show me what you can do", label: "help" },
      // thanks
      { text: "thanks", label: "thanks" },
      { text: "thank you", label: "thanks" },
      { text: "thx", label: "thanks" },
      { text: "appreciated", label: "thanks" },
      { text: "cheers", label: "thanks" },
      // none — messages that should NOT match
      { text: "search for python tutorials", label: "none" },
      { text: "write a function to sort an array", label: "none" },
      { text: "remind me to call mom at 5pm", label: "none" },
      { text: "summarize this document", label: "none" },
      { text: "send an email to john", label: "none" },
      { text: "what is the weather like", label: "none" },
    ];

    this.classifier.fit(trainingExamples);
    this.classifierTrained = true;
  }

  /**
   * Parse a message for local intent handling.
   * Uses regex (primary, confidence=1.0) then Naive Bayes (secondary, learned confidence).
   * Returns null if no intent matched (should go to Claude API).
   */
  parseIntent(message: string): ParsedIntent | null {
    if (!this.enabled) return null;

    const trimmed = message.trim();
    if (trimmed.length === 0) return null;

    // Skip if message is too long to be a simple command
    if (trimmed.length > 100) return null;

    // Primary: exact regex matching
    for (const rule of INTENT_RULES) {
      for (const pattern of rule.patterns) {
        if (pattern.test(trimmed)) {
          // Reinforce the classifier with this confirmed match
          this.classifier.partialFit([{ text: trimmed, label: rule.intent }]);
          this.trainingCount++;

          return {
            intent: rule.intent,
            handled: true,
            response: rule.getResponse(),
            confidence: 1.0,
          };
        }
      }
    }

    // Secondary: Naive Bayes classification for fuzzy matching
    if (this.classifierTrained) {
      const prediction = this.classifier.predict(trimmed);
      if (
        prediction &&
        prediction.label !== "none" &&
        prediction.confidence >= this.mlConfidenceThreshold
      ) {
        // Find the matching rule to generate response
        const matchedRule = INTENT_RULES.find((r) => r.intent === prediction.label);
        if (matchedRule) {
          return {
            intent: prediction.label,
            handled: true,
            response: matchedRule.getResponse(),
            confidence: prediction.confidence,
          };
        }
      }
    }

    return null;
  }

  /**
   * Provide a correction to improve the classifier.
   * Call this when the user indicates a message was misclassified.
   */
  recordCorrection(message: string, correctIntent: string): void {
    this.classifier.partialFit([{ text: message, label: correctIntent }]);
    this.trainingCount++;
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
