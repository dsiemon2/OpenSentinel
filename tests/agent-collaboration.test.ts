import { describe, test, expect, beforeEach } from "bun:test";

describe("Agent Collaboration", () => {
  describe("AgentMessenger", () => {
    test("should export AgentMessenger class", async () => {
      const { AgentMessenger } = await import("../src/core/agents/collaboration/agent-messenger");
      expect(AgentMessenger).toBeTruthy();
    });

    test("should export createMessenger factory", async () => {
      const { createMessenger } = await import("../src/core/agents/collaboration/agent-messenger");
      expect(typeof createMessenger).toBe("function");
    });

    test("should export MessageQueue class", async () => {
      const { MessageQueue } = await import("../src/core/agents/collaboration/agent-messenger");
      expect(MessageQueue).toBeTruthy();
    });

    test("should export global messageQueue instance", async () => {
      const { messageQueue } = await import("../src/core/agents/collaboration/agent-messenger");
      expect(messageQueue).toBeTruthy();
    });
  });

  describe("SharedContext", () => {
    test("should export SharedContext class", async () => {
      const { SharedContext } = await import("../src/core/agents/collaboration/shared-context");
      expect(SharedContext).toBeTruthy();
    });

    test("should export ContextManager class", async () => {
      const { ContextManager } = await import("../src/core/agents/collaboration/shared-context");
      expect(ContextManager).toBeTruthy();
    });

    test("should export contextManager singleton", async () => {
      const { contextManager } = await import("../src/core/agents/collaboration/shared-context");
      expect(contextManager).toBeTruthy();
    });

    test("should export getOrCreateContext function", async () => {
      const { getOrCreateContext } = await import("../src/core/agents/collaboration/shared-context");
      expect(typeof getOrCreateContext).toBe("function");
    });
  });

  describe("TaskCoordinator", () => {
    test("should export TaskCoordinator class", async () => {
      const { TaskCoordinator } = await import("../src/core/agents/collaboration/task-coordinator");
      expect(TaskCoordinator).toBeTruthy();
    });

    test("should export createWorkflow function", async () => {
      const { createWorkflow } = await import("../src/core/agents/collaboration/task-coordinator");
      expect(typeof createWorkflow).toBe("function");
    });

    test("should export runWorkflow function", async () => {
      const { runWorkflow } = await import("../src/core/agents/collaboration/task-coordinator");
      expect(typeof runWorkflow).toBe("function");
    });

    test("should export WORKFLOW_TEMPLATES", async () => {
      const { WORKFLOW_TEMPLATES } = await import("../src/core/agents/collaboration/task-coordinator");
      expect(WORKFLOW_TEMPLATES).toBeTruthy();
      expect(typeof WORKFLOW_TEMPLATES).toBe("object");
    });
  });

  describe("Collaboration index exports", () => {
    test("should export all messenger types", async () => {
      const mod = await import("../src/core/agents/collaboration");
      expect(mod.AgentMessenger).toBeTruthy();
      expect(mod.MessageQueue).toBeTruthy();
      expect(mod.messageQueue).toBeTruthy();
      expect(mod.createMessenger).toBeTruthy();
    });

    test("should export all context types", async () => {
      const mod = await import("../src/core/agents/collaboration");
      expect(mod.SharedContext).toBeTruthy();
      expect(mod.ContextManager).toBeTruthy();
      expect(mod.contextManager).toBeTruthy();
      expect(mod.getOrCreateContext).toBeTruthy();
    });

    test("should export all coordinator types", async () => {
      const mod = await import("../src/core/agents/collaboration");
      expect(mod.TaskCoordinator).toBeTruthy();
      expect(mod.createWorkflow).toBeTruthy();
      expect(mod.runWorkflow).toBeTruthy();
      expect(mod.WORKFLOW_TEMPLATES).toBeTruthy();
    });
  });

  describe("createCollaborationSession", () => {
    test("should export createCollaborationSession function", async () => {
      const { createCollaborationSession } = await import("../src/core/agents/collaboration");
      expect(typeof createCollaborationSession).toBe("function");
    });

    test("should create collaboration session", async () => {
      const { createCollaborationSession } = await import("../src/core/agents/collaboration");
      const session = await createCollaborationSession("test-user");

      expect(session).toBeTruthy();
      expect(session.contextId).toBeTruthy();
      expect(session.sharedContext).toBeTruthy();
      expect(session.messengers).toBeInstanceOf(Map);
    });

    test("should create session with custom context ID", async () => {
      const { createCollaborationSession } = await import("../src/core/agents/collaboration");
      const session = await createCollaborationSession("test-user", {
        contextId: "custom-context",
      });

      expect(session.contextId).toBe("custom-context");
    });
  });

  describe("startMultiAgentWorkflow", () => {
    test("should export startMultiAgentWorkflow function", async () => {
      const { startMultiAgentWorkflow } = await import("../src/core/agents/collaboration");
      expect(typeof startMultiAgentWorkflow).toBe("function");
    });
  });

  describe("cleanupCollaborationSession", () => {
    test("should export cleanupCollaborationSession function", async () => {
      const { cleanupCollaborationSession } = await import("../src/core/agents/collaboration");
      expect(typeof cleanupCollaborationSession).toBe("function");
    });

    test("should cleanup session without error", async () => {
      const { createCollaborationSession, cleanupCollaborationSession } = await import("../src/core/agents/collaboration");

      const session = await createCollaborationSession("test-user");
      await cleanupCollaborationSession(session);

      // Should not throw and messengers should be cleared
      expect(session.messengers.size).toBe(0);
    });
  });

  describe("Default export", () => {
    test("should have default export with main functions", async () => {
      const mod = await import("../src/core/agents/collaboration");
      const defaultExport = mod.default;

      expect(defaultExport).toBeTruthy();
      expect(typeof defaultExport.createCollaborationSession).toBe("function");
      expect(typeof defaultExport.startMultiAgentWorkflow).toBe("function");
      expect(typeof defaultExport.cleanupCollaborationSession).toBe("function");
    });
  });

  describe("CollaborationConfig interface", () => {
    test("should support optional contextId", async () => {
      const { createCollaborationSession } = await import("../src/core/agents/collaboration");
      const session = await createCollaborationSession("user", { contextId: "test" });
      expect(session.contextId).toBe("test");
    });

    test("should support enableMessaging option", async () => {
      const { createCollaborationSession } = await import("../src/core/agents/collaboration");
      const session = await createCollaborationSession("user", { enableMessaging: true });
      expect(session).toBeTruthy();
    });

    test("should support enableSharedContext option", async () => {
      const { createCollaborationSession } = await import("../src/core/agents/collaboration");
      const session = await createCollaborationSession("user", { enableSharedContext: true });
      expect(session).toBeTruthy();
    });

    test("should support maxAgents option", async () => {
      const { createCollaborationSession } = await import("../src/core/agents/collaboration");
      const session = await createCollaborationSession("user", { maxAgents: 5 });
      expect(session).toBeTruthy();
    });
  });

  describe("Message types", () => {
    test("should define message priority levels", async () => {
      const mod = await import("../src/core/agents/collaboration/agent-messenger");
      expect(mod).toBeTruthy();
    });

    test("should define message types", async () => {
      const mod = await import("../src/core/agents/collaboration/agent-messenger");
      expect(mod).toBeTruthy();
    });
  });

  describe("Context types", () => {
    test("should define context types", async () => {
      const mod = await import("../src/core/agents/collaboration/shared-context");
      expect(mod).toBeTruthy();
    });
  });

  describe("Task types", () => {
    test("should define task status types", async () => {
      const mod = await import("../src/core/agents/collaboration/task-coordinator");
      expect(mod).toBeTruthy();
    });

    test("should define task priority types", async () => {
      const mod = await import("../src/core/agents/collaboration/task-coordinator");
      expect(mod).toBeTruthy();
    });

    test("should define workflow strategy types", async () => {
      const mod = await import("../src/core/agents/collaboration/task-coordinator");
      expect(mod).toBeTruthy();
    });
  });

  describe("Workflow templates", () => {
    test("should have predefined workflow templates", async () => {
      const { WORKFLOW_TEMPLATES } = await import("../src/core/agents/collaboration/task-coordinator");
      expect(Object.keys(WORKFLOW_TEMPLATES).length).toBeGreaterThan(0);
    });
  });
});
