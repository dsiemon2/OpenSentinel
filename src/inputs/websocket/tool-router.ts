/**
 * WebSocket Tool Router
 *
 * Determines whether a tool should execute on the server or be routed
 * to a connected desktop client for local execution.
 */

// ─── Tool Classification (mirrored from desktop/local-executor/types.ts) ─────

/** Tools that execute on the local machine only (unavailable without a desktop client) */
const DESKTOP_ONLY_TOOLS = [
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
const HYBRID_TOOLS = [
  "execute_command",
  "list_directory",
  "read_file",
  "write_file",
  "search_files",
] as const;

const desktopOnlySet = new Set<string>(DESKTOP_ONLY_TOOLS);
const hybridSet = new Set<string>(HYBRID_TOOLS);

/**
 * Check if a tool is desktop-only (requires a connected client).
 */
export function isDesktopOnlyTool(toolName: string): boolean {
  return desktopOnlySet.has(toolName);
}

/**
 * Check if a tool can run locally when a client is connected.
 */
export function isHybridTool(toolName: string): boolean {
  return hybridSet.has(toolName);
}

/**
 * Check if a tool should be routed to a desktop client.
 */
export function isLocalTool(toolName: string): boolean {
  return desktopOnlySet.has(toolName) || hybridSet.has(toolName);
}
