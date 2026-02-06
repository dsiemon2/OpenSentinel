import { describe, test, expect, beforeEach } from "bun:test";
import {
  GraphBuilder,
  GraphExecutor,
  NodeGraphManager,
  nodeGraphManager,
  registerNodeHandler,
} from "../src/core/nodes/index";
import type { ExecutionGraph, GraphExecutionState } from "../src/core/nodes/index";

// ============================================
// Deep Behavioral Tests for Node Graph System
// ============================================

describe("Node Graph System — Deep Behavioral Tests", () => {
  const executor = new GraphExecutor();

  // Helper to clean up all saved graphs between tests
  beforeEach(() => {
    const existing = nodeGraphManager.listGraphs();
    for (const g of existing) {
      nodeGraphManager.deleteGraph(g.id);
    }
  });

  // 1. Linear pipeline: trigger -> transform -> transform -> output
  test("linear pipeline applies sequential transformations", async () => {
    const builder = new GraphBuilder("linear-pipeline", "user");

    const triggerId = builder.addNode({ type: "trigger", label: "Start" });
    const transform1Id = builder.addNode({
      type: "transform",
      label: "Add Prefix",
      config: { expression: "PREFIX-{{value}}" },
    });
    const transform2Id = builder.addNode({
      type: "transform",
      label: "Add Suffix",
      config: { expression: "{{transformed}}-SUFFIX" },
    });
    const outputId = builder.addNode({ type: "output", label: "End" });

    builder.connect(triggerId, 0, transform1Id, 0);
    builder.connect(transform1Id, 0, transform2Id, 0);
    builder.connect(transform2Id, 0, outputId, 0);

    const graph = builder.build();
    const state = await executor.execute(graph, { value: "DATA" });

    expect(state.status).toBe("completed");

    // First transform: expression "PREFIX-{{value}}" with input {value: "DATA"}
    const t1Result = state.nodeResults.get(transform1Id);
    expect(t1Result).toBeDefined();
    expect(t1Result!.output.transformed).toBe("PREFIX-DATA");

    // Second transform: expression "{{transformed}}-SUFFIX" with input including transformed="PREFIX-DATA"
    const t2Result = state.nodeResults.get(transform2Id);
    expect(t2Result).toBeDefined();
    expect(t2Result!.output.transformed).toBe("PREFIX-DATA-SUFFIX");

    // Output node should also have completed
    const outResult = state.nodeResults.get(outputId);
    expect(outResult).toBeDefined();
    expect(outResult!.status).toBe("completed");
  });

  // 2. Condition branching TRUE path
  test("condition node routes to true branch when condition is met (greater_than)", async () => {
    const builder = new GraphBuilder("condition-true", "user");

    const triggerId = builder.addNode({ type: "trigger", label: "Start" });
    const conditionId = builder.addNode({
      type: "condition",
      label: "Value > 10?",
      config: { field: "value", operator: "greater_than", value: 10 },
      outputs: [{ name: "true" }, { name: "false" }],
    });
    const trueOutputId = builder.addNode({ type: "output", label: "True Branch" });
    const falseOutputId = builder.addNode({ type: "output", label: "False Branch" });

    builder.connect(triggerId, 0, conditionId, 0);
    builder.connect(conditionId, 0, trueOutputId, 0);
    builder.connect(conditionId, 1, falseOutputId, 0);

    const graph = builder.build();
    const state = await executor.execute(graph, { value: 20 });

    expect(state.status).toBe("completed");

    const trueResult = state.nodeResults.get(trueOutputId);
    expect(trueResult).toBeDefined();
    expect(trueResult!.status).toBe("completed");

    const falseResult = state.nodeResults.get(falseOutputId);
    expect(falseResult).toBeUndefined();

    // Condition node output should reflect conditionMet=true
    const condResult = state.nodeResults.get(conditionId);
    expect(condResult!.output.conditionMet).toBe(true);
  });

  // 3. Condition branching FALSE path
  test("condition node routes to false branch when condition is NOT met (greater_than)", async () => {
    const builder = new GraphBuilder("condition-false", "user");

    const triggerId = builder.addNode({ type: "trigger", label: "Start" });
    const conditionId = builder.addNode({
      type: "condition",
      label: "Value > 10?",
      config: { field: "value", operator: "greater_than", value: 10 },
      outputs: [{ name: "true" }, { name: "false" }],
    });
    const trueOutputId = builder.addNode({ type: "output", label: "True Branch" });
    const falseOutputId = builder.addNode({ type: "output", label: "False Branch" });

    builder.connect(triggerId, 0, conditionId, 0);
    builder.connect(conditionId, 0, trueOutputId, 0);
    builder.connect(conditionId, 1, falseOutputId, 0);

    const graph = builder.build();
    const state = await executor.execute(graph, { value: 5 });

    expect(state.status).toBe("completed");

    const trueResult = state.nodeResults.get(trueOutputId);
    expect(trueResult).toBeUndefined();

    const falseResult = state.nodeResults.get(falseOutputId);
    expect(falseResult).toBeDefined();
    expect(falseResult!.status).toBe("completed");

    const condResult = state.nodeResults.get(conditionId);
    expect(condResult!.output.conditionMet).toBe(false);
  });

  // 4. Diamond pattern: trigger -> two parallel paths -> merge -> output
  test("diamond pattern: data flows through both parallel branches to merge and output", async () => {
    const builder = new GraphBuilder("diamond", "user");

    const triggerId = builder.addNode({ type: "trigger", label: "Start" });
    const transformAId = builder.addNode({
      type: "transform",
      label: "Branch A",
      config: { expression: "A-{{name}}" },
    });
    const transformBId = builder.addNode({
      type: "transform",
      label: "Branch B",
      config: { expression: "B-{{name}}" },
    });
    const mergeId = builder.addNode({ type: "merge", label: "Merge" });
    const outputId = builder.addNode({ type: "output", label: "End" });

    // Trigger fans out to both transforms
    builder.connect(triggerId, 0, transformAId, 0);
    builder.connect(triggerId, 0, transformBId, 0);
    // Both transforms merge
    builder.connect(transformAId, 0, mergeId, 0);
    builder.connect(transformBId, 0, mergeId, 0);
    // Merge to output
    builder.connect(mergeId, 0, outputId, 0);

    const graph = builder.build();
    const state = await executor.execute(graph, { name: "World" });

    expect(state.status).toBe("completed");

    // Both transforms should have executed
    const branchA = state.nodeResults.get(transformAId);
    expect(branchA).toBeDefined();
    expect(branchA!.status).toBe("completed");
    expect(branchA!.output.transformed).toBe("A-World");

    const branchB = state.nodeResults.get(transformBId);
    expect(branchB).toBeDefined();
    expect(branchB!.status).toBe("completed");
    expect(branchB!.output.transformed).toBe("B-World");

    // Merge and output should have completed
    expect(state.nodeResults.get(mergeId)!.status).toBe("completed");
    expect(state.nodeResults.get(outputId)!.status).toBe("completed");
  });

  // 5. Complex multi-node graph with mixed types
  test("complex graph with 6+ nodes including trigger, transform, condition, outputs", async () => {
    const builder = new GraphBuilder("complex-graph", "user");

    const triggerId = builder.addNode({ type: "trigger", label: "Entry" });
    const transform1Id = builder.addNode({
      type: "transform",
      label: "Normalize",
      config: { expression: "{{status}}-normalized" },
    });
    const conditionId = builder.addNode({
      type: "condition",
      label: "Check status",
      config: { field: "status", operator: "equals", value: "active" },
      outputs: [{ name: "true" }, { name: "false" }],
    });
    const transform2Id = builder.addNode({
      type: "transform",
      label: "Active transform",
      config: { expression: "ACTIVE:{{transformed}}" },
    });
    const outputActiveId = builder.addNode({ type: "output", label: "Active Output" });
    const outputInactiveId = builder.addNode({ type: "output", label: "Inactive Output" });

    builder.connect(triggerId, 0, transform1Id, 0);
    builder.connect(transform1Id, 0, conditionId, 0);
    builder.connect(conditionId, 0, transform2Id, 0);
    builder.connect(conditionId, 1, outputInactiveId, 0);
    builder.connect(transform2Id, 0, outputActiveId, 0);

    const graph = builder.build();
    const state = await executor.execute(graph, { status: "active" });

    expect(state.status).toBe("completed");

    // Should have executed: trigger, transform1, condition, transform2, outputActive
    expect(state.nodeResults.get(triggerId)!.status).toBe("completed");
    expect(state.nodeResults.get(transform1Id)!.status).toBe("completed");
    expect(state.nodeResults.get(conditionId)!.status).toBe("completed");
    expect(state.nodeResults.get(transform2Id)!.status).toBe("completed");
    expect(state.nodeResults.get(outputActiveId)!.status).toBe("completed");

    // Inactive output should NOT have executed
    expect(state.nodeResults.get(outputInactiveId)).toBeUndefined();
  });

  // 6. Graph with variables
  test("builder setVariable stores variables in built graph", () => {
    const builder = new GraphBuilder("vars-graph", "user");
    builder.addNode({ type: "trigger", label: "Start" });

    builder.setVariable("apiUrl", "https://api.example.com");
    builder.setVariable("retryCount", 3);
    builder.setVariable("debug", true);

    const graph = builder.build();

    expect(graph.variables.apiUrl).toBe("https://api.example.com");
    expect(graph.variables.retryCount).toBe(3);
    expect(graph.variables.debug).toBe(true);
  });

  // 7. Empty graph execution (trigger only, no connections)
  test("graph with only trigger node completes but has just one node result", async () => {
    const builder = new GraphBuilder("trigger-only", "user");
    const triggerId = builder.addNode({ type: "trigger", label: "Lone Trigger" });

    const graph = builder.build();
    const state = await executor.execute(graph, { input: "data" });

    expect(state.status).toBe("completed");
    expect(state.nodeResults.size).toBe(1);

    const triggerResult = state.nodeResults.get(triggerId);
    expect(triggerResult).toBeDefined();
    expect(triggerResult!.status).toBe("completed");
  });

  // 8. Invalid node connection throws
  test("connecting to non-existent node throws error", () => {
    const builder = new GraphBuilder("bad-connect", "user");
    const triggerId = builder.addNode({ type: "trigger", label: "Start" });

    expect(() => {
      builder.connect(triggerId, 0, "non-existent-xyz", 0);
    }).toThrow("Node not found");

    expect(() => {
      builder.connect("non-existent-abc", 0, triggerId, 0);
    }).toThrow("Node not found");
  });

  // 9. NodeGraphManager CRUD lifecycle
  test("full CRUD lifecycle: create -> save -> list -> get -> execute -> history -> delete", async () => {
    const builder = nodeGraphManager.createGraph("lifecycle-graph", "user-crud");
    const triggerId = builder.addNode({ type: "trigger", label: "Start" });
    const outputId = builder.addNode({ type: "output", label: "End" });
    builder.connect(triggerId, 0, outputId, 0);
    const graph = builder.build();

    // Save
    nodeGraphManager.saveGraph(graph);

    // List — should contain the graph
    const listed = nodeGraphManager.listGraphs();
    expect(listed.some((g) => g.id === graph.id)).toBe(true);

    // Get by ID
    const retrieved = nodeGraphManager.getGraph(graph.id);
    expect(retrieved).toBeDefined();
    expect(retrieved!.name).toBe("lifecycle-graph");

    // Execute
    const state = await nodeGraphManager.executeGraph(graph.id, { test: true });
    expect(state.status).toBe("completed");

    // History
    const history = nodeGraphManager.getHistory(graph.id);
    expect(history.length).toBe(1);
    expect(history[0].graphId).toBe(graph.id);

    // Delete
    const deleted = nodeGraphManager.deleteGraph(graph.id);
    expect(deleted).toBe(true);

    // Verify gone
    expect(nodeGraphManager.getGraph(graph.id)).toBeUndefined();
    expect(nodeGraphManager.listGraphs().some((g) => g.id === graph.id)).toBe(false);
  });

  // 10. Import/export round-trip
  test("export graph as JSON then import as different user preserves structure with new ID", () => {
    const builder = nodeGraphManager.createGraph("export-source", "user-x");
    const triggerId = builder.addNode({ type: "trigger", label: "Trigger" });
    const outputId = builder.addNode({ type: "output", label: "Output" });
    builder.connect(triggerId, 0, outputId, 0);
    builder.setVariable("key", "value");
    const graph = builder.build();
    nodeGraphManager.saveGraph(graph);

    const json = nodeGraphManager.exportGraph(graph.id);
    expect(json).not.toBeNull();

    const imported = nodeGraphManager.importGraph(json!, "user-y");
    expect(imported).not.toBeNull();
    expect(imported!.id).not.toBe(graph.id); // Different ID
    expect(imported!.createdBy).toBe("user-y");
    expect(imported!.name).toBe("export-source");
    expect(imported!.variables.key).toBe("value");
    expect(imported!.nodes.size).toBe(graph.nodes.size);
    expect(imported!.edges.length).toBe(graph.edges.length);
  });

  // 11. Multiple executions create distinct history entries
  test("executing same graph 3 times creates 3 history entries", async () => {
    const builder = nodeGraphManager.createGraph("multi-exec", "user");
    const triggerId = builder.addNode({ type: "trigger", label: "Start" });
    const outputId = builder.addNode({ type: "output", label: "End" });
    builder.connect(triggerId, 0, outputId, 0);
    const graph = builder.build();
    nodeGraphManager.saveGraph(graph);

    await nodeGraphManager.executeGraph(graph.id, { run: 1 });
    await nodeGraphManager.executeGraph(graph.id, { run: 2 });
    await nodeGraphManager.executeGraph(graph.id, { run: 3 });

    const history = nodeGraphManager.getHistory(graph.id);
    expect(history.length).toBe(3);

    // All run IDs should be unique
    const runIds = history.map((h) => h.runId);
    const uniqueRunIds = new Set(runIds);
    expect(uniqueRunIds.size).toBe(3);
  });

  // 12. Node execution timing — startedAt and duration
  test("each node result has startedAt (Date) and duration (number >= 0)", async () => {
    const builder = new GraphBuilder("timing-test", "user");
    const triggerId = builder.addNode({ type: "trigger", label: "Start" });
    const transformId = builder.addNode({
      type: "transform",
      label: "Transform",
      config: { expression: "Hello {{name}}" },
    });
    const outputId = builder.addNode({ type: "output", label: "End" });

    builder.connect(triggerId, 0, transformId, 0);
    builder.connect(transformId, 0, outputId, 0);

    const graph = builder.build();
    const state = await executor.execute(graph, { name: "Test" });

    expect(state.status).toBe("completed");

    for (const [, nodeResult] of state.nodeResults) {
      expect(nodeResult.startedAt).toBeInstanceOf(Date);
      expect(typeof nodeResult.duration).toBe("number");
      expect(nodeResult.duration!).toBeGreaterThanOrEqual(0);
    }
  });

  // 13. Transform with template variable substitution
  test("transform node substitutes template variables correctly", async () => {
    const builder = new GraphBuilder("template-test", "user");
    const triggerId = builder.addNode({ type: "trigger", label: "Start" });
    const transformId = builder.addNode({
      type: "transform",
      label: "Greet",
      config: { expression: "Hello {{name}}! You are {{age}} years old." },
    });
    const outputId = builder.addNode({ type: "output", label: "End" });

    builder.connect(triggerId, 0, transformId, 0);
    builder.connect(transformId, 0, outputId, 0);

    const graph = builder.build();
    const state = await executor.execute(graph, { name: "World", age: 25 });

    const transformResult = state.nodeResults.get(transformId);
    expect(transformResult).toBeDefined();
    expect(transformResult!.output.transformed).toBe("Hello World! You are 25 years old.");
  });

  // 14. Graph builder port tracking — ports marked connected
  test("after connecting nodes, source output and target input ports are marked connected", () => {
    const builder = new GraphBuilder("port-tracking", "user");

    const nodeA = builder.addNode({
      type: "trigger",
      label: "A",
      outputs: [{ name: "out1" }, { name: "out2" }],
    });
    const nodeB = builder.addNode({ type: "output", label: "B" });
    const nodeC = builder.addNode({ type: "output", label: "C" });

    builder.connect(nodeA, 0, nodeB, 0);
    builder.connect(nodeA, 1, nodeC, 0);

    const graph = builder.build();

    const aNode = graph.nodes.get(nodeA)!;
    expect(aNode.outputs[0].connected).toBe(true);
    expect(aNode.outputs[1].connected).toBe(true);

    const bNode = graph.nodes.get(nodeB)!;
    expect(bNode.inputs[0].connected).toBe(true);

    const cNode = graph.nodes.get(nodeC)!;
    expect(cNode.inputs[0].connected).toBe(true);
  });

  // 15. Large graph — 10+ node chain
  test("large graph with 12 nodes in a chain executes all nodes", async () => {
    const builder = new GraphBuilder("large-chain", "user");

    const nodeIds: string[] = [];

    // Create trigger
    const triggerId = builder.addNode({ type: "trigger", label: "Start" });
    nodeIds.push(triggerId);

    // Create 10 transform nodes in a chain
    for (let i = 0; i < 10; i++) {
      const transformId = builder.addNode({
        type: "transform",
        label: `Transform-${i}`,
        config: { expression: `step-${i}-{{name}}` },
      });
      nodeIds.push(transformId);
    }

    // Create output
    const outputId = builder.addNode({ type: "output", label: "End" });
    nodeIds.push(outputId);

    // Chain all nodes sequentially
    for (let i = 0; i < nodeIds.length - 1; i++) {
      builder.connect(nodeIds[i], 0, nodeIds[i + 1], 0);
    }

    const graph = builder.build();
    const state = await executor.execute(graph, { name: "Test" });

    expect(state.status).toBe("completed");
    expect(state.nodeResults.size).toBe(12); // trigger + 10 transforms + output

    for (const nodeId of nodeIds) {
      const result = state.nodeResults.get(nodeId);
      expect(result).toBeDefined();
      expect(result!.status).toBe("completed");
    }
  });

  // Additional: Graph without trigger nodes fails
  test("graph with no trigger nodes fails with descriptive error", async () => {
    const builder = new GraphBuilder("no-triggers", "user");
    builder.addNode({ type: "output", label: "Orphan" });
    builder.addNode({ type: "transform", label: "Also Orphan" });

    const graph = builder.build();
    const state = await executor.execute(graph);

    expect(state.status).toBe("failed");
    expect(state.error).toContain("No trigger nodes found");
  });

  // Additional: Condition with equals operator
  test("condition node with equals operator matches exact string value", async () => {
    const builder = new GraphBuilder("equals-test", "user");
    const triggerId = builder.addNode({ type: "trigger", label: "Start" });
    const conditionId = builder.addNode({
      type: "condition",
      label: "Check role",
      config: { field: "role", operator: "equals", value: "admin" },
      outputs: [{ name: "true" }, { name: "false" }],
    });
    const trueOut = builder.addNode({ type: "output", label: "Admin" });
    const falseOut = builder.addNode({ type: "output", label: "NotAdmin" });

    builder.connect(triggerId, 0, conditionId, 0);
    builder.connect(conditionId, 0, trueOut, 0);
    builder.connect(conditionId, 1, falseOut, 0);

    const graph = builder.build();
    const state = await executor.execute(graph, { role: "admin" });

    expect(state.nodeResults.get(trueOut)).toBeDefined();
    expect(state.nodeResults.get(falseOut)).toBeUndefined();
  });

  // Additional: Condition with contains operator
  test("condition node with contains operator matches substring", async () => {
    const builder = new GraphBuilder("contains-test", "user");
    const triggerId = builder.addNode({ type: "trigger", label: "Start" });
    const conditionId = builder.addNode({
      type: "condition",
      label: "Check message",
      config: { field: "message", operator: "contains", value: "urgent" },
      outputs: [{ name: "true" }, { name: "false" }],
    });
    const trueOut = builder.addNode({ type: "output", label: "Urgent" });
    const falseOut = builder.addNode({ type: "output", label: "Normal" });

    builder.connect(triggerId, 0, conditionId, 0);
    builder.connect(conditionId, 0, trueOut, 0);
    builder.connect(conditionId, 1, falseOut, 0);

    const graph = builder.build();
    const state = await executor.execute(graph, { message: "This is urgent please help" });

    expect(state.nodeResults.get(trueOut)).toBeDefined();
    expect(state.nodeResults.get(falseOut)).toBeUndefined();
  });

  // Additional: Variables from graph are available to node handlers
  test("graph variables are accessible during execution alongside trigger data", async () => {
    const builder = new GraphBuilder("vars-exec", "user");
    const triggerId = builder.addNode({ type: "trigger", label: "Start" });
    const transformId = builder.addNode({
      type: "transform",
      label: "Use Var",
      config: { expression: "{{greeting}} {{name}}!" },
    });
    const outputId = builder.addNode({ type: "output", label: "End" });

    builder.connect(triggerId, 0, transformId, 0);
    builder.connect(transformId, 0, outputId, 0);
    builder.setVariable("greeting", "Hi");

    const graph = builder.build();
    const state = await executor.execute(graph, { name: "Alice" });

    expect(state.status).toBe("completed");
    const transformResult = state.nodeResults.get(transformId);
    expect(transformResult!.output.transformed).toBe("Hi Alice!");
  });

  // Additional: Export returns null for non-existent graph
  test("exportGraph returns null for non-existent graph ID", () => {
    const result = nodeGraphManager.exportGraph("no-such-id");
    expect(result).toBeNull();
  });

  // Additional: Import returns null for invalid JSON
  test("importGraph returns null for invalid JSON", () => {
    const result = nodeGraphManager.importGraph("definitely not json {{{", "user");
    expect(result).toBeNull();
  });

  // Additional: Connect with invalid port index throws
  test("connecting with invalid port index throws port not found error", () => {
    const builder = new GraphBuilder("bad-port", "user");
    const nodeA = builder.addNode({ type: "trigger", label: "A" });
    const nodeB = builder.addNode({ type: "output", label: "B" });

    // Node A has default 1 output (index 0), so index 5 should fail
    expect(() => {
      builder.connect(nodeA, 5, nodeB, 0);
    }).toThrow("Port not found");
  });
});
