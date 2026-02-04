import { describe, test, expect, beforeEach, afterEach, mock } from "bun:test";
import {
  // Triggers
  TriggerManager,
  createTimeTrigger,
  createWebhookTrigger,
  createEventTrigger,
  createConditionTrigger,
  createManualTrigger,
  type TriggerContext,

  // Actions
  ActionExecutor,
  createSendMessageAction,
  createHttpRequestAction,
  createRunToolAction,
  createSendEmailAction,
  createSetVariableAction,
  createDelayAction,
  createLogAction,
  createTransformAction,
  createParallelAction,
  createSequenceAction,
  type ExecutionContext,

  // Conditions
  ConditionEvaluator,
  comparison,
  and,
  or,
  not,
  expression,
  constant,
  branch,
  eq,
  neq,
  gt,
  gte,
  lt,
  lte,
  contains,
  startsWith,
  endsWith,
  matches,
  isNull,
  isNotNull,
  isEmpty,
  isNotEmpty,
  isIn,
  isNotIn,

  // Workflow Engine
  WorkflowEngine,
  createWorkflow,
  type Workflow,

  // Workflow Store
  WorkflowStore,

  // Templates
  workflowTemplates,
  getWorkflowTemplate,
  getWorkflowTemplatesByCategory,
  getTemplateCategories,
  createWorkflowFromTemplate,
} from "../src/core/workflows";

// ============================================
// TRIGGER TESTS
// ============================================

describe("Workflow Triggers", () => {
  let triggerManager: TriggerManager;

  beforeEach(() => {
    triggerManager = new TriggerManager();
  });

  afterEach(() => {
    triggerManager.shutdown();
  });

  describe("TriggerManager", () => {
    test("should create a trigger manager", () => {
      expect(triggerManager).toBeTruthy();
    });

    test("should register and unregister triggers", () => {
      const trigger = createManualTrigger("test-trigger", "Test Trigger");
      triggerManager.registerTrigger(trigger);

      expect(triggerManager.getTrigger("test-trigger")).toBeTruthy();
      expect(triggerManager.getAllTriggers()).toHaveLength(1);

      triggerManager.unregisterTrigger("test-trigger");
      expect(triggerManager.getTrigger("test-trigger")).toBeUndefined();
      expect(triggerManager.getAllTriggers()).toHaveLength(0);
    });

    test("should enable and disable triggers", () => {
      const trigger = createManualTrigger("test-trigger", "Test Trigger", {}, { enabled: false });
      triggerManager.registerTrigger(trigger);

      expect(triggerManager.getTrigger("test-trigger")?.enabled).toBe(false);

      triggerManager.enableTrigger("test-trigger");
      expect(triggerManager.getTrigger("test-trigger")?.enabled).toBe(true);

      triggerManager.disableTrigger("test-trigger");
      expect(triggerManager.getTrigger("test-trigger")?.enabled).toBe(false);
    });

    test("should fire manual triggers", (done) => {
      const trigger = createManualTrigger("manual-test", "Manual Test");
      triggerManager.registerTrigger(trigger);

      triggerManager.on("trigger", (context: TriggerContext) => {
        expect(context.triggerId).toBe("manual-test");
        expect(context.triggerType).toBe("manual");
        expect(context.data.testKey).toBe("testValue");
        done();
      });

      const fired = triggerManager.fireTrigger("manual-test", { testKey: "testValue" });
      expect(fired).toBe(true);
    });

    test("should handle webhook triggers", () => {
      const trigger = createWebhookTrigger("webhook-test", "Webhook Test", {
        path: "/test-webhook",
        methods: ["POST"],
        secret: "test-secret",
      });
      triggerManager.registerTrigger(trigger);

      // Without secret should fail
      const result1 = triggerManager.handleWebhook(
        "/test-webhook",
        "POST",
        { data: "test" },
        {}
      );
      expect(result1).toBe(false);

      // With correct secret should succeed
      const result2 = triggerManager.handleWebhook(
        "/test-webhook",
        "POST",
        { data: "test" },
        { "x-webhook-secret": "test-secret" }
      );
      expect(result2).toBe(true);
    });

    test("should emit events for event triggers", (done) => {
      const trigger = createEventTrigger("event-test", "Event Test", {
        source: "telegram",
        eventName: "message_received",
        filter: { type: "text" },
      });
      triggerManager.registerTrigger(trigger);

      triggerManager.on("trigger", (context: TriggerContext) => {
        expect(context.triggerId).toBe("event-test");
        expect(context.data.content).toBe("Hello");
        done();
      });

      triggerManager.emitEvent("telegram", "message_received", {
        type: "text",
        content: "Hello",
      });
    });

    test("should filter events correctly", () => {
      const trigger = createEventTrigger("filtered-event", "Filtered Event", {
        source: "email",
        eventName: "received",
        filter: { importance: "high" },
      });
      triggerManager.registerTrigger(trigger);

      let triggered = false;
      triggerManager.on("trigger", () => {
        triggered = true;
      });

      // Should not trigger (filter mismatch)
      triggerManager.emitEvent("email", "received", { importance: "low" });
      expect(triggered).toBe(false);

      // Should trigger (filter match)
      triggerManager.emitEvent("email", "received", { importance: "high" });
      expect(triggered).toBe(true);
    });
  });

  describe("Trigger Builders", () => {
    test("should create time trigger with cron", () => {
      const trigger = createTimeTrigger("cron-trigger", "Daily at 9 AM", {
        type: "cron",
        cronExpression: "0 9 * * *",
        timezone: "America/New_York",
      });

      expect(trigger.id).toBe("cron-trigger");
      expect(trigger.type).toBe("time");
      expect(trigger.schedule.type).toBe("cron");
      expect(trigger.schedule.cronExpression).toBe("0 9 * * *");
    });

    test("should create time trigger with interval", () => {
      const trigger = createTimeTrigger("interval-trigger", "Every 5 minutes", {
        type: "interval",
        intervalMs: 5 * 60 * 1000,
      });

      expect(trigger.schedule.type).toBe("interval");
      expect(trigger.schedule.intervalMs).toBe(300000);
    });

    test("should create webhook trigger", () => {
      const trigger = createWebhookTrigger("webhook", "Incoming Webhook", {
        path: "/api/webhook",
        methods: ["POST", "PUT"],
        filter: {
          type: "key_match",
          expression: "event.type",
          expectedValue: "new_order",
        },
      });

      expect(trigger.type).toBe("webhook");
      expect(trigger.webhook.methods).toContain("POST");
      expect(trigger.webhook.filter?.type).toBe("key_match");
    });

    test("should create event trigger", () => {
      const trigger = createEventTrigger("event", "Message Received", {
        source: "telegram",
        eventName: "message",
        filter: { isCommand: true },
      });

      expect(trigger.type).toBe("event");
      expect(trigger.event.source).toBe("telegram");
    });

    test("should create condition trigger", () => {
      const trigger = createConditionTrigger("condition", "API Check", {
        checkType: "api_response",
        apiEndpoint: "https://api.example.com/health",
        operator: "equals",
        value: { status: "ok" },
        pollInterval: 60000,
      });

      expect(trigger.type).toBe("condition");
      expect(trigger.condition.checkType).toBe("api_response");
    });

    test("should create manual trigger", () => {
      const trigger = createManualTrigger("manual", "Manual Run", {
        inputSchema: {
          type: "object",
          properties: { message: { type: "string" } },
        },
      });

      expect(trigger.type).toBe("manual");
      expect(trigger.manual.inputSchema).toBeTruthy();
    });
  });
});

// ============================================
// ACTION TESTS
// ============================================

describe("Workflow Actions", () => {
  let actionExecutor: ActionExecutor;
  let mockContext: ExecutionContext;

  beforeEach(() => {
    actionExecutor = new ActionExecutor();
    mockContext = {
      workflowId: "test-workflow",
      executionId: "test-execution",
      triggerContext: {
        triggerId: "test-trigger",
        triggerType: "manual",
        triggerName: "Test Trigger",
        timestamp: new Date(),
        data: { input: "test-input" },
      },
      variables: new Map([
        ["testVar", "testValue"],
        ["count", 42],
      ]),
    };
  });

  describe("ActionExecutor", () => {
    test("should create an action executor", () => {
      expect(actionExecutor).toBeTruthy();
    });

    test("should execute set variable action", async () => {
      const action = createSetVariableAction("set-var", "Set Variable", {
        name: "newVar",
        value: "Hello {{testVar}}!",
      });

      const result = await actionExecutor.execute(action, mockContext);

      expect(result.success).toBe(true);
      expect(mockContext.variables.get("newVar")).toBe("Hello testValue!");
    });

    test("should execute delay action", async () => {
      const action = createDelayAction("delay", "Wait", 100);

      const start = Date.now();
      const result = await actionExecutor.execute(action, mockContext);
      const elapsed = Date.now() - start;

      expect(result.success).toBe(true);
      expect(elapsed).toBeGreaterThanOrEqual(90); // Allow some tolerance
    });

    test("should execute log action", async () => {
      const originalLog = console.info;
      let loggedMessage = "";
      console.info = (...args: unknown[]) => {
        loggedMessage = args.join(" ");
      };

      const action = createLogAction("log", "Log Message", {
        level: "info",
        message: "Test log with {{testVar}}",
      });

      const result = await actionExecutor.execute(action, mockContext);

      expect(result.success).toBe(true);
      expect(loggedMessage).toContain("Test log with testValue");

      console.info = originalLog;
    });

    test("should execute transform action with pick", async () => {
      mockContext.variables.set("userData", {
        name: "John",
        email: "john@example.com",
        age: 30,
        password: "secret",
      });

      const action = createTransformAction("transform", "Pick Fields", {
        input: "userData",
        output: "publicData",
        operations: [{ type: "pick", keys: ["name", "email"] }],
      });

      const result = await actionExecutor.execute(action, mockContext);

      expect(result.success).toBe(true);
      const publicData = mockContext.variables.get("publicData") as Record<string, unknown>;
      expect(publicData.name).toBe("John");
      expect(publicData.email).toBe("john@example.com");
      expect(publicData.password).toBeUndefined();
    });

    test("should execute transform action with omit", async () => {
      mockContext.variables.set("userData", {
        name: "John",
        email: "john@example.com",
        password: "secret",
      });

      const action = createTransformAction("transform", "Omit Fields", {
        input: "userData",
        output: "safeData",
        operations: [{ type: "omit", keys: ["password"] }],
      });

      const result = await actionExecutor.execute(action, mockContext);

      expect(result.success).toBe(true);
      const safeData = mockContext.variables.get("safeData") as Record<string, unknown>;
      expect(safeData.name).toBe("John");
      expect(safeData.password).toBeUndefined();
    });

    test("should execute sequence action", async () => {
      const action = createSequenceAction("sequence", "Run Sequence", [
        createSetVariableAction("step1", "Step 1", { name: "seq1", value: "first" }),
        createSetVariableAction("step2", "Step 2", { name: "seq2", value: "second" }),
        createSetVariableAction("step3", "Step 3", { name: "seq3", value: "third" }),
      ]);

      const result = await actionExecutor.execute(action, mockContext);

      expect(result.success).toBe(true);
      expect(mockContext.variables.get("seq1")).toBe("first");
      expect(mockContext.variables.get("seq2")).toBe("second");
      expect(mockContext.variables.get("seq3")).toBe("third");
    });

    test("should execute parallel action", async () => {
      const action = createParallelAction(
        "parallel",
        "Run Parallel",
        [
          createDelayAction("delay1", "Delay 1", 50),
          createDelayAction("delay2", "Delay 2", 50),
          createDelayAction("delay3", "Delay 3", 50),
        ],
        { waitAll: true }
      );

      const start = Date.now();
      const result = await actionExecutor.execute(action, mockContext);
      const elapsed = Date.now() - start;

      expect(result.success).toBe(true);
      // Parallel execution should take roughly 50ms, not 150ms
      expect(elapsed).toBeLessThan(100);
    });

    test("should handle action retry", async () => {
      let attempts = 0;
      const originalFetch = globalThis.fetch;

      globalThis.fetch = async () => {
        attempts++;
        if (attempts < 3) {
          throw new Error("Connection failed");
        }
        return new Response(JSON.stringify({ success: true }), {
          headers: { "content-type": "application/json" },
        });
      };

      const action = createHttpRequestAction(
        "retry-test",
        "Retry Test",
        { method: "GET", url: "https://example.com/api" },
        { retry: { maxAttempts: 3, delayMs: 10 } }
      );

      const result = await actionExecutor.execute(action, mockContext);

      expect(result.success).toBe(true);
      expect(result.retryCount).toBe(2);
      expect(attempts).toBe(3);

      globalThis.fetch = originalFetch;
    });

    test("should handle continueOnError", async () => {
      const originalFetch = globalThis.fetch;
      globalThis.fetch = async () => {
        throw new Error("Network error");
      };

      const action = createHttpRequestAction(
        "error-test",
        "Error Test",
        { method: "GET", url: "https://example.com/api" },
        { continueOnError: true }
      );

      const result = await actionExecutor.execute(action, mockContext);

      expect(result.success).toBe(false);
      expect(result.error).toContain("Network error");

      globalThis.fetch = originalFetch;
    });
  });

  describe("Action Builders", () => {
    test("should create send message action", () => {
      const action = createSendMessageAction("send", "Send Message", {
        channel: "telegram",
        target: "123456",
        content: "Hello, World!",
        format: "markdown",
      });

      expect(action.type).toBe("send_message");
      expect(action.message.channel).toBe("telegram");
    });

    test("should create HTTP request action", () => {
      const action = createHttpRequestAction("http", "Make Request", {
        method: "POST",
        url: "https://api.example.com/data",
        headers: { "Content-Type": "application/json" },
        body: { key: "value" },
        timeout: 5000,
      });

      expect(action.type).toBe("http_request");
      expect(action.request.method).toBe("POST");
    });

    test("should create run tool action", () => {
      const action = createRunToolAction("tool", "Run Tool", {
        name: "execute_command",
        input: { command: "ls -la" },
        storeResultIn: "cmdResult",
      });

      expect(action.type).toBe("run_tool");
      expect(action.tool.name).toBe("execute_command");
    });

    test("should create send email action", () => {
      const action = createSendEmailAction("email", "Send Email", {
        to: "user@example.com",
        subject: "Test Email",
        body: "This is a test email.",
        bodyType: "text",
      });

      expect(action.type).toBe("send_email");
      expect(action.email.to).toBe("user@example.com");
    });
  });
});

// ============================================
// CONDITION TESTS
// ============================================

describe("Workflow Conditions", () => {
  let conditionEvaluator: ConditionEvaluator;
  let mockContext: ExecutionContext;

  beforeEach(() => {
    conditionEvaluator = new ConditionEvaluator();
    mockContext = {
      workflowId: "test-workflow",
      executionId: "test-execution",
      triggerContext: {
        triggerId: "test-trigger",
        triggerType: "manual",
        triggerName: "Test Trigger",
        timestamp: new Date(),
        data: { value: 100, name: "test" },
      },
      variables: new Map([
        ["status", "active"],
        ["count", 42],
        ["items", ["a", "b", "c"]],
        ["user", { name: "John", age: 30 }],
      ]),
    };
  });

  describe("ConditionEvaluator", () => {
    test("should create a condition evaluator", () => {
      expect(conditionEvaluator).toBeTruthy();
    });

    test("should evaluate comparison conditions", () => {
      // Equals
      expect(
        conditionEvaluator.evaluate(eq("status", "active"), mockContext)
      ).toBe(true);

      // Not equals
      expect(
        conditionEvaluator.evaluate(neq("status", "inactive"), mockContext)
      ).toBe(true);

      // Greater than
      expect(
        conditionEvaluator.evaluate(gt("count", 40), mockContext)
      ).toBe(true);
      expect(
        conditionEvaluator.evaluate(gt("count", 50), mockContext)
      ).toBe(false);

      // Greater than or equals
      expect(
        conditionEvaluator.evaluate(gte("count", 42), mockContext)
      ).toBe(true);

      // Less than
      expect(
        conditionEvaluator.evaluate(lt("count", 50), mockContext)
      ).toBe(true);

      // Less than or equals
      expect(
        conditionEvaluator.evaluate(lte("count", 42), mockContext)
      ).toBe(true);
    });

    test("should evaluate string conditions", () => {
      mockContext.variables.set("text", "Hello, World!");

      expect(
        conditionEvaluator.evaluate(contains("text", "World"), mockContext)
      ).toBe(true);

      expect(
        conditionEvaluator.evaluate(startsWith("text", "Hello"), mockContext)
      ).toBe(true);

      expect(
        conditionEvaluator.evaluate(endsWith("text", "!"), mockContext)
      ).toBe(true);

      expect(
        conditionEvaluator.evaluate(matches("text", "^Hello.*!$"), mockContext)
      ).toBe(true);
    });

    test("should evaluate null/empty conditions", () => {
      mockContext.variables.set("nullVar", null);
      mockContext.variables.set("emptyString", "");
      mockContext.variables.set("emptyArray", []);
      mockContext.variables.set("nonEmpty", "value");

      expect(
        conditionEvaluator.evaluate(isNull("nullVar"), mockContext)
      ).toBe(true);

      expect(
        conditionEvaluator.evaluate(isNull("nonEmpty"), mockContext)
      ).toBe(false);

      expect(
        conditionEvaluator.evaluate(isNotNull("nonEmpty"), mockContext)
      ).toBe(true);

      expect(
        conditionEvaluator.evaluate(isEmpty("emptyString"), mockContext)
      ).toBe(true);

      expect(
        conditionEvaluator.evaluate(isEmpty("emptyArray"), mockContext)
      ).toBe(true);

      expect(
        conditionEvaluator.evaluate(isNotEmpty("items"), mockContext)
      ).toBe(true);
    });

    test("should evaluate in/not in conditions", () => {
      expect(
        conditionEvaluator.evaluate(isIn("status", ["active", "pending"]), mockContext)
      ).toBe(true);

      expect(
        conditionEvaluator.evaluate(isIn("status", ["inactive", "suspended"]), mockContext)
      ).toBe(false);

      expect(
        conditionEvaluator.evaluate(isNotIn("status", ["inactive"]), mockContext)
      ).toBe(true);
    });

    test("should evaluate logical AND conditions", () => {
      const condition = and(
        eq("status", "active"),
        gt("count", 40)
      );

      expect(conditionEvaluator.evaluate(condition, mockContext)).toBe(true);

      const falseCondition = and(
        eq("status", "active"),
        gt("count", 50) // count is 42
      );

      expect(conditionEvaluator.evaluate(falseCondition, mockContext)).toBe(false);
    });

    test("should evaluate logical OR conditions", () => {
      const condition = or(
        eq("status", "inactive"),
        gt("count", 40)
      );

      expect(conditionEvaluator.evaluate(condition, mockContext)).toBe(true);
    });

    test("should evaluate logical NOT conditions", () => {
      const condition = not(eq("status", "inactive"));

      expect(conditionEvaluator.evaluate(condition, mockContext)).toBe(true);
    });

    test("should evaluate nested logical conditions", () => {
      const condition = and(
        or(
          eq("status", "active"),
          eq("status", "pending")
        ),
        not(lt("count", 10))
      );

      expect(conditionEvaluator.evaluate(condition, mockContext)).toBe(true);
    });

    test("should evaluate expression conditions", () => {
      const condition = expression("variables.count > 40 && variables.status === 'active'");

      expect(conditionEvaluator.evaluate(condition, mockContext)).toBe(true);
    });

    test("should evaluate constant conditions", () => {
      expect(conditionEvaluator.evaluate(constant(true), mockContext)).toBe(true);
      expect(conditionEvaluator.evaluate(constant(false), mockContext)).toBe(false);
    });

    test("should evaluate conditional branches", () => {
      const trueBranch = branch(
        gt("count", 40),
        ["then-action"],
        ["else-action"]
      );

      expect(conditionEvaluator.evaluateBranch(trueBranch, mockContext)).toEqual(["then-action"]);

      const falseBranch = branch(
        gt("count", 50),
        ["then-action"],
        ["else-action"]
      );

      expect(conditionEvaluator.evaluateBranch(falseBranch, mockContext)).toEqual(["else-action"]);
    });

    test("should resolve nested variable paths", () => {
      const condition = comparison("user.age", "greater_than", { literal: 25 });

      expect(conditionEvaluator.evaluate(condition, mockContext)).toBe(true);
    });

    test("should access trigger context data", () => {
      const condition = eq("trigger.data.value", 100);

      expect(conditionEvaluator.evaluate(condition, mockContext)).toBe(true);
    });
  });
});

// ============================================
// WORKFLOW ENGINE TESTS
// ============================================

describe("Workflow Engine", () => {
  let workflowEngine: WorkflowEngine;

  beforeEach(() => {
    workflowEngine = new WorkflowEngine();
  });

  afterEach(() => {
    workflowEngine.shutdown();
  });

  describe("WorkflowEngine", () => {
    test("should create a workflow engine", () => {
      expect(workflowEngine).toBeTruthy();
    });

    test("should register and unregister workflows", () => {
      const workflow = createWorkflow("test-workflow", "Test Workflow")
        .trigger(createManualTrigger("trigger", "Manual"))
        .action(createLogAction("log", "Log", { level: "info", message: "Test" }))
        .build();

      workflowEngine.registerWorkflow(workflow);

      expect(workflowEngine.getWorkflow("test-workflow")).toBeTruthy();
      expect(workflowEngine.getAllWorkflows()).toHaveLength(1);

      workflowEngine.unregisterWorkflow("test-workflow");

      expect(workflowEngine.getWorkflow("test-workflow")).toBeUndefined();
    });

    test("should update workflow status", () => {
      const workflow = createWorkflow("test-workflow", "Test Workflow")
        .trigger(createManualTrigger("trigger", "Manual"))
        .build();

      workflowEngine.registerWorkflow(workflow);

      workflowEngine.updateWorkflowStatus("test-workflow", "paused");
      expect(workflowEngine.getWorkflow("test-workflow")?.status).toBe("paused");

      workflowEngine.updateWorkflowStatus("test-workflow", "active");
      expect(workflowEngine.getWorkflow("test-workflow")?.status).toBe("active");
    });

    test("should execute workflow manually", async () => {
      const workflow = createWorkflow("test-workflow", "Test Workflow")
        .trigger(createManualTrigger("trigger", "Manual"))
        .action(createSetVariableAction("set", "Set Var", { name: "result", value: "done" }))
        .build();

      workflowEngine.registerWorkflow(workflow);

      const execution = await workflowEngine.executeWorkflow("test-workflow", { input: "test" });

      expect(execution.status).toBe("completed");
      expect(execution.stepResults).toHaveLength(1);
      expect(execution.variables.result).toBe("done");
    });

    test("should track execution history", async () => {
      const workflow = createWorkflow("test-workflow", "Test Workflow")
        .trigger(createManualTrigger("trigger", "Manual"))
        .action(createDelayAction("delay", "Wait", 10))
        .build();

      workflowEngine.registerWorkflow(workflow);

      await workflowEngine.executeWorkflow("test-workflow");
      await workflowEngine.executeWorkflow("test-workflow");
      await workflowEngine.executeWorkflow("test-workflow");

      const history = workflowEngine.getExecutionHistory("test-workflow");

      expect(history).toHaveLength(3);
    });

    test("should handle workflow with conditions", async () => {
      const workflow = createWorkflow("conditional-workflow", "Conditional Workflow")
        .trigger(createManualTrigger("trigger", "Manual"))
        .variables({ count: 100 })
        .condition(
          branch(
            gt("count", 50),
            [
              {
                id: "then-step",
                type: "action",
                action: createSetVariableAction("high", "Set High", { name: "level", value: "high" }),
              },
            ],
            [
              {
                id: "else-step",
                type: "action",
                action: createSetVariableAction("low", "Set Low", { name: "level", value: "low" }),
              },
            ]
          )
        )
        .build();

      workflowEngine.registerWorkflow(workflow);

      const execution = await workflowEngine.executeWorkflow("conditional-workflow");

      expect(execution.status).toBe("completed");
      expect(execution.variables.level).toBe("high");
    });

    test("should respect rate limiting", async () => {
      const workflow = createWorkflow("rate-limited", "Rate Limited")
        .trigger(createManualTrigger("trigger", "Manual"))
        .action(createDelayAction("delay", "Wait", 1))
        .rateLimit(2, 60000) // Max 2 executions per minute
        .build();

      workflowEngine.registerWorkflow(workflow);

      await workflowEngine.executeWorkflow("rate-limited");
      await workflowEngine.executeWorkflow("rate-limited");

      // Third execution should be rate limited
      await expect(
        workflowEngine.executeWorkflow("rate-limited")
      ).rejects.toThrow("rate limit exceeded");
    });

    test("should cancel running execution", async () => {
      const workflow = createWorkflow("cancellable", "Cancellable Workflow")
        .trigger(createManualTrigger("trigger", "Manual"))
        // Use multiple small delays instead of one long one so cancellation can take effect between steps
        .action(createSetVariableAction("set1", "Set 1", { name: "step", value: "1" }))
        .action(createDelayAction("delay1", "Delay 1", 50))
        .action(createSetVariableAction("set2", "Set 2", { name: "step", value: "2" }))
        .action(createDelayAction("delay2", "Delay 2", 50))
        .action(createSetVariableAction("set3", "Set 3", { name: "step", value: "3" }))
        .action(createDelayAction("delay3", "Delay 3", 5000)) // Long delay at the end
        .build();

      workflowEngine.registerWorkflow(workflow);

      // Track execution ID through the event
      let capturedExecutionId: string | null = null;
      workflowEngine.on("execution:started", (execution: { id: string }) => {
        capturedExecutionId = execution.id;
      });

      // Start execution in background (don't await)
      const executionPromise = workflowEngine.executeWorkflow("cancellable");

      // Give it time to process a few steps
      await new Promise((resolve) => setTimeout(resolve, 200));

      // Verify we captured the execution ID
      expect(capturedExecutionId).not.toBeNull();

      // Cancel it - this will mark it as cancelled and the loop should stop
      const cancelled = workflowEngine.cancelExecution(capturedExecutionId!);
      expect(cancelled).toBe(true);

      // The execution was marked as cancelled; verify the cancellation was recorded
      const execution = workflowEngine.getExecution(capturedExecutionId!);
      expect(execution?.status).toBe("cancelled");
    });
  });

  describe("WorkflowBuilder", () => {
    test("should build a complete workflow", () => {
      const workflow = createWorkflow("complete-workflow", "Complete Workflow")
        .description("A complete workflow for testing")
        .userId("user-123")
        .trigger(createManualTrigger("trigger", "Manual Trigger"))
        .trigger(createTimeTrigger("scheduled", "Daily", { type: "cron", cronExpression: "0 9 * * *" }))
        .action(createLogAction("log1", "Log Start", { level: "info", message: "Starting" }))
        .action(createSetVariableAction("set1", "Set Var", { name: "processed", value: true }))
        .variables({ initial: "value" })
        .onError({ action: "stop", notify: { channel: "telegram", target: "123" } })
        .rateLimit(10, 3600000)
        .tags("test", "complete")
        .metadata({ version: "1.0" })
        .status("active")
        .build();

      expect(workflow.id).toBe("complete-workflow");
      expect(workflow.name).toBe("Complete Workflow");
      expect(workflow.description).toBe("A complete workflow for testing");
      expect(workflow.userId).toBe("user-123");
      expect(workflow.triggers).toHaveLength(2);
      expect(workflow.steps).toHaveLength(2);
      expect(workflow.variables?.initial).toBe("value");
      expect(workflow.onError?.action).toBe("stop");
      expect(workflow.rateLimit?.maxExecutions).toBe(10);
      expect(workflow.tags).toContain("test");
      expect(workflow.metadata?.version).toBe("1.0");
      expect(workflow.status).toBe("active");
    });
  });
});

// ============================================
// WORKFLOW TEMPLATES TESTS
// ============================================

describe("Workflow Templates", () => {
  test("should have built-in templates", () => {
    expect(workflowTemplates.length).toBeGreaterThan(0);
  });

  test("should get template by ID", () => {
    const template = getWorkflowTemplate("daily-summary");

    expect(template).toBeTruthy();
    expect(template?.name).toBe("Daily Summary");
    expect(template?.category).toBe("notifications");
  });

  test("should get templates by category", () => {
    const notificationTemplates = getWorkflowTemplatesByCategory("notifications");

    expect(notificationTemplates.length).toBeGreaterThan(0);
    expect(notificationTemplates.every((t) => t.category === "notifications")).toBe(true);
  });

  test("should get all categories", () => {
    const categories = getTemplateCategories();

    expect(categories).toContain("notifications");
    expect(categories).toContain("integrations");
    expect(categories).toContain("monitoring");
    expect(categories).toContain("automation");
  });

  test("should create workflow from daily-summary template", () => {
    const workflow = createWorkflowFromTemplate("daily-summary", {
      userId: "user-123",
      cronExpression: "0 8 * * *",
      timezone: "America/New_York",
      channel: "telegram",
      chatId: "123456",
      message: "Good morning! Have a great day!",
    });

    expect(workflow).toBeTruthy();
    expect(workflow?.name).toBe("Daily Summary");
    expect(workflow?.triggers[0].type).toBe("time");
    expect(workflow?.steps[0].type).toBe("action");
  });

  test("should create workflow from webhook-notification template", () => {
    const workflow = createWorkflowFromTemplate("webhook-notification", {
      userId: "user-123",
      webhookPath: "/webhooks/user-123",
      secret: "my-secret",
      channel: "telegram",
      chatId: "123456",
    });

    expect(workflow).toBeTruthy();
    expect(workflow?.triggers[0].type).toBe("webhook");
  });

  test("should create workflow from api-health-check template", () => {
    const workflow = createWorkflowFromTemplate("api-health-check", {
      userId: "user-123",
      apiUrl: "https://api.example.com/health",
      intervalMinutes: 10,
      alertChannel: "telegram",
      chatId: "123456",
    });

    expect(workflow).toBeTruthy();
    expect(workflow?.triggers[0].type).toBe("time");
  });

  test("should create workflow from tool-automation template", () => {
    const workflow = createWorkflowFromTemplate("tool-automation", {
      userId: "user-123",
      workflowName: "Daily Backup",
      triggerType: "cron",
      cronExpression: "0 2 * * *",
      toolName: "execute_command",
      toolInput: { command: "backup.sh" },
      notifyOnComplete: true,
      channel: "telegram",
      chatId: "123456",
    });

    expect(workflow).toBeTruthy();
    expect(workflow?.name).toBe("Daily Backup");
  });

  test("should return null for non-existent template", () => {
    const workflow = createWorkflowFromTemplate("non-existent", {});

    expect(workflow).toBeNull();
  });
});

// ============================================
// WORKFLOW STORE TESTS
// ============================================

describe("Workflow Store", () => {
  test("should create a workflow store", () => {
    const store = new WorkflowStore();
    expect(store).toBeTruthy();
  });

  test("should have database schema exports", () => {
    const { workflows, workflowExecutions } = require("../src/core/workflows/workflow-store");

    expect(workflows).toBeTruthy();
    expect(workflowExecutions).toBeTruthy();
  });

  test("should convert DB workflow to domain workflow", () => {
    const store = new WorkflowStore();

    const dbWorkflow = {
      id: "test-id",
      name: "Test Workflow",
      description: "Test description",
      userId: "user-123",
      status: "active" as const,
      triggers: [{ id: "t1", type: "manual", name: "Manual", enabled: true, manual: {} }],
      steps: [{ id: "s1", type: "action", action: { id: "a1", type: "log", name: "Log", log: { level: "info", message: "test" } } }],
      variables: { key: "value" },
      metadata: { version: "1" },
      onError: null,
      rateLimit: null,
      tags: ["test"],
      lastExecutedAt: null,
      lastExecutionId: null,
      lastExecutionStatus: null,
      executionCount: 5,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const workflow = store.toWorkflow(dbWorkflow);

    expect(workflow.id).toBe("test-id");
    expect(workflow.name).toBe("Test Workflow");
    expect(workflow.status).toBe("active");
    expect(workflow.executionCount).toBe(5);
    expect(workflow.triggers).toHaveLength(1);
    expect(workflow.steps).toHaveLength(1);
  });

  test("should convert DB execution to domain execution", () => {
    const store = new WorkflowStore();

    const dbExecution = {
      id: "exec-id",
      workflowId: "workflow-id",
      workflowName: "Test Workflow",
      status: "completed" as const,
      triggerContext: {
        triggerId: "t1",
        triggerType: "manual",
        triggerName: "Manual",
        timestamp: new Date(),
        data: {},
      },
      stepResults: [{ stepId: "s1", stepType: "action", success: true }],
      variables: { result: "done" },
      error: null,
      durationMs: 100,
      startedAt: new Date(),
      completedAt: new Date(),
    };

    const execution = store.toExecution(dbExecution);

    expect(execution.id).toBe("exec-id");
    expect(execution.workflowId).toBe("workflow-id");
    expect(execution.status).toBe("completed");
    expect(execution.durationMs).toBe(100);
  });
});

// ============================================
// INTEGRATION TESTS
// ============================================

describe("Workflow Integration", () => {
  test("should export all necessary components from index", async () => {
    const workflowModule = await import("../src/core/workflows");

    // Triggers
    expect(workflowModule.TriggerManager).toBeTruthy();
    expect(workflowModule.triggerManager).toBeTruthy();
    expect(typeof workflowModule.createTimeTrigger).toBe("function");
    expect(typeof workflowModule.createWebhookTrigger).toBe("function");
    expect(typeof workflowModule.createEventTrigger).toBe("function");
    expect(typeof workflowModule.createConditionTrigger).toBe("function");
    expect(typeof workflowModule.createManualTrigger).toBe("function");

    // Actions
    expect(workflowModule.ActionExecutor).toBeTruthy();
    expect(workflowModule.actionExecutor).toBeTruthy();
    expect(typeof workflowModule.createSendMessageAction).toBe("function");
    expect(typeof workflowModule.createHttpRequestAction).toBe("function");
    expect(typeof workflowModule.createRunToolAction).toBe("function");
    expect(typeof workflowModule.createSendEmailAction).toBe("function");
    expect(typeof workflowModule.createSetVariableAction).toBe("function");
    expect(typeof workflowModule.createDelayAction).toBe("function");
    expect(typeof workflowModule.createLogAction).toBe("function");
    expect(typeof workflowModule.createTransformAction).toBe("function");
    expect(typeof workflowModule.createParallelAction).toBe("function");
    expect(typeof workflowModule.createSequenceAction).toBe("function");

    // Conditions
    expect(workflowModule.ConditionEvaluator).toBeTruthy();
    expect(workflowModule.conditionEvaluator).toBeTruthy();
    expect(typeof workflowModule.comparison).toBe("function");
    expect(typeof workflowModule.and).toBe("function");
    expect(typeof workflowModule.or).toBe("function");
    expect(typeof workflowModule.not).toBe("function");
    expect(typeof workflowModule.branch).toBe("function");

    // Workflow Engine
    expect(workflowModule.WorkflowEngine).toBeTruthy();
    expect(workflowModule.workflowEngine).toBeTruthy();
    expect(typeof workflowModule.createWorkflow).toBe("function");

    // Workflow Store
    expect(workflowModule.WorkflowStore).toBeTruthy();
    expect(workflowModule.workflowStore).toBeTruthy();

    // Templates
    expect(Array.isArray(workflowModule.workflowTemplates)).toBe(true);
    expect(typeof workflowModule.getWorkflowTemplate).toBe("function");
    expect(typeof workflowModule.getWorkflowTemplatesByCategory).toBe("function");
    expect(typeof workflowModule.getTemplateCategories).toBe("function");
    expect(typeof workflowModule.createWorkflowFromTemplate).toBe("function");

    // Lifecycle
    expect(typeof workflowModule.initializeWorkflows).toBe("function");
    expect(typeof workflowModule.shutdownWorkflows).toBe("function");
  });

  test("should have default export with all components", async () => {
    const workflowModule = await import("../src/core/workflows");
    const defaultExport = workflowModule.default;

    expect(defaultExport.triggerManager).toBeTruthy();
    expect(defaultExport.actionExecutor).toBeTruthy();
    expect(defaultExport.conditionEvaluator).toBeTruthy();
    expect(defaultExport.workflowEngine).toBeTruthy();
    expect(defaultExport.workflowStore).toBeTruthy();
    expect(defaultExport.workflowTemplates).toBeTruthy();
    expect(typeof defaultExport.initializeWorkflows).toBe("function");
    expect(typeof defaultExport.shutdownWorkflows).toBe("function");
  });

  test("should run a complete workflow end-to-end", async () => {
    const engine = new WorkflowEngine();

    // Track messages sent
    const sentMessages: Array<{ channel: string; target: string; content: string }> = [];
    engine.setSendMessageCallback(async (channel, target, content) => {
      sentMessages.push({ channel, target, content });
    });

    // Create a workflow that:
    // 1. Sets a variable from trigger data
    // 2. Conditionally sends a message based on the value
    const workflow = createWorkflow("e2e-workflow", "End-to-End Test")
      .trigger(createManualTrigger("manual", "Manual Trigger"))
      .action(
        createSetVariableAction("extract", "Extract Value", {
          name: "inputValue",
          value: "{{trigger.data.value}}",
        })
      )
      .condition(
        branch(
          gt("inputValue", 50),
          [
            {
              id: "high-step",
              type: "action",
              action: createSendMessageAction("high-msg", "High Value", {
                channel: "telegram",
                target: "123456",
                content: "High value received: {{inputValue}}",
              }),
            },
          ],
          [
            {
              id: "low-step",
              type: "action",
              action: createSendMessageAction("low-msg", "Low Value", {
                channel: "telegram",
                target: "123456",
                content: "Low value received: {{inputValue}}",
              }),
            },
          ]
        )
      )
      .build();

    engine.registerWorkflow(workflow);

    // Execute with high value
    const execution1 = await engine.executeWorkflow("e2e-workflow", { value: 100 });
    expect(execution1.status).toBe("completed");
    expect(sentMessages[0].content).toContain("High value received");

    // Execute with low value
    const execution2 = await engine.executeWorkflow("e2e-workflow", { value: 25 });
    expect(execution2.status).toBe("completed");
    expect(sentMessages[1].content).toContain("Low value received");

    engine.shutdown();
  });
});
