import { describe, test, expect } from "bun:test";
import {
  logAudit,
  verifyAuditChain,
  getAuditChainIntegrity,
  queryAuditLogs,
  getRecentUserActivity,
  countActionsByType,
  audit,
  type AuditAction,
  type AuditLogEntry,
} from "../src/core/security/audit-logger";

describe("audit-logger exports", () => {
  test("module exports logAudit function", () => {
    expect(logAudit).toBeDefined();
    expect(typeof logAudit).toBe("function");
  });

  test("module exports verifyAuditChain function", () => {
    expect(verifyAuditChain).toBeDefined();
    expect(typeof verifyAuditChain).toBe("function");
  });

  test("module exports getAuditChainIntegrity function", () => {
    expect(getAuditChainIntegrity).toBeDefined();
    expect(typeof getAuditChainIntegrity).toBe("function");
  });

  test("module exports queryAuditLogs function", () => {
    expect(queryAuditLogs).toBeDefined();
    expect(typeof queryAuditLogs).toBe("function");
  });

  test("module exports getRecentUserActivity function", () => {
    expect(getRecentUserActivity).toBeDefined();
    expect(typeof getRecentUserActivity).toBe("function");
  });

  test("module exports countActionsByType function", () => {
    expect(countActionsByType).toBeDefined();
    expect(typeof countActionsByType).toBe("function");
  });

  test("module exports audit convenience object", () => {
    expect(audit).toBeDefined();
    expect(typeof audit).toBe("object");
  });
});

describe("AuditAction type covers expected actions", () => {
  test("AuditAction type accepts all expected action strings", () => {
    // TypeScript compile-time check: these assignments must be valid AuditAction values.
    // If any value is not in the AuditAction union, the file will fail to compile.
    const actions: AuditAction[] = [
      "login",
      "logout",
      "session_create",
      "session_invalidate",
      "api_key_create",
      "api_key_revoke",
      "tool_use",
      "chat_message",
      "memory_create",
      "memory_delete",
      "memory_archive",
      "settings_change",
      "mode_change",
      "agent_spawn",
      "agent_complete",
      "file_read",
      "file_write",
      "shell_execute",
      "web_browse",
      "error",
    ];
    expect(actions.length).toBe(20);
  });
});

describe("AuditLogEntry interface accepts required fields", () => {
  test("AuditLogEntry accepts minimal entry with only action", () => {
    const entry: AuditLogEntry = { action: "login" };
    expect(entry.action).toBe("login");
  });

  test("AuditLogEntry accepts fully populated entry", () => {
    const entry: AuditLogEntry = {
      userId: "user-123",
      sessionId: "session-456",
      action: "tool_use",
      resource: "tool",
      resourceId: "search",
      details: { query: "hello" },
      ipAddress: "127.0.0.1",
      userAgent: "TestAgent/1.0",
      success: true,
    };
    expect(entry.action).toBe("tool_use");
    expect(entry.userId).toBe("user-123");
    expect(entry.resource).toBe("tool");
    expect(entry.success).toBe(true);
  });
});

describe("audit convenience object methods", () => {
  test("audit has login method", () => {
    expect(audit.login).toBeDefined();
    expect(typeof audit.login).toBe("function");
  });

  test("audit has logout method", () => {
    expect(audit.logout).toBeDefined();
    expect(typeof audit.logout).toBe("function");
  });

  test("audit has toolUse method", () => {
    expect(audit.toolUse).toBeDefined();
    expect(typeof audit.toolUse).toBe("function");
  });

  test("audit has shellExecute method", () => {
    expect(audit.shellExecute).toBeDefined();
    expect(typeof audit.shellExecute).toBe("function");
  });

  test("audit has fileAccess method", () => {
    expect(audit.fileAccess).toBeDefined();
    expect(typeof audit.fileAccess).toBe("function");
  });

  test("audit has memoryCreate method", () => {
    expect(audit.memoryCreate).toBeDefined();
    expect(typeof audit.memoryCreate).toBe("function");
  });

  test("audit has modeChange method", () => {
    expect(audit.modeChange).toBeDefined();
    expect(typeof audit.modeChange).toBe("function");
  });

  test("audit has agentSpawn method", () => {
    expect(audit.agentSpawn).toBeDefined();
    expect(typeof audit.agentSpawn).toBe("function");
  });

  test("audit has error method", () => {
    expect(audit.error).toBeDefined();
    expect(typeof audit.error).toBe("function");
  });
});

describe("async function signatures", () => {
  test("logAudit is an async function", () => {
    // AsyncFunction constructor name check
    expect(logAudit.constructor.name).toBe("AsyncFunction");
  });

  test("verifyAuditChain is an async function", () => {
    expect(verifyAuditChain.constructor.name).toBe("AsyncFunction");
  });

  test("getAuditChainIntegrity is an async function", () => {
    expect(getAuditChainIntegrity.constructor.name).toBe("AsyncFunction");
  });
});
