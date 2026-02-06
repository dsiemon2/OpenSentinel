import { describe, test, expect, beforeEach } from "bun:test";
import {
  GraphBuilder,
  GraphExecutor,
  NodeGraphManager,
  nodeGraphManager,
  registerNodeHandler,
} from "../src/core/nodes/index";
import type {
  NodeType,
  NodePort,
  GraphNode,
  Edge,
  ExecutionGraph,
  NodeStatus,
  NodeExecutionResult,
  GraphExecutionState,
  NodeHandler,
} from "../src/core/nodes/index";

// Helper to build and save a simple trigger->output graph
function buildSimpleGraph(
  name: string = "simple-test",
  creator: string = "tester"
): ExecutionGraph {
  const builder = new GraphBuilder(name, creator);

  const triggerId = builder.addNode({
    type: "trigger",
    label: "Start",
  });

  const outputId = builder.addNode({
    type: "output",
    label: "End",
  });

  builder.connect(triggerId, 0, outputId, 0);
  return builder.build();
}

describe("Node-based Execution Graph System", () => {
  describe("Module Exports", () => {
    test("GraphBuilder class is exported", () => {
      expect(GraphBuilder).toBeDefined();
      expect(typeof GraphBuilder).toBe("function");
    });

    test("GraphExecutor class is exported", () => {
      expect(GraphExecutor).toBeDefined();
      expect(typeof GraphExecutor).toBe("function");
    });

    test("NodeGraphManager class is exported", () => {
      expect(NodeGraphManager).toBeDefined();
      expect(typeof NodeGraphManager).toBe("function");
    });

    test("nodeGraphManager singleton is exported", () => {
      expect(nodeGraphManager).toBeDefined();
      expect(nodeGraphManager).toBeInstanceOf(NodeGraphManager);
    });

    test("registerNodeHandler function is exported", () => {
      expect(registerNodeHandler).toBeDefined();
      expect(typeof registerNodeHandler).toBe("function");
    });
  });

  // ============================================
  // GraphBuilder Tests
  // ============================================

  describe("GraphBuilder", () => {
    test("creates graph with name and creator", () => {
      const builder = new GraphBuilder("My Workflow", "user-123");
      const graph = builder.build();

      expect(graph.name).toBe("My Workflow");
      expect(graph.createdBy).toBe("user-123");
      expect(graph.id).toBeDefined();
      expect(graph.enabled).toBe(true);
      expect(graph.createdAt).toBeInstanceOf(Date);
      expect(graph.updatedAt).toBeInstanceOf(Date);
    });

    describe("addNode", () => {
      test("returns node ID", () => {
        const builder = new GraphBuilder("test", "user");
        const nodeId = builder.addNode({
          type: "trigger",
          label: "Start Trigger",
        });

        expect(typeof nodeId).toBe("string");
        expect(nodeId.length).toBeGreaterThan(0);
      });

      test("with trigger type", () => {
        const builder = new GraphBuilder("test", "user");
        const nodeId = builder.addNode({
          type: "trigger",
          label: "My Trigger",
        });

        const graph = builder.build();
        const node = graph.nodes.get(nodeId);

        expect(node).toBeDefined();
        expect(node!.type).toBe("trigger");
        expect(node!.label).toBe("My Trigger");
      });

      test("with action type", () => {
        const builder = new GraphBuilder("test", "user");
        const nodeId = builder.addNode({
          type: "action",
          label: "Run Action",
          config: { tool: "search" },
        });

        const graph = builder.build();
        const node = graph.nodes.get(nodeId);

        expect(node).toBeDefined();
        expect(node!.type).toBe("action");
        expect(node!.config.tool).toBe("search");
      });

      test("with condition type", () => {
        const builder = new GraphBuilder("test", "user");
        const nodeId = builder.addNode({
          type: "condition",
          label: "Check Value",
          config: { field: "status", operator: "equals", value: "active" },
          outputs: [{ name: "true" }, { name: "false" }],
        });

        const graph = builder.build();
        const node = graph.nodes.get(nodeId);

        expect(node).toBeDefined();
        expect(node!.type).toBe("condition");
        expect(node!.outputs.length).toBe(2);
        expect(node!.outputs[0].name).toBe("true");
        expect(node!.outputs[1].name).toBe("false");
      });

      test("creates default input and output ports", () => {
        const builder = new GraphBuilder("test", "user");
        const nodeId = builder.addNode({
          type: "action",
          label: "Default Ports",
        });

        const graph = builder.build();
        const node = graph.nodes.get(nodeId);

        expect(node!.inputs.length).toBe(1);
        expect(node!.inputs[0].name).toBe("in");
        expect(node!.inputs[0].type).toBe("input");
        expect(node!.inputs[0].connected).toBe(false);

        expect(node!.outputs.length).toBe(1);
        expect(node!.outputs[0].name).toBe("out");
        expect(node!.outputs[0].type).toBe("output");
        expect(node!.outputs[0].connected).toBe(false);
      });
    });

    describe("connect", () => {
      test("creates edge between nodes", () => {
        const builder = new GraphBuilder("test", "user");
        const triggerId = builder.addNode({
          type: "trigger",
          label: "Start",
        });
        const outputId = builder.addNode({
          type: "output",
          label: "End",
        });

        const edgeId = builder.connect(triggerId, 0, outputId, 0);
        expect(typeof edgeId).toBe("string");

        const graph = builder.build();
        expect(graph.edges.length).toBe(1);
        expect(graph.edges[0].sourceNodeId).toBe(triggerId);
        expect(graph.edges[0].targetNodeId).toBe(outputId);
      });

      test("sets ports as connected", () => {
        const builder = new GraphBuilder("test", "user");
        const triggerId = builder.addNode({
          type: "trigger",
          label: "Start",
        });
        const outputId = builder.addNode({
          type: "output",
          label: "End",
        });

        builder.connect(triggerId, 0, outputId, 0);
        const graph = builder.build();

        const triggerNode = graph.nodes.get(triggerId)!;
        const outputNode = graph.nodes.get(outputId)!;

        expect(triggerNode.outputs[0].connected).toBe(true);
        expect(outputNode.inputs[0].connected).toBe(true);
      });

      test("throws for invalid node", () => {
        const builder = new GraphBuilder("test", "user");
        const triggerId = builder.addNode({
          type: "trigger",
          label: "Start",
        });

        expect(() => {
          builder.connect(triggerId, 0, "non-existent-node", 0);
        }).toThrow("Node not found");
      });
    });

    describe("setVariable", () => {
      test("stores variable in graph", () => {
        const builder = new GraphBuilder("test", "user");
        builder.setVariable("apiKey", "abc123");
        builder.setVariable("retries", 3);

        const graph = builder.build();
        expect(graph.variables.apiKey).toBe("abc123");
        expect(graph.variables.retries).toBe(3);
      });
    });

    describe("build", () => {
      test("returns ExecutionGraph", () => {
        const builder = new GraphBuilder("built-graph", "builder-user");
        builder.addNode({ type: "trigger", label: "Start" });
        const graph = builder.build();

        expect(graph.id).toBeDefined();
        expect(graph.name).toBe("built-graph");
        expect(graph.nodes).toBeInstanceOf(Map);
        expect(Array.isArray(graph.edges)).toBe(true);
        expect(typeof graph.variables).toBe("object");
        expect(graph.createdBy).toBe("builder-user");
        expect(graph.enabled).toBe(true);
      });
    });
  });

  // ============================================
  // GraphExecutor Tests
  // ============================================

  describe("GraphExecutor", () => {
    const executor = new GraphExecutor();

    test("executes simple trigger->output graph", async () => {
      const graph = buildSimpleGraph();
      const state = await executor.execute(graph, { message: "hello" });

      expect(state.status).toBe("completed");
      expect(state.graphId).toBe(graph.id);
      expect(state.runId).toBeDefined();
      expect(state.startedAt).toBeInstanceOf(Date);
      expect(state.completedAt).toBeInstanceOf(Date);
    });

    test("executes trigger->action->output graph", async () => {
      const builder = new GraphBuilder("action-test", "user");

      const triggerId = builder.addNode({
        type: "trigger",
        label: "Start",
      });

      const transformId = builder.addNode({
        type: "transform",
        label: "Transform",
        config: { expression: "Result: {{message}}" },
      });

      const outputId = builder.addNode({
        type: "output",
        label: "End",
      });

      builder.connect(triggerId, 0, transformId, 0);
      builder.connect(transformId, 0, outputId, 0);

      const graph = builder.build();
      const state = await executor.execute(graph, { message: "world" });

      expect(state.status).toBe("completed");

      // Transform node should have run
      const transformResult = state.nodeResults.get(transformId);
      expect(transformResult).toBeDefined();
      expect(transformResult!.status).toBe("completed");
      expect(transformResult!.output.transformed).toBe("Result: world");
    });

    test("handles condition node branching (true path)", async () => {
      const builder = new GraphBuilder("condition-true-test", "user");

      const triggerId = builder.addNode({
        type: "trigger",
        label: "Start",
      });

      const conditionId = builder.addNode({
        type: "condition",
        label: "Check Status",
        config: { field: "status", operator: "equals", value: "active" },
        outputs: [{ name: "true" }, { name: "false" }],
      });

      const trueOutputId = builder.addNode({
        type: "output",
        label: "True Branch",
      });

      const falseOutputId = builder.addNode({
        type: "output",
        label: "False Branch",
      });

      builder.connect(triggerId, 0, conditionId, 0);
      builder.connect(conditionId, 0, trueOutputId, 0); // true branch
      builder.connect(conditionId, 1, falseOutputId, 0); // false branch

      const graph = builder.build();
      const state = await executor.execute(graph, { status: "active" });

      expect(state.status).toBe("completed");

      // True branch should have executed
      const trueResult = state.nodeResults.get(trueOutputId);
      expect(trueResult).toBeDefined();
      expect(trueResult!.status).toBe("completed");

      // False branch should NOT have executed
      const falseResult = state.nodeResults.get(falseOutputId);
      expect(falseResult).toBeUndefined();
    });

    test("handles condition node branching (false path)", async () => {
      const builder = new GraphBuilder("condition-false-test", "user");

      const triggerId = builder.addNode({
        type: "trigger",
        label: "Start",
      });

      const conditionId = builder.addNode({
        type: "condition",
        label: "Check Status",
        config: { field: "status", operator: "equals", value: "active" },
        outputs: [{ name: "true" }, { name: "false" }],
      });

      const trueOutputId = builder.addNode({
        type: "output",
        label: "True Branch",
      });

      const falseOutputId = builder.addNode({
        type: "output",
        label: "False Branch",
      });

      builder.connect(triggerId, 0, conditionId, 0);
      builder.connect(conditionId, 0, trueOutputId, 0); // true branch
      builder.connect(conditionId, 1, falseOutputId, 0); // false branch

      const graph = builder.build();
      const state = await executor.execute(graph, { status: "inactive" });

      expect(state.status).toBe("completed");

      // True branch should NOT have executed
      const trueResult = state.nodeResults.get(trueOutputId);
      expect(trueResult).toBeUndefined();

      // False branch should have executed
      const falseResult = state.nodeResults.get(falseOutputId);
      expect(falseResult).toBeDefined();
      expect(falseResult!.status).toBe("completed");
    });

    test("returns completed status on success", async () => {
      const graph = buildSimpleGraph();
      const state = await executor.execute(graph);

      expect(state.status).toBe("completed");
    });

    test("returns failed status on error", async () => {
      // Graph with no trigger nodes will fail
      const builder = new GraphBuilder("no-trigger", "user");
      builder.addNode({ type: "output", label: "Orphan Output" });
      const graph = builder.build();

      const state = await executor.execute(graph);

      expect(state.status).toBe("failed");
      expect(state.error).toContain("No trigger nodes found");
    });

    test("records node results", async () => {
      const builder = new GraphBuilder("results-test", "user");
      const triggerId = builder.addNode({
        type: "trigger",
        label: "Start",
      });
      const outputId = builder.addNode({
        type: "output",
        label: "End",
      });
      builder.connect(triggerId, 0, outputId, 0);
      const graph = builder.build();

      const state = await executor.execute(graph, { data: "test" });

      expect(state.nodeResults.size).toBe(2);

      const triggerResult = state.nodeResults.get(triggerId);
      expect(triggerResult).toBeDefined();
      expect(triggerResult!.nodeId).toBe(triggerId);
      expect(triggerResult!.status).toBe("completed");
      expect(triggerResult!.startedAt).toBeInstanceOf(Date);
      expect(triggerResult!.completedAt).toBeInstanceOf(Date);
      expect(typeof triggerResult!.duration).toBe("number");

      const outputResult = state.nodeResults.get(outputId);
      expect(outputResult).toBeDefined();
      expect(outputResult!.status).toBe("completed");
    });
  });

  // ============================================
  // NodeGraphManager Tests
  // ============================================

  describe("NodeGraphManager", () => {
    beforeEach(() => {
      // Clean up any leftover graphs from previous tests
      const existing = nodeGraphManager.listGraphs();
      for (const g of existing) {
        nodeGraphManager.deleteGraph(g.id);
      }
    });

    describe("createGraph", () => {
      test("returns a GraphBuilder instance", () => {
        const builder = nodeGraphManager.createGraph(
          "managed-graph",
          "manager-user"
        );
        expect(builder).toBeDefined();
        expect(builder).toBeInstanceOf(GraphBuilder);
      });
    });

    describe("saveGraph and getGraph", () => {
      test("saveGraph stores graph and getGraph retrieves by ID", () => {
        const builder = nodeGraphManager.createGraph("saved-graph", "user-1");
        builder.addNode({ type: "trigger", label: "Start" });
        const graph = builder.build();

        nodeGraphManager.saveGraph(graph);

        const retrieved = nodeGraphManager.getGraph(graph.id);
        expect(retrieved).toBeDefined();
        expect(retrieved!.id).toBe(graph.id);
        expect(retrieved!.name).toBe("saved-graph");
      });

      test("getGraph returns undefined for non-existent ID", () => {
        const result = nodeGraphManager.getGraph("non-existent-id");
        expect(result).toBeUndefined();
      });
    });

    describe("listGraphs", () => {
      test("returns all graphs", () => {
        const builder1 = nodeGraphManager.createGraph("graph-1", "user-a");
        builder1.addNode({ type: "trigger", label: "T1" });
        nodeGraphManager.saveGraph(builder1.build());

        const builder2 = nodeGraphManager.createGraph("graph-2", "user-b");
        builder2.addNode({ type: "trigger", label: "T2" });
        nodeGraphManager.saveGraph(builder2.build());

        const all = nodeGraphManager.listGraphs();
        expect(all.length).toBe(2);
      });

      test("filters by userId", () => {
        const builder1 = nodeGraphManager.createGraph("user-a-graph", "user-a");
        builder1.addNode({ type: "trigger", label: "T1" });
        nodeGraphManager.saveGraph(builder1.build());

        const builder2 = nodeGraphManager.createGraph("user-b-graph", "user-b");
        builder2.addNode({ type: "trigger", label: "T2" });
        nodeGraphManager.saveGraph(builder2.build());

        const builder3 = nodeGraphManager.createGraph(
          "user-a-graph-2",
          "user-a"
        );
        builder3.addNode({ type: "trigger", label: "T3" });
        nodeGraphManager.saveGraph(builder3.build());

        const userAGraphs = nodeGraphManager.listGraphs("user-a");
        expect(userAGraphs.length).toBe(2);
        for (const g of userAGraphs) {
          expect(g.createdBy).toBe("user-a");
        }

        const userBGraphs = nodeGraphManager.listGraphs("user-b");
        expect(userBGraphs.length).toBe(1);
        expect(userBGraphs[0].createdBy).toBe("user-b");
      });
    });

    describe("deleteGraph", () => {
      test("removes graph", () => {
        const builder = nodeGraphManager.createGraph("deletable", "user");
        builder.addNode({ type: "trigger", label: "T" });
        const graph = builder.build();
        nodeGraphManager.saveGraph(graph);

        expect(nodeGraphManager.getGraph(graph.id)).toBeDefined();

        const deleted = nodeGraphManager.deleteGraph(graph.id);
        expect(deleted).toBe(true);
        expect(nodeGraphManager.getGraph(graph.id)).toBeUndefined();
      });

      test("returns false for non-existent graph", () => {
        const deleted = nodeGraphManager.deleteGraph("does-not-exist");
        expect(deleted).toBe(false);
      });
    });

    describe("executeGraph", () => {
      test("runs and returns execution state", async () => {
        const builder = nodeGraphManager.createGraph(
          "executable-graph",
          "user"
        );
        const triggerId = builder.addNode({
          type: "trigger",
          label: "Start",
        });
        const outputId = builder.addNode({
          type: "output",
          label: "End",
        });
        builder.connect(triggerId, 0, outputId, 0);
        const graph = builder.build();
        nodeGraphManager.saveGraph(graph);

        const state = await nodeGraphManager.executeGraph(graph.id, {
          input: "test-data",
        });

        expect(state.status).toBe("completed");
        expect(state.graphId).toBe(graph.id);
        expect(state.nodeResults.size).toBe(2);
      });

      test("throws for non-existent graph", async () => {
        try {
          await nodeGraphManager.executeGraph("missing-graph-id");
          // Should not reach here
          expect(true).toBe(false);
        } catch (error) {
          expect((error as Error).message).toContain("Graph not found");
        }
      });
    });

    describe("getHistory", () => {
      test("returns execution history for a graph", async () => {
        const builder = nodeGraphManager.createGraph("history-graph", "user");
        const triggerId = builder.addNode({
          type: "trigger",
          label: "Start",
        });
        const outputId = builder.addNode({
          type: "output",
          label: "End",
        });
        builder.connect(triggerId, 0, outputId, 0);
        const graph = builder.build();
        nodeGraphManager.saveGraph(graph);

        // Execute twice
        await nodeGraphManager.executeGraph(graph.id, { run: 1 });
        await nodeGraphManager.executeGraph(graph.id, { run: 2 });

        const history = nodeGraphManager.getHistory(graph.id);
        expect(history.length).toBe(2);
        expect(history[0].graphId).toBe(graph.id);
        expect(history[1].graphId).toBe(graph.id);
      });

      test("returns empty array for graph with no history", () => {
        const history = nodeGraphManager.getHistory("no-history-graph");
        expect(Array.isArray(history)).toBe(true);
        expect(history.length).toBe(0);
      });
    });

    describe("exportGraph", () => {
      test("returns JSON string", () => {
        const builder = nodeGraphManager.createGraph("export-graph", "user");
        builder.addNode({ type: "trigger", label: "Start" });
        builder.setVariable("key", "value");
        const graph = builder.build();
        nodeGraphManager.saveGraph(graph);

        const json = nodeGraphManager.exportGraph(graph.id);
        expect(json).not.toBeNull();
        expect(typeof json).toBe("string");

        const parsed = JSON.parse(json!);
        expect(parsed.name).toBe("export-graph");
        expect(parsed.variables.key).toBe("value");
      });

      test("returns null for non-existent graph", () => {
        const json = nodeGraphManager.exportGraph("no-such-graph");
        expect(json).toBeNull();
      });
    });

    describe("importGraph", () => {
      test("creates graph from JSON", () => {
        // First create and export a graph
        const builder = nodeGraphManager.createGraph("import-source", "user-x");
        const triggerId = builder.addNode({
          type: "trigger",
          label: "Start",
        });
        const outputId = builder.addNode({
          type: "output",
          label: "End",
        });
        builder.connect(triggerId, 0, outputId, 0);
        builder.setVariable("imported", true);
        const graph = builder.build();
        nodeGraphManager.saveGraph(graph);

        const json = nodeGraphManager.exportGraph(graph.id)!;

        // Import it as a new user
        const imported = nodeGraphManager.importGraph(json, "user-y");
        expect(imported).not.toBeNull();
        expect(imported!.createdBy).toBe("user-y");
        expect(imported!.name).toBe("import-source");
        expect(imported!.variables.imported).toBe(true);
        // Should have a new ID
        expect(imported!.id).not.toBe(graph.id);

        // Should be retrievable
        const retrieved = nodeGraphManager.getGraph(imported!.id);
        expect(retrieved).toBeDefined();
      });

      test("returns null for invalid JSON", () => {
        const result = nodeGraphManager.importGraph("not valid json", "user");
        expect(result).toBeNull();
      });
    });
  });

  // ============================================
  // Built-in Node Handler Tests
  // ============================================

  describe("Built-in Node Handlers", () => {
    const executor = new GraphExecutor();

    test("trigger handler passes through data", async () => {
      const builder = new GraphBuilder("trigger-passthrough", "user");
      const triggerId = builder.addNode({
        type: "trigger",
        label: "Trigger",
      });
      const outputId = builder.addNode({
        type: "output",
        label: "Output",
      });
      builder.connect(triggerId, 0, outputId, 0);
      const graph = builder.build();

      const state = await executor.execute(graph, {
        message: "trigger-data",
        count: 42,
      });

      expect(state.status).toBe("completed");
      const triggerResult = state.nodeResults.get(triggerId);
      expect(triggerResult).toBeDefined();
      expect(triggerResult!.output.message).toBe("trigger-data");
      expect(triggerResult!.output.count).toBe(42);
    });

    test("output handler passes through data", async () => {
      const builder = new GraphBuilder("output-passthrough", "user");
      const triggerId = builder.addNode({
        type: "trigger",
        label: "Trigger",
      });
      const outputId = builder.addNode({
        type: "output",
        label: "Output",
      });
      builder.connect(triggerId, 0, outputId, 0);
      const graph = builder.build();

      const state = await executor.execute(graph, {
        result: "output-data",
      });

      expect(state.status).toBe("completed");
      const outputResult = state.nodeResults.get(outputId);
      expect(outputResult).toBeDefined();
      expect(outputResult!.output.result).toBe("output-data");
    });

    test("transform handler does template substitution", async () => {
      const builder = new GraphBuilder("transform-test", "user");
      const triggerId = builder.addNode({
        type: "trigger",
        label: "Trigger",
      });
      const transformId = builder.addNode({
        type: "transform",
        label: "Transform",
        config: {
          expression: "Hello {{name}}, you have {{count}} items!",
        },
      });
      const outputId = builder.addNode({
        type: "output",
        label: "Output",
      });

      builder.connect(triggerId, 0, transformId, 0);
      builder.connect(transformId, 0, outputId, 0);
      const graph = builder.build();

      const state = await executor.execute(graph, {
        name: "Alice",
        count: 5,
      });

      expect(state.status).toBe("completed");
      const transformResult = state.nodeResults.get(transformId);
      expect(transformResult).toBeDefined();
      expect(transformResult!.output.transformed).toBe(
        "Hello Alice, you have 5 items!"
      );
      // Original data should also be preserved
      expect(transformResult!.output.name).toBe("Alice");
      expect(transformResult!.output.count).toBe(5);
    });
  });
});
