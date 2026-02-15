import { Hono } from "hono";
import { executeTool, TOOLS } from "../../../tools";
import { chatWithTools, type Message } from "../../../core/brain";
import { storeMemory, searchMemories } from "../../../core/memory";

// In-memory app registry (production would use DB)
interface RegisteredApp {
  id: string;
  name: string;
  type: string;
  apiKey: string;
  callbackUrl?: string;
  registeredAt: Date;
  lastSeen: Date;
}

const registeredApps = new Map<string, RegisteredApp>();

// Generate a simple UUID-like key
function generateApiKey(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  const segments = [8, 4, 4, 4, 12];
  return "osk_" + segments
    .map((len) => Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join(""))
    .join("-");
}

// Auth middleware - validates API key
async function sdkAuth(c: any, next: any) {
  const authHeader = c.req.header("Authorization");
  if (!authHeader?.startsWith("Bearer osk_")) {
    return c.json({ error: "Invalid or missing API key. Register at POST /api/sdk/register" }, 401);
  }

  const apiKey = authHeader.slice(7);
  const app = Array.from(registeredApps.values()).find((a) => a.apiKey === apiKey);

  if (!app) {
    return c.json({ error: "Unknown API key. Register at POST /api/sdk/register" }, 401);
  }

  app.lastSeen = new Date();
  c.set("sdkApp", app);
  await next();
}

const sdkRoutes = new Hono();

// Registration endpoint (no auth required)
sdkRoutes.post("/register", async (c) => {
  try {
    const body = await c.req.json<{
      name: string;
      type: string;
      callbackUrl?: string;
    }>();

    if (!body.name || !body.type) {
      return c.json({ error: "name and type are required" }, 400);
    }

    // Check if app already registered
    const existing = Array.from(registeredApps.values()).find(
      (a) => a.name === body.name && a.type === body.type
    );
    if (existing) {
      return c.json({
        id: existing.id,
        apiKey: existing.apiKey,
        message: "App already registered",
      });
    }

    const id = crypto.randomUUID();
    const apiKey = generateApiKey();
    const app: RegisteredApp = {
      id,
      name: body.name,
      type: body.type,
      apiKey,
      callbackUrl: body.callbackUrl,
      registeredAt: new Date(),
      lastSeen: new Date(),
    };

    registeredApps.set(id, app);

    return c.json({
      id,
      apiKey,
      message: "App registered successfully. Use this API key in Authorization: Bearer header.",
      endpoints: {
        chat: "POST /api/sdk/chat",
        notify: "POST /api/sdk/notify",
        memory_store: "POST /api/sdk/memory",
        memory_search: "POST /api/sdk/memory/search",
        tools_list: "GET /api/sdk/tools",
        tools_execute: "POST /api/sdk/tools/execute",
        agent_spawn: "POST /api/sdk/agent/spawn",
        status: "GET /api/sdk/status",
      },
    });
  } catch (error) {
    return c.json({ error: "Registration failed" }, 500);
  }
});

// All remaining routes require auth
sdkRoutes.use("/*", sdkAuth);

// Chat - AI-powered conversation with OpenSentinel
sdkRoutes.post("/chat", async (c) => {
  try {
    const app = c.get("sdkApp") as RegisteredApp;
    const body = await c.req.json<{
      message: string;
      context?: string;
      useTools?: boolean;
      systemPrompt?: string;
    }>();

    if (!body.message) {
      return c.json({ error: "message is required" }, 400);
    }

    const messages: Message[] = [];
    if (body.context) {
      messages.push({
        role: "user",
        content: `[Context from ${app.name} (${app.type})]: ${body.context}`,
      });
      messages.push({
        role: "assistant",
        content: "Understood, I have the context. How can I help?",
      });
    }
    messages.push({ role: "user", content: body.message });

    const toolsUsed: string[] = [];
    const response = body.useTools !== false
      ? await chatWithTools(messages, `sdk:${app.id}`, (tool) => toolsUsed.push(tool))
      : await (await import("../../../core/brain")).chat(messages, body.systemPrompt);

    // Store interaction in memory for cross-app intelligence
    await storeMemory({
      content: `[${app.name}] User asked: ${body.message.slice(0, 200)}`,
      type: "episodic",
      importance: 5,
      userId: `sdk:${app.id}`,
      source: `sdk:${app.name}`,
      provenance: `sdk:${app.type}`,
    }).catch(() => {}); // Non-blocking

    return c.json({
      content: response.content,
      toolsUsed,
      usage: {
        inputTokens: response.inputTokens,
        outputTokens: response.outputTokens,
      },
      app: app.name,
    });
  } catch (error) {
    console.error("SDK chat error:", error);
    return c.json({ error: "Chat failed" }, 500);
  }
});

// Notify - Send notification through OpenSentinel channels
sdkRoutes.post("/notify", async (c) => {
  try {
    const app = c.get("sdkApp") as RegisteredApp;
    const body = await c.req.json<{
      channel: "telegram" | "discord" | "slack" | "email" | "all";
      message: string;
      recipient?: string;
      priority?: "low" | "normal" | "high" | "urgent";
    }>();

    if (!body.channel || !body.message) {
      return c.json({ error: "channel and message are required" }, 400);
    }

    const sent: string[] = [];
    const prefix = `[${app.name}] `;
    const fullMessage = prefix + body.message;

    const channels = body.channel === "all"
      ? ["telegram", "discord", "slack"]
      : [body.channel];

    for (const ch of channels) {
      try {
        switch (ch) {
          case "telegram": {
            const { sendTelegramMessage } = await import("../../telegram");
            await sendTelegramMessage(fullMessage);
            sent.push("telegram");
            break;
          }
          case "discord": {
            const { sendDiscordMessage } = await import("../../discord");
            await sendDiscordMessage(fullMessage);
            sent.push("discord");
            break;
          }
          case "slack": {
            const { sendSlackMessage } = await import("../../slack");
            await sendSlackMessage(fullMessage);
            sent.push("slack");
            break;
          }
          case "email": {
            const { sendEmail } = await import("../../../integrations/email");
            await sendEmail({
              to: body.recipient || "",
              subject: `${app.name} Notification`,
              text: body.message,
            });
            sent.push("email");
            break;
          }
        }
      } catch (err) {
        // Channel not configured, skip
      }
    }

    return c.json({ sent, message: `Notification sent via: ${sent.join(", ") || "none (no channels configured)"}` });
  } catch (error) {
    return c.json({ error: "Notification failed" }, 500);
  }
});

// Memory Store
sdkRoutes.post("/memory", async (c) => {
  try {
    const app = c.get("sdkApp") as RegisteredApp;
    const body = await c.req.json<{
      content: string;
      type?: "episodic" | "semantic" | "procedural";
      importance?: number;
      metadata?: Record<string, any>;
    }>();

    if (!body.content) {
      return c.json({ error: "content is required" }, 400);
    }

    const memory = await storeMemory({
      content: body.content,
      type: body.type || "semantic",
      importance: body.importance || 5,
      userId: `sdk:${app.id}`,
      source: `sdk:${app.name}`,
      provenance: `sdk:${app.type}`,
    });

    return c.json(memory);
  } catch (error) {
    return c.json({ error: "Memory store failed" }, 500);
  }
});

// Memory Search
sdkRoutes.post("/memory/search", async (c) => {
  try {
    const app = c.get("sdkApp") as RegisteredApp;
    const body = await c.req.json<{
      query: string;
      limit?: number;
      crossApp?: boolean;
    }>();

    if (!body.query) {
      return c.json({ error: "query is required" }, 400);
    }

    // Cross-app search uses no userId filter; app-specific uses sdk:appId
    const userId = body.crossApp ? undefined : `sdk:${app.id}`;
    const results = await searchMemories(body.query, userId, body.limit || 5);

    return c.json(results);
  } catch (error) {
    return c.json({ error: "Memory search failed" }, 500);
  }
});

// List available tools
sdkRoutes.get("/tools", (c) => {
  const toolList = (TOOLS as any[]).map((t) => ({
    name: t.name,
    description: t.description,
  }));
  return c.json({ tools: toolList, count: toolList.length });
});

// Execute a specific tool
sdkRoutes.post("/tools/execute", async (c) => {
  try {
    const body = await c.req.json<{
      tool: string;
      input: Record<string, any>;
    }>();

    if (!body.tool || !body.input) {
      return c.json({ error: "tool and input are required" }, 400);
    }

    const result = await executeTool(body.tool, body.input);
    return c.json({ tool: body.tool, result });
  } catch (error) {
    return c.json({ error: "Tool execution failed" }, 500);
  }
});

// Spawn a sub-agent
sdkRoutes.post("/agent/spawn", async (c) => {
  try {
    const app = c.get("sdkApp") as RegisteredApp;
    const body = await c.req.json<{
      type: "research" | "coding" | "writing" | "analysis";
      task: string;
      context?: string;
    }>();

    if (!body.type || !body.task) {
      return c.json({ error: "type and task are required" }, 400);
    }

    // Use chat with tools to delegate to an agent
    const agentPrompt = `As a ${body.type} agent for ${app.name}, complete this task: ${body.task}${body.context ? `\n\nContext: ${body.context}` : ""}`;

    const messages: Message[] = [{ role: "user", content: agentPrompt }];
    const toolsUsed: string[] = [];
    const response = await chatWithTools(messages, `sdk:${app.id}:agent:${body.type}`, (tool) => toolsUsed.push(tool));

    return c.json({
      agent: body.type,
      result: response.content,
      toolsUsed,
      usage: {
        inputTokens: response.inputTokens,
        outputTokens: response.outputTokens,
      },
    });
  } catch (error) {
    return c.json({ error: "Agent spawn failed" }, 500);
  }
});

// Status
sdkRoutes.get("/status", (c) => {
  const app = c.get("sdkApp") as RegisteredApp;
  const allApps = Array.from(registeredApps.values()).map((a) => ({
    id: a.id,
    name: a.name,
    type: a.type,
    registeredAt: a.registeredAt,
    lastSeen: a.lastSeen,
  }));

  return c.json({
    opensentinel: {
      status: "online",
      version: "2.2.1",
      uptime: process.uptime(),
    },
    currentApp: {
      id: app.id,
      name: app.name,
      type: app.type,
    },
    registeredApps: allApps,
    tools: (TOOLS as any[]).length,
  });
});

export { sdkRoutes };
