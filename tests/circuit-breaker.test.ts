import { describe, test, expect } from "bun:test";

// ============================================
// Circuit Breaker — OWASP ASI08/ASI10 Defense
// ============================================

describe("Circuit Breaker", () => {
  describe("Module exports", () => {
    test("should export CircuitBreaker class", async () => {
      const mod = await import("../src/core/security/circuit-breaker");
      expect(typeof mod.CircuitBreaker).toBe("function");
    });

    test("should export CircuitBreakerOpenError", async () => {
      const mod = await import("../src/core/security/circuit-breaker");
      expect(typeof mod.CircuitBreakerOpenError).toBe("function");
    });

    test("should export createCircuitBreaker", async () => {
      const mod = await import("../src/core/security/circuit-breaker");
      expect(typeof mod.createCircuitBreaker).toBe("function");
    });

    test("should export emergencyHalt", async () => {
      const mod = await import("../src/core/security/circuit-breaker");
      expect(typeof mod.emergencyHalt).toBe("function");
    });

    test("should export resumeFromHalt", async () => {
      const mod = await import("../src/core/security/circuit-breaker");
      expect(typeof mod.resumeFromHalt).toBe("function");
    });

    test("should export getCircuitBreakerStats", async () => {
      const mod = await import("../src/core/security/circuit-breaker");
      expect(typeof mod.getCircuitBreakerStats).toBe("function");
    });
  });

  describe("CircuitBreaker state transitions", () => {
    test("should start in closed state", async () => {
      const { CircuitBreaker } = await import("../src/core/security/circuit-breaker");
      const cb = new CircuitBreaker({ name: "test-closed" });
      expect(cb.getState()).toBe("closed");
    });

    test("should remain closed on success", async () => {
      const { CircuitBreaker } = await import("../src/core/security/circuit-breaker");
      const cb = new CircuitBreaker({ name: "test-success" });
      await cb.execute(async () => "ok");
      expect(cb.getState()).toBe("closed");
    });

    test("should open after reaching failure threshold", async () => {
      const { CircuitBreaker } = await import("../src/core/security/circuit-breaker");
      const cb = new CircuitBreaker({ name: "test-open", failureThreshold: 3 });

      for (let i = 0; i < 3; i++) {
        try {
          await cb.execute(async () => { throw new Error("fail"); });
        } catch { /* expected */ }
      }

      expect(cb.getState()).toBe("open");
    });

    test("should throw CircuitBreakerOpenError when open", async () => {
      const { CircuitBreaker, CircuitBreakerOpenError } = await import("../src/core/security/circuit-breaker");
      const cb = new CircuitBreaker({ name: "test-throw", failureThreshold: 1 });

      try {
        await cb.execute(async () => { throw new Error("fail"); });
      } catch { /* expected */ }

      try {
        await cb.execute(async () => "should not run");
        expect(true).toBe(false); // Should not reach here
      } catch (e) {
        expect(e instanceof CircuitBreakerOpenError).toBe(true);
      }
    });

    test("should reset failures on success in closed state", async () => {
      const { CircuitBreaker } = await import("../src/core/security/circuit-breaker");
      const cb = new CircuitBreaker({ name: "test-reset", failureThreshold: 3 });

      // 2 failures
      for (let i = 0; i < 2; i++) {
        try {
          await cb.execute(async () => { throw new Error("fail"); });
        } catch { /* expected */ }
      }

      // 1 success resets
      await cb.execute(async () => "ok");

      // 2 more failures should NOT open it
      for (let i = 0; i < 2; i++) {
        try {
          await cb.execute(async () => { throw new Error("fail"); });
        } catch { /* expected */ }
      }

      expect(cb.getState()).toBe("closed");
    });
  });

  describe("forceOpen and forceClose", () => {
    test("should force open", async () => {
      const { CircuitBreaker } = await import("../src/core/security/circuit-breaker");
      const cb = new CircuitBreaker({ name: "test-force-open" });
      cb.forceOpen();
      expect(cb.getState()).toBe("open");
    });

    test("should force close", async () => {
      const { CircuitBreaker } = await import("../src/core/security/circuit-breaker");
      const cb = new CircuitBreaker({ name: "test-force-close" });
      cb.forceOpen();
      cb.forceClose();
      expect(cb.getState()).toBe("closed");
    });
  });

  describe("getStats", () => {
    test("should return correct stats", async () => {
      const { CircuitBreaker } = await import("../src/core/security/circuit-breaker");
      const cb = new CircuitBreaker({ name: "test-stats" });
      await cb.execute(async () => "ok");

      const stats = cb.getStats();
      expect(stats.name).toBe("test-stats");
      expect(stats.state).toBe("closed");
      expect(stats.successes).toBe(1);
      expect(stats.totalRequests).toBe(1);
      expect(stats.failures).toBe(0);
    });

    test("should track failure time", async () => {
      const { CircuitBreaker } = await import("../src/core/security/circuit-breaker");
      const cb = new CircuitBreaker({ name: "test-failure-time" });

      try {
        await cb.execute(async () => { throw new Error("fail"); });
      } catch { /* expected */ }

      const stats = cb.getStats();
      expect(stats.lastFailureTime).not.toBeNull();
    });
  });

  describe("reset", () => {
    test("should reset all state", async () => {
      const { CircuitBreaker } = await import("../src/core/security/circuit-breaker");
      const cb = new CircuitBreaker({ name: "test-reset-all" });

      await cb.execute(async () => "ok");
      cb.forceOpen();
      cb.reset();

      const stats = cb.getStats();
      expect(stats.state).toBe("closed");
      expect(stats.failures).toBe(0);
      expect(stats.successes).toBe(0);
      expect(stats.totalRequests).toBe(0);
    });
  });

  describe("getConfig", () => {
    test("should return config", async () => {
      const { CircuitBreaker } = await import("../src/core/security/circuit-breaker");
      const cb = new CircuitBreaker({ name: "test-config", failureThreshold: 10 });
      const config = cb.getConfig();
      expect(config.name).toBe("test-config");
      expect(config.failureThreshold).toBe(10);
    });
  });

  describe("Emergency halt", () => {
    test("should check emergency halt state", async () => {
      const { isEmergencyHalted } = await import("../src/core/security/circuit-breaker");
      // Initial state should be false (or potentially true from previous test)
      expect(typeof isEmergencyHalted()).toBe("boolean");
    });

    test("should return breaker names", async () => {
      const { getRegisteredBreakers, createCircuitBreaker } = await import("../src/core/security/circuit-breaker");
      createCircuitBreaker("test-reg-1");
      const names = getRegisteredBreakers();
      expect(names).toContain("test-reg-1");
    });
  });
});
