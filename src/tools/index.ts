import type { Tool } from "@anthropic-ai/sdk/resources/messages";
import { isMCPTool, executeMCPTool, type MCPRegistry } from "../core/mcp";
import { executeCommand } from "./shell";
import {
  listDirectory,
  readFileContent,
  writeFileContent,
  searchFiles,
} from "./files";
import { navigateTo, searchGoogle, takeScreenshot as browserScreenshot } from "./browser";
import { webSearch, research } from "./web-search";
import { analyzeImage } from "./image-analysis";
import { performOCR, extractStructuredData } from "./ocr";
import { screenshotAndAnalyze, takeScreenshot as systemScreenshot } from "./screenshot";
import { generatePDF } from "./file-generation/pdf";
import { generateSpreadsheet } from "./file-generation/spreadsheet";
import { generateChart } from "./file-generation/charts";
import { generateDiagram, generateStructuredDiagram } from "./file-generation/diagrams";
import { spawnAgent, getAgent, cancelAgent } from "../core/agents/agent-manager";
import { renderMath, renderMathDocument } from "./rendering/math-renderer";
import { highlightCode, renderCode } from "./rendering/code-highlighter";
import { markdownToHtml, renderMarkdown } from "./rendering/markdown-renderer";
import {
  summarizeVideo,
  quickSummarizeVideo,
  detailedSummarizeVideo,
  extractKeyMoments,
  getVideoInfo,
} from "./video-summarization";
import { applyPatch } from "./patch";
import { pollManager } from "../core/polls";
import { skillRegistry } from "../core/skills/skill-registry";
import { skillExecutor } from "../core/skills/skill-executor";
import { sentinelHub } from "../core/hub";
import { ImapClient, type EmailMessage } from "../integrations/email/imap-client";
import { SmtpClient } from "../integrations/email/smtp-client";
import { env } from "../config/env";
import {
  addMonitor,
  removeMonitor,
  checkForChanges,
  listMonitors,
} from "./web-monitor";
import { checkServerHealth, checkService, getRecentLogs } from "./server-health";
import {
  reviewPullRequest,
  summarizeChanges,
  securityScan,
} from "../integrations/github/code-review";
import { runSecurityScan } from "./security-monitor";
import { parseCSV, profileData } from "./data-analyst";
import { buildContentPrompt, packageContent, type Platform, type ContentBrief } from "./content-creator";
import {
  addCompetitor,
  removeCompetitor,
  listCompetitors,
  trackCompetitor,
  getCompetitorReport,
  compareCompetitors,
} from "./competitor-tracker";
import {
  researchAsset,
  getMarketOverview,
  compareAssets,
  getTechnicalSummary,
  getMarketNews,
  detectAssetType,
} from "./trading-researcher";
import {
  analyzeSEO,
  analyzeContentForSEO,
  comparePageSEO,
  type SEOAnalysis,
} from "./seo-optimizer";
import {
  addLead,
  updateLead,
  removeLead,
  getLead,
  listLeads,
  getPipelineSummary,
  getFollowUps,
} from "./sales-tracker";
import {
  addBrandMonitor,
  removeBrandMonitor,
  listBrandMonitors,
  scanMentions,
  getSentimentReport,
  analyzeSentiment,
} from "./social-listener";
import { reviewDocument } from "./legal-reviewer";
import {
  addItem as addInventoryItem,
  updateQuantity,
  removeItem as removeInventoryItem,
  getItem as getInventoryItem,
  listItems as listInventoryItems,
  getItemHistory,
  getInventorySummary,
} from "./inventory-manager";
import { analyzeProperty, compareProperties, calculateMortgage } from "./real-estate";
import {
  addSite,
  removeSite,
  checkSite,
  checkAllSites,
  listSites,
  getUptimeReport,
} from "./uptime-monitor";
import { lookupDNS, getDomainInfo } from "./dns-lookup";
import {
  createTicket,
  updateTicket,
  getTicket,
  listTickets,
  getTicketSummary,
  getSuggestedResponse,
  getEscalationQueue,
} from "./customer-support";
import {
  triageEmail,
  extractActions,
  generateDigest,
  draftReply,
} from "./email-assistant";
import {
  addMeeting,
  getMeeting,
  listMeetings,
  updateAction as updateMeetingAction,
  getAllPendingActions,
  getWeeklyDigest,
  extractActionItems as extractMeetingActions,
  extractDecisions,
  summarizeMeeting,
} from "./meeting-assistant";
import {
  generateAPIRef,
  generateChangelog,
  generateGuide,
  generateReadme,
  documentInterfaces,
} from "./docs-writer";
import {
  createPlan,
  completeStep,
  skipStep,
  addNote as addOnboardingNote,
  addStep as addOnboardingStep,
  getPlan,
  listPlans,
  getOnboardingSummary,
  answerFAQ,
} from "./onboarding-agent";
import {
  addCandidate,
  screenCandidates,
  updateCandidate,
  getCandidate,
  listCandidates,
  removeCandidate,
  getPipelineSummary as getRecruitPipeline,
  draftOutreach,
  scoreCandidate,
} from "./recruiter";
import {
  osintSearch,
  osintGraphQuery,
  osintEnrich,
  osintAnalyze,
} from "./osint";

// Helper: create an IMAP client for any local mailbox using Dovecot master user
function createLocalImapClient(emailAddress: string): ImapClient {
  const masterUser = env.EMAIL_MASTER_USER;
  const masterPassword = env.EMAIL_MASTER_PASSWORD;
  if (!masterUser || !masterPassword) {
    throw new Error(
      "Email master credentials not configured. Set EMAIL_MASTER_USER and EMAIL_MASTER_PASSWORD in .env"
    );
  }
  return new ImapClient({
    host: env.EMAIL_LOCAL_IMAP_HOST || "127.0.0.1",
    port: env.EMAIL_LOCAL_IMAP_PORT || 993,
    secure: true,
    user: `${emailAddress}*${masterUser}`,
    password: masterPassword,
    tls: { rejectUnauthorized: false },
  });
}

// Helper: create an SMTP client for sending from any local address
function createLocalSmtpClient(fromAddress: string): SmtpClient {
  return new SmtpClient(
    {
      host: env.EMAIL_LOCAL_SMTP_HOST || "127.0.0.1",
      port: env.EMAIL_LOCAL_SMTP_PORT || 25,
      secure: false,
      auth: { user: "", pass: "" },
      tls: { rejectUnauthorized: false },
    },
    fromAddress
  );
}

// Helper: format emails into a readable summary
function formatEmailList(emails: EmailMessage[]): string {
  if (emails.length === 0) return "No emails found.";
  return emails
    .map((email, idx) => {
      const from = email.from[0];
      const fromDisplay = from ? (from.name || from.address) : "Unknown";
      const unread = email.flags.includes("\\Seen") ? "" : " [UNREAD]";
      let line = `${idx + 1}. ${fromDisplay} — "${email.subject}"${unread}\n`;
      line += `   Date: ${email.date.toISOString()} | UID: ${email.uid}`;
      if (email.attachments.length > 0) {
        line += ` | ${email.attachments.length} attachment(s)`;
      }
      if (email.snippet) {
        line += `\n   ${email.snippet.substring(0, 150)}`;
      }
      return line;
    })
    .join("\n\n");
}

// Define tools for Claude
export const TOOLS: Tool[] = [
  {
    name: "execute_command",
    description:
      "Execute a shell command on the system. Use for system tasks, git operations, running scripts, etc. Some dangerous commands are blocked for safety.",
    input_schema: {
      type: "object" as const,
      properties: {
        command: {
          type: "string",
          description: "The shell command to execute",
        },
        working_directory: {
          type: "string",
          description: "Optional working directory for the command",
        },
      },
      required: ["command"],
    },
  },
  {
    name: "list_directory",
    description: "List files and folders in a directory",
    input_schema: {
      type: "object" as const,
      properties: {
        path: {
          type: "string",
          description: "The directory path to list",
        },
      },
      required: ["path"],
    },
  },
  {
    name: "read_file",
    description: "Read the contents of a file",
    input_schema: {
      type: "object" as const,
      properties: {
        path: {
          type: "string",
          description: "The file path to read",
        },
      },
      required: ["path"],
    },
  },
  {
    name: "write_file",
    description: "Write content to a file (creates or overwrites)",
    input_schema: {
      type: "object" as const,
      properties: {
        path: {
          type: "string",
          description: "The file path to write to",
        },
        content: {
          type: "string",
          description: "The content to write",
        },
      },
      required: ["path", "content"],
    },
  },
  {
    name: "search_files",
    description: "Search for files matching a glob pattern",
    input_schema: {
      type: "object" as const,
      properties: {
        pattern: {
          type: "string",
          description: "Glob pattern to search for (e.g., '**/*.ts')",
        },
        base_path: {
          type: "string",
          description: "Base directory to search from",
        },
      },
      required: ["pattern"],
    },
  },
  {
    name: "web_search",
    description: "Search the web for information",
    input_schema: {
      type: "object" as const,
      properties: {
        query: {
          type: "string",
          description: "The search query",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "browse_url",
    description: "Navigate to a URL and extract its content",
    input_schema: {
      type: "object" as const,
      properties: {
        url: {
          type: "string",
          description: "The URL to browse",
        },
      },
      required: ["url"],
    },
  },
  {
    name: "take_screenshot",
    description: "Take a screenshot of the current browser page",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "analyze_image",
    description: "Analyze an image using AI vision. Can describe, extract information, or answer questions about images.",
    input_schema: {
      type: "object" as const,
      properties: {
        image_url: {
          type: "string",
          description: "URL of the image to analyze",
        },
        image_path: {
          type: "string",
          description: "Local file path of the image to analyze",
        },
        prompt: {
          type: "string",
          description: "What to analyze or ask about the image",
        },
      },
      required: ["prompt"],
    },
  },
  {
    name: "ocr_document",
    description: "Extract text from an image or document using OCR",
    input_schema: {
      type: "object" as const,
      properties: {
        file_path: {
          type: "string",
          description: "Path to the image or PDF file",
        },
        language: {
          type: "string",
          description: "Expected language of the text (default: English)",
        },
      },
      required: ["file_path"],
    },
  },
  {
    name: "extract_document_data",
    description: "Extract structured data from documents like receipts, invoices, forms, or tables",
    input_schema: {
      type: "object" as const,
      properties: {
        file_path: {
          type: "string",
          description: "Path to the document image",
        },
        data_type: {
          type: "string",
          enum: ["table", "form", "receipt", "invoice"],
          description: "Type of data to extract",
        },
      },
      required: ["file_path"],
    },
  },
  {
    name: "screenshot_analyze",
    description: "Take a screenshot of the desktop and analyze it with AI",
    input_schema: {
      type: "object" as const,
      properties: {
        prompt: {
          type: "string",
          description: "What to analyze or look for in the screenshot",
        },
        region: {
          type: "string",
          description: "Screen region: 'full', 'active_window', or coordinates 'x,y,width,height'",
        },
      },
      required: ["prompt"],
    },
  },
  {
    name: "generate_pdf",
    description: "Generate a PDF document from markdown or HTML content",
    input_schema: {
      type: "object" as const,
      properties: {
        content: {
          type: "string",
          description: "The markdown or HTML content for the PDF",
        },
        filename: {
          type: "string",
          description: "Output filename for the PDF",
        },
        content_type: {
          type: "string",
          enum: ["markdown", "html"],
          description: "Type of content (default: markdown)",
        },
        title: {
          type: "string",
          description: "Document title",
        },
      },
      required: ["content", "filename"],
    },
  },
  {
    name: "generate_spreadsheet",
    description: "Generate a spreadsheet (Excel or CSV) from data",
    input_schema: {
      type: "object" as const,
      properties: {
        data: {
          type: "array",
          description: "Data rows (2D array or array of objects)",
        },
        filename: {
          type: "string",
          description: "Output filename (.xlsx or .csv)",
        },
        headers: {
          type: "array",
          description: "Column headers",
          items: { type: "string" },
        },
        sheet_name: {
          type: "string",
          description: "Name of the worksheet",
        },
      },
      required: ["data", "filename"],
    },
  },
  {
    name: "generate_chart",
    description: "Generate a chart as SVG",
    input_schema: {
      type: "object" as const,
      properties: {
        type: {
          type: "string",
          enum: ["bar", "line", "pie", "doughnut", "scatter", "area"],
          description: "Type of chart",
        },
        labels: {
          type: "array",
          description: "Labels for data points",
          items: { type: "string" },
        },
        values: {
          type: "array",
          description: "Numeric values",
          items: { type: "number" },
        },
        title: {
          type: "string",
          description: "Chart title",
        },
        filename: {
          type: "string",
          description: "Output filename for the SVG",
        },
      },
      required: ["type", "labels", "values"],
    },
  },
  {
    name: "generate_diagram",
    description: "Generate a diagram using Mermaid syntax",
    input_schema: {
      type: "object" as const,
      properties: {
        type: {
          type: "string",
          enum: ["flowchart", "sequence", "class", "state", "er", "gantt", "mindmap"],
          description: "Type of diagram",
        },
        mermaid_code: {
          type: "string",
          description: "Mermaid diagram code (if providing raw code)",
        },
        data: {
          type: "object",
          description: "Structured data for the diagram (alternative to mermaid_code)",
        },
        filename: {
          type: "string",
          description: "Output filename",
        },
      },
      required: ["type"],
    },
  },
  {
    name: "spawn_agent",
    description: "Spawn a background agent to work on a task autonomously",
    input_schema: {
      type: "object" as const,
      properties: {
        type: {
          type: "string",
          enum: ["research", "coding", "writing", "analysis"],
          description: "Type of agent to spawn",
        },
        objective: {
          type: "string",
          description: "The objective/task for the agent",
        },
        context: {
          type: "object",
          description: "Additional context for the agent",
        },
        token_budget: {
          type: "number",
          description: "Maximum tokens the agent can use",
        },
      },
      required: ["type", "objective"],
    },
  },
  {
    name: "check_agent",
    description: "Check the status and progress of a running agent",
    input_schema: {
      type: "object" as const,
      properties: {
        agent_id: {
          type: "string",
          description: "The ID of the agent to check",
        },
      },
      required: ["agent_id"],
    },
  },
  {
    name: "cancel_agent",
    description: "Cancel a running agent",
    input_schema: {
      type: "object" as const,
      properties: {
        agent_id: {
          type: "string",
          description: "The ID of the agent to cancel",
        },
      },
      required: ["agent_id"],
    },
  },
  {
    name: "render_math",
    description: "Render a LaTeX mathematical expression to SVG/HTML. Useful for displaying equations, formulas, and mathematical notation.",
    input_schema: {
      type: "object" as const,
      properties: {
        latex: {
          type: "string",
          description: "LaTeX expression to render (e.g., 'x = \\frac{-b \\pm \\sqrt{b^2-4ac}}{2a}')",
        },
        display_mode: {
          type: "boolean",
          description: "true for block/display math, false for inline (default: true)",
        },
        filename: {
          type: "string",
          description: "Optional filename to save the rendered SVG",
        },
        font_size: {
          type: "number",
          description: "Font size in pixels (default: 20)",
        },
        color: {
          type: "string",
          description: "Text color (default: black)",
        },
      },
      required: ["latex"],
    },
  },
  {
    name: "render_math_document",
    description: "Render multiple LaTeX expressions into an HTML document with MathJax support",
    input_schema: {
      type: "object" as const,
      properties: {
        expressions: {
          type: "array",
          description: "Array of expressions with latex and optional label",
          items: {
            type: "object",
            properties: {
              latex: { type: "string" },
              label: { type: "string" },
            },
            required: ["latex"],
          },
        },
        filename: {
          type: "string",
          description: "Output filename for the HTML document",
        },
      },
      required: ["expressions"],
    },
  },
  {
    name: "render_code",
    description: "Syntax highlight code with themes. Outputs styled HTML for code display.",
    input_schema: {
      type: "object" as const,
      properties: {
        code: {
          type: "string",
          description: "The source code to highlight",
        },
        language: {
          type: "string",
          enum: ["typescript", "javascript", "python", "go", "rust"],
          description: "Programming language (default: javascript)",
        },
        theme: {
          type: "string",
          enum: ["light", "dark", "github", "monokai"],
          description: "Color theme (default: dark)",
        },
        line_numbers: {
          type: "boolean",
          description: "Show line numbers (default: true)",
        },
        highlight_lines: {
          type: "array",
          description: "Line numbers to highlight",
          items: { type: "number" },
        },
        title: {
          type: "string",
          description: "Optional title/filename to display above the code",
        },
        filename: {
          type: "string",
          description: "Output filename to save the HTML",
        },
      },
      required: ["code"],
    },
  },
  {
    name: "render_markdown",
    description: "Convert markdown to styled HTML. Supports code blocks, tables, images, links, and more.",
    input_schema: {
      type: "object" as const,
      properties: {
        markdown: {
          type: "string",
          description: "The markdown content to render",
        },
        theme: {
          type: "string",
          enum: ["light", "dark", "github"],
          description: "Visual theme (default: github)",
        },
        syntax_highlight: {
          type: "boolean",
          description: "Enable syntax highlighting in code blocks (default: true)",
        },
        table_of_contents: {
          type: "boolean",
          description: "Generate a table of contents from headings (default: false)",
        },
        filename: {
          type: "string",
          description: "Output filename to save the HTML",
        },
      },
      required: ["markdown"],
    },
  },
  {
    name: "summarize_video",
    description: "Summarize a video file by extracting frames, transcribing audio, and generating a comprehensive summary with key moments.",
    input_schema: {
      type: "object" as const,
      properties: {
        video_path: {
          type: "string",
          description: "Path to the video file to summarize",
        },
        frame_count: {
          type: "number",
          description: "Number of frames to extract and analyze (default: 8, max: 20)",
        },
        include_transcript: {
          type: "boolean",
          description: "Whether to transcribe audio (default: true if video has audio)",
        },
        analysis_depth: {
          type: "string",
          enum: ["quick", "standard", "detailed"],
          description: "Depth of analysis (default: standard)",
        },
        language: {
          type: "string",
          description: "Language for transcription (default: en)",
        },
        focus_areas: {
          type: "array",
          description: "Specific aspects to focus on in the analysis",
          items: { type: "string" },
        },
      },
      required: ["video_path"],
    },
  },
  {
    name: "video_info",
    description: "Get basic information about a video file (duration, resolution, codec, etc.) without full analysis.",
    input_schema: {
      type: "object" as const,
      properties: {
        video_path: {
          type: "string",
          description: "Path to the video file",
        },
      },
      required: ["video_path"],
    },
  },
  {
    name: "extract_video_moments",
    description: "Extract and analyze key moments from a video without generating a full summary.",
    input_schema: {
      type: "object" as const,
      properties: {
        video_path: {
          type: "string",
          description: "Path to the video file",
        },
        frame_count: {
          type: "number",
          description: "Number of key moments to extract (default: 8)",
        },
      },
      required: ["video_path"],
    },
  },
  {
    name: "apply_patch",
    description: "Apply a unified diff patch to a file. Useful for making targeted code changes with context-aware matching.",
    input_schema: {
      type: "object" as const,
      properties: {
        file_path: {
          type: "string",
          description: "Path to the file to patch",
        },
        patch: {
          type: "string",
          description: "Unified diff patch content (with @@ hunk headers, +/- lines)",
        },
        create_backup: {
          type: "boolean",
          description: "Create a .bak backup before patching (default: true)",
        },
      },
      required: ["file_path", "patch"],
    },
  },
  {
    name: "create_poll",
    description: "Create a poll for users to vote on. Supports multiple choice and timed auto-close.",
    input_schema: {
      type: "object" as const,
      properties: {
        question: {
          type: "string",
          description: "The poll question",
        },
        options: {
          type: "array",
          description: "List of answer options (2-10)",
          items: { type: "string" },
        },
        multi_select: {
          type: "boolean",
          description: "Allow multiple selections (default: false)",
        },
        duration: {
          type: "number",
          description: "Auto-close after this many minutes (optional)",
        },
      },
      required: ["question", "options"],
    },
  },
  {
    name: "teach_skill",
    description: "Create a new reusable skill that OpenSentinel can execute on demand. Skills are user-teachable workflows with custom instructions.",
    input_schema: {
      type: "object" as const,
      properties: {
        name: {
          type: "string",
          description: "Skill name",
        },
        description: {
          type: "string",
          description: "What the skill does",
        },
        instructions: {
          type: "string",
          description: "Detailed instructions for executing the skill (system prompt)",
        },
        tools: {
          type: "array",
          description: "List of tool names this skill can use",
          items: { type: "string" },
        },
      },
      required: ["name", "description", "instructions"],
    },
  },
  {
    name: "run_skill",
    description: "Execute a previously created skill by name or trigger",
    input_schema: {
      type: "object" as const,
      properties: {
        skill: {
          type: "string",
          description: "Skill name, ID, or trigger (e.g., 'Code Review' or '/review')",
        },
        input: {
          type: "string",
          description: "User input to pass to the skill",
        },
      },
      required: ["skill"],
    },
  },
  {
    name: "hub_browse",
    description: "Browse the Sentinel Hub marketplace for skills, plugins, templates, and workflows",
    input_schema: {
      type: "object" as const,
      properties: {
        category: {
          type: "string",
          enum: ["skills", "plugins", "templates", "workflows"],
          description: "Filter by category",
        },
        search: {
          type: "string",
          description: "Search query",
        },
      },
      required: [],
    },
  },
  {
    name: "hub_install",
    description: "Install an item from the Sentinel Hub marketplace",
    input_schema: {
      type: "object" as const,
      properties: {
        item_id: {
          type: "string",
          description: "The hub item ID to install",
        },
      },
      required: ["item_id"],
    },
  },
  {
    name: "hub_publish",
    description: "Publish a skill, plugin, or workflow to the Sentinel Hub for sharing",
    input_schema: {
      type: "object" as const,
      properties: {
        name: {
          type: "string",
          description: "Item name",
        },
        description: {
          type: "string",
          description: "Item description",
        },
        category: {
          type: "string",
          enum: ["skills", "plugins", "templates", "workflows"],
          description: "Item category",
        },
        data: {
          type: "string",
          description: "JSON-serialized item content",
        },
        tags: {
          type: "array",
          description: "Tags for discovery",
          items: { type: "string" },
        },
      },
      required: ["name", "description", "category", "data"],
    },
  },
  {
    name: "check_email",
    description:
      "Check an email inbox for recent or unread messages. Connects to the local mail server and fetches emails for the specified address. Returns a formatted summary including sender, subject, date, and snippet.",
    input_schema: {
      type: "object" as const,
      properties: {
        email_address: {
          type: "string",
          description: "The email address to check (e.g., admin@mangydogcoffee.com)",
        },
        folder: {
          type: "string",
          description: "Mailbox folder to check (default: INBOX)",
        },
        unread_only: {
          type: "boolean",
          description: "Only show unread emails (default: false)",
        },
        limit: {
          type: "number",
          description: "Maximum number of emails to return (default: 20)",
        },
      },
      required: ["email_address"],
    },
  },
  {
    name: "send_email",
    description:
      "Send an email from a local mailbox. Uses the local mail server to send email from any configured domain address.",
    input_schema: {
      type: "object" as const,
      properties: {
        from: {
          type: "string",
          description: "Sender email address (e.g., admin@mangydogcoffee.com)",
        },
        to: {
          type: "string",
          description: "Recipient email address(es), comma-separated for multiple",
        },
        subject: {
          type: "string",
          description: "Email subject line",
        },
        body: {
          type: "string",
          description: "Email body text",
        },
        html: {
          type: "string",
          description: "Optional HTML body (body becomes the plain-text fallback)",
        },
        cc: {
          type: "string",
          description: "CC recipients, comma-separated",
        },
        bcc: {
          type: "string",
          description: "BCC recipients, comma-separated",
        },
      },
      required: ["from", "to", "subject", "body"],
    },
  },
  {
    name: "search_email",
    description:
      "Search emails in a mailbox by criteria such as sender, subject, date range, or read status.",
    input_schema: {
      type: "object" as const,
      properties: {
        email_address: {
          type: "string",
          description: "The email address/mailbox to search",
        },
        from: {
          type: "string",
          description: "Filter by sender address or name",
        },
        subject: {
          type: "string",
          description: "Filter by subject (partial match)",
        },
        since: {
          type: "string",
          description: "Only emails after this date (ISO 8601, e.g., 2026-02-01)",
        },
        before: {
          type: "string",
          description: "Only emails before this date (ISO 8601)",
        },
        unread_only: {
          type: "boolean",
          description: "Only return unread emails",
        },
        folder: {
          type: "string",
          description: "Mailbox folder to search (default: INBOX)",
        },
        limit: {
          type: "number",
          description: "Maximum results to return (default: 20)",
        },
      },
      required: ["email_address"],
    },
  },
  {
    name: "reply_email",
    description:
      "Reply to a specific email. Looks up the original email by UID, then sends a properly threaded reply with correct headers.",
    input_schema: {
      type: "object" as const,
      properties: {
        email_address: {
          type: "string",
          description: "The mailbox that received the email (becomes the From address)",
        },
        email_uid: {
          type: "number",
          description: "The UID of the email to reply to (returned by check_email or search_email)",
        },
        body: {
          type: "string",
          description: "The reply body text",
        },
        html: {
          type: "string",
          description: "Optional HTML reply body",
        },
        reply_all: {
          type: "boolean",
          description: "Reply to all recipients (default: false)",
        },
        folder: {
          type: "string",
          description: "Folder where the original email is (default: INBOX)",
        },
      },
      required: ["email_address", "email_uid", "body"],
    },
  },
  // ── Web Monitor Tools ─────────────────────────────────────────────────
  {
    name: "monitor_url",
    description:
      "Monitor a web page for changes. On first call, captures a baseline snapshot. On subsequent calls, detects changes and reports what was added or removed. Use this to track competitor pages, pricing changes, job postings, documentation updates, etc.",
    input_schema: {
      type: "object" as const,
      properties: {
        url: {
          type: "string",
          description: "The URL to monitor for changes",
        },
        label: {
          type: "string",
          description: "A friendly label for this monitor (e.g., 'Competitor pricing page')",
        },
        action: {
          type: "string",
          enum: ["check", "add", "remove", "list"],
          description:
            "Action to perform: 'check' fetches and compares (default), 'add' starts monitoring, 'remove' stops monitoring, 'list' shows all monitors",
        },
      },
      required: ["url"],
    },
  },
  // ── DevOps / Server Health Tools ──────────────────────────────────────
  {
    name: "check_server",
    description:
      "Run a comprehensive health check on the server. Returns CPU, memory, disk usage, service statuses, recent errors, and an overall health assessment. Use this to monitor server health, diagnose issues, or get a quick status report.",
    input_schema: {
      type: "object" as const,
      properties: {
        services: {
          type: "array",
          description:
            "Specific services to check (default: opensentinel, nginx, postgresql, redis-server, postfix, dovecot, opendkim)",
          items: { type: "string" },
        },
        service_detail: {
          type: "string",
          description:
            "Get detailed status + recent logs for a specific service (e.g., 'nginx', 'opensentinel')",
        },
        logs: {
          type: "object",
          description: "Fetch recent logs. Properties: service (optional), lines (default 50), priority ('err'|'warning'|'info')",
          properties: {
            service: { type: "string" },
            lines: { type: "number" },
            priority: { type: "string", enum: ["err", "warning", "info"] },
          },
        },
      },
      required: [],
    },
  },
  // ── Code Review Tool ─────────────────────────────────────────────────
  {
    name: "review_pull_request",
    description:
      "AI-powered code review for GitHub pull requests. Reviews code changes for security issues, bugs, best practices, and maintainability. Can also summarize changes or run a security-focused scan.",
    input_schema: {
      type: "object" as const,
      properties: {
        repo: {
          type: "string",
          description: "Repository in 'owner/repo' format or full GitHub URL",
        },
        pr_number: {
          type: "number",
          description: "Pull request number to review",
        },
        action: {
          type: "string",
          enum: ["review", "summarize", "security_scan"],
          description:
            "Action: 'review' for full code review (default), 'summarize' for change summary, 'security_scan' for security-focused analysis",
        },
        focus_areas: {
          type: "array",
          description:
            "Areas to focus on: security, performance, maintainability, readability, testing, documentation, error-handling, best-practices",
          items: { type: "string" },
        },
        auto_submit: {
          type: "boolean",
          description: "Automatically submit the review as a GitHub review comment (default: false)",
        },
        max_files: {
          type: "number",
          description: "Maximum number of files to review (default: 20)",
        },
      },
      required: ["repo", "pr_number"],
    },
  },
  // ── Security Monitor Tool ────────────────────────────────────────────
  {
    name: "security_scan",
    description:
      "Run a security audit on the server. Analyzes SSH auth logs for brute force attempts, audits open network ports, checks file permissions on critical configs (.env, sshd_config, shadow), and provides actionable recommendations.",
    input_schema: {
      type: "object" as const,
      properties: {
        hours: {
          type: "number",
          description: "How many hours of auth logs to analyze (default: 24)",
        },
      },
      required: [],
    },
  },
  // ── Data Analyst Tool ────────────────────────────────────────────────
  {
    name: "analyze_data",
    description:
      "Profile and analyze a dataset. Accepts CSV text, JSON array, or a file path. Returns column statistics (min, max, mean, median, std dev), data types, null counts, top values, outlier detection, and insights. Use this for quick data exploration.",
    input_schema: {
      type: "object" as const,
      properties: {
        data: {
          type: "string",
          description: "CSV text, JSON array string, or file path to analyze",
        },
        format: {
          type: "string",
          enum: ["csv", "json", "auto"],
          description: "Data format (default: auto-detect)",
        },
      },
      required: ["data"],
    },
  },
  // ── Content Creator Tool ─────────────────────────────────────────────
  {
    name: "create_content",
    description:
      "Generate multi-platform content from a single brief. Provide a topic and target platforms, and get tailored content for each (blog post, tweet, LinkedIn post, email newsletter, Instagram caption). Returns a structured content package.",
    input_schema: {
      type: "object" as const,
      properties: {
        topic: {
          type: "string",
          description: "The topic or brief to create content about",
        },
        platforms: {
          type: "array",
          description: "Target platforms: blog, twitter, linkedin, email, instagram",
          items: { type: "string", enum: ["blog", "twitter", "linkedin", "email", "instagram"] },
        },
        tone: {
          type: "string",
          enum: ["professional", "casual", "witty", "authoritative", "friendly"],
          description: "Content tone (default: professional)",
        },
        audience: {
          type: "string",
          description: "Target audience description (e.g., 'small business owners')",
        },
        keywords: {
          type: "array",
          description: "Keywords to include in the content",
          items: { type: "string" },
        },
        call_to_action: {
          type: "string",
          description: "Desired call to action (e.g., 'Sign up for free trial')",
        },
      },
      required: ["topic", "platforms"],
    },
  },
  // ── Competitor Tracker Tool ────────────────────────────────────────────
  {
    name: "track_competitor",
    description:
      "Track and monitor competitor websites. Add competitors to watch, check their sites for changes, compare content metrics, and get detailed reports. Useful for competitive intelligence and market awareness.",
    input_schema: {
      type: "object" as const,
      properties: {
        action: {
          type: "string",
          enum: ["add", "remove", "check", "report", "compare", "list"],
          description:
            "Action: 'add' registers a competitor, 'remove' stops tracking, 'check' fetches and detects changes, 'report' gets detailed analysis, 'compare' side-by-side comparison, 'list' shows all tracked",
        },
        name: {
          type: "string",
          description: "Competitor name (required for 'add', optional for 'check'/'report'/'remove')",
        },
        url: {
          type: "string",
          description: "Competitor's website URL (required for 'add')",
        },
        category: {
          type: "string",
          description: "Optional category (e.g., 'direct', 'indirect', 'aspirational')",
        },
        notes: {
          type: "string",
          description: "Optional notes about this competitor",
        },
      },
      required: ["action"],
    },
  },
  // ── Trading Researcher Tool ────────────────────────────────────────────
  {
    name: "research_market",
    description:
      "Research financial markets — stocks, crypto, currencies. Get asset details with price, technicals, and news. Compare multiple assets, get market overviews, or search for market news. Uses CoinGecko (crypto) and Yahoo Finance (stocks) — no API keys needed.",
    input_schema: {
      type: "object" as const,
      properties: {
        action: {
          type: "string",
          enum: ["research", "overview", "compare", "technicals", "news"],
          description:
            "Action: 'research' deep-dive on one asset, 'overview' market summary, 'compare' multiple assets, 'technicals' technical analysis, 'news' search market news",
        },
        symbol: {
          type: "string",
          description: "Asset symbol or name (e.g., 'AAPL', 'bitcoin', 'ETH'). Required for research/technicals",
        },
        symbols: {
          type: "array",
          description: "Multiple symbols for comparison (e.g., ['AAPL', 'GOOGL', 'MSFT'])",
          items: { type: "string" },
        },
        type: {
          type: "string",
          enum: ["crypto", "stock"],
          description: "Asset type (auto-detected if omitted)",
        },
        days: {
          type: "number",
          description: "Number of days for technical analysis (default: 30)",
        },
        query: {
          type: "string",
          description: "Search query for market news",
        },
      },
      required: ["action"],
    },
  },
  // ── SEO Optimizer Tool ─────────────────────────────────────────────────
  {
    name: "seo_analyze",
    description:
      "Analyze web pages for SEO issues and get optimization recommendations. Checks title tags, meta descriptions, heading hierarchy, content quality, keyword density, readability, and technical SEO factors. Returns a score out of 100 with actionable recommendations.",
    input_schema: {
      type: "object" as const,
      properties: {
        url: {
          type: "string",
          description: "URL to analyze for SEO (fetches and analyzes the page)",
        },
        content: {
          type: "string",
          description: "Raw text content to analyze for keyword optimization (alternative to URL)",
        },
        keywords: {
          type: "array",
          description: "Target keywords to check density and placement for",
          items: { type: "string" },
        },
        compare_urls: {
          type: "array",
          description: "Multiple URLs to compare SEO scores (analyzes each and ranks them)",
          items: { type: "string" },
        },
      },
      required: [],
    },
  },
  // ── Sales Agent Tool ───────────────────────────────────────────────────
  {
    name: "sales_pipeline",
    description:
      "CRM-lite sales pipeline. Track leads, update deal stages, monitor follow-ups, and view pipeline metrics. Stages: new → contacted → qualified → proposal → negotiation → won/lost.",
    input_schema: {
      type: "object" as const,
      properties: {
        action: {
          type: "string",
          enum: ["add", "update", "remove", "get", "list", "pipeline", "followups"],
          description: "Action to perform on the sales pipeline",
        },
        name: { type: "string", description: "Lead name" },
        email: { type: "string", description: "Lead email" },
        company: { type: "string", description: "Company name" },
        source: { type: "string", description: "Lead source (e.g., 'website', 'referral')" },
        value: { type: "number", description: "Deal value in dollars" },
        status: {
          type: "string",
          enum: ["new", "contacted", "qualified", "proposal", "negotiation", "won", "lost"],
          description: "Pipeline stage",
        },
        notes: { type: "string", description: "Note to add to the lead" },
        next_follow_up: { type: "string", description: "Next follow-up date (ISO 8601)" },
      },
      required: ["action"],
    },
  },
  // ── Social Listener Tool ───────────────────────────────────────────────
  {
    name: "social_listen",
    description:
      "Monitor brand mentions and sentiment across the web. Add brands to watch, scan for mentions, and get sentiment reports (positive/neutral/negative). Useful for reputation monitoring and competitive intelligence.",
    input_schema: {
      type: "object" as const,
      properties: {
        action: {
          type: "string",
          enum: ["add", "remove", "scan", "report", "list", "sentiment"],
          description: "Action: 'add' brand, 'scan' for mentions, 'report' sentiment analysis, 'sentiment' analyze text",
        },
        brand: { type: "string", description: "Brand or topic to monitor" },
        keywords: {
          type: "array",
          description: "Additional keywords to track for this brand",
          items: { type: "string" },
        },
        text: { type: "string", description: "Text to analyze sentiment for (with 'sentiment' action)" },
      },
      required: ["action"],
    },
  },
  // ── Legal Reviewer Tool ────────────────────────────────────────────────
  {
    name: "legal_review",
    description:
      "Analyze contracts and legal documents for risk. Detects risky clauses (indemnification, non-compete, auto-renewal, IP assignment), extracts parties, dates, and amounts. Returns a risk score with recommendations. NOT legal advice.",
    input_schema: {
      type: "object" as const,
      properties: {
        text: {
          type: "string",
          description: "The contract or legal document text to analyze",
        },
      },
      required: ["text"],
    },
  },
  // ── Inventory Manager Tool ─────────────────────────────────────────────
  {
    name: "inventory",
    description:
      "Track inventory items, quantities, and stock levels. Add items with SKU/category/reorder points, record stock changes, check low-stock alerts, and view transaction history.",
    input_schema: {
      type: "object" as const,
      properties: {
        action: {
          type: "string",
          enum: ["add", "update", "set", "remove", "get", "list", "history", "summary"],
          description: "Action to perform",
        },
        name: { type: "string", description: "Item name" },
        quantity: { type: "number", description: "Quantity (for add/set) or change amount (+/-) for update" },
        sku: { type: "string", description: "SKU/item code" },
        category: { type: "string", description: "Item category" },
        unit: { type: "string", description: "Unit of measure (default: units)" },
        reorder_point: { type: "number", description: "Reorder alert threshold" },
        cost: { type: "number", description: "Cost per unit" },
        price: { type: "number", description: "Selling price per unit" },
        reason: { type: "string", description: "Reason for stock change" },
        low_stock: { type: "boolean", description: "Filter to only low-stock items" },
      },
      required: ["action"],
    },
  },
  // ── Real Estate Analyst Tool ───────────────────────────────────────────
  {
    name: "real_estate",
    description:
      "Analyze investment properties. Computes cap rate, cash-on-cash return, ROI, monthly cash flow, and mortgage payments. Compare multiple properties. Great for evaluating rental properties.",
    input_schema: {
      type: "object" as const,
      properties: {
        action: {
          type: "string",
          enum: ["analyze", "compare", "mortgage"],
          description: "Action: 'analyze' a property, 'compare' multiple, 'mortgage' calculator",
        },
        address: { type: "string", description: "Property address" },
        purchase_price: { type: "number", description: "Purchase price" },
        monthly_rent: { type: "number", description: "Expected monthly rent" },
        down_payment: { type: "number", description: "Down payment amount (default: 20%)" },
        interest_rate: { type: "number", description: "Mortgage interest rate % (default: 7)" },
        loan_term: { type: "number", description: "Loan term in years (default: 30)" },
        property_tax: { type: "number", description: "Monthly property tax" },
        insurance: { type: "number", description: "Monthly insurance" },
        principal: { type: "number", description: "Loan principal (for mortgage calculator)" },
        properties: {
          type: "array",
          description: "Array of property objects for comparison",
        },
      },
      required: ["action"],
    },
  },
  // ── Uptime Monitor Tool ────────────────────────────────────────────────
  {
    name: "uptime_check",
    description:
      "Monitor website availability and response times. Check if URLs are up, track uptime percentages, and measure response speeds. Complements the web content monitor.",
    input_schema: {
      type: "object" as const,
      properties: {
        action: {
          type: "string",
          enum: ["check", "add", "remove", "list", "check_all", "report"],
          description: "Action: 'check' a URL, 'add' to monitor, 'check_all' monitored sites, 'report' uptime stats",
        },
        url: { type: "string", description: "URL to check or monitor" },
        label: { type: "string", description: "Friendly label for the site" },
      },
      required: ["action"],
    },
  },
  // ── DNS Lookup Tool ────────────────────────────────────────────────────
  {
    name: "dns_lookup",
    description:
      "Look up DNS records and domain info. Query A, MX, NS, TXT, CNAME records. Check email security (SPF, DKIM, DMARC), SSL status, and nameservers. Useful for domain troubleshooting.",
    input_schema: {
      type: "object" as const,
      properties: {
        domain: { type: "string", description: "Domain to look up (e.g., 'opensentinel.ai')" },
        action: {
          type: "string",
          enum: ["lookup", "info"],
          description: "Action: 'lookup' raw DNS records, 'info' comprehensive domain analysis",
        },
        record_types: {
          type: "array",
          description: "Specific record types to query (default: A, MX, NS, TXT, CNAME)",
          items: { type: "string" },
        },
      },
      required: ["domain"],
    },
  },
  // ── Customer Support Tool ──────────────────────────────────────────────
  {
    name: "customer_support",
    description:
      "Manage customer support tickets. Auto-triages incoming issues by priority and category, suggests responses, detects escalation needs, and tracks resolution metrics. Use for ticket creation, updates, and support queue management.",
    input_schema: {
      type: "object" as const,
      properties: {
        action: {
          type: "string",
          enum: ["create", "update", "get", "list", "summary", "suggest_response", "escalations"],
          description: "Action to perform",
        },
        customer: { type: "string", description: "Customer name" },
        email: { type: "string", description: "Customer email" },
        subject: { type: "string", description: "Ticket subject" },
        description: { type: "string", description: "Issue description" },
        ticket_id: { type: "string", description: "Ticket ID (for get/update)" },
        status: {
          type: "string",
          enum: ["new", "open", "in_progress", "waiting", "escalated", "resolved", "closed"],
          description: "Ticket status",
        },
        priority: { type: "string", enum: ["low", "medium", "high", "critical"], description: "Ticket priority" },
        category: { type: "string", description: "Ticket category" },
        assignee: { type: "string", description: "Assign to agent" },
        note: { type: "string", description: "Add a note to the ticket" },
      },
      required: ["action"],
    },
  },
  // ── Email Assistant Tool ───────────────────────────────────────────────
  {
    name: "email_assistant",
    description:
      "Intelligent email analysis and triage. Categorize emails by type (billing, meeting, urgent, etc.), extract action items, generate inbox digests, and draft replies. Complements check_email/send_email with smart processing.",
    input_schema: {
      type: "object" as const,
      properties: {
        action: {
          type: "string",
          enum: ["triage", "extract_actions", "digest", "draft_reply"],
          description: "Action: 'triage' categorize one email, 'extract_actions' find todos, 'digest' summarize multiple, 'draft_reply' generate reply",
        },
        from: { type: "string", description: "Sender address/name" },
        subject: { type: "string", description: "Email subject" },
        body: { type: "string", description: "Email body text" },
        date: { type: "string", description: "Email date (ISO)" },
        emails: {
          type: "array",
          description: "Array of email objects (for digest/extract_actions)",
        },
        style: {
          type: "string",
          enum: ["formal", "friendly", "brief"],
          description: "Reply style (default: friendly)",
        },
      },
      required: ["action"],
    },
  },
  // ── Meeting Assistant Tool ─────────────────────────────────────────────
  {
    name: "meeting_assistant",
    description:
      "Process meeting transcripts and notes. Extract action items with owners, decisions made, and generate summaries. Track meetings, manage action item status, and create weekly meeting digests.",
    input_schema: {
      type: "object" as const,
      properties: {
        action: {
          type: "string",
          enum: ["add", "get", "list", "actions", "pending", "weekly", "summarize", "extract_actions", "extract_decisions", "update_action"],
          description: "Action to perform",
        },
        title: { type: "string", description: "Meeting title" },
        transcript: { type: "string", description: "Meeting transcript or notes text" },
        notes: { type: "string", description: "Meeting notes" },
        attendees: { type: "array", description: "List of attendees", items: { type: "string" } },
        duration: { type: "number", description: "Meeting duration in minutes" },
        meeting_id: { type: "string", description: "Meeting ID (for get/update_action)" },
        action_index: { type: "number", description: "Action item index (for update_action)" },
        action_status: { type: "string", enum: ["pending", "in_progress", "done"], description: "New action status" },
        tags: { type: "array", description: "Meeting tags", items: { type: "string" } },
        text: { type: "string", description: "Text to analyze (for summarize/extract_actions/extract_decisions)" },
      },
      required: ["action"],
    },
  },
  // ── Docs Writer Tool ───────────────────────────────────────────────────
  {
    name: "docs_writer",
    description:
      "Auto-generate documentation. Create API references from endpoint definitions, changelogs from version entries, getting started guides, README sections, or TypeScript interface docs from source code. Returns formatted markdown.",
    input_schema: {
      type: "object" as const,
      properties: {
        action: {
          type: "string",
          enum: ["api_ref", "changelog", "guide", "readme", "interfaces"],
          description: "Type of documentation to generate",
        },
        project_name: { type: "string", description: "Project name" },
        endpoints: { type: "array", description: "API endpoints array (for api_ref)" },
        base_url: { type: "string", description: "API base URL" },
        auth_info: { type: "string", description: "Authentication documentation" },
        entries: { type: "array", description: "Changelog entries array (for changelog)" },
        sections: { type: "array", description: "Guide sections array (for guide)" },
        prerequisites: { type: "array", description: "Prerequisites list", items: { type: "string" } },
        install_command: { type: "string", description: "Installation command" },
        description: { type: "string", description: "Project description (for readme)" },
        features: { type: "array", description: "Feature list", items: { type: "string" } },
        usage: { type: "string", description: "Usage instructions" },
        license: { type: "string", description: "License info" },
        source_code: { type: "string", description: "TypeScript source code (for interfaces)" },
      },
      required: ["action"],
    },
  },
  // ── Onboarding Agent Tool ──────────────────────────────────────────────
  {
    name: "onboarding",
    description:
      "Create and manage onboarding plans for employees, customers, developers, or admins. Auto-generates step-by-step plans with progress tracking, FAQ answers, and customizable workflows.",
    input_schema: {
      type: "object" as const,
      properties: {
        action: {
          type: "string",
          enum: ["create", "complete_step", "skip_step", "add_step", "add_note", "get", "list", "summary", "faq"],
          description: "Action to perform",
        },
        name: { type: "string", description: "Person's name (for create)" },
        type: {
          type: "string",
          enum: ["employee", "customer", "developer", "admin", "custom"],
          description: "Onboarding type",
        },
        email: { type: "string", description: "Person's email" },
        role: { type: "string", description: "Person's role/title" },
        plan_id: { type: "string", description: "Plan ID (for step operations)" },
        step_id: { type: "number", description: "Step ID to complete/skip" },
        step_title: { type: "string", description: "New step title (for add_step)" },
        step_description: { type: "string", description: "New step description" },
        note: { type: "string", description: "Note to add" },
        reason: { type: "string", description: "Reason for skipping" },
        question: { type: "string", description: "FAQ question to answer" },
        active: { type: "boolean", description: "Filter for active/completed plans" },
        custom_steps: { type: "array", description: "Custom step definitions for 'custom' type" },
      },
      required: ["action"],
    },
  },
  // ── Recruiter Tool ─────────────────────────────────────────────────────
  {
    name: "recruiter",
    description:
      "Recruitment pipeline management. Add candidates, score them against job requirements, track through hiring stages, view pipeline metrics, and draft personalized outreach emails.",
    input_schema: {
      type: "object" as const,
      properties: {
        action: {
          type: "string",
          enum: ["add", "screen", "update", "get", "list", "remove", "pipeline", "outreach"],
          description: "Action to perform",
        },
        name: { type: "string", description: "Candidate name" },
        email: { type: "string", description: "Candidate email" },
        role: { type: "string", description: "Job role" },
        skills: { type: "array", description: "Candidate skills", items: { type: "string" } },
        experience: { type: "number", description: "Years of experience" },
        education: { type: "string", description: "Education level" },
        location: { type: "string", description: "Location" },
        source: { type: "string", description: "Sourcing channel (e.g., 'linkedin', 'referral')" },
        candidate_id: { type: "string", description: "Candidate ID (for update/get/remove)" },
        status: {
          type: "string",
          enum: ["new", "screening", "phone_screen", "interview", "technical", "final", "offer", "hired", "rejected", "withdrawn"],
          description: "Candidate status",
        },
        note: { type: "string", description: "Note to add" },
        required_skills: { type: "array", description: "Required skills for screening", items: { type: "string" } },
        preferred_skills: { type: "array", description: "Preferred skills", items: { type: "string" } },
        min_experience: { type: "number", description: "Minimum years of experience" },
        company_name: { type: "string", description: "Company name for outreach" },
        tone: { type: "string", enum: ["formal", "casual"], description: "Outreach tone" },
        min_score: { type: "number", description: "Minimum score filter" },
      },
      required: ["action"],
    },
  },

  // ===== OSINT Tools =====
  {
    name: "osint_search",
    description:
      "Search public records databases (FEC campaign finance, IRS 990 nonprofits, USAspending federal contracts, SEC EDGAR corporate filings, OpenCorporates). Returns matching entities with source attribution and auto-resolves them into the knowledge graph.",
    input_schema: {
      type: "object" as const,
      properties: {
        query: { type: "string", description: "Search query (person name, organization name, etc.)" },
        sources: {
          type: "array",
          items: { type: "string", enum: ["fec", "irs990", "usaspending", "sec", "opencorporates"] },
          description: "Which sources to search (default: all)",
        },
        entity_type: {
          type: "string",
          enum: ["person", "organization", "committee"],
          description: "Filter by entity type",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "osint_graph",
    description:
      "Query the OSINT knowledge graph. Search for entities, explore neighborhoods, find shortest paths between entities, detect communities, find duplicates, merge entities, or run custom Cypher queries.",
    input_schema: {
      type: "object" as const,
      properties: {
        action: {
          type: "string",
          enum: ["search", "neighbors", "path", "communities", "cypher", "duplicates", "merge"],
          description: "Graph operation to perform",
        },
        entity_id: { type: "string", description: "Entity ID (for neighbors, path start, merge primary)" },
        entity_name: { type: "string", description: "Entity name (for search)" },
        target_id: { type: "string", description: "Target entity ID (for path, merge duplicate)" },
        depth: { type: "number", description: "Traversal depth (default: 2)" },
        cypher: { type: "string", description: "Custom read-only Cypher query" },
        threshold: { type: "number", description: "Fuzzy match threshold for duplicates (default: 0.85)" },
      },
      required: ["action"],
    },
  },
  {
    name: "osint_enrich",
    description:
      "Auto-enrich an entity by querying all public records APIs for additional data. Creates new related entities and relationships in the knowledge graph. Use after discovering a new entity to build out its connections.",
    input_schema: {
      type: "object" as const,
      properties: {
        entity_id: { type: "string", description: "Entity ID to enrich" },
        entity_name: { type: "string", description: "Entity name (if no ID, will resolve first)" },
        sources: {
          type: "array",
          items: { type: "string", enum: ["fec", "irs990", "usaspending", "sec", "opencorporates"] },
          description: "Which sources to query (default: all relevant)",
        },
        depth: { type: "number", description: "Enrichment depth — how many hops of related entities to also enrich (default: 1)" },
      },
    },
  },
  {
    name: "osint_analyze",
    description:
      "Analyze the OSINT knowledge graph: trace financial flows (donations, contracts, grants), perform network analysis (centrality, key connectors), build timelines, or generate structured intelligence reports.",
    input_schema: {
      type: "object" as const,
      properties: {
        action: {
          type: "string",
          enum: ["financial_flow", "network_analysis", "timeline", "report"],
          description: "Analysis type",
        },
        entity_id: { type: "string", description: "Entity ID to analyze" },
        options: {
          type: "object",
          description: "Analysis options (e.g., { depth: 3, min_amount: 1000 })",
        },
      },
      required: ["action"],
    },
  },
];

// MCP registry reference (set by brain.ts after initialization)
let mcpRegistry: MCPRegistry | null = null;

export function setMCPRegistry(registry: MCPRegistry | null): void {
  mcpRegistry = registry;
}

export function getMCPRegistry(): MCPRegistry | null {
  return mcpRegistry;
}

// Execute a tool by name
export async function executeTool(
  name: string,
  input: Record<string, unknown>
): Promise<{ success: boolean; result: unknown; error?: string }> {
  try {
    // Check if this is an MCP tool
    if (isMCPTool(name) && mcpRegistry) {
      const result = await executeMCPTool(mcpRegistry, name, input);
      return {
        success: result.success,
        result: result.output || result.error,
        error: result.error,
      };
    }

    switch (name) {
      case "execute_command": {
        const result = await executeCommand(
          input.command as string,
          input.working_directory as string | undefined
        );
        return {
          success: result.success,
          result: {
            stdout: result.stdout,
            stderr: result.stderr,
            exitCode: result.exitCode,
          },
          error: result.success ? undefined : result.stderr,
        };
      }

      case "list_directory": {
        const files = await listDirectory(input.path as string);
        return { success: true, result: files };
      }

      case "read_file": {
        const content = await readFileContent(input.path as string);
        return { success: true, result: content };
      }

      case "write_file": {
        await writeFileContent(input.path as string, input.content as string);
        return { success: true, result: "File written successfully" };
      }

      case "search_files": {
        const files = await searchFiles(
          input.pattern as string,
          input.base_path as string | undefined
        );
        return { success: true, result: files };
      }

      case "web_search": {
        const results = await webSearch(input.query as string);
        return { success: true, result: results };
      }

      case "browse_url": {
        const page = await navigateTo(input.url as string);
        return { success: true, result: page };
      }

      case "take_screenshot": {
        const screenshot = await browserScreenshot();
        return {
          success: true,
          result: { screenshot: `data:image/png;base64,${screenshot}` },
        };
      }

      case "analyze_image": {
        const result = await analyzeImage({
          imageUrl: input.image_url as string | undefined,
          imagePath: input.image_path as string | undefined,
          prompt: input.prompt as string,
        });
        return {
          success: result.success,
          result: result.analysis,
          error: result.error,
        };
      }

      case "ocr_document": {
        const result = await performOCR(
          input.file_path as string,
          { language: input.language as string | undefined }
        );
        return {
          success: result.success,
          result: result.text,
          error: result.error,
        };
      }

      case "extract_document_data": {
        const result = await extractStructuredData(
          input.file_path as string,
          input.data_type as "table" | "form" | "receipt" | "invoice" | undefined
        );
        return {
          success: result.success,
          result: result.data,
          error: result.error,
        };
      }

      case "screenshot_analyze": {
        let region: "full" | "active_window" | { x: number; y: number; width: number; height: number } = "full";

        if (input.region === "active_window") {
          region = "active_window";
        } else if (typeof input.region === "string" && input.region.includes(",")) {
          const [x, y, width, height] = input.region.split(",").map(Number);
          region = { x, y, width, height };
        }

        const result = await screenshotAndAnalyze(
          input.prompt as string,
          { region }
        );
        return {
          success: result.success,
          result: result.analysis,
          error: result.error,
        };
      }

      case "generate_pdf": {
        const result = await generatePDF(
          input.content as string,
          input.filename as string,
          {
            contentType: input.content_type as "markdown" | "html" | undefined,
            title: input.title as string | undefined,
          }
        );
        return {
          success: result.success,
          result: result.filePath,
          error: result.error,
        };
      }

      case "generate_spreadsheet": {
        const result = await generateSpreadsheet(
          input.data as unknown[][],
          input.filename as string,
          {
            headers: input.headers as string[] | undefined,
            sheetName: input.sheet_name as string | undefined,
          }
        );
        return {
          success: result.success,
          result: result.filePath,
          error: result.error,
        };
      }

      case "generate_chart": {
        const { quickChart } = await import("./file-generation/charts");
        const result = await quickChart(
          input.type as "bar" | "line" | "pie" | "doughnut" | "scatter" | "area",
          input.labels as string[],
          input.values as number[],
          input.title as string | undefined,
          input.filename as string | undefined
        );
        return {
          success: result.success,
          result: result.filePath,
          error: result.error,
        };
      }

      case "generate_diagram": {
        if (input.mermaid_code) {
          const result = await generateDiagram(
            input.mermaid_code as string,
            input.filename as string | undefined
          );
          return {
            success: result.success,
            result: result.filePath,
            error: result.error,
          };
        } else if (input.data) {
          const result = await generateStructuredDiagram(
            input.type as "flowchart" | "sequence" | "class" | "state" | "er" | "gantt" | "mindmap",
            input.data,
            input.filename as string | undefined
          );
          return {
            success: result.success,
            result: result.filePath,
            error: result.error,
          };
        }
        return { success: false, result: null, error: "Must provide mermaid_code or data" };
      }

      case "spawn_agent": {
        const agentId = await spawnAgent({
          userId: "system", // Would come from context in real usage
          type: input.type as "research" | "coding" | "writing" | "analysis",
          objective: input.objective as string,
          context: input.context as Record<string, unknown> | undefined,
          tokenBudget: input.token_budget as number | undefined,
        });
        return {
          success: true,
          result: { agentId, message: "Agent spawned successfully" },
        };
      }

      case "check_agent": {
        const agent = await getAgent(input.agent_id as string);
        if (!agent) {
          return { success: false, result: null, error: "Agent not found" };
        }
        return {
          success: true,
          result: {
            id: agent.id,
            type: agent.type,
            status: agent.status,
            objective: agent.objective,
            tokensUsed: agent.tokensUsed,
            progress: agent.progress.slice(-5),
            result: agent.result,
          },
        };
      }

      case "cancel_agent": {
        const cancelled = await cancelAgent(input.agent_id as string);
        return {
          success: cancelled,
          result: cancelled ? "Agent cancelled" : "Could not cancel agent",
        };
      }

      case "render_math": {
        const result = await renderMath(
          input.latex as string,
          input.filename as string | undefined,
          {
            displayMode: input.display_mode as boolean | undefined,
            fontSize: input.font_size as number | undefined,
            color: input.color as string | undefined,
          }
        );
        return {
          success: result.success,
          result: {
            svg: result.svg,
            html: result.html,
            filePath: result.filePath,
          },
          error: result.error,
        };
      }

      case "render_math_document": {
        const result = await renderMathDocument(
          input.expressions as Array<{ latex: string; label?: string }>,
          input.filename as string | undefined
        );
        return {
          success: result.success,
          result: {
            html: result.html,
            filePath: result.filePath,
          },
          error: result.error,
        };
      }

      case "render_code": {
        const result = await renderCode(
          input.code as string,
          input.filename as string | undefined,
          {
            language: input.language as string | undefined,
            theme: input.theme as "light" | "dark" | "github" | "monokai" | undefined,
            lineNumbers: input.line_numbers as boolean | undefined,
            highlightLines: input.highlight_lines as number[] | undefined,
            title: input.title as string | undefined,
          }
        );
        return {
          success: result.success,
          result: {
            html: result.html,
            filePath: result.filePath,
          },
          error: result.error,
        };
      }

      case "render_markdown": {
        const result = await renderMarkdown(
          input.markdown as string,
          input.filename as string | undefined,
          {
            theme: input.theme as "light" | "dark" | "github" | undefined,
            syntaxHighlight: input.syntax_highlight as boolean | undefined,
            tableOfContents: input.table_of_contents as boolean | undefined,
          }
        );
        return {
          success: result.success,
          result: {
            html: result.html,
            filePath: result.filePath,
          },
          error: result.error,
        };
      }

      case "summarize_video": {
        const result = await summarizeVideo(
          input.video_path as string,
          {
            frameCount: input.frame_count as number | undefined,
            includeTranscript: input.include_transcript as boolean | undefined,
            analysisDepth: input.analysis_depth as "quick" | "standard" | "detailed" | undefined,
            language: input.language as string | undefined,
            focusAreas: input.focus_areas as string[] | undefined,
          }
        );
        return {
          success: result.success,
          result: result.summary,
          error: result.error,
        };
      }

      case "video_info": {
        const result = await getVideoInfo(input.video_path as string);
        return {
          success: result.success,
          result: result.info,
          error: result.error,
        };
      }

      case "extract_video_moments": {
        const result = await extractKeyMoments(
          input.video_path as string,
          input.frame_count as number | undefined
        );
        return {
          success: result.success,
          result: result.moments,
          error: result.error,
        };
      }

      case "apply_patch": {
        const result = await applyPatch(
          input.file_path as string,
          input.patch as string,
          input.create_backup as boolean | undefined
        );
        return {
          success: result.applied,
          result: {
            linesChanged: result.linesChanged,
            backup: result.backup,
          },
          error: result.error,
        };
      }

      case "create_poll": {
        const poll = pollManager.createPoll({
          question: input.question as string,
          options: input.options as string[],
          multiSelect: input.multi_select as boolean | undefined,
          duration: input.duration as number | undefined,
          channelType: "system",
          channelId: "system",
          createdBy: "assistant",
        });
        return {
          success: true,
          result: {
            pollId: poll.id,
            question: poll.question,
            options: poll.options.map((o) => o.text),
            message: pollManager.formatPollMessage(poll.id),
          },
        };
      }

      case "teach_skill": {
        const result = await skillExecutor.teachSkill({
          name: input.name as string,
          description: input.description as string,
          instructions: input.instructions as string,
          tools: input.tools as string[] | undefined,
          userId: "system",
        });
        return {
          success: result.success,
          result: {
            skillId: result.skillId,
            skillName: result.skillName,
            message: result.output,
          },
          error: result.error,
        };
      }

      case "run_skill": {
        const result = await skillExecutor.execute(
          input.skill as string,
          input.input as string ?? "",
          "system"
        );
        return {
          success: result.success,
          result: {
            skillId: result.skillId,
            skillName: result.skillName,
            systemPrompt: result.output,
          },
          error: result.error,
        };
      }

      case "hub_browse": {
        await sentinelHub.initialize();
        const results = sentinelHub.browseHub({
          category: input.category as any,
          search: input.search as string | undefined,
        });
        return {
          success: true,
          result: {
            items: results.items.map((i) => ({
              id: i.id,
              name: i.name,
              description: i.description,
              category: i.category,
              author: i.author,
              rating: i.rating,
              downloads: i.downloads,
              tags: i.tags,
            })),
            total: results.total,
          },
        };
      }

      case "hub_install": {
        await sentinelHub.initialize();
        const result = await sentinelHub.installFromHub(
          input.item_id as string,
          "system"
        );
        return {
          success: result.success,
          result: {
            message: result.message,
            skillId: result.skillId,
          },
        };
      }

      case "hub_publish": {
        await sentinelHub.initialize();
        const result = await sentinelHub.publishToHub({
          name: input.name as string,
          description: input.description as string,
          category: input.category as any,
          data: input.data as string,
          author: "user",
          tags: input.tags as string[] | undefined,
        });
        return {
          success: result.success,
          result: {
            itemId: result.itemId,
            message: result.message,
          },
        };
      }

      case "check_email": {
        const emailAddress = input.email_address as string;
        const folder = (input.folder as string) || "INBOX";
        const unreadOnly = (input.unread_only as boolean) || false;
        const limit = (input.limit as number) || 20;

        const imap = createLocalImapClient(emailAddress);
        try {
          await imap.connect();

          let emails: EmailMessage[];
          if (unreadOnly) {
            emails = await imap.searchEmails({ folder, seen: false, limit } as any);
          } else {
            emails = await imap.fetchEmails(folder, { limit });
          }

          const unreadCount = await imap.getUnreadCount(folder);
          const totalCount = await imap.getTotalCount(folder);
          const formatted = formatEmailList(emails);

          return {
            success: true,
            result: {
              account: emailAddress,
              folder,
              totalEmails: totalCount,
              unreadCount,
              showing: emails.length,
              summary: formatted,
              emails: emails.map((e) => ({
                uid: e.uid,
                messageId: e.messageId,
                from: e.from.map((a) => (a.name ? `${a.name} <${a.address}>` : a.address)).join(", "),
                to: e.to.map((a) => a.address).join(", "),
                subject: e.subject,
                date: e.date.toISOString(),
                snippet: e.snippet,
                unread: !e.flags.includes("\\Seen"),
                attachments: e.attachments.length,
              })),
            },
          };
        } finally {
          await imap.disconnect();
        }
      }

      case "send_email": {
        const from = input.from as string;
        const to = input.to as string;
        const subject = input.subject as string;
        const body = input.body as string;
        const html = input.html as string | undefined;
        const cc = input.cc as string | undefined;
        const bcc = input.bcc as string | undefined;

        const smtp = createLocalSmtpClient(from);
        try {
          const result = await smtp.send({
            from,
            to: to.split(",").map((addr) => addr.trim()),
            subject,
            text: body,
            html: html || undefined,
            cc: cc ? cc.split(",").map((addr) => addr.trim()) : undefined,
            bcc: bcc ? bcc.split(",").map((addr) => addr.trim()) : undefined,
          });

          if (!result.success) {
            return { success: false, result: null, error: result.error || "Failed to send email" };
          }

          return {
            success: true,
            result: {
              message: `Email sent successfully from ${from} to ${to}`,
              messageId: result.messageId,
              accepted: result.accepted,
              rejected: result.rejected,
            },
          };
        } finally {
          await smtp.close();
        }
      }

      case "search_email": {
        const emailAddress = input.email_address as string;
        const folder = (input.folder as string) || "INBOX";
        const limit = (input.limit as number) || 20;

        const imap = createLocalImapClient(emailAddress);
        try {
          await imap.connect();

          const searchOptions: Record<string, unknown> = { folder, limit };
          if (input.from) searchOptions.from = input.from as string;
          if (input.subject) searchOptions.subject = input.subject as string;
          if (input.since) searchOptions.since = new Date(input.since as string);
          if (input.before) searchOptions.before = new Date(input.before as string);
          if (input.unread_only) searchOptions.seen = false;

          const emails = await imap.searchEmails(searchOptions as any);
          const formatted = formatEmailList(emails);

          return {
            success: true,
            result: {
              account: emailAddress,
              folder,
              matchCount: emails.length,
              summary: formatted,
              emails: emails.map((e) => ({
                uid: e.uid,
                messageId: e.messageId,
                from: e.from.map((a) => (a.name ? `${a.name} <${a.address}>` : a.address)).join(", "),
                to: e.to.map((a) => a.address).join(", "),
                subject: e.subject,
                date: e.date.toISOString(),
                snippet: e.snippet,
                unread: !e.flags.includes("\\Seen"),
              })),
            },
          };
        } finally {
          await imap.disconnect();
        }
      }

      case "reply_email": {
        const emailAddress = input.email_address as string;
        const emailUid = input.email_uid as number;
        const body = input.body as string;
        const html = input.html as string | undefined;
        const replyAll = (input.reply_all as boolean) || false;
        const folder = (input.folder as string) || "INBOX";

        // Fetch the original email via IMAP
        const imap = createLocalImapClient(emailAddress);
        let originalEmail: EmailMessage | null = null;
        try {
          await imap.connect();
          originalEmail = await imap.fetchEmail(emailUid, folder);
        } finally {
          await imap.disconnect();
        }

        if (!originalEmail) {
          return { success: false, result: null, error: `Email with UID ${emailUid} not found in ${folder}` };
        }

        // Send the reply via SMTP
        const smtp = createLocalSmtpClient(emailAddress);
        try {
          let result;
          if (replyAll) {
            result = await smtp.replyAll(
              {
                from: originalEmail.from,
                to: originalEmail.to,
                cc: originalEmail.cc,
                messageId: originalEmail.messageId,
                subject: originalEmail.subject,
                references: originalEmail.references,
              },
              { from: emailAddress, text: body, html: html || undefined },
              emailAddress
            );
          } else {
            result = await smtp.reply(
              {
                from: originalEmail.from,
                messageId: originalEmail.messageId,
                subject: originalEmail.subject,
                references: originalEmail.references,
              },
              { from: emailAddress, text: body, html: html || undefined }
            );
          }

          if (!result.success) {
            return { success: false, result: null, error: result.error || "Failed to send reply" };
          }

          return {
            success: true,
            result: {
              message: `Reply sent from ${emailAddress} to ${originalEmail.from.map((a) => a.address).join(", ")}`,
              messageId: result.messageId,
              inReplyTo: originalEmail.messageId,
              subject: originalEmail.subject.toLowerCase().startsWith("re:")
                ? originalEmail.subject
                : `Re: ${originalEmail.subject}`,
            },
          };
        } finally {
          await smtp.close();
        }
      }

      // ── Web Monitor ────────────────────────────────────────────────────
      case "monitor_url": {
        const url = input.url as string;
        const action = (input.action as string) || "check";
        const label = input.label as string | undefined;

        switch (action) {
          case "list": {
            const monitors = listMonitors();
            return {
              success: true,
              result: {
                count: monitors.length,
                monitors: monitors.map((m) => ({
                  id: m.id,
                  url: m.url,
                  label: m.label,
                  lastChecked: m.lastChecked.toISOString(),
                  checkCount: m.checkCount,
                  changeCount: m.changeCount,
                })),
              },
            };
          }
          case "add": {
            const monitor = addMonitor(url, label);
            return {
              success: true,
              result: {
                message: `Now monitoring ${url}`,
                id: monitor.id,
                label: monitor.label,
              },
            };
          }
          case "remove": {
            const removed = removeMonitor(url);
            return {
              success: removed,
              result: removed
                ? `Stopped monitoring ${url}`
                : `URL not found in monitors: ${url}`,
            };
          }
          case "check":
          default: {
            // Fetch the page content using browse_url
            const page = await navigateTo(url);
            const content = typeof page === "string" ? page : (page as any)?.content || (page as any)?.text || JSON.stringify(page);

            const result = checkForChanges(url, content);
            return {
              success: true,
              result: {
                url: result.url,
                changed: result.changed,
                summary: result.summary,
                currentHash: result.currentHash.slice(0, 16),
                previousHash: result.previousHash?.slice(0, 16),
                addedLines: result.addedLines.slice(0, 20),
                removedLines: result.removedLines.slice(0, 20),
                addedCount: result.addedLines.length,
                removedCount: result.removedLines.length,
                checkedAt: result.checkedAt.toISOString(),
              },
            };
          }
        }
      }

      // ── DevOps / Server Health ────────────────────────────────────────
      case "check_server": {
        // Detailed service check
        if (input.service_detail) {
          const detail = await checkService(input.service_detail as string);
          return { success: true, result: detail };
        }

        // Log fetch
        if (input.logs) {
          const logOpts = input.logs as { service?: string; lines?: number; priority?: "err" | "warning" | "info" };
          const logs = await getRecentLogs(logOpts.service, logOpts.lines, logOpts.priority);
          return {
            success: true,
            result: {
              service: logOpts.service || "system",
              lineCount: logs.length,
              logs,
            },
          };
        }

        // Full health check
        const health = await checkServerHealth(input.services as string[] | undefined);
        return { success: true, result: health };
      }

      // ── Code Review ──────────────────────────────────────────────────
      case "review_pull_request": {
        const repo = input.repo as string;
        const prNumber = input.pr_number as number;
        const action = (input.action as string) || "review";

        switch (action) {
          case "summarize": {
            const summary = await summarizeChanges(repo, prNumber);
            return { success: true, result: summary };
          }
          case "security_scan": {
            const scan = await securityScan(repo, prNumber);
            return { success: true, result: scan };
          }
          case "review":
          default: {
            const review = await reviewPullRequest(repo, prNumber, {
              focusAreas: input.focus_areas as any[] | undefined,
              autoSubmit: (input.auto_submit as boolean) || false,
              maxFiles: (input.max_files as number) || 20,
            });
            return { success: true, result: review };
          }
        }
      }

      // ── Security Monitor ────────────────────────────────────────────
      case "security_scan": {
        const hours = (input.hours as number) || 24;
        const scanResult = await runSecurityScan({ hours });
        return { success: true, result: scanResult };
      }

      // ── Data Analyst ──────────────────────────────────────────────────
      case "analyze_data": {
        const rawData = input.data as string;
        const format = (input.format as string) || "auto";

        let parsed: Record<string, unknown>[];

        // Try to detect format
        const trimmed = rawData.trim();

        if (format === "json" || (format === "auto" && (trimmed.startsWith("[") || trimmed.startsWith("{")))) {
          // JSON
          try {
            const jsonData = JSON.parse(trimmed);
            parsed = Array.isArray(jsonData) ? jsonData : [jsonData];
          } catch {
            return { success: false, result: null, error: "Invalid JSON data" };
          }
        } else if (format === "csv" || (format === "auto" && trimmed.includes(","))) {
          // CSV
          parsed = parseCSV(trimmed);
        } else {
          // Try as file path
          try {
            const content = await readFileContent(rawData);
            if (typeof content === "string") {
              if (content.trim().startsWith("[") || content.trim().startsWith("{")) {
                parsed = JSON.parse(content.trim());
                if (!Array.isArray(parsed)) parsed = [parsed];
              } else {
                parsed = parseCSV(content);
              }
            } else {
              return { success: false, result: null, error: "Could not read file" };
            }
          } catch {
            return { success: false, result: null, error: "Could not parse data. Provide CSV text, JSON array, or a valid file path." };
          }
        }

        if (parsed.length === 0) {
          return { success: false, result: null, error: "No data rows found" };
        }

        const profile = profileData(parsed);
        return { success: true, result: profile };
      }

      // ── Content Creator ───────────────────────────────────────────────
      case "create_content": {
        const topic = input.topic as string;
        const platforms = (input.platforms as Platform[]) || ["blog", "twitter", "linkedin"];
        const tone = input.tone as ContentBrief["tone"] | undefined;
        const audience = input.audience as string | undefined;
        const keywords = input.keywords as string[] | undefined;
        const callToAction = input.call_to_action as string | undefined;

        const brief: ContentBrief = { topic, platforms, tone, audience, keywords, callToAction };

        // Build the prompt for the AI — this tool returns the prompt
        // for the brain to process, along with brief metadata
        const prompt = buildContentPrompt(brief);

        return {
          success: true,
          result: {
            type: "content_generation_prompt",
            prompt,
            brief: {
              topic,
              platforms,
              tone: tone || "professional",
              audience: audience || "general audience",
              keywords,
              callToAction,
            },
            instructions: "Use this prompt to generate the content. The AI brain should process this prompt and return the multi-platform content package.",
          },
        };
      }

      // ── Competitor Tracker ────────────────────────────────────────────
      case "track_competitor": {
        const action = input.action as string;
        switch (action) {
          case "add": {
            if (!input.name || !input.url) {
              return { success: false, result: null, error: "Both 'name' and 'url' are required for add" };
            }
            const comp = addCompetitor(input.name as string, input.url as string, {
              category: input.category as string | undefined,
              notes: input.notes as string | undefined,
            });
            return {
              success: true,
              result: {
                message: `Now tracking competitor: ${comp.name}`,
                id: comp.id,
                name: comp.name,
                url: comp.url,
              },
            };
          }
          case "remove": {
            const identifier = (input.name || input.url) as string;
            if (!identifier) return { success: false, result: null, error: "Provide 'name' or 'url' to remove" };
            const removed = removeCompetitor(identifier);
            return {
              success: removed,
              result: removed ? `Stopped tracking: ${identifier}` : `Competitor not found: ${identifier}`,
            };
          }
          case "check": {
            const identifier = (input.name || input.url) as string;
            if (!identifier) return { success: false, result: null, error: "Provide 'name' or 'url' to check" };
            const snapshot = await trackCompetitor(identifier);
            return { success: true, result: snapshot };
          }
          case "report": {
            const identifier = (input.name || input.url) as string;
            if (!identifier) return { success: false, result: null, error: "Provide 'name' or 'url' for report" };
            const report = getCompetitorReport(identifier);
            return { success: true, result: report };
          }
          case "compare": {
            const comparison = compareCompetitors();
            return { success: true, result: comparison };
          }
          case "list":
          default: {
            const comps = listCompetitors();
            return {
              success: true,
              result: {
                count: comps.length,
                competitors: comps.map((c) => ({
                  id: c.id,
                  name: c.name,
                  url: c.url,
                  category: c.category,
                  lastChecked: c.lastChecked?.toISOString() ?? "never",
                  snapshots: c.snapshots.length,
                })),
              },
            };
          }
        }
      }

      // ── Trading Researcher ─────────────────────────────────────────────
      case "research_market": {
        const action = input.action as string;
        switch (action) {
          case "research": {
            if (!input.symbol) return { success: false, result: null, error: "'symbol' is required for research" };
            const research = await researchAsset(
              input.symbol as string,
              input.type as "crypto" | "stock" | undefined
            );
            return { success: true, result: research };
          }
          case "overview": {
            const overview = await getMarketOverview();
            return { success: true, result: overview };
          }
          case "compare": {
            const symbols = (input.symbols || [input.symbol]) as string[];
            if (symbols.length === 0) return { success: false, result: null, error: "Provide 'symbols' array for comparison" };
            const comparison = await compareAssets(symbols);
            return { success: true, result: comparison };
          }
          case "technicals": {
            if (!input.symbol) return { success: false, result: null, error: "'symbol' is required for technicals" };
            const tech = await getTechnicalSummary(
              input.symbol as string,
              input.type as "crypto" | "stock" | undefined,
              (input.days as number) || 30
            );
            return { success: true, result: tech };
          }
          case "news": {
            const query = (input.query || input.symbol || "market") as string;
            const news = await getMarketNews(query);
            return { success: true, result: { query, articles: news, count: news.length } };
          }
          default:
            return { success: false, result: null, error: `Unknown research action: ${action}` };
        }
      }

      // ── SEO Optimizer ──────────────────────────────────────────────────
      case "seo_analyze": {
        // Compare multiple URLs
        if (input.compare_urls && (input.compare_urls as string[]).length > 0) {
          const urls = input.compare_urls as string[];
          const analyses: SEOAnalysis[] = [];
          for (const url of urls.slice(0, 5)) {
            const page = await navigateTo(url);
            const html = typeof page === "string" ? page : (page as any)?.content || "";
            analyses.push(analyzeSEO(url, html, input.keywords as string[] | undefined));
          }
          const comparison = comparePageSEO(analyses);
          return { success: true, result: { comparison, analyses } };
        }

        // Analyze content text (no URL)
        if (input.content && !input.url) {
          const result = analyzeContentForSEO(
            input.content as string,
            input.keywords as string[] | undefined
          );
          return { success: true, result };
        }

        // Analyze a single URL
        if (input.url) {
          const page = await navigateTo(input.url as string);
          const html = typeof page === "string" ? page : (page as any)?.content || "";
          const analysis = analyzeSEO(
            input.url as string,
            html,
            input.keywords as string[] | undefined
          );
          return { success: true, result: analysis };
        }

        return { success: false, result: null, error: "Provide 'url', 'content', or 'compare_urls'" };
      }

      // ── Sales Pipeline ─────────────────────────────────────────────────
      case "sales_pipeline": {
        const action = input.action as string;
        switch (action) {
          case "add": {
            if (!input.name) return { success: false, result: null, error: "'name' is required" };
            const lead = addLead(input.name as string, {
              email: input.email as string | undefined,
              company: input.company as string | undefined,
              source: input.source as string | undefined,
              value: input.value as number | undefined,
              notes: input.notes as string | undefined,
            });
            return { success: true, result: { message: `Lead added: ${lead.name}`, lead } };
          }
          case "update": {
            if (!input.name) return { success: false, result: null, error: "'name' is required" };
            const updated = updateLead(input.name as string, {
              status: input.status as any,
              value: input.value as number | undefined,
              notes: input.notes as string | undefined,
              email: input.email as string | undefined,
              nextFollowUp: input.next_follow_up as string | undefined,
            });
            return { success: true, result: updated };
          }
          case "remove": {
            if (!input.name) return { success: false, result: null, error: "'name' is required" };
            const removed = removeLead(input.name as string);
            return { success: removed, result: removed ? `Removed: ${input.name}` : `Not found: ${input.name}` };
          }
          case "get": {
            if (!input.name) return { success: false, result: null, error: "'name' is required" };
            const lead = getLead(input.name as string);
            return lead ? { success: true, result: lead } : { success: false, result: null, error: `Not found: ${input.name}` };
          }
          case "list": {
            const leads = listLeads({ status: input.status as any, company: input.company as string | undefined });
            return { success: true, result: { count: leads.length, leads } };
          }
          case "pipeline": {
            return { success: true, result: getPipelineSummary() };
          }
          case "followups": {
            const followups = getFollowUps();
            return { success: true, result: { count: followups.length, leads: followups } };
          }
          default:
            return { success: false, result: null, error: `Unknown action: ${action}` };
        }
      }

      // ── Social Listener ────────────────────────────────────────────────
      case "social_listen": {
        const action = input.action as string;
        switch (action) {
          case "add": {
            if (!input.brand) return { success: false, result: null, error: "'brand' is required" };
            const mon = addBrandMonitor(input.brand as string, input.keywords as string[] | undefined);
            return { success: true, result: { message: `Monitoring: ${mon.brand}`, id: mon.id } };
          }
          case "remove": {
            if (!input.brand) return { success: false, result: null, error: "'brand' is required" };
            const removed = removeBrandMonitor(input.brand as string);
            return { success: removed, result: removed ? `Stopped monitoring: ${input.brand}` : `Not found: ${input.brand}` };
          }
          case "scan": {
            if (!input.brand) return { success: false, result: null, error: "'brand' is required" };
            const mentions = await scanMentions(input.brand as string);
            return { success: true, result: { count: mentions.length, mentions } };
          }
          case "report": {
            if (!input.brand) return { success: false, result: null, error: "'brand' is required" };
            const report = getSentimentReport(input.brand as string);
            return { success: true, result: report };
          }
          case "list": {
            const monitors = listBrandMonitors();
            return { success: true, result: { count: monitors.length, monitors: monitors.map((m) => ({ id: m.id, brand: m.brand, keywords: m.keywords, mentions: m.mentions.length })) } };
          }
          case "sentiment": {
            if (!input.text) return { success: false, result: null, error: "'text' is required" };
            const sentiment = analyzeSentiment(input.text as string);
            return { success: true, result: { text: (input.text as string).slice(0, 200), sentiment } };
          }
          default:
            return { success: false, result: null, error: `Unknown action: ${action}` };
        }
      }

      // ── Legal Reviewer ─────────────────────────────────────────────────
      case "legal_review": {
        const text = input.text as string;
        if (!text) return { success: false, result: null, error: "'text' is required" };
        const analysis = reviewDocument(text);
        return { success: true, result: analysis };
      }

      // ── Inventory Manager ──────────────────────────────────────────────
      case "inventory": {
        const action = input.action as string;
        switch (action) {
          case "add": {
            if (!input.name || input.quantity === undefined) return { success: false, result: null, error: "'name' and 'quantity' required" };
            const item = addInventoryItem(input.name as string, input.quantity as number, {
              sku: input.sku as string | undefined,
              category: input.category as string | undefined,
              unit: input.unit as string | undefined,
              reorderPoint: input.reorder_point as number | undefined,
              cost: input.cost as number | undefined,
              price: input.price as number | undefined,
            });
            return { success: true, result: { message: `Added: ${item.name} (${item.quantity} ${item.unit})`, item } };
          }
          case "update": {
            if (!input.name || input.quantity === undefined) return { success: false, result: null, error: "'name' and 'quantity' required" };
            const item = updateQuantity(input.name as string, input.quantity as number, input.reason as string | undefined);
            return { success: true, result: item };
          }
          case "set": {
            if (!input.name || input.quantity === undefined) return { success: false, result: null, error: "'name' and 'quantity' required" };
            const { setQuantity } = await import("./inventory-manager");
            const item = setQuantity(input.name as string, input.quantity as number, input.reason as string | undefined);
            return { success: true, result: item };
          }
          case "remove": {
            if (!input.name) return { success: false, result: null, error: "'name' required" };
            const removed = removeInventoryItem(input.name as string);
            return { success: removed, result: removed ? `Removed: ${input.name}` : `Not found: ${input.name}` };
          }
          case "get": {
            if (!input.name) return { success: false, result: null, error: "'name' required" };
            const item = getInventoryItem(input.name as string);
            return item ? { success: true, result: item } : { success: false, result: null, error: `Not found: ${input.name}` };
          }
          case "list": {
            const items = listInventoryItems({ category: input.category as string | undefined, lowStock: input.low_stock as boolean | undefined });
            return { success: true, result: { count: items.length, items } };
          }
          case "history": {
            if (!input.name) return { success: false, result: null, error: "'name' required" };
            const history = getItemHistory(input.name as string);
            return { success: true, result: { count: history.length, transactions: history } };
          }
          case "summary": {
            return { success: true, result: getInventorySummary() };
          }
          default:
            return { success: false, result: null, error: `Unknown action: ${action}` };
        }
      }

      // ── Real Estate Analyst ────────────────────────────────────────────
      case "real_estate": {
        const action = input.action as string;
        switch (action) {
          case "analyze": {
            if (!input.address || !input.purchase_price) return { success: false, result: null, error: "'address' and 'purchase_price' required" };
            const analysis = analyzeProperty({
              address: input.address as string,
              purchasePrice: input.purchase_price as number,
              monthlyRent: input.monthly_rent as number | undefined,
              downPayment: input.down_payment as number | undefined,
              interestRate: input.interest_rate as number | undefined,
              loanTerm: input.loan_term as number | undefined,
              propertyTax: input.property_tax as number | undefined,
              insurance: input.insurance as number | undefined,
            });
            return { success: true, result: analysis };
          }
          case "compare": {
            if (!input.properties || !(input.properties as any[]).length) return { success: false, result: null, error: "'properties' array required" };
            const analyses = (input.properties as any[]).map((p: any) => analyzeProperty(p));
            const comparison = compareProperties(analyses);
            return { success: true, result: comparison };
          }
          case "mortgage": {
            if (!input.principal) return { success: false, result: null, error: "'principal' required" };
            const result = calculateMortgage(
              input.principal as number,
              (input.interest_rate as number) || 7,
              (input.loan_term as number) || 30,
            );
            return { success: true, result };
          }
          default:
            return { success: false, result: null, error: `Unknown action: ${action}` };
        }
      }

      // ── Uptime Monitor ─────────────────────────────────────────────────
      case "uptime_check": {
        const action = input.action as string;
        switch (action) {
          case "check": {
            if (!input.url) return { success: false, result: null, error: "'url' required" };
            const check = await checkSite(input.url as string);
            return { success: true, result: check };
          }
          case "add": {
            if (!input.url) return { success: false, result: null, error: "'url' required" };
            const site = addSite(input.url as string, input.label as string | undefined);
            return { success: true, result: { message: `Monitoring: ${site.url}`, id: site.id } };
          }
          case "remove": {
            if (!input.url) return { success: false, result: null, error: "'url' required" };
            const removed = removeSite(input.url as string);
            return { success: removed, result: removed ? `Removed: ${input.url}` : `Not found: ${input.url}` };
          }
          case "list": {
            const sites = listSites();
            return { success: true, result: { count: sites.length, sites: sites.map((s) => ({ id: s.id, url: s.url, label: s.label, checks: s.checks.length })) } };
          }
          case "check_all": {
            const results = await checkAllSites();
            return { success: true, result: { count: results.length, results } };
          }
          case "report": {
            if (!input.url) return { success: false, result: null, error: "'url' required" };
            const report = getUptimeReport(input.url as string);
            return { success: true, result: report };
          }
          default:
            return { success: false, result: null, error: `Unknown action: ${action}` };
        }
      }

      // ── DNS Lookup ─────────────────────────────────────────────────────
      case "dns_lookup": {
        const domain = input.domain as string;
        if (!domain) return { success: false, result: null, error: "'domain' required" };
        const action = (input.action as string) || "info";

        if (action === "lookup") {
          const result = await lookupDNS(domain, input.record_types as string[] | undefined);
          return { success: true, result };
        } else {
          const info = await getDomainInfo(domain);
          return { success: true, result: info };
        }
      }

      // ── Customer Support ────────────────────────────────────────────────
      case "customer_support": {
        const action = input.action as string;
        switch (action) {
          case "create": {
            if (!input.customer || !input.subject || !input.description) {
              return { success: false, result: null, error: "'customer', 'subject', and 'description' required" };
            }
            const ticket = createTicket(input.customer as string, input.subject as string, input.description as string, {
              email: input.email as string | undefined,
              category: input.category as any,
              priority: input.priority as any,
            });
            return { success: true, result: { message: `Ticket created: ${ticket.id}`, ticket } };
          }
          case "update": {
            if (!input.ticket_id) return { success: false, result: null, error: "'ticket_id' required" };
            const updated = updateTicket(input.ticket_id as string, {
              status: input.status as any,
              priority: input.priority as any,
              category: input.category as any,
              assignee: input.assignee as string | undefined,
              note: input.note as string | undefined,
            });
            return { success: true, result: updated };
          }
          case "get": {
            if (!input.ticket_id) return { success: false, result: null, error: "'ticket_id' required" };
            const ticket = getTicket(input.ticket_id as string);
            return ticket ? { success: true, result: ticket } : { success: false, result: null, error: `Not found: ${input.ticket_id}` };
          }
          case "list": {
            const tickets = listTickets({
              status: input.status as any,
              priority: input.priority as any,
              category: input.category as any,
              customer: input.customer as string | undefined,
              assignee: input.assignee as string | undefined,
            });
            return { success: true, result: { count: tickets.length, tickets } };
          }
          case "summary": {
            return { success: true, result: getTicketSummary() };
          }
          case "suggest_response": {
            if (!input.ticket_id) return { success: false, result: null, error: "'ticket_id' required" };
            const response = getSuggestedResponse(input.ticket_id as string);
            return { success: true, result: { ticketId: input.ticket_id, suggestedResponse: response } };
          }
          case "escalations": {
            const escalated = getEscalationQueue();
            return { success: true, result: { count: escalated.length, tickets: escalated } };
          }
          default:
            return { success: false, result: null, error: `Unknown action: ${action}` };
        }
      }

      // ── Email Assistant ─────────────────────────────────────────────────
      case "email_assistant": {
        const action = input.action as string;
        switch (action) {
          case "triage": {
            if (!input.from || !input.subject) return { success: false, result: null, error: "'from' and 'subject' required" };
            const result = triageEmail({
              from: input.from as string,
              subject: input.subject as string,
              body: input.body as string | undefined,
              date: input.date as string | undefined,
            });
            return { success: true, result };
          }
          case "extract_actions": {
            const emails = input.emails as Array<{ from: string; subject: string; body?: string }> | undefined;
            if (!emails || emails.length === 0) return { success: false, result: null, error: "'emails' array required" };
            const actions = extractActions(emails);
            return { success: true, result: { count: actions.length, actions } };
          }
          case "digest": {
            const emails = input.emails as Array<{ from: string; subject: string; body?: string }> | undefined;
            if (!emails || emails.length === 0) return { success: false, result: null, error: "'emails' array required" };
            const digest = generateDigest(emails);
            return { success: true, result: digest };
          }
          case "draft_reply": {
            if (!input.from || !input.subject) return { success: false, result: null, error: "'from' and 'subject' required" };
            const reply = draftReply(
              { from: input.from as string, subject: input.subject as string, body: input.body as string | undefined },
              (input.style as "formal" | "friendly" | "brief") || "friendly"
            );
            return { success: true, result: { reply } };
          }
          default:
            return { success: false, result: null, error: `Unknown action: ${action}` };
        }
      }

      // ── Meeting Assistant ───────────────────────────────────────────────
      case "meeting_assistant": {
        const action = input.action as string;
        switch (action) {
          case "add": {
            if (!input.title) return { success: false, result: null, error: "'title' required" };
            const meeting = addMeeting(input.title as string, {
              transcript: input.transcript as string | undefined,
              notes: input.notes as string | undefined,
              attendees: input.attendees as string[] | undefined,
              duration: input.duration as number | undefined,
              tags: input.tags as string[] | undefined,
            });
            return { success: true, result: { message: `Meeting recorded: ${meeting.id}`, meeting } };
          }
          case "get": {
            if (!input.meeting_id) return { success: false, result: null, error: "'meeting_id' required" };
            const meeting = getMeeting(input.meeting_id as string);
            return meeting ? { success: true, result: meeting } : { success: false, result: null, error: `Not found: ${input.meeting_id}` };
          }
          case "list": {
            const meetings = listMeetings({ tag: input.tags?.[0] as string | undefined });
            return { success: true, result: { count: meetings.length, meetings: meetings.map((m) => ({ id: m.id, title: m.title, date: m.date.toISOString(), attendees: m.attendees.length, actions: m.actionItems.length, decisions: m.decisions.length })) } };
          }
          case "summarize": {
            if (!input.text && !input.transcript) return { success: false, result: null, error: "'text' or 'transcript' required" };
            const summary = summarizeMeeting((input.text || input.transcript) as string);
            return { success: true, result: { summary } };
          }
          case "extract_actions": {
            if (!input.text && !input.transcript) return { success: false, result: null, error: "'text' or 'transcript' required" };
            const actions = extractMeetingActions((input.text || input.transcript) as string);
            return { success: true, result: { count: actions.length, actions } };
          }
          case "extract_decisions": {
            if (!input.text && !input.transcript) return { success: false, result: null, error: "'text' or 'transcript' required" };
            const decisions = extractDecisions((input.text || input.transcript) as string);
            return { success: true, result: { count: decisions.length, decisions } };
          }
          case "pending": {
            const pending = getAllPendingActions();
            return { success: true, result: { count: pending.length, actions: pending } };
          }
          case "weekly": {
            const digest = getWeeklyDigest();
            return { success: true, result: digest };
          }
          case "update_action": {
            if (!input.meeting_id || input.action_index === undefined || !input.action_status) {
              return { success: false, result: null, error: "'meeting_id', 'action_index', and 'action_status' required" };
            }
            const updated = updateMeetingAction(
              input.meeting_id as string,
              input.action_index as number,
              input.action_status as "pending" | "in_progress" | "done"
            );
            return { success: true, result: updated };
          }
          default:
            return { success: false, result: null, error: `Unknown action: ${action}` };
        }
      }

      // ── Docs Writer ─────────────────────────────────────────────────────
      case "docs_writer": {
        const action = input.action as string;
        switch (action) {
          case "api_ref": {
            if (!input.project_name || !input.endpoints) return { success: false, result: null, error: "'project_name' and 'endpoints' required" };
            const doc = generateAPIRef(input.project_name as string, input.endpoints as any[], {
              baseUrl: input.base_url as string | undefined,
              authInfo: input.auth_info as string | undefined,
            });
            return { success: true, result: doc };
          }
          case "changelog": {
            if (!input.project_name || !input.entries) return { success: false, result: null, error: "'project_name' and 'entries' required" };
            const doc = generateChangelog(input.project_name as string, input.entries as any[]);
            return { success: true, result: doc };
          }
          case "guide": {
            if (!input.project_name || !input.sections) return { success: false, result: null, error: "'project_name' and 'sections' required" };
            const doc = generateGuide(input.project_name as string, input.sections as any[], {
              prerequisites: input.prerequisites as string[] | undefined,
              installCommand: input.install_command as string | undefined,
            });
            return { success: true, result: doc };
          }
          case "readme": {
            if (!input.project_name) return { success: false, result: null, error: "'project_name' required" };
            const doc = generateReadme(input.project_name as string, {
              description: input.description as string | undefined,
              features: input.features as string[] | undefined,
              installCommand: input.install_command as string | undefined,
              usage: input.usage as string | undefined,
              license: input.license as string | undefined,
            });
            return { success: true, result: doc };
          }
          case "interfaces": {
            if (!input.source_code) return { success: false, result: null, error: "'source_code' required" };
            const doc = documentInterfaces(input.source_code as string);
            return { success: true, result: doc };
          }
          default:
            return { success: false, result: null, error: `Unknown action: ${action}` };
        }
      }

      // ── Onboarding Agent ────────────────────────────────────────────────
      case "onboarding": {
        const action = input.action as string;
        switch (action) {
          case "create": {
            if (!input.name || !input.type) return { success: false, result: null, error: "'name' and 'type' required" };
            const plan = createPlan(input.name as string, input.type as any, {
              email: input.email as string | undefined,
              role: input.role as string | undefined,
              customSteps: input.custom_steps as any[] | undefined,
            });
            return { success: true, result: { message: `Plan created: ${plan.id}`, plan } };
          }
          case "complete_step": {
            if (!input.plan_id || !input.step_id) return { success: false, result: null, error: "'plan_id' and 'step_id' required" };
            const plan = completeStep(input.plan_id as string, input.step_id as number);
            return { success: true, result: plan };
          }
          case "skip_step": {
            if (!input.plan_id || !input.step_id) return { success: false, result: null, error: "'plan_id' and 'step_id' required" };
            const plan = skipStep(input.plan_id as string, input.step_id as number, input.reason as string | undefined);
            return { success: true, result: plan };
          }
          case "add_step": {
            if (!input.plan_id || !input.step_title || !input.step_description) {
              return { success: false, result: null, error: "'plan_id', 'step_title', and 'step_description' required" };
            }
            const plan = addOnboardingStep(input.plan_id as string, input.step_title as string, input.step_description as string);
            return { success: true, result: plan };
          }
          case "add_note": {
            if (!input.plan_id || !input.note) return { success: false, result: null, error: "'plan_id' and 'note' required" };
            const plan = addOnboardingNote(input.plan_id as string, input.note as string);
            return { success: true, result: plan };
          }
          case "get": {
            if (!input.plan_id) return { success: false, result: null, error: "'plan_id' required" };
            const plan = getPlan(input.plan_id as string);
            return plan ? { success: true, result: plan } : { success: false, result: null, error: `Not found: ${input.plan_id}` };
          }
          case "list": {
            const plans = listPlans({ type: input.type as any, active: input.active as boolean | undefined });
            return { success: true, result: { count: plans.length, plans: plans.map((p) => ({ id: p.id, name: p.name, type: p.type, progress: p.progress, steps: p.steps.length })) } };
          }
          case "summary": {
            return { success: true, result: getOnboardingSummary() };
          }
          case "faq": {
            if (!input.question) return { success: false, result: null, error: "'question' required" };
            const answer = answerFAQ(input.question as string);
            return { success: true, result: answer };
          }
          default:
            return { success: false, result: null, error: `Unknown action: ${action}` };
        }
      }

      // ── Recruiter ───────────────────────────────────────────────────────
      case "recruiter": {
        const action = input.action as string;
        switch (action) {
          case "add": {
            if (!input.name || !input.role) return { success: false, result: null, error: "'name' and 'role' required" };
            const candidate = addCandidate(input.name as string, input.role as string, {
              email: input.email as string | undefined,
              skills: input.skills as string[] | undefined,
              experience: input.experience as number | undefined,
              education: input.education as string | undefined,
              location: input.location as string | undefined,
              source: input.source as string | undefined,
              notes: input.note as string | undefined,
            });
            return { success: true, result: { message: `Candidate added: ${candidate.id}`, candidate } };
          }
          case "screen": {
            if (!input.role || !input.required_skills) return { success: false, result: null, error: "'role' and 'required_skills' required" };
            const ranked = screenCandidates({
              role: input.role as string,
              requiredSkills: input.required_skills as string[],
              preferredSkills: input.preferred_skills as string[] | undefined,
              minExperience: (input.min_experience as number) || 0,
            });
            return { success: true, result: { count: ranked.length, candidates: ranked.map((c) => ({ id: c.id, name: c.name, score: c.score, breakdown: c.scoreBreakdown, status: c.status })) } };
          }
          case "update": {
            if (!input.candidate_id) return { success: false, result: null, error: "'candidate_id' required" };
            const updated = updateCandidate(input.candidate_id as string, {
              status: input.status as any,
              note: input.note as string | undefined,
              skills: input.skills as string[] | undefined,
              experience: input.experience as number | undefined,
            });
            return { success: true, result: updated };
          }
          case "get": {
            if (!input.candidate_id) return { success: false, result: null, error: "'candidate_id' required" };
            const candidate = getCandidate(input.candidate_id as string);
            return candidate ? { success: true, result: candidate } : { success: false, result: null, error: `Not found: ${input.candidate_id}` };
          }
          case "list": {
            const candidates = listCandidates({
              role: input.role as string | undefined,
              status: input.status as any,
              minScore: input.min_score as number | undefined,
            });
            return { success: true, result: { count: candidates.length, candidates } };
          }
          case "remove": {
            if (!input.candidate_id) return { success: false, result: null, error: "'candidate_id' required" };
            const removed = removeCandidate(input.candidate_id as string);
            return { success: removed, result: removed ? `Removed: ${input.candidate_id}` : `Not found: ${input.candidate_id}` };
          }
          case "pipeline": {
            return { success: true, result: getRecruitPipeline(input.role as string | undefined) };
          }
          case "outreach": {
            if (!input.name || !input.role) return { success: false, result: null, error: "'name' and 'role' required" };
            const email = draftOutreach(
              { name: input.name as string, role: input.role as string, skills: input.skills as string[] | undefined },
              {
                companyName: input.company_name as string | undefined,
                tone: input.tone as "formal" | "casual" | undefined,
              }
            );
            return { success: true, result: { outreach: email } };
          }
          default:
            return { success: false, result: null, error: `Unknown action: ${action}` };
        }
      }

      // ===== OSINT Tools =====
      case "osint_search": {
        const result = await osintSearch({
          query: input.query as string,
          sources: input.sources as string[] | undefined,
          entity_type: input.entity_type as string | undefined,
        });
        return { success: true, result };
      }

      case "osint_graph": {
        const result = await osintGraphQuery({
          action: input.action as string,
          entity_id: input.entity_id as string | undefined,
          entity_name: input.entity_name as string | undefined,
          target_id: input.target_id as string | undefined,
          depth: input.depth as number | undefined,
          cypher: input.cypher as string | undefined,
          threshold: input.threshold as number | undefined,
        });
        return { success: true, result };
      }

      case "osint_enrich": {
        const result = await osintEnrich({
          entity_id: input.entity_id as string | undefined,
          entity_name: input.entity_name as string | undefined,
          sources: input.sources as string[] | undefined,
          depth: input.depth as number | undefined,
        });
        return { success: true, result };
      }

      case "osint_analyze": {
        const result = await osintAnalyze({
          action: input.action as string,
          entity_id: input.entity_id as string | undefined,
          options: input.options as Record<string, unknown> | undefined,
        });
        return { success: true, result };
      }

      default:
        return { success: false, result: null, error: `Unknown tool: ${name}` };
    }
  } catch (error) {
    return {
      success: false,
      result: null,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
