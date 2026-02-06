// Node-based Execution Graph System
// Visual workflow builder where nodes connect to form execution graphs

import { randomUUID } from "crypto";

// ============================================
// NODE TYPES
// ============================================

export type NodeType =
  | "trigger"      // Entry point — starts execution
  | "action"       // Performs an operation
  | "condition"    // Branches based on condition
  | "transform"    // Transforms data
  | "delay"        // Waits for a duration
  | "loop"         // Iterates over data
  | "parallel"     // Runs branches in parallel
  | "merge"        // Merges parallel branches
  | "output"       // Terminal node — produces output
  | "subgraph";    // Embedded sub-graph

export interface NodePort {
  id: string;
  name: string;
  type: "input" | "output";
  dataType: "any" | "string" | "number" | "boolean" | "array" | "object";
  connected: boolean;
}

export interface GraphNode {
  id: string;
  type: NodeType;
  label: string;
  description?: string;
  config: Record<string, unknown>;
  inputs: NodePort[];
  outputs: NodePort[];
  position: { x: number; y: number }; // For visual layout
  metadata?: Record<string, unknown>;
}

export interface Edge {
  id: string;
  sourceNodeId: string;
  sourcePortId: string;
  targetNodeId: string;
  targetPortId: string;
  label?: string;
}

export interface ExecutionGraph {
  id: string;
  name: string;
  description?: string;
  nodes: Map<string, GraphNode>;
  edges: Edge[];
  variables: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  enabled: boolean;
}

// ============================================
// EXECUTION STATE
// ============================================

export type NodeStatus = "pending" | "running" | "completed" | "failed" | "skipped";

export interface NodeExecutionResult {
  nodeId: string;
  status: NodeStatus;
  output: Record<string, unknown>;
  error?: string;
  startedAt: Date;
  completedAt?: Date;
  duration?: number;
}

export interface GraphExecutionState {
  graphId: string;
  runId: string;
  status: "running" | "completed" | "failed" | "cancelled";
  startedAt: Date;
  completedAt?: Date;
  nodeResults: Map<string, NodeExecutionResult>;
  variables: Record<string, unknown>;
  error?: string;
}

// ============================================
// NODE HANDLERS
// ============================================

export type NodeHandler = (
  node: GraphNode,
  inputs: Record<string, unknown>,
  state: GraphExecutionState
) => Promise<Record<string, unknown>>;

// Built-in node handlers
const nodeHandlers: Map<string, NodeHandler> = new Map();

// Register a handler for a node type
export function registerNodeHandler(type: string, handler: NodeHandler): void {
  nodeHandlers.set(type, handler);
}

// ============================================
// GRAPH BUILDER
// ============================================

export class GraphBuilder {
  private graph: ExecutionGraph;

  constructor(name: string, createdBy: string) {
    this.graph = {
      id: randomUUID().slice(0, 8),
      name,
      nodes: new Map(),
      edges: [],
      variables: {},
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy,
      enabled: true,
    };
  }

  addNode(params: {
    type: NodeType;
    label: string;
    config?: Record<string, unknown>;
    position?: { x: number; y: number };
    inputs?: Array<{ name: string; dataType?: NodePort["dataType"] }>;
    outputs?: Array<{ name: string; dataType?: NodePort["dataType"] }>;
  }): string {
    const nodeId = randomUUID().slice(0, 8);

    const node: GraphNode = {
      id: nodeId,
      type: params.type,
      label: params.label,
      config: params.config ?? {},
      position: params.position ?? { x: 0, y: 0 },
      inputs: (params.inputs ?? [{ name: "in" }]).map((inp, i) => ({
        id: `${nodeId}_in_${i}`,
        name: inp.name,
        type: "input",
        dataType: inp.dataType ?? "any",
        connected: false,
      })),
      outputs: (params.outputs ?? [{ name: "out" }]).map((out, i) => ({
        id: `${nodeId}_out_${i}`,
        name: out.name,
        type: "output",
        dataType: out.dataType ?? "any",
        connected: false,
      })),
    };

    this.graph.nodes.set(nodeId, node);
    return nodeId;
  }

  connect(
    sourceNodeId: string,
    sourcePortIndex: number,
    targetNodeId: string,
    targetPortIndex: number
  ): string {
    const sourceNode = this.graph.nodes.get(sourceNodeId);
    const targetNode = this.graph.nodes.get(targetNodeId);

    if (!sourceNode || !targetNode) {
      throw new Error("Node not found");
    }

    const sourcePort = sourceNode.outputs[sourcePortIndex];
    const targetPort = targetNode.inputs[targetPortIndex];

    if (!sourcePort || !targetPort) {
      throw new Error("Port not found");
    }

    const edgeId = randomUUID().slice(0, 8);
    const edge: Edge = {
      id: edgeId,
      sourceNodeId,
      sourcePortId: sourcePort.id,
      targetNodeId,
      targetPortId: targetPort.id,
    };

    this.graph.edges.push(edge);
    sourcePort.connected = true;
    targetPort.connected = true;

    return edgeId;
  }

  setVariable(name: string, value: unknown): void {
    this.graph.variables[name] = value;
  }

  build(): ExecutionGraph {
    this.graph.updatedAt = new Date();
    return this.graph;
  }
}

// ============================================
// GRAPH EXECUTOR
// ============================================

export class GraphExecutor {
  /**
   * Execute a graph from its trigger nodes
   */
  async execute(
    graph: ExecutionGraph,
    triggerData?: Record<string, unknown>
  ): Promise<GraphExecutionState> {
    const state: GraphExecutionState = {
      graphId: graph.id,
      runId: randomUUID().slice(0, 8),
      status: "running",
      startedAt: new Date(),
      nodeResults: new Map(),
      variables: { ...graph.variables, ...triggerData },
    };

    try {
      // Find trigger nodes (entry points)
      const triggerNodes = this.findTriggerNodes(graph);

      if (triggerNodes.length === 0) {
        throw new Error("No trigger nodes found in graph");
      }

      // Execute from each trigger node
      for (const triggerNode of triggerNodes) {
        await this.executeNode(graph, triggerNode, {}, state);
      }

      state.status = "completed";
    } catch (error) {
      state.status = "failed";
      state.error = error instanceof Error ? error.message : String(error);
    }

    state.completedAt = new Date();
    return state;
  }

  private async executeNode(
    graph: ExecutionGraph,
    node: GraphNode,
    inputs: Record<string, unknown>,
    state: GraphExecutionState
  ): Promise<Record<string, unknown>> {
    // Skip if already executed
    if (state.nodeResults.has(node.id)) {
      return state.nodeResults.get(node.id)!.output;
    }

    const result: NodeExecutionResult = {
      nodeId: node.id,
      status: "running",
      output: {},
      startedAt: new Date(),
    };

    state.nodeResults.set(node.id, result);

    try {
      // Handle condition nodes
      if (node.type === "condition") {
        return await this.executeConditionNode(graph, node, inputs, state);
      }

      // Handle delay nodes
      if (node.type === "delay") {
        const delayMs = (node.config.delayMs as number) ?? 1000;
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }

      // Handle loop nodes
      if (node.type === "loop") {
        return await this.executeLoopNode(graph, node, inputs, state);
      }

      // Execute handler for this node type
      const handler = nodeHandlers.get(node.type) ?? nodeHandlers.get(node.config.handlerType as string);

      let output: Record<string, unknown> = {};
      if (handler) {
        output = await handler(node, { ...inputs, ...state.variables }, state);
      } else {
        // Default: pass inputs through
        output = inputs;
      }

      result.status = "completed";
      result.output = output;
      result.completedAt = new Date();
      result.duration = result.completedAt.getTime() - result.startedAt.getTime();

      // Execute downstream nodes
      const downstreamEdges = graph.edges.filter((e) => e.sourceNodeId === node.id);
      for (const edge of downstreamEdges) {
        const targetNode = graph.nodes.get(edge.targetNodeId);
        if (targetNode) {
          await this.executeNode(graph, targetNode, output, state);
        }
      }

      return output;
    } catch (error) {
      result.status = "failed";
      result.error = error instanceof Error ? error.message : String(error);
      result.completedAt = new Date();
      result.duration = result.completedAt.getTime() - result.startedAt.getTime();
      throw error;
    }
  }

  private async executeConditionNode(
    graph: ExecutionGraph,
    node: GraphNode,
    inputs: Record<string, unknown>,
    state: GraphExecutionState
  ): Promise<Record<string, unknown>> {
    const conditionField = node.config.field as string;
    const conditionOp = (node.config.operator as string) ?? "equals";
    const conditionValue = node.config.value;

    const fieldValue = inputs[conditionField] ?? state.variables[conditionField];
    let conditionMet = false;

    switch (conditionOp) {
      case "equals":
        conditionMet = fieldValue === conditionValue;
        break;
      case "not_equals":
        conditionMet = fieldValue !== conditionValue;
        break;
      case "greater_than":
        conditionMet = Number(fieldValue) > Number(conditionValue);
        break;
      case "less_than":
        conditionMet = Number(fieldValue) < Number(conditionValue);
        break;
      case "contains":
        conditionMet = String(fieldValue).includes(String(conditionValue));
        break;
      case "truthy":
        conditionMet = !!fieldValue;
        break;
      default:
        conditionMet = !!fieldValue;
    }

    const result = state.nodeResults.get(node.id)!;
    result.status = "completed";
    result.output = { conditionMet, ...inputs };
    result.completedAt = new Date();

    // Execute the appropriate branch (output 0 = true, output 1 = false)
    const edges = graph.edges.filter((e) => e.sourceNodeId === node.id);
    const trueEdge = edges.find((e) => e.sourcePortId === node.outputs[0]?.id);
    const falseEdge = edges.find((e) => e.sourcePortId === node.outputs[1]?.id);

    const targetEdge = conditionMet ? trueEdge : falseEdge;
    if (targetEdge) {
      const targetNode = graph.nodes.get(targetEdge.targetNodeId);
      if (targetNode) {
        await this.executeNode(graph, targetNode, inputs, state);
      }
    }

    return { conditionMet, ...inputs };
  }

  private async executeLoopNode(
    graph: ExecutionGraph,
    node: GraphNode,
    inputs: Record<string, unknown>,
    state: GraphExecutionState
  ): Promise<Record<string, unknown>> {
    const iterableKey = node.config.iterableKey as string;
    const iterable = (inputs[iterableKey] ?? state.variables[iterableKey]) as unknown[];

    if (!Array.isArray(iterable)) {
      throw new Error(`Loop node: ${iterableKey} is not iterable`);
    }

    const results: unknown[] = [];
    const bodyEdges = graph.edges.filter((e) => e.sourceNodeId === node.id);

    for (let i = 0; i < iterable.length; i++) {
      const loopVars = {
        ...inputs,
        loopItem: iterable[i],
        loopIndex: i,
        loopTotal: iterable.length,
      };

      for (const edge of bodyEdges) {
        const bodyNode = graph.nodes.get(edge.targetNodeId);
        if (bodyNode) {
          // Reset the body node for re-execution
          state.nodeResults.delete(bodyNode.id);
          const bodyResult = await this.executeNode(graph, bodyNode, loopVars, state);
          results.push(bodyResult);
        }
      }
    }

    const result = state.nodeResults.get(node.id)!;
    result.status = "completed";
    result.output = { results, ...inputs };
    result.completedAt = new Date();

    return { results, ...inputs };
  }

  private findTriggerNodes(graph: ExecutionGraph): GraphNode[] {
    const result: GraphNode[] = [];
    for (const node of graph.nodes.values()) {
      if (node.type === "trigger") {
        result.push(node);
      }
    }
    return result;
  }
}

// ============================================
// GRAPH STORE
// ============================================

const graphs: Map<string, ExecutionGraph> = new Map();
const executionHistory: Map<string, GraphExecutionState[]> = new Map();

export class NodeGraphManager {
  private executor = new GraphExecutor();

  /**
   * Create a new graph
   */
  createGraph(name: string, createdBy: string): GraphBuilder {
    return new GraphBuilder(name, createdBy);
  }

  /**
   * Save a graph
   */
  saveGraph(graph: ExecutionGraph): void {
    graphs.set(graph.id, graph);
  }

  /**
   * Get a graph by ID
   */
  getGraph(graphId: string): ExecutionGraph | undefined {
    return graphs.get(graphId);
  }

  /**
   * List all graphs
   */
  listGraphs(userId?: string): ExecutionGraph[] {
    const result: ExecutionGraph[] = [];
    for (const graph of graphs.values()) {
      if (!userId || graph.createdBy === userId) {
        result.push(graph);
      }
    }
    return result;
  }

  /**
   * Delete a graph
   */
  deleteGraph(graphId: string): boolean {
    return graphs.delete(graphId);
  }

  /**
   * Execute a graph
   */
  async executeGraph(
    graphId: string,
    triggerData?: Record<string, unknown>
  ): Promise<GraphExecutionState> {
    const graph = graphs.get(graphId);
    if (!graph) {
      throw new Error(`Graph not found: ${graphId}`);
    }

    const state = await this.executor.execute(graph, triggerData);

    // Store in history
    if (!executionHistory.has(graphId)) {
      executionHistory.set(graphId, []);
    }
    const history = executionHistory.get(graphId)!;
    history.push(state);
    if (history.length > 100) history.splice(0, history.length - 100);

    return state;
  }

  /**
   * Get execution history for a graph
   */
  getHistory(graphId: string): GraphExecutionState[] {
    return executionHistory.get(graphId) ?? [];
  }

  /**
   * Export graph as JSON
   */
  exportGraph(graphId: string): string | null {
    const graph = graphs.get(graphId);
    if (!graph) return null;

    return JSON.stringify(
      {
        ...graph,
        nodes: Object.fromEntries(graph.nodes),
      },
      null,
      2
    );
  }

  /**
   * Import graph from JSON
   */
  importGraph(json: string, userId: string): ExecutionGraph | null {
    try {
      const data = JSON.parse(json);
      const graph: ExecutionGraph = {
        ...data,
        id: randomUUID().slice(0, 8),
        nodes: new Map(Object.entries(data.nodes)),
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: userId,
      };
      graphs.set(graph.id, graph);
      return graph;
    } catch {
      return null;
    }
  }
}

// Singleton
export const nodeGraphManager = new NodeGraphManager();

// ============================================
// REGISTER BUILT-IN NODE HANDLERS
// ============================================

// Trigger node: just passes through data
registerNodeHandler("trigger", async (_node, inputs) => inputs);

// Output node: just passes through data
registerNodeHandler("output", async (_node, inputs) => inputs);

// Transform node: applies a simple transformation
registerNodeHandler("transform", async (node, inputs) => {
  const expression = node.config.expression as string;
  if (!expression) return inputs;

  // Simple template substitution
  let result = expression;
  for (const [key, value] of Object.entries(inputs)) {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), String(value));
  }
  return { ...inputs, transformed: result };
});

// Action node: executes a tool
registerNodeHandler("action", async (node, inputs) => {
  const toolName = node.config.tool as string;
  if (!toolName) return inputs;

  const { executeTool } = await import("../../tools");
  const toolInput = (node.config.toolInput as Record<string, unknown>) ?? inputs;
  const result = await executeTool(toolName, toolInput);
  return { ...inputs, toolResult: result };
});

// Merge node: combines inputs
registerNodeHandler("merge", async (_node, inputs) => inputs);

// Parallel node: passes through (execution handled by executor)
registerNodeHandler("parallel", async (_node, inputs) => inputs);
