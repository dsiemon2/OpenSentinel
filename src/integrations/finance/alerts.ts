/**
 * Price alerts for stocks and crypto
 * Stores alerts in PostgreSQL and checks them periodically
 */

import { db } from "../../db";
import {
  pgTable,
  text,
  timestamp,
  uuid,
  numeric,
  boolean,
  integer,
  index,
  jsonb,
} from "drizzle-orm/pg-core";
import { eq, and, desc, lt, gt, or, isNull } from "drizzle-orm";
import { CryptoClient } from "./crypto";
import { StockClient, StockClientConfig } from "./stocks";

// Database schema for alerts
export const priceAlerts = pgTable(
  "price_alerts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull(),
    assetType: text("asset_type").notNull().$type<"crypto" | "stock" | "currency">(),
    symbol: text("symbol").notNull(),
    name: text("name"),
    alertType: text("alert_type")
      .notNull()
      .$type<"above" | "below" | "percent_change" | "percent_gain" | "percent_loss">(),
    targetPrice: numeric("target_price", { precision: 20, scale: 8 }),
    targetPercent: numeric("target_percent", { precision: 10, scale: 4 }),
    basePrice: numeric("base_price", { precision: 20, scale: 8 }), // Reference price for percent alerts
    currentPrice: numeric("current_price", { precision: 20, scale: 8 }),
    enabled: boolean("enabled").default(true),
    triggered: boolean("triggered").default(false),
    triggeredAt: timestamp("triggered_at"),
    repeatCount: integer("repeat_count").default(0), // How many times it can trigger
    repeatInterval: integer("repeat_interval"), // Minutes between repeat triggers
    lastTriggeredAt: timestamp("last_triggered_at"),
    notificationMethod: text("notification_method").$type<"telegram" | "email" | "webhook">(),
    notificationConfig: jsonb("notification_config"),
    notes: text("notes"),
    expiresAt: timestamp("expires_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("price_alerts_user_idx").on(table.userId),
    index("price_alerts_symbol_idx").on(table.symbol),
    index("price_alerts_enabled_idx").on(table.enabled),
  ]
);

export const alertHistory = pgTable(
  "alert_history",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    alertId: uuid("alert_id")
      .references(() => priceAlerts.id)
      .notNull(),
    userId: uuid("user_id").notNull(),
    symbol: text("symbol").notNull(),
    triggerPrice: numeric("trigger_price", { precision: 20, scale: 8 }).notNull(),
    targetPrice: numeric("target_price", { precision: 20, scale: 8 }),
    targetPercent: numeric("target_percent", { precision: 10, scale: 4 }),
    alertType: text("alert_type").notNull(),
    notificationSent: boolean("notification_sent").default(false),
    notificationError: text("notification_error"),
    triggeredAt: timestamp("triggered_at").defaultNow().notNull(),
  },
  (table) => [
    index("alert_history_user_idx").on(table.userId),
    index("alert_history_alert_idx").on(table.alertId),
  ]
);

export type PriceAlert = typeof priceAlerts.$inferSelect;
export type NewPriceAlert = typeof priceAlerts.$inferInsert;
export type AlertHistoryEntry = typeof alertHistory.$inferSelect;

export interface TriggeredAlert {
  alert: PriceAlert;
  currentPrice: number;
  message: string;
}

export interface AlertCheckResult {
  checked: number;
  triggered: TriggeredAlert[];
  errors: Array<{ alertId: string; error: string }>;
}

export class AlertManagerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AlertManagerError";
  }
}

export interface AlertManagerConfig {
  alphaVantageApiKey?: string;
  cryptoClientOptions?: { timeout?: number; rateLimitDelay?: number };
  stockClientOptions?: StockClientConfig;
  onAlertTriggered?: (alert: TriggeredAlert) => Promise<void>;
}

export class AlertManager {
  private cryptoClient: CryptoClient;
  private stockClient: StockClient;
  private onAlertTriggered?: (alert: TriggeredAlert) => Promise<void>;
  private checkInterval: NodeJS.Timer | null = null;

  constructor(config: AlertManagerConfig = {}) {
    this.cryptoClient = new CryptoClient(config.cryptoClientOptions);
    this.stockClient = new StockClient({
      alphaVantageApiKey: config.alphaVantageApiKey,
      ...config.stockClientOptions,
    });
    this.onAlertTriggered = config.onAlertTriggered;
  }

  /**
   * Create a new price alert
   */
  async createAlert(
    userId: string,
    alert: {
      assetType: "crypto" | "stock" | "currency";
      symbol: string;
      name?: string;
      alertType: "above" | "below" | "percent_change" | "percent_gain" | "percent_loss";
      targetPrice?: number;
      targetPercent?: number;
      basePrice?: number;
      repeatCount?: number;
      repeatInterval?: number;
      notificationMethod?: "telegram" | "email" | "webhook";
      notificationConfig?: Record<string, unknown>;
      notes?: string;
      expiresAt?: Date;
    }
  ): Promise<PriceAlert> {
    // Validate alert configuration
    if (alert.alertType === "above" || alert.alertType === "below") {
      if (!alert.targetPrice) {
        throw new AlertManagerError("Target price is required for price alerts");
      }
    } else if (
      alert.alertType === "percent_change" ||
      alert.alertType === "percent_gain" ||
      alert.alertType === "percent_loss"
    ) {
      if (!alert.targetPercent) {
        throw new AlertManagerError("Target percent is required for percent alerts");
      }
    }

    // Get current price to use as base if not provided
    let currentPrice = 0;
    let basePrice = alert.basePrice;

    try {
      if (alert.assetType === "crypto") {
        const prices = await this.cryptoClient.getPrice(alert.symbol);
        const priceData = prices[alert.symbol.toLowerCase()];
        currentPrice = priceData?.price ?? 0;
      } else if (alert.assetType === "stock") {
        const quote = await this.stockClient.getQuote(alert.symbol);
        currentPrice = quote.price;
      }

      if (!basePrice) {
        basePrice = currentPrice;
      }
    } catch (error) {
      console.error(`Error getting current price for ${alert.symbol}:`, error);
    }

    const [newAlert] = await db
      .insert(priceAlerts)
      .values({
        userId,
        assetType: alert.assetType,
        symbol: alert.symbol.toUpperCase(),
        name: alert.name,
        alertType: alert.alertType,
        targetPrice: alert.targetPrice ? String(alert.targetPrice) : null,
        targetPercent: alert.targetPercent ? String(alert.targetPercent) : null,
        basePrice: basePrice ? String(basePrice) : null,
        currentPrice: currentPrice ? String(currentPrice) : null,
        repeatCount: alert.repeatCount ?? 0,
        repeatInterval: alert.repeatInterval,
        notificationMethod: alert.notificationMethod,
        notificationConfig: alert.notificationConfig,
        notes: alert.notes,
        expiresAt: alert.expiresAt,
      })
      .returning();

    return newAlert;
  }

  /**
   * Create a simple "price above" alert
   */
  async createPriceAboveAlert(
    userId: string,
    assetType: "crypto" | "stock",
    symbol: string,
    targetPrice: number,
    options?: { notes?: string; expiresAt?: Date }
  ): Promise<PriceAlert> {
    return this.createAlert(userId, {
      assetType,
      symbol,
      alertType: "above",
      targetPrice,
      ...options,
    });
  }

  /**
   * Create a simple "price below" alert
   */
  async createPriceBelowAlert(
    userId: string,
    assetType: "crypto" | "stock",
    symbol: string,
    targetPrice: number,
    options?: { notes?: string; expiresAt?: Date }
  ): Promise<PriceAlert> {
    return this.createAlert(userId, {
      assetType,
      symbol,
      alertType: "below",
      targetPrice,
      ...options,
    });
  }

  /**
   * Create a percent change alert
   */
  async createPercentChangeAlert(
    userId: string,
    assetType: "crypto" | "stock",
    symbol: string,
    percentChange: number,
    direction: "any" | "up" | "down" = "any",
    options?: { notes?: string; expiresAt?: Date }
  ): Promise<PriceAlert> {
    let alertType: "percent_change" | "percent_gain" | "percent_loss" = "percent_change";
    if (direction === "up") alertType = "percent_gain";
    if (direction === "down") alertType = "percent_loss";

    return this.createAlert(userId, {
      assetType,
      symbol,
      alertType,
      targetPercent: Math.abs(percentChange),
      ...options,
    });
  }

  /**
   * Get all alerts for a user
   */
  async getAlerts(
    userId: string,
    options?: {
      enabled?: boolean;
      assetType?: "crypto" | "stock" | "currency";
      symbol?: string;
    }
  ): Promise<PriceAlert[]> {
    let conditions = [eq(priceAlerts.userId, userId)];

    if (options?.enabled !== undefined) {
      conditions.push(eq(priceAlerts.enabled, options.enabled));
    }

    if (options?.assetType) {
      conditions.push(eq(priceAlerts.assetType, options.assetType));
    }

    if (options?.symbol) {
      conditions.push(eq(priceAlerts.symbol, options.symbol.toUpperCase()));
    }

    return db
      .select()
      .from(priceAlerts)
      .where(and(...conditions))
      .orderBy(desc(priceAlerts.createdAt));
  }

  /**
   * Get a specific alert
   */
  async getAlert(userId: string, alertId: string): Promise<PriceAlert | null> {
    const result = await db
      .select()
      .from(priceAlerts)
      .where(
        and(
          eq(priceAlerts.id, alertId),
          eq(priceAlerts.userId, userId)
        )
      )
      .limit(1);

    return result[0] ?? null;
  }

  /**
   * Update an alert
   */
  async updateAlert(
    userId: string,
    alertId: string,
    updates: {
      enabled?: boolean;
      targetPrice?: number;
      targetPercent?: number;
      notes?: string;
      expiresAt?: Date | null;
    }
  ): Promise<PriceAlert | null> {
    const alert = await this.getAlert(userId, alertId);
    if (!alert) return null;

    const updateValues: Partial<NewPriceAlert> = {
      updatedAt: new Date(),
    };

    if (updates.enabled !== undefined) updateValues.enabled = updates.enabled;
    if (updates.targetPrice !== undefined) updateValues.targetPrice = String(updates.targetPrice);
    if (updates.targetPercent !== undefined) updateValues.targetPercent = String(updates.targetPercent);
    if (updates.notes !== undefined) updateValues.notes = updates.notes;
    if (updates.expiresAt !== undefined) updateValues.expiresAt = updates.expiresAt ?? undefined;

    const [updated] = await db
      .update(priceAlerts)
      .set(updateValues)
      .where(eq(priceAlerts.id, alertId))
      .returning();

    return updated;
  }

  /**
   * Delete an alert
   */
  async deleteAlert(userId: string, alertId: string): Promise<boolean> {
    const result = await db
      .delete(priceAlerts)
      .where(
        and(
          eq(priceAlerts.id, alertId),
          eq(priceAlerts.userId, userId)
        )
      )
      .returning();

    return result.length > 0;
  }

  /**
   * Enable/disable an alert
   */
  async toggleAlert(userId: string, alertId: string, enabled: boolean): Promise<PriceAlert | null> {
    return this.updateAlert(userId, alertId, { enabled });
  }

  /**
   * Check all enabled alerts and trigger if conditions are met
   */
  async checkAlerts(): Promise<AlertCheckResult> {
    const result: AlertCheckResult = {
      checked: 0,
      triggered: [],
      errors: [],
    };

    // Get all enabled, non-expired alerts
    const alerts = await db
      .select()
      .from(priceAlerts)
      .where(
        and(
          eq(priceAlerts.enabled, true),
          or(
            isNull(priceAlerts.expiresAt),
            gt(priceAlerts.expiresAt, new Date())
          )
        )
      );

    result.checked = alerts.length;

    // Group by asset type for batch pricing
    const cryptoAlerts = alerts.filter((a) => a.assetType === "crypto");
    const stockAlerts = alerts.filter((a) => a.assetType === "stock");

    // Check crypto alerts
    if (cryptoAlerts.length > 0) {
      const symbols = [...new Set(cryptoAlerts.map((a) => a.symbol.toLowerCase()))];
      try {
        const prices = await this.cryptoClient.getPrice(symbols);

        for (const alert of cryptoAlerts) {
          const priceData = prices[alert.symbol.toLowerCase()];
          if (priceData) {
            const triggered = await this.evaluateAlert(alert, priceData.price);
            if (triggered) {
              result.triggered.push(triggered);
            }
          }
        }
      } catch (error) {
        console.error("Error fetching crypto prices:", error);
        for (const alert of cryptoAlerts) {
          result.errors.push({
            alertId: alert.id,
            error: `Failed to fetch price for ${alert.symbol}`,
          });
        }
      }
    }

    // Check stock alerts
    for (const alert of stockAlerts) {
      try {
        const quote = await this.stockClient.getQuote(alert.symbol);
        const triggered = await this.evaluateAlert(alert, quote.price);
        if (triggered) {
          result.triggered.push(triggered);
        }
      } catch (error) {
        result.errors.push({
          alertId: alert.id,
          error: `Failed to fetch price for ${alert.symbol}`,
        });
      }
    }

    return result;
  }

  /**
   * Evaluate a single alert against current price
   */
  private async evaluateAlert(
    alert: PriceAlert,
    currentPrice: number
  ): Promise<TriggeredAlert | null> {
    const targetPrice = alert.targetPrice ? parseFloat(alert.targetPrice) : 0;
    const targetPercent = alert.targetPercent ? parseFloat(alert.targetPercent) : 0;
    const basePrice = alert.basePrice ? parseFloat(alert.basePrice) : 0;

    let shouldTrigger = false;
    let message = "";

    switch (alert.alertType) {
      case "above":
        shouldTrigger = currentPrice >= targetPrice;
        message = `${alert.symbol} has risen above $${targetPrice.toFixed(2)}. Current price: $${currentPrice.toFixed(2)}`;
        break;

      case "below":
        shouldTrigger = currentPrice <= targetPrice;
        message = `${alert.symbol} has fallen below $${targetPrice.toFixed(2)}. Current price: $${currentPrice.toFixed(2)}`;
        break;

      case "percent_change":
        if (basePrice > 0) {
          const percentChange = Math.abs(((currentPrice - basePrice) / basePrice) * 100);
          shouldTrigger = percentChange >= targetPercent;
          const direction = currentPrice >= basePrice ? "up" : "down";
          message = `${alert.symbol} has moved ${direction} ${percentChange.toFixed(2)}% from $${basePrice.toFixed(2)}. Current price: $${currentPrice.toFixed(2)}`;
        }
        break;

      case "percent_gain":
        if (basePrice > 0) {
          const percentGain = ((currentPrice - basePrice) / basePrice) * 100;
          shouldTrigger = percentGain >= targetPercent;
          message = `${alert.symbol} has gained ${percentGain.toFixed(2)}% from $${basePrice.toFixed(2)}. Current price: $${currentPrice.toFixed(2)}`;
        }
        break;

      case "percent_loss":
        if (basePrice > 0) {
          const percentLoss = ((basePrice - currentPrice) / basePrice) * 100;
          shouldTrigger = percentLoss >= targetPercent;
          message = `${alert.symbol} has lost ${percentLoss.toFixed(2)}% from $${basePrice.toFixed(2)}. Current price: $${currentPrice.toFixed(2)}`;
        }
        break;
    }

    if (!shouldTrigger) {
      // Update current price
      await db
        .update(priceAlerts)
        .set({ currentPrice: String(currentPrice), updatedAt: new Date() })
        .where(eq(priceAlerts.id, alert.id));
      return null;
    }

    // Check if we should trigger based on repeat settings
    if (alert.triggered && alert.repeatCount === 0) {
      return null; // Already triggered and no repeats allowed
    }

    if (alert.lastTriggeredAt && alert.repeatInterval) {
      const timeSinceLastTrigger = Date.now() - alert.lastTriggeredAt.getTime();
      const minInterval = alert.repeatInterval * 60 * 1000; // Convert minutes to ms
      if (timeSinceLastTrigger < minInterval) {
        return null; // Not enough time has passed
      }
    }

    // Trigger the alert
    const now = new Date();
    await db
      .update(priceAlerts)
      .set({
        triggered: true,
        triggeredAt: alert.triggered ? alert.triggeredAt : now,
        lastTriggeredAt: now,
        currentPrice: String(currentPrice),
        repeatCount: alert.repeatCount ? alert.repeatCount - 1 : 0,
        enabled: alert.repeatCount === 1 ? false : alert.enabled, // Disable if last repeat
        updatedAt: now,
      })
      .where(eq(priceAlerts.id, alert.id));

    // Record in history
    await db.insert(alertHistory).values({
      alertId: alert.id,
      userId: alert.userId,
      symbol: alert.symbol,
      triggerPrice: String(currentPrice),
      targetPrice: alert.targetPrice,
      targetPercent: alert.targetPercent,
      alertType: alert.alertType,
    });

    const triggeredAlert: TriggeredAlert = {
      alert,
      currentPrice,
      message,
    };

    // Call notification callback if provided
    if (this.onAlertTriggered) {
      try {
        await this.onAlertTriggered(triggeredAlert);
      } catch (error) {
        console.error("Error in alert callback:", error);
      }
    }

    return triggeredAlert;
  }

  /**
   * Get alert history for a user
   */
  async getAlertHistory(
    userId: string,
    options?: { alertId?: string; limit?: number }
  ): Promise<AlertHistoryEntry[]> {
    let query = db
      .select()
      .from(alertHistory)
      .where(eq(alertHistory.userId, userId))
      .orderBy(desc(alertHistory.triggeredAt));

    if (options?.limit) {
      query = query.limit(options.limit) as typeof query;
    }

    const results = await query;

    if (options?.alertId) {
      return results.filter((h) => h.alertId === options.alertId);
    }

    return results;
  }

  /**
   * Start automatic alert checking
   */
  startAutoCheck(intervalMinutes: number = 5): void {
    if (this.checkInterval) {
      this.stopAutoCheck();
    }

    const intervalMs = intervalMinutes * 60 * 1000;
    this.checkInterval = setInterval(async () => {
      try {
        const result = await this.checkAlerts();
        if (result.triggered.length > 0) {
          console.log(`Triggered ${result.triggered.length} alerts`);
        }
      } catch (error) {
        console.error("Error checking alerts:", error);
      }
    }, intervalMs);

    // Run an initial check
    this.checkAlerts().catch(console.error);
  }

  /**
   * Stop automatic alert checking
   */
  stopAutoCheck(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  /**
   * Get formatted alert summary
   */
  async getFormattedAlertSummary(userId: string): Promise<string> {
    const alerts = await this.getAlerts(userId, { enabled: true });

    if (alerts.length === 0) {
      return "No active price alerts.";
    }

    let summary = `Active Price Alerts (${alerts.length})\n`;
    summary += "================================\n\n";

    for (const alert of alerts) {
      const targetValue =
        alert.alertType === "above" || alert.alertType === "below"
          ? `$${parseFloat(alert.targetPrice ?? "0").toFixed(2)}`
          : `${parseFloat(alert.targetPercent ?? "0").toFixed(2)}%`;

      const currentPrice = alert.currentPrice
        ? `$${parseFloat(alert.currentPrice).toFixed(2)}`
        : "N/A";

      summary += `${alert.symbol} (${alert.assetType})\n`;
      summary += `  Type: ${alert.alertType.replace("_", " ")}\n`;
      summary += `  Target: ${targetValue}\n`;
      summary += `  Current: ${currentPrice}\n`;
      if (alert.notes) summary += `  Notes: ${alert.notes}\n`;
      summary += "\n";
    }

    return summary;
  }
}

export function createAlertManager(config: AlertManagerConfig = {}): AlertManager {
  return new AlertManager(config);
}

export default AlertManager;
