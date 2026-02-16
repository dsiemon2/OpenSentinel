/**
 * Inventory Manager — Track items, quantities, and reorder alerts
 *
 * Lightweight in-memory inventory tracking with categories,
 * low-stock alerts, and transaction history.
 */

export interface InventoryItem {
  id: string;
  name: string;
  sku?: string;
  category?: string;
  quantity: number;
  unit?: string;
  reorderPoint?: number;
  cost?: number;
  price?: number;
  location?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface InventoryTransaction {
  id: string;
  itemId: string;
  type: "add" | "remove" | "adjust";
  quantity: number;
  previousQuantity: number;
  newQuantity: number;
  reason?: string;
  timestamp: Date;
}

export interface InventorySummary {
  totalItems: number;
  totalUnits: number;
  totalValue: number;
  lowStockItems: InventoryItem[];
  outOfStockItems: InventoryItem[];
  byCategory: Record<string, number>;
  summary: string;
}

const items = new Map<string, InventoryItem>();
const transactions: InventoryTransaction[] = [];
let nextItemId = 1;
let nextTxId = 1;

export function addItem(
  name: string,
  quantity: number,
  options: { sku?: string; category?: string; unit?: string; reorderPoint?: number; cost?: number; price?: number; location?: string; notes?: string } = {}
): InventoryItem {
  const id = `item_${nextItemId++}`;
  const item: InventoryItem = {
    id, name, quantity,
    sku: options.sku,
    category: options.category,
    unit: options.unit || "units",
    reorderPoint: options.reorderPoint,
    cost: options.cost,
    price: options.price,
    location: options.location,
    notes: options.notes,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  items.set(id, item);

  transactions.push({
    id: `tx_${nextTxId++}`, itemId: id, type: "add",
    quantity, previousQuantity: 0, newQuantity: quantity,
    reason: "Initial stock", timestamp: new Date(),
  });

  return item;
}

export function updateQuantity(
  nameOrId: string,
  change: number,
  reason?: string
): InventoryItem {
  const item = findItem(nameOrId);
  if (!item) throw new Error(`Item not found: ${nameOrId}`);

  const prev = item.quantity;
  item.quantity = Math.max(0, item.quantity + change);
  item.updatedAt = new Date();

  transactions.push({
    id: `tx_${nextTxId++}`, itemId: item.id,
    type: change > 0 ? "add" : change < 0 ? "remove" : "adjust",
    quantity: Math.abs(change), previousQuantity: prev, newQuantity: item.quantity,
    reason, timestamp: new Date(),
  });

  return item;
}

export function setQuantity(
  nameOrId: string,
  quantity: number,
  reason?: string
): InventoryItem {
  const item = findItem(nameOrId);
  if (!item) throw new Error(`Item not found: ${nameOrId}`);

  const prev = item.quantity;
  item.quantity = Math.max(0, quantity);
  item.updatedAt = new Date();

  transactions.push({
    id: `tx_${nextTxId++}`, itemId: item.id, type: "adjust",
    quantity: Math.abs(quantity - prev), previousQuantity: prev, newQuantity: item.quantity,
    reason: reason || "Manual adjustment", timestamp: new Date(),
  });

  return item;
}

export function removeItem(nameOrId: string): boolean {
  const item = findItem(nameOrId);
  if (!item) return false;
  items.delete(item.id);
  return true;
}

export function getItem(nameOrId: string): InventoryItem | undefined {
  return findItem(nameOrId);
}

export function listItems(filter?: { category?: string; lowStock?: boolean }): InventoryItem[] {
  let result = Array.from(items.values());
  if (filter?.category) {
    result = result.filter((i) => i.category?.toLowerCase().includes(filter.category!.toLowerCase()));
  }
  if (filter?.lowStock) {
    result = result.filter((i) => i.reorderPoint !== undefined && i.quantity <= i.reorderPoint);
  }
  return result.sort((a, b) => a.name.localeCompare(b.name));
}

export function getItemHistory(nameOrId: string): InventoryTransaction[] {
  const item = findItem(nameOrId);
  if (!item) return [];
  return transactions.filter((t) => t.itemId === item.id).sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
}

export function getInventorySummary(): InventorySummary {
  const all = Array.from(items.values());
  const totalUnits = all.reduce((s, i) => s + i.quantity, 0);
  const totalValue = all.reduce((s, i) => s + i.quantity * (i.cost || 0), 0);
  const lowStock = all.filter((i) => i.reorderPoint !== undefined && i.quantity <= i.reorderPoint && i.quantity > 0);
  const outOfStock = all.filter((i) => i.quantity === 0);

  const byCategory: Record<string, number> = {};
  for (const item of all) {
    const cat = item.category || "Uncategorized";
    byCategory[cat] = (byCategory[cat] || 0) + 1;
  }

  return {
    totalItems: all.length,
    totalUnits,
    totalValue,
    lowStockItems: lowStock,
    outOfStockItems: outOfStock,
    byCategory,
    summary: `${all.length} items, ${totalUnits} total units, $${totalValue.toLocaleString()} value. ${lowStock.length} low stock, ${outOfStock.length} out of stock.`,
  };
}

export function clearInventory(): void {
  items.clear();
  transactions.length = 0;
  nextItemId = 1;
  nextTxId = 1;
}

function findItem(nameOrId: string): InventoryItem | undefined {
  const byId = items.get(nameOrId);
  if (byId) return byId;
  const lower = nameOrId.toLowerCase();
  for (const item of items.values()) {
    if (item.name.toLowerCase() === lower) return item;
    if (item.sku?.toLowerCase() === lower) return item;
  }
  return undefined;
}
