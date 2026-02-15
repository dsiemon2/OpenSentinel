import { describe, test, expect, beforeEach } from "bun:test";

// ── Social Listener Tests ────────────────────────────────────────────────
describe("Social Listener", () => {
  beforeEach(async () => {
    const { clearBrandMonitors } = await import("../src/tools/social-listener");
    clearBrandMonitors();
  });

  test("should export core functions", async () => {
    const mod = await import("../src/tools/social-listener");
    expect(typeof mod.addBrandMonitor).toBe("function");
    expect(typeof mod.scanMentions).toBe("function");
    expect(typeof mod.getSentimentReport).toBe("function");
    expect(typeof mod.analyzeSentiment).toBe("function");
  });

  test("should add brand monitor", async () => {
    const { addBrandMonitor } = await import("../src/tools/social-listener");
    const mon = addBrandMonitor("OpenSentinel", ["AI assistant", "self-hosted"]);
    expect(mon.brand).toBe("OpenSentinel");
    expect(mon.keywords).toHaveLength(2);
  });

  test("should analyze positive sentiment", async () => {
    const { analyzeSentiment } = await import("../src/tools/social-listener");
    expect(analyzeSentiment("This product is amazing and excellent!")).toBe("positive");
  });

  test("should analyze negative sentiment", async () => {
    const { analyzeSentiment } = await import("../src/tools/social-listener");
    expect(analyzeSentiment("Terrible product, worst experience ever")).toBe("negative");
  });

  test("should analyze neutral sentiment", async () => {
    const { analyzeSentiment } = await import("../src/tools/social-listener");
    expect(analyzeSentiment("The company released a new update")).toBe("neutral");
  });

  test("should list brand monitors", async () => {
    const { addBrandMonitor, listBrandMonitors } = await import("../src/tools/social-listener");
    addBrandMonitor("Brand1");
    addBrandMonitor("Brand2");
    expect(listBrandMonitors()).toHaveLength(2);
  });

  test("should include social_listen in TOOLS", async () => {
    const { TOOLS } = await import("../src/tools/index");
    expect(TOOLS.find((t) => t.name === "social_listen")).toBeTruthy();
  });
});

// ── Legal Reviewer Tests ─────────────────────────────────────────────────
describe("Legal Reviewer", () => {
  test("should export reviewDocument", async () => {
    const { reviewDocument } = await import("../src/tools/legal-reviewer");
    expect(typeof reviewDocument).toBe("function");
  });

  test("should detect document type", async () => {
    const { reviewDocument } = await import("../src/tools/legal-reviewer");
    const result = reviewDocument("This Employment Agreement is entered into between Company A and Employee B...");
    expect(result.documentType).toBe("Employment Agreement");
  });

  test("should detect risky clauses", async () => {
    const { reviewDocument } = await import("../src/tools/legal-reviewer");
    const result = reviewDocument(
      "The contractor shall indemnify the company. This agreement includes a non-compete clause. The contract auto-renews annually."
    );
    expect(result.risks.length).toBeGreaterThanOrEqual(3);
    expect(result.risks.some((r) => r.category === "Indemnification")).toBe(true);
    expect(result.risks.some((r) => r.category === "Non-Compete")).toBe(true);
    expect(result.risks.some((r) => r.category === "Auto-Renewal")).toBe(true);
  });

  test("should extract dates", async () => {
    const { reviewDocument } = await import("../src/tools/legal-reviewer");
    const result = reviewDocument("Effective date: January 15, 2026. Termination date: 2026-12-31.");
    expect(result.dates.length).toBeGreaterThanOrEqual(2);
  });

  test("should extract amounts", async () => {
    const { reviewDocument } = await import("../src/tools/legal-reviewer");
    const result = reviewDocument("The total contract value is $50,000.00 with monthly payments of $4,166.67.");
    expect(result.amounts.length).toBeGreaterThanOrEqual(2);
  });

  test("should return risk score", async () => {
    const { reviewDocument } = await import("../src/tools/legal-reviewer");
    const result = reviewDocument("Simple agreement with no risky terms.");
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
  });

  test("should include disclaimer", async () => {
    const { reviewDocument } = await import("../src/tools/legal-reviewer");
    const result = reviewDocument("Any text");
    expect(result.disclaimer).toContain("not constitute legal advice");
  });

  test("should include legal_review in TOOLS", async () => {
    const { TOOLS } = await import("../src/tools/index");
    expect(TOOLS.find((t) => t.name === "legal_review")).toBeTruthy();
  });

  test("should handle legal_review via executeTool", async () => {
    const { executeTool } = await import("../src/tools/index");
    const result = await executeTool("legal_review", { text: "This service agreement includes an indemnification clause." });
    expect(result.success).toBe(true);
    expect((result.result as any).documentType).toBeDefined();
  });
});

// ── Inventory Manager Tests ──────────────────────────────────────────────
describe("Inventory Manager", () => {
  beforeEach(async () => {
    const { clearInventory } = await import("../src/tools/inventory-manager");
    clearInventory();
  });

  test("should export core functions", async () => {
    const mod = await import("../src/tools/inventory-manager");
    expect(typeof mod.addItem).toBe("function");
    expect(typeof mod.updateQuantity).toBe("function");
    expect(typeof mod.listItems).toBe("function");
    expect(typeof mod.getInventorySummary).toBe("function");
  });

  test("should add items", async () => {
    const { addItem } = await import("../src/tools/inventory-manager");
    const item = addItem("Widget", 100, { sku: "WDG-001", category: "Parts", cost: 5.50 });
    expect(item.name).toBe("Widget");
    expect(item.quantity).toBe(100);
    expect(item.sku).toBe("WDG-001");
  });

  test("should update quantities", async () => {
    const { addItem, updateQuantity } = await import("../src/tools/inventory-manager");
    addItem("Widget", 100);
    const updated = updateQuantity("Widget", -30, "Sold");
    expect(updated.quantity).toBe(70);
  });

  test("should not go below zero", async () => {
    const { addItem, updateQuantity } = await import("../src/tools/inventory-manager");
    addItem("Widget", 5);
    const updated = updateQuantity("Widget", -100);
    expect(updated.quantity).toBe(0);
  });

  test("should track transaction history", async () => {
    const { addItem, updateQuantity, getItemHistory } = await import("../src/tools/inventory-manager");
    addItem("Widget", 100);
    updateQuantity("Widget", -10);
    updateQuantity("Widget", 5);
    const history = getItemHistory("Widget");
    expect(history).toHaveLength(3); // initial + 2 updates
  });

  test("should detect low stock", async () => {
    const { addItem, updateQuantity, listItems } = await import("../src/tools/inventory-manager");
    addItem("Widget", 100, { reorderPoint: 20 });
    updateQuantity("Widget", -85);
    const lowStock = listItems({ lowStock: true });
    expect(lowStock).toHaveLength(1);
  });

  test("should compute summary", async () => {
    const { addItem, getInventorySummary } = await import("../src/tools/inventory-manager");
    addItem("A", 50, { cost: 10, category: "Parts" });
    addItem("B", 30, { cost: 20, category: "Parts" });
    const summary = getInventorySummary();
    expect(summary.totalItems).toBe(2);
    expect(summary.totalUnits).toBe(80);
    expect(summary.totalValue).toBe(1100); // 50*10 + 30*20
  });

  test("should include inventory in TOOLS", async () => {
    const { TOOLS } = await import("../src/tools/index");
    expect(TOOLS.find((t) => t.name === "inventory")).toBeTruthy();
  });
});

// ── Real Estate Analyst Tests ────────────────────────────────────────────
describe("Real Estate Analyst", () => {
  test("should export core functions", async () => {
    const mod = await import("../src/tools/real-estate");
    expect(typeof mod.analyzeProperty).toBe("function");
    expect(typeof mod.compareProperties).toBe("function");
    expect(typeof mod.calculateMortgage).toBe("function");
  });

  test("should analyze a property", async () => {
    const { analyzeProperty } = await import("../src/tools/real-estate");
    const result = analyzeProperty({
      address: "123 Main St",
      purchasePrice: 300000,
      monthlyRent: 2500,
    });
    expect(result.address).toBe("123 Main St");
    expect(result.purchasePrice).toBe(300000);
    expect(result.metrics.capRate).toBeGreaterThan(0);
    expect(result.cashFlow).toBeDefined();
    expect(result.summary).toContain("123 Main St");
  });

  test("should calculate mortgage", async () => {
    const { calculateMortgage } = await import("../src/tools/real-estate");
    const result = calculateMortgage(240000, 7, 30);
    expect(result.monthlyPayment).toBeGreaterThan(1500);
    expect(result.totalInterest).toBeGreaterThan(0);
    expect(result.totalPaid).toBeGreaterThan(240000);
  });

  test("should compare properties", async () => {
    const { analyzeProperty, compareProperties } = await import("../src/tools/real-estate");
    const a = analyzeProperty({ address: "A St", purchasePrice: 200000, monthlyRent: 2000 });
    const b = analyzeProperty({ address: "B St", purchasePrice: 400000, monthlyRent: 3000 });
    const comparison = compareProperties([a, b]);
    expect(comparison.properties).toHaveLength(2);
    expect(comparison.bestValue).toBeTruthy();
  });

  test("should include real_estate in TOOLS", async () => {
    const { TOOLS } = await import("../src/tools/index");
    expect(TOOLS.find((t) => t.name === "real_estate")).toBeTruthy();
  });

  test("should handle real_estate analyze via executeTool", async () => {
    const { executeTool } = await import("../src/tools/index");
    const result = await executeTool("real_estate", {
      action: "analyze",
      address: "456 Oak Ave",
      purchase_price: 250000,
      monthly_rent: 2000,
    });
    expect(result.success).toBe(true);
    expect((result.result as any).metrics.capRate).toBeDefined();
  });
});

// ── Uptime Monitor Tests ─────────────────────────────────────────────────
describe("Uptime Monitor", () => {
  beforeEach(async () => {
    const { clearSites } = await import("../src/tools/uptime-monitor");
    clearSites();
  });

  test("should export core functions", async () => {
    const mod = await import("../src/tools/uptime-monitor");
    expect(typeof mod.addSite).toBe("function");
    expect(typeof mod.checkSite).toBe("function");
    expect(typeof mod.checkUrl).toBe("function");
    expect(typeof mod.getUptimeReport).toBe("function");
  });

  test("should add sites", async () => {
    const { addSite, listSites } = await import("../src/tools/uptime-monitor");
    addSite("https://example.com", "Example");
    expect(listSites()).toHaveLength(1);
  });

  test("should normalize URLs", async () => {
    const { addSite } = await import("../src/tools/uptime-monitor");
    const site = addSite("example.com");
    expect(site.url).toBe("https://example.com");
  });

  test("should include uptime_check in TOOLS", async () => {
    const { TOOLS } = await import("../src/tools/index");
    expect(TOOLS.find((t) => t.name === "uptime_check")).toBeTruthy();
  });
});

// ── DNS Lookup Tests ─────────────────────────────────────────────────────
describe("DNS Lookup", () => {
  test("should export core functions", async () => {
    const mod = await import("../src/tools/dns-lookup");
    expect(typeof mod.lookupDNS).toBe("function");
    expect(typeof mod.getDomainInfo).toBe("function");
  });

  test("should include dns_lookup in TOOLS", async () => {
    const { TOOLS } = await import("../src/tools/index");
    expect(TOOLS.find((t) => t.name === "dns_lookup")).toBeTruthy();
  });

  test("should handle dns_lookup via executeTool", async () => {
    const { executeTool } = await import("../src/tools/index");
    const result = await executeTool("dns_lookup", { domain: "example.com", action: "lookup" });
    expect(result.success).toBe(true);
    expect((result.result as any).domain).toBe("example.com");
  });
});
