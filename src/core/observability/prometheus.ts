/**
 * Prometheus metrics exporter for OpenSentinel.
 *
 * Outputs metrics in the Prometheus text exposition format
 * (text/plain; version=0.0.4) for scraping by a Prometheus server.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CounterDefinition {
  name: string;
  help: string;
  labelNames: string[];
}

interface HistogramDefinition {
  name: string;
  help: string;
  buckets: number[];
}

interface GaugeDefinition {
  name: string;
  help: string;
}

// ---------------------------------------------------------------------------
// Definitions
// ---------------------------------------------------------------------------

const COUNTER_DEFINITIONS: CounterDefinition[] = [
  {
    name: "opensentinel_requests_total",
    help: "Total number of requests processed",
    labelNames: ["model", "channel"],
  },
  {
    name: "opensentinel_tokens_input_total",
    help: "Total number of input tokens consumed",
    labelNames: ["model"],
  },
  {
    name: "opensentinel_tokens_output_total",
    help: "Total number of output tokens produced",
    labelNames: ["model"],
  },
  {
    name: "opensentinel_errors_total",
    help: "Total number of errors encountered",
    labelNames: ["type"],
  },
  {
    name: "opensentinel_tool_executions_total",
    help: "Total number of tool executions",
    labelNames: ["tool", "success"],
  },
];

const HISTOGRAM_DEFINITIONS: HistogramDefinition[] = [
  {
    name: "opensentinel_response_latency_ms",
    help: "Response latency in milliseconds",
    buckets: [10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000, 30000],
  },
  {
    name: "opensentinel_tool_duration_ms",
    help: "Tool execution duration in milliseconds",
    buckets: [10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000, 30000],
  },
];

const GAUGE_DEFINITIONS: GaugeDefinition[] = [
  {
    name: "opensentinel_uptime_seconds",
    help: "Process uptime in seconds",
  },
  {
    name: "opensentinel_memory_heap_bytes",
    help: "Process heap memory usage in bytes",
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build a label key string from a labels record so it can be used as a Map
 * key. Labels are sorted alphabetically to ensure deterministic ordering.
 *
 * Example: `{model: "claude", channel: "telegram"}` -> `channel="telegram",model="claude"`
 */
function labelKey(labels: Record<string, string>): string {
  return Object.keys(labels)
    .sort()
    .map((k) => `${k}="${labels[k]}"`)
    .join(",");
}

/**
 * Format a labels record into the Prometheus `{key="value",...}` syntax.
 */
function formatLabels(labels: Record<string, string>): string {
  const parts = Object.keys(labels)
    .sort()
    .map((k) => `${k}="${labels[k]}"`);
  return parts.length > 0 ? `{${parts.join(",")}}` : "";
}

// ---------------------------------------------------------------------------
// PrometheusExporter
// ---------------------------------------------------------------------------

export class PrometheusExporter {
  // Counters: Map<metricName, Map<labelKey, { labels, value }>>
  private counters: Map<
    string,
    Map<string, { labels: Record<string, string>; value: number }>
  > = new Map();

  // Histograms: Map<metricName, observedValues[]>
  private histograms: Map<string, number[]> = new Map();

  private startTime: number;

  constructor() {
    this.startTime = Date.now();

    // Initialise counter maps
    for (const def of COUNTER_DEFINITIONS) {
      this.counters.set(def.name, new Map());
    }

    // Initialise histogram arrays
    for (const def of HISTOGRAM_DEFINITIONS) {
      this.histograms.set(def.name, []);
    }
  }

  // -----------------------------------------------------------------------
  // Generic counter / histogram operations
  // -----------------------------------------------------------------------

  /**
   * Increment a counter metric by `value` (default 1).
   */
  incrementCounter(
    name: string,
    labels: Record<string, string>,
    value: number = 1,
  ): void {
    const counterMap = this.counters.get(name);
    if (!counterMap) {
      return;
    }

    const key = labelKey(labels);
    const existing = counterMap.get(key);
    if (existing) {
      existing.value += value;
    } else {
      counterMap.set(key, { labels: { ...labels }, value });
    }
  }

  /**
   * Record an observed value for a histogram metric.
   */
  observeHistogram(name: string, value: number): void {
    const observations = this.histograms.get(name);
    if (!observations) {
      return;
    }
    observations.push(value);
  }

  // -----------------------------------------------------------------------
  // Convenience recording methods
  // -----------------------------------------------------------------------

  /**
   * Record a request against the requests counter.
   */
  recordRequest(model: string, channel: string): void {
    this.incrementCounter("opensentinel_requests_total", { model, channel });
  }

  /**
   * Record input and output token counts.
   */
  recordTokens(model: string, inputTokens: number, outputTokens: number): void {
    this.incrementCounter("opensentinel_tokens_input_total", { model }, inputTokens);
    this.incrementCounter("opensentinel_tokens_output_total", { model }, outputTokens);
  }

  /**
   * Record an error occurrence.
   */
  recordError(type: string): void {
    this.incrementCounter("opensentinel_errors_total", { type });
  }

  /**
   * Record a tool execution (success/failure) and its duration.
   */
  recordToolExecution(tool: string, success: boolean, durationMs: number): void {
    this.incrementCounter("opensentinel_tool_executions_total", {
      tool,
      success: String(success),
    });
    this.observeHistogram("opensentinel_tool_duration_ms", durationMs);
  }

  /**
   * Record overall response latency.
   */
  recordLatency(durationMs: number): void {
    this.observeHistogram("opensentinel_response_latency_ms", durationMs);
  }

  // -----------------------------------------------------------------------
  // Prometheus text exposition output
  // -----------------------------------------------------------------------

  /**
   * Produce the full metrics payload in Prometheus text exposition format
   * (`text/plain; version=0.0.4`).
   */
  toTextFormat(): string {
    const lines: string[] = [];

    // -- Counters ----------------------------------------------------------
    for (const def of COUNTER_DEFINITIONS) {
      lines.push(`# HELP ${def.name} ${def.help}`);
      lines.push(`# TYPE ${def.name} counter`);

      const counterMap = this.counters.get(def.name);
      if (counterMap) {
        for (const entry of counterMap.values()) {
          lines.push(`${def.name}${formatLabels(entry.labels)} ${entry.value}`);
        }
      }

      lines.push(""); // blank line between metric families
    }

    // -- Histograms --------------------------------------------------------
    for (const def of HISTOGRAM_DEFINITIONS) {
      lines.push(`# HELP ${def.name} ${def.help}`);
      lines.push(`# TYPE ${def.name} histogram`);

      const observations = this.histograms.get(def.name) ?? [];
      const count = observations.length;
      const sum = observations.reduce((a, b) => a + b, 0);

      // Bucket lines
      for (const le of def.buckets) {
        const bucketCount = observations.filter((v) => v <= le).length;
        lines.push(`${def.name}_bucket{le="${le}"} ${bucketCount}`);
      }
      lines.push(`${def.name}_bucket{le="+Inf"} ${count}`);

      lines.push(`${def.name}_sum ${sum}`);
      lines.push(`${def.name}_count ${count}`);

      lines.push("");
    }

    // -- Gauges ------------------------------------------------------------
    for (const def of GAUGE_DEFINITIONS) {
      lines.push(`# HELP ${def.name} ${def.help}`);
      lines.push(`# TYPE ${def.name} gauge`);

      if (def.name === "opensentinel_uptime_seconds") {
        const uptimeSeconds = (Date.now() - this.startTime) / 1000;
        lines.push(`${def.name} ${uptimeSeconds}`);
      } else if (def.name === "opensentinel_memory_heap_bytes") {
        const heapUsed = process.memoryUsage().heapUsed;
        lines.push(`${def.name} ${heapUsed}`);
      }

      lines.push("");
    }

    return lines.join("\n");
  }

  // -----------------------------------------------------------------------
  // Reset
  // -----------------------------------------------------------------------

  /**
   * Reset all metrics to their initial state.
   */
  reset(): void {
    for (const def of COUNTER_DEFINITIONS) {
      this.counters.set(def.name, new Map());
    }
    for (const def of HISTOGRAM_DEFINITIONS) {
      this.histograms.set(def.name, []);
    }
    this.startTime = Date.now();
  }
}

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

export const prometheusExporter = new PrometheusExporter();
