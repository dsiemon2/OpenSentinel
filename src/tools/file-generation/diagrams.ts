import { join } from "path";
import { tmpdir } from "os";
import { randomBytes } from "crypto";
import { writeFile, mkdir } from "fs/promises";
import { dirname } from "path";
import { isPathAllowed } from "../../utils/paths";

export type DiagramType =
  | "flowchart"
  | "sequence"
  | "class"
  | "state"
  | "er"
  | "gantt"
  | "mindmap";

export interface DiagramResult {
  success: boolean;
  filePath?: string;
  mermaidCode?: string;
  error?: string;
}

// Generate temp file path
function getTempPath(): string {
  const id = randomBytes(8).toString("hex");
  return join(tmpdir(), `sentinel-diagram-${id}.md`);
}

// Flowchart helpers
export interface FlowchartNode {
  id: string;
  label: string;
  shape?: "box" | "round" | "diamond" | "circle" | "stadium";
}

export interface FlowchartEdge {
  from: string;
  to: string;
  label?: string;
  style?: "solid" | "dotted" | "thick";
}

// Generate flowchart
export function generateFlowchartCode(
  nodes: FlowchartNode[],
  edges: FlowchartEdge[],
  direction: "TB" | "BT" | "LR" | "RL" = "TB"
): string {
  let code = `flowchart ${direction}\n`;

  // Add nodes with shapes
  for (const node of nodes) {
    let shape: string;
    switch (node.shape) {
      case "round":
        shape = `(${node.label})`;
        break;
      case "diamond":
        shape = `{${node.label}}`;
        break;
      case "circle":
        shape = `((${node.label}))`;
        break;
      case "stadium":
        shape = `([${node.label}])`;
        break;
      default:
        shape = `[${node.label}]`;
    }
    code += `    ${node.id}${shape}\n`;
  }

  // Add edges
  for (const edge of edges) {
    let arrow: string;
    switch (edge.style) {
      case "dotted":
        arrow = edge.label ? `-. ${edge.label} .->` : "-.->";
        break;
      case "thick":
        arrow = edge.label ? `== ${edge.label} ==>` : "==>";
        break;
      default:
        arrow = edge.label ? `-- ${edge.label} -->` : "-->";
    }
    code += `    ${edge.from} ${arrow} ${edge.to}\n`;
  }

  return code;
}

// Sequence diagram helpers
export interface SequenceMessage {
  from: string;
  to: string;
  message: string;
  type?: "solid" | "dotted" | "async";
}

export function generateSequenceCode(
  participants: string[],
  messages: SequenceMessage[],
  title?: string
): string {
  let code = "sequenceDiagram\n";

  if (title) {
    code += `    title ${title}\n`;
  }

  // Add participants
  for (const participant of participants) {
    code += `    participant ${participant}\n`;
  }

  // Add messages
  for (const msg of messages) {
    let arrow: string;
    switch (msg.type) {
      case "dotted":
        arrow = "-->>";
        break;
      case "async":
        arrow = "--)";
        break;
      default:
        arrow = "->>";
    }
    code += `    ${msg.from}${arrow}${msg.to}: ${msg.message}\n`;
  }

  return code;
}

// Class diagram helpers
export interface ClassDefinition {
  name: string;
  attributes?: string[];
  methods?: string[];
}

export interface ClassRelation {
  from: string;
  to: string;
  type: "inheritance" | "composition" | "aggregation" | "association" | "dependency";
  label?: string;
}

export function generateClassCode(
  classes: ClassDefinition[],
  relations: ClassRelation[]
): string {
  let code = "classDiagram\n";

  // Add classes
  for (const cls of classes) {
    code += `    class ${cls.name} {\n`;
    if (cls.attributes) {
      for (const attr of cls.attributes) {
        code += `        ${attr}\n`;
      }
    }
    if (cls.methods) {
      for (const method of cls.methods) {
        code += `        ${method}\n`;
      }
    }
    code += `    }\n`;
  }

  // Add relations
  for (const rel of relations) {
    let arrow: string;
    switch (rel.type) {
      case "inheritance":
        arrow = "<|--";
        break;
      case "composition":
        arrow = "*--";
        break;
      case "aggregation":
        arrow = "o--";
        break;
      case "dependency":
        arrow = "<..";
        break;
      default:
        arrow = "--";
    }
    const label = rel.label ? ` : ${rel.label}` : "";
    code += `    ${rel.from} ${arrow} ${rel.to}${label}\n`;
  }

  return code;
}

// State diagram helpers
export interface StateTransition {
  from: string;
  to: string;
  trigger?: string;
}

export function generateStateCode(
  states: string[],
  transitions: StateTransition[],
  initialState?: string,
  finalStates?: string[]
): string {
  let code = "stateDiagram-v2\n";

  // Initial state
  if (initialState) {
    code += `    [*] --> ${initialState}\n`;
  }

  // State definitions (optional, for complex states)
  for (const state of states) {
    if (!state.includes(":")) {
      code += `    ${state}\n`;
    } else {
      const [name, description] = state.split(":");
      code += `    ${name} : ${description.trim()}\n`;
    }
  }

  // Transitions
  for (const trans of transitions) {
    const label = trans.trigger ? ` : ${trans.trigger}` : "";
    code += `    ${trans.from} --> ${trans.to}${label}\n`;
  }

  // Final states
  if (finalStates) {
    for (const finalState of finalStates) {
      code += `    ${finalState} --> [*]\n`;
    }
  }

  return code;
}

// ER diagram helpers
export interface EREntity {
  name: string;
  attributes: Array<{
    name: string;
    type: string;
    key?: "PK" | "FK";
  }>;
}

export interface ERRelation {
  from: string;
  to: string;
  fromCardinality: "one" | "zero-or-one" | "zero-or-more" | "one-or-more";
  toCardinality: "one" | "zero-or-one" | "zero-or-more" | "one-or-more";
  label?: string;
}

export function generateERCode(
  entities: EREntity[],
  relations: ERRelation[]
): string {
  let code = "erDiagram\n";

  // Add entities
  for (const entity of entities) {
    code += `    ${entity.name} {\n`;
    for (const attr of entity.attributes) {
      const keyStr = attr.key ? ` ${attr.key}` : "";
      code += `        ${attr.type} ${attr.name}${keyStr}\n`;
    }
    code += `    }\n`;
  }

  // Add relations
  for (const rel of relations) {
    const fromCard = cardinalitySymbol(rel.fromCardinality);
    const toCard = cardinalitySymbol(rel.toCardinality);
    const label = rel.label ? ` : "${rel.label}"` : "";
    code += `    ${rel.from} ${fromCard}--${toCard} ${rel.to}${label}\n`;
  }

  return code;
}

function cardinalitySymbol(cardinality: string): string {
  switch (cardinality) {
    case "one":
      return "||";
    case "zero-or-one":
      return "|o";
    case "zero-or-more":
      return "}o";
    case "one-or-more":
      return "}|";
    default:
      return "||";
  }
}

// Gantt chart helpers
export interface GanttTask {
  name: string;
  start: string; // date string or "after taskId"
  duration: string; // e.g., "5d", "1w"
  section?: string;
  status?: "done" | "active" | "crit";
}

export function generateGanttCode(
  title: string,
  tasks: GanttTask[],
  dateFormat: string = "YYYY-MM-DD"
): string {
  let code = "gantt\n";
  code += `    title ${title}\n`;
  code += `    dateFormat ${dateFormat}\n`;

  let currentSection = "";

  for (const task of tasks) {
    if (task.section && task.section !== currentSection) {
      code += `    section ${task.section}\n`;
      currentSection = task.section;
    }

    const status = task.status ? `${task.status}, ` : "";
    code += `    ${task.name} :${status}${task.start}, ${task.duration}\n`;
  }

  return code;
}

// Mindmap helpers
export interface MindmapNode {
  text: string;
  children?: MindmapNode[];
}

export function generateMindmapCode(root: MindmapNode): string {
  let code = "mindmap\n";
  code += `    root((${root.text}))\n`;

  function addChildren(node: MindmapNode, depth: number): void {
    if (!node.children) return;
    const indent = "    ".repeat(depth);
    for (const child of node.children) {
      code += `${indent}${child.text}\n`;
      addChildren(child, depth + 1);
    }
  }

  addChildren(root, 2);
  return code;
}

// Main function: generate diagram from Mermaid code
export async function generateDiagram(
  mermaidCode: string,
  filename?: string
): Promise<DiagramResult> {
  const filePath = filename
    ? isPathAllowed(filename)
      ? filename
      : join(tmpdir(), filename)
    : getTempPath();

  try {
    await mkdir(dirname(filePath), { recursive: true });

    // Wrap in markdown code block
    const content = `# Diagram\n\n\`\`\`mermaid\n${mermaidCode}\n\`\`\`\n`;

    await writeFile(filePath, content, "utf-8");

    return {
      success: true,
      filePath,
      mermaidCode,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// Generate diagram from structured input
export async function generateStructuredDiagram(
  type: DiagramType,
  data: unknown,
  filename?: string
): Promise<DiagramResult> {
  let mermaidCode: string;

  try {
    switch (type) {
      case "flowchart": {
        const { nodes, edges, direction } = data as {
          nodes: FlowchartNode[];
          edges: FlowchartEdge[];
          direction?: "TB" | "BT" | "LR" | "RL";
        };
        mermaidCode = generateFlowchartCode(nodes, edges, direction);
        break;
      }
      case "sequence": {
        const { participants, messages, title } = data as {
          participants: string[];
          messages: SequenceMessage[];
          title?: string;
        };
        mermaidCode = generateSequenceCode(participants, messages, title);
        break;
      }
      case "class": {
        const { classes, relations } = data as {
          classes: ClassDefinition[];
          relations: ClassRelation[];
        };
        mermaidCode = generateClassCode(classes, relations);
        break;
      }
      case "state": {
        const { states, transitions, initialState, finalStates } = data as {
          states: string[];
          transitions: StateTransition[];
          initialState?: string;
          finalStates?: string[];
        };
        mermaidCode = generateStateCode(states, transitions, initialState, finalStates);
        break;
      }
      case "er": {
        const { entities, relations } = data as {
          entities: EREntity[];
          relations: ERRelation[];
        };
        mermaidCode = generateERCode(entities, relations);
        break;
      }
      case "gantt": {
        const { title, tasks, dateFormat } = data as {
          title: string;
          tasks: GanttTask[];
          dateFormat?: string;
        };
        mermaidCode = generateGanttCode(title, tasks, dateFormat);
        break;
      }
      case "mindmap": {
        const { root } = data as { root: MindmapNode };
        mermaidCode = generateMindmapCode(root);
        break;
      }
      default:
        return { success: false, error: `Unsupported diagram type: ${type}` };
    }

    return generateDiagram(mermaidCode, filename);
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export default {
  generateDiagram,
  generateStructuredDiagram,
  generateFlowchartCode,
  generateSequenceCode,
  generateClassCode,
  generateStateCode,
  generateERCode,
  generateGanttCode,
  generateMindmapCode,
};
