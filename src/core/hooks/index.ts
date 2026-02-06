// Core Hooks System — System-wide lifecycle hooks
// Unlike plugin events, these are core hooks that intercept and can modify behavior

export type HookPhase = "before" | "after";

export type HookEvent =
  | "message:process"      // Before/after processing a user message
  | "tool:execute"         // Before/after tool execution
  | "response:generate"    // Before/after generating AI response
  | "memory:store"         // Before/after storing a memory
  | "mode:change"          // Before/after mode change
  | "session:start"        // Before/after session creation
  | "session:end"          // Before/after session end
  | "agent:spawn"          // Before/after spawning an agent
  | "workflow:execute"     // Before/after workflow execution
  | "skill:execute";       // Before/after skill execution

export interface HookContext {
  event: HookEvent;
  phase: HookPhase;
  userId?: string;
  timestamp: Date;
  data: Record<string, unknown>;
  /** Set to true to cancel the operation (only in "before" phase) */
  cancelled: boolean;
  /** Reason for cancellation */
  cancelReason?: string;
  /** Modified data to pass through */
  modifiedData?: Record<string, unknown>;
}

export type HookHandler = (context: HookContext) => Promise<HookContext> | HookContext;

interface RegisteredHook {
  id: string;
  event: HookEvent;
  phase: HookPhase;
  handler: HookHandler;
  priority: number; // Lower = runs first
  name: string;
  enabled: boolean;
}

// Hook registry
const hooks: Map<string, RegisteredHook> = new Map();
let hookIdCounter = 0;

export class HookManager {
  /**
   * Register a hook
   */
  register(params: {
    event: HookEvent;
    phase: HookPhase;
    handler: HookHandler;
    name: string;
    priority?: number;
  }): string {
    const id = `hook_${++hookIdCounter}`;
    const hook: RegisteredHook = {
      id,
      event: params.event,
      phase: params.phase,
      handler: params.handler,
      priority: params.priority ?? 100,
      name: params.name,
      enabled: true,
    };
    hooks.set(id, hook);
    return id;
  }

  /**
   * Unregister a hook
   */
  unregister(hookId: string): boolean {
    return hooks.delete(hookId);
  }

  /**
   * Enable/disable a hook
   */
  setEnabled(hookId: string, enabled: boolean): void {
    const hook = hooks.get(hookId);
    if (hook) hook.enabled = enabled;
  }

  /**
   * Run all hooks for a given event and phase
   */
  async run(
    event: HookEvent,
    phase: HookPhase,
    data: Record<string, unknown>,
    userId?: string
  ): Promise<HookContext> {
    const context: HookContext = {
      event,
      phase,
      userId,
      timestamp: new Date(),
      data: { ...data },
      cancelled: false,
    };

    // Get matching hooks sorted by priority
    const matching = this.getHooksFor(event, phase);

    for (const hook of matching) {
      try {
        const result = await hook.handler(context);
        // Merge modifications back
        if (result.modifiedData) {
          Object.assign(context.data, result.modifiedData);
        }
        context.cancelled = result.cancelled;
        context.cancelReason = result.cancelReason;

        // Stop processing if cancelled
        if (context.cancelled && phase === "before") {
          break;
        }
      } catch (error) {
        console.error(`[Hook] Error in hook "${hook.name}":`, error);
      }
    }

    return context;
  }

  /**
   * Convenience: run before hooks, check if cancelled
   */
  async runBefore(
    event: HookEvent,
    data: Record<string, unknown>,
    userId?: string
  ): Promise<{ proceed: boolean; data: Record<string, unknown>; reason?: string }> {
    const ctx = await this.run(event, "before", data, userId);
    return {
      proceed: !ctx.cancelled,
      data: ctx.modifiedData ?? ctx.data,
      reason: ctx.cancelReason,
    };
  }

  /**
   * Convenience: run after hooks
   */
  async runAfter(
    event: HookEvent,
    data: Record<string, unknown>,
    userId?: string
  ): Promise<void> {
    await this.run(event, "after", data, userId);
  }

  /**
   * Get hooks for a specific event/phase
   */
  private getHooksFor(event: HookEvent, phase: HookPhase): RegisteredHook[] {
    const result: RegisteredHook[] = [];
    for (const hook of hooks.values()) {
      if (hook.event === event && hook.phase === phase && hook.enabled) {
        result.push(hook);
      }
    }
    return result.sort((a, b) => a.priority - b.priority);
  }

  /**
   * List all registered hooks
   */
  listHooks(): Array<{
    id: string;
    event: HookEvent;
    phase: HookPhase;
    name: string;
    priority: number;
    enabled: boolean;
  }> {
    return [...hooks.values()].map((h) => ({
      id: h.id,
      event: h.event,
      phase: h.phase,
      name: h.name,
      priority: h.priority,
      enabled: h.enabled,
    }));
  }

  /**
   * Clear all hooks
   */
  clearAll(): void {
    hooks.clear();
  }

  /**
   * Get hook count
   */
  getHookCount(): number {
    return hooks.size;
  }
}

// Singleton
export const hookManager = new HookManager();

// ============================================
// SOUL HOOK — Personality/behavior modification
// ============================================

export interface SoulConfig {
  name: string;
  description: string;
  personality: string;  // Injected into system prompt
  rules: string[];      // Behavioral rules
  enabled: boolean;
}

// In-memory soul configs
const soulConfigs: Map<string, SoulConfig> = new Map();
let activeSoulId: string | null = null;

export class SoulHookManager {
  /**
   * Register a soul configuration
   */
  registerSoul(id: string, config: SoulConfig): void {
    soulConfigs.set(id, config);
  }

  /**
   * Activate a soul — modifies AI personality via system prompt injection
   */
  activateSoul(soulId: string): boolean {
    const soul = soulConfigs.get(soulId);
    if (!soul) return false;

    // Deactivate previous
    if (activeSoulId) {
      const prev = soulConfigs.get(activeSoulId);
      if (prev) prev.enabled = false;
    }

    soul.enabled = true;
    activeSoulId = soulId;

    // Register a hook that modifies the system prompt
    hookManager.register({
      event: "message:process",
      phase: "before",
      name: `soul:${soulId}`,
      priority: 10, // High priority — runs early
      handler: (ctx) => {
        if (soul.enabled) {
          ctx.modifiedData = {
            ...ctx.data,
            soulPrompt: this.buildSoulPrompt(soul),
          };
        }
        return ctx;
      },
    });

    return true;
  }

  /**
   * Deactivate the current soul
   */
  deactivateSoul(): void {
    if (activeSoulId) {
      const soul = soulConfigs.get(activeSoulId);
      if (soul) soul.enabled = false;
    }
    activeSoulId = null;
  }

  /**
   * Get the active soul config
   */
  getActiveSoul(): SoulConfig | null {
    if (!activeSoulId) return null;
    return soulConfigs.get(activeSoulId) ?? null;
  }

  /**
   * Build the system prompt addition from a soul config
   */
  buildSoulPrompt(soul: SoulConfig): string {
    const parts: string[] = [];
    parts.push(`\n\n[SOUL: ${soul.name}]`);
    parts.push(soul.personality);

    if (soul.rules.length > 0) {
      parts.push("\nBehavioral Rules:");
      for (const rule of soul.rules) {
        parts.push(`- ${rule}`);
      }
    }

    return parts.join("\n");
  }

  /**
   * List all registered souls
   */
  listSouls(): Array<{ id: string; config: SoulConfig; active: boolean }> {
    const result: Array<{ id: string; config: SoulConfig; active: boolean }> = [];
    for (const [id, config] of soulConfigs.entries()) {
      result.push({ id, config, active: id === activeSoulId });
    }
    return result;
  }

  /**
   * Delete a soul
   */
  deleteSoul(id: string): boolean {
    if (id === activeSoulId) this.deactivateSoul();
    return soulConfigs.delete(id);
  }
}

// Singleton
export const soulHookManager = new SoulHookManager();

// Register built-in soul: "Evil Hook" (mischievous personality)
soulHookManager.registerSoul("evil", {
  name: "Evil Mode",
  description: "A mischievous, sarcastic personality that still helps but with attitude",
  personality: `You have a mischievous streak. While you still help the user accomplish their goals,
you do so with dark humor, sarcastic commentary, and dramatic flair. You might:
- Add dramatic narration to mundane tasks
- Use villain-like phrasing ("Excellent... the code compiles as planned...")
- Make sarcastic observations about the user's choices
- Reference pop culture villains
- Still be helpful — just entertainingly evil about it`,
  rules: [
    "Never actually refuse to help or be harmful",
    "Keep the dark humor lighthearted and fun",
    "Still prioritize accuracy and helpfulness",
    "Don't overdo it — subtlety is key",
  ],
  enabled: false,
});

// Register built-in soul: "Professional"
soulHookManager.registerSoul("professional", {
  name: "Professional Mode",
  description: "Ultra-professional, formal communication style",
  personality: `You communicate in a highly professional, formal manner suitable for enterprise environments.
Use precise language, avoid colloquialisms, and maintain a consultative tone.`,
  rules: [
    "Use formal language at all times",
    "Address the user professionally",
    "Provide structured, well-organized responses",
    "Cite reasoning and evidence for recommendations",
  ],
  enabled: false,
});

// Register built-in soul: "Friendly"
soulHookManager.registerSoul("friendly", {
  name: "Friendly Mode",
  description: "Warm, encouraging, and supportive personality",
  personality: `You are exceptionally warm, encouraging, and supportive. You celebrate wins,
offer gentle guidance on mistakes, and make the user feel supported throughout their work.
Think of yourself as a helpful friend who happens to be an expert.`,
  rules: [
    "Always acknowledge effort and progress",
    "Offer encouragement when tasks are challenging",
    "Use a warm, conversational tone",
    "Be patient and understanding with mistakes",
  ],
  enabled: false,
});
