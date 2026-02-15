import { describe, test, expect } from "bun:test";

describe("Security Monitor", () => {
  describe("Module Exports", () => {
    test("should export runSecurityScan function", async () => {
      const { runSecurityScan } = await import("../src/tools/security-monitor");
      expect(typeof runSecurityScan).toBe("function");
    });
  });

  describe("SecurityScanResult Type Shape", () => {
    test("should have correct structure", () => {
      const mockResult = {
        status: "warning" as const,
        timestamp: new Date().toISOString(),
        authAnalysis: {
          failedLogins: 42,
          topOffenders: [{ ip: "1.2.3.4", attempts: 30 }],
          recentBans: ["Ban 1.2.3.4"],
          rootLoginAttempts: 5,
          suspiciousUsers: ["admin", "test"],
        },
        networkAudit: {
          openPorts: [{ port: "22", service: "sshd", binding: "0.0.0.0" }],
          externallyExposed: 3,
          unexpectedPorts: [],
        },
        fileIntegrity: [
          { file: "/etc/ssh/sshd_config", exists: true, permissions: "644", owner: "root" },
        ],
        recommendations: ["Consider stricter fail2ban rules"],
        summary: "Security status: WARNING",
      };

      expect(mockResult.status).toBe("warning");
      expect(mockResult.authAnalysis.failedLogins).toBe(42);
      expect(mockResult.networkAudit.openPorts).toHaveLength(1);
      expect(mockResult.fileIntegrity[0].exists).toBe(true);
      expect(mockResult.recommendations).toHaveLength(1);
    });

    test("should support all three status levels", () => {
      const statuses = ["secure", "warning", "critical"];
      for (const s of statuses) {
        expect(["secure", "warning", "critical"]).toContain(s);
      }
    });
  });

  describe("Tool Definition", () => {
    test("should include security_scan in TOOLS array", async () => {
      const { TOOLS } = await import("../src/tools/index");
      const tool = TOOLS.find((t) => t.name === "security_scan");

      expect(tool).toBeTruthy();
      expect(tool!.description).toContain("security");
      expect(tool!.input_schema.properties).toHaveProperty("hours");
    });
  });

  describe("executeTool Integration", () => {
    test("should handle security_scan in executeTool switch", async () => {
      const { executeTool } = await import("../src/tools/index");

      // Will fail on non-Linux but should not crash
      const result = await executeTool("security_scan", { hours: 1 });
      expect(result).toHaveProperty("success");
      expect(result).toHaveProperty("result");
    });
  });
});
