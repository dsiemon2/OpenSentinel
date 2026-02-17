/**
 * Tree-of-Thought (ToT) Reasoning Engine
 *
 * Implements branching exploration of reasoning paths for complex problems.
 * Instead of a single chain-of-thought, ToT generates multiple candidate
 * thoughts at each step, evaluates them, prunes weak branches, and
 * expands the most promising ones — like BFS/DFS over a reasoning tree.
 *
 * Reference: Yao et al. "Tree of Thoughts: Deliberate Problem Solving
 * with Large Language Models" (2023)
 */

import Anthropic from "@anthropic-ai/sdk";
import { env } from "../../../config/env";

// ─── Types ──────────────────────────────────────────────────────────

export interface ToTConfig {
  /** Max depth of the reasoning tree */
  maxDepth?: number;
  /** Number of candidate thoughts to generate per node */
  branchingFactor?: number;
  /** Min score (0-10) to keep a branch alive */
  pruneThreshold?: number;
  /** Max total nodes to explore (cost guard) */
  maxNodes?: number;
  /** Strategy: BFS explores breadth-first, DFS dives deep first */
  strategy?: "bfs" | "dfs";
  /** Model to use */
  model?: string;
}

export interface ThoughtNode {
  id: string;
  parentId: string | null;
  depth: number;
  thought: string;
  score: number;
  evaluation: string;
  children: string[];
  isTerminal: boolean;
  isSolution: boolean;
}

export interface ToTResult {
  success: boolean;
  /** The best solution path (root → leaf) */
  bestPath: ThoughtNode[];
  /** Score of the best solution */
  bestScore: number;
  /** All explored nodes (for inspection/debugging) */
  allNodes: ThoughtNode[];
  /** Total LLM calls made */
  llmCalls: number;
  /** Total tokens used (approximate) */
  tokensUsed: number;
  error?: string;
}

// ─── Defaults ───────────────────────────────────────────────────────

const DEFAULTS: Required<ToTConfig> = {
  maxDepth: 4,
  branchingFactor: 3,
  pruneThreshold: 4,
  maxNodes: 30,
  strategy: "bfs",
  model: "claude-sonnet-4-5-20250929",
};

// ─── Implementation ─────────────────────────────────────────────────

let nodeCounter = 0;
function nextId(): string {
  return `tot-${++nodeCounter}-${Date.now().toString(36)}`;
}

async function llmCall(
  client: Anthropic,
  model: string,
  systemPrompt: string,
  userPrompt: string,
  maxTokens: number = 1024
): Promise<{ text: string; tokens: number }> {
  const response = await client.messages.create({
    model,
    max_tokens: maxTokens,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  });
  const text = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
  const tokens = (response.usage?.input_tokens || 0) + (response.usage?.output_tokens || 0);
  return { text, tokens };
}

/**
 * Generate candidate thoughts (branches) from the current state.
 */
async function generateThoughts(
  client: Anthropic,
  model: string,
  problem: string,
  pathSoFar: string[],
  count: number
): Promise<{ thoughts: string[]; tokens: number }> {
  const context = pathSoFar.length > 0
    ? `\nReasoning so far:\n${pathSoFar.map((t, i) => `Step ${i + 1}: ${t}`).join("\n")}`
    : "";

  const { text, tokens } = await llmCall(
    client,
    model,
    `You are a systematic problem solver. Generate exactly ${count} distinct next-step thoughts for solving the problem. Each thought should explore a DIFFERENT approach or angle. Return each thought on its own line, prefixed with "THOUGHT:" — nothing else.`,
    `Problem: ${problem}${context}\n\nGenerate ${count} candidate next thoughts:`,
    1500
  );

  const thoughts = text
    .split("\n")
    .map((line) => line.replace(/^THOUGHT:\s*/i, "").trim())
    .filter((line) => line.length > 10)
    .slice(0, count);

  // Ensure we always return at least one thought
  if (thoughts.length === 0) {
    thoughts.push(text.trim().slice(0, 500) || "Continue reasoning about the problem.");
  }

  return { thoughts, tokens };
}

/**
 * Evaluate a thought's quality and whether it leads toward a solution.
 */
async function evaluateThought(
  client: Anthropic,
  model: string,
  problem: string,
  pathSoFar: string[],
  thought: string
): Promise<{ score: number; evaluation: string; isSolution: boolean; tokens: number }> {
  const context = pathSoFar.length > 0
    ? `\nPrevious steps:\n${pathSoFar.map((t, i) => `Step ${i + 1}: ${t}`).join("\n")}`
    : "";

  const { text, tokens } = await llmCall(
    client,
    model,
    `You evaluate reasoning steps. Given a problem and a candidate thought, score it 0-10 and determine if it reaches a complete solution.

Respond in exactly this format:
SCORE: <number 0-10>
IS_SOLUTION: <yes|no>
EVALUATION: <brief explanation>`,
    `Problem: ${problem}${context}\n\nCandidate thought: ${thought}\n\nEvaluate:`,
    400
  );

  const scoreMatch = text.match(/SCORE:\s*(\d+\.?\d*)/i);
  const solutionMatch = text.match(/IS_SOLUTION:\s*(yes|no)/i);
  const evalMatch = text.match(/EVALUATION:\s*(.+)/is);

  return {
    score: scoreMatch ? Math.min(10, parseFloat(scoreMatch[1])) : 5,
    isSolution: solutionMatch ? solutionMatch[1].toLowerCase() === "yes" : false,
    evaluation: evalMatch ? evalMatch[1].trim().slice(0, 200) : "No evaluation available.",
    tokens,
  };
}

/**
 * Extract the path from root to a given node.
 */
function extractPath(nodeId: string, nodeMap: Map<string, ThoughtNode>): ThoughtNode[] {
  const path: ThoughtNode[] = [];
  let current = nodeMap.get(nodeId);
  while (current) {
    path.unshift(current);
    current = current.parentId ? nodeMap.get(current.parentId) : undefined;
  }
  return path;
}

/**
 * Run Tree-of-Thought reasoning on a problem.
 */
export async function treeOfThought(
  problem: string,
  config: ToTConfig = {}
): Promise<ToTResult> {
  const cfg = { ...DEFAULTS, ...config };
  nodeCounter = 0;

  const client = new Anthropic({ apiKey: env.CLAUDE_API_KEY });
  const nodeMap = new Map<string, ThoughtNode>();
  let totalTokens = 0;
  let llmCalls = 0;

  // Initialize root
  const rootId = nextId();
  const root: ThoughtNode = {
    id: rootId,
    parentId: null,
    depth: 0,
    thought: problem,
    score: 10,
    evaluation: "Root problem statement",
    children: [],
    isTerminal: false,
    isSolution: false,
  };
  nodeMap.set(rootId, root);

  // Frontier: nodes to expand
  const frontier: string[] = [rootId];
  let bestSolutionId: string | null = null;
  let bestScore = -1;

  while (frontier.length > 0 && nodeMap.size < cfg.maxNodes) {
    // Pick next node based on strategy
    const currentId = cfg.strategy === "bfs" ? frontier.shift()! : frontier.pop()!;
    const current = nodeMap.get(currentId)!;

    // Skip if at max depth or already terminal
    if (current.depth >= cfg.maxDepth || current.isTerminal) continue;

    // Build path-so-far for context
    const pathNodes = extractPath(currentId, nodeMap);
    const pathSoFar = pathNodes.slice(1).map((n) => n.thought); // skip root

    // Generate candidate thoughts
    const { thoughts, tokens: genTokens } = await generateThoughts(
      client,
      cfg.model,
      problem,
      pathSoFar,
      cfg.branchingFactor
    );
    totalTokens += genTokens;
    llmCalls++;

    // Evaluate each candidate
    for (const thought of thoughts) {
      if (nodeMap.size >= cfg.maxNodes) break;

      const { score, evaluation, isSolution, tokens: evalTokens } = await evaluateThought(
        client,
        cfg.model,
        problem,
        pathSoFar,
        thought
      );
      totalTokens += evalTokens;
      llmCalls++;

      const childId = nextId();
      const child: ThoughtNode = {
        id: childId,
        parentId: currentId,
        depth: current.depth + 1,
        thought,
        score,
        evaluation,
        children: [],
        isTerminal: isSolution || score < cfg.pruneThreshold,
        isSolution,
      };

      nodeMap.set(childId, child);
      current.children.push(childId);

      // Track best solution
      if (isSolution && score > bestScore) {
        bestScore = score;
        bestSolutionId = childId;
      }

      // Add to frontier if not pruned and not terminal
      if (!child.isTerminal) {
        // Insert sorted by score (highest first for BFS priority)
        const insertIndex = frontier.findIndex((fId) => {
          const fNode = nodeMap.get(fId);
          return fNode && fNode.score < score;
        });
        if (insertIndex === -1) {
          frontier.push(childId);
        } else {
          frontier.splice(insertIndex, 0, childId);
        }
      }
    }
  }

  // If no explicit solution found, pick the highest-scoring leaf
  if (!bestSolutionId) {
    let highestLeafScore = -1;
    for (const [id, node] of nodeMap) {
      if (node.children.length === 0 && node.depth > 0 && node.score > highestLeafScore) {
        highestLeafScore = node.score;
        bestSolutionId = id;
        bestScore = node.score;
      }
    }
  }

  const bestPath = bestSolutionId ? extractPath(bestSolutionId, nodeMap) : [root];

  return {
    success: bestScore > 0,
    bestPath,
    bestScore,
    allNodes: Array.from(nodeMap.values()),
    llmCalls,
    tokensUsed: totalTokens,
  };
}

/**
 * Format a ToT result into a readable summary.
 */
export function formatToTResult(result: ToTResult): string {
  if (!result.success) {
    return `Tree-of-Thought failed: ${result.error || "no solution found"}`;
  }

  const lines: string[] = [
    `## Solution (score: ${result.bestScore.toFixed(1)}/10)`,
    "",
  ];

  for (let i = 1; i < result.bestPath.length; i++) {
    const node = result.bestPath[i];
    lines.push(`**Step ${i}** (${node.score.toFixed(1)}/10): ${node.thought}`);
  }

  lines.push("");
  lines.push(`*Explored ${result.allNodes.length} nodes in ${result.llmCalls} LLM calls (~${result.tokensUsed} tokens)*`);

  return lines.join("\n");
}

export default { treeOfThought, formatToTResult };
