// ============================================
// Brain Telemetry — Central event emitter for pipeline observability
// ============================================
// Singleton EventEmitter that decouples telemetry emission from consumption.
// Pipeline code fires events; WebSocket broadcast, API polling, and
// future consumers subscribe without coupling.
//
// Ring buffer of ActivityEntry items (bounded memory).
// BrainStatus computed from events (O(1) access).
// Score aggregation delegates to costTracker + internal accumulators.

import { EventEmitter } from "events";
import { costTracker } from "./cost-tracker";

// ============================================
// Types
// ============================================

export type BrainEventType =
  | "pipeline_start"
  | "memory_search_start"
  | "memory_search_complete"
  | "classification_start"
  | "classification_complete"
  | "pre_execution_start"
  | "pre_execution_complete"
  | "tool_start"
  | "tool_complete"
  | "response_start"
  | "response_complete"
  | "memory_extract_start"
  | "memory_extract_complete"
  | "agent_spawn"
  | "agent_progress"
  | "agent_complete"
  | "error";

export interface BrainEvent {
  type: BrainEventType;
  timestamp: number;
  requestId: string;
  userId?: string;
  data: Record<string, unknown>;
}

export type ActivityCategory =
  | "system"
  | "memory"
  | "classification"
  | "tool"
  | "agent"
  | "error";

export interface ActivityEntry {
  id: string;
  type: BrainEventType;
  timestamp: number;
  category: ActivityCategory;
  summary: string;
  details?: Record<string, unknown>;
  latencyMs?: number;
}

export type BrainState = "idle" | "thinking" | "executing_tools" | "streaming";

export interface BrainStatus {
  state: BrainState;
  currentRequestId: string | null;
  activeTools: string[];
  activeAgents: Array<{
    id: string;
    type: string;
    objective: string;
    status: string;
  }>;
  pipelineStage: string | null;
  uptime: number;
  lastActivity: number;
}

export interface PipelineMetrics {
  avgPipelineLatencyMs: number;
  avgMemorySearchLatencyMs: number;
  avgClassificationLatencyMs: number;
  memoryHitRate: number;
  toolSuccessRate: number;
  totalRequests: number;
}

export interface BrainScoreSnapshot {
  costSummary: {
    totalCost: number;
    costByTier: Record<string, number>;
    totalInputTokens: number;
    totalOutputTokens: number;
    requestCount: number;
    estimatedMonthlyCost: number;
    costTrend: { direction: string; strength: number };
  };
  pipelineMetrics: PipelineMetrics;
}

// ============================================
// Event → Category mapping
// ============================================

const EVENT_CATEGORY: Record<BrainEventType, ActivityCategory> = {
  pipeline_start: "system",
  memory_search_start: "memory",
  memory_search_complete: "memory",
  classification_start: "classification",
  classification_complete: "classification",
  pre_execution_start: "system",
  pre_execution_complete: "system",
  tool_start: "tool",
  tool_complete: "tool",
  response_start: "system",
  response_complete: "system",
  memory_extract_start: "memory",
  memory_extract_complete: "memory",
  agent_spawn: "agent",
  agent_progress: "agent",
  agent_complete: "agent",
  error: "error",
};

// ============================================
// Event → Summary builders
// ============================================

function buildSummary(event: BrainEvent): string {
  const d = event.data;
  switch (event.type) {
    case "pipeline_start":
      return `Pipeline started: "${truncate(d.message as string, 60)}"`;
    case "memory_search_start":
      return "Searching memories...";
    case "memory_search_complete":
      return `Found ${d.count ?? 0} relevant memories`;
    case "classification_start":
      return "Classifying tool categories...";
    case "classification_complete": {
      const cats = d.categories as string[] | undefined;
      return cats?.length
        ? `Classified: ${cats.join(", ")}`
        : "Classification: no specific tools needed";
    }
    case "pre_execution_start":
      return `Pre-executing ${d.count ?? 0} tool categories...`;
    case "pre_execution_complete":
      return `Pre-execution done (${d.successCount ?? 0}/${d.totalCount ?? 0} succeeded)`;
    case "tool_start":
      return `Executing tool: ${d.toolName}`;
    case "tool_complete":
      return `Tool ${d.toolName}: ${d.success ? "success" : "failed"}`;
    case "response_start":
      return `Generating response (model: ${d.model || "unknown"})`;
    case "response_complete":
      return `Response complete (${d.inputTokens ?? 0}+${d.outputTokens ?? 0} tokens, ${d.toolCount ?? 0} tools)`;
    case "memory_extract_start":
      return "Extracting facts from response...";
    case "memory_extract_complete":
      return `Extracted ${d.stored ?? 0} facts (${d.duplicates ?? 0} duplicates skipped)`;
    case "agent_spawn":
      return `Agent spawned: ${d.type} — "${truncate(d.objective as string, 50)}"`;
    case "agent_progress":
      return `Agent ${d.agentId}: ${d.description}`;
    case "agent_complete":
      return `Agent ${d.agentId} ${d.success ? "completed" : "failed"}`;
    case "error":
      return `Error: ${d.message || "unknown"}`;
    default:
      return event.type;
  }
}

function truncate(s: string | undefined, maxLen: number): string {
  if (!s) return "";
  return s.length > maxLen ? s.slice(0, maxLen) + "..." : s;
}

// ============================================
// BrainTelemetry Singleton
// ============================================

class BrainTelemetry extends EventEmitter {
  private activityBuffer: ActivityEntry[] = [];
  private maxBufferSize = 500;
  private idCounter = 0;
  private startTime = Date.now();

  // Status state
  private _status: BrainStatus = {
    state: "idle",
    currentRequestId: null,
    activeTools: [],
    activeAgents: [],
    pipelineStage: null,
    uptime: Date.now(),
    lastActivity: Date.now(),
  };

  // Latency accumulators (rolling window of last 100)
  private pipelineLatencies: number[] = [];
  private memoryLatencies: number[] = [];
  private classificationLatencies: number[] = [];
  private readonly maxLatencyWindow = 100;

  // Counter tracking
  private memoryHits = 0;
  private memorySearches = 0;
  private toolSuccesses = 0;
  private toolTotal = 0;
  private totalRequests = 0;

  constructor() {
    super();
    this.setMaxListeners(50); // Allow many subscribers
  }

  /**
   * Emit a brain telemetry event. Updates internal state and
   * fires the "brain_event" EventEmitter event for subscribers.
   */
  emitEvent(event: BrainEvent): void {
    this.updateStatus(event);
    this.addActivity(event);
    this.updateMetrics(event);
    super.emit("brain_event", event);
  }

  // ---- Status ----

  private updateStatus(event: BrainEvent): void {
    this._status.lastActivity = event.timestamp;

    switch (event.type) {
      case "pipeline_start":
        this._status.state = "thinking";
        this._status.currentRequestId = event.requestId;
        this._status.pipelineStage = "Memory Search";
        this._status.activeTools = [];
        this.totalRequests++;
        break;

      case "memory_search_start":
        this._status.pipelineStage = "Memory Search";
        break;

      case "memory_search_complete":
        this._status.pipelineStage = "Classification";
        break;

      case "classification_complete":
        this._status.pipelineStage = "Pre-Execution";
        break;

      case "pre_execution_complete":
        this._status.pipelineStage = "LLM Call";
        break;

      case "tool_start":
        this._status.state = "executing_tools";
        this._status.pipelineStage = "Tool Execution";
        if (event.data.toolName) {
          this._status.activeTools = [
            ...this._status.activeTools,
            event.data.toolName as string,
          ];
        }
        break;

      case "tool_complete":
        if (event.data.toolName) {
          this._status.activeTools = this._status.activeTools.filter(
            (t) => t !== event.data.toolName
          );
        }
        if (this._status.activeTools.length === 0) {
          this._status.state = "thinking";
          this._status.pipelineStage = "LLM Call";
        }
        break;

      case "response_start":
        this._status.state = "streaming";
        this._status.pipelineStage = "Response";
        break;

      case "response_complete":
        this._status.state = "idle";
        this._status.pipelineStage = null;
        this._status.currentRequestId = null;
        this._status.activeTools = [];
        break;

      case "memory_extract_complete":
        // Extraction is fire-and-forget; state is already idle
        break;

      case "agent_spawn":
        this._status.activeAgents.push({
          id: event.data.agentId as string,
          type: event.data.type as string,
          objective: truncate(event.data.objective as string, 80),
          status: "running",
        });
        break;

      case "agent_complete":
        this._status.activeAgents = this._status.activeAgents.filter(
          (a) => a.id !== event.data.agentId
        );
        break;

      case "error":
        // Don't change state to idle on error — the pipeline may continue
        break;
    }
  }

  // ---- Activity ----

  private addActivity(event: BrainEvent): void {
    const entry: ActivityEntry = {
      id: `act-${++this.idCounter}`,
      type: event.type,
      timestamp: event.timestamp,
      category: EVENT_CATEGORY[event.type] || "system",
      summary: buildSummary(event),
      details: event.data,
      latencyMs: (event.data.latencyMs as number) ?? undefined,
    };

    this.activityBuffer.push(entry);
    if (this.activityBuffer.length > this.maxBufferSize) {
      this.activityBuffer = this.activityBuffer.slice(-this.maxBufferSize);
    }
  }

  // ---- Metrics ----

  private updateMetrics(event: BrainEvent): void {
    const latency = event.data.latencyMs as number | undefined;

    switch (event.type) {
      case "response_complete":
        if (event.data.pipelineLatencyMs) {
          this.pushLatency(
            this.pipelineLatencies,
            event.data.pipelineLatencyMs as number
          );
        }
        break;

      case "memory_search_complete":
        this.memorySearches++;
        if (latency) this.pushLatency(this.memoryLatencies, latency);
        if ((event.data.count as number) > 0) this.memoryHits++;
        break;

      case "classification_complete":
        if (latency)
          this.pushLatency(this.classificationLatencies, latency);
        break;

      case "tool_complete":
        this.toolTotal++;
        if (event.data.success) this.toolSuccesses++;
        break;
    }
  }

  private pushLatency(buffer: number[], value: number): void {
    buffer.push(value);
    if (buffer.length > this.maxLatencyWindow) {
      buffer.shift();
    }
  }

  private average(arr: number[]): number {
    if (arr.length === 0) return 0;
    return arr.reduce((a, b) => a + b, 0) / arr.length;
  }

  // ============================================
  // Public API
  // ============================================

  getStatus(): BrainStatus {
    return {
      ...this._status,
      uptime: Date.now() - this.startTime,
      activeTools: [...this._status.activeTools],
      activeAgents: [...this._status.activeAgents],
    };
  }

  getActivity(limit: number = 100): ActivityEntry[] {
    const start = Math.max(0, this.activityBuffer.length - limit);
    return this.activityBuffer.slice(start);
  }

  getScores(): BrainScoreSnapshot {
    const summary = costTracker.getCostSummary();
    const trend = costTracker.getCostTrend();
    const monthly = costTracker.getEstimatedMonthlyCost();

    return {
      costSummary: {
        totalCost: summary.totalCost,
        costByTier: summary.costByTier,
        totalInputTokens: summary.totalInputTokens,
        totalOutputTokens: summary.totalOutputTokens,
        requestCount: summary.requestCount,
        estimatedMonthlyCost: monthly,
        costTrend: { direction: trend.direction, strength: trend.strength },
      },
      pipelineMetrics: {
        avgPipelineLatencyMs: Math.round(this.average(this.pipelineLatencies)),
        avgMemorySearchLatencyMs: Math.round(
          this.average(this.memoryLatencies)
        ),
        avgClassificationLatencyMs: Math.round(
          this.average(this.classificationLatencies)
        ),
        memoryHitRate:
          this.memorySearches > 0
            ? Math.round((this.memoryHits / this.memorySearches) * 100)
            : 0,
        toolSuccessRate:
          this.toolTotal > 0
            ? Math.round((this.toolSuccesses / this.toolTotal) * 100)
            : 0,
        totalRequests: this.totalRequests,
      },
    };
  }

  /** Clear all accumulated data (for testing) */
  reset(): void {
    this.activityBuffer = [];
    this.idCounter = 0;
    this._status = {
      state: "idle",
      currentRequestId: null,
      activeTools: [],
      activeAgents: [],
      pipelineStage: null,
      uptime: Date.now(),
      lastActivity: Date.now(),
    };
    this.pipelineLatencies = [];
    this.memoryLatencies = [];
    this.classificationLatencies = [];
    this.memoryHits = 0;
    this.memorySearches = 0;
    this.toolSuccesses = 0;
    this.toolTotal = 0;
    this.totalRequests = 0;
    this.startTime = Date.now();
  }
}

export const brainTelemetry = new BrainTelemetry();
