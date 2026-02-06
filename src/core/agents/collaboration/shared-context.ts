/**
 * Shared Context - Shared memory and context between agents
 *
 * Provides a mechanism for agents to share state, artifacts, and context
 * with each other during collaborative tasks.
 */

import Redis from "ioredis";
import { env } from "../../../config/env";
import { db } from "../../../db";
import { memories, NewMemory } from "../../../db/schema";
import { eq, and, inArray, desc } from "drizzle-orm";
import { AgentType } from "../agent-types";
import { metric } from "../../observability/metrics";

// Context entry types
export type ContextType =
  | "artifact" // Generated content, files, data
  | "finding" // Research findings, analysis results
  | "decision" // Decision made during collaboration
  | "reference" // Reference to external resources
  | "state" // Current state information
  | "error" // Error information to share
  | "metadata"; // General metadata

export interface SharedContextEntry {
  id: string;
  type: ContextType;
  key: string;
  value: unknown;
  createdBy: string; // Agent ID
  createdByType: AgentType;
  createdAt: Date;
  updatedAt: Date;
  expiresAt?: Date;
  tags: string[];
  metadata: Record<string, unknown>;
}

export interface ContextFilter {
  type?: ContextType | ContextType[];
  keys?: string[];
  tags?: string[];
  createdBy?: string;
  createdByType?: AgentType;
  since?: Date;
}

export interface ContextSnapshot {
  entries: SharedContextEntry[];
  summary: string;
  createdAt: Date;
  version: number;
}

const CONTEXT_PREFIX = "sentinel:shared_context";
const CONTEXT_TTL = 24 * 60 * 60; // 24 hours default

/**
 * SharedContext - Manages shared state between collaborating agents
 */
export class SharedContext {
  private redis: Redis;
  private contextId: string;
  private userId: string;
  private localCache: Map<string, SharedContextEntry>;
  private version: number;
  private subscribers: Set<(entry: SharedContextEntry) => void>;

  constructor(contextId: string, userId: string) {
    this.contextId = contextId;
    this.userId = userId;
    this.localCache = new Map();
    this.version = 0;
    this.subscribers = new Set();

    this.redis = new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: null,
    });
  }

  /**
   * Get the context ID
   */
  getId(): string {
    return this.contextId;
  }

  /**
   * Set a value in the shared context
   */
  async set(
    key: string,
    value: unknown,
    options: {
      type: ContextType;
      agentId: string;
      agentType: AgentType;
      tags?: string[];
      metadata?: Record<string, unknown>;
      ttlSeconds?: number;
    }
  ): Promise<SharedContextEntry> {
    const now = new Date();
    const entry: SharedContextEntry = {
      id: this.generateId(),
      type: options.type,
      key,
      value,
      createdBy: options.agentId,
      createdByType: options.agentType,
      createdAt: now,
      updatedAt: now,
      expiresAt: options.ttlSeconds
        ? new Date(now.getTime() + options.ttlSeconds * 1000)
        : undefined,
      tags: options.tags || [],
      metadata: options.metadata || {},
    };

    // Store in Redis
    const redisKey = this.getRedisKey(key);
    const ttl = options.ttlSeconds || CONTEXT_TTL;
    await this.redis.setex(redisKey, ttl, JSON.stringify(entry));

    // Add to index
    await this.addToIndex(entry);

    // Update local cache
    this.localCache.set(key, entry);
    this.version++;

    // Notify subscribers
    this.notifySubscribers(entry);

    return entry;
  }

  /**
   * Get a value from the shared context
   */
  async get(key: string): Promise<SharedContextEntry | null> {
    // Check local cache first
    if (this.localCache.has(key)) {
      const cached = this.localCache.get(key)!;
      // Check if expired
      if (cached.expiresAt && new Date(cached.expiresAt) < new Date()) {
        this.localCache.delete(key);
      } else {
        return cached;
      }
    }

    // Fetch from Redis
    const redisKey = this.getRedisKey(key);
    const data = await this.redis.get(redisKey);

    if (!data) return null;

    try {
      const entry: SharedContextEntry = JSON.parse(data);

      // Check if expired
      if (entry.expiresAt && new Date(entry.expiresAt) < new Date()) {
        await this.delete(key);
        return null;
      }

      // Update local cache
      this.localCache.set(key, entry);

      return entry;
    } catch (error) {
      console.error("[SharedContext] Error parsing entry:", error);
      return null;
    }
  }

  /**
   * Update an existing entry
   */
  async update(
    key: string,
    value: unknown,
    options: {
      agentId: string;
      agentType: AgentType;
      merge?: boolean; // Merge with existing value if object
      metadata?: Record<string, unknown>;
    }
  ): Promise<SharedContextEntry | null> {
    const existing = await this.get(key);
    if (!existing) return null;

    let newValue = value;
    if (options.merge && typeof existing.value === "object" && typeof value === "object") {
      newValue = { ...(existing.value as object), ...(value as object) };
    }

    const now = new Date();
    const updated: SharedContextEntry = {
      ...existing,
      value: newValue,
      updatedAt: now,
      metadata: {
        ...existing.metadata,
        ...options.metadata,
        lastUpdatedBy: options.agentId,
        lastUpdatedByType: options.agentType,
      },
    };

    // Store in Redis
    const redisKey = this.getRedisKey(key);
    const ttl = await this.redis.ttl(redisKey);
    if (ttl > 0) {
      await this.redis.setex(redisKey, ttl, JSON.stringify(updated));
    } else {
      await this.redis.setex(redisKey, CONTEXT_TTL, JSON.stringify(updated));
    }

    // Update local cache
    this.localCache.set(key, updated);
    this.version++;

    // Notify subscribers
    this.notifySubscribers(updated);

    return updated;
  }

  /**
   * Delete an entry from the context
   */
  async delete(key: string): Promise<boolean> {
    const redisKey = this.getRedisKey(key);
    const deleted = await this.redis.del(redisKey);

    // Remove from index
    await this.removeFromIndex(key);

    // Remove from local cache
    this.localCache.delete(key);
    this.version++;

    return deleted > 0;
  }

  /**
   * Check if a key exists
   */
  async has(key: string): Promise<boolean> {
    if (this.localCache.has(key)) return true;
    const redisKey = this.getRedisKey(key);
    return (await this.redis.exists(redisKey)) === 1;
  }

  /**
   * Get multiple entries by filter
   */
  async query(filter: ContextFilter = {}): Promise<SharedContextEntry[]> {
    const indexKey = this.getIndexKey();
    const allKeys = await this.redis.smembers(indexKey);

    const entries: SharedContextEntry[] = [];

    for (const key of allKeys) {
      const entry = await this.get(key);
      if (!entry) continue;

      // Apply filters
      if (filter.type) {
        const types = Array.isArray(filter.type) ? filter.type : [filter.type];
        if (!types.includes(entry.type)) continue;
      }

      if (filter.keys && !filter.keys.includes(entry.key)) continue;

      if (filter.tags && filter.tags.length > 0) {
        const hasTag = filter.tags.some((tag) => entry.tags.includes(tag));
        if (!hasTag) continue;
      }

      if (filter.createdBy && entry.createdBy !== filter.createdBy) continue;

      if (filter.createdByType && entry.createdByType !== filter.createdByType)
        continue;

      if (filter.since && new Date(entry.createdAt) < filter.since) continue;

      entries.push(entry);
    }

    // Sort by creation date, newest first
    return entries.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  /**
   * Get all keys in the context
   */
  async keys(): Promise<string[]> {
    const indexKey = this.getIndexKey();
    return await this.redis.smembers(indexKey);
  }

  /**
   * Get the number of entries in the context
   */
  async size(): Promise<number> {
    const indexKey = this.getIndexKey();
    return await this.redis.scard(indexKey);
  }

  /**
   * Clear all entries in the context
   */
  async clear(): Promise<void> {
    const keys = await this.keys();
    for (const key of keys) {
      await this.delete(key);
    }
    this.localCache.clear();
    this.version = 0;
  }

  /**
   * Create a snapshot of the current context
   */
  async snapshot(): Promise<ContextSnapshot> {
    const entries = await this.query();

    // Generate summary
    const typeCounts: Record<string, number> = {};
    for (const entry of entries) {
      typeCounts[entry.type] = (typeCounts[entry.type] || 0) + 1;
    }

    const summary = Object.entries(typeCounts)
      .map(([type, count]) => `${count} ${type}(s)`)
      .join(", ");

    return {
      entries,
      summary: summary || "Empty context",
      createdAt: new Date(),
      version: this.version,
    };
  }

  /**
   * Restore from a snapshot
   */
  async restore(
    snapshot: ContextSnapshot,
    options: {
      agentId: string;
      agentType: AgentType;
      clearFirst?: boolean;
    }
  ): Promise<void> {
    if (options.clearFirst) {
      await this.clear();
    }

    for (const entry of snapshot.entries) {
      await this.set(entry.key, entry.value, {
        type: entry.type,
        agentId: options.agentId,
        agentType: options.agentType,
        tags: entry.tags,
        metadata: {
          ...entry.metadata,
          restoredFrom: snapshot.version,
          restoredAt: new Date().toISOString(),
        },
      });
    }
  }

  /**
   * Subscribe to context changes
   */
  subscribe(callback: (entry: SharedContextEntry) => void): () => void {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }

  /**
   * Export context as a structured object for agent consumption
   */
  async toAgentContext(): Promise<Record<string, unknown>> {
    const entries = await this.query();

    const context: Record<string, unknown> = {
      _meta: {
        contextId: this.contextId,
        version: this.version,
        entryCount: entries.length,
        exportedAt: new Date().toISOString(),
      },
    };

    // Group by type
    for (const entry of entries) {
      const typeKey = `${entry.type}s`;
      if (!context[typeKey]) {
        context[typeKey] = {};
      }
      (context[typeKey] as Record<string, unknown>)[entry.key] = {
        value: entry.value,
        createdBy: entry.createdBy,
        createdByType: entry.createdByType,
        tags: entry.tags,
      };
    }

    return context;
  }

  /**
   * Store an artifact (file content, generated data, etc.)
   */
  async storeArtifact(
    name: string,
    content: unknown,
    options: {
      agentId: string;
      agentType: AgentType;
      contentType?: string;
      tags?: string[];
      metadata?: Record<string, unknown>;
    }
  ): Promise<SharedContextEntry> {
    return this.set(`artifact:${name}`, content, {
      type: "artifact",
      ...options,
      metadata: {
        ...options.metadata,
        contentType: options.contentType || "unknown",
        artifactName: name,
      },
    });
  }

  /**
   * Record a finding (research result, analysis insight, etc.)
   */
  async recordFinding(
    topic: string,
    finding: {
      summary: string;
      details?: string;
      confidence: "high" | "medium" | "low";
      sources?: string[];
    },
    options: {
      agentId: string;
      agentType: AgentType;
      tags?: string[];
    }
  ): Promise<SharedContextEntry> {
    return this.set(`finding:${topic}:${Date.now()}`, finding, {
      type: "finding",
      ...options,
      tags: [...(options.tags || []), topic],
    });
  }

  /**
   * Record a decision made during collaboration
   */
  async recordDecision(
    topic: string,
    decision: {
      choice: string;
      rationale: string;
      alternatives?: string[];
      impact?: string;
    },
    options: {
      agentId: string;
      agentType: AgentType;
      tags?: string[];
    }
  ): Promise<SharedContextEntry> {
    return this.set(`decision:${topic}`, decision, {
      type: "decision",
      ...options,
      tags: [...(options.tags || []), "decision", topic],
    });
  }

  /**
   * Persist important context to long-term memory
   */
  async persistToMemory(
    entries: SharedContextEntry[],
    options: {
      memoryType: "episodic" | "semantic" | "procedural";
      importance: number;
    }
  ): Promise<void> {
    for (const entry of entries) {
      const content = JSON.stringify({
        type: entry.type,
        key: entry.key,
        value: entry.value,
        createdByType: entry.createdByType,
        tags: entry.tags,
      });

      await db.insert(memories).values({
        userId: this.userId,
        type: options.memoryType,
        content,
        importance: options.importance,
        source: `shared_context:${this.contextId}`,
        metadata: {
          contextId: this.contextId,
          entryId: entry.id,
          entryType: entry.type,
          entryKey: entry.key,
        } as Record<string, unknown>,
      } as typeof memories.$inferInsert);
    }

    metric.memoryOperation("store", entries.length);
  }

  /**
   * Disconnect and cleanup
   */
  async disconnect(): Promise<void> {
    this.localCache.clear();
    this.subscribers.clear();
    this.redis.disconnect();
  }

  // Private methods

  private getRedisKey(key: string): string {
    return `${CONTEXT_PREFIX}:${this.contextId}:entry:${key}`;
  }

  private getIndexKey(): string {
    return `${CONTEXT_PREFIX}:${this.contextId}:index`;
  }

  private async addToIndex(entry: SharedContextEntry): Promise<void> {
    const indexKey = this.getIndexKey();
    await this.redis.sadd(indexKey, entry.key);
    await this.redis.expire(indexKey, CONTEXT_TTL);
  }

  private async removeFromIndex(key: string): Promise<void> {
    const indexKey = this.getIndexKey();
    await this.redis.srem(indexKey, key);
  }

  private notifySubscribers(entry: SharedContextEntry): void {
    this.subscribers.forEach((callback) => {
      try {
        callback(entry);
      } catch (error) {
        console.error("[SharedContext] Subscriber error:", error);
      }
    });
  }

  private generateId(): string {
    return `ctx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

/**
 * Context manager for creating and managing shared contexts
 */
export class ContextManager {
  private contexts: Map<string, SharedContext>;
  private redis: Redis;

  constructor() {
    this.contexts = new Map();
    this.redis = new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: null,
    });
  }

  /**
   * Create a new shared context
   */
  createContext(contextId: string, userId: string): SharedContext {
    if (this.contexts.has(contextId)) {
      return this.contexts.get(contextId)!;
    }

    const context = new SharedContext(contextId, userId);
    this.contexts.set(contextId, context);
    return context;
  }

  /**
   * Get an existing context
   */
  getContext(contextId: string): SharedContext | undefined {
    return this.contexts.get(contextId);
  }

  /**
   * Check if a context exists
   */
  hasContext(contextId: string): boolean {
    return this.contexts.has(contextId);
  }

  /**
   * Remove a context
   */
  async removeContext(contextId: string): Promise<void> {
    const context = this.contexts.get(contextId);
    if (context) {
      await context.disconnect();
      this.contexts.delete(contextId);
    }
  }

  /**
   * Get all active context IDs
   */
  getActiveContextIds(): string[] {
    return Array.from(this.contexts.keys());
  }

  /**
   * Cleanup all contexts
   */
  async cleanup(): Promise<void> {
    const contextArray = Array.from(this.contexts.values());
    for (const context of contextArray) {
      await context.disconnect();
    }
    this.contexts.clear();
    this.redis.disconnect();
  }
}

// Shared context manager instance
export const contextManager = new ContextManager();

// Factory function to create or get a shared context
export function getOrCreateContext(
  contextId: string,
  userId: string
): SharedContext {
  return contextManager.createContext(contextId, userId);
}

export default {
  SharedContext,
  ContextManager,
  contextManager,
  getOrCreateContext,
};
