/**
 * AI Inventory Manager Agent
 *
 * Tracks stock levels, predicts demand, generates purchase orders,
 * detects anomalies, and optimizes reorder points.
 */

import { configure, chatWithTools, type Message } from "opensentinel";

configure({
  CLAUDE_API_KEY: process.env.CLAUDE_API_KEY || "",
});

interface Product {
  sku: string;
  name: string;
  category: string;
  currentStock: number;
  reorderPoint: number;
  leadTimeDays: number;
  unitCost: number;
  avgDailySales: number;
}

interface StockAlert {
  sku: string;
  name: string;
  type: "low-stock" | "overstock" | "stockout" | "demand-spike" | "slow-moving";
  severity: "critical" | "warning" | "info";
  details: string;
  recommendation: string;
}

interface PurchaseOrder {
  supplier: string;
  items: { sku: string; name: string; quantity: number; unitCost: number }[];
  totalCost: number;
  reason: string;
  urgency: "standard" | "rush";
}

// Analyze inventory health
async function analyzeInventory(products: Product[]): Promise<StockAlert[]> {
  const messages: Message[] = [
    {
      role: "user",
      content: `Analyze this inventory data and identify issues.

INVENTORY:
${JSON.stringify(products, null, 2)}

For each product, check:
1. LOW STOCK: currentStock < reorderPoint
2. STOCKOUT RISK: currentStock / avgDailySales < leadTimeDays (will run out before reorder arrives)
3. OVERSTOCK: currentStock > avgDailySales * 90 (more than 90 days of supply)
4. SLOW MOVING: avgDailySales < 0.5 (less than 1 sale every 2 days)
5. DEMAND SPIKE: if avgDailySales seems unusually high relative to stock levels

Return JSON array of alerts with:
- sku, name
- type: "low-stock" | "overstock" | "stockout" | "demand-spike" | "slow-moving"
- severity: "critical" (stockout imminent) | "warning" (action needed this week) | "info" (monitor)
- details: what's happening (include numbers)
- recommendation: specific action to take

Return ONLY valid JSON array. Return [] if everything is healthy.`,
    },
  ];

  const response = await chatWithTools(messages, "inventory-manager");

  try {
    return JSON.parse(response.content);
  } catch {
    return [];
  }
}

// Forecast demand and suggest reorder quantities
async function forecastDemand(
  products: Product[],
  context: string
): Promise<string> {
  const messages: Message[] = [
    {
      role: "user",
      content: `Forecast demand for the next 30 days and suggest reorder quantities.

CURRENT INVENTORY:
${JSON.stringify(
  products.map((p) => ({
    sku: p.sku,
    name: p.name,
    stock: p.currentStock,
    avgDailySales: p.avgDailySales,
    leadTimeDays: p.leadTimeDays,
    reorderPoint: p.reorderPoint,
  })),
  null,
  2
)}

CONTEXT: ${context}

For each product that needs reordering:
1. Calculate days of stock remaining (currentStock / avgDailySales)
2. Account for lead time
3. Add safety stock buffer (20% of lead time demand)
4. Suggest order quantity to reach 45-day supply level

Format as a table:
SKU | Product | Days Left | Order Qty | Est. Cost | Urgency

Then provide:
- Total estimated reorder cost
- Cash flow impact timing
- Any products we should consider discontinuing (slow movers)`,
    },
  ];

  const response = await chatWithTools(messages, "inventory-manager");
  return response.content;
}

// Generate a purchase order
async function generatePurchaseOrder(
  products: Product[],
  alerts: StockAlert[]
): Promise<PurchaseOrder[]> {
  const criticalItems = alerts.filter(
    (a) => a.type === "low-stock" || a.type === "stockout"
  );

  if (criticalItems.length === 0) return [];

  const messages: Message[] = [
    {
      role: "user",
      content: `Generate purchase orders for these items that need restocking.

ITEMS NEEDING RESTOCK:
${JSON.stringify(
  criticalItems.map((a) => {
    const product = products.find((p) => p.sku === a.sku);
    return {
      sku: a.sku,
      name: a.name,
      currentStock: product?.currentStock,
      avgDailySales: product?.avgDailySales,
      leadTimeDays: product?.leadTimeDays,
      unitCost: product?.unitCost,
      severity: a.severity,
    };
  }),
  null,
  2
)}

Generate purchase orders grouped by likely supplier (group by category).

Return JSON array of orders:
- supplier: suggested supplier name based on category
- items: array of { sku, name, quantity (enough for 45 days + safety stock), unitCost }
- totalCost: sum of quantity * unitCost for all items
- reason: why we're ordering
- urgency: "rush" if stockout imminent, "standard" otherwise

Return ONLY valid JSON array.`,
    },
  ];

  const response = await chatWithTools(messages, "inventory-manager");

  try {
    return JSON.parse(response.content);
  } catch {
    return [];
  }
}

// Generate inventory report
async function generateReport(
  products: Product[],
  alerts: StockAlert[],
  orders: PurchaseOrder[]
): Promise<string> {
  const totalValue = products.reduce(
    (sum, p) => sum + p.currentStock * p.unitCost,
    0
  );
  const critical = alerts.filter((a) => a.severity === "critical");
  const warnings = alerts.filter((a) => a.severity === "warning");

  const messages: Message[] = [
    {
      role: "user",
      content: `Generate a daily inventory report.

SUMMARY:
- Total SKUs: ${products.length}
- Total inventory value: $${totalValue.toLocaleString()}
- Critical alerts: ${critical.length}
- Warnings: ${warnings.length}
- Purchase orders generated: ${orders.length}

ALERTS:
${JSON.stringify(alerts, null, 2)}

PURCHASE ORDERS:
${JSON.stringify(orders, null, 2)}

Format as a daily briefing:
1. Health status (one line: "X items need attention")
2. Critical items (table if any)
3. Reorder summary
4. Inventory value trend direction
5. Action items for today

Keep it under 300 words. Focus on what needs action.`,
    },
  ];

  const response = await chatWithTools(messages, "inventory-manager");
  return response.content;
}

async function main() {
  console.log("OpenSentinel Inventory Manager starting...\n");

  // Example inventory — in production, pull from your ERP/POS system
  const products: Product[] = [
    { sku: "WDG-001", name: 'Widget Pro 10"', category: "Widgets", currentStock: 15, reorderPoint: 50, leadTimeDays: 7, unitCost: 12.5, avgDailySales: 8 },
    { sku: "WDG-002", name: "Widget Lite 7\"", category: "Widgets", currentStock: 230, reorderPoint: 40, leadTimeDays: 7, unitCost: 7.0, avgDailySales: 3 },
    { sku: "GDG-001", name: "Gadget X100", category: "Gadgets", currentStock: 0, reorderPoint: 20, leadTimeDays: 14, unitCost: 45.0, avgDailySales: 5 },
    { sku: "GDG-002", name: "Gadget Mini", category: "Gadgets", currentStock: 89, reorderPoint: 30, leadTimeDays: 14, unitCost: 22.0, avgDailySales: 4 },
    { sku: "ACC-001", name: "Premium Case", category: "Accessories", currentStock: 500, reorderPoint: 25, leadTimeDays: 5, unitCost: 3.5, avgDailySales: 0.3 },
    { sku: "ACC-002", name: "USB-C Cable 6ft", category: "Accessories", currentStock: 42, reorderPoint: 100, leadTimeDays: 3, unitCost: 2.0, avgDailySales: 15 },
    { sku: "SPR-001", name: "Replacement Screen", category: "Spare Parts", currentStock: 28, reorderPoint: 10, leadTimeDays: 21, unitCost: 35.0, avgDailySales: 1.2 },
  ];

  // Analyze
  console.log("Analyzing inventory health...");
  const alerts = await analyzeInventory(products);

  for (const alert of alerts) {
    const icon = alert.severity === "critical" ? "[!!!]" : alert.severity === "warning" ? "[!!]" : "[i]";
    console.log(`  ${icon} ${alert.sku} ${alert.name}: ${alert.details}`);
  }

  // Forecast
  console.log("\nForecasting demand...");
  const forecast = await forecastDemand(
    products,
    "Holiday season approaching. Expect 30% increase in widget sales. Gadget X100 featured in upcoming promotion."
  );
  console.log(forecast);

  // Generate POs
  console.log("\nGenerating purchase orders...");
  const orders = await generatePurchaseOrder(products, alerts);

  if (orders.length > 0) {
    for (const po of orders) {
      console.log(`\n  PO to ${po.supplier} (${po.urgency.toUpperCase()}):`);
      for (const item of po.items) {
        console.log(`    ${item.sku} ${item.name} x${item.quantity} @ $${item.unitCost} = $${(item.quantity * item.unitCost).toFixed(2)}`);
      }
      console.log(`    Total: $${po.totalCost.toFixed(2)}`);
    }
  }

  // Daily report
  console.log("\n" + "=".repeat(60));
  console.log("DAILY INVENTORY REPORT");
  console.log("=".repeat(60));
  const report = await generateReport(products, alerts, orders);
  console.log(report);
}

main().catch(console.error);
