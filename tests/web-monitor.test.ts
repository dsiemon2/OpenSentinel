import { describe, test, expect, beforeEach } from "bun:test";

describe("Web Monitor", () => {
  describe("Module Exports", () => {
    test("should export addMonitor function", async () => {
      const { addMonitor } = await import("../src/tools/web-monitor");
      expect(typeof addMonitor).toBe("function");
    });

    test("should export removeMonitor function", async () => {
      const { removeMonitor } = await import("../src/tools/web-monitor");
      expect(typeof removeMonitor).toBe("function");
    });

    test("should export checkForChanges function", async () => {
      const { checkForChanges } = await import("../src/tools/web-monitor");
      expect(typeof checkForChanges).toBe("function");
    });

    test("should export listMonitors function", async () => {
      const { listMonitors } = await import("../src/tools/web-monitor");
      expect(typeof listMonitors).toBe("function");
    });

    test("should export getMonitor function", async () => {
      const { getMonitor } = await import("../src/tools/web-monitor");
      expect(typeof getMonitor).toBe("function");
    });

    test("should export clearMonitors function", async () => {
      const { clearMonitors } = await import("../src/tools/web-monitor");
      expect(typeof clearMonitors).toBe("function");
    });
  });

  describe("addMonitor", () => {
    beforeEach(async () => {
      const { clearMonitors } = await import("../src/tools/web-monitor");
      clearMonitors();
    });

    test("should add a new monitor for a URL", async () => {
      const { addMonitor } = await import("../src/tools/web-monitor");
      const monitor = addMonitor("https://example.com");

      expect(monitor.url).toBe("https://example.com");
      expect(monitor.id).toBeTruthy();
      expect(monitor.lastHash).toBe("");
      expect(monitor.checkCount).toBe(0);
      expect(monitor.changeCount).toBe(0);
    });

    test("should add a monitor with a label", async () => {
      const { addMonitor } = await import("../src/tools/web-monitor");
      const monitor = addMonitor("https://example.com", "My Test Page");

      expect(monitor.label).toBe("My Test Page");
    });

    test("should return existing monitor for duplicate URL", async () => {
      const { addMonitor } = await import("../src/tools/web-monitor");
      const m1 = addMonitor("https://example.com");
      const m2 = addMonitor("https://example.com");

      expect(m1.id).toBe(m2.id);
    });

    test("should update label on duplicate add", async () => {
      const { addMonitor } = await import("../src/tools/web-monitor");
      addMonitor("https://example.com", "Old Label");
      const m2 = addMonitor("https://example.com", "New Label");

      expect(m2.label).toBe("New Label");
    });

    test("should generate different IDs for different URLs", async () => {
      const { addMonitor } = await import("../src/tools/web-monitor");
      const m1 = addMonitor("https://example.com");
      const m2 = addMonitor("https://other.com");

      expect(m1.id).not.toBe(m2.id);
    });
  });

  describe("removeMonitor", () => {
    beforeEach(async () => {
      const { clearMonitors } = await import("../src/tools/web-monitor");
      clearMonitors();
    });

    test("should remove a monitor by URL", async () => {
      const { addMonitor, removeMonitor, listMonitors } = await import("../src/tools/web-monitor");
      addMonitor("https://example.com");
      expect(listMonitors().length).toBe(1);

      const removed = removeMonitor("https://example.com");
      expect(removed).toBe(true);
      expect(listMonitors().length).toBe(0);
    });

    test("should remove a monitor by ID", async () => {
      const { addMonitor, removeMonitor, listMonitors } = await import("../src/tools/web-monitor");
      const monitor = addMonitor("https://example.com");

      const removed = removeMonitor(monitor.id);
      expect(removed).toBe(true);
      expect(listMonitors().length).toBe(0);
    });

    test("should return false for non-existent URL", async () => {
      const { removeMonitor } = await import("../src/tools/web-monitor");
      const removed = removeMonitor("https://nonexistent.com");
      expect(removed).toBe(false);
    });
  });

  describe("checkForChanges", () => {
    beforeEach(async () => {
      const { clearMonitors } = await import("../src/tools/web-monitor");
      clearMonitors();
    });

    test("should capture first snapshot without reporting change", async () => {
      const { checkForChanges } = await import("../src/tools/web-monitor");
      const result = checkForChanges("https://example.com", "Hello World");

      expect(result.changed).toBe(false);
      expect(result.url).toBe("https://example.com");
      expect(result.currentHash).toBeTruthy();
      expect(result.summary).toContain("First snapshot");
    });

    test("should detect no change when content is identical", async () => {
      const { checkForChanges } = await import("../src/tools/web-monitor");

      checkForChanges("https://example.com", "Hello World");
      const result = checkForChanges("https://example.com", "Hello World");

      expect(result.changed).toBe(false);
      expect(result.summary).toContain("No changes");
    });

    test("should detect change when content differs", async () => {
      const { checkForChanges } = await import("../src/tools/web-monitor");

      checkForChanges("https://example.com", "Hello World");
      const result = checkForChanges("https://example.com", "Hello Updated World");

      expect(result.changed).toBe(true);
      expect(result.summary).toContain("CHANGE DETECTED");
    });

    test("should report added and removed lines", async () => {
      const { checkForChanges } = await import("../src/tools/web-monitor");

      checkForChanges("https://example.com", "line1\nline2\nline3");
      const result = checkForChanges("https://example.com", "line1\nline2modified\nline4");

      expect(result.changed).toBe(true);
      expect(result.addedLines.length).toBeGreaterThan(0);
      expect(result.removedLines.length).toBeGreaterThan(0);
    });

    test("should auto-add monitor if URL not tracked", async () => {
      const { checkForChanges, getMonitor } = await import("../src/tools/web-monitor");

      checkForChanges("https://auto-added.com", "content");
      const monitor = getMonitor("https://auto-added.com");

      expect(monitor).toBeTruthy();
      expect(monitor!.checkCount).toBe(1);
    });

    test("should increment checkCount and changeCount", async () => {
      const { checkForChanges, getMonitor } = await import("../src/tools/web-monitor");

      checkForChanges("https://example.com", "v1");
      checkForChanges("https://example.com", "v2");
      checkForChanges("https://example.com", "v2");
      checkForChanges("https://example.com", "v3");

      const monitor = getMonitor("https://example.com");
      expect(monitor!.checkCount).toBe(4);
      expect(monitor!.changeCount).toBe(2);
    });

    test("should update lastChecked timestamp", async () => {
      const { checkForChanges, getMonitor } = await import("../src/tools/web-monitor");

      checkForChanges("https://example.com", "content");
      const monitor = getMonitor("https://example.com");

      expect(monitor!.lastChecked.getTime()).toBeGreaterThan(0);
    });

    test("should store previousHash on change", async () => {
      const { checkForChanges } = await import("../src/tools/web-monitor");

      const first = checkForChanges("https://example.com", "v1");
      const second = checkForChanges("https://example.com", "v2");

      expect(second.previousHash).toBe(first.currentHash);
    });
  });

  describe("listMonitors", () => {
    beforeEach(async () => {
      const { clearMonitors } = await import("../src/tools/web-monitor");
      clearMonitors();
    });

    test("should return empty array when no monitors", async () => {
      const { listMonitors } = await import("../src/tools/web-monitor");
      expect(listMonitors()).toEqual([]);
    });

    test("should return all monitored pages", async () => {
      const { addMonitor, listMonitors } = await import("../src/tools/web-monitor");
      addMonitor("https://a.com");
      addMonitor("https://b.com");
      addMonitor("https://c.com");

      expect(listMonitors().length).toBe(3);
    });
  });

  describe("getMonitor", () => {
    beforeEach(async () => {
      const { clearMonitors } = await import("../src/tools/web-monitor");
      clearMonitors();
    });

    test("should find monitor by URL", async () => {
      const { addMonitor, getMonitor } = await import("../src/tools/web-monitor");
      addMonitor("https://example.com", "My Page");

      const found = getMonitor("https://example.com");
      expect(found).toBeTruthy();
      expect(found!.label).toBe("My Page");
    });

    test("should find monitor by ID", async () => {
      const { addMonitor, getMonitor } = await import("../src/tools/web-monitor");
      const m = addMonitor("https://example.com");

      const found = getMonitor(m.id);
      expect(found).toBeTruthy();
      expect(found!.url).toBe("https://example.com");
    });

    test("should return undefined for unknown URL", async () => {
      const { getMonitor } = await import("../src/tools/web-monitor");
      expect(getMonitor("https://nonexistent.com")).toBeUndefined();
    });
  });

  describe("clearMonitors", () => {
    test("should clear all monitors", async () => {
      const { addMonitor, listMonitors, clearMonitors } = await import("../src/tools/web-monitor");
      addMonitor("https://a.com");
      addMonitor("https://b.com");
      expect(listMonitors().length).toBe(2);

      clearMonitors();
      expect(listMonitors().length).toBe(0);
    });
  });
});
