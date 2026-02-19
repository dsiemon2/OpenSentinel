/**
 * OpenSentinel - NPM Package Entry Point
 *
 * Usage:
 *   import { OpenSentinel, configure, chat } from 'opensentinel';
 */

// Configuration
export { configure, ready, env, type Env } from "./config/env";
export { initializeProviders } from "./core/providers";

// Orchestrator class
export { OpenSentinel, type OpenSentinelConfig } from "./app";

// Core Brain (primary value proposition)
export {
  chat,
  chatWithTools,
  streamChat,
  streamChatWithTools,
  SYSTEM_PROMPT,
  type Message,
  type BrainResponse,
  type StreamEvent,
} from "./core/brain";

// Memory system
export {
  storeMemory,
  searchMemories,
  buildMemoryContext,
  extractMemories,
  generateEmbedding,
} from "./core/memory";

// Tools
export { TOOLS, executeTool } from "./tools";

// Scheduler
export {
  scheduleTask,
  scheduleReminder,
  cancelTask,
  generateBriefing,
} from "./core/scheduler";

// API server (Hono app — composable into user's server)
export { app as apiApp } from "./inputs/api/server";

// Input bots (for advanced users)
export { createBot as createTelegramBot } from "./inputs/telegram/bot";
export { DiscordBot } from "./inputs/discord";
export { SlackBot } from "./inputs/slack";
export { WhatsAppBot } from "./inputs/whatsapp";
export { SignalBot } from "./inputs/signal";
export { iMessageBot } from "./inputs/imessage";

// Security
export { generateEncryptionKey, reEncryptValue, getRotationInfo } from "./core/security/key-rotation";

// Utility tools
export { transformText, countText, detectLanguage, extractKeywords, changeCase } from "./tools/text-transform";
export { jsonTool, validateJson, formatJson, flattenJson, diffJson, queryJson } from "./tools/json-tool";
export { cronTool, explainCron, getNextRuns, validateCron } from "./tools/cron-explain";
export { hashTool, hashString, compareHashes, generateToken } from "./tools/hash-tool";
export { regexTool, testRegex, replaceWithRegex, extractCaptures } from "./tools/regex-tool";
export { unitConverter, convert } from "./tools/unit-converter";
export { qrCodeTool, generateQRSvg } from "./tools/qr-code";
export { clipboardTool } from "./tools/clipboard-manager";
export { createDatabaseBackup, restoreDatabase, listBackups } from "./tools/backup-restore";
export { registerService, recordBeat, checkHeartbeats, getHeartbeatSummary } from "./tools/heartbeat-monitor";

// Database (advanced)
export { db } from "./db";
