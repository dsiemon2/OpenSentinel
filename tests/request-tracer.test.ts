import { describe, test, expect } from "bun:test";

// ============================================
// Request Tracer — Distributed tracing
// ============================================

describe("Request Tracer", () => {
  describe("Module exports", () => {
    test("should export RequestTracer class", async () => {
      const mod = await import("../src/core/observability/request-tracer");
      expect(typeof mod.RequestTracer).toBe("function");
    });

    test("should export requestTracer singleton", async () => {
      const mod = await import("../src/core/observability/request-tracer");
      expect(mod.requestTracer).toBeDefined();
    });
  });

  describe("startTrace", () => {
    test("should create a trace with ID", async () => {
      const { RequestTracer } = await import("../src/core/observability/request-tracer");
      const tracer = new RequestTracer();
      const trace = tracer.startTrace("trace-1");
      expect(trace.traceId).toBe("trace-1");
      expect(trace.startTime).toBeGreaterThan(0);
      expect(trace.spans).toHaveLength(0);
    });

    test("should create trace with metadata", async () => {
      const { RequestTracer } = await import("../src/core/observability/request-tracer");
      const tracer = new RequestTracer();
      const trace = tracer.startTrace("trace-2", { userId: "u1" });
      expect(trace.metadata.userId).toBe("u1");
    });
  });

  describe("getTrace", () => {
    test("should retrieve stored trace", async () => {
      const { RequestTracer } = await import("../src/core/observability/request-tracer");
      const tracer = new RequestTracer();
      tracer.startTrace("get-trace-1");
      const retrieved = tracer.getTrace("get-trace-1");
      expect(retrieved).not.toBeNull();
      expect(retrieved!.traceId).toBe("get-trace-1");
    });

    test("should return null for unknown trace", async () => {
      const { RequestTracer } = await import("../src/core/observability/request-tracer");
      const tracer = new RequestTracer();
      expect(tracer.getTrace("nonexistent")).toBeNull();
    });
  });

  describe("addSpan and endSpan", () => {
    test("should add span to current trace (via withTrace)", async () => {
      const { RequestTracer } = await import("../src/core/observability/request-tracer");
      const tracer = new RequestTracer();

      const result = tracer.withTrace("span-test", () => {
        const span = tracer.addSpan("tool-call", { tool: "search" });
        tracer.endSpan(span);
        return span;
      });

      expect(result.name).toBe("tool-call");
      expect(result.durationMs).toBeDefined();
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
    });
  });

  describe("endTrace", () => {
    test("should set endTime and durationMs", async () => {
      const { RequestTracer } = await import("../src/core/observability/request-tracer");
      const tracer = new RequestTracer();

      const result = tracer.withTrace("end-test", () => {
        const trace = tracer.endTrace();
        return trace;
      });

      expect(result).not.toBeNull();
      expect(result!.endTime).toBeDefined();
      expect(result!.durationMs).toBeGreaterThanOrEqual(0);
    });
  });

  describe("getRecentTraces", () => {
    test("should return recent traces sorted by time", async () => {
      const { RequestTracer } = await import("../src/core/observability/request-tracer");
      const tracer = new RequestTracer();
      tracer.reset();

      tracer.startTrace("recent-1");
      tracer.startTrace("recent-2");
      tracer.startTrace("recent-3");

      const recent = tracer.getRecentTraces(2);
      expect(recent).toHaveLength(2);
      expect(recent[0].startTime).toBeGreaterThanOrEqual(recent[1].startTime);
    });
  });

  describe("getTraceCount", () => {
    test("should count traces", async () => {
      const { RequestTracer } = await import("../src/core/observability/request-tracer");
      const tracer = new RequestTracer();
      tracer.reset();

      tracer.startTrace("count-1");
      tracer.startTrace("count-2");

      expect(tracer.getTraceCount()).toBe(2);
    });
  });

  describe("getAverageDuration", () => {
    test("should return 0 for no completed traces", async () => {
      const { RequestTracer } = await import("../src/core/observability/request-tracer");
      const tracer = new RequestTracer();
      tracer.reset();
      expect(tracer.getAverageDuration()).toBe(0);
    });

    test("should compute average of completed traces", async () => {
      const { RequestTracer } = await import("../src/core/observability/request-tracer");
      const tracer = new RequestTracer();
      tracer.reset();

      tracer.withTrace("avg-1", () => {
        tracer.endTrace();
      });
      tracer.withTrace("avg-2", () => {
        tracer.endTrace();
      });

      const avg = tracer.getAverageDuration();
      expect(avg).toBeGreaterThanOrEqual(0);
    });
  });

  describe("reset", () => {
    test("should clear all traces", async () => {
      const { RequestTracer } = await import("../src/core/observability/request-tracer");
      const tracer = new RequestTracer();
      tracer.startTrace("reset-test");
      tracer.reset();
      expect(tracer.getTraceCount()).toBe(0);
    });
  });
});
