import { AgentType, AGENT_SYSTEM_PROMPTS, AGENT_TOOL_PERMISSIONS } from "../agent-types";

export const WRITING_AGENT_CONFIG = {
  type: "writing" as AgentType,
  name: "Writing Agent",
  description: "Specialized agent for content creation and writing tasks",

  systemPrompt: AGENT_SYSTEM_PROMPTS.writing,
  tools: AGENT_TOOL_PERMISSIONS.writing,

  // Writing-specific settings
  settings: {
    maxWordCount: 5000,
    defaultTone: "professional",
    grammarCheck: true,
    plagiarismCheck: false,
  },

  // Writing styles
  styles: {
    professional: {
      tone: "formal",
      vocabulary: "business",
      structure: "clear and organized",
    },
    casual: {
      tone: "conversational",
      vocabulary: "everyday",
      structure: "relaxed",
    },
    academic: {
      tone: "scholarly",
      vocabulary: "technical",
      structure: "rigorous",
    },
    creative: {
      tone: "expressive",
      vocabulary: "varied",
      structure: "flexible",
    },
    technical: {
      tone: "precise",
      vocabulary: "specialized",
      structure: "logical",
    },
  },
};

// Writing task types
export const WRITING_TASKS = {
  article: {
    name: "Article",
    description: "Write an informative article",
    structure: ["Headline", "Introduction", "Body Sections", "Conclusion"],
    wordRange: { min: 500, max: 2000 },
  },
  blogPost: {
    name: "Blog Post",
    description: "Write an engaging blog post",
    structure: ["Title", "Hook", "Main Content", "Call to Action"],
    wordRange: { min: 300, max: 1500 },
  },
  email: {
    name: "Email",
    description: "Write a professional email",
    structure: ["Subject Line", "Greeting", "Body", "Closing", "Signature"],
    wordRange: { min: 50, max: 500 },
  },
  report: {
    name: "Report",
    description: "Write a formal report",
    structure: [
      "Executive Summary",
      "Introduction",
      "Methodology",
      "Findings",
      "Analysis",
      "Recommendations",
      "Conclusion",
    ],
    wordRange: { min: 1000, max: 5000 },
  },
  documentation: {
    name: "Documentation",
    description: "Write technical documentation",
    structure: ["Overview", "Getting Started", "Usage", "API Reference", "Examples", "FAQ"],
    wordRange: { min: 500, max: 3000 },
  },
  socialMedia: {
    name: "Social Media",
    description: "Write social media content",
    structure: ["Hook", "Message", "Call to Action", "Hashtags"],
    wordRange: { min: 10, max: 280 },
  },
  script: {
    name: "Script",
    description: "Write a video or presentation script",
    structure: ["Opening", "Main Points", "Transitions", "Closing"],
    wordRange: { min: 200, max: 2000 },
  },
};

// Content quality checkers
export function validateWritingOutput(
  content: string,
  taskType: keyof typeof WRITING_TASKS
): {
  isValid: boolean;
  issues: string[];
  suggestions: string[];
  metrics: {
    wordCount: number;
    sentenceCount: number;
    avgWordsPerSentence: number;
    readabilityScore: number;
  };
} {
  const issues: string[] = [];
  const suggestions: string[] = [];

  // Calculate metrics
  const words = content.split(/\s+/).filter((w) => w.length > 0);
  const sentences = content.split(/[.!?]+/).filter((s) => s.trim().length > 0);
  const wordCount = words.length;
  const sentenceCount = sentences.length;
  const avgWordsPerSentence = sentenceCount > 0 ? wordCount / sentenceCount : 0;

  // Simple readability score (Flesch-like)
  const syllables = words.reduce((count, word) => {
    return count + countSyllables(word);
  }, 0);
  const readabilityScore = Math.max(
    0,
    Math.min(100, 206.835 - 1.015 * avgWordsPerSentence - 84.6 * (syllables / wordCount))
  );

  const task = WRITING_TASKS[taskType];

  // Check word count
  if (wordCount < task.wordRange.min) {
    issues.push(`Content is too short (${wordCount} words, minimum ${task.wordRange.min})`);
  }
  if (wordCount > task.wordRange.max) {
    suggestions.push(`Content may be too long (${wordCount} words, maximum ${task.wordRange.max})`);
  }

  // Check sentence length
  if (avgWordsPerSentence > 25) {
    suggestions.push("Consider breaking up long sentences for readability");
  }

  // Check for passive voice (simple heuristic)
  const passivePatterns = /\b(was|were|been|being|is|are|am)\s+\w+ed\b/gi;
  const passiveMatches = content.match(passivePatterns);
  if (passiveMatches && passiveMatches.length > 3) {
    suggestions.push("Consider reducing passive voice for more engaging writing");
  }

  // Check for filler words
  const fillerWords = ["very", "really", "just", "actually", "basically", "literally"];
  const fillerCount = fillerWords.reduce((count, word) => {
    const regex = new RegExp(`\\b${word}\\b`, "gi");
    return count + (content.match(regex)?.length || 0);
  }, 0);
  if (fillerCount > 5) {
    suggestions.push("Consider removing filler words for stronger writing");
  }

  return {
    isValid: issues.length === 0,
    issues,
    suggestions,
    metrics: {
      wordCount,
      sentenceCount,
      avgWordsPerSentence: Math.round(avgWordsPerSentence * 10) / 10,
      readabilityScore: Math.round(readabilityScore),
    },
  };
}

// Simple syllable counter
function countSyllables(word: string): number {
  word = word.toLowerCase();
  if (word.length <= 3) return 1;
  word = word.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, "");
  word = word.replace(/^y/, "");
  const matches = word.match(/[aeiouy]{1,2}/g);
  return matches ? matches.length : 1;
}

// Writing templates
export function generateOutline(
  taskType: keyof typeof WRITING_TASKS,
  topic: string
): string {
  const task = WRITING_TASKS[taskType];
  let outline = `# ${topic}\n\n`;
  outline += `Type: ${task.name}\n`;
  outline += `Target Word Count: ${task.wordRange.min}-${task.wordRange.max} words\n\n`;
  outline += `## Structure\n\n`;

  for (const section of task.structure) {
    outline += `### ${section}\n`;
    outline += `[TODO: Write ${section.toLowerCase()} content]\n\n`;
  }

  return outline;
}

// Build writing prompt
export function buildWritingPrompt(
  taskType: keyof typeof WRITING_TASKS,
  topic: string,
  context?: {
    style?: keyof typeof WRITING_AGENT_CONFIG.styles;
    audience?: string;
    keyPoints?: string[];
    tone?: string;
  }
): string {
  const task = WRITING_TASKS[taskType];
  let prompt = `Writing Task: ${task.name}\n`;
  prompt += `Topic: ${topic}\n`;
  prompt += `Description: ${task.description}\n\n`;

  if (context?.style) {
    const style = WRITING_AGENT_CONFIG.styles[context.style];
    prompt += `Style: ${context.style}\n`;
    prompt += `- Tone: ${style.tone}\n`;
    prompt += `- Vocabulary: ${style.vocabulary}\n`;
    prompt += `- Structure: ${style.structure}\n\n`;
  }

  if (context?.audience) {
    prompt += `Target Audience: ${context.audience}\n`;
  }

  if (context?.tone) {
    prompt += `Tone: ${context.tone}\n`;
  }

  if (context?.keyPoints?.length) {
    prompt += `\nKey Points to Cover:\n${context.keyPoints.map((p) => `- ${p}`).join("\n")}\n`;
  }

  prompt += `\nExpected Structure:\n${task.structure.map((s) => `- ${s}`).join("\n")}\n`;
  prompt += `\nWord Count Target: ${task.wordRange.min}-${task.wordRange.max} words\n`;
  prompt += `\nPlease write this content following your guidelines.`;

  return prompt;
}

export default {
  WRITING_AGENT_CONFIG,
  WRITING_TASKS,
  validateWritingOutput,
  generateOutline,
  buildWritingPrompt,
};
