/**
 * OpenSentinel - NPM Package Entry Point
 *
 * Usage:
 *   import { OpenSentinel, configure, chat } from 'opensentinel';
 */

// Configuration
export { configure, env, type Env } from "./config/env";

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

// Database (advanced)
export { db } from "./db";
