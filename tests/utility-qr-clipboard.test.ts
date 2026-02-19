import { describe, test, expect } from "bun:test";

// ============================================================
// QR Code + Clipboard Manager Tests
// ============================================================

import {
  generateQRSvg,
  wifiQRData,
  vcardQRData,
  qrCodeTool,
} from "../src/tools/qr-code";

import {
  save,
  get,
  remove,
  list,
  search,
  getHistory,
  clearAll,
  clipboardTool,
} from "../src/tools/clipboard-manager";

describe("QR Code", () => {
  describe("generateQRSvg", () => {
    test("generates valid SVG", () => {
      const svg = generateQRSvg("Hello");
      expect(svg).toContain("<svg");
      expect(svg).toContain("</svg>");
    });

    test("contains rect elements", () => {
      const svg = generateQRSvg("Test data");
      expect(svg).toContain("<rect");
    });

    test("respects custom size", () => {
      const svg = generateQRSvg("Test", { size: 512 });
      expect(svg).toContain('width="512"');
    });

    test("respects custom colors", () => {
      const svg = generateQRSvg("Test", {
        darkColor: "#ff0000",
        lightColor: "#00ff00",
      });
      expect(svg).toContain("#ff0000");
      expect(svg).toContain("#00ff00");
    });
  });

  describe("wifiQRData", () => {
    test("generates WiFi QR data", () => {
      const data = wifiQRData("MyNetwork", "MyPassword");
      expect(data).toContain("WIFI:");
      expect(data).toContain("S:MyNetwork");
      expect(data).toContain("P:MyPassword");
      expect(data).toContain("T:WPA");
    });

    test("supports WEP encryption", () => {
      const data = wifiQRData("Net", "Pass", "WEP");
      expect(data).toContain("T:WEP");
    });
  });

  describe("vcardQRData", () => {
    test("generates vCard data", () => {
      const data = vcardQRData("John Doe", "+1234567890", "john@example.com");
      expect(data).toContain("BEGIN:VCARD");
      expect(data).toContain("FN:John Doe");
      expect(data).toContain("TEL:+1234567890");
      expect(data).toContain("EMAIL:john@example.com");
      expect(data).toContain("END:VCARD");
    });

    test("includes organization", () => {
      const data = vcardQRData("Jane", undefined, undefined, "Acme Corp");
      expect(data).toContain("ORG:Acme Corp");
    });
  });

  describe("qrCodeTool (main entry)", () => {
    test("handles generate action", async () => {
      const result = await qrCodeTool("generate", "Test");
      expect(result.success).toBe(true);
      expect(result.svg).toBeDefined();
    });

    test("handles wifi action", async () => {
      const result = await qrCodeTool("wifi", "MyWifi", {
        password: "pass123",
      });
      expect(result.success).toBe(true);
    });

    test("handles unknown action", async () => {
      const result = await qrCodeTool("unknown", "data");
      expect(result.success).toBe(false);
    });
  });
});

describe("Clipboard Manager", () => {
  test("clearAll works", () => {
    clearAll();
    const result = list();
    expect(result.entries!.length).toBe(0);
  });

  describe("save and get", () => {
    test("saves and retrieves entry", () => {
      clearAll();
      save("test-entry", "Hello World");
      const result = get("test-entry");
      expect(result.success).toBe(true);
      expect(result.entry!.content).toBe("Hello World");
    });

    test("auto-detects text type", () => {
      clearAll();
      save("text", "Just plain text");
      const result = get("text");
      expect(result.entry!.type).toBe("text");
    });

    test("auto-detects URL type", () => {
      clearAll();
      save("url", "https://example.com");
      const result = get("url");
      expect(result.entry!.type).toBe("url");
    });

    test("auto-detects JSON type", () => {
      clearAll();
      save("json", '{"key": "value"}');
      const result = get("json");
      expect(result.entry!.type).toBe("json");
    });

    test("auto-detects code type", () => {
      clearAll();
      save("code", "function hello() {}");
      const result = get("code");
      expect(result.entry!.type).toBe("code");
    });

    test("accepts explicit type", () => {
      clearAll();
      save("explicit", "content", "other");
      const result = get("explicit");
      expect(result.entry!.type).toBe("other");
    });

    test("increments access count", () => {
      clearAll();
      save("counter", "data");
      get("counter");
      get("counter");
      const result = get("counter");
      expect(result.entry!.accessCount).toBe(3);
    });
  });

  describe("remove", () => {
    test("removes existing entry", () => {
      clearAll();
      save("to-remove", "data");
      const result = remove("to-remove");
      expect(result.success).toBe(true);
      expect(get("to-remove").success).toBe(false);
    });

    test("returns error for non-existent entry", () => {
      clearAll();
      const result = remove("nonexistent");
      expect(result.success).toBe(false);
    });
  });

  describe("list", () => {
    test("lists all entries", () => {
      clearAll();
      save("a", "data-a");
      save("b", "data-b");
      const result = list();
      expect(result.entries!.length).toBe(2);
    });
  });

  describe("search", () => {
    test("searches by name", () => {
      clearAll();
      save("my-snippet", "content");
      save("other-thing", "stuff");
      const result = search("snippet");
      expect(result.entries!.length).toBe(1);
    });

    test("searches by content", () => {
      clearAll();
      save("entry1", "hello world");
      save("entry2", "goodbye world");
      const result = search("goodbye");
      expect(result.entries!.length).toBe(1);
    });
  });

  describe("getHistory", () => {
    test("returns history entries", () => {
      clearAll();
      save("h1", "data1");
      save("h2", "data2");
      const result = getHistory(10);
      expect(result.entries!.length).toBe(2);
    });

    test("respects limit", () => {
      clearAll();
      for (let i = 0; i < 5; i++) save(`item${i}`, `data${i}`);
      const result = getHistory(3);
      expect(result.entries!.length).toBe(3);
    });
  });

  describe("clipboardTool (main entry)", () => {
    test("handles save action", async () => {
      const result = await clipboardTool("save", "test", "content");
      expect(result.success).toBe(true);
    });

    test("handles get action", async () => {
      await clipboardTool("save", "test", "content");
      const result = await clipboardTool("get", "test");
      expect(result.success).toBe(true);
    });

    test("handles unknown action", async () => {
      const result = await clipboardTool("unknown", "test");
      expect(result.success).toBe(false);
    });
  });
});
