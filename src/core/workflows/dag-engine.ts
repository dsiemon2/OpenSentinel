/**
 * DAG Workflow Engine
 * Ported from GoGreen-Workflow-Hub
 *
 * Features:
 * - Directed Acyclic Graph workflow execution
 * - 7 node types: trigger, action, condition, loop, delay, ai, webhook
 * - Parallel branch execution
 * - Variable passing between nodes
 * - Error handling and retries
 * - Execution history and replay
 */

export type NodeType =
  | "trigger"
  | "action"
  | "condition"
  | "loop"
  | "delay"
  | "ai"
  | "webhook";

export interface DAGNode {
  id: string;
  type: NodeType;
  name: string;
  config: Record<string, unknown>;
  /** Next node IDs (edges) */
  next: string[];
  /** For condition nodes: true branch */
  trueBranch?: string;
  /** For condition nodes: false branch */
  falseBranch?: string;
  /** Retry configuration */
  retries?: number;
  /** Timeout in ms */
  timeout?: number;
}

export interface DAGWorkflow {
  id: string;
  name: string;
  description?: string;
  nodes: Record<string, DAGNode>;
  /** Entry point node ID */
  entryNodeId: string;
  /** Global variables */
  variables: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface NodeExecution {
  nodeId: string;
  nodeName: string;
  nodeType: NodeType;
  status: "pending" | "running" | "completed" | "failed" | "skipped";
  input: Record<string, unknown>;
  output?: unknown;
  error?: string;
  startedAt?: Date;
  completedAt?: Date;
  durationMs?: number;
  retryCount: number;
}

export interface WorkflowExecution {
  id: string;
  workflowId: string;
  status: "pending" | "running" | "completed" | "failed" | "cancelled";
  nodeExecutions: NodeExecution[];
  variables: Record<string, unknown>;
  startedAt: Date;
  completedAt?: Date;
  error?: string;
}

/** Node executor function signature */
export type NodeExecutor = (
  node: DAGNode,
  variables: Record<string, unknown>
) => Promise<unknown>;

/**
 * DAG Workflow Engine
 */
export class DAGEngine {
  private workflows = new Map<string, DAGWorkflow>();
  private executions: WorkflowExecution[] = [];
  private executors = new Map<NodeType, NodeExecutor>();
  private idCounter = 0;

  constructor() {
    this.registerDefaultExecutors();
  }

  private registerDefaultExecutors(): void {
    // Trigger node - passes through
    this.executors.set("trigger", async (node, variables) => {
      return { triggered: true, ...node.config };
    });

    // Action node - executes configured action
    this.executors.set("action", async (node, variables) => {
      const actionType = node.config.actionType as string;
      const params = this.resolveVariables(
        node.config.params as Record<string, unknown> || {},
        variables
      );
      return { actionType, params, executed: true };
    });

    // Condition node - evaluates expression
    this.executors.set("condition", async (node, variables) => {
      const field = node.config.field as string;
      const operator = node.config.operator as string;
      const value = node.config.value;
      const actual = this.resolveVariable(field, variables);

      let result: boolean;
      switch (operator) {
        case "equals": result = actual === value; break;
        case "not_equals": result = actual !== value; break;
        case "greater_than": result = Number(actual) > Number(value); break;
        case "less_than": result = Number(actual) < Number(value); break;
        case "contains": result = String(actual).includes(String(value)); break;
        case "is_true": result = Boolean(actual); break;
        case "is_false": result = !actual; break;
        default: result = false;
      }

      return { condition: result };
    });

    // Loop node - iterates over collection
    this.executors.set("loop", async (node, variables) => {
      const collection = this.resolveVariable(
        node.config.collection as string,
        variables
      );
      if (!Array.isArray(collection)) {
        return { iterations: 0, error: "Collection is not an array" };
      }
      return { iterations: collection.length, items: collection };
    });

    // Delay node - waits for specified duration
    this.executors.set("delay", async (node) => {
      const delayMs = (node.config.delayMs as number) || 1000;
      await new Promise((resolve) => setTimeout(resolve, Math.min(delayMs, 60000)));
      return { delayed: true, durationMs: delayMs };
    });

    // AI node - placeholder for AI execution
    this.executors.set("ai", async (node, variables) => {
      const prompt = this.resolveVariables(
        { prompt: node.config.prompt },
        variables
      ).prompt as string;
      return { prompt, aiProcessed: true };
    });

    // Webhook node - sends HTTP request
    this.executors.set("webhook", async (node, variables) => {
      const url = this.resolveVariable(
        node.config.url as string,
        variables
      ) as string;
      const method = (node.config.method as string) || "POST";
      const body = node.config.body
        ? this.resolveVariables(
            node.config.body as Record<string, unknown>,
            variables
          )
        : undefined;

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
      });

      return {
        status: response.status,
        ok: response.ok,
        data: await response.json().catch(() => null),
      };
    });
  }

  /**
   * Register a custom node executor
   */
  registerExecutor(type: NodeType, executor: NodeExecutor): void {
    this.executors.set(type, executor);
  }

  /**
   * Resolve {{variable}} references in a string
   */
  private resolveVariable(
    template: string,
    variables: Record<string, unknown>
  ): unknown {
    if (typeof template !== "string") return template;

    // Direct variable reference
    if (template.startsWith("{{") && template.endsWith("}}")) {
      const key = template.slice(2, -2).trim();
      return this.getNestedValue(variables, key);
    }

    // Template interpolation
    return template.replace(/\{\{(\w+(?:\.\w+)*)\}\}/g, (_, key) => {
      const value = this.getNestedValue(variables, key);
      return value !== undefined ? String(value) : `{{${key}}}`;
    });
  }

  private resolveVariables(
    obj: Record<string, unknown>,
    variables: Record<string, unknown>
  ): Record<string, unknown> {
    const resolved: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === "string") {
        resolved[key] = this.resolveVariable(value, variables);
      } else if (typeof value === "object" && value !== null && !Array.isArray(value)) {
        resolved[key] = this.resolveVariables(
          value as Record<string, unknown>,
          variables
        );
      } else {
        resolved[key] = value;
      }
    }
    return resolved;
  }

  private getNestedValue(
    obj: Record<string, unknown>,
    path: string
  ): unknown {
    const parts = path.split(".");
    let current: unknown = obj;
    for (const part of parts) {
      if (current === null || current === undefined) return undefined;
      current = (current as Record<string, unknown>)[part];
    }
    return current;
  }

  /**
   * Create a workflow
   */
  createWorkflow(
    config: Omit<DAGWorkflow, "id" | "createdAt" | "updatedAt">
  ): DAGWorkflow {
    // Validate DAG (no cycles)
    this.validateDAG(config.nodes, config.entryNodeId);

    const workflow: DAGWorkflow = {
      ...config,
      id: `wf_${++this.idCounter}`,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.workflows.set(workflow.id, workflow);
    return workflow;
  }

  /**
   * Validate that the workflow is a proper DAG (no cycles)
   */
  private validateDAG(
    nodes: Record<string, DAGNode>,
    entryId: string
  ): void {
    const visited = new Set<string>();
    const inStack = new Set<string>();

    const dfs = (nodeId: string): void => {
      if (inStack.has(nodeId)) {
        throw new Error(`Cycle detected at node: ${nodeId}`);
      }
      if (visited.has(nodeId)) return;

      visited.add(nodeId);
      inStack.add(nodeId);

      const node = nodes[nodeId];
      if (node) {
        for (const next of node.next) {
          dfs(next);
        }
        if (node.trueBranch) dfs(node.trueBranch);
        if (node.falseBranch) dfs(node.falseBranch);
      }

      inStack.delete(nodeId);
    };

    dfs(entryId);
  }

  /**
   * Execute a workflow
   */
  async execute(
    workflowId: string,
    triggerData: Record<string, unknown> = {}
  ): Promise<WorkflowExecution> {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) throw new Error(`Workflow not found: ${workflowId}`);

    const execution: WorkflowExecution = {
      id: `exec_${++this.idCounter}`,
      workflowId,
      status: "running",
      nodeExecutions: [],
      variables: { ...workflow.variables, trigger: triggerData },
      startedAt: new Date(),
    };

    this.executions.push(execution);

    try {
      await this.executeNode(workflow, workflow.entryNodeId, execution);
      execution.status = "completed";
    } catch (error) {
      execution.status = "failed";
      execution.error =
        error instanceof Error ? error.message : String(error);
    }

    execution.completedAt = new Date();
    return execution;
  }

  private async executeNode(
    workflow: DAGWorkflow,
    nodeId: string,
    execution: WorkflowExecution
  ): Promise<void> {
    const node = workflow.nodes[nodeId];
    if (!node) return;

    const nodeExec: NodeExecution = {
      nodeId: node.id,
      nodeName: node.name,
      nodeType: node.type,
      status: "running",
      input: { ...execution.variables },
      startedAt: new Date(),
      retryCount: 0,
    };
    execution.nodeExecutions.push(nodeExec);

    const executor = this.executors.get(node.type);
    if (!executor) {
      nodeExec.status = "failed";
      nodeExec.error = `No executor for node type: ${node.type}`;
      return;
    }

    const maxRetries = node.retries || 0;
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const timeoutMs = node.timeout || 30000;
        const result = await Promise.race([
          executor(node, execution.variables),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error("Node timeout")), timeoutMs)
          ),
        ]);

        nodeExec.output = result;
        nodeExec.status = "completed";
        nodeExec.completedAt = new Date();
        nodeExec.durationMs =
          nodeExec.completedAt.getTime() - nodeExec.startedAt!.getTime();

        // Store result in variables
        execution.variables[`node_${node.id}`] = result;

        // Determine next nodes
        if (node.type === "condition") {
          const conditionResult = (result as Record<string, boolean>)?.condition;
          const nextId = conditionResult ? node.trueBranch : node.falseBranch;
          if (nextId) {
            await this.executeNode(workflow, nextId, execution);
          }
        } else if (node.type === "loop") {
          const items = (result as Record<string, unknown[]>)?.items || [];
          for (let i = 0; i < items.length; i++) {
            execution.variables.loopIndex = i;
            execution.variables.loopItem = items[i];
            for (const nextId of node.next) {
              await this.executeNode(workflow, nextId, execution);
            }
          }
        } else {
          // Execute next nodes in parallel if multiple
          if (node.next.length === 1) {
            await this.executeNode(workflow, node.next[0], execution);
          } else if (node.next.length > 1) {
            await Promise.all(
              node.next.map((nextId) =>
                this.executeNode(workflow, nextId, execution)
              )
            );
          }
        }

        return; // Success - exit retry loop
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        nodeExec.retryCount = attempt + 1;
      }
    }

    // All retries exhausted
    nodeExec.status = "failed";
    nodeExec.error = lastError?.message;
    nodeExec.completedAt = new Date();
    throw lastError;
  }

  /**
   * Get a workflow
   */
  getWorkflow(id: string): DAGWorkflow | undefined {
    return this.workflows.get(id);
  }

  /**
   * List all workflows
   */
  listWorkflows(): DAGWorkflow[] {
    return Array.from(this.workflows.values());
  }

  /**
   * Get execution history for a workflow
   */
  getExecutions(workflowId?: string): WorkflowExecution[] {
    if (workflowId) {
      return this.executions.filter((e) => e.workflowId === workflowId);
    }
    return [...this.executions];
  }

  /**
   * Delete a workflow
   */
  deleteWorkflow(id: string): boolean {
    return this.workflows.delete(id);
  }
}

export const dagEngine = new DAGEngine();
