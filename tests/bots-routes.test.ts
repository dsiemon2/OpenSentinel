import { describe, test, expect, beforeAll, beforeEach, mock } from "bun:test";
import { Hono } from "hono";
import * as realFs from "fs";
import * as realEnvModule from "../src/config/env";

// ============================================
// Bots Routes — API Tests
// ============================================
// Tests the bots API: status, fields, config read/write.

// ---------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------

let mockEnvFileContent = `
TELEGRAM_BOT_TOKEN=123456:ABC-DEF1234ghIkl-zyx57W2v
TELEGRAM_CHAT_ID=-1001234567890
DISCORD_BOT_TOKEN=MTIzNDU2Nzg5MDEyMzQ1Njc4.AbCdEf.ghijklmnopqrstuvwxyz1234
DISCORD_CLIENT_ID=123456789012345678
DISCORD_GUILD_ID=987654321098765432
SLACK_BOT_TOKEN=
SLACK_SIGNING_SECRET=
`;

let writtenContent = "";
let writtenPath = "";

// Only intercept .env file operations; pass through everything else
// so other test files that use readFileSync for real files still work.
mock.module("fs", () => ({
  ...realFs,
  readFileSync: (path: string, encoding: string) => {
    if (typeof path === "string" && path.endsWith(".env")) {
      return mockEnvFileContent;
    }
    return realFs.readFileSync(path, encoding as any);
  },
  writeFileSync: (path: string, content: string, encoding: string) => {
    if (typeof path === "string" && path.endsWith(".env")) {
      writtenPath = path;
      writtenContent = content;
      return;
    }
    return realFs.writeFileSync(path, content, encoding as any);
  },
  existsSync: (path: string) => {
    if (typeof path === "string" && path.endsWith(".env")) {
      return true;
    }
    return realFs.existsSync(path);
  },
}));

mock.module("../src/config/env", () => ({
  ...realEnvModule,
  env: {
    ...realEnvModule.env,
    TELEGRAM_BOT_TOKEN: "123456:ABC-DEF1234ghIkl-zyx57W2v",
    TELEGRAM_CHAT_ID: "-1001234567890",
    DISCORD_BOT_TOKEN: "MTIzNDU2Nzg5MDEyMzQ1Njc4.AbCdEf.ghijklmnopqrstuvwxyz1234",
    DISCORD_CLIENT_ID: "123456789012345678",
    DISCORD_GUILD_ID: "987654321098765432",
    DISCORD_ALLOWED_USER_IDS: "111,222,333",
    SLACK_BOT_TOKEN: "",
    SLACK_SIGNING_SECRET: "",
    WHATSAPP_ENABLED: false,
    SIGNAL_ENABLED: false,
    SIGNAL_PHONE_NUMBER: "",
    IMESSAGE_ENABLED: false,
    MATRIX_ENABLED: false,
    MATRIX_HOMESERVER_URL: "",
    MATRIX_ACCESS_TOKEN: "",
  },
}));

// ---------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------

let app: Hono;

async function createTestApp(): Promise<Hono> {
  const botsRouter = (await import("../src/inputs/api/routes/bots")).default;
  const testApp = new Hono();
  testApp.route("/api/bots", botsRouter);
  return testApp;
}

async function req(
  app: Hono,
  method: string,
  path: string,
  body?: any,
): Promise<Response> {
  const init: RequestInit = { method, headers: {} };
  if (body) {
    (init.headers as Record<string, string>)["Content-Type"] = "application/json";
    init.body = JSON.stringify(body);
  }
  return app.request(path, init);
}

// ---------------------------------------------------------------
// Tests
// ---------------------------------------------------------------

describe("Bots Routes", () => {
  beforeAll(async () => {
    app = await createTestApp();
  });

  beforeEach(() => {
    writtenContent = "";
    writtenPath = "";
    mockEnvFileContent = `
TELEGRAM_BOT_TOKEN=123456:ABC-DEF1234ghIkl-zyx57W2v
TELEGRAM_CHAT_ID=-1001234567890
DISCORD_BOT_TOKEN=MTIzNDU2Nzg5MDEyMzQ1Njc4.AbCdEf.ghijklmnopqrstuvwxyz1234
DISCORD_CLIENT_ID=123456789012345678
DISCORD_GUILD_ID=987654321098765432
SLACK_BOT_TOKEN=
SLACK_SIGNING_SECRET=
`;
  });

  describe("GET /api/bots/status", () => {
    test("should return bots array with enabled/disabled based on env tokens", async () => {
      const res = await req(app, "GET", "/api/bots/status");
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json).toHaveProperty("bots");
      expect(json).toHaveProperty("enabledCount");
      expect(json).toHaveProperty("totalCount");
      expect(Array.isArray(json.bots)).toBe(true);
    });

    test("should show telegram as enabled (token set)", async () => {
      const res = await req(app, "GET", "/api/bots/status");
      const json = await res.json();

      const telegram = json.bots.find((b: any) => b.id === "telegram");
      expect(telegram).toBeDefined();
      expect(telegram.enabled).toBe(true);
    });

    test("should show discord as enabled (token set)", async () => {
      const res = await req(app, "GET", "/api/bots/status");
      const json = await res.json();

      const discord = json.bots.find((b: any) => b.id === "discord");
      expect(discord).toBeDefined();
      expect(discord.enabled).toBe(true);
    });

    test("should show slack as disabled (no token)", async () => {
      const res = await req(app, "GET", "/api/bots/status");
      const json = await res.json();

      const slack = json.bots.find((b: any) => b.id === "slack");
      expect(slack).toBeDefined();
      expect(slack.enabled).toBe(false);
    });

    test("should return correct enabledCount", async () => {
      const res = await req(app, "GET", "/api/bots/status");
      const json = await res.json();

      const enabledBots = json.bots.filter((b: any) => b.enabled);
      expect(json.enabledCount).toBe(enabledBots.length);
    });

    test("should return totalCount matching bots array length", async () => {
      const res = await req(app, "GET", "/api/bots/status");
      const json = await res.json();

      expect(json.totalCount).toBe(json.bots.length);
    });
  });

  describe("GET /api/bots/fields", () => {
    test("should return bot field definitions", async () => {
      const res = await req(app, "GET", "/api/bots/fields");
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json).toHaveProperty("telegram");
      expect(json).toHaveProperty("discord");
      expect(json).toHaveProperty("slack");
    });

    test("each field should have key, envVar, label, and type", async () => {
      const res = await req(app, "GET", "/api/bots/fields");
      const json = await res.json();

      for (const [_botId, fields] of Object.entries(json)) {
        for (const field of fields as any[]) {
          expect(field.key).toBeDefined();
          expect(field.envVar).toBeDefined();
          expect(field.label).toBeDefined();
          expect(field.type).toBeDefined();
        }
      }
    });

    test("should include whatsapp, signal, imessage, and matrix", async () => {
      const res = await req(app, "GET", "/api/bots/fields");
      const json = await res.json();

      expect(json).toHaveProperty("whatsapp");
      expect(json).toHaveProperty("signal");
      expect(json).toHaveProperty("imessage");
      expect(json).toHaveProperty("matrix");
    });
  });

  describe("GET /api/bots/:id/config", () => {
    test("should return masked secrets for password fields", async () => {
      const res = await req(app, "GET", "/api/bots/telegram/config");
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.botId).toBe("telegram");
      expect(json.values).toBeDefined();
      // botToken is a password field with length > 10, should be masked as first4...last4
      const maskedToken = json.values.botToken;
      expect(maskedToken).toContain("...");
      expect(maskedToken.startsWith("1234")).toBe(true);
    });

    test("should return non-password fields unmasked", async () => {
      const res = await req(app, "GET", "/api/bots/telegram/config");
      const json = await res.json();

      // chatId is a text field, should be unmasked
      expect(json.values.chatId).toBe("-1001234567890");
    });

    test("should return 404 for unknown bot", async () => {
      const res = await req(app, "GET", "/api/bots/unknownbot/config");
      expect(res.status).toBe(404);

      const json = await res.json();
      expect(json.error).toBeDefined();
    });

    test("should include fields definition in response", async () => {
      const res = await req(app, "GET", "/api/bots/discord/config");
      const json = await res.json();

      expect(json.fields).toBeDefined();
      expect(Array.isArray(json.fields)).toBe(true);
      expect(json.fields.length).toBeGreaterThan(0);
    });
  });

  describe("PUT /api/bots/:id/config", () => {
    test("should write to env file and return success", async () => {
      const res = await req(app, "PUT", "/api/bots/telegram/config", {
        botToken: "newtoken123456789012345678901234",
        chatId: "-9999",
      });
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.success).toBe(true);
    });

    test("should return 404 for unknown bot", async () => {
      const res = await req(app, "PUT", "/api/bots/fakebot/config", {
        something: "value",
      });
      expect(res.status).toBe(404);

      const json = await res.json();
      expect(json.error).toBeDefined();
    });

    test("should skip masked password values containing '...'", async () => {
      const res = await req(app, "PUT", "/api/bots/telegram/config", {
        botToken: "1234...W2v",
        chatId: "-5555",
      });
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.success).toBe(true);
      // The masked token should have been skipped, only chatId updated
      expect(json.updated).toBe(1);
    });

    test("should skip masked password values equal to '****'", async () => {
      const res = await req(app, "PUT", "/api/bots/telegram/config", {
        botToken: "****",
      });
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.updated).toBe(0);
    });

    test("should return note about restart", async () => {
      const res = await req(app, "PUT", "/api/bots/discord/config", {
        clientId: "999888777666555444",
      });
      const json = await res.json();

      expect(json.note).toContain("Restart");
    });
  });
});
