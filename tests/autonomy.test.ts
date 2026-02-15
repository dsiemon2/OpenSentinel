import { describe, test, expect, beforeEach } from "bun:test";
import {
  AutonomyManager,
  READONLY_TOOLS,
  SUPERVISED_REQUIRE_APPROVAL,
} from "../src/core/security/autonomy";

describe("AutonomyManager", () => {
  let manager: AutonomyManager;

  beforeEach(() => {
    manager = new AutonomyManager();
  });

  // 1. Default level is "autonomous"
  test("default level is 'autonomous'", () => {
    expect(manager.getDefaultLevel()).toBe("autonomous");
  });

  // 2. setDefaultLevel changes the default
  test("setDefaultLevel changes the default", () => {
    manager.setDefaultLevel("readonly");
    expect(manager.getDefaultLevel()).toBe("readonly");
  });

  // 3. getDefaultLevel returns current default
  test("getDefaultLevel returns current default after multiple changes", () => {
    manager.setDefaultLevel("supervised");
    expect(manager.getDefaultLevel()).toBe("supervised");
    manager.setDefaultLevel("autonomous");
    expect(manager.getDefaultLevel()).toBe("autonomous");
  });

  // 4. setLevel sets per-user level
  test("setLevel sets per-user level", () => {
    manager.setLevel("user-1", "readonly");
    expect(manager.getLevel("user-1")).toBe("readonly");
  });

  // 5. getLevel returns user level when set
  test("getLevel returns user level when set", () => {
    manager.setLevel("user-42", "supervised");
    expect(manager.getLevel("user-42")).toBe("supervised");
  });

  // 6. getLevel falls back to default when user level not set
  test("getLevel falls back to default when user level not set", () => {
    expect(manager.getLevel("unknown-user")).toBe("autonomous");
    manager.setDefaultLevel("readonly");
    expect(manager.getLevel("unknown-user")).toBe("readonly");
  });

  // 7. checkToolAccess: autonomous allows all tools
  test("checkToolAccess: autonomous allows all tools", () => {
    const result = manager.checkToolAccess("user-1", "any_tool");
    expect(result.allowed).toBe(true);
    expect(result.reason).toBeUndefined();
  });

  // 8. checkToolAccess: autonomous allows execute_command
  test("checkToolAccess: autonomous allows execute_command", () => {
    const result = manager.checkToolAccess("user-1", "execute_command");
    expect(result.allowed).toBe(true);
    expect(result.reason).toBeUndefined();
  });

  // 9. checkToolAccess: readonly allows read_file
  test("checkToolAccess: readonly allows read_file", () => {
    manager.setLevel("user-1", "readonly");
    const result = manager.checkToolAccess("user-1", "read_file");
    expect(result.allowed).toBe(true);
  });

  // 10. checkToolAccess: readonly allows search_web
  test("checkToolAccess: readonly allows search_web", () => {
    manager.setLevel("user-1", "readonly");
    const result = manager.checkToolAccess("user-1", "search_web");
    expect(result.allowed).toBe(true);
  });

  // 11. checkToolAccess: readonly allows list_files
  test("checkToolAccess: readonly allows list_files", () => {
    manager.setLevel("user-1", "readonly");
    const result = manager.checkToolAccess("user-1", "list_files");
    expect(result.allowed).toBe(true);
  });

  // 12. checkToolAccess: readonly blocks execute_command
  test("checkToolAccess: readonly blocks execute_command", () => {
    manager.setLevel("user-1", "readonly");
    const result = manager.checkToolAccess("user-1", "execute_command");
    expect(result.allowed).toBe(false);
    expect(result.reason).toBeDefined();
    expect(result.reason).toContain("execute_command");
    expect(result.reason).toContain("readonly");
  });

  // 13. checkToolAccess: readonly blocks write_file
  test("checkToolAccess: readonly blocks write_file", () => {
    manager.setLevel("user-1", "readonly");
    const result = manager.checkToolAccess("user-1", "write_file");
    expect(result.allowed).toBe(false);
    expect(result.reason).toBeDefined();
    expect(result.reason).toContain("write_file");
  });

  // 14. checkToolAccess: readonly blocks spawn_agent
  test("checkToolAccess: readonly blocks spawn_agent", () => {
    manager.setLevel("user-1", "readonly");
    const result = manager.checkToolAccess("user-1", "spawn_agent");
    expect(result.allowed).toBe(false);
    expect(result.reason).toBeDefined();
    expect(result.reason).toContain("spawn_agent");
  });

  // 15. checkToolAccess: supervised allows all tools
  test("checkToolAccess: supervised allows all tools", () => {
    manager.setLevel("user-1", "supervised");
    // A tool NOT in the approval list should be allowed without reason
    const safeResult = manager.checkToolAccess("user-1", "read_file");
    expect(safeResult.allowed).toBe(true);
    // A tool IN the approval list should still be allowed (but flagged)
    const flaggedResult = manager.checkToolAccess("user-1", "execute_command");
    expect(flaggedResult.allowed).toBe(true);
  });

  // 16. checkToolAccess: supervised flags execute_command (has reason)
  test("checkToolAccess: supervised flags execute_command with reason", () => {
    manager.setLevel("user-1", "supervised");
    const result = manager.checkToolAccess("user-1", "execute_command");
    expect(result.allowed).toBe(true);
    expect(result.reason).toBeDefined();
    expect(result.reason).toContain("execute_command");
    expect(result.reason).toContain("approval");
  });

  // 17. checkToolAccess: supervised flags write_file (has reason)
  test("checkToolAccess: supervised flags write_file with reason", () => {
    manager.setLevel("user-1", "supervised");
    const result = manager.checkToolAccess("user-1", "write_file");
    expect(result.allowed).toBe(true);
    expect(result.reason).toBeDefined();
    expect(result.reason).toContain("write_file");
    expect(result.reason).toContain("approval");
  });

  // 18. checkToolAccess: supervised allows read_file without reason
  test("checkToolAccess: supervised allows read_file without reason", () => {
    manager.setLevel("user-1", "supervised");
    const result = manager.checkToolAccess("user-1", "read_file");
    expect(result.allowed).toBe(true);
    expect(result.reason).toBeUndefined();
  });

  // 19. getStats returns level and user count
  test("getStats returns level and user count", () => {
    manager.setDefaultLevel("supervised");
    manager.setLevel("user-1", "readonly");
    manager.setLevel("user-2", "autonomous");

    const stats = manager.getStats();
    expect(stats.level).toBe("supervised");
    expect(stats.usersWithCustomLevel).toBe(2);
  });

  // 20. Per-user level overrides default
  test("per-user level overrides the default", () => {
    manager.setDefaultLevel("autonomous");
    manager.setLevel("restricted-user", "readonly");

    // The restricted user should be readonly, not autonomous
    const restrictedResult = manager.checkToolAccess(
      "restricted-user",
      "execute_command",
    );
    expect(restrictedResult.allowed).toBe(false);

    // Another user without a custom level should still be autonomous
    const normalResult = manager.checkToolAccess(
      "normal-user",
      "execute_command",
    );
    expect(normalResult.allowed).toBe(true);
    expect(normalResult.reason).toBeUndefined();
  });
});
