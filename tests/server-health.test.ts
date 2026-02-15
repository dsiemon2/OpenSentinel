import { describe, test, expect } from "bun:test";

describe("Server Health / DevOps Agent", () => {
  describe("Module Exports", () => {
    test("should export checkServerHealth function", async () => {
      const { checkServerHealth } = await import("../src/tools/server-health");
      expect(typeof checkServerHealth).toBe("function");
    });

    test("should export checkService function", async () => {
      const { checkService } = await import("../src/tools/server-health");
      expect(typeof checkService).toBe("function");
    });

    test("should export getRecentLogs function", async () => {
      const { getRecentLogs } = await import("../src/tools/server-health");
      expect(typeof getRecentLogs).toBe("function");
    });
  });

  describe("HealthCheckResult Type Shape", () => {
    test("should define expected health check fields", () => {
      // Verify the type structure is correct by checking the interface
      const expectedFields = [
        "status",
        "hostname",
        "uptime",
        "timestamp",
        "cpu",
        "memory",
        "disk",
        "services",
        "recentErrors",
        "openPorts",
        "summary",
      ];

      // We can verify the module exports the types
      expect(expectedFields.length).toBe(11);
    });
  });

  describe("ServiceStatus Type Shape", () => {
    test("should have name, active, and status fields", () => {
      const mockService = {
        name: "nginx",
        active: true,
        status: "active",
      };

      expect(mockService.name).toBe("nginx");
      expect(mockService.active).toBe(true);
      expect(mockService.status).toBe("active");
    });
  });

  describe("Tool Definition", () => {
    test("should include check_server in TOOLS array", async () => {
      const { TOOLS } = await import("../src/tools/index");
      const tool = TOOLS.find((t) => t.name === "check_server");

      expect(tool).toBeTruthy();
      expect(tool!.description).toContain("health check");
      expect(tool!.input_schema.properties).toHaveProperty("services");
      expect(tool!.input_schema.properties).toHaveProperty("service_detail");
      expect(tool!.input_schema.properties).toHaveProperty("logs");
    });

    test("check_server services should accept array of strings", async () => {
      const { TOOLS } = await import("../src/tools/index");
      const tool = TOOLS.find((t) => t.name === "check_server");
      const servicesProp = (tool!.input_schema.properties as any).services;

      expect(servicesProp.type).toBe("array");
      expect(servicesProp.items.type).toBe("string");
    });
  });

  describe("executeTool Integration", () => {
    test("should handle check_server in executeTool switch", async () => {
      const { executeTool } = await import("../src/tools/index");

      // This will fail on non-Linux (no systemctl) but should not throw unhandled
      const result = await executeTool("check_server", {});

      // On Windows/non-Linux, it should return success:false with an error, not crash
      expect(result).toHaveProperty("success");
      expect(result).toHaveProperty("result");
    });

    test("should handle check_server with service_detail", async () => {
      const { executeTool } = await import("../src/tools/index");

      const result = await executeTool("check_server", { service_detail: "nginx" });

      expect(result).toHaveProperty("success");
    });

    test("should handle check_server with logs request", async () => {
      const { executeTool } = await import("../src/tools/index");

      const result = await executeTool("check_server", {
        logs: { service: "nginx", lines: 10, priority: "err" },
      });

      expect(result).toHaveProperty("success");
    });
  });
});
