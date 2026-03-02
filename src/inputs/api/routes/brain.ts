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
brainRouter.get("/scores", (c) => {
  return c.json(brainTelemetry.getScores());
});

// GET /api/brain/agents?userId=... — Active and recent agents
brainRouter.get("/agents", async (c) => {
  const userId = c.req.query("userId") || "web:default";
  try {
    const { getUserAgents } = await import("../../../core/agents/agent-manager");
    const agents = await getUserAgents(userId, undefined, 20);
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

export default brainRouter;
