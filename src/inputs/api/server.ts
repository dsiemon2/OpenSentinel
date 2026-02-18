import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
// Use platform-appropriate static file serving
let serveStatic: any;
try {
  // Bun runtime
  serveStatic = require("hono/bun").serveStatic;
} catch {
  // Fallback: no static file serving (API-only mode)
  serveStatic = () => async (_c: any, next: any) => next();
}
import { chat, chatWithTools, streamChat, type Message } from "../../core/brain";
import { transcribeAudio } from "../../outputs/stt";
import { textToSpeech } from "../../outputs/tts";
import { db, conversations, messages, memories } from "../../db";
import { desc, eq } from "drizzle-orm";
import { searchMemories, storeMemory, updateMemory, deleteMemory, exportMemories, getMemoryById } from "../../core/memory";
import { authMiddleware, requirePermission, getAuthUserId } from "../../core/security/auth-middleware";
import { decryptField } from "../../core/security/field-encryption";

const app = new Hono();

// Middleware
app.use("*", logger());
app.use("/api/*", cors());
app.use("/api/*", authMiddleware());

// Health check
app.get("/health", (c) => {
  return c.json({ status: "ok", timestamp: new Date().toISOString() });
});

// ===== Chat API =====

// Simple chat endpoint (no tools)
app.post("/api/chat", async (c) => {
  try {
    const body = await c.req.json<{
      messages: Message[];
      systemPrompt?: string;
    }>();

    if (!body.messages || !Array.isArray(body.messages)) {
      return c.json({ error: "messages array is required" }, 400);
    }

    const response = await chat(body.messages, body.systemPrompt);

    return c.json({
      content: response.content,
      usage: {
        inputTokens: response.inputTokens,
        outputTokens: response.outputTokens,
      },
    });
  } catch (error) {
    console.error("Chat API error:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});

// Chat with tools endpoint
app.post("/api/chat/tools", requirePermission("chat:tools" as any), async (c) => {
  try {
    const body = await c.req.json<{
      messages: Message[];
      userId?: string;
    }>();

    if (!body.messages || !Array.isArray(body.messages)) {
      return c.json({ error: "messages array is required" }, 400);
    }

    const toolsUsed: string[] = [];
    const response = await chatWithTools(body.messages, body.userId, (tool) => {
      toolsUsed.push(tool);
    });

    return c.json({
      content: response.content,
      toolsUsed,
      usage: {
        inputTokens: response.inputTokens,
        outputTokens: response.outputTokens,
      },
    });
  } catch (error) {
    console.error("Chat with tools API error:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});

// Simple single message chat
app.post("/api/ask", async (c) => {
  try {
    const body = await c.req.json<{
      message: string;
      systemPrompt?: string;
      useTools?: boolean;
    }>();

    if (!body.message) {
      return c.json({ error: "message is required" }, 400);
    }

    const messages: Message[] = [{ role: "user", content: body.message }];

    const response = body.useTools
      ? await chatWithTools(messages)
      : await chat(messages, body.systemPrompt);

    return c.json({
      content: response.content,
      toolsUsed: response.toolsUsed,
      usage: {
        inputTokens: response.inputTokens,
        outputTokens: response.outputTokens,
      },
    });
  } catch (error) {
    console.error("Ask API error:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});

// ===== Conversations API =====

app.get("/api/conversations", async (c) => {
  try {
    const convos = await db
      .select()
      .from(conversations)
      .orderBy(desc(conversations.updatedAt))
      .limit(50);

    return c.json(convos);
  } catch (error) {
    console.error("Error fetching conversations:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});

app.get("/api/conversations/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const convo = await db
      .select()
      .from(conversations)
      .where(eq(conversations.id, id))
      .limit(1);

    if (convo.length === 0) {
      return c.json({ error: "Conversation not found" }, 404);
    }

    const msgs = await db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, id))
      .orderBy(messages.createdAt);

    // Decrypt encrypted messages
    const decryptedMsgs = msgs.map((m) => {
      if ((m as any).encrypted && m.content) {
        try {
          return { ...m, content: decryptField(m.content) ?? m.content };
        } catch {
          return m;
        }
      }
      return m;
    });

    return c.json({ conversation: convo[0], messages: decryptedMsgs });
  } catch (error) {
    console.error("Error fetching conversation:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});

// ===== Memories API =====

app.get("/api/memories", async (c) => {
  try {
    const userId = c.req.query("userId");
    const limit = parseInt(c.req.query("limit") || "50");

    let query = db.select().from(memories).orderBy(desc(memories.createdAt)).limit(limit);

    const mems = await query;
    return c.json(mems);
  } catch (error) {
    console.error("Error fetching memories:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});

app.post("/api/memories/search", async (c) => {
  try {
    const body = await c.req.json<{ query: string; userId?: string; limit?: number }>();

    if (!body.query) {
      return c.json({ error: "query is required" }, 400);
    }

    const results = await searchMemories(body.query, body.userId, body.limit || 5);
    return c.json(results);
  } catch (error) {
    console.error("Error searching memories:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});

app.post("/api/memories", async (c) => {
  try {
    const body = await c.req.json<{
      content: string;
      type?: "episodic" | "semantic" | "procedural";
      importance?: number;
      userId?: string;
    }>();

    if (!body.content) {
      return c.json({ error: "content is required" }, 400);
    }

    const memory = await storeMemory({
      content: body.content,
      type: body.type || "semantic",
      importance: body.importance || 5,
      userId: body.userId,
      source: "api",
      provenance: "api:manual",
    });

    return c.json(memory);
  } catch (error) {
    console.error("Error storing memory:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});

// Get a single memory by ID
app.get("/api/memories/export", async (c) => {
  try {
    const userId = c.req.query("userId");
    const format = (c.req.query("format") || "markdown") as "markdown" | "json";

    const exported = await exportMemories(userId || undefined, format);

    if (format === "json") {
      return c.json(JSON.parse(exported));
    }

    return c.text(exported);
  } catch (error) {
    console.error("Error exporting memories:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});

app.get("/api/memories/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const memory = await getMemoryById(id);

    if (!memory) {
      return c.json({ error: "Memory not found" }, 404);
    }

    return c.json(memory);
  } catch (error) {
    console.error("Error fetching memory:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});

// Update a memory
app.put("/api/memories/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const body = await c.req.json<{
      content?: string;
      type?: string;
      importance?: number;
    }>();

    const updated = await updateMemory(id, body);

    if (!updated) {
      return c.json({ error: "Memory not found or no changes" }, 404);
    }

    return c.json(updated);
  } catch (error) {
    console.error("Error updating memory:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});

// Delete a memory (soft-delete to archive)
app.delete("/api/memories/:id", requirePermission("memories:delete" as any), async (c) => {
  try {
    const id = c.req.param("id");
    const deleted = await deleteMemory(id);

    if (!deleted) {
      return c.json({ error: "Memory not found" }, 404);
    }

    return c.json({ success: true, id });
  } catch (error) {
    console.error("Error deleting memory:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});

// ===== Autonomy API =====

app.get("/api/autonomy", async (c) => {
  try {
    const { autonomyManager } = await import("../../core/security/autonomy");
    const userId = c.req.query("userId");
    return c.json({
      level: userId ? autonomyManager.getLevel(userId) : autonomyManager.getDefaultLevel(),
      stats: autonomyManager.getStats(),
    });
  } catch (error) {
    return c.json({ error: "Autonomy system not available" }, 500);
  }
});

app.put("/api/autonomy", async (c) => {
  try {
    const { autonomyManager } = await import("../../core/security/autonomy");
    const body = await c.req.json<{ level: string; userId?: string }>();
    const level = body.level as "readonly" | "supervised" | "autonomous";

    if (!["readonly", "supervised", "autonomous"].includes(level)) {
      return c.json({ error: "Invalid level. Must be: readonly, supervised, or autonomous" }, 400);
    }

    if (body.userId) {
      autonomyManager.setLevel(body.userId, level);
    } else {
      autonomyManager.setDefaultLevel(level);
    }

    return c.json({ success: true, level });
  } catch (error) {
    return c.json({ error: "Autonomy system not available" }, 500);
  }
});

// ===== Prometheus Metrics =====

app.get("/metrics", async (c) => {
  try {
    const { prometheusExporter } = await import("../../core/observability/prometheus");
    const text = prometheusExporter.toTextFormat();
    return c.text(text, 200, { "Content-Type": "text/plain; version=0.0.4; charset=utf-8" });
  } catch (error) {
    return c.text("# Prometheus metrics not available\n", 500);
  }
});

app.get("/api/metrics/prometheus", async (c) => {
  try {
    const { prometheusExporter } = await import("../../core/observability/prometheus");
    const text = prometheusExporter.toTextFormat();
    return c.text(text, 200, { "Content-Type": "text/plain; version=0.0.4; charset=utf-8" });
  } catch (error) {
    return c.text("# Prometheus metrics not available\n", 500);
  }
});

// ===== Pairing API =====

app.post("/api/pair", async (c) => {
  try {
    const { pairingManager } = await import("../../core/security/pairing");
    const body = await c.req.json<{ code: string; deviceInfo?: string }>();

    if (!body.code) {
      return c.json({ error: "code is required" }, 400);
    }

    const result = pairingManager.pair(body.code, body.deviceInfo || "Unknown device");

    if (!result.success) {
      return c.json({ error: result.error }, 401);
    }

    return c.json({ token: result.token });
  } catch (error) {
    return c.json({ error: "Pairing system not available" }, 500);
  }
});

// ===== Providers API =====

app.get("/api/providers", async (c) => {
  try {
    const { providerRegistry } = await import("../../core/providers");
    return c.json({
      providers: providerRegistry.listProviders(),
      default: providerRegistry.getDefaultId(),
    });
  } catch (error) {
    return c.json({ error: "Provider system not available" }, 500);
  }
});

// ===== OSINT API =====
import { osintRoutes } from "./routes/osint";
app.route("/api/osint", osintRoutes);

// ===== SDK API (External App Integration) =====
import { sdkRoutes } from "./routes/sdk";
app.route("/api/sdk", sdkRoutes);

// ===== Incident Response API =====

app.get("/api/incidents", requirePermission("admin:settings" as any), async (c) => {
  try {
    const { getOpenIncidents } = await import("../../core/security/incident-response");
    const severity = c.req.query("severity") as any;
    const type = c.req.query("type") as any;
    const incidents = await getOpenIncidents({ severity, type, limit: 50 });
    return c.json(incidents);
  } catch (error) {
    return c.json({ error: "Incident system not available" }, 500);
  }
});

app.get("/api/incidents/:id", requirePermission("admin:settings" as any), async (c) => {
  try {
    const { generateIncidentReport } = await import("../../core/security/incident-response");
    const id = c.req.param("id");
    const report = await generateIncidentReport(id);
    return c.json(report);
  } catch (error) {
    return c.json({ error: "Incident not found" }, 404);
  }
});

app.post("/api/incidents/:id/status", requirePermission("admin:settings" as any), async (c) => {
  try {
    const { updateIncidentStatus } = await import("../../core/security/incident-response");
    const id = c.req.param("id");
    const body = await c.req.json<{ status: string; notes?: string }>();
    const userId = getAuthUserId(c);
    const updated = await updateIncidentStatus(id, body.status as any, userId, body.notes);
    return c.json(updated);
  } catch (error) {
    return c.json({ error: "Failed to update incident" }, 500);
  }
});

app.post("/api/incidents/:id/resolve", requirePermission("admin:settings" as any), async (c) => {
  try {
    const { resolveIncident } = await import("../../core/security/incident-response");
    const id = c.req.param("id");
    const body = await c.req.json<{ notes: string }>();
    const userId = getAuthUserId(c);
    const resolved = await resolveIncident(id, body.notes, userId);
    return c.json(resolved);
  } catch (error) {
    return c.json({ error: "Failed to resolve incident" }, 500);
  }
});

// ===== Audit Chain Integrity API =====

app.get("/api/audit/integrity", requirePermission("admin:settings" as any), async (c) => {
  try {
    const { getAuditChainIntegrity } = await import("../../core/security/audit-logger");
    const integrity = await getAuditChainIntegrity();
    return c.json(integrity);
  } catch (error) {
    return c.json({ error: "Audit system not available" }, 500);
  }
});

// ===== Voice API (STT / TTS) =====

app.post("/api/transcribe", async (c) => {
  try {
    const formData = await c.req.formData();
    const audioFile = formData.get("audio");

    if (!audioFile || !(audioFile instanceof File)) {
      return c.json({ error: "audio file is required" }, 400);
    }

    const buffer = Buffer.from(await audioFile.arrayBuffer());
    const text = await transcribeAudio(buffer);

    if (!text) {
      return c.json({ error: "Could not transcribe audio" }, 500);
    }

    return c.json({ text });
  } catch (error) {
    console.error("Transcribe API error:", error);
    return c.json({ error: "Transcription failed" }, 500);
  }
});

app.post("/api/tts", async (c) => {
  try {
    const body = await c.req.json<{ text: string }>();

    if (!body.text) {
      return c.json({ error: "text is required" }, 400);
    }

    const audioBuffer = await textToSpeech(body.text);

    if (!audioBuffer) {
      return c.json({ error: "Text-to-speech failed" }, 500);
    }

    return new Response(new Uint8Array(audioBuffer), {
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Length": String(audioBuffer.length),
      },
    });
  } catch (error) {
    console.error("TTS API error:", error);
    return c.json({ error: "TTS failed" }, 500);
  }
});

// ===== System API =====

app.get("/api/system/status", async (c) => {
  // Only expose detailed stats to authenticated requests (Bearer token)
  const authHeader = c.req.header("Authorization");
  if (authHeader?.startsWith("Bearer ")) {
    return c.json({
      status: "online",
      version: "2.7.0",
      uptime: process.uptime(),
      memory: process.memoryUsage(),
    });
  }
  // Public: only expose status and version (no runtime details)
  return c.json({
    status: "online",
    version: "2.7.0",
  });
});

// ===== Spotify OAuth Callback =====

app.get("/api/callbacks/spotify", async (c) => {
  try {
    const code = c.req.query("code");
    const error = c.req.query("error");

    if (error) {
      return c.html(`<h1>Spotify Authorization Failed</h1><p>Error: ${error}</p><p>Go back and try again.</p>`);
    }

    if (!code) {
      return c.html(`<h1>Missing Authorization Code</h1><p>No code received from Spotify.</p>`);
    }

    const { env: appEnv } = await import("../../config/env");
    if (!appEnv.SPOTIFY_CLIENT_ID || !appEnv.SPOTIFY_CLIENT_SECRET) {
      return c.html(`<h1>Spotify Not Configured</h1><p>Set SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET in .env</p>`);
    }

    const { createSpotifyAuth } = await import("../../integrations/spotify/auth");
    const auth = createSpotifyAuth({
      clientId: appEnv.SPOTIFY_CLIENT_ID,
      clientSecret: appEnv.SPOTIFY_CLIENT_SECRET,
      redirectUri: appEnv.SPOTIFY_REDIRECT_URI || `http://localhost:${appEnv.PORT}/api/callbacks/spotify`,
    });

    const tokens = await auth.exchangeCode(code);

    return c.html(`
      <html><body style="font-family: system-ui; max-width: 600px; margin: 40px auto; padding: 20px;">
        <h1>Spotify Connected!</h1>
        <p>Add this to your <code>.env</code> file:</p>
        <pre style="background: #f0f0f0; padding: 16px; border-radius: 8px; word-break: break-all; white-space: pre-wrap;">SPOTIFY_REFRESH_TOKEN=${tokens.refreshToken}</pre>
        <p>Then restart OpenSentinel. You can close this page.</p>
      </body></html>
    `);
  } catch (err) {
    console.error("Spotify callback error:", err);
    return c.html(`<h1>Spotify Auth Error</h1><p>${err instanceof Error ? err.message : String(err)}</p>`);
  }
});

app.get("/api/spotify/authorize", async (c) => {
  try {
    const { env: appEnv } = await import("../../config/env");
    if (!appEnv.SPOTIFY_CLIENT_ID || !appEnv.SPOTIFY_CLIENT_SECRET) {
      return c.json({ error: "Spotify not configured. Set SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET in .env" }, 400);
    }

    const { createSpotifyAuth, DEFAULT_SCOPES } = await import("../../integrations/spotify/auth");
    const auth = createSpotifyAuth({
      clientId: appEnv.SPOTIFY_CLIENT_ID,
      clientSecret: appEnv.SPOTIFY_CLIENT_SECRET,
      redirectUri: appEnv.SPOTIFY_REDIRECT_URI || `http://localhost:${appEnv.PORT}/api/callbacks/spotify`,
    });

    const url = auth.getAuthorizationUrl(DEFAULT_SCOPES, undefined, true);
    return c.json({ url });
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});

// Serve static files from web/dist
app.use("/*", serveStatic({ root: "./src/web/dist" }));

// Fallback to index.html for SPA routing
app.get("/*", serveStatic({ path: "./src/web/dist/index.html" }));

export { app };
