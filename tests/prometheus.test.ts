import { describe, test, expect } from "bun:test";
import { PrometheusExporter } from "../src/core/observability/prometheus";

describe("PrometheusExporter", () => {
  // -------------------------------------------------------------------------
  // 1. toTextFormat returns a string
  // -------------------------------------------------------------------------
  test("toTextFormat returns a string", () => {
    const exporter = new PrometheusExporter();
    const output = exporter.toTextFormat();
    expect(typeof output).toBe("string");
  });

  // -------------------------------------------------------------------------
  // 2. toTextFormat includes HELP lines for counters
  // -------------------------------------------------------------------------
  test("toTextFormat includes HELP lines for counters", () => {
    const exporter = new PrometheusExporter();
    const output = exporter.toTextFormat();
    expect(output).toContain("# HELP opensentinel_requests_total Total number of requests processed");
    expect(output).toContain("# HELP opensentinel_tokens_input_total Total number of input tokens consumed");
    expect(output).toContain("# HELP opensentinel_tokens_output_total Total number of output tokens produced");
    expect(output).toContain("# HELP opensentinel_errors_total Total number of errors encountered");
    expect(output).toContain("# HELP opensentinel_tool_executions_total Total number of tool executions");
  });

  // -------------------------------------------------------------------------
  // 3. toTextFormat includes TYPE counter lines
  // -------------------------------------------------------------------------
  test("toTextFormat includes TYPE counter lines", () => {
    const exporter = new PrometheusExporter();
    const output = exporter.toTextFormat();
    expect(output).toContain("# TYPE opensentinel_requests_total counter");
    expect(output).toContain("# TYPE opensentinel_tokens_input_total counter");
    expect(output).toContain("# TYPE opensentinel_tokens_output_total counter");
    expect(output).toContain("# TYPE opensentinel_errors_total counter");
    expect(output).toContain("# TYPE opensentinel_tool_executions_total counter");
  });

  // -------------------------------------------------------------------------
  // 4. toTextFormat includes HELP lines for histograms
  // -------------------------------------------------------------------------
  test("toTextFormat includes HELP lines for histograms", () => {
    const exporter = new PrometheusExporter();
    const output = exporter.toTextFormat();
    expect(output).toContain("# HELP opensentinel_response_latency_ms Response latency in milliseconds");
    expect(output).toContain("# HELP opensentinel_tool_duration_ms Tool execution duration in milliseconds");
  });

  // -------------------------------------------------------------------------
  // 5. toTextFormat includes TYPE histogram lines
  // -------------------------------------------------------------------------
  test("toTextFormat includes TYPE histogram lines", () => {
    const exporter = new PrometheusExporter();
    const output = exporter.toTextFormat();
    expect(output).toContain("# TYPE opensentinel_response_latency_ms histogram");
    expect(output).toContain("# TYPE opensentinel_tool_duration_ms histogram");
  });

  // -------------------------------------------------------------------------
  // 6. toTextFormat includes HELP lines for gauges
  // -------------------------------------------------------------------------
  test("toTextFormat includes HELP lines for gauges", () => {
    const exporter = new PrometheusExporter();
    const output = exporter.toTextFormat();
    expect(output).toContain("# HELP opensentinel_uptime_seconds Process uptime in seconds");
    expect(output).toContain("# HELP opensentinel_memory_heap_bytes Process heap memory usage in bytes");
  });

  // -------------------------------------------------------------------------
  // 7. toTextFormat includes TYPE gauge lines
  // -------------------------------------------------------------------------
  test("toTextFormat includes TYPE gauge lines", () => {
    const exporter = new PrometheusExporter();
    const output = exporter.toTextFormat();
    expect(output).toContain("# TYPE opensentinel_uptime_seconds gauge");
    expect(output).toContain("# TYPE opensentinel_memory_heap_bytes gauge");
  });

  // -------------------------------------------------------------------------
  // 8. recordRequest increments requests counter
  // -------------------------------------------------------------------------
  test("recordRequest increments requests counter", () => {
    const exporter = new PrometheusExporter();
    exporter.recordRequest("claude-3", "telegram");
    exporter.recordRequest("claude-3", "telegram");
    exporter.recordRequest("claude-3", "telegram");
    const output = exporter.toTextFormat();
    expect(output).toContain('opensentinel_requests_total{channel="telegram",model="claude-3"} 3');
  });

  // -------------------------------------------------------------------------
  // 9. After recordRequest, toTextFormat includes the request count with labels
  // -------------------------------------------------------------------------
  test("after recordRequest, toTextFormat includes the request count with labels", () => {
    const exporter = new PrometheusExporter();
    exporter.recordRequest("claude-3", "discord");
    exporter.recordRequest("gpt-4", "slack");
    const output = exporter.toTextFormat();
    expect(output).toContain('opensentinel_requests_total{channel="discord",model="claude-3"} 1');
    expect(output).toContain('opensentinel_requests_total{channel="slack",model="gpt-4"} 1');
  });

  // -------------------------------------------------------------------------
  // 10. recordTokens increments token counters
  // -------------------------------------------------------------------------
  test("recordTokens increments token counters", () => {
    const exporter = new PrometheusExporter();
    exporter.recordTokens("claude-3", 100, 200);
    exporter.recordTokens("claude-3", 50, 75);
    const output = exporter.toTextFormat();
    expect(output).toContain('opensentinel_tokens_input_total{model="claude-3"} 150');
    expect(output).toContain('opensentinel_tokens_output_total{model="claude-3"} 275');
  });

  // -------------------------------------------------------------------------
  // 11. recordError increments errors counter
  // -------------------------------------------------------------------------
  test("recordError increments errors counter", () => {
    const exporter = new PrometheusExporter();
    exporter.recordError("timeout");
    exporter.recordError("timeout");
    exporter.recordError("auth_failure");
    const output = exporter.toTextFormat();
    expect(output).toContain('opensentinel_errors_total{type="timeout"} 2');
    expect(output).toContain('opensentinel_errors_total{type="auth_failure"} 1');
  });

  // -------------------------------------------------------------------------
  // 12. recordToolExecution increments tool executions counter
  // -------------------------------------------------------------------------
  test("recordToolExecution increments tool executions counter", () => {
    const exporter = new PrometheusExporter();
    exporter.recordToolExecution("web_search", true, 120);
    exporter.recordToolExecution("web_search", true, 80);
    exporter.recordToolExecution("web_search", false, 5000);
    const output = exporter.toTextFormat();
    expect(output).toContain('opensentinel_tool_executions_total{success="true",tool="web_search"} 2');
    expect(output).toContain('opensentinel_tool_executions_total{success="false",tool="web_search"} 1');
  });

  // -------------------------------------------------------------------------
  // 13. recordToolExecution records histogram observation
  // -------------------------------------------------------------------------
  test("recordToolExecution records histogram observation", () => {
    const exporter = new PrometheusExporter();
    exporter.recordToolExecution("calculator", true, 42);
    const output = exporter.toTextFormat();
    expect(output).toContain("opensentinel_tool_duration_ms_count 1");
    expect(output).toContain("opensentinel_tool_duration_ms_sum 42");
  });

  // -------------------------------------------------------------------------
  // 14. recordLatency records response latency histogram
  // -------------------------------------------------------------------------
  test("recordLatency records response latency histogram", () => {
    const exporter = new PrometheusExporter();
    exporter.recordLatency(150);
    exporter.recordLatency(300);
    const output = exporter.toTextFormat();
    expect(output).toContain("opensentinel_response_latency_ms_count 2");
    expect(output).toContain("opensentinel_response_latency_ms_sum 450");
  });

  // -------------------------------------------------------------------------
  // 15. Histogram output includes bucket lines
  // -------------------------------------------------------------------------
  test("histogram output includes bucket lines", () => {
    const exporter = new PrometheusExporter();
    exporter.recordLatency(100);
    const output = exporter.toTextFormat();
    // Verify all defined bucket boundaries appear
    const expectedBuckets = [10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000, 30000];
    for (const le of expectedBuckets) {
      expect(output).toContain(`opensentinel_response_latency_ms_bucket{le="${le}"}`);
    }
    // Also the +Inf bucket
    expect(output).toContain('opensentinel_response_latency_ms_bucket{le="+Inf"}');
  });

  // -------------------------------------------------------------------------
  // 16. Histogram output includes _sum and _count
  // -------------------------------------------------------------------------
  test("histogram output includes _sum and _count", () => {
    const exporter = new PrometheusExporter();
    exporter.recordLatency(200);
    exporter.recordLatency(800);
    const output = exporter.toTextFormat();
    expect(output).toContain("opensentinel_response_latency_ms_sum 1000");
    expect(output).toContain("opensentinel_response_latency_ms_count 2");
  });

  // -------------------------------------------------------------------------
  // 17. Histogram bucket counts are correct (values <= bucket boundary)
  // -------------------------------------------------------------------------
  test("histogram bucket counts are correct for known values", () => {
    const exporter = new PrometheusExporter();
    // Record values: 5, 50, 500, 5000
    exporter.recordLatency(5);
    exporter.recordLatency(50);
    exporter.recordLatency(500);
    exporter.recordLatency(5000);
    const output = exporter.toTextFormat();

    // Buckets: 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000, 30000
    // 5 <= 10  -> bucket 10 has 1
    expect(output).toContain('opensentinel_response_latency_ms_bucket{le="10"} 1');
    // 5 <= 25  -> bucket 25 has 1
    expect(output).toContain('opensentinel_response_latency_ms_bucket{le="25"} 1');
    // 5,50 <= 50 -> bucket 50 has 2
    expect(output).toContain('opensentinel_response_latency_ms_bucket{le="50"} 2');
    // 5,50 <= 100 -> bucket 100 has 2
    expect(output).toContain('opensentinel_response_latency_ms_bucket{le="100"} 2');
    // 5,50 <= 250 -> bucket 250 has 2
    expect(output).toContain('opensentinel_response_latency_ms_bucket{le="250"} 2');
    // 5,50,500 <= 500 -> bucket 500 has 3
    expect(output).toContain('opensentinel_response_latency_ms_bucket{le="500"} 3');
    // 5,50,500 <= 1000 -> bucket 1000 has 3
    expect(output).toContain('opensentinel_response_latency_ms_bucket{le="1000"} 3');
    // 5,50,500 <= 2500 -> bucket 2500 has 3
    expect(output).toContain('opensentinel_response_latency_ms_bucket{le="2500"} 3');
    // 5,50,500,5000 <= 5000 -> bucket 5000 has 4
    expect(output).toContain('opensentinel_response_latency_ms_bucket{le="5000"} 4');
    // all <= 10000 -> bucket 10000 has 4
    expect(output).toContain('opensentinel_response_latency_ms_bucket{le="10000"} 4');
    // all <= 30000 -> bucket 30000 has 4
    expect(output).toContain('opensentinel_response_latency_ms_bucket{le="30000"} 4');
    // +Inf always has all observations
    expect(output).toContain('opensentinel_response_latency_ms_bucket{le="+Inf"} 4');
  });

  // -------------------------------------------------------------------------
  // 18. Uptime gauge is non-negative
  // -------------------------------------------------------------------------
  test("uptime gauge is non-negative", () => {
    const exporter = new PrometheusExporter();
    const output = exporter.toTextFormat();
    const match = output.match(/^opensentinel_uptime_seconds (\S+)/m);
    expect(match).not.toBeNull();
    const uptime = parseFloat(match![1]);
    expect(uptime).toBeGreaterThanOrEqual(0);
  });

  // -------------------------------------------------------------------------
  // 19. Memory heap gauge is positive
  // -------------------------------------------------------------------------
  test("memory heap gauge is positive", () => {
    const exporter = new PrometheusExporter();
    const output = exporter.toTextFormat();
    const match = output.match(/^opensentinel_memory_heap_bytes (\S+)/m);
    expect(match).not.toBeNull();
    const heapBytes = parseFloat(match![1]);
    expect(heapBytes).toBeGreaterThan(0);
  });

  // -------------------------------------------------------------------------
  // 20. reset clears all metrics
  // -------------------------------------------------------------------------
  test("reset clears all metrics", () => {
    const exporter = new PrometheusExporter();

    // Record some data across all metric types
    exporter.recordRequest("claude-3", "telegram");
    exporter.recordTokens("claude-3", 100, 200);
    exporter.recordError("timeout");
    exporter.recordToolExecution("web_search", true, 120);
    exporter.recordLatency(500);

    // Verify data is present before reset
    const beforeReset = exporter.toTextFormat();
    expect(beforeReset).toContain('opensentinel_requests_total{channel="telegram",model="claude-3"} 1');

    // Reset
    exporter.reset();

    // Verify all counters are cleared (no data lines for counters)
    const afterReset = exporter.toTextFormat();
    expect(afterReset).not.toContain('opensentinel_requests_total{');
    expect(afterReset).not.toContain('opensentinel_tokens_input_total{');
    expect(afterReset).not.toContain('opensentinel_tokens_output_total{');
    expect(afterReset).not.toContain('opensentinel_errors_total{');
    expect(afterReset).not.toContain('opensentinel_tool_executions_total{');

    // Verify histograms are cleared (_count should be 0)
    expect(afterReset).toContain("opensentinel_response_latency_ms_count 0");
    expect(afterReset).toContain("opensentinel_response_latency_ms_sum 0");
    expect(afterReset).toContain("opensentinel_tool_duration_ms_count 0");
    expect(afterReset).toContain("opensentinel_tool_duration_ms_sum 0");
  });
});
