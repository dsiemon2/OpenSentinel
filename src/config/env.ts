import { z } from "zod";

const envSchema = z.object({
  // Claude API
  CLAUDE_API_KEY: z.string().min(1, "CLAUDE_API_KEY is required"),

  // Telegram
  TELEGRAM_BOT_TOKEN: z.string().min(1, "TELEGRAM_BOT_TOKEN is required"),
  TELEGRAM_CHAT_ID: z.string().min(1, "TELEGRAM_CHAT_ID is required"),

  // OpenAI (Whisper STT)
  OPENAI_API_KEY: z.string().min(1, "OPENAI_API_KEY is required"),

  // ElevenLabs TTS
  ELEVENLABS_API_KEY: z.string().min(1, "ELEVENLABS_API_KEY is required"),
  ELEVENLABS_VOICE_ID: z.string().min(1, "ELEVENLABS_VOICE_ID is required"),

  // Database
  DATABASE_URL: z
    .string()
    .default("postgresql://moltbot:moltbot@localhost:5432/moltbot"),

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

  // Optional
  HUGGINGFACE_ACCESS_TOKEN: z.string().optional(),
  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  TWILIO_PHONE_NUMBER: z.string().optional(),

  // Server
  PORT: z.coerce.number().default(8030),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
});

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    console.error("Environment validation failed:");
    for (const error of result.error.errors) {
      console.error(`  - ${error.path.join(".")}: ${error.message}`);
    }
    process.exit(1);
  }

  return result.data;
}

export const env = loadEnv();
