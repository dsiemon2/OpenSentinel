// Built-in starter skills shipped with OpenSentinel

export interface BuiltinSkillDef {
  name: string;
  description: string;
  trigger: string;
  instructions: string;
  tools: string[];
  tags: string[];
  category: "productivity" | "development" | "research" | "communication" | "utility";
}

export const BUILTIN_SKILLS: BuiltinSkillDef[] = [
  {
    name: "Summarize Webpage",
    description: "Summarize any webpage URL into key points",
    trigger: "/summarize-url",
    instructions: `Given a URL, browse to it and create a concise summary with:
1. A one-sentence TL;DR
2. 3-5 key points as bullet points
3. Any important dates, numbers, or names mentioned
Keep the summary under 200 words.`,
    tools: ["browse_url", "web_search"],
    tags: ["research", "summary", "web"],
    category: "research",
  },
  {
    name: "Daily Briefing",
    description: "Generate a personalized daily briefing with news, weather, and tasks",
    trigger: "/briefing",
    instructions: `Generate a concise daily briefing that includes:
1. Top 3 news headlines (use web search)
2. Weather summary for the user's location
3. Any scheduled tasks or reminders for today
4. A motivational quote
Format as a clean, scannable message with emojis for sections.`,
    tools: ["web_search", "browse_url"],
    tags: ["daily", "news", "productivity"],
    category: "productivity",
  },
  {
    name: "Code Review",
    description: "Review a code file for bugs, style issues, and improvements",
    trigger: "/review",
    instructions: `Review the provided code file or snippet. Analyze for:
1. Bugs and potential runtime errors
2. Security vulnerabilities (injection, XSS, etc.)
3. Performance issues
4. Code style and readability
5. Missing error handling
Rate severity (critical/warning/info) for each finding.
Provide specific line numbers and suggested fixes.`,
    tools: ["read_file"],
    tags: ["code", "review", "development"],
    category: "development",
  },
  {
    name: "Meeting Notes",
    description: "Structure raw meeting notes into organized action items",
    trigger: "/meeting-notes",
    instructions: `Transform raw meeting notes or a transcript into structured output:
1. **Meeting Summary** - 2-3 sentence overview
2. **Key Decisions** - Bulleted list of decisions made
3. **Action Items** - Each with owner, deadline, and description
4. **Open Questions** - Unresolved items needing follow-up
5. **Next Steps** - What happens next
Format clearly with markdown headers.`,
    tools: ["read_file", "write_file"],
    tags: ["meeting", "notes", "productivity"],
    category: "productivity",
  },
  {
    name: "Explain Like I'm 5",
    description: "Explain any concept in simple, easy-to-understand terms",
    trigger: "/eli5",
    instructions: `Explain the given concept in the simplest possible terms:
- Use everyday analogies and metaphors
- Avoid technical jargon entirely
- Use short sentences
- Include a fun real-world comparison
- Keep it under 100 words
- End with "In other words: [one-sentence summary]"`,
    tools: ["web_search"],
    tags: ["explain", "learning", "simple"],
    category: "utility",
  },
  {
    name: "Quick Email Draft",
    description: "Draft a professional email from a brief description",
    trigger: "/draft-email",
    instructions: `Draft a professional email based on the user's description:
- Infer appropriate tone (formal, friendly, urgent) from context
- Include subject line suggestion
- Keep it concise but complete
- Include proper greeting and closing
- If the user mentions a recipient or context, adapt accordingly
Output format: Subject, Body, optional PS/follow-up note.`,
    tools: [],
    tags: ["email", "writing", "communication"],
    category: "communication",
  },
  {
    name: "Git Changelog",
    description: "Generate a changelog from recent git commits",
    trigger: "/changelog",
    instructions: `Generate a formatted changelog from git history:
1. Run git log to get recent commits
2. Group commits by type (feat, fix, refactor, docs, etc.)
3. Format as a markdown changelog with categories
4. Include commit hashes as references
5. Highlight breaking changes prominently
Format following Keep a Changelog conventions.`,
    tools: ["execute_command"],
    tags: ["git", "changelog", "development"],
    category: "development",
  },
  {
    name: "Research Topic",
    description: "Deep-dive research on any topic with sources",
    trigger: "/research",
    instructions: `Conduct thorough research on the given topic:
1. Search for multiple sources
2. Synthesize findings into a structured report
3. Include: Overview, Key Facts, Different Perspectives, Recent Developments
4. Cite sources with URLs
5. Note confidence level for each claim
6. Flag any conflicting information
Keep the report focused and under 500 words.`,
    tools: ["web_search", "browse_url"],
    tags: ["research", "analysis", "deep-dive"],
    category: "research",
  },
  {
    name: "Screenshot Analysis",
    description: "Take a screenshot and describe what's on screen",
    trigger: "/what-on-screen",
    instructions: `Take a screenshot and provide a detailed analysis:
1. Describe what application/website is visible
2. Identify key UI elements and their state
3. Note any errors, warnings, or notifications
4. Describe the overall layout
5. If code is visible, summarize what it does
Be specific about positions (top-left, center, etc.).`,
    tools: ["screenshot_analyze"],
    tags: ["screenshot", "vision", "analysis"],
    category: "utility",
  },
  {
    name: "Regex Helper",
    description: "Build and explain regular expressions",
    trigger: "/regex",
    instructions: `Help the user build a regular expression:
1. Understand what they want to match
2. Build the regex step by step, explaining each part
3. Provide the final regex in multiple flavors if needed (JS, Python, PCRE)
4. Include 3-5 test cases showing matches and non-matches
5. Explain any edge cases or gotchas
Format with code blocks for readability.`,
    tools: [],
    tags: ["regex", "development", "utility"],
    category: "development",
  },
];
