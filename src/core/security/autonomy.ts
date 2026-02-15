/**
 * Autonomy Manager
 *
 * Controls the level of autonomy the assistant has when executing tools.
 * Three levels are supported:
 *   - readonly:    only safe, read-only tools are permitted
 *   - supervised:  all tools are permitted but certain high-impact tools are
 *                  flagged as requiring approval (enforcement happens upstream)
 *   - autonomous:  all tools are permitted without restriction
 */

export type AutonomyLevel = "readonly" | "supervised" | "autonomous";

/** Tools that are allowed even in readonly mode. */
export const READONLY_TOOLS: Set<string> = new Set([
  "search_web",
  "read_file",
  "list_files",
  "analyze_image",
  "get_time",
  "get_weather",
  "get_system_info",
  "get_calendar_events",
]);

/** Tools that require explicit approval when running in supervised mode. */
export const SUPERVISED_REQUIRE_APPROVAL: Set<string> = new Set([
  "execute_command",
  "write_file",
  "generate_document",
  "generate_spreadsheet",
  "send_email",
  "spawn_agent",
  "create_workflow",
]);

export class AutonomyManager {
  private defaultLevel: AutonomyLevel = "autonomous";
  private userLevels: Map<string, AutonomyLevel> = new Map();

  /** Set the system-wide default autonomy level. */
  setDefaultLevel(level: AutonomyLevel): void {
    this.defaultLevel = level;
  }

  /** Get the system-wide default autonomy level. */
  getDefaultLevel(): AutonomyLevel {
    return this.defaultLevel;
  }

  /** Override the autonomy level for a specific user. */
  setLevel(userId: string, level: AutonomyLevel): void {
    this.userLevels.set(userId, level);
  }

  /** Get the effective autonomy level for a user (falls back to default). */
  getLevel(userId: string): AutonomyLevel {
    return this.userLevels.get(userId) ?? this.defaultLevel;
  }

  /**
   * Check whether a tool invocation is allowed for the given user.
   *
   * Returns an object with `allowed` (boolean) and an optional `reason`
   * string that explains the decision.
   */
  checkToolAccess(
    userId: string,
    toolName: string,
  ): { allowed: boolean; reason?: string } {
    const level = this.getLevel(userId);

    switch (level) {
      case "autonomous":
        return { allowed: true };

      case "readonly":
        if (READONLY_TOOLS.has(toolName)) {
          return { allowed: true };
        }
        return {
          allowed: false,
          reason: `Tool "${toolName}" is not permitted in readonly mode`,
        };

      case "supervised":
        if (SUPERVISED_REQUIRE_APPROVAL.has(toolName)) {
          return {
            allowed: true,
            reason: `Tool "${toolName}" requires approval in supervised mode`,
          };
        }
        return { allowed: true };
    }
  }

  /** Return high-level stats about the current autonomy configuration. */
  getStats(): { level: string; usersWithCustomLevel: number } {
    return {
      level: this.defaultLevel,
      usersWithCustomLevel: this.userLevels.size,
    };
  }
}

export const autonomyManager = new AutonomyManager();
