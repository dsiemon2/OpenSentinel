import { z } from "zod";

const envSchema = z.object({
  // Claude API
  CLAUDE_API_KEY: z.string().min(1, "CLAUDE_API_KEY is required"),

  // Telegram
  TELEGRAM_BOT_TOKEN: z.string().optional().default(""),
  TELEGRAM_CHAT_ID: z.string().optional().default(""),

  // OpenAI (Whisper STT)
  OPENAI_API_KEY: z.string().optional().default(""),

  // ElevenLabs TTS
  ELEVENLABS_API_KEY: z.string().optional().default(""),
  ELEVENLABS_VOICE_ID: z.string().optional().default(""),

  // Database
  DATABASE_URL: z
    .string()
    .default("postgresql://sentinel:sentinel@localhost:5432/sentinel"),

  // Redis
  REDIS_URL: z.string().default("redis://localhost:6379"),

  // Discord (optional)
  DISCORD_BOT_TOKEN: z.string().optional(),
  DISCORD_CLIENT_ID: z.string().optional(),
  DISCORD_GUILD_ID: z.string().optional(),
  DISCORD_ALLOWED_USER_IDS: z.string().optional(), // Comma-separated list
  DISCORD_ALLOWED_ROLE_IDS: z.string().optional(), // Comma-separated list

  // Slack (optional)
  SLACK_BOT_TOKEN: z.string().optional(),
  SLACK_SIGNING_SECRET: z.string().optional(),
  SLACK_APP_TOKEN: z.string().optional(),
  SLACK_SOCKET_MODE: z.coerce.boolean().optional().default(false),
  SLACK_PORT: z.coerce.number().optional().default(3000),
  SLACK_ALLOWED_USER_IDS: z.string().optional(), // Comma-separated list
  SLACK_ALLOWED_CHANNEL_IDS: z.string().optional(), // Comma-separated list

  // Notion (optional)
  NOTION_API_KEY: z.string().optional(),
  NOTION_ROOT_PAGE_ID: z.string().optional(),

  // Email (optional)
  EMAIL_IMAP_HOST: z.string().optional(),
  EMAIL_IMAP_PORT: z.coerce.number().optional().default(993),
  EMAIL_IMAP_SECURE: z.coerce.boolean().optional().default(true),
  EMAIL_SMTP_HOST: z.string().optional(),
  EMAIL_SMTP_PORT: z.coerce.number().optional().default(587),
  EMAIL_SMTP_SECURE: z.coerce.boolean().optional().default(false),
  EMAIL_USER: z.string().optional(),
  EMAIL_PASSWORD: z.string().optional(),
  EMAIL_PROVIDER: z.enum(["gmail", "outlook", "yahoo", "custom"]).optional(),

  // GitHub (optional)
  GITHUB_TOKEN: z.string().optional(),
  GITHUB_WEBHOOK_SECRET: z.string().optional(),

  // Google Drive (optional)
  GOOGLE_DRIVE_CLIENT_ID: z.string().optional(),
  GOOGLE_DRIVE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_DRIVE_REDIRECT_URI: z.string().optional(),
  GOOGLE_DRIVE_REFRESH_TOKEN: z.string().optional(),

  // Dropbox (optional)
  DROPBOX_APP_KEY: z.string().optional(),
  DROPBOX_APP_SECRET: z.string().optional(),
  DROPBOX_ACCESS_TOKEN: z.string().optional(),
  DROPBOX_REFRESH_TOKEN: z.string().optional(),

  // Finance (optional)
  ALPHA_VANTAGE_API_KEY: z.string().optional(),

  // Optional
  HUGGINGFACE_ACCESS_TOKEN: z.string().optional(),
  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  TWILIO_PHONE_NUMBER: z.string().optional(),

  // Home Assistant (optional)
  HOME_ASSISTANT_URL: z.string().url().optional(),
  HOME_ASSISTANT_TOKEN: z.string().optional(),

  // Spotify (optional)
  SPOTIFY_CLIENT_ID: z.string().optional(),
  SPOTIFY_CLIENT_SECRET: z.string().optional(),
  SPOTIFY_REDIRECT_URI: z.string().url().optional(),

  // MCP (Model Context Protocol)
  MCP_ENABLED: z.coerce.boolean().optional().default(true),
  MCP_CONFIG_PATH: z.string().optional().default("./mcp.json"),

  // WhatsApp (optional)
  WHATSAPP_ENABLED: z.coerce.boolean().optional().default(false),
  WHATSAPP_AUTH_DIR: z.string().optional().default("./whatsapp-auth"),
  WHATSAPP_ALLOWED_NUMBERS: z.string().optional(), // Comma-separated

  // Signal (optional)
  SIGNAL_ENABLED: z.coerce.boolean().optional().default(false),
  SIGNAL_PHONE_NUMBER: z.string().optional(),
  SIGNAL_CLI_PATH: z.string().optional().default("signal-cli"),
  SIGNAL_ALLOWED_NUMBERS: z.string().optional(), // Comma-separated

  // iMessage (optional, macOS only)
  IMESSAGE_ENABLED: z.coerce.boolean().optional().default(false),
  IMESSAGE_MODE: z.enum(["bluebubbles", "applescript"]).optional().default("applescript"),
  IMESSAGE_BLUEBUBBLES_URL: z.string().optional(),
  IMESSAGE_BLUEBUBBLES_PASSWORD: z.string().optional(),
  IMESSAGE_ALLOWED_NUMBERS: z.string().optional(), // Comma-separated

  // Server
  PORT: z.coerce.number().default(8030),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
});

export type Env = z.infer<typeof envSchema>;

// Internal mutable store
let _env: Env | null = null;

/**
 * Programmatic configuration for library use.
 * Call this before any module accesses `env`.
 * Config values are merged with process.env (config takes precedence).
 */
export function configure(config: Partial<Env> & { CLAUDE_API_KEY: string }): Env {
  const merged = { ...process.env, ...config };
  const result = envSchema.safeParse(merged);

  if (!result.success) {
    const errors = result.error.errors.map(
      (e) => `${e.path.join(".")}: ${e.message}`
    );
    throw new Error(
      `OpenSentinel configuration validation failed:\n  ${errors.join("\n  ")}`
    );
  }

  _env = result.data;
  return _env;
}

/**
 * Load config from process.env.
 * Called lazily on first access if configure() was not called.
 *
 * When used as a library, env vars may not be set at import time
 * (module-level singletons trigger this during static initialization).
 * In that case, we populate with defaults and partial values rather
 * than throwing — services will fail with clear errors when actually used.
 */
function loadFromProcessEnv(): Env {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    // If running as CLI (not library), throw so the user sees the error immediately
    if (process.env.__OPENSENTINEL_CLI__) {
      const errors = result.error.errors.map(
        (e) => `${e.path.join(".")}: ${e.message}`
      );
      throw new Error(
        `Environment validation failed:\n  ${errors.join("\n  ")}`
      );
    }

    // For library use: populate with whatever we have, fill missing with defaults
    // Services will fail individually when they try to use undefined API keys
    const lenientSchema = envSchema.extend({
      CLAUDE_API_KEY: z.string().default(""),
    });
    const lenientResult = lenientSchema.safeParse(process.env);
    _env = (lenientResult.success ? lenientResult.data : {}) as Env;
    return _env;
  }

  _env = result.data;
  return _env;
}

/**
 * The env accessor. Lazy — loads from process.env on first access
 * if configure() was not called first.
 *
 * All 37+ consumer files keep using `env.SOME_PROP` unchanged.
 */
export const env: Env = new Proxy({} as Env, {
  get(_target, prop: string) {
    if (!_env) {
      loadFromProcessEnv();
    }
    return (_env as any)[prop];
  },
  has(_target, prop: string) {
    if (!_env) {
      loadFromProcessEnv();
    }
    return prop in (_env as any);
  },
  ownKeys() {
    if (!_env) {
      loadFromProcessEnv();
    }
    return Reflect.ownKeys(_env as any);
  },
  getOwnPropertyDescriptor(_target, prop) {
    if (!_env) {
      loadFromProcessEnv();
    }
    return Object.getOwnPropertyDescriptor(_env as any, prop);
  },
});
