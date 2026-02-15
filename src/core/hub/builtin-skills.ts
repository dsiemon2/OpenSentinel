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

  // ============================================
  // NEW SKILLS — Operations & DevOps
  // ============================================

  {
    name: "Deploy Status",
    description: "Check the deployment status of OpenSentinel services",
    trigger: "/deploy-status",
    instructions: `Check the current deployment status:
1. Run systemctl status opensentinel to check the service
2. Check the current git commit hash and branch
3. Show uptime and last restart time
4. Check disk space and memory usage
5. Report any recent errors from journalctl
Format as a clean status dashboard with pass/fail indicators.`,
    tools: ["execute_command"],
    tags: ["deploy", "devops", "status"],
    category: "development",
  },
  {
    name: "Server Health Check",
    description: "Quick server health snapshot with key metrics",
    trigger: "/server-check",
    instructions: `Run a comprehensive server health check:
1. Check CPU, memory, and disk usage
2. Verify all critical services are running (nginx, postgresql, redis, opensentinel)
3. Check recent error logs
4. Report overall health status
Present results as a concise dashboard. Flag anything concerning.`,
    tools: ["check_server"],
    tags: ["server", "health", "monitoring"],
    category: "utility",
  },
  {
    name: "Security Audit",
    description: "Run a quick security audit on the server",
    trigger: "/security",
    instructions: `Run a security audit:
1. Scan for failed SSH login attempts and brute-force activity
2. Check open ports and identify unexpected services
3. Verify file permissions on sensitive files (.env, SSH keys)
4. Check for available security updates
5. Provide a security score and top 3 recommended actions
Format with severity indicators (critical/warning/info).`,
    tools: ["security_scan"],
    tags: ["security", "audit", "server"],
    category: "utility",
  },
  {
    name: "Debug Helper",
    description: "Help debug an error or issue with context gathering",
    trigger: "/debug",
    instructions: `Help the user debug an issue:
1. Ask what error or unexpected behavior they're seeing
2. If a file is mentioned, read it and look for common issues
3. Check recent logs for related errors
4. Identify the likely root cause
5. Suggest a specific fix with code changes if applicable
Be methodical — gather context before jumping to solutions.`,
    tools: ["read_file", "execute_command"],
    tags: ["debug", "troubleshoot", "development"],
    category: "development",
  },
  {
    name: "API Tester",
    description: "Test an API endpoint and report the results",
    trigger: "/api-test",
    instructions: `Test the given API endpoint:
1. Make the HTTP request using curl (GET by default, or specified method)
2. Show the response status code, headers, and body
3. Measure response time
4. Validate the JSON response structure if applicable
5. Report any errors or unexpected responses
Format the response body with proper JSON formatting.`,
    tools: ["execute_command"],
    tags: ["api", "testing", "development"],
    category: "development",
  },

  // ============================================
  // NEW SKILLS — Research & Analysis
  // ============================================

  {
    name: "SEO Quick Audit",
    description: "Run a quick SEO analysis on any URL",
    trigger: "/seo",
    instructions: `Analyze the SEO of the given URL:
1. Check title tag, meta description, and heading structure
2. Analyze content length and keyword usage
3. Check for mobile-friendliness indicators
4. Score the page out of 100
5. Provide top 3 quick wins to improve SEO
Keep the output concise and actionable.`,
    tools: ["seo_analyze"],
    tags: ["seo", "marketing", "analysis"],
    category: "research",
  },
  {
    name: "Competitor Check",
    description: "Quick competitor intelligence snapshot",
    trigger: "/competitor",
    instructions: `Check on a competitor:
1. If the competitor is already tracked, check for recent changes
2. If not tracked, add them and capture initial snapshot
3. Summarize key findings: what they offer, recent changes, positioning
4. Compare briefly against our strengths
Keep it brief and actionable.`,
    tools: ["track_competitor"],
    tags: ["competitor", "intelligence", "business"],
    category: "research",
  },
  {
    name: "Market Brief",
    description: "Quick financial market overview with key movements",
    trigger: "/market",
    instructions: `Generate a concise market brief:
1. Show top crypto prices (BTC, ETH, SOL) with 24h change
2. Show major stock indices (S&P 500, Dow, NASDAQ)
3. Highlight biggest movers (up and down)
4. Note any significant market news
Format as a clean, scannable briefing under 300 words.`,
    tools: ["research_market"],
    tags: ["market", "finance", "trading"],
    category: "research",
  },
  {
    name: "Data Profile",
    description: "Profile and summarize any dataset quickly",
    trigger: "/profile-data",
    instructions: `Profile the provided dataset:
1. Parse the data (CSV or JSON)
2. Show column types, row counts, and null percentages
3. For numeric columns: show min, max, mean, median
4. For string columns: show unique values and top entries
5. Flag any outliers or data quality issues
6. Provide a plain-English summary of what the data shows
Keep statistical output clean and easy to read.`,
    tools: ["analyze_data"],
    tags: ["data", "analytics", "profiling"],
    category: "research",
  },

  // ============================================
  // NEW SKILLS — Communication & Productivity
  // ============================================

  {
    name: "Inbox Summary",
    description: "Check and summarize your email inbox",
    trigger: "/inbox",
    instructions: `Summarize the user's inbox:
1. Check the specified email address for recent emails
2. Triage each email by category and priority
3. Highlight urgent items that need immediate attention
4. List action items extracted from emails
5. Provide a brief digest summary
Format as a clean inbox dashboard with priority indicators.`,
    tools: ["check_email", "email_assistant"],
    tags: ["email", "inbox", "productivity"],
    category: "communication",
  },
  {
    name: "Pipeline Report",
    description: "Quick sales pipeline status report",
    trigger: "/pipeline",
    instructions: `Generate a sales pipeline report:
1. Show total leads and their distribution across stages
2. Highlight deals closest to closing
3. Show total pipeline value and win rate
4. List overdue follow-ups
5. Identify top 3 leads by value
Format as a clean pipeline dashboard.`,
    tools: ["sales_pipeline"],
    tags: ["sales", "pipeline", "crm"],
    category: "productivity",
  },
  {
    name: "Support Dashboard",
    description: "Quick view of support ticket status",
    trigger: "/support",
    instructions: `Generate a support dashboard:
1. Show total tickets by status (new, open, in_progress, resolved)
2. Highlight critical and escalated tickets
3. Show breakdown by category
4. List tickets needing immediate attention
5. Show average resolution time if available
Format as a clean support dashboard.`,
    tools: ["customer_support"],
    tags: ["support", "tickets", "dashboard"],
    category: "productivity",
  },
  {
    name: "Onboard New Hire",
    description: "Set up an onboarding plan for a new team member",
    trigger: "/onboard",
    instructions: `Create an onboarding plan for a new team member:
1. Ask for the person's name and role
2. Create an appropriate onboarding plan (employee, developer, or custom)
3. Show the full plan with all steps
4. Highlight what needs to happen in the first week
5. Offer to customize or add steps
Make the plan welcoming and practical.`,
    tools: ["onboarding"],
    tags: ["onboarding", "hr", "hiring"],
    category: "productivity",
  },

  // ============================================
  // NEW SKILLS — Utility
  // ============================================

  {
    name: "Translate Text",
    description: "Translate text between any languages",
    trigger: "/translate",
    instructions: `Translate the given text:
1. Auto-detect the source language
2. Translate to the requested target language (default: English)
3. Provide the translation with proper grammar and natural phrasing
4. Note any idioms or cultural context that doesn't translate directly
5. If the text is ambiguous, provide alternative translations
Keep formatting intact from the original.`,
    tools: [],
    tags: ["translate", "language", "utility"],
    category: "utility",
  },
  {
    name: "Compare Options",
    description: "Compare two or more options with pros and cons",
    trigger: "/compare",
    instructions: `Compare the given options objectively:
1. Research each option if needed
2. Create a comparison table with key criteria
3. List pros and cons for each
4. Consider cost, quality, features, and fit
5. Provide a recommendation with reasoning
Be balanced and fact-based. Clearly state any assumptions.`,
    tools: ["web_search"],
    tags: ["compare", "decision", "analysis"],
    category: "utility",
  },
];
