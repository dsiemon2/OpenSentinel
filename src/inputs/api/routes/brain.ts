/**
 * Brain API Routes — Dashboard telemetry endpoints
 *
 * Exposes pipeline status, activity feed, scores, agent data,
 * cost forecasting, and memory-graph data for the Brain dashboard.
 */

import { Hono } from "hono";
import { brainTelemetry } from "../../../core/observability/brain-telemetry";
import { costTracker } from "../../../core/observability/cost-tracker";
import { searchMemories } from "../../../core/memory";

const brainRouter = new Hono();

// GET /api/brain/status — Current brain state (polled every 3s)
brainRouter.get("/status", (c) => {
  return c.json(brainTelemetry.getStatus());
});

// GET /api/brain/activity?limit=100 — Activity feed entries
brainRouter.get("/activity", (c) => {
  const limit = parseInt(c.req.query("limit") || "100");
  return c.json(brainTelemetry.getActivity(Math.min(limit, 500)));
});

// GET /api/brain/scores — Pipeline metrics + cost summary
brainRouter.get("/scores", async (c) => {
  // Ensure cost history is loaded from DB (idempotent)
  await costTracker.loadFromDb();
  return c.json(brainTelemetry.getScores());
});

// GET /api/brain/agents?userId=... — Active and recent agents
brainRouter.get("/agents", async (c) => {
  const userId = c.req.query("userId");
  try {
    const { getUserAgents, getAllAgents } = await import("../../../core/agents/agent-manager");
    const agents = userId
      ? await getUserAgents(userId, undefined, 20)
      : await getAllAgents(undefined, 50);
    return c.json(agents);
  } catch {
    return c.json([]);
  }
});

// GET /api/brain/cost/forecast?days=7 — Cost forecast with trend
brainRouter.get("/cost/forecast", (c) => {
  const days = parseInt(c.req.query("days") || "7");
  return c.json({
    forecast: costTracker.getForecast(days),
    trend: costTracker.getCostTrend(),
    estimatedMonthly: costTracker.getEstimatedMonthlyCost(),
  });
});

// GET /api/brain/memory-graph?entityId=...&limit=50
// Returns memory nodes + optional entity connections for graph overlay
brainRouter.get("/memory-graph", async (c) => {
  const entityId = c.req.query("entityId");
  const limit = parseInt(c.req.query("limit") || "50");

  try {
    // Get recent memories as graph nodes
    const memories = await searchMemories("", undefined, limit);
    const nodes: Array<{
      id: string;
      name: string;
      type: string;
      importance: number;
      content: string;
      createdAt: string;
    }> = [];
    const edges: Array<{
      source: string;
      target: string;
      type: string;
      strength: number;
    }> = [];

    for (const mem of memories) {
      nodes.push({
        id: `mem-${mem.id}`,
        name: (mem.content || "").slice(0, 60) + ((mem.content || "").length > 60 ? "..." : ""),
        type: "memory",
        importance: (mem.importance ?? 5) * 10, // Scale 1-10 to 10-100
        content: mem.content || "",
        createdAt: mem.createdAt?.toISOString?.() || new Date().toISOString(),
      });
    }

    // If entityId provided, try to connect memories to entity
    if (entityId) {
      try {
        const { db } = await import("../../../db");
        const { graphEntities } = await import("../../../db/schema");
        const { eq } = await import("drizzle-orm");

        const [entity] = await db
          .select()
          .from(graphEntities)
          .where(eq(graphEntities.id, entityId))
          .limit(1);

        if (entity) {
          // Add the entity as a node
          nodes.push({
            id: entity.id,
            name: entity.name,
            type: entity.type,
            importance: entity.importance ?? 50,
            content: entity.description || "",
            createdAt: entity.createdAt?.toISOString?.() || new Date().toISOString(),
          });

          // Connect memories to entity by keyword match
          for (const mem of memories) {
            const content = (mem.content || "").toLowerCase();
            if (
              content.includes(entity.name.toLowerCase()) ||
              (entity.aliases as string[] || []).some((a: string) =>
                content.includes(a.toLowerCase())
              )
            ) {
              edges.push({
                source: `mem-${mem.id}`,
                target: entity.id,
                type: "relates_to",
                strength: 60,
              });
            }
          }
        }
      } catch {
        // Entity lookup failed, return memories only
      }
    }

    // Add inter-memory edges for memories of the same type
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        if (
          nodes[i].type === "memory" &&
          nodes[j].type === "memory" &&
          nodes[i].content &&
          nodes[j].content
        ) {
          // Simple keyword overlap check
          const words1 = new Set(nodes[i].content.toLowerCase().split(/\s+/).filter(w => w.length > 4));
          const words2 = new Set(nodes[j].content.toLowerCase().split(/\s+/).filter(w => w.length > 4));
          const overlap = [...words1].filter(w => words2.has(w)).length;
          if (overlap >= 3) {
            edges.push({
              source: nodes[i].id,
              target: nodes[j].id,
              type: "related",
              strength: Math.min(100, overlap * 15),
            });
          }
        }
      }
    }

    return c.json({ nodes, edges });
  } catch (error) {
    return c.json({ nodes: [], edges: [], error: "Failed to build memory graph" }, 500);
  }
});

// GET /api/brain/agents/catalog — Available agent types and their capabilities
brainRouter.get("/agents/catalog", async (c) => {
  try {
    const { AGENT_TOOL_PERMISSIONS } = await import("../../../core/agents/agent-types");
    const configs = await Promise.all([
      import("../../../core/agents/specialized/research-agent").then(m => m.RESEARCH_AGENT_CONFIG),
      import("../../../core/agents/specialized/coding-agent").then(m => m.CODING_AGENT_CONFIG),
      import("../../../core/agents/specialized/writing-agent").then(m => m.WRITING_AGENT_CONFIG),
      import("../../../core/agents/specialized/analysis-agent").then(m => m.ANALYSIS_AGENT_CONFIG),
      import("../../../core/agents/specialized/osint-agent").then(m => m.OSINT_AGENT_CONFIG),
    ]);
    const catalog = configs.map(cfg => ({
      type: cfg.type,
      name: cfg.name,
      description: cfg.description,
      tools: AGENT_TOOL_PERMISSIONS[cfg.type] || [],
      settings: cfg.settings || {},
    }));
    return c.json(catalog);
  } catch {
    return c.json([]);
  }
});

// POST /api/brain/agents/spawn — Spawn a new sub-agent
brainRouter.post("/agents/spawn", async (c) => {
  try {
    const { type, objective } = await c.req.json<{ type: string; objective: string }>();
    if (!type || !objective) {
      return c.json({ error: "type and objective are required" }, 400);
    }
    // Ensure a system user exists for dashboard-spawned tasks
    const { db } = await import("../../../db");
    const { users } = await import("../../../db/schema");
    let systemUser = await db.select().from(users).limit(1);
    if (systemUser.length === 0) {
      systemUser = await db.insert(users).values({ name: "Dashboard" }).returning();
    }
    const { spawnAgent } = await import("../../../core/agents/agent-manager");
    const agent = await spawnAgent({
      type: type as any,
      objective,
      userId: systemUser[0].id,
    });
    return c.json(agent, 201);
  } catch (error: any) {
    return c.json({ error: error?.message || "Failed to spawn agent" }, 500);
  }
});

// POST /api/brain/agents/seed — Seed realistic sample tasks for the dashboard
brainRouter.post("/agents/seed", async (c) => {
  try {
    const { db } = await import("../../../db");
    const { subAgents, agentProgress, users } = await import("../../../db/schema");

    // Ensure a system user exists for seeded tasks
    let systemUser = await db.select().from(users).limit(1);
    if (systemUser.length === 0) {
      systemUser = await db.insert(users).values({
        name: "System",
      }).returning();
    }
    const userId = systemUser[0].id;

    const now = Date.now();
    const tasks = [
      {
        userId,
        type: "research" as const,
        name: "Research Agent",
        status: "completed" as const,
        objective: "Research current best practices for PostgreSQL query optimization and indexing strategies",
        tokenBudget: 50000,
        tokensUsed: 32450,
        createdAt: new Date(now - 3 * 3600_000),
        result: { success: true, summary: "Compiled 12 optimization strategies including partial indexes, covering indexes, and query plan analysis. Key findings: BRIN indexes for time-series data, GIN for JSONB columns, and composite indexes for multi-column queries.", durationMs: 45200 },
      },
      {
        userId,
        type: "coding" as const,
        name: "Coding Agent",
        status: "completed" as const,
        objective: "Implement rate limiting middleware for the API with configurable windows and Redis backing",
        tokenBudget: 80000,
        tokensUsed: 61200,
        createdAt: new Date(now - 6 * 3600_000),
        result: { success: true, summary: "Implemented sliding window rate limiter using Redis ZSET. Supports per-user and per-IP limits with configurable windows (1s, 1m, 1h, 1d). Added X-RateLimit headers and 429 responses.", durationMs: 128400 },
      },
      {
        userId,
        type: "analysis" as const,
        name: "Analysis Agent",
        status: "completed" as const,
        objective: "Analyze token usage patterns over the last 30 days and identify cost optimization opportunities",
        tokenBudget: 40000,
        tokensUsed: 28900,
        createdAt: new Date(now - 12 * 3600_000),
        result: { success: true, summary: "Found 3 key optimization opportunities: 1) System prompts can be shortened by 40% with prompt caching, 2) Research queries could use haiku for initial filtering, 3) Redundant context in multi-turn conversations accounts for 22% of input tokens.", durationMs: 67800 },
      },
      {
        userId,
        type: "writing" as const,
        name: "Writing Agent",
        status: "completed" as const,
        objective: "Generate API documentation for the webhook and scheduler endpoints",
        tokenBudget: 30000,
        tokensUsed: 18700,
        createdAt: new Date(now - 24 * 3600_000),
        result: { success: true, summary: "Generated OpenAPI 3.1 documentation for 8 endpoints across scheduler and webhook routes. Includes request/response schemas, authentication requirements, and usage examples.", durationMs: 34500 },
      },
      {
        userId,
        type: "research" as const,
        name: "Research Agent",
        status: "completed" as const,
        objective: "Gather public information about recent AI security vulnerabilities and prompt injection techniques",
        tokenBudget: 60000,
        tokensUsed: 45300,
        createdAt: new Date(now - 48 * 3600_000),
        result: { success: true, summary: "Compiled report on 15 known prompt injection vectors including indirect injection via retrieved content, multi-modal attacks through images, and tool-use exploitation. Recommended 6 mitigation strategies.", durationMs: 89200 },
      },
      {
        userId,
        type: "research" as const,
        name: "Research Agent",
        status: "failed" as const,
        objective: "Research pgvector HNSW vs IVFFlat index performance for RAG memory retrieval",
        tokenBudget: 50000,
        tokensUsed: 12800,
        createdAt: new Date(now - 2 * 3600_000),
        result: { success: false, error: "Token budget exhausted during benchmark phase. Partial results: HNSW shows better recall at higher ef_search values but IVFFlat index build is 3x faster.", durationMs: 22100 },
      },
      {
        userId,
        type: "coding" as const,
        name: "Coding Agent",
        status: "running" as const,
        objective: "Build automated test suite for the MCP server integration layer",
        tokenBudget: 100000,
        tokensUsed: 34200,
        createdAt: new Date(now - 1800_000),
        result: null,
      },
      {
        userId,
        type: "analysis" as const,
        name: "Analysis Agent",
        status: "pending" as const,
        objective: "Analyze error patterns in the last 7 days and correlate with deployment events",
        tokenBudget: 40000,
        tokensUsed: 0,
        createdAt: new Date(now - 300_000),
        result: null,
      },
    ];

    const inserted = [];
    for (const task of tasks) {
      const [row] = await db.insert(subAgents).values(task as any).returning();
      inserted.push(row);
    }

    // Add progress steps for the running coding task
    const runningTask = inserted.find(t => t.status === "running");
    if (runningTask) {
      await db.insert(agentProgress).values([
        { agentId: runningTask.id, step: 1, description: "Analyzing existing MCP client code and interfaces", status: "completed" as const },
        { agentId: runningTask.id, step: 2, description: "Generating mock MCP server for testing", status: "completed" as const },
        { agentId: runningTask.id, step: 3, description: "Writing connection lifecycle tests", status: "running" as const },
        { agentId: runningTask.id, step: 4, description: "Writing tool discovery and execution tests", status: "pending" as const },
        { agentId: runningTask.id, step: 5, description: "Writing error handling and retry tests", status: "pending" as const },
      ]);
    }

    // Add progress steps for the completed research task
    const researchTask = inserted.find(t => t.status === "completed" && t.type === "research");
    if (researchTask) {
      await db.insert(agentProgress).values([
        { agentId: researchTask.id, step: 1, description: "Surveying PostgreSQL documentation and performance guides", status: "completed" as const },
        { agentId: researchTask.id, step: 2, description: "Analyzing index types: B-tree, Hash, GIN, GiST, BRIN", status: "completed" as const },
        { agentId: researchTask.id, step: 3, description: "Reviewing EXPLAIN ANALYZE best practices", status: "completed" as const },
        { agentId: researchTask.id, step: 4, description: "Compiling optimization recommendations", status: "completed" as const },
      ]);
    }

    return c.json({ success: true, seeded: inserted.length });
  } catch (err: any) {
    return c.json({ error: err?.message || "Failed to seed tasks" }, 500);
  }
});

// DELETE /api/brain/agents/history — Clear completed/failed agent tasks
brainRouter.delete("/agents/history", async (c) => {
  try {
    const { db } = await import("../../../db");
    const { subAgents } = await import("../../../db/schema");
    const { inArray } = await import("drizzle-orm");
    await db.delete(subAgents).where(inArray(subAgents.status, ["completed", "failed", "cancelled"]));
    return c.json({ success: true });
  } catch (err: any) {
    return c.json({ error: err?.message || "Failed to clear task history" }, 500);
  }
});

// DELETE /api/brain/activity — Clear activity feed
brainRouter.delete("/activity", (c) => {
  brainTelemetry.clearActivity?.();
  return c.json({ success: true });
});

export default brainRouter;
