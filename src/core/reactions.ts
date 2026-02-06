// Cross-platform emoji reaction system

export interface MessageRef {
  platform: "telegram" | "discord" | "slack" | "web";
  channelId: string;
  messageId: string;
  extra?: Record<string, unknown>;
}

export type ReactionEmoji =
  | "hourglass"    // Processing
  | "checkmark"    // Success
  | "cross"        // Error
  | "wrench"       // Tool running
  | "brain"        // Thinking
  | "sparkles"     // Complete
  | "warning"      // Warning
  | "eyes";        // Reviewing

// Platform-specific emoji mappings
const EMOJI_MAP: Record<string, Record<ReactionEmoji, string>> = {
  telegram: {
    hourglass: "\u23f3",
    checkmark: "\u2705",
    cross: "\u274c",
    wrench: "\ud83d\udd27",
    brain: "\ud83e\udde0",
    sparkles: "\u2728",
    warning: "\u26a0\ufe0f",
    eyes: "\ud83d\udc40",
  },
  discord: {
    hourglass: "\u23f3",
    checkmark: "\u2705",
    cross: "\u274c",
    wrench: "\ud83d\udd27",
    brain: "\ud83e\udde0",
    sparkles: "\u2728",
    warning: "\u26a0\ufe0f",
    eyes: "\ud83d\udc40",
  },
  slack: {
    hourglass: "hourglass_flowing_sand",
    checkmark: "white_check_mark",
    cross: "x",
    wrench: "wrench",
    brain: "brain",
    sparkles: "sparkles",
    warning: "warning",
    eyes: "eyes",
  },
  web: {
    hourglass: "\u23f3",
    checkmark: "\u2705",
    cross: "\u274c",
    wrench: "\ud83d\udd27",
    brain: "\ud83e\udde0",
    sparkles: "\u2728",
    warning: "\u26a0\ufe0f",
    eyes: "\ud83d\udc40",
  },
};

// Platform adapter interface
export interface ReactionAdapter {
  addReaction(channelId: string, messageId: string, emoji: string): Promise<void>;
  removeReaction(channelId: string, messageId: string, emoji: string): Promise<void>;
}

// Registered platform adapters
const adapters: Map<string, ReactionAdapter> = new Map();

export class ReactionManager {
  registerAdapter(platform: string, adapter: ReactionAdapter): void {
    adapters.set(platform, adapter);
  }

  getAdapter(platform: string): ReactionAdapter | undefined {
    return adapters.get(platform);
  }

  private resolveEmoji(platform: string, emoji: ReactionEmoji): string {
    return EMOJI_MAP[platform]?.[emoji] ?? EMOJI_MAP.discord[emoji];
  }

  async addReaction(ref: MessageRef, emoji: ReactionEmoji): Promise<void> {
    const adapter = adapters.get(ref.platform);
    if (!adapter) return;

    const resolved = this.resolveEmoji(ref.platform, emoji);
    try {
      await adapter.addReaction(ref.channelId, ref.messageId, resolved);
    } catch {
      // Silently ignore reaction failures (permissions, etc.)
    }
  }

  async removeReaction(ref: MessageRef, emoji: ReactionEmoji): Promise<void> {
    const adapter = adapters.get(ref.platform);
    if (!adapter) return;

    const resolved = this.resolveEmoji(ref.platform, emoji);
    try {
      await adapter.removeReaction(ref.channelId, ref.messageId, resolved);
    } catch {
      // Silently ignore reaction failures
    }
  }

  async setProcessing(ref: MessageRef): Promise<void> {
    await this.addReaction(ref, "hourglass");
  }

  async setSuccess(ref: MessageRef): Promise<void> {
    await this.removeReaction(ref, "hourglass");
    await this.addReaction(ref, "checkmark");
  }

  async setError(ref: MessageRef): Promise<void> {
    await this.removeReaction(ref, "hourglass");
    await this.addReaction(ref, "cross");
  }

  async setToolRunning(ref: MessageRef, _toolName?: string): Promise<void> {
    await this.addReaction(ref, "wrench");
  }

  async clearToolRunning(ref: MessageRef): Promise<void> {
    await this.removeReaction(ref, "wrench");
  }

  async setThinking(ref: MessageRef): Promise<void> {
    await this.addReaction(ref, "brain");
  }

  async clearThinking(ref: MessageRef): Promise<void> {
    await this.removeReaction(ref, "brain");
  }
}

// Singleton instance
export const reactionManager = new ReactionManager();
