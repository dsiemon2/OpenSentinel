/**
 * Portfolio tracking for stocks and crypto
 * Stores holdings in PostgreSQL database
 */

import { db } from "../../db";
import {
  pgTable,
  text,
  timestamp,
  uuid,
  numeric,
  integer,
  index,
} from "drizzle-orm/pg-core";
import { eq, and, desc, sql } from "drizzle-orm";
import { CryptoClient } from "./crypto";
import { StockClient, StockClientConfig } from "./stocks";

// Database schema for portfolio
export const portfolioHoldings = pgTable(
  "portfolio_holdings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull(),
    assetType: text("asset_type").notNull().$type<"crypto" | "stock">(),
    symbol: text("symbol").notNull(),
    name: text("name"),
    quantity: numeric("quantity", { precision: 20, scale: 8 }).notNull(),
    averageCost: numeric("average_cost", { precision: 20, scale: 8 }),
    currency: text("currency").default("USD"),
    notes: text("notes"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("portfolio_holdings_user_idx").on(table.userId),
    index("portfolio_holdings_symbol_idx").on(table.symbol),
  ]
);

export const portfolioTransactions = pgTable(
  "portfolio_transactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull(),
    holdingId: uuid("holding_id").references(() => portfolioHoldings.id),
    assetType: text("asset_type").notNull().$type<"crypto" | "stock">(),
    symbol: text("symbol").notNull(),
    transactionType: text("transaction_type")
      .notNull()
      .$type<"buy" | "sell" | "transfer_in" | "transfer_out" | "dividend" | "split">(),
    quantity: numeric("quantity", { precision: 20, scale: 8 }).notNull(),
    price: numeric("price", { precision: 20, scale: 8 }),
    totalValue: numeric("total_value", { precision: 20, scale: 8 }),
    fees: numeric("fees", { precision: 20, scale: 8 }),
    currency: text("currency").default("USD"),
    notes: text("notes"),
    transactionDate: timestamp("transaction_date").defaultNow().notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("portfolio_transactions_user_idx").on(table.userId),
    index("portfolio_transactions_holding_idx").on(table.holdingId),
    index("portfolio_transactions_date_idx").on(table.transactionDate),
  ]
);

export type PortfolioHolding = typeof portfolioHoldings.$inferSelect;
export type NewPortfolioHolding = typeof portfolioHoldings.$inferInsert;
export type PortfolioTransaction = typeof portfolioTransactions.$inferSelect;
export type NewPortfolioTransaction = typeof portfolioTransactions.$inferInsert;

export interface HoldingWithValue extends PortfolioHolding {
  currentPrice: number;
  currentValue: number;
  totalCost: number;
  profitLoss: number;
  profitLossPercent: number;
  change24h: number;
  changePercent24h: number;
}

export interface PortfolioSummary {
  totalValue: number;
  totalCost: number;
  totalProfitLoss: number;
  totalProfitLossPercent: number;
  holdings: HoldingWithValue[];
  assetAllocation: {
    crypto: { value: number; percent: number };
    stocks: { value: number; percent: number };
  };
  topPerformers: HoldingWithValue[];
  worstPerformers: HoldingWithValue[];
}

export class PortfolioManagerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PortfolioManagerError";
  }
}

export interface PortfolioManagerConfig {
  alphaVantageApiKey?: string;
  cryptoClientOptions?: { timeout?: number; rateLimitDelay?: number };
  stockClientOptions?: StockClientConfig;
}

export class PortfolioManager {
  private cryptoClient: CryptoClient;
  private stockClient: StockClient;

  constructor(config: PortfolioManagerConfig = {}) {
    this.cryptoClient = new CryptoClient(config.cryptoClientOptions);
    this.stockClient = new StockClient({
      alphaVantageApiKey: config.alphaVantageApiKey,
      ...config.stockClientOptions,
    });
  }

  /**
   * Add a new holding to the portfolio
   */
  async addHolding(
    userId: string,
    holding: {
      assetType: "crypto" | "stock";
      symbol: string;
      name?: string;
      quantity: number;
      averageCost?: number;
      currency?: string;
      notes?: string;
    }
  ): Promise<PortfolioHolding> {
    // Check if holding already exists
    const existing = await db
      .select()
      .from(portfolioHoldings)
      .where(
        and(
          eq(portfolioHoldings.userId, userId),
          eq(portfolioHoldings.symbol, holding.symbol.toUpperCase()),
          eq(portfolioHoldings.assetType, holding.assetType)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      // Update existing holding
      const existingHolding = existing[0];
      const existingQty = parseFloat(existingHolding.quantity);
      const existingCost = parseFloat(existingHolding.averageCost ?? "0");
      const newQty = existingQty + holding.quantity;

      // Calculate new average cost
      let newAvgCost = existingCost;
      if (holding.averageCost) {
        const totalCost = existingQty * existingCost + holding.quantity * holding.averageCost;
        newAvgCost = totalCost / newQty;
      }

      const [updated] = await db
        .update(portfolioHoldings)
        .set({
          quantity: String(newQty),
          averageCost: String(newAvgCost),
          updatedAt: new Date(),
        })
        .where(eq(portfolioHoldings.id, existingHolding.id))
        .returning();

      return updated;
    }

    // Create new holding
    const [newHolding] = await db
      .insert(portfolioHoldings)
      .values({
        userId,
        assetType: holding.assetType,
        symbol: holding.symbol.toUpperCase(),
        name: holding.name,
        quantity: String(holding.quantity),
        averageCost: holding.averageCost ? String(holding.averageCost) : null,
        currency: holding.currency ?? "USD",
        notes: holding.notes,
      })
      .returning();

    return newHolding;
  }

  /**
   * Update a holding's quantity
   */
  async updateHolding(
    userId: string,
    holdingId: string,
    updates: {
      quantity?: number;
      averageCost?: number;
      notes?: string;
    }
  ): Promise<PortfolioHolding | null> {
    const holding = await db
      .select()
      .from(portfolioHoldings)
      .where(
        and(
          eq(portfolioHoldings.id, holdingId),
          eq(portfolioHoldings.userId, userId)
        )
      )
      .limit(1);

    if (holding.length === 0) {
      return null;
    }

    const [updated] = await db
      .update(portfolioHoldings)
      .set({
        quantity: updates.quantity !== undefined ? String(updates.quantity) : undefined,
        averageCost: updates.averageCost !== undefined ? String(updates.averageCost) : undefined,
        notes: updates.notes,
        updatedAt: new Date(),
      })
      .where(eq(portfolioHoldings.id, holdingId))
      .returning();

    return updated;
  }

  /**
   * Remove a holding from the portfolio
   */
  async removeHolding(userId: string, holdingId: string): Promise<boolean> {
    const result = await db
      .delete(portfolioHoldings)
      .where(
        and(
          eq(portfolioHoldings.id, holdingId),
          eq(portfolioHoldings.userId, userId)
        )
      )
      .returning();

    return result.length > 0;
  }

  /**
   * Get all holdings for a user
   */
  async getHoldings(userId: string): Promise<PortfolioHolding[]> {
    return db
      .select()
      .from(portfolioHoldings)
      .where(eq(portfolioHoldings.userId, userId))
      .orderBy(desc(portfolioHoldings.updatedAt));
  }

  /**
   * Get a specific holding
   */
  async getHolding(userId: string, holdingId: string): Promise<PortfolioHolding | null> {
    const result = await db
      .select()
      .from(portfolioHoldings)
      .where(
        and(
          eq(portfolioHoldings.id, holdingId),
          eq(portfolioHoldings.userId, userId)
        )
      )
      .limit(1);

    return result[0] ?? null;
  }

  /**
   * Record a transaction
   */
  async recordTransaction(
    userId: string,
    transaction: {
      holdingId?: string;
      assetType: "crypto" | "stock";
      symbol: string;
      transactionType: "buy" | "sell" | "transfer_in" | "transfer_out" | "dividend" | "split";
      quantity: number;
      price?: number;
      fees?: number;
      currency?: string;
      notes?: string;
      transactionDate?: Date;
    }
  ): Promise<PortfolioTransaction> {
    const totalValue = transaction.price
      ? transaction.quantity * transaction.price + (transaction.fees ?? 0)
      : null;

    const [newTransaction] = await db
      .insert(portfolioTransactions)
      .values({
        userId,
        holdingId: transaction.holdingId,
        assetType: transaction.assetType,
        symbol: transaction.symbol.toUpperCase(),
        transactionType: transaction.transactionType,
        quantity: String(transaction.quantity),
        price: transaction.price ? String(transaction.price) : null,
        totalValue: totalValue ? String(totalValue) : null,
        fees: transaction.fees ? String(transaction.fees) : null,
        currency: transaction.currency ?? "USD",
        notes: transaction.notes,
        transactionDate: transaction.transactionDate ?? new Date(),
      })
      .returning();

    // Update holding based on transaction type
    if (transaction.holdingId) {
      const holding = await this.getHolding(userId, transaction.holdingId);
      if (holding) {
        const currentQty = parseFloat(holding.quantity);
        let newQty = currentQty;

        switch (transaction.transactionType) {
          case "buy":
          case "transfer_in":
          case "dividend":
            newQty = currentQty + transaction.quantity;
            break;
          case "sell":
          case "transfer_out":
            newQty = currentQty - transaction.quantity;
            break;
          case "split":
            // For splits, quantity represents the multiplier
            newQty = currentQty * transaction.quantity;
            break;
        }

        await this.updateHolding(userId, transaction.holdingId, {
          quantity: Math.max(0, newQty),
        });
      }
    }

    return newTransaction;
  }

  /**
   * Get transactions for a user
   */
  async getTransactions(
    userId: string,
    options?: {
      holdingId?: string;
      symbol?: string;
      limit?: number;
      offset?: number;
    }
  ): Promise<PortfolioTransaction[]> {
    let query = db
      .select()
      .from(portfolioTransactions)
      .where(eq(portfolioTransactions.userId, userId))
      .orderBy(desc(portfolioTransactions.transactionDate));

    if (options?.limit) {
      query = query.limit(options.limit) as typeof query;
    }
    if (options?.offset) {
      query = query.offset(options.offset) as typeof query;
    }

    const results = await query;

    // Filter in memory for additional conditions
    let filtered = results;
    if (options?.holdingId) {
      filtered = filtered.filter((t) => t.holdingId === options.holdingId);
    }
    if (options?.symbol) {
      const symbol = options.symbol.toUpperCase();
      filtered = filtered.filter((t) => t.symbol === symbol);
    }

    return filtered;
  }

  /**
   * Get holdings with current market values
   */
  async getHoldingsWithValues(userId: string): Promise<HoldingWithValue[]> {
    const holdings = await this.getHoldings(userId);
    const results: HoldingWithValue[] = [];

    // Group by asset type for batch pricing
    const cryptoHoldings = holdings.filter((h) => h.assetType === "crypto");
    const stockHoldings = holdings.filter((h) => h.assetType === "stock");

    // Get crypto prices
    if (cryptoHoldings.length > 0) {
      const cryptoSymbols = cryptoHoldings.map((h) => h.symbol.toLowerCase());
      try {
        const prices = await this.cryptoClient.getPrice(cryptoSymbols);

        for (const holding of cryptoHoldings) {
          const priceData = prices[holding.symbol.toLowerCase()];
          const quantity = parseFloat(holding.quantity);
          const avgCost = parseFloat(holding.averageCost ?? "0");
          const currentPrice = priceData?.price ?? 0;
          const currentValue = quantity * currentPrice;
          const totalCost = quantity * avgCost;
          const profitLoss = currentValue - totalCost;
          const profitLossPercent = totalCost > 0 ? (profitLoss / totalCost) * 100 : 0;

          results.push({
            ...holding,
            currentPrice,
            currentValue,
            totalCost,
            profitLoss,
            profitLossPercent,
            change24h: priceData?.change24h ?? 0,
            changePercent24h: priceData?.change24h ?? 0,
          });
        }
      } catch (error) {
        console.error("Error fetching crypto prices:", error);
        // Add holdings without price data
        for (const holding of cryptoHoldings) {
          const quantity = parseFloat(holding.quantity);
          const avgCost = parseFloat(holding.averageCost ?? "0");
          results.push({
            ...holding,
            currentPrice: 0,
            currentValue: 0,
            totalCost: quantity * avgCost,
            profitLoss: 0,
            profitLossPercent: 0,
            change24h: 0,
            changePercent24h: 0,
          });
        }
      }
    }

    // Get stock prices
    for (const holding of stockHoldings) {
      try {
        const quote = await this.stockClient.getQuote(holding.symbol);
        const quantity = parseFloat(holding.quantity);
        const avgCost = parseFloat(holding.averageCost ?? "0");
        const currentValue = quantity * quote.price;
        const totalCost = quantity * avgCost;
        const profitLoss = currentValue - totalCost;
        const profitLossPercent = totalCost > 0 ? (profitLoss / totalCost) * 100 : 0;

        results.push({
          ...holding,
          currentPrice: quote.price,
          currentValue,
          totalCost,
          profitLoss,
          profitLossPercent,
          change24h: quote.change,
          changePercent24h: quote.changePercent,
        });
      } catch (error) {
        console.error(`Error fetching stock price for ${holding.symbol}:`, error);
        const quantity = parseFloat(holding.quantity);
        const avgCost = parseFloat(holding.averageCost ?? "0");
        results.push({
          ...holding,
          currentPrice: 0,
          currentValue: 0,
          totalCost: quantity * avgCost,
          profitLoss: 0,
          profitLossPercent: 0,
          change24h: 0,
          changePercent24h: 0,
        });
      }
    }

    return results;
  }

  /**
   * Get portfolio summary
   */
  async getPortfolioSummary(userId: string): Promise<PortfolioSummary> {
    const holdings = await this.getHoldingsWithValues(userId);

    const totalValue = holdings.reduce((sum, h) => sum + h.currentValue, 0);
    const totalCost = holdings.reduce((sum, h) => sum + h.totalCost, 0);
    const totalProfitLoss = totalValue - totalCost;
    const totalProfitLossPercent = totalCost > 0 ? (totalProfitLoss / totalCost) * 100 : 0;

    const cryptoValue = holdings
      .filter((h) => h.assetType === "crypto")
      .reduce((sum, h) => sum + h.currentValue, 0);

    const stockValue = holdings
      .filter((h) => h.assetType === "stock")
      .reduce((sum, h) => sum + h.currentValue, 0);

    const sortedByPerformance = [...holdings].sort(
      (a, b) => b.profitLossPercent - a.profitLossPercent
    );

    return {
      totalValue,
      totalCost,
      totalProfitLoss,
      totalProfitLossPercent,
      holdings,
      assetAllocation: {
        crypto: {
          value: cryptoValue,
          percent: totalValue > 0 ? (cryptoValue / totalValue) * 100 : 0,
        },
        stocks: {
          value: stockValue,
          percent: totalValue > 0 ? (stockValue / totalValue) * 100 : 0,
        },
      },
      topPerformers: sortedByPerformance.slice(0, 3),
      worstPerformers: sortedByPerformance.slice(-3).reverse(),
    };
  }

  /**
   * Get formatted portfolio summary
   */
  async getFormattedSummary(userId: string): Promise<string> {
    const summary = await this.getPortfolioSummary(userId);

    const plEmoji = summary.totalProfitLoss >= 0 ? "+" : "";
    let result = `Portfolio Summary
=================

Total Value: $${summary.totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
Total Cost: $${summary.totalCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
P/L: ${plEmoji}$${summary.totalProfitLoss.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (${plEmoji}${summary.totalProfitLossPercent.toFixed(2)}%)

Asset Allocation:
  Crypto: $${summary.assetAllocation.crypto.value.toLocaleString()} (${summary.assetAllocation.crypto.percent.toFixed(1)}%)
  Stocks: $${summary.assetAllocation.stocks.value.toLocaleString()} (${summary.assetAllocation.stocks.percent.toFixed(1)}%)

Holdings:
`;

    for (const holding of summary.holdings) {
      const hPlEmoji = holding.profitLossPercent >= 0 ? "+" : "";
      result += `  ${holding.symbol}: ${parseFloat(holding.quantity).toFixed(4)} @ $${holding.currentPrice.toFixed(2)} = $${holding.currentValue.toLocaleString()} (${hPlEmoji}${holding.profitLossPercent.toFixed(2)}%)\n`;
    }

    if (summary.topPerformers.length > 0) {
      result += "\nTop Performers:\n";
      for (const h of summary.topPerformers) {
        result += `  ${h.symbol}: +${h.profitLossPercent.toFixed(2)}%\n`;
      }
    }

    return result;
  }
}

export function createPortfolioManager(
  config: PortfolioManagerConfig = {}
): PortfolioManager {
  return new PortfolioManager(config);
}

export default PortfolioManager;
