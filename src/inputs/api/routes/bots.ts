/**
 * Bots API Routes — Bot integration status + configuration for the dashboard
 */

import { Hono } from "hono";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { resolve } from "path";

const botsRouter = new Hono();

// Bot field definitions for each platform
const BOT_FIELDS: Record<string, Array<{
  key: string;
  envVar: string;
  label: string;
  type: "text" | "password" | "boolean" | "number" | "select";
  placeholder?: string;
  options?: string[];
  help?: string;
  required?: boolean;
}>> = {
  telegram: [
    { key: "botToken", envVar: "TELEGRAM_BOT_TOKEN", label: "Bot Token", type: "password", placeholder: "123456:ABC-DEF1234...", help: "Get from @BotFather on Telegram", required: true },
    { key: "chatId", envVar: "TELEGRAM_CHAT_ID", label: "Chat ID", type: "text", placeholder: "-1001234567890", help: "Your chat/group ID for notifications" },
  ],
  discord: [
    { key: "botToken", envVar: "DISCORD_BOT_TOKEN", label: "Bot Token", type: "password", placeholder: "MTIz...", help: "From Discord Developer Portal > Bot", required: true },
    { key: "clientId", envVar: "DISCORD_CLIENT_ID", label: "Client ID", type: "text", placeholder: "123456789012345678", help: "Application ID from Discord Developer Portal" },
    { key: "guildId", envVar: "DISCORD_GUILD_ID", label: "Guild (Server) ID", type: "text", placeholder: "123456789012345678", help: "Right-click server > Copy Server ID" },
    { key: "allowedUserIds", envVar: "DISCORD_ALLOWED_USER_IDS", label: "Allowed User IDs", type: "text", placeholder: "id1,id2,id3", help: "Comma-separated Discord user IDs" },
    { key: "allowedRoleIds", envVar: "DISCORD_ALLOWED_ROLE_IDS", label: "Allowed Role IDs", type: "text", placeholder: "id1,id2", help: "Comma-separated Discord role IDs" },
  ],
  slack: [
    { key: "botToken", envVar: "SLACK_BOT_TOKEN", label: "Bot Token", type: "password", placeholder: "xoxb-...", help: "From Slack App > OAuth & Permissions", required: true },
    { key: "signingSecret", envVar: "SLACK_SIGNING_SECRET", label: "Signing Secret", type: "password", placeholder: "abc123...", help: "From Slack App > Basic Information", required: true },
    { key: "appToken", envVar: "SLACK_APP_TOKEN", label: "App Token", type: "password", placeholder: "xapp-...", help: "For Socket Mode — from Slack App > Basic Information" },
    { key: "socketMode", envVar: "SLACK_SOCKET_MODE", label: "Socket Mode", type: "boolean", help: "Use WebSocket instead of HTTP events" },
    { key: "port", envVar: "SLACK_PORT", label: "Port", type: "number", placeholder: "3000", help: "HTTP listener port (if not using Socket Mode)" },
    { key: "allowedUserIds", envVar: "SLACK_ALLOWED_USER_IDS", label: "Allowed User IDs", type: "text", placeholder: "U01ABC,U02DEF", help: "Comma-separated Slack user IDs" },
    { key: "allowedChannelIds", envVar: "SLACK_ALLOWED_CHANNEL_IDS", label: "Allowed Channel IDs", type: "text", placeholder: "C01ABC,C02DEF", help: "Comma-separated Slack channel IDs" },
  ],
  whatsapp: [
    { key: "enabled", envVar: "WHATSAPP_ENABLED", label: "Enabled", type: "boolean", help: "Enable WhatsApp bot", required: true },
    { key: "authDir", envVar: "WHATSAPP_AUTH_DIR", label: "Auth Directory", type: "text", placeholder: "./whatsapp-auth", help: "Directory for session storage" },
    { key: "allowedNumbers", envVar: "WHATSAPP_ALLOWED_NUMBERS", label: "Allowed Numbers", type: "text", placeholder: "+1234567890,+0987654321", help: "Comma-separated phone numbers" },
  ],
  signal: [
    { key: "enabled", envVar: "SIGNAL_ENABLED", label: "Enabled", type: "boolean", help: "Enable Signal bot", required: true },
    { key: "phoneNumber", envVar: "SIGNAL_PHONE_NUMBER", label: "Phone Number", type: "text", placeholder: "+1234567890", help: "Registered Signal phone number", required: true },
    { key: "cliPath", envVar: "SIGNAL_CLI_PATH", label: "CLI Path", type: "text", placeholder: "signal-cli", help: "Path to signal-cli binary" },
    { key: "allowedNumbers", envVar: "SIGNAL_ALLOWED_NUMBERS", label: "Allowed Numbers", type: "text", placeholder: "+1234567890,+0987654321", help: "Comma-separated phone numbers" },
  ],
  imessage: [
    { key: "enabled", envVar: "IMESSAGE_ENABLED", label: "Enabled", type: "boolean", help: "Enable iMessage bot (macOS only)", required: true },
    { key: "mode", envVar: "IMESSAGE_MODE", label: "Mode", type: "select", options: ["applescript", "bluebubbles"], help: "AppleScript (local) or BlueBubbles (remote)" },
    { key: "blueBubblesUrl", envVar: "IMESSAGE_BLUEBUBBLES_URL", label: "BlueBubbles URL", type: "text", placeholder: "http://localhost:1234", help: "BlueBubbles server URL" },
    { key: "blueBubblesPassword", envVar: "IMESSAGE_BLUEBUBBLES_PASSWORD", label: "BlueBubbles Password", type: "password", help: "BlueBubbles server password" },
    { key: "allowedNumbers", envVar: "IMESSAGE_ALLOWED_NUMBERS", label: "Allowed Numbers", type: "text", placeholder: "+1234567890,+0987654321", help: "Comma-separated phone numbers" },
  ],
  matrix: [
    { key: "enabled", envVar: "MATRIX_ENABLED", label: "Enabled", type: "boolean", help: "Enable Matrix bot", required: true },
    { key: "homeserverUrl", envVar: "MATRIX_HOMESERVER_URL", label: "Homeserver URL", type: "text", placeholder: "https://matrix.org", help: "Matrix homeserver URL", required: true },
    { key: "accessToken", envVar: "MATRIX_ACCESS_TOKEN", label: "Access Token", type: "password", help: "Matrix access token", required: true },
    { key: "userId", envVar: "MATRIX_USER_ID", label: "User ID", type: "text", placeholder: "@bot:matrix.org", help: "Bot's Matrix user ID" },
    { key: "autoJoin", envVar: "MATRIX_AUTO_JOIN", label: "Auto Join Rooms", type: "boolean", help: "Automatically join rooms when invited" },
    { key: "e2eEnabled", envVar: "MATRIX_E2E_ENABLED", label: "E2E Encryption", type: "boolean", help: "Enable end-to-end encryption" },
    { key: "allowedRoomIds", envVar: "MATRIX_ALLOWED_ROOM_IDS", label: "Allowed Room IDs", type: "text", placeholder: "!roomid:matrix.org", help: "Comma-separated room IDs" },
  ],
};

function getEnvFilePath(): string {
  return resolve(process.cwd(), ".env");
}

function parseEnvFile(): Map<string, string> {
  const envPath = getEnvFilePath();
  const vars = new Map<string, string>();
  if (!existsSync(envPath)) return vars;
  const content = readFileSync(envPath, "utf-8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let val = trimmed.slice(eqIdx + 1).trim();
    // Strip surrounding quotes
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    vars.set(key, val);
  }
  return vars;
}

function updateEnvFile(updates: Record<string, string>): void {
  const envPath = getEnvFilePath();
  let content = existsSync(envPath) ? readFileSync(envPath, "utf-8") : "";
  const lines = content.split("\n");

  for (const [key, value] of Object.entries(updates)) {
    const lineIdx = lines.findIndex(l => {
      const trimmed = l.trim();
      return !trimmed.startsWith("#") && trimmed.startsWith(key + "=");
    });
    const newLine = `${key}=${value}`;
    if (lineIdx >= 0) {
      lines[lineIdx] = newLine;
    } else {
      lines.push(newLine);
    }
  }

  writeFileSync(envPath, lines.join("\n"), "utf-8");
}

// GET /api/bots/status — Status of all bot integrations
botsRouter.get("/status", async (c) => {
  try {
    const { env } = await import("../../../config/env");

    const bots = [
      {
        id: "telegram",
        name: "Telegram",
        icon: "telegram",
        enabled: !!env.TELEGRAM_BOT_TOKEN,
        config: {
          chatId: env.TELEGRAM_CHAT_ID ? true : false,
        },
        description: "Telegram bot via grammY framework",
      },
      {
        id: "discord",
        name: "Discord",
        icon: "discord",
        enabled: !!env.DISCORD_BOT_TOKEN,
        config: {
          guildId: env.DISCORD_GUILD_ID || null,
          clientId: env.DISCORD_CLIENT_ID ? true : false,
          allowedUsers: env.DISCORD_ALLOWED_USER_IDS
            ? env.DISCORD_ALLOWED_USER_IDS.split(",").length
            : 0,
        },
        description: "Discord bot via discord.js with slash commands and voice",
      },
      {
        id: "slack",
        name: "Slack",
        icon: "slack",
        enabled: !!env.SLACK_BOT_TOKEN && !!env.SLACK_SIGNING_SECRET,
        config: {
          socketMode: env.SLACK_SOCKET_MODE || false,
          port: env.SLACK_PORT || 3000,
          allowedUsers: env.SLACK_ALLOWED_USER_IDS
            ? env.SLACK_ALLOWED_USER_IDS.split(",").length
            : 0,
          allowedChannels: env.SLACK_ALLOWED_CHANNEL_IDS
            ? env.SLACK_ALLOWED_CHANNEL_IDS.split(",").length
            : 0,
        },
        description: "Slack bot via @slack/bolt with Socket Mode support",
      },
      {
        id: "whatsapp",
        name: "WhatsApp",
        icon: "whatsapp",
        enabled: !!env.WHATSAPP_ENABLED,
        config: {
          allowedNumbers: env.WHATSAPP_ALLOWED_NUMBERS
            ? env.WHATSAPP_ALLOWED_NUMBERS.split(",").length
            : 0,
        },
        description: "WhatsApp bot via Baileys with QR code authentication",
      },
      {
        id: "signal",
        name: "Signal",
        icon: "signal",
        enabled: !!env.SIGNAL_ENABLED && !!env.SIGNAL_PHONE_NUMBER,
        config: {
          hasPhoneNumber: !!env.SIGNAL_PHONE_NUMBER,
          allowedNumbers: env.SIGNAL_ALLOWED_NUMBERS
            ? env.SIGNAL_ALLOWED_NUMBERS.split(",").length
            : 0,
        },
        description: "Signal bot via signal-cli with end-to-end encryption",
      },
      {
        id: "imessage",
        name: "iMessage",
        icon: "imessage",
        enabled: !!env.IMESSAGE_ENABLED,
        config: {
          mode: env.IMESSAGE_MODE || "applescript",
          allowedNumbers: env.IMESSAGE_ALLOWED_NUMBERS
            ? env.IMESSAGE_ALLOWED_NUMBERS.split(",").length
            : 0,
        },
        description: "iMessage bot via AppleScript or BlueBubbles API",
      },
      {
        id: "matrix",
        name: "Matrix",
        icon: "matrix",
        enabled: !!env.MATRIX_ENABLED && !!env.MATRIX_HOMESERVER_URL && !!env.MATRIX_ACCESS_TOKEN,
        config: {
          homeserver: env.MATRIX_HOMESERVER_URL || null,
          userId: env.MATRIX_USER_ID || null,
          autoJoin: env.MATRIX_AUTO_JOIN ?? true,
          e2eEnabled: env.MATRIX_E2E_ENABLED || false,
          allowedRooms: env.MATRIX_ALLOWED_ROOM_IDS
            ? env.MATRIX_ALLOWED_ROOM_IDS.split(",").length
            : 0,
        },
        description: "Matrix bot with optional end-to-end encryption",
      },
    ];

    const enabledCount = bots.filter(b => b.enabled).length;

    return c.json({ bots, enabledCount, totalCount: bots.length });
  } catch {
    return c.json({ bots: [], enabledCount: 0, totalCount: 0 });
  }
});

// GET /api/bots/fields — Field definitions for each bot
botsRouter.get("/fields", (c) => {
  return c.json(BOT_FIELDS);
});

// GET /api/bots/:id/config — Current config values (secrets masked)
botsRouter.get("/:id/config", async (c) => {
  const botId = c.req.param("id");
  const fields = BOT_FIELDS[botId];
  if (!fields) return c.json({ error: "Unknown bot" }, 404);

  const envVars = parseEnvFile();
  const values: Record<string, string> = {};

  for (const field of fields) {
    const raw = envVars.get(field.envVar) || "";
    if (field.type === "password" && raw) {
      // Mask secrets: show first 4 and last 4 chars
      values[field.key] = raw.length > 10
        ? raw.slice(0, 4) + "..." + raw.slice(-4)
        : "****";
    } else {
      values[field.key] = raw;
    }
  }

  return c.json({ botId, values, fields });
});

// PUT /api/bots/:id/config — Update bot configuration in .env
botsRouter.put("/:id/config", async (c) => {
  const botId = c.req.param("id");
  const fields = BOT_FIELDS[botId];
  if (!fields) return c.json({ error: "Unknown bot" }, 404);

  try {
    const body = await c.req.json<Record<string, string>>();
    const updates: Record<string, string> = {};

    for (const field of fields) {
      if (field.key in body) {
        let val = body[field.key];
        // Skip masked password values (user didn't change them)
        if (field.type === "password" && (val.includes("...") || val === "****")) continue;
        updates[field.envVar] = val;
      }
    }

    if (Object.keys(updates).length > 0) {
      updateEnvFile(updates);
    }

    return c.json({ success: true, updated: Object.keys(updates).length, note: "Restart required for changes to take effect" });
  } catch (err: any) {
    return c.json({ error: err?.message || "Failed to update config" }, 500);
  }
});

export default botsRouter;
