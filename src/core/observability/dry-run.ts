/**
 * Dry Run - Tool preview without executing
 *
 * Simulates tool execution to preview what would happen without
 * actually performing any actions. Useful for testing, debugging,
 * and understanding tool behavior.
 */

import type { Tool } from "@anthropic-ai/sdk/resources/messages";
import { TOOLS } from "../../tools";

// Types
export interface DryRunResult {
  toolName: string;
  input: Record<string, unknown>;
  preview: ToolPreview;
  validation: ValidationResult;
  risks: RiskAssessment[];
  estimatedDuration: number;
  wouldRequireConfirmation: boolean;
  reversible: boolean;
  timestamp: Date;
}

export interface ToolPreview {
  description: string;
  expectedOutcome: string;
  sideEffects: string[];
  affectedResources: AffectedResource[];
  dependencies: string[];
  mockOutput?: unknown;
}

export interface AffectedResource {
  type: "file" | "directory" | "process" | "network" | "database" | "memory" | "external_service";
  path?: string;
  operation: "read" | "write" | "delete" | "create" | "modify" | "execute";
  description: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  field: string;
  message: string;
  value?: unknown;
}

export interface ValidationWarning {
  field: string;
  message: string;
  suggestion?: string;
}

export interface RiskAssessment {
  level: "low" | "medium" | "high" | "critical";
  category: "security" | "data_loss" | "system_impact" | "privacy" | "cost" | "performance";
  description: string;
  mitigation?: string;
}

// Tool risk profiles
const TOOL_RISK_PROFILES: Record<string, {
  baseRisk: RiskAssessment["level"];
  categories: RiskAssessment["category"][];
  reversible: boolean;
  requiresConfirmation: boolean;
  estimatedDurationMs: number;
}> = {
  execute_command: {
    baseRisk: "high",
    categories: ["security", "system_impact", "data_loss"],
    reversible: false,
    requiresConfirmation: true,
    estimatedDurationMs: 5000,
  },
  write_file: {
    baseRisk: "medium",
    categories: ["data_loss"],
    reversible: false,
    requiresConfirmation: false,
    estimatedDurationMs: 100,
  },
  read_file: {
    baseRisk: "low",
    categories: ["privacy"],
    reversible: true,
    requiresConfirmation: false,
    estimatedDurationMs: 50,
  },
  list_directory: {
    baseRisk: "low",
    categories: [],
    reversible: true,
    requiresConfirmation: false,
    estimatedDurationMs: 50,
  },
  search_files: {
    baseRisk: "low",
    categories: [],
    reversible: true,
    requiresConfirmation: false,
    estimatedDurationMs: 500,
  },
  web_search: {
    baseRisk: "low",
    categories: ["cost"],
    reversible: true,
    requiresConfirmation: false,
    estimatedDurationMs: 2000,
  },
  browse_url: {
    baseRisk: "low",
    categories: ["privacy", "security"],
    reversible: true,
    requiresConfirmation: false,
    estimatedDurationMs: 3000,
  },
  take_screenshot: {
    baseRisk: "medium",
    categories: ["privacy"],
    reversible: true,
    requiresConfirmation: false,
    estimatedDurationMs: 500,
  },
  analyze_image: {
    baseRisk: "low",
    categories: ["cost"],
    reversible: true,
    requiresConfirmation: false,
    estimatedDurationMs: 2000,
  },
  ocr_document: {
    baseRisk: "low",
    categories: ["privacy"],
    reversible: true,
    requiresConfirmation: false,
    estimatedDurationMs: 3000,
  },
  extract_document_data: {
    baseRisk: "low",
    categories: ["privacy"],
    reversible: true,
    requiresConfirmation: false,
    estimatedDurationMs: 3000,
  },
  screenshot_analyze: {
    baseRisk: "medium",
    categories: ["privacy"],
    reversible: true,
    requiresConfirmation: false,
    estimatedDurationMs: 3000,
  },
  generate_pdf: {
    baseRisk: "low",
    categories: [],
    reversible: false,
    requiresConfirmation: false,
    estimatedDurationMs: 1000,
  },
  generate_spreadsheet: {
    baseRisk: "low",
    categories: [],
    reversible: false,
    requiresConfirmation: false,
    estimatedDurationMs: 500,
  },
  generate_chart: {
    baseRisk: "low",
    categories: [],
    reversible: false,
    requiresConfirmation: false,
    estimatedDurationMs: 500,
  },
  generate_diagram: {
    baseRisk: "low",
    categories: [],
    reversible: false,
    requiresConfirmation: false,
    estimatedDurationMs: 500,
  },
  spawn_agent: {
    baseRisk: "medium",
    categories: ["cost", "system_impact"],
    reversible: false,
    requiresConfirmation: true,
    estimatedDurationMs: 60000,
  },
  check_agent: {
    baseRisk: "low",
    categories: [],
    reversible: true,
    requiresConfirmation: false,
    estimatedDurationMs: 100,
  },
  cancel_agent: {
    baseRisk: "low",
    categories: [],
    reversible: false,
    requiresConfirmation: false,
    estimatedDurationMs: 100,
  },
  render_math: {
    baseRisk: "low",
    categories: [],
    reversible: true,
    requiresConfirmation: false,
    estimatedDurationMs: 200,
  },
  render_math_document: {
    baseRisk: "low",
    categories: [],
    reversible: true,
    requiresConfirmation: false,
    estimatedDurationMs: 500,
  },
  render_code: {
    baseRisk: "low",
    categories: [],
    reversible: true,
    requiresConfirmation: false,
    estimatedDurationMs: 100,
  },
  render_markdown: {
    baseRisk: "low",
    categories: [],
    reversible: true,
    requiresConfirmation: false,
    estimatedDurationMs: 100,
  },
};

// Dangerous command patterns
const DANGEROUS_COMMAND_PATTERNS = [
  { pattern: /rm\s+-rf?\s+[/~]/, description: "Recursive deletion of important directories" },
  { pattern: /rm\s+.*\*/, description: "Wildcard deletion" },
  { pattern: /mkfs/, description: "Filesystem formatting" },
  { pattern: /dd\s+.*of=\/dev/, description: "Direct disk write" },
  { pattern: /:\(\)\{.*\}/, description: "Fork bomb" },
  { pattern: /chmod\s+-R\s+777/, description: "Overly permissive permissions" },
  { pattern: /curl.*\|\s*(bash|sh)/, description: "Remote script execution" },
  { pattern: /wget.*\|\s*(bash|sh)/, description: "Remote script execution" },
  { pattern: /eval\s+/, description: "Dynamic code execution" },
  { pattern: />(\/etc|\/var|\/usr)/, description: "System file modification" },
  { pattern: /sudo\s+/, description: "Elevated privilege execution" },
  { pattern: /kill\s+-9\s+(-1|1)/, description: "System process termination" },
];

/**
 * Perform a dry run of a tool execution
 */
export async function dryRun(
  toolName: string,
  input: Record<string, unknown>
): Promise<DryRunResult> {
  const tool = TOOLS.find(t => t.name === toolName);
  if (!tool) {
    throw new Error(`Unknown tool: ${toolName}`);
  }

  const riskProfile = TOOL_RISK_PROFILES[toolName] || {
    baseRisk: "medium" as const,
    categories: [],
    reversible: false,
    requiresConfirmation: true,
    estimatedDurationMs: 1000,
  };

  const validation = validateInput(tool, input);
  const preview = generatePreview(toolName, input, tool);
  const risks = assessRisks(toolName, input, riskProfile);

  return {
    toolName,
    input,
    preview,
    validation,
    risks,
    estimatedDuration: riskProfile.estimatedDurationMs,
    wouldRequireConfirmation: riskProfile.requiresConfirmation || risks.some(r => r.level === "high" || r.level === "critical"),
    reversible: riskProfile.reversible,
    timestamp: new Date(),
  };
}

/**
 * Validate tool input against schema
 */
function validateInput(tool: Tool, input: Record<string, unknown>): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  const schema = tool.input_schema as {
    properties?: Record<string, { type: string; description?: string; enum?: string[] }>;
    required?: string[];
  };

  // Check required fields
  if (schema.required) {
    for (const field of schema.required) {
      if (input[field] === undefined || input[field] === null || input[field] === "") {
        errors.push({
          field,
          message: `Required field '${field}' is missing`,
        });
      }
    }
  }

  // Check field types and enums
  if (schema.properties) {
    for (const [field, spec] of Object.entries(schema.properties)) {
      const value = input[field];

      if (value !== undefined) {
        // Type checking
        const actualType = Array.isArray(value) ? "array" : typeof value;
        if (spec.type && spec.type !== actualType && !(spec.type === "number" && actualType === "string" && !isNaN(Number(value)))) {
          errors.push({
            field,
            message: `Expected type '${spec.type}' but got '${actualType}'`,
            value,
          });
        }

        // Enum checking
        if (spec.enum && !spec.enum.includes(value as string)) {
          errors.push({
            field,
            message: `Invalid value. Must be one of: ${spec.enum.join(", ")}`,
            value,
          });
        }
      }
    }
  }

  // Tool-specific validation
  const toolWarnings = getToolSpecificWarnings(tool.name, input);
  warnings.push(...toolWarnings);

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Get tool-specific validation warnings
 */
function getToolSpecificWarnings(toolName: string, input: Record<string, unknown>): ValidationWarning[] {
  const warnings: ValidationWarning[] = [];

  switch (toolName) {
    case "execute_command": {
      const command = input.command as string;
      if (command && command.length > 500) {
        warnings.push({
          field: "command",
          message: "Command is very long, consider breaking it into smaller parts",
        });
      }
      if (command && command.includes("&&") && command.split("&&").length > 5) {
        warnings.push({
          field: "command",
          message: "Multiple chained commands detected, consider running separately",
        });
      }
      break;
    }
    case "write_file": {
      const path = input.path as string;
      if (path && (path.startsWith("/etc/") || path.startsWith("/usr/") || path.startsWith("/var/"))) {
        warnings.push({
          field: "path",
          message: "Writing to system directories may require elevated permissions",
        });
      }
      break;
    }
    case "browse_url": {
      const url = input.url as string;
      if (url && !url.startsWith("https://")) {
        warnings.push({
          field: "url",
          message: "URL does not use HTTPS, connection may not be secure",
          suggestion: "Use HTTPS if available",
        });
      }
      break;
    }
    case "spawn_agent": {
      const tokenBudget = input.token_budget as number;
      if (tokenBudget && tokenBudget > 100000) {
        warnings.push({
          field: "token_budget",
          message: "High token budget may result in significant API costs",
          suggestion: "Consider starting with a lower budget",
        });
      }
      break;
    }
  }

  return warnings;
}

/**
 * Generate a preview of what the tool would do
 */
function generatePreview(toolName: string, input: Record<string, unknown>, tool: Tool): ToolPreview {
  const basePreview: ToolPreview = {
    description: tool.description || `Execute ${toolName}`,
    expectedOutcome: "Operation completed successfully",
    sideEffects: [],
    affectedResources: [],
    dependencies: [],
  };

  switch (toolName) {
    case "execute_command": {
      const command = input.command as string;
      const workingDir = input.working_directory as string | undefined;

      basePreview.description = `Execute shell command: ${command.substring(0, 100)}${command.length > 100 ? "..." : ""}`;
      basePreview.expectedOutcome = "Command output will be captured and returned";
      basePreview.affectedResources.push({
        type: "process",
        operation: "execute",
        description: `Shell process to run: ${command.split(" ")[0]}`,
      });

      if (workingDir) {
        basePreview.affectedResources.push({
          type: "directory",
          path: workingDir,
          operation: "read",
          description: "Working directory for command execution",
        });
      }

      // Analyze command for resources
      if (command.includes(">") || command.includes(">>")) {
        const outputMatch = command.match(/[>]+\s*([^\s|&]+)/);
        if (outputMatch) {
          basePreview.affectedResources.push({
            type: "file",
            path: outputMatch[1],
            operation: "write",
            description: "Command output redirection target",
          });
          basePreview.sideEffects.push(`File will be ${command.includes(">>") ? "appended to" : "created/overwritten"}: ${outputMatch[1]}`);
        }
      }

      basePreview.mockOutput = { stdout: "[command output]", stderr: "", exitCode: 0 };
      break;
    }

    case "write_file": {
      const path = input.path as string;
      const content = input.content as string;

      basePreview.description = `Write ${content?.length || 0} bytes to file`;
      basePreview.expectedOutcome = `File will be created or overwritten at: ${path}`;
      basePreview.affectedResources.push({
        type: "file",
        path,
        operation: "write",
        description: `File content (${content?.length || 0} characters)`,
      });
      basePreview.sideEffects.push("Existing file content will be replaced if file exists");
      basePreview.mockOutput = "File written successfully";
      break;
    }

    case "read_file": {
      const path = input.path as string;

      basePreview.description = `Read file contents`;
      basePreview.expectedOutcome = `File contents from: ${path}`;
      basePreview.affectedResources.push({
        type: "file",
        path,
        operation: "read",
        description: "File to be read",
      });
      basePreview.mockOutput = "[file contents]";
      break;
    }

    case "list_directory": {
      const path = input.path as string;

      basePreview.description = `List directory contents`;
      basePreview.expectedOutcome = `List of files and folders in: ${path}`;
      basePreview.affectedResources.push({
        type: "directory",
        path,
        operation: "read",
        description: "Directory to be listed",
      });
      basePreview.mockOutput = ["file1.txt", "file2.js", "folder1/"];
      break;
    }

    case "web_search": {
      const query = input.query as string;

      basePreview.description = `Search the web for: ${query}`;
      basePreview.expectedOutcome = "Search results with titles, URLs, and snippets";
      basePreview.affectedResources.push({
        type: "external_service",
        operation: "read",
        description: "Web search API",
      });
      basePreview.dependencies.push("Internet connection", "Search API availability");
      basePreview.mockOutput = [{ title: "Result 1", url: "https://example.com", snippet: "..." }];
      break;
    }

    case "browse_url": {
      const url = input.url as string;

      basePreview.description = `Browse and extract content from URL`;
      basePreview.expectedOutcome = `Page content and metadata from: ${url}`;
      basePreview.affectedResources.push({
        type: "network",
        operation: "read",
        description: `HTTP request to: ${new URL(url).hostname}`,
      });
      basePreview.dependencies.push("Internet connection", "Target website availability");
      basePreview.mockOutput = { title: "Page Title", content: "[page content]" };
      break;
    }

    case "spawn_agent": {
      const type = input.type as string;
      const objective = input.objective as string;
      const tokenBudget = input.token_budget as number || 50000;

      basePreview.description = `Spawn ${type} agent for: ${objective?.substring(0, 50)}...`;
      basePreview.expectedOutcome = "Background agent will work autonomously on the objective";
      basePreview.affectedResources.push({
        type: "process",
        operation: "create",
        description: `${type} agent process`,
      });
      basePreview.sideEffects.push(
        `Agent will consume up to ${tokenBudget} tokens`,
        "Agent may execute tools based on objective"
      );
      basePreview.dependencies.push("Claude API availability", "Database connection");
      basePreview.mockOutput = { agentId: "uuid-here", message: "Agent spawned successfully" };
      break;
    }

    case "generate_pdf": {
      const filename = input.filename as string;
      const content = input.content as string;

      basePreview.description = `Generate PDF document: ${filename}`;
      basePreview.expectedOutcome = `PDF file created at: ${filename}`;
      basePreview.affectedResources.push({
        type: "file",
        path: filename,
        operation: "create",
        description: `PDF with ${content?.length || 0} characters of content`,
      });
      basePreview.mockOutput = { filePath: filename };
      break;
    }

    case "screenshot_analyze": {
      basePreview.description = "Capture and analyze screenshot";
      basePreview.expectedOutcome = "AI analysis of current screen content";
      basePreview.affectedResources.push({
        type: "memory",
        operation: "read",
        description: "Screen framebuffer capture",
      });
      basePreview.sideEffects.push("Screenshot image stored temporarily");
      basePreview.mockOutput = { analysis: "[AI analysis of screen content]" };
      break;
    }
  }

  return basePreview;
}

/**
 * Assess risks for a tool execution
 */
function assessRisks(
  toolName: string,
  input: Record<string, unknown>,
  profile: typeof TOOL_RISK_PROFILES[string]
): RiskAssessment[] {
  const risks: RiskAssessment[] = [];

  // Add base risk from profile
  if (profile.baseRisk !== "low") {
    for (const category of profile.categories) {
      risks.push({
        level: profile.baseRisk,
        category,
        description: `${toolName} has inherent ${category} risks`,
      });
    }
  }

  // Tool-specific risk assessment
  switch (toolName) {
    case "execute_command": {
      const command = input.command as string;
      if (command) {
        // Check for dangerous patterns
        for (const { pattern, description } of DANGEROUS_COMMAND_PATTERNS) {
          if (pattern.test(command)) {
            risks.push({
              level: "critical",
              category: "security",
              description: `Dangerous command pattern detected: ${description}`,
              mitigation: "Review command carefully before execution",
            });
          }
        }

        // Check for network access
        if (/curl|wget|nc|ssh|scp|rsync/.test(command)) {
          risks.push({
            level: "medium",
            category: "security",
            description: "Command may access network resources",
            mitigation: "Verify the remote endpoints are trusted",
          });
        }

        // Check for file deletion
        if (/rm\s+/.test(command)) {
          risks.push({
            level: "high",
            category: "data_loss",
            description: "Command includes file deletion",
            mitigation: "Verify files to be deleted are correct",
          });
        }
      }
      break;
    }

    case "write_file": {
      const path = input.path as string;
      if (path) {
        if (path.includes("..")) {
          risks.push({
            level: "high",
            category: "security",
            description: "Path contains directory traversal",
            mitigation: "Use absolute paths without '..'",
          });
        }
        if (path.match(/\.(sh|bash|py|js|exe|bat|ps1)$/i)) {
          risks.push({
            level: "medium",
            category: "security",
            description: "Writing to executable file",
            mitigation: "Verify the script content is safe",
          });
        }
      }
      break;
    }

    case "browse_url": {
      const url = input.url as string;
      if (url) {
        if (!url.startsWith("https://")) {
          risks.push({
            level: "medium",
            category: "security",
            description: "Non-HTTPS URL may expose data",
            mitigation: "Use HTTPS when possible",
          });
        }
        if (url.includes("@") || url.includes("file://")) {
          risks.push({
            level: "high",
            category: "security",
            description: "URL contains suspicious elements",
            mitigation: "Verify URL is legitimate",
          });
        }
      }
      break;
    }

    case "spawn_agent": {
      const tokenBudget = input.token_budget as number;
      if (tokenBudget && tokenBudget > 100000) {
        risks.push({
          level: "medium",
          category: "cost",
          description: `High token budget (${tokenBudget}) may result in significant costs`,
          mitigation: "Consider starting with a lower budget",
        });
      }
      break;
    }
  }

  return risks;
}

/**
 * Run multiple dry runs in batch
 */
export async function batchDryRun(
  operations: Array<{ toolName: string; input: Record<string, unknown> }>
): Promise<DryRunResult[]> {
  return Promise.all(operations.map(op => dryRun(op.toolName, op.input)));
}

/**
 * Get a summary of dry run results
 */
export function summarizeDryRun(results: DryRunResult[]): {
  totalOperations: number;
  validOperations: number;
  invalidOperations: number;
  totalRisks: number;
  criticalRisks: number;
  highRisks: number;
  estimatedTotalDuration: number;
  requiresConfirmation: boolean;
  allReversible: boolean;
} {
  return {
    totalOperations: results.length,
    validOperations: results.filter(r => r.validation.valid).length,
    invalidOperations: results.filter(r => !r.validation.valid).length,
    totalRisks: results.reduce((sum, r) => sum + r.risks.length, 0),
    criticalRisks: results.reduce((sum, r) => sum + r.risks.filter(risk => risk.level === "critical").length, 0),
    highRisks: results.reduce((sum, r) => sum + r.risks.filter(risk => risk.level === "high").length, 0),
    estimatedTotalDuration: results.reduce((sum, r) => sum + r.estimatedDuration, 0),
    requiresConfirmation: results.some(r => r.wouldRequireConfirmation),
    allReversible: results.every(r => r.reversible),
  };
}

/**
 * Format dry run result for display
 */
export function formatDryRunResult(result: DryRunResult): string {
  const lines: string[] = [];

  lines.push(`=== Dry Run: ${result.toolName} ===`);
  lines.push("");
  lines.push(`Status: ${result.validation.valid ? "VALID" : "INVALID"}`);
  lines.push(`Reversible: ${result.reversible ? "Yes" : "No"}`);
  lines.push(`Requires Confirmation: ${result.wouldRequireConfirmation ? "Yes" : "No"}`);
  lines.push(`Estimated Duration: ${result.estimatedDuration}ms`);
  lines.push("");
  lines.push("--- Preview ---");
  lines.push(result.preview.description);
  lines.push(`Expected: ${result.preview.expectedOutcome}`);

  if (result.preview.sideEffects.length > 0) {
    lines.push("");
    lines.push("Side Effects:");
    result.preview.sideEffects.forEach(se => lines.push(`  - ${se}`));
  }

  if (result.preview.affectedResources.length > 0) {
    lines.push("");
    lines.push("Affected Resources:");
    result.preview.affectedResources.forEach(ar =>
      lines.push(`  - [${ar.type}] ${ar.operation}: ${ar.description}`)
    );
  }

  if (result.validation.errors.length > 0) {
    lines.push("");
    lines.push("--- Validation Errors ---");
    result.validation.errors.forEach(e => lines.push(`  ERROR: ${e.field} - ${e.message}`));
  }

  if (result.validation.warnings.length > 0) {
    lines.push("");
    lines.push("--- Warnings ---");
    result.validation.warnings.forEach(w => lines.push(`  WARN: ${w.field} - ${w.message}`));
  }

  if (result.risks.length > 0) {
    lines.push("");
    lines.push("--- Risk Assessment ---");
    result.risks.forEach(r => lines.push(`  [${r.level.toUpperCase()}] ${r.category}: ${r.description}`));
  }

  return lines.join("\n");
}
