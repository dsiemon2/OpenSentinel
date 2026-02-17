/**
 * Local Action Executor - Shared Types
 *
 * Defines the interface contract between:
 * - Desktop apps (OpenSentinel Desktop, JARVIS)
 * - VPS WebSocket bridge
 * - Server-side tool router
 */

// ─── Tool Names ──────────────────────────────────────────

/** Tools that execute on the local machine only (unavailable without a desktop client) */
export const DESKTOP_ONLY_TOOLS = [
  "local_app_launch",
  "local_system_stats",
  "local_system_lock",
  "local_system_shutdown",
  "local_system_restart",
  "local_screenshot",
  "local_clipboard_read",
  "local_clipboard_write",
  "local_open_file",
  "local_open_url",
  "local_network_info",
  "local_volume_set",
  "local_volume_mute",
] as const;

/** Tools that can run locally if a client is connected, or on the VPS otherwise */
export const HYBRID_TOOLS = [
  "execute_command",
  "list_directory",
  "read_file",
  "write_file",
  "search_files",
] as const;

/** All local-capable tool names */
export const LOCAL_TOOL_NAMES = [
  ...DESKTOP_ONLY_TOOLS,
  ...HYBRID_TOOLS,
] as const;

export type DesktopOnlyTool = (typeof DESKTOP_ONLY_TOOLS)[number];
export type HybridTool = (typeof HYBRID_TOOLS)[number];
export type LocalToolName = (typeof LOCAL_TOOL_NAMES)[number];

// ─── Request / Response ──────────────────────────────────

export interface LocalToolRequest {
  /** Unique request ID for correlation */
  requestId: string;
  /** Tool name to execute */
  toolName: LocalToolName;
  /** Tool input parameters */
  input: Record<string, unknown>;
  /** Timeout in ms (default 30000) */
  timeout?: number;
}

export interface LocalToolResponse {
  /** Correlation ID matching the request */
  requestId: string;
  /** Whether execution succeeded */
  success: boolean;
  /** Tool output (any JSON-serializable value) */
  result?: unknown;
  /** Error message if failed */
  error?: string;
  /** Execution time in ms */
  durationMs?: number;
}

// ─── Executor Interface ──────────────────────────────────

export interface ClientCapabilities {
  /** Platform: win32, darwin, linux */
  platform: NodeJS.Platform;
  /** List of supported local tool names */
  tools: LocalToolName[];
  /** App version */
  version: string;
  /** Client identifier: "opensentinel-desktop" | "jarvis" */
  clientId: string;
}

export interface ILocalExecutor {
  /** Get the capabilities this executor supports */
  getCapabilities(): ClientCapabilities;

  /** Execute a local tool */
  execute(request: LocalToolRequest): Promise<LocalToolResponse>;

  /** Check if a tool is supported */
  supports(toolName: string): boolean;
}

// ─── WebSocket Bridge Protocol ───────────────────────────

/** Client → Server messages */
export type ClientMessage =
  | {
      type: "register_client";
      capabilities: ClientCapabilities;
    }
  | {
      type: "tool_result_local";
      response: LocalToolResponse;
    }
  | {
      type: "chat";
      message: string;
      conversationId?: string;
    }
  | {
      type: "ping";
    };

/** Server → Client messages */
export type ServerMessage =
  | {
      type: "tool_execute_local";
      request: LocalToolRequest;
    }
  | {
      type: "chunk";
      text: string;
      conversationId?: string;
    }
  | {
      type: "tool_start";
      toolName: string;
      toolInput: Record<string, unknown>;
    }
  | {
      type: "tool_result";
      toolName: string;
      result: unknown;
    }
  | {
      type: "complete";
      fullText: string;
      conversationId?: string;
    }
  | {
      type: "error";
      message: string;
    }
  | {
      type: "registered";
      sessionId: string;
    }
  | {
      type: "pong";
    };

// ─── Tool Definitions (Anthropic format) ─────────────────

export interface ToolParameter {
  type: string;
  description: string;
  enum?: string[];
  default?: unknown;
}

export interface LocalToolDefinition {
  name: LocalToolName;
  description: string;
  input_schema: {
    type: "object";
    properties: Record<string, ToolParameter>;
    required?: string[];
  };
}

/** Tool definitions for all local tools (sent to Claude API) */
export const LOCAL_TOOL_DEFINITIONS: LocalToolDefinition[] = [
  {
    name: "execute_command",
    description:
      "Execute a shell command on the user's local machine. Supports CMD, PowerShell, and Bash.",
    input_schema: {
      type: "object",
      properties: {
        command: { type: "string", description: "The command to execute" },
        shell: {
          type: "string",
          description: "Shell to use",
          enum: ["cmd", "powershell", "bash"],
          default: "powershell",
        },
        cwd: {
          type: "string",
          description: "Working directory (defaults to user home)",
        },
      },
      required: ["command"],
    },
  },
  {
    name: "list_directory",
    description:
      "List files and directories at a path on the user's local machine.",
    input_schema: {
      type: "object",
      properties: {
        path: { type: "string", description: "Directory path to list" },
      },
      required: ["path"],
    },
  },
  {
    name: "read_file",
    description: "Read the contents of a file on the user's local machine.",
    input_schema: {
      type: "object",
      properties: {
        path: { type: "string", description: "File path to read" },
        encoding: {
          type: "string",
          description: "File encoding",
          default: "utf-8",
        },
      },
      required: ["path"],
    },
  },
  {
    name: "write_file",
    description: "Write content to a file on the user's local machine.",
    input_schema: {
      type: "object",
      properties: {
        path: { type: "string", description: "File path to write" },
        content: { type: "string", description: "Content to write" },
        encoding: {
          type: "string",
          description: "File encoding",
          default: "utf-8",
        },
      },
      required: ["path", "content"],
    },
  },
  {
    name: "search_files",
    description:
      "Search for files matching a pattern on the user's local machine.",
    input_schema: {
      type: "object",
      properties: {
        directory: {
          type: "string",
          description: "Directory to search in",
        },
        pattern: {
          type: "string",
          description: "Search pattern (glob or filename)",
        },
        recursive: {
          type: "string",
          description: "Search recursively",
          default: "true",
        },
      },
      required: ["directory", "pattern"],
    },
  },
  {
    name: "local_app_launch",
    description:
      "Launch an application on the user's local machine. Supports common apps like Chrome, VS Code, Spotify, etc.",
    input_schema: {
      type: "object",
      properties: {
        app: {
          type: "string",
          description:
            "App name (e.g., chrome, firefox, vscode, spotify, notepad, calculator, explorer, terminal, word, excel, outlook, vlc)",
        },
      },
      required: ["app"],
    },
  },
  {
    name: "local_system_stats",
    description:
      "Get system statistics: CPU usage, RAM usage, disk space, uptime.",
    input_schema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "local_system_lock",
    description: "Lock the user's computer screen.",
    input_schema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "local_system_shutdown",
    description:
      "Shut down the user's computer. Requires explicit confirmation.",
    input_schema: {
      type: "object",
      properties: {
        delay: {
          type: "string",
          description: "Delay in seconds before shutdown (default 60)",
          default: "60",
        },
      },
    },
  },
  {
    name: "local_system_restart",
    description: "Restart the user's computer. Requires explicit confirmation.",
    input_schema: {
      type: "object",
      properties: {
        delay: {
          type: "string",
          description: "Delay in seconds before restart (default 60)",
          default: "60",
        },
      },
    },
  },
  {
    name: "local_screenshot",
    description:
      "Capture a screenshot of the user's screen and save it to Pictures/Screenshots.",
    input_schema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "local_clipboard_read",
    description: "Read the current contents of the user's clipboard.",
    input_schema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "local_clipboard_write",
    description: "Write text to the user's clipboard.",
    input_schema: {
      type: "object",
      properties: {
        text: { type: "string", description: "Text to write to clipboard" },
      },
      required: ["text"],
    },
  },
  {
    name: "local_open_file",
    description:
      "Open a file with the default application on the user's machine.",
    input_schema: {
      type: "object",
      properties: {
        path: { type: "string", description: "File path to open" },
      },
      required: ["path"],
    },
  },
  {
    name: "local_open_url",
    description: "Open a URL in the user's default browser.",
    input_schema: {
      type: "object",
      properties: {
        url: { type: "string", description: "URL to open" },
      },
      required: ["url"],
    },
  },
  {
    name: "local_network_info",
    description:
      "Get network information: local IPs, external IP, and optionally ping a host.",
    input_schema: {
      type: "object",
      properties: {
        pingHost: {
          type: "string",
          description: "Optional host to ping",
        },
      },
    },
  },
  {
    name: "local_volume_set",
    description: "Set the system volume level (Windows only).",
    input_schema: {
      type: "object",
      properties: {
        level: {
          type: "string",
          description: "Volume level 0-100",
        },
      },
      required: ["level"],
    },
  },
  {
    name: "local_volume_mute",
    description: "Toggle mute on the system volume (Windows only).",
    input_schema: {
      type: "object",
      properties: {},
    },
  },
];
