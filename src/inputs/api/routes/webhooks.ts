/**
 * Webhooks API Routes — Webhook/workflow trigger management for the dashboard
 */

import { Hono } from "hono";
import { v4 as uuidv4 } from "uuid";

const webhooksRouter = new Hono();

// GET /api/webhooks — List all workflow triggers (webhook, event, time)
webhooksRouter.get("/", async (c) => {
  try {
    const { WorkflowStore } = await import("../../../core/workflows/workflow-store");
    const store = new WorkflowStore();
    const workflows = await store.getAllWorkflows();
    const results = workflows.map((w: any) => ({
      id: w.id,
      name: w.name,
      description: w.description || "",
      triggerType: Array.isArray(w.triggers) && w.triggers[0]?.type || "webhook",
      trigger: Array.isArray(w.triggers) && w.triggers[0] || {},
      actions: (Array.isArray(w.steps) ? w.steps : []).map((s: any) => ({
        type: s.action?.type || s.type || "unknown",
        name: s.action?.name || s.action?.type || s.type || "action",
      })),
      enabled: w.status === "active",
      createdAt: w.createdAt,
      updatedAt: w.updatedAt,
      lastTriggered: w.lastExecutedAt,
      executionCount: w.executionCount || 0,
    }));
    return c.json(results);
  } catch {
    return c.json([]);
  }
});

// POST /api/webhooks — Create workflow with trigger + actions
webhooksRouter.post("/", async (c) => {
  try {
    const body = await c.req.json<{
      name: string;
      description?: string;
      triggerType: string;
      trigger: Record<string, unknown>;
      actions: Array<{ type: string; config?: Record<string, unknown> }>;
    }>();

    if (!body.name) {
      return c.json({ error: "name is required" }, 400);
    }

    const { WorkflowStore } = await import("../../../core/workflows/workflow-store");
    const store = new WorkflowStore();
    const now = new Date();
    const workflow = await store.createWorkflow({
      id: uuidv4(),
      name: body.name,
      description: body.description,
      status: "active",
      triggers: [{ type: body.triggerType || "webhook", config: body.trigger || {} } as any],
      steps: (body.actions || []).map((a, i) => ({
        id: uuidv4(),
        type: "action" as const,
        action: { type: a.type, config: a.config || {} } as any,
      })),
      executionCount: 0,
      createdAt: now,
      updatedAt: now,
    });
    return c.json({ id: workflow.id, success: true }, 201);
  } catch (err: any) {
    return c.json({ error: err?.message || "Failed to create webhook" }, 500);
  }
});

// PUT /api/webhooks/:id/toggle — Enable/disable a workflow
webhooksRouter.put("/:id/toggle", async (c) => {
  try {
    const id = c.req.param("id");
    const { WorkflowStore } = await import("../../../core/workflows/workflow-store");
    const store = new WorkflowStore();
    const workflow = await store.getWorkflow(id);
    if (!workflow) return c.json({ error: "Workflow not found" }, 404);
    const newStatus = workflow.status === "active" ? "disabled" : "active";
    await store.updateWorkflow(id, { status: newStatus });
    return c.json({ success: true, enabled: newStatus === "active" });
  } catch {
    return c.json({ error: "Failed to toggle webhook" }, 500);
  }
});

// DELETE /api/webhooks/:id — Delete workflow
webhooksRouter.delete("/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const { WorkflowStore } = await import("../../../core/workflows/workflow-store");
    const store = new WorkflowStore();
    await store.deleteWorkflow(id);
    return c.json({ success: true });
  } catch {
    return c.json({ error: "Failed to delete webhook" }, 500);
  }
});

// PUT /api/webhooks/:id — Update webhook name, description, trigger config
webhooksRouter.put("/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const body = await c.req.json<{
      name?: string;
      description?: string;
      triggerType?: string;
      trigger?: Record<string, unknown>;
      actions?: Array<{ type: string; config?: Record<string, unknown> }>;
    }>();

    const { WorkflowStore } = await import("../../../core/workflows/workflow-store");
    const store = new WorkflowStore();
    const workflow = await store.getWorkflow(id);
    if (!workflow) return c.json({ error: "Workflow not found" }, 404);

    const updates: Record<string, unknown> = {};
    if (body.name !== undefined) updates.name = body.name;
    if (body.description !== undefined) updates.description = body.description;
    if (body.triggerType !== undefined || body.trigger !== undefined) {
      updates.triggers = [{ type: body.triggerType || "webhook", config: body.trigger || {} }];
    }
    if (body.actions !== undefined) {
      const { v4: uuidv4Gen } = await import("uuid");
      updates.steps = body.actions.map((a) => ({
        id: uuidv4Gen(),
        type: "action" as const,
        action: { type: a.type, config: a.config || {} },
      }));
    }

    await store.updateWorkflow(id, updates as any);
    return c.json({ success: true });
  } catch {
    return c.json({ error: "Failed to update webhook" }, 500);
  }
});

// POST /api/webhooks/seed — Create default useful webhooks
webhooksRouter.post("/seed", async (c) => {
  try {
    const { WorkflowStore } = await import("../../../core/workflows/workflow-store");
    const store = new WorkflowStore();

    const now = new Date();
    const defaults = [
      {
        name: "GitHub Push Notifications",
        description: "Alert on pushes to main branch via GitHub webhook",
        triggers: [{
          type: "webhook",
          config: {
            path: "/webhooks/github",
            methods: ["POST"],
            secret: "",
            filter: { type: "key_match", expression: "ref", expectedValue: "refs/heads/main" },
          },
        }],
        steps: [
          { id: uuidv4(), type: "action" as const, action: { type: "send_message", config: { channel: "web", message: "New push to main: {{trigger.data.head_commit.message}}" } } },
        ],
      },
      {
        name: "Email-to-Chat Forward",
        description: "Forward important emails to web chat",
        triggers: [{
          type: "event",
          config: { source: "email", eventName: "email_received" },
        }],
        steps: [
          { id: uuidv4(), type: "action" as const, action: { type: "send_message", config: { channel: "web", message: "New email from {{trigger.data.from}}: {{trigger.data.subject}}" } } },
        ],
      },
      {
        name: "Alert on High Error Rate",
        description: "Send notification when error rate spikes",
        triggers: [{
          type: "event",
          config: { source: "alerting", eventName: "alert_fired", filter: { severity: "error" } },
        }],
        steps: [
          { id: uuidv4(), type: "action" as const, action: { type: "send_message", config: { channel: "web", message: "ALERT: {{trigger.data.message}} (severity: {{trigger.data.severity}})" } } },
          { id: uuidv4(), type: "action" as const, action: { type: "log", config: { level: "error", message: "Alert fired: {{trigger.data.message}}" } } },
        ],
      },
      {
        name: "Daily Summary Report",
        description: "Generate and send a daily activity summary at 9 AM",
        triggers: [{
          type: "time",
          config: { pattern: "0 9 * * *", timezone: "America/New_York" },
        }],
        steps: [
          { id: uuidv4(), type: "action" as const, action: { type: "run_tool", config: { tool: "get_time", input: {} } } },
          { id: uuidv4(), type: "action" as const, action: { type: "send_message", config: { channel: "web", message: "Good morning! Here's your daily summary for {{date}}." } } },
        ],
      },
      {
        name: "External API Health Check",
        description: "Monitor external API endpoint every 10 minutes",
        triggers: [{
          type: "time",
          config: { pattern: "*/10 * * * *" },
        }],
        steps: [
          { id: uuidv4(), type: "action" as const, action: { type: "http_request", config: { method: "GET", url: "https://api.github.com/rate_limit", headers: {} } } },
          { id: uuidv4(), type: "action" as const, action: { type: "log", config: { level: "info", message: "Health check completed" } } },
        ],
      },
    ];

    let created = 0;
    const existing = await store.getAllWorkflows();
    const existingNames = new Set(existing.map((w: any) => w.name));

    for (const wf of defaults) {
      if (!existingNames.has(wf.name)) {
        await store.createWorkflow({
          id: uuidv4(),
          ...wf,
          status: "active",
          executionCount: 0,
          createdAt: now,
          updatedAt: now,
        } as any);
        created++;
      }
    }

    return c.json({ success: true, created, total: existing.length + created });
  } catch (err: any) {
    return c.json({ error: err?.message || "Failed to seed webhooks" }, 500);
  }
});

export default webhooksRouter;
