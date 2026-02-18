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
import { renderMath, renderMathDocument, latexToSpeech } from "./rendering/math-renderer";
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
import { createExchangeClient } from "../integrations/finance/exchange";
import { createDeFiClient } from "../integrations/finance/defi";
import { createOnChainClient } from "../integrations/finance/onchain";
import { createOrderBookClient } from "../integrations/finance/orderbook";
import { createBacktestingEngine } from "../integrations/finance/backtesting";
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

// === New modules from sister projects ===
import { integrationRegistry } from "../core/adapters";
import {
  createRule,
  getRule,
  updateRule,
  deleteRule,
  listRules,
  processTrigger,
  importRules,
  exportRules,
  RuleTrigger,
} from "../core/automation/logic-rules";
import {
  submitForApproval,
  processApproval,
  getPendingApprovals,
  getApprovalHistory,
  addApprovalRule,
  removeApprovalRule,
  listApprovalRules,
} from "../core/automation/approval-engine";
import { RAGPipeline } from "../core/intelligence/rag-pipeline";
import { riskEngine } from "../core/intelligence/risk-engine";
import { GraphRAG } from "../core/intelligence/graph-rag";
import { strategyOrchestrator } from "../core/intelligence/strategy-plugins";
import { patternAnalyzer } from "../core/intelligence/pattern-analyzer";
import { eventBus } from "../core/events/event-bus";
import { autoResponder } from "../core/events/auto-responder";
import { dagEngine } from "../core/workflows/dag-engine";
import { encrypt, decrypt, encryptCredentials, decryptCredentials, signWebhook, verifyWebhookSignature, generateApiKey } from "../core/security/crypto";
import { rateLimit, resetRateLimit, getRateLimitStatus } from "../core/security/rate-limiter-enhanced";
import { logAuditAction, queryAudit, getAuditStats, exportAuditLog } from "../core/security/audit-trail";
import { SyncEngine } from "../core/sync/multi-device-sync";

// === New gap-fill imports ===
import { generateICal, quickEvent, type ICalEvent } from "./file-generation/ical";
import { generateReport, quickReport, type ReportSection } from "./file-generation/html-reports";
import { treeOfThought, formatToTResult, type ToTConfig } from "../core/agents/reasoning/tree-of-thought";
import { processMessage as adaptiveProcessMessage, getPromptModifier, getUserProfile as getAdaptiveProfile, resetProfile as resetAdaptiveProfile, getTopFrequentTopics, getTopFrequentTools } from "../core/intelligence/adaptive-feedback";
import { addItem as srAddItem, reviewItem as srReviewItem, getDueItems as srGetDueItems, getUserItems as srGetUserItems, getStats as srGetStats, deleteItem as srDeleteItem } from "../core/intelligence/spaced-repetition";
import { processAndAdjust, getDifficultyAdjustment, getUserState as getStruggleState, resetState as resetStruggleState, getStruggleTopics } from "../core/intelligence/struggle-detection";

// === New tool imports (v2.7 tools) ===
import { searchGifs } from "./gif-search";
import { searchPlaces, reverseGeocode, findNearby, getDirections } from "./places-lookup";
import { parseSpotifyCommand } from "./spotify-cli";
import { getTokenDashboard } from "./token-dashboard";
import { executeTerminalCommand } from "./terminal-agent";
import { createGoogleServices, type GoogleServicesClient } from "../integrations/google";

// === Unwired integration imports ===
import { createSpotifyClient, type SpotifyClient } from "../integrations/spotify";
import { twilioService } from "../integrations/twilio";
import { makeCall, makeCallWithTTS, getCallStatus, endCall } from "../integrations/twilio/voice";
import { initNotionFromEnv } from "../integrations/notion";
import { isNotionInitialized } from "../integrations/notion/client";
import * as notionPages from "../integrations/notion/pages";
import * as notionDatabases from "../integrations/notion/databases";
import * as notionSearch from "../integrations/notion/search";
import { createHomeAssistant, type HomeAssistant } from "../integrations/homeassistant";
import { getUnifiedCloudStorage } from "../integrations/cloud-storage/unified";
import { GoogleCalendarClient } from "../inputs/calendar/google-calendar";
import { OutlookCalendarClient } from "../inputs/calendar/outlook-calendar";
import {
  fetchICalFromUrl,
  getTodaysEvents as getTodaysICalEvents,
  getUpcomingEvents as getUpcomingICalEvents,
  formatEvent,
} from "../inputs/calendar/ical-parser";
import {
  createPersona,
  getActivePersona,
  activatePersona,
  deactivatePersonas,
  getUserPersonas,
  deletePersona,
  getPersonaSystemPrompt,
  initializeDefaultPersonas,
} from "../core/personality/persona-manager";
import { detectMood, analyzeMoodTrend } from "../core/personality/mood-detector";
import {
  activateDomainExpert,
  deactivateDomainExpert,
  listDomainExperts,
  detectDomainFromMessage,
} from "../core/personality/domain-experts";

// Singleton instances for stateful modules
const ragPipeline = new RAGPipeline();
const graphRAG = new GraphRAG();
const syncEngine = new SyncEngine("opensentinel-primary");

// Lazy-initialized integration singletons
let spotifyClient: SpotifyClient | null = null;
function getSpotifyClient(): SpotifyClient {
  if (!spotifyClient) {
    if (!env.SPOTIFY_CLIENT_ID || !env.SPOTIFY_CLIENT_SECRET) {
      throw new Error("Spotify not configured. Set SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET in .env");
    }
    spotifyClient = createSpotifyClient({
      clientId: env.SPOTIFY_CLIENT_ID,
      clientSecret: env.SPOTIFY_CLIENT_SECRET,
      redirectUri: env.SPOTIFY_REDIRECT_URI || `http://localhost:${env.PORT}/api/callbacks/spotify`,
    });
    // Seed refresh token from env if available (skips interactive OAuth flow)
    const refreshToken = env.SPOTIFY_REFRESH_TOKEN;
    if (refreshToken) {
      spotifyClient.auth.setTokens({
        accessToken: "",
        refreshToken,
        expiresAt: 0,
        scope: "",
        tokenType: "Bearer",
      });
    }
  }
  return spotifyClient;
}

let haInstance: HomeAssistant | null = null;
function getHomeAssistant(): HomeAssistant {
  if (!haInstance) {
    if (!env.HOME_ASSISTANT_URL || !env.HOME_ASSISTANT_TOKEN) {
      throw new Error("Home Assistant not configured. Set HOME_ASSISTANT_URL and HOME_ASSISTANT_TOKEN in .env");
    }
    haInstance = createHomeAssistant({
      url: env.HOME_ASSISTANT_URL,
      token: env.HOME_ASSISTANT_TOKEN,
    });
  }
  return haInstance;
}

let googleCalClient: GoogleCalendarClient | null = null;
function getGoogleCalendar(): GoogleCalendarClient {
  if (!googleCalClient) {
    if (!env.GOOGLE_CALENDAR_CLIENT_ID || !env.GOOGLE_CALENDAR_CLIENT_SECRET) {
      throw new Error("Google Calendar not configured. Set GOOGLE_CALENDAR_CLIENT_ID and GOOGLE_CALENDAR_CLIENT_SECRET in .env");
    }
    googleCalClient = new GoogleCalendarClient({
      clientId: env.GOOGLE_CALENDAR_CLIENT_ID,
      clientSecret: env.GOOGLE_CALENDAR_CLIENT_SECRET,
      redirectUri: env.GOOGLE_CALENDAR_REDIRECT_URI || `https://app.opensentinel.ai/api/callbacks/google-calendar`,
      refreshToken: env.GOOGLE_CALENDAR_REFRESH_TOKEN,
    });
  }
  return googleCalClient;
}

let outlookCalClient: OutlookCalendarClient | null = null;
function getOutlookCalendar(): OutlookCalendarClient {
  if (!outlookCalClient) {
    if (!env.OUTLOOK_CLIENT_ID || !env.OUTLOOK_CLIENT_SECRET) {
      throw new Error("Outlook Calendar not configured. Set OUTLOOK_CLIENT_ID and OUTLOOK_CLIENT_SECRET in .env");
    }
    outlookCalClient = new OutlookCalendarClient({
      clientId: env.OUTLOOK_CLIENT_ID,
      clientSecret: env.OUTLOOK_CLIENT_SECRET,
      redirectUri: env.OUTLOOK_REDIRECT_URI || `https://app.opensentinel.ai/api/callbacks/outlook`,
      refreshToken: env.OUTLOOK_REFRESH_TOKEN,
    });
  }
  return outlookCalClient;
}

// Lazy-initialized Google Services singleton
let googleServicesClient: GoogleServicesClient | null = null;
function getGoogleServices(): GoogleServicesClient {
  const clientId = (env as any).GOOGLE_CLIENT_ID || env.GOOGLE_DRIVE_CLIENT_ID || env.GOOGLE_CALENDAR_CLIENT_ID;
  const clientSecret = (env as any).GOOGLE_CLIENT_SECRET || env.GOOGLE_DRIVE_CLIENT_SECRET || env.GOOGLE_CALENDAR_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("Google not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env");
  }
  if (!googleServicesClient) {
    googleServicesClient = createGoogleServices({
      clientId,
      clientSecret,
      redirectUri: (env as any).GOOGLE_REDIRECT_URI || env.GOOGLE_DRIVE_REDIRECT_URI || env.GOOGLE_CALENDAR_REDIRECT_URI || "https://app.opensentinel.ai/api/callbacks/google",
      refreshToken: (env as any).GOOGLE_REFRESH_TOKEN || env.GOOGLE_DRIVE_REFRESH_TOKEN || env.GOOGLE_CALENDAR_REFRESH_TOKEN,
    });
  }
  return googleServicesClient;
}

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
  const host = env.EMAIL_LOCAL_SMTP_HOST || "127.0.0.1";
  const port = env.EMAIL_LOCAL_SMTP_PORT || 25;

  // Local SMTP on port 25: rely on permit_mynetworks (no auth needed from localhost)
  return new SmtpClient(
    {
      host,
      port,
      secure: false,
      auth: { user: "", pass: "" },  // Empty = SmtpClient skips auth attempt
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

  // ===== Integration Adapter Framework (from Workflow-Hub) =====
  {
    name: "integration_execute",
    description:
      "Execute an action on a third-party integration (Salesforce, Stripe, HubSpot, Google Workspace, Microsoft 365, Shopify, Jira, Twilio, AWS S3, SendGrid, QuickBooks, Xero, Mailchimp, Zapier). First authenticate with integration_auth, then call actions.",
    input_schema: {
      type: "object" as const,
      properties: {
        integration: { type: "string", description: "Integration slug (e.g., 'salesforce', 'stripe', 'hubspot', 'google-workspace', 'jira')" },
        action: { type: "string", description: "Action name (e.g., 'createContact', 'sendEmail', 'createIssue')" },
        input: { type: "object", description: "Action input parameters" },
      },
      required: ["integration", "action", "input"],
    },
  },
  {
    name: "integration_auth",
    description: "Authenticate with a third-party integration. Provide credentials as key-value pairs.",
    input_schema: {
      type: "object" as const,
      properties: {
        integration: { type: "string", description: "Integration slug" },
        credentials: { type: "object", description: "Credentials (e.g., { apiKey: '...' } or { accessToken: '...' })" },
      },
      required: ["integration", "credentials"],
    },
  },
  {
    name: "integration_list",
    description: "List all available third-party integrations and their capabilities.",
    input_schema: {
      type: "object" as const,
      properties: {
        category: { type: "string", description: "Optional category filter (crm, payments, productivity, ecommerce, etc.)" },
      },
    },
  },

  // ===== Logic Rule Automation Engine (from Recruiting_AI) =====
  {
    name: "automation_rule",
    description:
      "Manage automation rules (trigger-condition-action). Create rules that automatically execute actions when conditions are met. Triggers include: message.received, tool.executed, webhook.received, schedule.daily, etc.",
    input_schema: {
      type: "object" as const,
      properties: {
        action: { type: "string", enum: ["create", "get", "update", "delete", "list", "process_trigger", "import", "export"], description: "Operation to perform" },
        id: { type: "string", description: "Rule ID (for get/update/delete)" },
        rule: { type: "object", description: "Rule configuration (for create/update)" },
        trigger: { type: "string", description: "Trigger type (for process_trigger)" },
        context: { type: "object", description: "Trigger context data (for process_trigger)" },
        rules: { type: "array", description: "Array of rules (for import)" },
      },
      required: ["action"],
    },
  },

  // ===== Approval Engine (from GoGreenSourcingAI) =====
  {
    name: "approval_workflow",
    description:
      "Manage approval workflows. Submit entities for approval, process decisions, manage approval rules, and track approval status.",
    input_schema: {
      type: "object" as const,
      properties: {
        action: { type: "string", enum: ["submit", "approve", "reject", "pending", "history", "add_rule", "remove_rule", "list_rules"], description: "Operation" },
        entity_type: { type: "string", description: "Entity type (e.g., 'purchase_order', 'deployment')" },
        entity_id: { type: "string", description: "Entity ID" },
        request_id: { type: "string", description: "Approval request ID (for approve/reject)" },
        user_id: { type: "string", description: "User ID" },
        comments: { type: "string", description: "Approval/rejection comments" },
        entity_data: { type: "object", description: "Entity data for rule evaluation" },
        rule: { type: "object", description: "Approval rule configuration (for add_rule)" },
      },
      required: ["action"],
    },
  },

  // ===== Enhanced RAG Pipeline (from PolyMarketAI) =====
  {
    name: "rag_pipeline",
    description:
      "Enhanced RAG (Retrieval Augmented Generation) pipeline with pluggable embeddings and hybrid search. Add documents, search with vector + keyword matching, chunk documents.",
    input_schema: {
      type: "object" as const,
      properties: {
        action: { type: "string", enum: ["add", "search", "search_vector", "search_keyword", "clear", "stats"], description: "Operation" },
        content: { type: "string", description: "Document content (for add)" },
        query: { type: "string", description: "Search query" },
        metadata: { type: "object", description: "Document metadata" },
        top_k: { type: "number", description: "Number of results (default 5)" },
        chunk_size: { type: "number", description: "Chunk size for document splitting" },
      },
      required: ["action"],
    },
  },

  // ===== Risk Engine (from PolyMarketAI) =====
  {
    name: "risk_evaluate",
    description:
      "Evaluate an action against the risk/constraint engine. Non-bypassable safety checks including rate limits, cost limits, blocked tools, command injection detection, and sensitive data checks.",
    input_schema: {
      type: "object" as const,
      properties: {
        action: { type: "string", enum: ["evaluate", "config", "audit", "block_tool", "unblock_tool", "safe_mode", "kill_switch"], description: "Operation" },
        context: { type: "object", description: "Risk evaluation context" },
        tool_name: { type: "string", description: "Tool name (for block/unblock)" },
        enabled: { type: "boolean", description: "Enable/disable (for safe_mode/kill_switch)" },
        config: { type: "object", description: "Configuration updates" },
      },
      required: ["action"],
    },
  },

  // ===== Graph RAG (from GoGreen-DOC-AI) =====
  {
    name: "graph_rag",
    description:
      "Graph-based RAG with entity extraction and multi-hop traversal. Ingest documents to build a knowledge graph, then query with multi-hop entity traversal for complex questions.",
    input_schema: {
      type: "object" as const,
      properties: {
        action: { type: "string", enum: ["ingest", "search", "traverse", "entity", "stats"], description: "Operation" },
        content: { type: "string", description: "Document content (for ingest)" },
        query: { type: "string", description: "Search query" },
        entity_id: { type: "string", description: "Entity ID (for traverse/entity)" },
        max_hops: { type: "number", description: "Maximum traversal hops (default 2)" },
        metadata: { type: "object", description: "Document metadata" },
      },
      required: ["action"],
    },
  },

  // ===== Strategy Plugins (from PolyMarketAI) =====
  {
    name: "strategy_orchestrator",
    description:
      "Run analysis strategies in parallel. Register strategy plugins, run one or all strategies, get consensus decisions. Used for multi-agent analysis and decision-making.",
    input_schema: {
      type: "object" as const,
      properties: {
        action: { type: "string", enum: ["list", "run_one", "run_all"], description: "Operation" },
        strategy_name: { type: "string", description: "Strategy name (for run_one)" },
        query: { type: "string", description: "Query/prompt for strategies" },
        parameters: { type: "object", description: "Strategy parameters" },
        timeout_ms: { type: "number", description: "Timeout in milliseconds" },
      },
      required: ["action"],
    },
  },

  // ===== Pattern Analyzer (from TimeSheetAI) =====
  {
    name: "pattern_analyzer",
    description:
      "Behavioral pattern analysis and prediction. Track user interactions, detect temporal/behavioral/preference/sequence patterns, predict next actions, and detect anomalies.",
    input_schema: {
      type: "object" as const,
      properties: {
        action: { type: "string", enum: ["record", "analyze", "predict", "detect_anomaly", "patterns", "corrections", "stats"], description: "Operation" },
        event: { type: "object", description: "Pattern event to record" },
        user_id: { type: "string", description: "User ID for analysis/prediction" },
        context: { type: "object", description: "Current context for predictions" },
      },
      required: ["action"],
    },
  },

  // ===== Event Bus (from Ecom-Sales) =====
  {
    name: "event_bus",
    description:
      "Type-safe event bus with history and replay. Emit events, subscribe to event types (including wildcards), replay past events, and view dead letter queue.",
    input_schema: {
      type: "object" as const,
      properties: {
        action: { type: "string", enum: ["emit", "history", "replay", "dead_letters", "stats"], description: "Operation" },
        event_type: { type: "string", description: "Event type (e.g., 'user.action', 'system.*')" },
        payload: { type: "object", description: "Event payload (for emit)" },
        since: { type: "string", description: "ISO date for filtering (for replay/history)" },
        limit: { type: "number", description: "Result limit" },
      },
      required: ["action"],
    },
  },

  // ===== Auto-Responder (from Ecom-Sales) =====
  {
    name: "auto_responder",
    description:
      "Rule-based auto-responder with AI escalation. Add response rules with pattern matching, process incoming messages, configure business hours.",
    input_schema: {
      type: "object" as const,
      properties: {
        action: { type: "string", enum: ["add_rule", "remove_rule", "update_rule", "list_rules", "process"], description: "Operation" },
        rule: { type: "object", description: "Response rule configuration" },
        rule_id: { type: "string", description: "Rule ID (for remove/update)" },
        message: { type: "string", description: "Message to process (for process)" },
        channel: { type: "string", description: "Channel name (for process)" },
        user_id: { type: "string", description: "User ID (for process)" },
      },
      required: ["action"],
    },
  },

  // ===== DAG Workflow Engine (from Workflow-Hub) =====
  {
    name: "dag_workflow",
    description:
      "DAG (Directed Acyclic Graph) workflow engine. Create workflows with 7 node types (trigger, action, condition, loop, delay, ai, webhook), execute workflows, view execution history.",
    input_schema: {
      type: "object" as const,
      properties: {
        action: { type: "string", enum: ["create", "execute", "get", "list", "delete", "executions"], description: "Operation" },
        workflow_id: { type: "string", description: "Workflow ID" },
        workflow: { type: "object", description: "Workflow configuration (for create)" },
        trigger_data: { type: "object", description: "Trigger data (for execute)" },
      },
      required: ["action"],
    },
  },

  // ===== Crypto Utilities (from Workflow-Hub) =====
  {
    name: "crypto_utils",
    description:
      "AES-256-GCM encryption, HMAC-SHA256 webhook signing, API key generation. Encrypt/decrypt strings and credentials, sign/verify webhooks.",
    input_schema: {
      type: "object" as const,
      properties: {
        action: { type: "string", enum: ["encrypt", "decrypt", "sign_webhook", "verify_webhook", "generate_api_key"], description: "Operation" },
        plaintext: { type: "string", description: "Text to encrypt" },
        ciphertext: { type: "string", description: "Text to decrypt" },
        password: { type: "string", description: "Encryption password" },
        payload: { type: "string", description: "Webhook payload to sign/verify" },
        secret: { type: "string", description: "Webhook secret" },
        signature: { type: "string", description: "Webhook signature to verify" },
        prefix: { type: "string", description: "API key prefix (default 'os')" },
      },
      required: ["action"],
    },
  },

  // ===== Audit Trail (from GoGreenSourcingAI) =====
  {
    name: "audit_trail",
    description:
      "Immutable audit trail for tracking actions. Log actions, query audit entries by entity/user/action, export audit log, and view statistics.",
    input_schema: {
      type: "object" as const,
      properties: {
        action: { type: "string", enum: ["log", "query", "entity_trail", "user_actions", "stats", "export"], description: "Operation" },
        log_action: { type: "string", description: "Action to log (for log)" },
        entity: { type: "string", description: "Entity type" },
        entity_id: { type: "string", description: "Entity ID" },
        user_id: { type: "string", description: "User ID" },
        metadata: { type: "object", description: "Additional metadata" },
        limit: { type: "number", description: "Result limit" },
      },
      required: ["action"],
    },
  },

  // ===== Multi-Device Sync (from Ecom-Sales) =====
  {
    name: "device_sync",
    description:
      "Multi-device synchronization with version vector conflict resolution. Sync documents across devices, handle conflicts with configurable strategies (last-write-wins, merge, manual).",
    input_schema: {
      type: "object" as const,
      properties: {
        action: { type: "string", enum: ["upsert", "get", "delete", "receive_remote", "changes_since", "conflicts", "resolve_conflict", "stats"], description: "Operation" },
        document_id: { type: "string", description: "Document ID" },
        data: { type: "object", description: "Document data" },
        remote_document: { type: "object", description: "Remote document (for receive_remote)" },
        since: { type: "string", description: "ISO date (for changes_since)" },
        resolved_data: { type: "object", description: "Resolved data (for resolve_conflict)" },
      },
      required: ["action"],
    },
  },

  // ===== Spotify Integration =====
  {
    name: "spotify",
    description:
      "Control Spotify music playback, search for music, manage playlists, and get recommendations. Requires Spotify Premium for playback control.",
    input_schema: {
      type: "object" as const,
      properties: {
        action: {
          type: "string",
          enum: ["play", "pause", "next", "previous", "now_playing", "search", "queue", "volume", "shuffle", "repeat", "devices", "playlists", "create_playlist", "like", "profile", "recommendations"],
          description: "Action to perform",
        },
        query: { type: "string", description: "Search query or song/artist/playlist name to play" },
        type: { type: "string", enum: ["track", "album", "artist", "playlist"], description: "Search type or play type (default: track)" },
        volume: { type: "number", description: "Volume level 0-100 (for volume action)" },
        state: { type: "boolean", description: "On/off state (for shuffle action)" },
        repeat_mode: { type: "string", enum: ["off", "track", "context"], description: "Repeat mode" },
        device_id: { type: "string", description: "Target device ID" },
        playlist_name: { type: "string", description: "Playlist name (for create_playlist)" },
        playlist_description: { type: "string", description: "Playlist description" },
        limit: { type: "number", description: "Number of results (default: 10)" },
      },
      required: ["action"],
    },
  },

  // ===== Twilio SMS/Voice =====
  {
    name: "twilio",
    description:
      "Send SMS/MMS messages and make phone calls via Twilio. Can send text messages, multimedia messages, and initiate voice calls with text-to-speech.",
    input_schema: {
      type: "object" as const,
      properties: {
        action: {
          type: "string",
          enum: ["send_sms", "send_mms", "make_call", "call_status", "end_call", "message_status"],
          description: "Action to perform",
        },
        to: { type: "string", description: "Recipient phone number (E.164 format, e.g., +1234567890)" },
        body: { type: "string", description: "Message body (for SMS/MMS)" },
        media_urls: { type: "array", items: { type: "string" }, description: "Media URLs for MMS" },
        message: { type: "string", description: "Text-to-speech message (for make_call)" },
        call_sid: { type: "string", description: "Call SID (for call_status/end_call)" },
        message_sid: { type: "string", description: "Message SID (for message_status)" },
      },
      required: ["action"],
    },
  },

  // ===== Notion Integration =====
  {
    name: "notion",
    description:
      "Interact with Notion workspace. Search pages and databases, create/update pages, query databases, and manage content. Requires NOTION_API_KEY in .env.",
    input_schema: {
      type: "object" as const,
      properties: {
        action: {
          type: "string",
          enum: ["search", "get_page", "create_page", "update_page", "query_database", "create_entry", "list_databases", "append_to_page"],
          description: "Action to perform",
        },
        query: { type: "string", description: "Search query" },
        page_id: { type: "string", description: "Notion page ID" },
        database_id: { type: "string", description: "Notion database ID" },
        title: { type: "string", description: "Page title (for create_page)" },
        content: { type: "string", description: "Page content in markdown (for create_page/append_to_page)" },
        parent_page_id: { type: "string", description: "Parent page ID (for create_page)" },
        properties: { type: "object", description: "Properties to set/update" },
        filter: { type: "object", description: "Database query filter" },
        sorts: { type: "array", description: "Database query sorts" },
        limit: { type: "number", description: "Results limit (default: 20)" },
      },
      required: ["action"],
    },
  },

  // ===== Home Assistant Smart Home =====
  {
    name: "smart_home",
    description:
      "Control smart home devices via Home Assistant. Turn lights on/off, adjust thermostats, lock doors, control media players, run automations, and activate scenes. Can also process natural language commands.",
    input_schema: {
      type: "object" as const,
      properties: {
        action: {
          type: "string",
          enum: ["list_devices", "get_state", "control", "command", "automations", "scenes", "activate_scene", "history"],
          description: "Action to perform",
        },
        entity_id: { type: "string", description: "Home Assistant entity ID (e.g., light.living_room)" },
        domain: { type: "string", description: "Device domain filter (light, switch, climate, lock, media_player, etc.)" },
        service: { type: "string", description: "Service to call (e.g., turn_on, turn_off, toggle, set_temperature)" },
        data: { type: "object", description: "Service call data (e.g., { brightness: 128, color_name: 'red' })" },
        command: { type: "string", description: "Natural language command (e.g., 'turn off all the lights')" },
        query: { type: "string", description: "Search query for devices/automations" },
      },
      required: ["action"],
    },
  },

  // ===== Cloud Storage =====
  {
    name: "cloud_storage",
    description:
      "Manage files on Google Drive and Dropbox. List, search, upload, download, share files, create folders, and check storage quota.",
    input_schema: {
      type: "object" as const,
      properties: {
        action: {
          type: "string",
          enum: ["list", "search", "upload", "download", "create_folder", "delete", "share", "quota", "providers"],
          description: "Action to perform",
        },
        provider: { type: "string", enum: ["google_drive", "dropbox"], description: "Cloud provider (uses default if omitted)" },
        path: { type: "string", description: "File/folder path or ID" },
        query: { type: "string", description: "Search query" },
        content: { type: "string", description: "File content to upload (text)" },
        filename: { type: "string", description: "Filename for upload" },
        folder_name: { type: "string", description: "Folder name to create" },
        parent_path: { type: "string", description: "Parent folder path/ID" },
        email: { type: "string", description: "Email to share with" },
        role: { type: "string", enum: ["reader", "writer", "commenter"], description: "Share permission role" },
        limit: { type: "number", description: "Results limit" },
      },
      required: ["action"],
    },
  },

  // ===== Calendar =====
  {
    name: "calendar",
    description:
      "Access Google Calendar, Outlook Calendar, or iCal feeds. View today's events, upcoming schedule, and list calendars. Supports multiple calendar providers.",
    input_schema: {
      type: "object" as const,
      properties: {
        action: {
          type: "string",
          enum: ["today", "upcoming", "list_calendars", "events"],
          description: "Action to perform",
        },
        provider: { type: "string", enum: ["google", "outlook", "ical"], description: "Calendar provider (default: google)" },
        days: { type: "number", description: "Number of days ahead for upcoming events (default: 7)" },
        calendar_id: { type: "string", description: "Calendar ID (default: primary)" },
        ical_url: { type: "string", description: "iCal feed URL (required for ical provider)" },
        start_date: { type: "string", description: "Start date for events query (ISO 8601)" },
        end_date: { type: "string", description: "End date for events query (ISO 8601)" },
      },
      required: ["action"],
    },
  },

  // ===== Personality & Persona Management =====
  {
    name: "persona",
    description:
      "Manage AI personality and personas. Switch between personas (professional, casual, creative, etc.), detect user mood, activate domain experts, and customize response style.",
    input_schema: {
      type: "object" as const,
      properties: {
        action: {
          type: "string",
          enum: ["list", "activate", "deactivate", "create", "delete", "current", "detect_mood", "mood_trend", "domain_expert", "list_experts"],
          description: "Action to perform",
        },
        persona_id: { type: "string", description: "Persona ID (for activate/delete)" },
        user_id: { type: "string", description: "User ID" },
        name: { type: "string", description: "Persona name (for create)" },
        description: { type: "string", description: "Persona description" },
        traits: { type: "array", description: "Persona traits", items: { type: "object" } },
        message: { type: "string", description: "Message text (for detect_mood)" },
        messages: { type: "array", description: "Message history (for mood_trend)", items: { type: "string" } },
        expert_type: { type: "string", description: "Domain expert type (for domain_expert)" },
      },
      required: ["action"],
    },
  },

  // ===== iCal Generation =====
  {
    name: "generate_ical",
    description: "Generate iCal (.ics) calendar files from events. Supports recurring events, alarms, attendees, and all standard iCal features. Output can be imported into Google Calendar, Outlook, Apple Calendar, etc.",
    input_schema: {
      type: "object",
      properties: {
        events: {
          type: "array",
          description: "Array of events to include in the calendar file",
          items: {
            type: "object",
            properties: {
              title: { type: "string", description: "Event title" },
              start: { type: "string", description: "Start date/time (ISO 8601)" },
              end: { type: "string", description: "End date/time (ISO 8601)" },
              allDay: { type: "boolean", description: "Whether this is an all-day event" },
              description: { type: "string", description: "Event description" },
              location: { type: "string", description: "Event location" },
              url: { type: "string", description: "Associated URL" },
              status: { type: "string", enum: ["confirmed", "tentative", "cancelled"] },
              categories: { type: "array", items: { type: "string" } },
            },
            required: ["title", "start"],
          },
        },
        filename: { type: "string", description: "Output filename" },
        calendar_name: { type: "string", description: "Calendar name" },
        timezone: { type: "string", description: "Timezone (e.g., 'America/New_York')" },
      },
      required: ["events"],
    },
  },

  // ===== HTML Report =====
  {
    name: "generate_report",
    description: "Generate a styled HTML report with sections containing metrics cards, progress bars, tables, timelines, and key-value data. Supports light/dark/corporate/minimal themes. Print-ready.",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Report title" },
        subtitle: { type: "string", description: "Report subtitle" },
        theme: { type: "string", enum: ["light", "dark", "corporate", "minimal"], description: "Visual theme" },
        author: { type: "string", description: "Report author" },
        sections: {
          type: "array",
          description: "Report sections",
          items: {
            type: "object",
            properties: {
              title: { type: "string", description: "Section heading" },
              type: { type: "string", enum: ["text", "metrics", "table", "progress", "timeline", "kv"], description: "Section type" },
              content: { type: "string", description: "HTML or text content (for 'text' type)" },
              data: { description: "Structured data for the section type" },
            },
            required: ["title"],
          },
        },
        filename: { type: "string", description: "Output filename" },
      },
      required: ["title", "sections"],
    },
  },

  // ===== Math-to-Speech =====
  {
    name: "math_to_speech",
    description: "Convert LaTeX mathematical expressions to natural spoken English. Useful for voice output, accessibility, and TTS. Examples: '\\frac{a}{b}' → 'a divided by b', 'x^2' → 'x squared', '\\sum_{i=1}^{n}' → 'the sum from i equals 1 to n of'.",
    input_schema: {
      type: "object",
      properties: {
        latex: { type: "string", description: "LaTeX expression to convert" },
        expressions: { type: "array", items: { type: "string" }, description: "Multiple LaTeX expressions to convert at once" },
      },
      required: [],
    },
  },

  // ===== Tree-of-Thought =====
  {
    name: "tree_of_thought",
    description: "Solve complex problems using Tree-of-Thought reasoning. Explores multiple reasoning paths simultaneously, evaluates each branch, prunes weak paths, and finds the best solution. Best for problems with multiple valid approaches where a single chain-of-thought might miss the optimal answer.",
    input_schema: {
      type: "object",
      properties: {
        problem: { type: "string", description: "The problem to solve" },
        max_depth: { type: "number", description: "Maximum reasoning depth (default 4)" },
        branching_factor: { type: "number", description: "Candidate thoughts per node (default 3)" },
        strategy: { type: "string", enum: ["bfs", "dfs"], description: "Search strategy (default bfs)" },
        max_nodes: { type: "number", description: "Max nodes to explore, cost guard (default 30)" },
        prune_threshold: { type: "number", description: "Min score 0-10 to keep branch alive (default 4)" },
      },
      required: ["problem"],
    },
  },

  // ===== Adaptive Feedback =====
  {
    name: "adaptive_feedback",
    description: "Manage the adaptive feedback system that learns user preferences and adjusts AI responses. Tracks verbosity, technical level, formality, and proactivity preferences from interaction patterns.",
    input_schema: {
      type: "object",
      properties: {
        action: {
          type: "string",
          enum: ["get_profile", "get_modifier", "process_message", "reset", "frequent_topics", "frequent_tools"],
          description: "Action to perform",
        },
        user_id: { type: "string", description: "User ID" },
        message: { type: "string", description: "Message to process (for process_message)" },
        response_time_ms: { type: "number", description: "Response time in ms (for process_message)" },
      },
      required: ["action", "user_id"],
    },
  },

  // ===== Spaced Repetition =====
  {
    name: "spaced_repetition",
    description: "SM-2 spaced repetition system for optimized memory retention. Add items, review them with quality ratings, and the system schedules optimal review intervals. Works like Anki but integrated into the assistant.",
    input_schema: {
      type: "object",
      properties: {
        action: {
          type: "string",
          enum: ["add", "review", "due", "list", "stats", "delete"],
          description: "Action: add item, review with quality rating, get due items, list all, get stats, or delete",
        },
        user_id: { type: "string", description: "User ID" },
        front: { type: "string", description: "Question/prompt (for add)" },
        back: { type: "string", description: "Answer/detail (for add)" },
        category: { type: "string", description: "Category tag (for add/list)" },
        item_id: { type: "string", description: "Item ID (for review/delete)" },
        quality: { type: "number", description: "Review quality 0-5: 0=blackout, 3=difficult, 5=perfect (for review)" },
        limit: { type: "number", description: "Max items to return (for due/list)" },
      },
      required: ["action", "user_id"],
    },
  },

  // ===== Struggle Detection =====
  {
    name: "struggle_detection",
    description: "Monitors user interaction to detect struggle/confusion and adaptively adjust difficulty. Returns difficulty level, hint progression, and prompt modifiers. Process messages to update state, or query current adjustment.",
    input_schema: {
      type: "object",
      properties: {
        action: {
          type: "string",
          enum: ["process", "get_adjustment", "get_state", "reset", "struggle_topics"],
          description: "Action to perform",
        },
        user_id: { type: "string", description: "User ID" },
        message: { type: "string", description: "User message to analyze (for process)" },
        topic: { type: "string", description: "Current topic context" },
        response_time_ms: { type: "number", description: "User's response time in ms" },
      },
      required: ["action", "user_id"],
    },
  },

  // === New v2.7 tools ===

  {
    name: "gif_search",
    description: "Search for GIFs using Tenor, Giphy, or DuckDuckGo fallback. Returns GIF URLs, titles, and dimensions. Great for reactions, memes, and visual responses.",
    input_schema: {
      type: "object" as const,
      properties: {
        query: { type: "string", description: "Search query (e.g., 'happy dance', 'thumbs up', 'mind blown')" },
        provider: { type: "string", enum: ["tenor", "giphy", "auto"], description: "GIF provider (default: auto)" },
        limit: { type: "number", description: "Number of results (default: 5, max: 20)" },
        rating: { type: "string", enum: ["g", "pg", "pg-13", "r"], description: "Content rating (default: pg)" },
      },
      required: ["query"],
    },
  },
  {
    name: "places_lookup",
    description: "Search for places, geocode addresses, find nearby points of interest, and get driving directions. Uses OpenStreetMap (free, no API key).",
    input_schema: {
      type: "object" as const,
      properties: {
        action: { type: "string", enum: ["search", "geocode", "reverse_geocode", "nearby", "directions"], description: "Action to perform" },
        query: { type: "string", description: "Place name or address (for search/geocode)" },
        lat: { type: "number", description: "Latitude" },
        lon: { type: "number", description: "Longitude" },
        dest_lat: { type: "number", description: "Destination latitude (for directions)" },
        dest_lon: { type: "number", description: "Destination longitude (for directions)" },
        dest_query: { type: "string", description: "Destination as address (for directions)" },
        category: { type: "string", enum: ["restaurant", "hotel", "cafe", "hospital", "pharmacy", "gas_station", "parking", "atm", "supermarket", "school", "any"], description: "POI category (for nearby)" },
        radius: { type: "number", description: "Search radius in meters (for nearby, default: 1000)" },
        limit: { type: "number", description: "Max results (default: 10)" },
      },
      required: ["action"],
    },
  },
  {
    name: "spotify_cli",
    description: "Natural language Spotify controller. Parse commands like 'play Radiohead', 'skip', 'what's playing', 'volume 50', 'shuffle on', 'queue Bohemian Rhapsody'.",
    input_schema: {
      type: "object" as const,
      properties: {
        command: { type: "string", description: "Natural language command (e.g., 'play artist Radiohead', 'skip', 'volume 80', 'shuffle on')" },
      },
      required: ["command"],
    },
  },
  {
    name: "token_dashboard",
    description: "View a dashboard of token usage, costs, model tier breakdown, estimated monthly spend, top tool usage, error rates, and system uptime.",
    input_schema: {
      type: "object" as const,
      properties: {
        period: { type: "string", enum: ["hour", "day", "week", "month", "all"], description: "Time period (default: day)" },
        format: { type: "string", enum: ["summary", "detailed", "prometheus"], description: "Output format (default: summary)" },
      },
    },
  },
  {
    name: "terminal_agent",
    description: "Execute terminal commands via the desktop WebSocket bridge (local execution) or server fallback. Supports shell selection, working directory, and timeout.",
    input_schema: {
      type: "object" as const,
      properties: {
        command: { type: "string", description: "Shell command to execute" },
        shell: { type: "string", enum: ["bash", "powershell", "cmd"], description: "Shell to use (default: auto-detect)" },
        cwd: { type: "string", description: "Working directory" },
        timeout: { type: "number", description: "Timeout in ms (default: 30000)" },
        prefer_local: { type: "boolean", description: "Prefer local desktop execution (default: true)" },
      },
      required: ["command"],
    },
  },
  {
    name: "camera_monitor",
    description: "Capture from webcams, RTSP streams, or Home Assistant cameras. Supports single capture, burst mode, motion detection, and device listing.",
    input_schema: {
      type: "object" as const,
      properties: {
        action: { type: "string", enum: ["capture", "burst", "snapshot_rtsp", "snapshot_ha", "list_devices", "motion_detect", "capabilities"], description: "Action to perform" },
        device: { type: "string", description: "Webcam device ID" },
        rtsp_url: { type: "string", description: "RTSP stream URL" },
        entity_id: { type: "string", description: "Home Assistant camera entity_id" },
        resolution: { type: "string", description: "Resolution as WxH (e.g., '1920x1080')" },
        format: { type: "string", enum: ["png", "jpg", "webp"], description: "Output format (default: jpg)" },
        frame_count: { type: "number", description: "Frames for burst mode (default: 5)" },
        duration: { type: "number", description: "Duration in seconds for motion detection" },
        threshold: { type: "number", description: "Motion sensitivity 0-1 (default: 0.1)" },
      },
      required: ["action"],
    },
  },
  {
    name: "google_services",
    description: "Interact with Google Workspace: Gmail (read, send, search), Google Calendar (events, create), Google Drive (list, upload, download). Requires Google OAuth2.",
    input_schema: {
      type: "object" as const,
      properties: {
        service: { type: "string", enum: ["gmail", "calendar", "drive"], description: "Google service" },
        action: { type: "string", enum: ["list", "read", "send", "search", "reply", "labels", "events", "create_event", "update_event", "delete_event", "list_files", "search_files", "upload", "download", "share"], description: "Action to perform" },
        query: { type: "string", description: "Search query" },
        to: { type: "string", description: "Recipient email" },
        subject: { type: "string", description: "Email subject" },
        body: { type: "string", description: "Email body or event description" },
        message_id: { type: "string", description: "Email message ID" },
        event_id: { type: "string", description: "Calendar event ID" },
        file_id: { type: "string", description: "Drive file ID" },
        calendar_id: { type: "string", description: "Calendar ID (default: primary)" },
        start_time: { type: "string", description: "Event start (ISO 8601)" },
        end_time: { type: "string", description: "Event end (ISO 8601)" },
        title: { type: "string", description: "Event title or file name" },
        file_path: { type: "string", description: "Local file path" },
        limit: { type: "number", description: "Max results (default: 20)" },
      },
      required: ["service", "action"],
    },
  },
  // ── Crypto Exchange Trading Tool ───────────────────────────────────────
  {
    name: "crypto_exchange",
    description:
      "Trade cryptocurrencies on Coinbase and Binance. Check balances, place orders (with safety preview), cancel orders, view order history, fills, and ticker data. Orders require confirmation by default — first call returns a preview, second with confirmed=true executes.",
    input_schema: {
      type: "object" as const,
      properties: {
        action: {
          type: "string",
          enum: ["balances", "place_order", "cancel_order", "order_status", "order_history", "fills", "ticker"],
          description: "Action to perform",
        },
        exchange: {
          type: "string",
          enum: ["coinbase", "binance"],
          description: "Exchange to use",
        },
        symbol: { type: "string", description: "Trading pair (e.g., 'BTC/USDT', 'ETH-USD')" },
        side: { type: "string", enum: ["buy", "sell"], description: "Order side" },
        order_type: { type: "string", enum: ["market", "limit", "stop_limit"], description: "Order type" },
        quantity: { type: "number", description: "Order quantity" },
        price: { type: "number", description: "Limit price (required for limit/stop_limit)" },
        stop_price: { type: "number", description: "Stop price (for stop_limit orders)" },
        confirmed: { type: "boolean", description: "Set to true to execute order (default: preview only)" },
        order_id: { type: "string", description: "Order ID for status/cancel" },
        limit: { type: "number", description: "Max results (default: 50)" },
      },
      required: ["action"],
    },
  },
  // ── DeFi Data Tool ─────────────────────────────────────────────────────
  {
    name: "defi_data",
    description:
      "Access DeFi data from DeFiLlama — TVL rankings, protocol details, chain TVL, yield/APY pools, stablecoin data, and token prices. No API key required for basic data.",
    input_schema: {
      type: "object" as const,
      properties: {
        action: {
          type: "string",
          enum: ["protocols", "protocol", "chains", "chain_tvl", "yields", "stablecoins", "token_prices", "summary"],
          description: "Action to perform",
        },
        slug: { type: "string", description: "Protocol slug (e.g., 'aave', 'uniswap') for 'protocol' action" },
        chain: { type: "string", description: "Chain name (e.g., 'Ethereum', 'BSC') for filtering" },
        stablecoin: { type: "boolean", description: "Filter yields to stablecoin pools only" },
        tokens: { type: "array", items: { type: "string" }, description: "Token contract addresses for price lookup" },
        limit: { type: "number", description: "Max results (default varies by action)" },
      },
      required: ["action"],
    },
  },
  // ── On-Chain Analytics Tool ────────────────────────────────────────────
  {
    name: "onchain_analytics",
    description:
      "Ethereum on-chain analytics via Etherscan and Alchemy. Check wallet balances, transaction history, token transfers, token balances, gas prices, and asset transfers. Supports wallet summaries combining all data sources.",
    input_schema: {
      type: "object" as const,
      properties: {
        action: {
          type: "string",
          enum: ["balance", "transactions", "token_transfers", "token_balances", "gas", "asset_transfers", "wallet_summary"],
          description: "Action to perform",
        },
        address: { type: "string", description: "Ethereum address (0x...)" },
        contract_address: { type: "string", description: "Filter token transfers by contract" },
        page: { type: "number", description: "Page number (default: 1)" },
        offset: { type: "number", description: "Results per page (default: 50)" },
        sort: { type: "string", enum: ["asc", "desc"], description: "Sort order (default: desc)" },
      },
      required: ["action"],
    },
  },
  // ── Order Book Tool ────────────────────────────────────────────────────
  {
    name: "order_book",
    description:
      "Real-time order book data from Binance and Coinbase (public, no auth). View bid/ask depth, aggregated books across exchanges, spread analysis, depth visualization, and detect large order walls.",
    input_schema: {
      type: "object" as const,
      properties: {
        action: {
          type: "string",
          enum: ["book", "aggregated", "depth", "spread", "walls"],
          description: "Action to perform",
        },
        symbol: { type: "string", description: "Trading pair (e.g., 'BTC/USDT', 'ETH-USD')" },
        exchange: { type: "string", enum: ["binance", "coinbase"], description: "Exchange (for 'book' and 'spread')" },
        limit: { type: "number", description: "Order book depth (default: 100)" },
        threshold: { type: "number", description: "Wall detection threshold multiplier (default: 3x average)" },
      },
      required: ["action", "symbol"],
    },
  },
  // ── Backtesting Tool ───────────────────────────────────────────────────
  {
    name: "backtest",
    description:
      "Backtest trading strategies against historical data. Built-in strategies: SMA Crossover, RSI, Momentum, Mean Reversion. Compare multiple strategies, view performance metrics (Sharpe ratio, max drawdown, win rate, profit factor). Use with research_market to get historical price data first.",
    input_schema: {
      type: "object" as const,
      properties: {
        action: {
          type: "string",
          enum: ["run", "compare", "strategies"],
          description: "Action: 'run' single backtest, 'compare' multiple strategies, 'strategies' list available",
        },
        symbol: { type: "string", description: "Asset symbol (e.g., 'bitcoin', 'AAPL')" },
        asset_type: { type: "string", enum: ["crypto", "stock"], description: "Asset type" },
        strategy: { type: "string", description: "Strategy name: sma_crossover, rsi, momentum, mean_reversion" },
        strategies: { type: "array", items: { type: "string" }, description: "Strategy names for comparison" },
        days: { type: "number", description: "Backtest period in days (default: 90)" },
        initial_capital: { type: "number", description: "Starting capital (default: 10000)" },
        fee_rate: { type: "number", description: "Fee rate per trade (default: 0.001 = 0.1%)" },
        params: { type: "object", description: "Strategy parameters override (e.g., {shortPeriod: 5, longPeriod: 20})" },
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
            const meetings = listMeetings({ tag: (input.tags as string[] | undefined)?.[0] });
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
          action: input.action as "search" | "neighbors" | "path" | "communities" | "cypher" | "duplicates" | "merge",
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
          action: input.action as "financial_flow" | "network_analysis" | "timeline" | "report",
          entity_id: input.entity_id as string | undefined,
          options: input.options as Record<string, unknown> | undefined,
        });
        return { success: true, result };
      }

      // ===== Integration Adapter Framework =====
      case "integration_execute": {
        const result = await integrationRegistry.executeAction(
          input.integration as string,
          input.action as string,
          input.input
        );
        return { success: true, result };
      }

      case "integration_auth": {
        const auth = await integrationRegistry.authenticate(
          input.integration as string,
          input.credentials as Record<string, string>
        );
        return { success: true, result: { authenticated: true, expiresAt: auth.expiresAt } };
      }

      case "integration_list": {
        const category = input.category as string | undefined;
        const integrations = category
          ? integrationRegistry.listByCategory(category).map((a) => a.metadata)
          : integrationRegistry.list();
        return { success: true, result: integrations };
      }

      // ===== Logic Rule Automation Engine =====
      case "automation_rule": {
        const action = input.action as string;
        switch (action) {
          case "create": {
            const rule = createRule(input.rule as any);
            return { success: true, result: rule };
          }
          case "get": {
            const rule = getRule(input.id as string);
            return { success: true, result: rule };
          }
          case "update": {
            const rule = updateRule(input.id as string, input.rule as any);
            return { success: true, result: rule };
          }
          case "delete": {
            const deleted = deleteRule(input.id as string);
            return { success: true, result: { deleted } };
          }
          case "list": {
            const rules = listRules(input as any);
            return { success: true, result: rules };
          }
          case "process_trigger": {
            const triggerResult = await processTrigger(
              input.trigger as RuleTrigger,
              (input.context as Record<string, unknown>) || {}
            );
            return { success: true, result: triggerResult };
          }
          case "import": {
            const imported = importRules(input.rules as any[]);
            return { success: true, result: { imported: imported.length } };
          }
          case "export": {
            return { success: true, result: exportRules() };
          }
          default:
            return { success: false, result: null, error: `Unknown automation_rule action: ${action}` };
        }
      }

      // ===== Approval Workflow Engine =====
      case "approval_workflow": {
        const action = input.action as string;
        switch (action) {
          case "submit": {
            const result = await submitForApproval({
              entityType: input.entity_type as string,
              entityId: input.entity_id as string,
              requesterId: input.user_id as string,
              entityData: input.entity_data as Record<string, unknown>,
            });
            return { success: true, result };
          }
          case "approve":
          case "reject": {
            const result = await processApproval(
              input.request_id as string,
              action === "approve" ? "approved" : "rejected",
              input.comments as string | undefined,
              input.user_id as string
            );
            return { success: true, result };
          }
          case "pending": {
            return { success: true, result: getPendingApprovals(input.user_id as string) };
          }
          case "history": {
            return { success: true, result: getApprovalHistory(input.entity_type as string, input.entity_id as string) };
          }
          case "add_rule": {
            const rule = addApprovalRule(input.rule as any);
            return { success: true, result: rule };
          }
          case "remove_rule": {
            return { success: true, result: { removed: removeApprovalRule(input.id as string) } };
          }
          case "list_rules": {
            return { success: true, result: listApprovalRules(input.entity_type as string) };
          }
          default:
            return { success: false, result: null, error: `Unknown approval action: ${action}` };
        }
      }

      // ===== Enhanced RAG Pipeline =====
      case "rag_pipeline": {
        const action = input.action as string;
        switch (action) {
          case "add": {
            const docs = await ragPipeline.addDocument(
              input.content as string,
              (input.metadata as Record<string, unknown>) || {},
              input.chunk_size ? { chunkSize: input.chunk_size as number, chunkOverlap: 50 } : undefined
            );
            return { success: true, result: { added: docs.length, ids: docs.map((d) => d.id) } };
          }
          case "search": {
            const results = await ragPipeline.search(input.query as string, {
              topK: input.top_k as number,
            });
            return { success: true, result: results.map((r) => ({ content: r.document.content, score: r.score, matchType: r.matchType, metadata: r.document.metadata })) };
          }
          case "search_vector": {
            const results = await ragPipeline.searchVector(input.query as string, input.top_k as number);
            return { success: true, result: results.map((r) => ({ content: r.document.content, score: r.score })) };
          }
          case "search_keyword": {
            const results = ragPipeline.searchKeyword(input.query as string, input.top_k as number);
            return { success: true, result: results.map((r) => ({ content: r.document.content, score: r.score })) };
          }
          case "clear": {
            ragPipeline.clear();
            return { success: true, result: { cleared: true } };
          }
          case "stats": {
            return { success: true, result: { documentCount: ragPipeline.size } };
          }
          default:
            return { success: false, result: null, error: `Unknown rag_pipeline action: ${action}` };
        }
      }

      // ===== Risk Engine =====
      case "risk_evaluate": {
        const action = input.action as string;
        switch (action) {
          case "evaluate": {
            const decision = await riskEngine.evaluate(input.context as any);
            return { success: true, result: decision };
          }
          case "config": {
            if (input.config) riskEngine.updateConfig(input.config as any);
            return { success: true, result: riskEngine.getConfig() };
          }
          case "audit": {
            return { success: true, result: riskEngine.getAuditLog(input.limit as number) };
          }
          case "block_tool": {
            riskEngine.blockTool(input.tool_name as string);
            return { success: true, result: { blocked: input.tool_name } };
          }
          case "unblock_tool": {
            riskEngine.unblockTool(input.tool_name as string);
            return { success: true, result: { unblocked: input.tool_name } };
          }
          case "safe_mode": {
            if (input.enabled) riskEngine.enableSafeMode();
            else riskEngine.disableSafeMode();
            return { success: true, result: { safeMode: input.enabled } };
          }
          case "kill_switch": {
            if (input.enabled) riskEngine.activateKillSwitch();
            else riskEngine.deactivateKillSwitch();
            return { success: true, result: { killSwitch: input.enabled } };
          }
          default:
            return { success: false, result: null, error: `Unknown risk action: ${action}` };
        }
      }

      // ===== Graph RAG =====
      case "graph_rag": {
        const action = input.action as string;
        switch (action) {
          case "ingest": {
            const doc = await graphRAG.ingestDocument(
              input.content as string,
              (input.metadata as Record<string, unknown>) || {}
            );
            return { success: true, result: { documentId: doc.id, entities: doc.entities.length, category: doc.category } };
          }
          case "search": {
            const results = await graphRAG.search(input.query as string, {
              maxHops: input.max_hops as number,
            });
            return { success: true, result: results };
          }
          case "traverse": {
            const traversal = graphRAG.traverse(input.entity_id as string, input.max_hops as number);
            return { success: true, result: traversal };
          }
          case "entity": {
            const entity = graphRAG.getEntity(input.entity_id as string);
            return { success: true, result: entity };
          }
          case "stats": {
            return { success: true, result: graphRAG.getStats() };
          }
          default:
            return { success: false, result: null, error: `Unknown graph_rag action: ${action}` };
        }
      }

      // ===== Strategy Orchestrator =====
      case "strategy_orchestrator": {
        const action = input.action as string;
        switch (action) {
          case "list": {
            return { success: true, result: strategyOrchestrator.list() };
          }
          case "run_one": {
            const result = await strategyOrchestrator.runOne(input.strategy_name as string, {
              query: input.query as string,
              parameters: (input.parameters as Record<string, unknown>) || {},
            });
            return { success: true, result };
          }
          case "run_all": {
            const results = await strategyOrchestrator.runAll(
              { query: input.query as string, parameters: (input.parameters as Record<string, unknown>) || {} },
              { timeoutMs: input.timeout_ms as number }
            );
            return { success: true, result: results };
          }
          default:
            return { success: false, result: null, error: `Unknown strategy action: ${action}` };
        }
      }

      // ===== Pattern Analyzer =====
      case "pattern_analyzer": {
        const action = input.action as string;
        switch (action) {
          case "record": {
            const event = input.event as any;
            patternAnalyzer.recordEvent({
              type: event.type,
              action: event.action,
              userId: event.userId || input.user_id as string,
              timestamp: new Date(),
              metadata: event.metadata || {},
              correction: event.correction,
            });
            return { success: true, result: { recorded: true } };
          }
          case "analyze": {
            const patterns = patternAnalyzer.analyzePatterns(input.user_id as string);
            return { success: true, result: patterns };
          }
          case "predict": {
            const predictions = patternAnalyzer.predict(
              input.user_id as string,
              (input.context as Record<string, unknown>) || {}
            );
            return { success: true, result: predictions };
          }
          case "detect_anomaly": {
            const anomaly = patternAnalyzer.detectAnomaly(input.event as any);
            return { success: true, result: anomaly };
          }
          case "patterns": {
            return { success: true, result: patternAnalyzer.getPatterns(input.user_id as string) };
          }
          case "corrections": {
            return { success: true, result: patternAnalyzer.getCorrections() };
          }
          case "stats": {
            return { success: true, result: patternAnalyzer.getStats() };
          }
          default:
            return { success: false, result: null, error: `Unknown pattern action: ${action}` };
        }
      }

      // ===== Event Bus =====
      case "event_bus": {
        const action = input.action as string;
        switch (action) {
          case "emit": {
            await eventBus.emit(
              input.event_type as string,
              input.payload || {},
              { source: "tool" }
            );
            return { success: true, result: { emitted: true } };
          }
          case "history": {
            return { success: true, result: eventBus.getHistory(input.limit as number) };
          }
          case "replay": {
            const count = await eventBus.replay({
              eventType: input.event_type as string,
              since: input.since ? new Date(input.since as string) : undefined,
            });
            return { success: true, result: { replayed: count } };
          }
          case "dead_letters": {
            return { success: true, result: eventBus.getDeadLetters(input.limit as number) };
          }
          case "stats": {
            return { success: true, result: eventBus.getStats() };
          }
          default:
            return { success: false, result: null, error: `Unknown event_bus action: ${action}` };
        }
      }

      // ===== Auto-Responder =====
      case "auto_responder": {
        const action = input.action as string;
        switch (action) {
          case "add_rule": {
            const rule = autoResponder.addRule(input.rule as any);
            return { success: true, result: rule };
          }
          case "remove_rule": {
            return { success: true, result: { removed: autoResponder.removeRule(input.rule_id as string) } };
          }
          case "update_rule": {
            const updated = autoResponder.updateRule(input.rule_id as string, input.rule as any);
            return { success: true, result: updated };
          }
          case "list_rules": {
            return { success: true, result: autoResponder.listRules() };
          }
          case "process": {
            const response = await autoResponder.processMessage({
              message: input.message as string,
              channel: input.channel as string,
              userId: input.user_id as string,
            });
            return { success: true, result: response };
          }
          default:
            return { success: false, result: null, error: `Unknown auto_responder action: ${action}` };
        }
      }

      // ===== DAG Workflow Engine =====
      case "dag_workflow": {
        const action = input.action as string;
        switch (action) {
          case "create": {
            const wf = dagEngine.createWorkflow(input.workflow as any);
            return { success: true, result: { id: wf.id, name: wf.name } };
          }
          case "execute": {
            const execution = await dagEngine.execute(
              input.workflow_id as string,
              (input.trigger_data as Record<string, unknown>) || {}
            );
            return { success: true, result: execution };
          }
          case "get": {
            return { success: true, result: dagEngine.getWorkflow(input.workflow_id as string) };
          }
          case "list": {
            return { success: true, result: dagEngine.listWorkflows().map((w) => ({ id: w.id, name: w.name, description: w.description })) };
          }
          case "delete": {
            return { success: true, result: { deleted: dagEngine.deleteWorkflow(input.workflow_id as string) } };
          }
          case "executions": {
            return { success: true, result: dagEngine.getExecutions(input.workflow_id as string) };
          }
          default:
            return { success: false, result: null, error: `Unknown dag_workflow action: ${action}` };
        }
      }

      // ===== Crypto Utilities =====
      case "crypto_utils": {
        const action = input.action as string;
        switch (action) {
          case "encrypt": {
            const encrypted = encrypt(input.plaintext as string, input.password as string);
            return { success: true, result: { encrypted } };
          }
          case "decrypt": {
            const decrypted = decrypt(input.ciphertext as string, input.password as string);
            return { success: true, result: { decrypted } };
          }
          case "sign_webhook": {
            const sig = signWebhook(input.payload as string, input.secret as string);
            return { success: true, result: { signature: sig } };
          }
          case "verify_webhook": {
            const valid = verifyWebhookSignature(input.payload as string, input.signature as string, input.secret as string);
            return { success: true, result: { valid } };
          }
          case "generate_api_key": {
            return { success: true, result: { apiKey: generateApiKey(input.prefix as string) } };
          }
          default:
            return { success: false, result: null, error: `Unknown crypto action: ${action}` };
        }
      }

      // ===== Audit Trail =====
      case "audit_trail": {
        const action = input.action as string;
        switch (action) {
          case "log": {
            const entry = logAuditAction(
              input.log_action as string,
              input.entity as string,
              input.entity_id as string,
              input.user_id as string,
              input.metadata as Record<string, unknown>
            );
            return { success: true, result: entry };
          }
          case "query": {
            return { success: true, result: queryAudit(input as any) };
          }
          case "entity_trail": {
            return { success: true, result: queryAudit({ entity: input.entity as string, entityId: input.entity_id as string }) };
          }
          case "user_actions": {
            return { success: true, result: queryAudit({ userId: input.user_id as string, limit: input.limit as number }) };
          }
          case "stats": {
            return { success: true, result: getAuditStats() };
          }
          case "export": {
            return { success: true, result: exportAuditLog(input as any) };
          }
          default:
            return { success: false, result: null, error: `Unknown audit action: ${action}` };
        }
      }

      // ===== Multi-Device Sync =====
      case "device_sync": {
        const action = input.action as string;
        switch (action) {
          case "upsert": {
            const doc = syncEngine.upsert(input.document_id as string, input.data as Record<string, unknown>);
            return { success: true, result: doc };
          }
          case "get": {
            return { success: true, result: syncEngine.get(input.document_id as string) };
          }
          case "delete": {
            return { success: true, result: { deleted: syncEngine.delete(input.document_id as string) } };
          }
          case "receive_remote": {
            const result = syncEngine.receiveRemote(input.remote_document as any);
            return { success: true, result };
          }
          case "changes_since": {
            const changes = syncEngine.getChangedSince(new Date(input.since as string));
            return { success: true, result: changes };
          }
          case "conflicts": {
            return { success: true, result: syncEngine.getConflicts() };
          }
          case "resolve_conflict": {
            const resolved = syncEngine.resolveManualConflict(
              input.document_id as string,
              input.resolved_data as Record<string, unknown>
            );
            return { success: true, result: resolved };
          }
          case "stats": {
            return { success: true, result: syncEngine.getStats() };
          }
          default:
            return { success: false, result: null, error: `Unknown sync action: ${action}` };
        }
      }

      // ===== Spotify =====
      case "spotify": {
        const spotify = getSpotifyClient();
        const action = input.action as string;

        if (!spotify.isAuthenticated() && action !== "devices") {
          return {
            success: false,
            result: {
              needsAuth: true,
              authUrl: spotify.getAuthorizationUrl(),
              message: "Spotify not authenticated. Direct the user to the authorization URL to connect their Spotify account.",
            },
          };
        }

        switch (action) {
          case "play": {
            const query = input.query as string;
            const type = (input.type as string) || "track";
            if (!query) {
              await spotify.player.play();
              return { success: true, result: { message: "Playback resumed" } };
            }
            if (type === "track") {
              const track = await spotify.playTrackByName(query, input.device_id as string | undefined);
              return { success: true, result: { message: `Now playing: ${track.name} by ${track.artists.map((a: any) => a.name).join(", ")}`, track: { name: track.name, artists: track.artists.map((a: any) => a.name), album: (track as any).album?.name } } };
            } else if (type === "album") {
              const album = await spotify.playAlbumByName(query, input.device_id as string | undefined);
              return { success: true, result: { message: `Now playing album: ${album.name}`, album: { name: album.name, artists: album.artists.map((a: any) => a.name) } } };
            } else if (type === "artist") {
              const artist = await spotify.playArtistByName(query, input.device_id as string | undefined);
              return { success: true, result: { message: `Now playing: ${artist.name}`, artist: { name: artist.name } } };
            } else if (type === "playlist") {
              const playlist = await spotify.playPlaylistByName(query, input.device_id as string | undefined);
              return { success: true, result: { message: `Now playing playlist: ${playlist.name}`, playlist: { name: playlist.name } } };
            }
            return { success: false, result: null, error: `Unknown play type: ${type}` };
          }
          case "pause":
            await spotify.player.pause();
            return { success: true, result: { message: "Playback paused" } };
          case "next":
            await spotify.player.next();
            return { success: true, result: { message: "Skipped to next track" } };
          case "previous":
            await spotify.player.previous();
            return { success: true, result: { message: "Playing previous track" } };
          case "now_playing": {
            const np = await spotify.getNowPlaying();
            if (!np || !np.track) return { success: true, result: { isPlaying: false, message: "Nothing is currently playing" } };
            return {
              success: true,
              result: {
                isPlaying: np.isPlaying,
                track: { name: np.track.name, artists: (np.track as any).artists?.map((a: any) => a.name) || [] },
                progress: np.progress,
                device: np.device ? { name: np.device.name, type: np.device.type, volume: np.device.volume_percent } : null,
                shuffle: np.shuffle,
                repeat: np.repeat,
              },
            };
          }
          case "search": {
            if (!input.query) return { success: false, result: null, error: "'query' required" };
            const type = (input.type as string) || "track";
            const limit = (input.limit as number) || 10;
            const results = await spotify.search.search(input.query as string, [type as any], { limit });
            const key = `${type}s`;
            const items = (results as any)[key]?.items || [];
            return {
              success: true,
              result: {
                type,
                query: input.query,
                count: items.length,
                results: items.slice(0, limit).map((item: any) => ({
                  name: item.name,
                  id: item.id,
                  uri: item.uri,
                  artists: item.artists?.map((a: any) => a.name),
                  album: item.album?.name,
                  popularity: item.popularity,
                })),
              },
            };
          }
          case "queue": {
            if (input.query) {
              const track = await spotify.queueTrackByName(input.query as string, input.device_id as string | undefined);
              return { success: true, result: { message: `Added to queue: ${track.name}`, track: { name: track.name } } };
            }
            const queue = await spotify.player.getQueue();
            return {
              success: true,
              result: {
                currentlyPlaying: queue.currently_playing ? { name: (queue.currently_playing as any).name } : null,
                queue: (queue.queue || []).slice(0, 10).map((t: any) => ({ name: t.name, artists: t.artists?.map((a: any) => a.name) })),
              },
            };
          }
          case "volume":
            if (input.volume === undefined) return { success: false, result: null, error: "'volume' required (0-100)" };
            await spotify.player.setVolume(input.volume as number, input.device_id as string | undefined);
            return { success: true, result: { message: `Volume set to ${input.volume}%` } };
          case "shuffle":
            await spotify.player.setShuffle(input.state !== false, input.device_id as string | undefined);
            return { success: true, result: { message: `Shuffle ${input.state !== false ? "on" : "off"}` } };
          case "repeat":
            await spotify.player.setRepeat((input.repeat_mode as any) || "off", input.device_id as string | undefined);
            return { success: true, result: { message: `Repeat set to ${input.repeat_mode || "off"}` } };
          case "devices": {
            const devices = await spotify.player.getDevices();
            return { success: true, result: { devices: devices.map((d) => ({ id: d.id, name: d.name, type: d.type, active: d.is_active, volume: d.volume_percent })) } };
          }
          case "playlists": {
            const playlists = await spotify.playlists.getMyPlaylists({ limit: (input.limit as number) || 20 });
            return {
              success: true,
              result: {
                count: playlists.total,
                playlists: playlists.items.map((p) => ({ id: p.id, name: p.name, tracks: p.tracks?.total, owner: p.owner?.display_name, public: p.public })),
              },
            };
          }
          case "create_playlist": {
            if (!input.playlist_name) return { success: false, result: null, error: "'playlist_name' required" };
            const pl = await spotify.playlists.createMyPlaylist({
              name: input.playlist_name as string,
              description: input.playlist_description as string | undefined,
              public: false,
            });
            return { success: true, result: { message: `Playlist created: ${pl.name}`, id: pl.id, name: pl.name } };
          }
          case "like": {
            const liked = await spotify.likeCurrentTrack();
            return liked
              ? { success: true, result: { message: `Liked: ${liked.name}`, track: { name: liked.name } } }
              : { success: false, result: null, error: "Nothing is currently playing" };
          }
          case "profile": {
            const profile = await spotify.getMusicProfile();
            return {
              success: true,
              result: {
                topArtists: profile.topArtists.slice(0, 5).map((a) => a.name),
                topTracks: profile.topTracks.slice(0, 5).map((t) => `${t.name} - ${t.artists.map((a: any) => a.name).join(", ")}`),
                topGenres: profile.topGenres.slice(0, 10),
                savedTracks: profile.savedTracksCount,
                playlists: profile.playlistCount,
              },
            };
          }
          case "recommendations": {
            const playlist = await spotify.createRecommendedPlaylist(
              input.playlist_name as string || "OpenSentinel Recommendations",
              { limit: (input.limit as number) || 20 }
            );
            return { success: true, result: { message: `Recommendation playlist created: ${playlist.name}`, id: playlist.id, tracks: playlist.tracks?.total } };
          }
          default:
            return { success: false, result: null, error: `Unknown spotify action: ${action}` };
        }
      }

      // ===== Twilio SMS/Voice =====
      case "twilio": {
        if (!twilioService.isConfigured()) {
          return { success: false, result: null, error: "Twilio not configured. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER in .env" };
        }
        const action = input.action as string;
        switch (action) {
          case "send_sms": {
            if (!input.to || !input.body) return { success: false, result: null, error: "'to' and 'body' required" };
            const result = await twilioService.sendSMS({ to: input.to as string, body: input.body as string });
            return {
              success: result.success,
              result: result.success
                ? { message: `SMS sent to ${input.to}`, sid: result.messageSid, status: result.status }
                : null,
              error: result.error,
            };
          }
          case "send_mms": {
            if (!input.to || !input.body || !input.media_urls) return { success: false, result: null, error: "'to', 'body', and 'media_urls' required" };
            const result = await twilioService.sendMMS(input.to as string, input.body as string, input.media_urls as string[]);
            return {
              success: result.success,
              result: result.success ? { message: `MMS sent to ${input.to}`, sid: result.messageSid } : null,
              error: result.error,
            };
          }
          case "make_call": {
            if (!input.to || !input.message) return { success: false, result: null, error: "'to' and 'message' required" };
            const result = await makeCallWithTTS(input.to as string, input.message as string);
            return {
              success: result.success,
              result: result.success ? { message: `Call initiated to ${input.to}`, sid: result.callSid, status: result.status } : null,
              error: result.error,
            };
          }
          case "call_status": {
            if (!input.call_sid) return { success: false, result: null, error: "'call_sid' required" };
            const result = await getCallStatus(input.call_sid as string);
            return { success: result.success, result: result.success ? { sid: result.callSid, status: result.status } : null, error: result.error };
          }
          case "end_call": {
            if (!input.call_sid) return { success: false, result: null, error: "'call_sid' required" };
            const result = await endCall(input.call_sid as string);
            return { success: result.success, result: result.success ? { message: "Call ended", sid: result.callSid } : null, error: result.error };
          }
          case "message_status": {
            if (!input.message_sid) return { success: false, result: null, error: "'message_sid' required" };
            const { getMessageStatus } = await import("../integrations/twilio/sms");
            const result = await getMessageStatus(input.message_sid as string);
            return { success: result.success, result: result.success ? { sid: result.messageSid, status: result.status } : null, error: result.error };
          }
          default:
            return { success: false, result: null, error: `Unknown twilio action: ${action}` };
        }
      }

      // ===== Notion =====
      case "notion": {
        // Lazy-init Notion client
        if (!isNotionInitialized()) {
          try { initNotionFromEnv(); } catch (e: any) {
            return { success: false, result: null, error: `Notion not configured: ${e.message}` };
          }
        }
        const action = input.action as string;
        switch (action) {
          case "search": {
            const results = input.query
              ? await notionSearch.searchAll(input.query as string)
              : await notionSearch.getRecentlyEditedPages(input.limit as number || 20);
            return {
              success: true,
              result: {
                count: results.length,
                results: results.slice(0, input.limit as number || 20).map((r: any) => ({
                  id: r.id,
                  title: r.title,
                  type: r.object,
                  url: r.url,
                  lastEdited: r.lastEditedTime,
                })),
              },
            };
          }
          case "get_page": {
            if (!input.page_id) return { success: false, result: null, error: "'page_id' required" };
            const page = await notionPages.getPage(input.page_id as string);
            return { success: true, result: page };
          }
          case "create_page": {
            if (!input.title) return { success: false, result: null, error: "'title' required" };
            const page = await notionPages.createPage({
              title: input.title as string,
              content: input.content as string | undefined,
              parentPageId: input.parent_page_id as string | undefined,
            });
            return { success: true, result: { message: `Page created: ${input.title}`, id: page.id, url: page.url } };
          }
          case "update_page": {
            if (!input.page_id) return { success: false, result: null, error: "'page_id' required" };
            const page = await notionPages.updatePage(input.page_id as string, {
              title: input.title as string | undefined,
              properties: input.properties as Record<string, any> | undefined,
            });
            return { success: true, result: { message: "Page updated", id: page.id } };
          }
          case "append_to_page": {
            if (!input.page_id || !input.content) return { success: false, result: null, error: "'page_id' and 'content' required" };
            await notionPages.appendToPage(input.page_id as string, input.content as string);
            return { success: true, result: { message: "Content appended to page" } };
          }
          case "query_database": {
            if (!input.database_id) return { success: false, result: null, error: "'database_id' required" };
            const results = await notionDatabases.queryDatabase(input.database_id as string, {
              filter: input.filter as any,
              sorts: input.sorts as any,
              pageSize: input.limit as number || 20,
            });
            return {
              success: true,
              result: {
                count: results.results.length,
                hasMore: results.hasMore,
                entries: results.results.map((e: any) => ({ id: e.id, properties: e.properties })),
              },
            };
          }
          case "create_entry": {
            if (!input.database_id || !input.properties) return { success: false, result: null, error: "'database_id' and 'properties' required" };
            const entry = await notionDatabases.createDatabaseEntry({
              databaseId: input.database_id as string,
              properties: input.properties as Record<string, any>,
            });
            return { success: true, result: { message: "Database entry created", id: entry.id } };
          }
          case "list_databases": {
            const dbs = await notionSearch.searchDatabases(input.query as string);
            return {
              success: true,
              result: {
                count: dbs.length,
                databases: dbs.map((d: any) => ({ id: d.id, title: d.title, url: d.url })),
              },
            };
          }
          default:
            return { success: false, result: null, error: `Unknown notion action: ${action}` };
        }
      }

      // ===== Smart Home (Home Assistant) =====
      case "smart_home": {
        const ha = getHomeAssistant();
        const action = input.action as string;

        // Ensure connected
        try { await ha.connect(); } catch (e: any) {
          return { success: false, result: null, error: `Home Assistant connection failed: ${e.message}` };
        }

        switch (action) {
          case "list_devices": {
            const domain = input.domain as string | undefined;
            const entities = domain
              ? await ha.entities.getEntitiesByDomain(domain)
              : await ha.entities.getAllEntities();
            const filtered = input.query
              ? entities.filter((e) => e.entity_id.includes(input.query as string) || String(e.attributes?.friendly_name || "").toLowerCase().includes((input.query as string).toLowerCase()))
              : entities;
            return {
              success: true,
              result: {
                count: filtered.length,
                devices: filtered.slice(0, 50).map((e) => ({
                  entity_id: e.entity_id,
                  name: e.attributes?.friendly_name || e.entity_id,
                  state: e.state,
                  domain: e.entity_id.split(".")[0],
                })),
              },
            };
          }
          case "get_state": {
            if (!input.entity_id) return { success: false, result: null, error: "'entity_id' required" };
            const state = await ha.entities.getEntityFresh(input.entity_id as string);
            return {
              success: true,
              result: {
                entity_id: state.entity_id,
                name: state.attributes?.friendly_name || state.entity_id,
                state: state.state,
                attributes: state.attributes,
                lastChanged: state.last_changed,
              },
            };
          }
          case "control": {
            if (!input.entity_id || !input.service) return { success: false, result: null, error: "'entity_id' and 'service' required" };
            const entityId = input.entity_id as string;
            const domain = entityId.split(".")[0];
            const result = await ha.services.callServiceOnEntities(
              domain,
              input.service as string,
              entityId,
              (input.data as Record<string, unknown>) || {}
            );
            return { success: true, result: { message: `${input.service} called on ${entityId}`, result } };
          }
          case "command": {
            if (!input.command) return { success: false, result: null, error: "'command' required" };
            const result = await ha.executeNaturalLanguage(input.command as string);
            return { success: result.success, result: { message: result.message, entities: result.entities }, error: result.error };
          }
          case "automations": {
            const automations = await ha.automations.getAutomations();
            const filtered = input.query
              ? automations.filter((a) => a.friendlyName.toLowerCase().includes((input.query as string).toLowerCase()))
              : automations;
            return {
              success: true,
              result: {
                count: filtered.length,
                automations: filtered.slice(0, 30).map((a) => ({
                  entity_id: a.entityId,
                  name: a.friendlyName,
                  enabled: a.state === "on",
                  lastTriggered: a.lastTriggered,
                })),
              },
            };
          }
          case "scenes": {
            const scenes = await ha.automations.getScenes();
            return {
              success: true,
              result: {
                count: scenes.length,
                scenes: scenes.map((s) => ({ entity_id: s.entityId, name: s.friendlyName })),
              },
            };
          }
          case "activate_scene": {
            if (!input.entity_id) return { success: false, result: null, error: "'entity_id' required" };
            await ha.automations.activateScene(input.entity_id as string);
            return { success: true, result: { message: `Scene activated: ${input.entity_id}` } };
          }
          case "history": {
            if (!input.entity_id) return { success: false, result: null, error: "'entity_id' required" };
            const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
            const history = await ha.client.getHistory(since, [input.entity_id as string]);
            return { success: true, result: { entity_id: input.entity_id, history: history[0]?.slice(0, 50) || [] } };
          }
          default:
            return { success: false, result: null, error: `Unknown smart_home action: ${action}` };
        }
      }

      // ===== Cloud Storage =====
      case "cloud_storage": {
        const storage = getUnifiedCloudStorage();
        const action = input.action as string;
        const providerMap: Record<string, string> = { google_drive: "gdrive", dropbox: "dropbox" };
        const provider = input.provider ? (providerMap[input.provider as string] || input.provider) as any : undefined;

        switch (action) {
          case "providers": {
            return {
              success: true,
              result: {
                initialized: storage.getInitializedProviders(),
                default: storage.getDefaultProvider(),
              },
            };
          }
          case "list": {
            const result = await storage.listFiles({
              path: input.path as string | undefined,
              pageSize: input.limit as number || 50,
            }, provider);
            return {
              success: true,
              result: {
                count: result.files.length,
                files: result.files.map((f: any) => ({
                  id: f.id,
                  name: f.name,
                  type: f.type,
                  size: f.size,
                  modified: f.modifiedTime,
                  path: f.path,
                })),
              },
            };
          }
          case "search": {
            if (!input.query) return { success: false, result: null, error: "'query' required" };
            const files = await storage.searchFiles(input.query as string, { maxResults: input.limit as number || 20 }, provider);
            return {
              success: true,
              result: {
                count: files.length,
                files: files.map((f: any) => ({ id: f.id, name: f.name, type: f.type, size: f.size, path: f.path })),
              },
            };
          }
          case "upload": {
            if (!input.content || !input.filename) return { success: false, result: null, error: "'content' and 'filename' required" };
            const file = await storage.uploadFile(
              Buffer.from(input.content as string, "utf-8"),
              { name: input.filename as string, parentPath: input.parent_path as string | undefined },
              provider
            );
            return { success: true, result: { message: `Uploaded: ${file.name}`, id: file.id, name: file.name } };
          }
          case "download": {
            if (!input.path) return { success: false, result: null, error: "'path' (file ID) required" };
            const result = await storage.downloadFile(input.path as string, {}, provider);
            const text = result.content.toString("utf-8").slice(0, 100000);
            return { success: true, result: { name: result.name, mimeType: result.mimeType, content: text, truncated: result.content.length > 100000 } };
          }
          case "create_folder": {
            if (!input.folder_name) return { success: false, result: null, error: "'folder_name' required" };
            const folder = await storage.createFolder(input.folder_name as string, { parentPath: input.parent_path as string | undefined }, provider);
            return { success: true, result: { message: `Folder created: ${folder.name}`, id: folder.id } };
          }
          case "delete": {
            if (!input.path) return { success: false, result: null, error: "'path' (file ID) required" };
            await storage.deleteFile(input.path as string, { permanent: false }, provider);
            return { success: true, result: { message: `Deleted: ${input.path}` } };
          }
          case "share": {
            if (!input.path || !input.email) return { success: false, result: null, error: "'path' and 'email' required" };
            const share = await storage.shareFile(input.path as string, {
              access: (input.role as string) === "writer" ? "edit" : "view",
              type: input.email ? "user" : "anyone",
              email: input.email as string,
            }, provider);
            return { success: true, result: { message: `Shared with ${input.email}`, link: share.url } };
          }
          case "quota": {
            const quotas = await storage.getAllStorageQuotas();
            return {
              success: true,
              result: quotas.map((q: any) => ({
                provider: q.provider,
                used: q.used,
                total: q.total,
                usedPercent: q.total > 0 ? Math.round((q.used / q.total) * 100) : 0,
              })),
            };
          }
          default:
            return { success: false, result: null, error: `Unknown cloud_storage action: ${action}` };
        }
      }

      // ===== Calendar =====
      case "calendar": {
        const action = input.action as string;
        const provider = (input.provider as string) || "google";

        if (provider === "ical") {
          if (!input.ical_url) return { success: false, result: null, error: "'ical_url' required for ical provider" };
          const cal = await fetchICalFromUrl(input.ical_url as string);
          switch (action) {
            case "today": {
              const events = getTodaysICalEvents(cal.events);
              return { success: true, result: { count: events.length, events: events.map(formatEvent) } };
            }
            case "upcoming": {
              const events = getUpcomingICalEvents(cal.events, (input.days as number) || 10);
              return { success: true, result: { count: events.length, events: events.map(formatEvent) } };
            }
            default:
              return { success: true, result: { calendarName: cal.name, totalEvents: cal.events.length } };
          }
        }

        if (provider === "outlook") {
          const outlook = getOutlookCalendar();
          switch (action) {
            case "today": {
              const events = await outlook.getTodaysEvents(input.calendar_id as string | undefined);
              return { success: true, result: { provider: "outlook", count: events.length, events: events.map(formatEvent) } };
            }
            case "upcoming": {
              const events = await outlook.getUpcomingEvents((input.days as number) || 7, input.calendar_id as string | undefined);
              return { success: true, result: { provider: "outlook", count: events.length, events: events.map(formatEvent) } };
            }
            case "list_calendars": {
              const calendars = await outlook.listCalendars();
              return { success: true, result: { provider: "outlook", calendars } };
            }
            case "events": {
              const start = input.start_date ? new Date(input.start_date as string) : undefined;
              const end = input.end_date ? new Date(input.end_date as string) : undefined;
              const events = await outlook.getEvents(input.calendar_id as string | undefined, start, end);
              return { success: true, result: { provider: "outlook", count: events.length, events: events.map(formatEvent) } };
            }
            default:
              return { success: false, result: null, error: `Unknown calendar action: ${action}` };
          }
        }

        // Default: Google Calendar
        const gcal = getGoogleCalendar();
        switch (action) {
          case "today": {
            const events = await gcal.getTodaysEvents(input.calendar_id as string | undefined);
            return { success: true, result: { provider: "google", count: events.length, events: events.map(formatEvent) } };
          }
          case "upcoming": {
            const events = await gcal.getUpcomingEvents((input.days as number) || 7, input.calendar_id as string | undefined);
            return { success: true, result: { provider: "google", count: events.length, events: events.map(formatEvent) } };
          }
          case "list_calendars": {
            const calendars = await gcal.listCalendars();
            return { success: true, result: { provider: "google", calendars } };
          }
          case "events": {
            const start = input.start_date ? new Date(input.start_date as string) : undefined;
            const end = input.end_date ? new Date(input.end_date as string) : undefined;
            const events = await gcal.getEvents(input.calendar_id as string | undefined, start, end);
            return { success: true, result: { provider: "google", count: events.length, events: events.map(formatEvent) } };
          }
          default:
            return { success: false, result: null, error: `Unknown calendar action: ${action}` };
        }
      }

      // ===== Persona / Personality =====
      case "persona": {
        const action = input.action as string;
        const userId = (input.user_id as string) || "default";

        switch (action) {
          case "list": {
            const personas = await getUserPersonas(userId);
            return {
              success: true,
              result: {
                count: personas.length,
                personas: personas.map((p: any) => ({ id: p.id, name: p.name, description: p.description, active: p.active })),
              },
            };
          }
          case "activate": {
            if (!input.persona_id) return { success: false, result: null, error: "'persona_id' required" };
            await activatePersona(userId, input.persona_id as string);
            return { success: true, result: { message: `Persona activated: ${input.persona_id}` } };
          }
          case "deactivate": {
            await deactivatePersonas(userId);
            return { success: true, result: { message: "All personas deactivated, reverted to default" } };
          }
          case "create": {
            if (!input.name) return { success: false, result: null, error: "'name' required" };
            const id = await createPersona(userId, {
              name: input.name as string,
              description: input.description as string || "",
              systemPromptModifier: input.description as string || `Respond as ${input.name}`,
              traits: (input.traits as any[]) || [],
            });
            return { success: true, result: { message: `Persona created: ${input.name}`, id } };
          }
          case "delete": {
            if (!input.persona_id) return { success: false, result: null, error: "'persona_id' required" };
            await deletePersona(input.persona_id as string);
            return { success: true, result: { message: `Persona deleted: ${input.persona_id}` } };
          }
          case "current": {
            const active = await getActivePersona(userId);
            if (!active) return { success: true, result: { message: "No persona active, using default" } };
            return { success: true, result: { id: active.id, name: (active as any).name, description: (active as any).description } };
          }
          case "detect_mood": {
            if (!input.message) return { success: false, result: null, error: "'message' required" };
            const mood = detectMood(input.message as string);
            return { success: true, result: mood };
          }
          case "mood_trend": {
            if (!input.messages || !(input.messages as string[]).length) return { success: false, result: null, error: "'messages' array required" };
            const trend = analyzeMoodTrend(input.messages as string[]);
            return { success: true, result: trend };
          }
          case "domain_expert": {
            if (!input.expert_type) return { success: false, result: null, error: "'expert_type' required" };
            const expert = await activateDomainExpert(userId, input.expert_type as any);
            return { success: true, result: { message: `Domain expert activated: ${expert.name}`, expert: { name: expert.name, description: expert.description } } };
          }
          case "list_experts": {
            const experts = listDomainExperts();
            return {
              success: true,
              result: {
                count: experts.length,
                experts: experts.map((e) => ({ type: e.type, name: e.name, description: e.description })),
              },
            };
          }
          default:
            return { success: false, result: null, error: `Unknown persona action: ${action}` };
        }
      }

      // ===== iCal Generation =====
      case "generate_ical": {
        const events = input.events as ICalEvent[];
        if (!events || !Array.isArray(events) || events.length === 0) {
          return { success: false, result: null, error: "At least one event is required" };
        }
        const result = await generateICal(events, input.filename as string | undefined, {
          calendarName: input.calendar_name as string | undefined,
          timezone: input.timezone as string | undefined,
        });
        return {
          success: result.success,
          result: result.success ? { filePath: result.filePath, eventCount: result.eventCount } : null,
          error: result.error,
        };
      }

      // ===== HTML Report =====
      case "generate_report": {
        const sections = input.sections as ReportSection[];
        if (!sections || !Array.isArray(sections)) {
          return { success: false, result: null, error: "'sections' array is required" };
        }
        const result = await generateReport(sections, input.filename as string | undefined, {
          title: input.title as string || "Report",
          subtitle: input.subtitle as string | undefined,
          theme: input.theme as "light" | "dark" | "corporate" | "minimal" | undefined,
          author: input.author as string | undefined,
        });
        return {
          success: result.success,
          result: result.success ? { filePath: result.filePath, message: `Report generated: ${input.title}` } : null,
          error: result.error,
        };
      }

      // ===== Math-to-Speech =====
      case "math_to_speech": {
        if (input.expressions && Array.isArray(input.expressions)) {
          const results = (input.expressions as string[]).map((expr) => ({
            latex: expr,
            spoken: latexToSpeech(expr),
          }));
          return { success: true, result: { conversions: results } };
        }
        if (input.latex) {
          const spoken = latexToSpeech(input.latex as string);
          return { success: true, result: { latex: input.latex, spoken } };
        }
        return { success: false, result: null, error: "Provide 'latex' or 'expressions'" };
      }

      // ===== Tree-of-Thought =====
      case "tree_of_thought": {
        if (!input.problem) return { success: false, result: null, error: "'problem' is required" };
        const config: ToTConfig = {
          maxDepth: input.max_depth as number | undefined,
          branchingFactor: input.branching_factor as number | undefined,
          strategy: input.strategy as "bfs" | "dfs" | undefined,
          maxNodes: input.max_nodes as number | undefined,
          pruneThreshold: input.prune_threshold as number | undefined,
        };
        const result = await treeOfThought(input.problem as string, config);
        return {
          success: result.success,
          result: {
            solution: formatToTResult(result),
            bestScore: result.bestScore,
            nodesExplored: result.allNodes.length,
            llmCalls: result.llmCalls,
            tokensUsed: result.tokensUsed,
            bestPath: result.bestPath.slice(1).map((n) => ({
              thought: n.thought,
              score: n.score,
              evaluation: n.evaluation,
            })),
          },
          error: result.error,
        };
      }

      // ===== Adaptive Feedback =====
      case "adaptive_feedback": {
        const action = input.action as string;
        const uid = input.user_id as string;
        if (!uid) return { success: false, result: null, error: "'user_id' required" };

        switch (action) {
          case "get_profile": {
            const profile = getAdaptiveProfile(uid);
            if (!profile) return { success: true, result: { message: "No profile yet — interact first", profile: null } };
            return {
              success: true,
              result: {
                verbosity: profile.verbosity,
                technicalLevel: profile.technicalLevel,
                formality: profile.formality,
                proactivity: profile.proactivity,
                preferredLength: Math.round(profile.preferredLength),
                interactionCount: profile.interactionCount,
              },
            };
          }
          case "get_modifier": {
            const modifier = getPromptModifier(uid);
            return { success: true, result: { systemSuffix: modifier.systemSuffix, tokenRatio: modifier.tokenRatio } };
          }
          case "process_message": {
            if (!input.message) return { success: false, result: null, error: "'message' required" };
            const profile = adaptiveProcessMessage(uid, input.message as string, input.response_time_ms as number | undefined);
            return {
              success: true,
              result: {
                verbosity: profile.verbosity,
                technicalLevel: profile.technicalLevel,
                formality: profile.formality,
                proactivity: profile.proactivity,
                interactionCount: profile.interactionCount,
              },
            };
          }
          case "reset": {
            resetAdaptiveProfile(uid);
            return { success: true, result: { message: `Adaptive profile reset for ${uid}` } };
          }
          case "frequent_topics": {
            return { success: true, result: { topics: getTopFrequentTopics(uid) } };
          }
          case "frequent_tools": {
            return { success: true, result: { tools: getTopFrequentTools(uid) } };
          }
          default:
            return { success: false, result: null, error: `Unknown adaptive_feedback action: ${action}` };
        }
      }

      // ===== Spaced Repetition =====
      case "spaced_repetition": {
        const action = input.action as string;
        const uid = input.user_id as string;
        if (!uid) return { success: false, result: null, error: "'user_id' required" };

        switch (action) {
          case "add": {
            if (!input.front || !input.back) return { success: false, result: null, error: "'front' and 'back' required" };
            const item = srAddItem(uid, input.front as string, input.back as string, input.category as string | undefined);
            return { success: true, result: { message: "Item added", id: item.id, nextReview: item.nextReview.toISOString() } };
          }
          case "review": {
            if (!input.item_id || input.quality === undefined) return { success: false, result: null, error: "'item_id' and 'quality' (0-5) required" };
            const result = srReviewItem(input.item_id as string, input.quality as 0 | 1 | 2 | 3 | 4 | 5);
            if (!result) return { success: false, result: null, error: `Item not found: ${input.item_id}` };
            return {
              success: true,
              result: {
                message: `Reviewed. Next in ${result.newInterval} day(s)`,
                previousInterval: result.previousInterval,
                newInterval: result.newInterval,
                nextReview: result.nextReview.toISOString(),
                easeFactor: result.item.easeFactor.toFixed(2),
              },
            };
          }
          case "due": {
            const items = srGetDueItems(uid, input.limit as number || 20);
            return {
              success: true,
              result: {
                count: items.length,
                items: items.map((i) => ({ id: i.id, front: i.front, category: i.category, interval: i.interval, easeFactor: i.easeFactor.toFixed(2) })),
              },
            };
          }
          case "list": {
            const items = srGetUserItems(uid, input.category as string | undefined);
            return {
              success: true,
              result: {
                count: items.length,
                items: items.map((i) => ({
                  id: i.id, front: i.front, back: i.back, category: i.category,
                  interval: i.interval, nextReview: i.nextReview.toISOString(),
                  totalReviews: i.totalReviews,
                })),
              },
            };
          }
          case "stats": {
            const stats = srGetStats(uid);
            return { success: true, result: stats };
          }
          case "delete": {
            if (!input.item_id) return { success: false, result: null, error: "'item_id' required" };
            const deleted = srDeleteItem(input.item_id as string);
            return { success: deleted, result: deleted ? { message: "Item deleted" } : null, error: deleted ? undefined : "Item not found" };
          }
          default:
            return { success: false, result: null, error: `Unknown spaced_repetition action: ${action}` };
        }
      }

      // ===== Struggle Detection =====
      case "struggle_detection": {
        const action = input.action as string;
        const uid = input.user_id as string;
        if (!uid) return { success: false, result: null, error: "'user_id' required" };

        switch (action) {
          case "process": {
            if (!input.message) return { success: false, result: null, error: "'message' required" };
            const adjustment = processAndAdjust(uid, input.message as string, input.topic as string | undefined, input.response_time_ms as number | undefined);
            return {
              success: true,
              result: {
                difficulty: adjustment.level,
                struggleLevel: adjustment.struggleLevel,
                hintLevel: adjustment.hintLevel,
                shouldOfferHelp: adjustment.shouldOfferHelp,
                suggestion: adjustment.suggestion,
                promptModifier: adjustment.promptModifier,
              },
            };
          }
          case "get_adjustment": {
            const adjustment = getDifficultyAdjustment(uid);
            return {
              success: true,
              result: {
                difficulty: adjustment.level,
                struggleLevel: adjustment.struggleLevel,
                hintLevel: adjustment.hintLevel,
                shouldOfferHelp: adjustment.shouldOfferHelp,
                suggestion: adjustment.suggestion,
              },
            };
          }
          case "get_state": {
            const state = getStruggleState(uid);
            if (!state) return { success: true, result: { message: "No state yet", state: null } };
            return {
              success: true,
              result: {
                difficulty: state.difficulty,
                struggleLevel: state.struggleLevel,
                confusionStreak: state.confusionStreak,
                successStreak: state.successStreak,
                hintLevel: state.hintLevel,
                totalInteractions: state.totalInteractions,
              },
            };
          }
          case "reset": {
            resetStruggleState(uid);
            return { success: true, result: { message: `Struggle state reset for ${uid}` } };
          }
          case "struggle_topics": {
            const topics = getStruggleTopics(uid);
            return { success: true, result: { topics } };
          }
          default:
            return { success: false, result: null, error: `Unknown struggle_detection action: ${action}` };
        }
      }

      // === New v2.7 tools ===

      case "gif_search": {
        const results = await searchGifs({
          query: input.query as string,
          provider: input.provider as "tenor" | "giphy" | "auto" | undefined,
          limit: input.limit as number | undefined,
          rating: input.rating as string | undefined,
        });
        return { success: true, result: { query: input.query, count: results.length, gifs: results } };
      }

      case "places_lookup": {
        const plAction = input.action as string;
        switch (plAction) {
          case "search":
          case "geocode": {
            if (!input.query) return { success: false, result: null, error: "'query' required for search/geocode" };
            const places = await searchPlaces(input.query as string, (input.limit as number) || 10);
            return { success: true, result: { count: places.length, places } };
          }
          case "reverse_geocode": {
            if (input.lat === undefined || input.lon === undefined) return { success: false, result: null, error: "'lat' and 'lon' required" };
            const place = await reverseGeocode(input.lat as number, input.lon as number);
            return { success: true, result: place };
          }
          case "nearby": {
            if (input.lat === undefined || input.lon === undefined) return { success: false, result: null, error: "'lat' and 'lon' required" };
            const nearby = await findNearby(input.lat as number, input.lon as number, (input.category as string) || "any", (input.radius as number) || 1000, (input.limit as number) || 10);
            return { success: true, result: { count: nearby.length, places: nearby } };
          }
          case "directions": {
            let destLat = input.dest_lat as number | undefined;
            let destLon = input.dest_lon as number | undefined;
            if (!destLat && input.dest_query) {
              const results = await searchPlaces(input.dest_query as string, 1);
              if (results.length > 0) { destLat = results[0].lat; destLon = results[0].lon; }
            }
            if (input.lat === undefined || input.lon === undefined || !destLat || !destLon) return { success: false, result: null, error: "Origin lat/lon and destination required" };
            const route = await getDirections(input.lat as number, input.lon as number, destLat, destLon);
            return { success: true, result: route };
          }
          default:
            return { success: false, result: null, error: `Unknown places_lookup action: ${plAction}` };
        }
      }

      case "spotify_cli": {
        const parsed = parseSpotifyCommand(input.command as string);
        return executeTool("spotify", parsed as unknown as Record<string, unknown>);
      }

      case "token_dashboard": {
        const dashboard = await getTokenDashboard((input.period as string) || "day", (input.format as string) || "summary");
        return { success: true, result: dashboard };
      }

      case "terminal_agent": {
        const termResult = await executeTerminalCommand({
          command: input.command as string,
          shell: input.shell as string | undefined,
          cwd: input.cwd as string | undefined,
          timeout: input.timeout as number | undefined,
          preferLocal: input.prefer_local as boolean | undefined,
        });
        return { success: termResult.success, result: termResult, error: termResult.success ? undefined : termResult.stderr };
      }

      case "camera_monitor": {
        const cam = await import("./camera-monitor");
        const camAction = input.action as string;
        switch (camAction) {
          case "capture": {
            const result = await cam.captureFromWebcam({ device: input.device as string | undefined, resolution: input.resolution as string | undefined, format: input.format as string | undefined });
            return { success: result.success, result, error: result.error };
          }
          case "burst": {
            const result = await cam.burstCapture((input.frame_count as number) || 5, { device: input.device as string | undefined, resolution: input.resolution as string | undefined, format: input.format as string | undefined });
            return { success: result.success, result, error: result.error };
          }
          case "snapshot_rtsp": {
            const result = await cam.snapshotRTSP(input.rtsp_url as string, (input.format as string) || "jpg");
            return { success: result.success, result, error: result.error };
          }
          case "snapshot_ha": {
            const result = await cam.snapshotHA(input.entity_id as string, env.HOME_ASSISTANT_URL || "", env.HOME_ASSISTANT_TOKEN || "");
            return { success: result.success, result, error: result.error };
          }
          case "list_devices": {
            const devices = await cam.listCameraDevices(env.HOME_ASSISTANT_URL, env.HOME_ASSISTANT_TOKEN);
            return { success: true, result: { count: devices.length, devices } };
          }
          case "motion_detect": {
            const result = await cam.detectMotion((input.duration as number) || 10, (input.threshold as number) || 0.1, { device: input.device as string | undefined, resolution: input.resolution as string | undefined });
            return { success: result.success, result, error: result.error };
          }
          case "capabilities": {
            const ffmpeg = await cam.isFFmpegAvailable();
            return { success: true, result: { ffmpegAvailable: ffmpeg, platform: process.platform } };
          }
          default:
            return { success: false, result: null, error: `Unknown camera_monitor action: ${camAction}` };
        }
      }

      case "google_services": {
        const gService = input.service as string;
        const gAction = input.action as string;
        let google: GoogleServicesClient;
        try {
          google = getGoogleServices();
        } catch {
          // Not configured — return auth URL if possible
          const clientId = (env as any).GOOGLE_CLIENT_ID || env.GOOGLE_DRIVE_CLIENT_ID || env.GOOGLE_CALENDAR_CLIENT_ID;
          if (clientId) {
            const tempAuth = createGoogleServices({ clientId, clientSecret: "", redirectUri: "" });
            return { success: false, result: { needsAuth: true, message: "Google not authenticated. Set GOOGLE_REFRESH_TOKEN in .env." } };
          }
          return { success: false, result: null, error: "Google not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env" };
        }

        if (!google.auth.isAuthenticated()) {
          return { success: false, result: { needsAuth: true, authUrl: google.auth.getAuthorizationUrl(), message: "Google not authenticated. Direct user to the authorization URL." } };
        }

        switch (gService) {
          case "gmail": {
            switch (gAction) {
              case "list": return { success: true, result: await google.gmail.listEmails(input.query as string | undefined, (input.limit as number) || 20) };
              case "read": {
                if (!input.message_id) return { success: false, result: null, error: "'message_id' required" };
                return { success: true, result: await google.gmail.readEmail(input.message_id as string) };
              }
              case "send": {
                if (!input.to || !input.subject) return { success: false, result: null, error: "'to' and 'subject' required" };
                return { success: true, result: await google.gmail.sendEmail(input.to as string, input.subject as string, (input.body as string) || "") };
              }
              case "search": {
                if (!input.query) return { success: false, result: null, error: "'query' required" };
                return { success: true, result: await google.gmail.searchEmails(input.query as string, (input.limit as number) || 20) };
              }
              case "reply": {
                if (!input.message_id || !input.body) return { success: false, result: null, error: "'message_id' and 'body' required" };
                return { success: true, result: await google.gmail.replyToEmail(input.message_id as string, input.body as string) };
              }
              case "labels": return { success: true, result: await google.gmail.getLabels() };
              default: return { success: false, result: null, error: `Unknown Gmail action: ${gAction}` };
            }
          }
          case "calendar": {
            switch (gAction) {
              case "events":
              case "list": return { success: true, result: await google.calendar.listEvents((input.calendar_id as string) || "primary", input.start_time as string | undefined, input.end_time as string | undefined, (input.limit as number) || 20) };
              case "create_event": {
                if (!input.title || !input.start_time || !input.end_time) return { success: false, result: null, error: "'title', 'start_time', and 'end_time' required" };
                return { success: true, result: await google.calendar.createEvent({ summary: input.title as string, description: input.body as string | undefined, start: input.start_time as string, end: input.end_time as string, calendarId: input.calendar_id as string | undefined }) };
              }
              case "update_event": {
                if (!input.event_id) return { success: false, result: null, error: "'event_id' required" };
                return { success: true, result: await google.calendar.updateEvent(input.event_id as string, { summary: input.title as string | undefined, description: input.body as string | undefined, start: input.start_time as string | undefined, end: input.end_time as string | undefined }, (input.calendar_id as string) || "primary") };
              }
              case "delete_event": {
                if (!input.event_id) return { success: false, result: null, error: "'event_id' required" };
                await google.calendar.deleteEvent(input.event_id as string, (input.calendar_id as string) || "primary");
                return { success: true, result: { deleted: input.event_id } };
              }
              default: return { success: false, result: null, error: `Unknown Calendar action: ${gAction}` };
            }
          }
          case "drive": {
            switch (gAction) {
              case "list_files":
              case "list": return { success: true, result: await google.drive.listFiles(input.file_id as string | undefined, (input.limit as number) || 20) };
              case "search_files":
              case "search": {
                if (!input.query) return { success: false, result: null, error: "'query' required" };
                return { success: true, result: await google.drive.searchFiles(input.query as string, (input.limit as number) || 20) };
              }
              case "upload": {
                if (!input.file_path) return { success: false, result: null, error: "'file_path' required" };
                return { success: true, result: await google.drive.uploadFile(input.file_path as string, input.title as string | undefined, input.file_id as string | undefined) };
              }
              case "download": {
                if (!input.file_id) return { success: false, result: null, error: "'file_id' required" };
                return { success: true, result: await google.drive.downloadFile(input.file_id as string, input.file_path as string | undefined) };
              }
              case "share": {
                if (!input.file_id || !input.to) return { success: false, result: null, error: "'file_id' and 'to' (email) required" };
                return { success: true, result: await google.drive.shareFile(input.file_id as string, input.to as string) };
              }
              default: return { success: false, result: null, error: `Unknown Drive action: ${gAction}` };
            }
          }
          default:
            return { success: false, result: null, error: `Unknown Google service: ${gService}` };
        }
      }

      // ── Crypto Exchange ──────────────────────────────────────────────────
      case "crypto_exchange": {
        const client = createExchangeClient({
          coinbaseApiKey: env.COINBASE_API_KEY,
          coinbasePrivateKey: env.COINBASE_PRIVATE_KEY,
          binanceApiKey: env.BINANCE_API_KEY,
          binanceApiSecret: env.BINANCE_API_SECRET,
          binanceTestnet: env.BINANCE_TESTNET,
          requireConfirmation: env.EXCHANGE_REQUIRE_CONFIRMATION,
        });
        const action = input.action as string;
        const exchange = (input.exchange as "coinbase" | "binance") ?? "binance";
        switch (action) {
          case "balances":
            return { success: true, result: await client.getBalances(exchange) };
          case "place_order":
            return {
              success: true,
              result: await client.placeOrder({
                exchange,
                symbol: input.symbol as string,
                side: input.side as "buy" | "sell",
                orderType: (input.order_type as "market" | "limit" | "stop_limit") ?? "market",
                quantity: input.quantity as number,
                price: input.price as number | undefined,
                stopPrice: input.stop_price as number | undefined,
                confirmed: input.confirmed as boolean | undefined,
              }),
            };
          case "cancel_order":
            return { success: true, result: await client.cancelOrder(exchange, input.order_id as string) };
          case "order_status":
            return { success: true, result: await client.getOrder(exchange, input.order_id as string) };
          case "order_history":
            return { success: true, result: await client.getOrderHistory(exchange, input.symbol as string | undefined, (input.limit as number) ?? 50) };
          case "fills":
            return { success: true, result: await client.getFills(exchange, input.order_id as string | undefined) };
          case "ticker":
            return { success: true, result: await client.getTicker(exchange, input.symbol as string) };
          default:
            return { success: false, result: null, error: `Unknown exchange action: ${action}` };
        }
      }

      // ── DeFi Data ─────────────────────────────────────────────────────────
      case "defi_data": {
        const client = createDeFiClient({ apiKey: env.DEFILLAMA_API_KEY });
        const action = input.action as string;
        switch (action) {
          case "protocols":
            return { success: true, result: await client.getProtocols(input.limit as number | undefined) };
          case "protocol":
            if (!input.slug) return { success: false, result: null, error: "'slug' is required" };
            return { success: true, result: await client.getProtocol(input.slug as string) };
          case "chains":
            return { success: true, result: await client.getChainTVLs() };
          case "chain_tvl":
            if (!input.chain) return { success: false, result: null, error: "'chain' is required" };
            return { success: true, result: await client.getChainTVL(input.chain as string) };
          case "yields":
            return {
              success: true,
              result: await client.getTopYields({
                chain: input.chain as string | undefined,
                stablecoin: input.stablecoin as boolean | undefined,
                limit: input.limit as number | undefined,
              }),
            };
          case "stablecoins":
            return { success: true, result: await client.getStablecoins() };
          case "token_prices":
            if (!input.tokens) return { success: false, result: null, error: "'tokens' array is required" };
            const priceMap = await client.getTokenPrices(input.tokens as string[], (input.chain as string) ?? "ethereum");
            return { success: true, result: Object.fromEntries(priceMap) };
          case "summary":
            return { success: true, result: await client.getDeFiSummary() };
          default:
            return { success: false, result: null, error: `Unknown DeFi action: ${action}` };
        }
      }

      // ── On-Chain Analytics ────────────────────────────────────────────────
      case "onchain_analytics": {
        const client = createOnChainClient({
          etherscanApiKey: env.ETHERSCAN_API_KEY,
          alchemyApiKey: env.ALCHEMY_API_KEY,
          alchemyNetwork: env.ALCHEMY_NETWORK,
        });
        const action = input.action as string;
        const address = input.address as string;
        switch (action) {
          case "balance":
            if (!address) return { success: false, result: null, error: "'address' is required" };
            return { success: true, result: await client.getBalance(address) };
          case "transactions":
            if (!address) return { success: false, result: null, error: "'address' is required" };
            return {
              success: true,
              result: await client.getTransactions(address, {
                page: input.page as number | undefined,
                offset: input.offset as number | undefined,
                sort: input.sort as "asc" | "desc" | undefined,
              }),
            };
          case "token_transfers":
            if (!address) return { success: false, result: null, error: "'address' is required" };
            return {
              success: true,
              result: await client.getTokenTransfers(address, {
                contractAddress: input.contract_address as string | undefined,
                page: input.page as number | undefined,
                offset: input.offset as number | undefined,
              }),
            };
          case "token_balances":
            if (!address) return { success: false, result: null, error: "'address' is required" };
            return { success: true, result: await client.getTokenBalances(address) };
          case "gas":
            return { success: true, result: await client.getGasOracle() };
          case "asset_transfers":
            if (!address) return { success: false, result: null, error: "'address' is required" };
            return { success: true, result: await client.getAssetTransfers(address) };
          case "wallet_summary":
            if (!address) return { success: false, result: null, error: "'address' is required" };
            return { success: true, result: await client.getWalletSummary(address) };
          default:
            return { success: false, result: null, error: `Unknown on-chain action: ${action}` };
        }
      }

      // ── Order Book ────────────────────────────────────────────────────────
      case "order_book": {
        const client = createOrderBookClient();
        const action = input.action as string;
        const symbol = input.symbol as string;
        switch (action) {
          case "book": {
            const exchange = input.exchange as "binance" | "coinbase" | undefined;
            if (exchange === "coinbase") {
              return { success: true, result: await client.getCoinbaseOrderBook(symbol, (input.limit as number) ?? 100) };
            }
            return { success: true, result: await client.getBinanceOrderBook(symbol, (input.limit as number) ?? 100) };
          }
          case "aggregated":
            return { success: true, result: await client.getAggregatedOrderBook(symbol) };
          case "depth":
            return { success: true, result: await client.getDepthVisualization(symbol) };
          case "spread":
            return { success: true, result: await client.getSpread(symbol, input.exchange as "binance" | "coinbase" | undefined) };
          case "walls":
            return { success: true, result: await client.detectWalls(symbol, (input.threshold as number) ?? 3) };
          default:
            return { success: false, result: null, error: `Unknown order book action: ${action}` };
        }
      }

      // ── Backtesting ───────────────────────────────────────────────────────
      case "backtest": {
        const engine = createBacktestingEngine({
          defaultCapital: input.initial_capital as number | undefined,
          defaultFeeRate: input.fee_rate as number | undefined,
        });
        const action = input.action as string;
        switch (action) {
          case "strategies":
            return { success: true, result: engine.getBuiltinStrategies() };
          case "run": {
            if (!input.symbol) return { success: false, result: null, error: "'symbol' is required" };
            if (!input.strategy) return { success: false, result: null, error: "'strategy' is required" };
            // Fetch historical prices
            const { createCryptoClient } = await import("../integrations/finance/crypto");
            const { createStockClient } = await import("../integrations/finance/stocks");
            const days = (input.days as number) ?? 90;
            const daysToRange = (d: number): "1mo" | "3mo" | "6mo" | "1y" | "2y" | "5y" | "max" =>
              d <= 30 ? "1mo" : d <= 90 ? "3mo" : d <= 180 ? "6mo" : d <= 365 ? "1y" : d <= 730 ? "2y" : d <= 1825 ? "5y" : "max";
            let prices: number[];
            const assetType = (input.asset_type as "crypto" | "stock") ?? "crypto";
            if (assetType === "crypto") {
              const crypto = createCryptoClient();
              const history = await crypto.getHistoricalData(input.symbol as string, days);
              prices = history.prices.map(([, p]) => p);
            } else {
              const stocks = createStockClient({ alphaVantageApiKey: env.ALPHA_VANTAGE_API_KEY });
              const history = await stocks.getHistoricalData(input.symbol as string, daysToRange(days));
              prices = history.map((d: { close: number }) => d.close);
            }
            const result = await engine.backtest({
              symbol: input.symbol as string,
              assetType,
              strategy: input.strategy as string,
              days,
              initialCapital: input.initial_capital as number | undefined,
              feeRate: input.fee_rate as number | undefined,
              strategyParams: input.params as Record<string, number> | undefined,
              prices,
            });
            return { success: true, result };
          }
          case "compare": {
            if (!input.symbol) return { success: false, result: null, error: "'symbol' is required" };
            const strategies = (input.strategies as string[]) ?? ["sma_crossover", "rsi", "momentum", "mean_reversion"];
            const days = (input.days as number) ?? 90;
            const daysToRange = (d: number): "1mo" | "3mo" | "6mo" | "1y" | "2y" | "5y" | "max" =>
              d <= 30 ? "1mo" : d <= 90 ? "3mo" : d <= 180 ? "6mo" : d <= 365 ? "1y" : d <= 730 ? "2y" : d <= 1825 ? "5y" : "max";
            const { createCryptoClient } = await import("../integrations/finance/crypto");
            const { createStockClient } = await import("../integrations/finance/stocks");
            let prices: number[];
            const assetType = (input.asset_type as "crypto" | "stock") ?? "crypto";
            if (assetType === "crypto") {
              const crypto = createCryptoClient();
              const history = await crypto.getHistoricalData(input.symbol as string, days);
              prices = history.prices.map(([, p]) => p);
            } else {
              const stocks = createStockClient({ alphaVantageApiKey: env.ALPHA_VANTAGE_API_KEY });
              const history = await stocks.getHistoricalData(input.symbol as string, daysToRange(days));
              prices = history.map((d: { close: number }) => d.close);
            }
            const comparison = await engine.compareStrategies({
              symbol: input.symbol as string,
              assetType,
              strategies,
              days,
              initialCapital: input.initial_capital as number | undefined,
              feeRate: input.fee_rate as number | undefined,
              prices,
            });
            return { success: true, result: comparison };
          }
          default:
            return { success: false, result: null, error: `Unknown backtest action: ${action}` };
        }
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
