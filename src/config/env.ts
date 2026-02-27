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
    .default(""),

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

  // Local Mail Server (Dovecot master user for multi-account access)
  EMAIL_MASTER_USER: z.string().optional(),
  EMAIL_MASTER_PASSWORD: z.string().optional(),
  EMAIL_LOCAL_IMAP_HOST: z.string().optional().default("127.0.0.1"),
  EMAIL_LOCAL_IMAP_PORT: z.coerce.number().optional().default(993),
  EMAIL_LOCAL_SMTP_HOST: z.string().optional().default("127.0.0.1"),
  EMAIL_LOCAL_SMTP_PORT: z.coerce.number().optional().default(25),

  // GitHub (optional)
  GITHUB_TOKEN: z.string().optional(),
  GITHUB_WEBHOOK_SECRET: z.string().optional(),

  // Google Services (unified OAuth2 — optional, falls back to service-specific)
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_REDIRECT_URI: z.string().optional(),
  GOOGLE_REFRESH_TOKEN: z.string().optional(),

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

  // GIF Search (optional)
  TENOR_API_KEY: z.string().optional(),
  GIPHY_API_KEY: z.string().optional(),

  // Finance (optional)
  ALPHA_VANTAGE_API_KEY: z.string().optional(),
  FRED_API_KEY: z.string().optional(),        // Federal Reserve Economic Data
  FINNHUB_API_KEY: z.string().optional(),     // Finnhub financial market data

  // Exchange Trading (optional)
  COINBASE_API_KEY: z.string().optional(),
  COINBASE_PRIVATE_KEY: z.string().optional(),
  BINANCE_API_KEY: z.string().optional(),
  BINANCE_API_SECRET: z.string().optional(),
  BINANCE_TESTNET: z.coerce.boolean().optional().default(false),
  EXCHANGE_REQUIRE_CONFIRMATION: z.coerce.boolean().optional().default(true),
  EXCHANGE_MAX_TRADE_SIZE: z.coerce.number().optional().default(100),
  EXCHANGE_MAX_DAILY_SPEND: z.coerce.number().optional().default(500),
  EXCHANGE_MAX_TRADES_PER_HOUR: z.coerce.number().optional().default(5),
  EXCHANGE_AGENT_TRADING_ENABLED: z.coerce.boolean().optional().default(false),

  // DeFi (optional)
  DEFILLAMA_API_KEY: z.string().optional(), // Pro tier

  // On-Chain Analytics (optional)
  ETHERSCAN_API_KEY: z.string().optional(),
  ALCHEMY_API_KEY: z.string().optional(),
  ALCHEMY_NETWORK: z.string().optional().default("eth-mainnet"),

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
  SPOTIFY_REDIRECT_URI: z.string().optional(),
  SPOTIFY_REFRESH_TOKEN: z.string().optional(),

  // Google Calendar (optional)
  GOOGLE_CALENDAR_CLIENT_ID: z.string().optional(),
  GOOGLE_CALENDAR_CLIENT_SECRET: z.string().optional(),
  GOOGLE_CALENDAR_REDIRECT_URI: z.string().url().optional(),
  GOOGLE_CALENDAR_REFRESH_TOKEN: z.string().optional(),

  // Outlook Calendar (optional)
  OUTLOOK_CLIENT_ID: z.string().optional(),
  OUTLOOK_CLIENT_SECRET: z.string().optional(),
  OUTLOOK_REDIRECT_URI: z.string().url().optional(),
  OUTLOOK_REFRESH_TOKEN: z.string().optional(),

  // Dropbox (additional OAuth fields)
  DROPBOX_CLIENT_ID: z.string().optional(),
  DROPBOX_CLIENT_SECRET: z.string().optional(),
  DROPBOX_REDIRECT_URI: z.string().url().optional(),

  // MCP (Model Context Protocol)
  MCP_ENABLED: z.coerce.boolean().optional().default(true),
  MCP_CONFIG_PATH: z.string().optional().default("./mcp.json"),

  // Multi-Provider LLM
  LLM_PROVIDER: z.string().optional().default("anthropic"),
  OPENROUTER_API_KEY: z.string().optional(),
  OPENROUTER_BASE_URL: z.string().optional(),
  GROQ_API_KEY: z.string().optional(),
  MISTRAL_API_KEY: z.string().optional(),
  OPENAI_LLM_ENABLED: z.coerce.boolean().optional().default(false),
  OPENAI_COMPATIBLE_API_KEY: z.string().optional(),
  OPENAI_COMPATIBLE_BASE_URL: z.string().optional(),
  OPENAI_COMPATIBLE_MODEL: z.string().optional(),

  // Google Gemini (optional)
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_DEFAULT_MODEL: z.string().optional().default("gemini-2.0-flash"),

  // Ollama (local models)
  OLLAMA_ENABLED: z.coerce.boolean().optional().default(false),
  OLLAMA_BASE_URL: z.string().optional().default("http://localhost:11434"),
  OLLAMA_DEFAULT_MODEL: z.string().optional().default("llama3.1"),

  // Model Routing
  MODEL_ROUTING_ENABLED: z.coerce.boolean().optional().default(true),
  MODEL_OPUS_ENABLED: z.coerce.boolean().optional().default(false),

  // Context Compaction
  COMPACTION_ENABLED: z.coerce.boolean().optional().default(true),
  COMPACTION_TOKEN_THRESHOLD: z.coerce.number().optional().default(80000),
  COMPACTION_PRESERVE_RECENT: z.coerce.number().optional().default(6),

  // Security (OWASP Agentic)
  PROMPT_GUARD_ENABLED: z.coerce.boolean().optional().default(true),
  PROMPT_GUARD_THRESHOLD: z.coerce.number().optional().default(0.7),
  CIRCUIT_BREAKER_ENABLED: z.coerce.boolean().optional().default(true),
  TOOL_SANDBOX_ENABLED: z.coerce.boolean().optional().default(true),

  // Observability
  COST_TRACKING_ENABLED: z.coerce.boolean().optional().default(true),
  QUALITY_SCORING_ENABLED: z.coerce.boolean().optional().default(true),
  REQUEST_TRACING_ENABLED: z.coerce.boolean().optional().default(true),

  // Intent Parser & Gateway
  LOCAL_INTENT_PARSER_ENABLED: z.coerce.boolean().optional().default(true),
  UNIFIED_GATEWAY_ENABLED: z.coerce.boolean().optional().default(false),

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

  // Tunnel Support
  TUNNEL_ENABLED: z.coerce.boolean().optional().default(false),
  TUNNEL_PROVIDER: z.enum(["cloudflare", "ngrok", "localtunnel"]).optional().default("cloudflare"),
  TUNNEL_SUBDOMAIN: z.string().optional(),
  TUNNEL_AUTH_TOKEN: z.string().optional(),

  // Autonomy Levels
  AUTONOMY_LEVEL: z.enum(["readonly", "supervised", "autonomous"]).optional().default("autonomous"),

  // Prometheus/OpenTelemetry
  PROMETHEUS_ENABLED: z.coerce.boolean().optional().default(false),
  PROMETHEUS_PATH: z.string().optional().default("/metrics"),

  // Device Pairing
  PAIRING_ENABLED: z.coerce.boolean().optional().default(false),
  PAIRING_CODE_LIFETIME_MINUTES: z.coerce.number().optional().default(5),

  // Gateway Authentication (OpenClaw-style)
  // If set, web UI and API requests require this token. Unset = open access (localhost-friendly).
  GATEWAY_TOKEN: z.string().optional(),

  // Matrix (optional)
  MATRIX_ENABLED: z.coerce.boolean().optional().default(false),
  MATRIX_HOMESERVER_URL: z.string().optional(),
  MATRIX_ACCESS_TOKEN: z.string().optional(),
  MATRIX_USER_ID: z.string().optional(),
  MATRIX_ALLOWED_ROOM_IDS: z.string().optional(), // Comma-separated
  MATRIX_AUTO_JOIN: z.coerce.boolean().optional().default(true),
  MATRIX_E2E_ENABLED: z.coerce.boolean().optional().default(false),

  // Neo4j (OSINT graph database)
  NEO4J_URI: z.string().optional().default("bolt://localhost:7687"),
  NEO4J_USER: z.string().optional().default("neo4j"),
  NEO4J_PASSWORD: z.string().optional().default(""),
  NEO4J_DATABASE: z.string().optional().default("neo4j"),

  // OSINT API Keys
  FEC_API_KEY: z.string().optional().default(""),
  OPENCORPORATES_API_TOKEN: z.string().optional().default(""),
  SEC_EDGAR_USER_AGENT: z.string().optional().default("OpenSentinel/2.1 (contact@opensentinel.ai)"),

  // OSINT Feature Toggle
  OSINT_ENABLED: z.coerce.boolean().optional().default(false),
  OSINT_RATE_LIMIT_BUFFER_MS: z.coerce.number().optional().default(200),

  // Embedding Provider
  EMBEDDING_PROVIDER: z.enum(["openai", "huggingface", "tfidf"]).optional().default("openai"),
  EMBEDDING_MODEL: z.string().optional(),
  EMBEDDING_DIMENSIONS: z.coerce.number().optional(),
  EMBEDDING_DB_DIMENSIONS: z.coerce.number().optional().default(1536),
  EMBEDDING_BATCH_SIZE: z.coerce.number().optional().default(32),

  // Advanced RAG
  HYDE_ENABLED: z.coerce.boolean().optional().default(false),
  RERANK_ENABLED: z.coerce.boolean().optional().default(false),
  RERANK_MIN_SCORE: z.coerce.number().optional().default(3),
  MULTISTEP_RAG_ENABLED: z.coerce.boolean().optional().default(false),
  MULTISTEP_MAX_STEPS: z.coerce.number().optional().default(2),
  RETRIEVAL_CACHE_ENABLED: z.coerce.boolean().optional().default(false),
  CONTEXTUAL_QUERY_ENABLED: z.coerce.boolean().optional().default(false),

  // SOC 2 Encryption & Audit
  ENCRYPTION_MASTER_KEY: z.string().optional(), // 32-byte base64 key for field encryption
  AUDIT_SIGNING_KEY: z.string().optional(), // HMAC key for tamper-proof audit logs

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
let _providerInitPromise: Promise<void> | null = null;

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

  // Auto-initialize LLM providers after configuration
  _providerInitPromise = import("../core/providers").then((m) => m.initializeProviders()).catch(() => {});

  return _env;
}

/**
 * Wait for provider initialization to complete.
 * Call after configure() if you need providers ready before first API call.
 */
export async function ready(): Promise<void> {
  if (_providerInitPromise) await _providerInitPromise;
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
