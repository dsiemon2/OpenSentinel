/**
 * Alerts API Routes — Alert management for the dashboard
 */

import { Hono } from "hono";

const alertsRouter = new Hono();

// GET /api/alerts — Active alerts + history
alertsRouter.get("/", async (c) => {
  try {
    const alerting = await import("../../../core/observability/alerting");
    // Ensure DB history is loaded
    await alerting.loadAlertHistoryFromDb?.();
    const active = alerting.getActiveAlerts?.() ?? [];
    const history = alerting.getAlertHistory?.(50) ?? [];
    return c.json({ active, history });
  } catch {
    return c.json({ active: [], history: [] });
  }
});

// POST /api/alerts/:id/acknowledge
alertsRouter.post("/:id/acknowledge", async (c) => {
  try {
    const id = c.req.param("id");
    const { by } = await c.req.json<{ by: string }>();
    const alerting = await import("../../../core/observability/alerting");
    alerting.acknowledgeAlert?.(id, by || "web-user");
    return c.json({ success: true });
  } catch {
    return c.json({ error: "Failed to acknowledge alert" }, 500);
  }
});

// POST /api/alerts/:id/resolve
alertsRouter.post("/:id/resolve", async (c) => {
  try {
    const id = c.req.param("id");
    const { by } = await c.req.json<{ by: string }>();
    const alerting = await import("../../../core/observability/alerting");
    alerting.resolveAlert?.(id, by || "web-user");
    return c.json({ success: true });
  } catch {
    return c.json({ error: "Failed to resolve alert" }, 500);
  }
});

// GET /api/alerts/rules — List alert rules (initialize defaults if empty)
alertsRouter.get("/rules", async (c) => {
  try {
    const alerting = await import("../../../core/observability/alerting");
    let rules = alerting.getAlertRules?.() ?? [];
    // Auto-initialize default rules if none exist
    if (rules.length === 0 && alerting.initializeDefaultRules) {
      alerting.initializeDefaultRules();
      rules = alerting.getAlertRules?.() ?? [];
    }
    return c.json(rules);
  } catch {
    return c.json([]);
  }
});

// DELETE /api/alerts/history — Clear alert history
alertsRouter.delete("/history", async (c) => {
  try {
    const alerting = await import("../../../core/observability/alerting");
    alerting.clearAlertHistory?.();
    return c.json({ success: true });
  } catch {
    return c.json({ error: "Failed to clear alert history" }, 500);
  }
});

// POST /api/alerts/rules — Create alert rule
alertsRouter.post("/rules", async (c) => {
  try {
    const rule = await c.req.json();
    const alerting = await import("../../../core/observability/alerting");
    alerting.addAlertRule?.(rule);
    return c.json({ success: true }, 201);
  } catch {
    return c.json({ error: "Failed to create rule" }, 500);
  }
});

// DELETE /api/alerts/rules/:index — Remove a specific alert rule by ID
alertsRouter.delete("/rules/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const alerting = await import("../../../core/observability/alerting");
    const removed = alerting.removeAlertRule?.(id);
    if (!removed) {
      return c.json({ error: "Rule not found" }, 404);
    }
    return c.json({ success: true });
  } catch {
    return c.json({ error: "Failed to delete rule" }, 500);
  }
});

// PUT /api/alerts/rules/:id — Update a rule's config
alertsRouter.put("/rules/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const updates = await c.req.json();
    const alerting = await import("../../../core/observability/alerting");
    const rules = alerting.getAlertRules?.() ?? [];
    const existing = rules.find((r: any) => r.id === id);
    if (!existing) {
      return c.json({ error: "Rule not found" }, 404);
    }
    // Merge updates and re-add
    const updated = { ...existing, ...updates, id };
    alerting.addAlertRule?.(updated);
    return c.json({ success: true });
  } catch {
    return c.json({ error: "Failed to update rule" }, 500);
  }
});

export default alertsRouter;
