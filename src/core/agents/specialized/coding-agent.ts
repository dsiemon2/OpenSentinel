import { AgentType, AGENT_SYSTEM_PROMPTS, AGENT_TOOL_PERMISSIONS } from "../agent-types";

export const CODING_AGENT_CONFIG = {
  type: "coding" as AgentType,
  name: "Coding Agent",
  description: "Specialized agent for code implementation, debugging, and improvements",

  systemPrompt: AGENT_SYSTEM_PROMPTS.coding,
  tools: AGENT_TOOL_PERMISSIONS.coding,

  // Coding-specific settings
  settings: {
    maxFilesToModify: 10,
    maxLinesPerFile: 500,
    requireTests: false,
    autoFormat: true,
    languages: ["typescript", "javascript", "python", "go", "rust", "java"],
  },

  // Code output format
  outputFormat: {
    includeComments: true,
    includeTypes: true,
    maxComplexity: 10,
    preferAsync: true,
  },

  // Coding standards
  standards: {
    typescript: {
      useStrict: true,
      preferConst: true,
      noAny: true,
      explicitReturnTypes: true,
    },
    javascript: {
      useStrict: true,
      preferConst: true,
      preferArrowFunctions: true,
    },
    python: {
      useTypeHints: true,
      followPep8: true,
      preferFstrings: true,
    },
  },
};

// Coding task types
export const CODING_TASKS = {
  implement: {
    name: "Implement Feature",
    description: "Implement a new feature from scratch",
    steps: [
      "Understand requirements",
      "Plan implementation",
      "Write code",
      "Add error handling",
      "Test",
      "Document",
    ],
  },
  debug: {
    name: "Debug Issue",
    description: "Find and fix bugs in existing code",
    steps: [
      "Reproduce the issue",
      "Analyze error messages",
      "Identify root cause",
      "Implement fix",
      "Verify fix",
      "Add regression test",
    ],
  },
  refactor: {
    name: "Refactor Code",
    description: "Improve code quality without changing behavior",
    steps: [
      "Understand current code",
      "Identify improvements",
      "Plan refactoring",
      "Apply changes incrementally",
      "Verify behavior unchanged",
      "Update documentation",
    ],
  },
  optimize: {
    name: "Optimize Performance",
    description: "Improve code performance",
    steps: [
      "Profile current performance",
      "Identify bottlenecks",
      "Research optimization strategies",
      "Implement optimizations",
      "Measure improvements",
      "Document changes",
    ],
  },
  review: {
    name: "Code Review",
    description: "Review code for issues and improvements",
    steps: [
      "Read through code",
      "Check for bugs",
      "Check for security issues",
      "Check for performance issues",
      "Suggest improvements",
      "Provide summary",
    ],
  },
};

// Code quality checkers
export function validateCodeOutput(
  code: string,
  language: string
): {
  isValid: boolean;
  issues: string[];
  suggestions: string[];
} {
  const issues: string[] = [];
  const suggestions: string[] = [];

  // Check for common issues
  if (code.includes("console.log") && language !== "javascript") {
    suggestions.push("Remove debug console.log statements");
  }

  if (code.includes("TODO") || code.includes("FIXME")) {
    issues.push("Contains TODO/FIXME comments that need attention");
  }

  if (code.includes("any") && language === "typescript") {
    suggestions.push("Avoid using 'any' type - use specific types");
  }

  // Check for hardcoded values
  const hardcodedPatterns = [
    /password\s*=\s*["'][^"']+["']/i,
    /api_key\s*=\s*["'][^"']+["']/i,
    /secret\s*=\s*["'][^"']+["']/i,
  ];

  for (const pattern of hardcodedPatterns) {
    if (pattern.test(code)) {
      issues.push("Contains hardcoded sensitive values");
      break;
    }
  }

  // Check for error handling
  if (
    (code.includes("async") || code.includes("await")) &&
    !code.includes("try") &&
    !code.includes("catch")
  ) {
    suggestions.push("Consider adding try-catch for async operations");
  }

  return {
    isValid: issues.length === 0,
    issues,
    suggestions,
  };
}

// Code template generators
export function generateBoilerplate(
  type: string,
  name: string,
  language: string = "typescript"
): string {
  const templates: Record<string, Record<string, string>> = {
    typescript: {
      function: `export function ${name}(): void {
  // TODO: Implement
}`,
      class: `export class ${name} {
  constructor() {
    // TODO: Initialize
  }
}`,
      interface: `export interface ${name} {
  // TODO: Define properties
}`,
      test: `import { describe, test, expect } from "bun:test";
import { ${name} } from "./${name.toLowerCase()}";

describe("${name}", () => {
  test("should work", () => {
    // TODO: Implement test
    expect(true).toBe(true);
  });
});`,
    },
    python: {
      function: `def ${name.toLowerCase()}():
    """TODO: Add docstring"""
    pass`,
      class: `class ${name}:
    """TODO: Add docstring"""

    def __init__(self):
        pass`,
      test: `import pytest
from ${name.toLowerCase()} import ${name}

def test_${name.toLowerCase()}():
    # TODO: Implement test
    assert True`,
    },
  };

  return templates[language]?.[type] || `// TODO: Implement ${name}`;
}

// Build coding prompt
export function buildCodingPrompt(
  task: keyof typeof CODING_TASKS,
  description: string,
  context?: {
    language?: string;
    existingCode?: string;
    requirements?: string[];
  }
): string {
  const taskInfo = CODING_TASKS[task];
  let prompt = `Task Type: ${taskInfo.name}\n`;
  prompt += `Description: ${description}\n\n`;

  if (context?.language) {
    prompt += `Language: ${context.language}\n`;
  }

  if (context?.requirements?.length) {
    prompt += `Requirements:\n${context.requirements.map((r) => `- ${r}`).join("\n")}\n\n`;
  }

  if (context?.existingCode) {
    prompt += `Existing Code:\n\`\`\`\n${context.existingCode}\n\`\`\`\n\n`;
  }

  prompt += `Steps to follow:\n${taskInfo.steps.map((s, i) => `${i + 1}. ${s}`).join("\n")}\n\n`;
  prompt += `Please complete this task following your guidelines.`;

  return prompt;
}

export default {
  CODING_AGENT_CONFIG,
  CODING_TASKS,
  validateCodeOutput,
  generateBoilerplate,
  buildCodingPrompt,
};
