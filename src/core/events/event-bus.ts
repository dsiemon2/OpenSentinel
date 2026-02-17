/**
 * Type-safe Event Bus with History
 * Ported from Ecom-Sales to OpenSentinel
 *
 * Features:
 * - Type-safe pub/sub with generic event types
 * - Event history with replay capability
 * - Priority-based handler ordering
 * - Wildcard subscriptions
 * - Dead letter queue for failed handlers
 * - Middleware support for event transformation
 */

export interface EventEnvelope<T = unknown> {
  id: string;
  type: string;
  payload: T;
  timestamp: Date;
  source?: string;
  userId?: string;
  metadata?: Record<string, unknown>;
}

export type EventHandler<T = unknown> = (
  event: EventEnvelope<T>
) => Promise<void> | void;

export type EventMiddleware = (
  event: EventEnvelope,
  next: () => Promise<void>
) => Promise<void>;

interface Subscription {
  id: string;
  pattern: string;
  handler: EventHandler;
  priority: number;
  once: boolean;
}

interface DeadLetterEntry {
  event: EventEnvelope;
  error: string;
  handlerId: string;
  timestamp: Date;
}

/**
 * Event Bus
 */
export class EventBus {
  private subscriptions = new Map<string, Subscription[]>();
  private wildcardSubscriptions: Subscription[] = [];
  private history: EventEnvelope[] = [];
  private deadLetters: DeadLetterEntry[] = [];
  private middleware: EventMiddleware[] = [];
  private maxHistory: number;
  private maxDeadLetters: number;
  private subIdCounter = 0;
  private eventIdCounter = 0;

  constructor(options: { maxHistory?: number; maxDeadLetters?: number } = {}) {
    this.maxHistory = options.maxHistory ?? 1000;
    this.maxDeadLetters = options.maxDeadLetters ?? 500;
  }

  /**
   * Subscribe to events of a specific type
   */
  on<T = unknown>(
    eventType: string,
    handler: EventHandler<T>,
    options: { priority?: number } = {}
  ): string {
    const id = `sub_${++this.subIdCounter}`;
    const subscription: Subscription = {
      id,
      pattern: eventType,
      handler: handler as EventHandler,
      priority: options.priority ?? 0,
      once: false,
    };

    if (eventType === "*" || eventType.endsWith(".*")) {
      this.wildcardSubscriptions.push(subscription);
      this.wildcardSubscriptions.sort((a, b) => b.priority - a.priority);
    } else {
      const existing = this.subscriptions.get(eventType) || [];
      existing.push(subscription);
      existing.sort((a, b) => b.priority - a.priority);
      this.subscriptions.set(eventType, existing);
    }

    return id;
  }

  /**
   * Subscribe to a single event occurrence
   */
  once<T = unknown>(
    eventType: string,
    handler: EventHandler<T>,
    options: { priority?: number } = {}
  ): string {
    const id = `sub_${++this.subIdCounter}`;
    const subscription: Subscription = {
      id,
      pattern: eventType,
      handler: handler as EventHandler,
      priority: options.priority ?? 0,
      once: true,
    };

    const existing = this.subscriptions.get(eventType) || [];
    existing.push(subscription);
    existing.sort((a, b) => b.priority - a.priority);
    this.subscriptions.set(eventType, existing);

    return id;
  }

  /**
   * Unsubscribe by subscription ID
   */
  off(subscriptionId: string): boolean {
    // Check exact subscriptions
    for (const [type, subs] of this.subscriptions) {
      const idx = subs.findIndex((s) => s.id === subscriptionId);
      if (idx !== -1) {
        subs.splice(idx, 1);
        if (subs.length === 0) this.subscriptions.delete(type);
        return true;
      }
    }

    // Check wildcard subscriptions
    const wcIdx = this.wildcardSubscriptions.findIndex(
      (s) => s.id === subscriptionId
    );
    if (wcIdx !== -1) {
      this.wildcardSubscriptions.splice(wcIdx, 1);
      return true;
    }

    return false;
  }

  /**
   * Add middleware for event processing
   */
  use(middleware: EventMiddleware): void {
    this.middleware.push(middleware);
  }

  /**
   * Emit an event
   */
  async emit<T = unknown>(
    eventType: string,
    payload: T,
    options: {
      source?: string;
      userId?: string;
      metadata?: Record<string, unknown>;
    } = {}
  ): Promise<void> {
    const event: EventEnvelope<T> = {
      id: `evt_${++this.eventIdCounter}`,
      type: eventType,
      payload,
      timestamp: new Date(),
      source: options.source,
      userId: options.userId,
      metadata: options.metadata,
    };

    // Add to history
    this.history.push(event as EventEnvelope);
    if (this.history.length > this.maxHistory) {
      this.history = this.history.slice(-this.maxHistory);
    }

    // Run middleware chain
    const runMiddleware = async (idx: number): Promise<void> => {
      if (idx >= this.middleware.length) {
        await this.dispatch(event as EventEnvelope);
        return;
      }
      await this.middleware[idx](event as EventEnvelope, () =>
        runMiddleware(idx + 1)
      );
    };

    await runMiddleware(0);
  }

  private async dispatch(event: EventEnvelope): Promise<void> {
    const handlers: Subscription[] = [];

    // Exact match subscriptions
    const exact = this.subscriptions.get(event.type) || [];
    handlers.push(...exact);

    // Wildcard subscriptions
    for (const sub of this.wildcardSubscriptions) {
      if (sub.pattern === "*") {
        handlers.push(sub);
      } else if (sub.pattern.endsWith(".*")) {
        const prefix = sub.pattern.slice(0, -2);
        if (event.type.startsWith(prefix)) {
          handlers.push(sub);
        }
      }
    }

    // Sort by priority
    handlers.sort((a, b) => b.priority - a.priority);

    // Execute handlers
    const toRemove: string[] = [];
    for (const handler of handlers) {
      try {
        await handler.handler(event);
        if (handler.once) toRemove.push(handler.id);
      } catch (error) {
        this.deadLetters.push({
          event,
          error: error instanceof Error ? error.message : String(error),
          handlerId: handler.id,
          timestamp: new Date(),
        });
        if (this.deadLetters.length > this.maxDeadLetters) {
          this.deadLetters = this.deadLetters.slice(-this.maxDeadLetters);
        }
      }
    }

    // Remove once-handlers
    for (const id of toRemove) {
      this.off(id);
    }
  }

  /**
   * Replay events from history
   */
  async replay(
    filter?: {
      eventType?: string;
      since?: Date;
      until?: Date;
      userId?: string;
    }
  ): Promise<number> {
    let events = [...this.history];

    if (filter?.eventType) {
      events = events.filter((e) => e.type === filter.eventType);
    }
    if (filter?.since) {
      events = events.filter((e) => e.timestamp >= filter.since!);
    }
    if (filter?.until) {
      events = events.filter((e) => e.timestamp <= filter.until!);
    }
    if (filter?.userId) {
      events = events.filter((e) => e.userId === filter.userId);
    }

    for (const event of events) {
      await this.dispatch(event);
    }

    return events.length;
  }

  /**
   * Get event history
   */
  getHistory(limit = 100): EventEnvelope[] {
    return this.history.slice(-limit);
  }

  /**
   * Get dead letter queue
   */
  getDeadLetters(limit = 50): DeadLetterEntry[] {
    return this.deadLetters.slice(-limit);
  }

  /**
   * Clear dead letter queue
   */
  clearDeadLetters(): void {
    this.deadLetters = [];
  }

  /**
   * Get statistics
   */
  getStats(): {
    totalSubscriptions: number;
    totalWildcardSubscriptions: number;
    historySize: number;
    deadLetterSize: number;
    eventTypes: string[];
  } {
    const eventTypes = new Set<string>();
    for (const event of this.history) {
      eventTypes.add(event.type);
    }

    let totalSubs = 0;
    for (const subs of this.subscriptions.values()) {
      totalSubs += subs.length;
    }

    return {
      totalSubscriptions: totalSubs,
      totalWildcardSubscriptions: this.wildcardSubscriptions.length,
      historySize: this.history.length,
      deadLetterSize: this.deadLetters.length,
      eventTypes: Array.from(eventTypes),
    };
  }

  /**
   * Remove all subscriptions
   */
  removeAllListeners(eventType?: string): void {
    if (eventType) {
      this.subscriptions.delete(eventType);
    } else {
      this.subscriptions.clear();
      this.wildcardSubscriptions = [];
    }
  }
}

/** Global event bus instance */
export const eventBus = new EventBus();
