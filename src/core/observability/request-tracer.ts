/**
 * Request Tracer — Distributed tracing with AsyncLocalStorage
 *
 * Tracks the full lifecycle of a request through the system:
 * message → routing → memory → tool calls → response
 */

import { AsyncLocalStorage } from "async_hooks";

export interface TraceSpan {
  name: string;
  startTime: number;
  endTime?: number;
  durationMs?: number;
  metadata?: Record<string, unknown>;
}

export interface Trace {
  traceId: string;
  startTime: number;
  endTime?: number;
  durationMs?: number;
  spans: TraceSpan[];
  metadata: Record<string, unknown>;
}

const traceStorage = new AsyncLocalStorage<Trace>();

// In-memory trace store
const traces: Map<string, Trace> = new Map();
const MAX_TRACES = 1000;

export class RequestTracer {
  /**
   * Start a new trace
   */
  startTrace(traceId: string, metadata?: Record<string, unknown>): Trace {
    const trace: Trace = {
      traceId,
      startTime: Date.now(),
      spans: [],
      metadata: metadata || {},
    };

    traces.set(traceId, trace);

    // Trim old traces
    if (traces.size > MAX_TRACES) {
      const oldest = Array.from(traces.keys()).slice(0, traces.size - MAX_TRACES);
      for (const key of oldest) {
        traces.delete(key);
      }
    }

    return trace;
  }

  /**
   * Run a function within a trace context
   */
  withTrace<T>(traceId: string, fn: () => T, metadata?: Record<string, unknown>): T {
    const trace = this.startTrace(traceId, metadata);
    return traceStorage.run(trace, fn);
  }

  /**
   * Run an async function within a trace context
   */
  async withTraceAsync<T>(traceId: string, fn: () => Promise<T>, metadata?: Record<string, unknown>): Promise<T> {
    const trace = this.startTrace(traceId, metadata);
    return traceStorage.run(trace, fn);
  }

  /**
   * Add a span to the current trace
   */
  addSpan(name: string, metadata?: Record<string, unknown>): TraceSpan {
    const trace = this.getCurrentTrace();
    const span: TraceSpan = {
      name,
      startTime: Date.now(),
      metadata,
    };

    if (trace) {
      trace.spans.push(span);
    }

    return span;
  }

  /**
   * End a span (updates duration)
   */
  endSpan(span: TraceSpan): void {
    span.endTime = Date.now();
    span.durationMs = span.endTime - span.startTime;
  }

  /**
   * End the current trace
   */
  endTrace(): Trace | null {
    const trace = this.getCurrentTrace();
    if (trace) {
      trace.endTime = Date.now();
      trace.durationMs = trace.endTime - trace.startTime;
    }
    return trace;
  }

  /**
   * Get the current trace from AsyncLocalStorage
   */
  getCurrentTrace(): Trace | null {
    return traceStorage.getStore() || null;
  }

  /**
   * Get current trace ID
   */
  getCurrentTraceId(): string | null {
    const trace = this.getCurrentTrace();
    return trace ? trace.traceId : null;
  }

  /**
   * Get a stored trace by ID
   */
  getTrace(traceId: string): Trace | null {
    return traces.get(traceId) || null;
  }

  /**
   * Get recent traces
   */
  getRecentTraces(limit = 20): Trace[] {
    return Array.from(traces.values())
      .sort((a, b) => b.startTime - a.startTime)
      .slice(0, limit);
  }

  /**
   * Get trace count
   */
  getTraceCount(): number {
    return traces.size;
  }

  /**
   * Get average trace duration
   */
  getAverageDuration(): number {
    const completed = Array.from(traces.values()).filter((t) => t.durationMs != null);
    if (completed.length === 0) return 0;
    return completed.reduce((sum, t) => sum + (t.durationMs || 0), 0) / completed.length;
  }

  /**
   * Clear all traces
   */
  reset(): void {
    traces.clear();
  }
}

export const requestTracer = new RequestTracer();
