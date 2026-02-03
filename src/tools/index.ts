import type { Tool } from "@anthropic-ai/sdk/resources/messages";
import { executeCommand } from "./shell";
import {
  listDirectory,
  readFileContent,
  writeFileContent,
  searchFiles,
} from "./files";
import { navigateTo, searchGoogle, takeScreenshot } from "./browser";
import { webSearch, research } from "./web-search";

// Define tools for Claude
export const TOOLS: Tool[] = [
  {
    name: "execute_command",
    description:
      "Execute a shell command on the system. Use for system tasks, git operations, running scripts, etc. Some dangerous commands are blocked for safety.",
    input_schema: {
      type: "object" as const,
      properties: {
        command: {
          type: "string",
          description: "The shell command to execute",
        },
        working_directory: {
          type: "string",
          description: "Optional working directory for the command",
        },
      },
      required: ["command"],
    },
  },
  {
    name: "list_directory",
    description: "List files and folders in a directory",
    input_schema: {
      type: "object" as const,
      properties: {
        path: {
          type: "string",
          description: "The directory path to list",
        },
      },
      required: ["path"],
    },
  },
  {
    name: "read_file",
    description: "Read the contents of a file",
    input_schema: {
      type: "object" as const,
      properties: {
        path: {
          type: "string",
          description: "The file path to read",
        },
      },
      required: ["path"],
    },
  },
  {
    name: "write_file",
    description: "Write content to a file (creates or overwrites)",
    input_schema: {
      type: "object" as const,
      properties: {
        path: {
          type: "string",
          description: "The file path to write to",
        },
        content: {
          type: "string",
          description: "The content to write",
        },
      },
      required: ["path", "content"],
    },
  },
  {
    name: "search_files",
    description: "Search for files matching a glob pattern",
    input_schema: {
      type: "object" as const,
      properties: {
        pattern: {
          type: "string",
          description: "Glob pattern to search for (e.g., '**/*.ts')",
        },
        base_path: {
          type: "string",
          description: "Base directory to search from",
        },
      },
      required: ["pattern"],
    },
  },
  {
    name: "web_search",
    description: "Search the web for information",
    input_schema: {
      type: "object" as const,
      properties: {
        query: {
          type: "string",
          description: "The search query",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "browse_url",
    description: "Navigate to a URL and extract its content",
    input_schema: {
      type: "object" as const,
      properties: {
        url: {
          type: "string",
          description: "The URL to browse",
        },
      },
      required: ["url"],
    },
  },
  {
    name: "take_screenshot",
    description: "Take a screenshot of the current browser page",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
];

// Execute a tool by name
export async function executeTool(
  name: string,
  input: Record<string, unknown>
): Promise<{ success: boolean; result: unknown; error?: string }> {
  try {
    switch (name) {
      case "execute_command": {
        const result = await executeCommand(
          input.command as string,
          input.working_directory as string | undefined
        );
        return {
          success: result.success,
          result: {
            stdout: result.stdout,
            stderr: result.stderr,
            exitCode: result.exitCode,
          },
          error: result.success ? undefined : result.stderr,
        };
      }

      case "list_directory": {
        const files = await listDirectory(input.path as string);
        return { success: true, result: files };
      }

      case "read_file": {
        const content = await readFileContent(input.path as string);
        return { success: true, result: content };
      }

      case "write_file": {
        await writeFileContent(input.path as string, input.content as string);
        return { success: true, result: "File written successfully" };
      }

      case "search_files": {
        const files = await searchFiles(
          input.pattern as string,
          input.base_path as string | undefined
        );
        return { success: true, result: files };
      }

      case "web_search": {
        const results = await webSearch(input.query as string);
        return { success: true, result: results };
      }

      case "browse_url": {
        const page = await navigateTo(input.url as string);
        return { success: true, result: page };
      }

      case "take_screenshot": {
        const screenshot = await takeScreenshot();
        return {
          success: true,
          result: { screenshot: `data:image/png;base64,${screenshot}` },
        };
      }

      default:
        return { success: false, result: null, error: `Unknown tool: ${name}` };
    }
  } catch (error) {
    return {
      success: false,
      result: null,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
