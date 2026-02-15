import { describe, test, expect } from "bun:test";

describe("Docs Writer", () => {
  describe("Module Exports", () => {
    test("should export core functions", async () => {
      const mod = await import("../src/tools/docs-writer");
      expect(typeof mod.generateAPIRef).toBe("function");
      expect(typeof mod.generateChangelog).toBe("function");
      expect(typeof mod.generateGuide).toBe("function");
      expect(typeof mod.generateReadme).toBe("function");
      expect(typeof mod.documentInterfaces).toBe("function");
    });
  });

  describe("generateAPIRef", () => {
    test("should generate API reference markdown", async () => {
      const { generateAPIRef } = await import("../src/tools/docs-writer");
      const doc = generateAPIRef("TestAPI", [
        { method: "GET", path: "/users", description: "List all users" },
        { method: "POST", path: "/users", description: "Create a user", body: [{ name: "name", type: "string", required: true }] },
      ], { baseUrl: "https://api.example.com" });

      expect(doc.type).toBe("api_reference");
      expect(doc.content).toContain("TestAPI API Reference");
      expect(doc.content).toContain("GET");
      expect(doc.content).toContain("/users");
      expect(doc.content).toContain("api.example.com");
      expect(doc.wordCount).toBeGreaterThan(10);
    });

    test("should include auth info", async () => {
      const { generateAPIRef } = await import("../src/tools/docs-writer");
      const doc = generateAPIRef("MyAPI", [], { authInfo: "Use Bearer token in Authorization header" });
      expect(doc.content).toContain("Authentication");
      expect(doc.content).toContain("Bearer token");
    });
  });

  describe("generateChangelog", () => {
    test("should generate changelog markdown", async () => {
      const { generateChangelog } = await import("../src/tools/docs-writer");
      const doc = generateChangelog("MyProject", [
        {
          version: "2.0.0",
          date: "2026-02-14",
          changes: [
            { type: "added", description: "New dashboard feature" },
            { type: "fixed", description: "Login bug on mobile" },
          ],
        },
        {
          version: "1.0.0",
          date: "2026-01-01",
          changes: [
            { type: "added", description: "Initial release" },
          ],
        },
      ]);

      expect(doc.type).toBe("changelog");
      expect(doc.content).toContain("2.0.0");
      expect(doc.content).toContain("1.0.0");
      expect(doc.content).toContain("New dashboard feature");
      expect(doc.content).toContain("Added");
      expect(doc.content).toContain("Fixed");
    });

    test("should sort versions newest first", async () => {
      const { generateChangelog } = await import("../src/tools/docs-writer");
      const doc = generateChangelog("Test", [
        { version: "1.0.0", date: "2026-01-01", changes: [{ type: "added", description: "v1" }] },
        { version: "2.0.0", date: "2026-02-01", changes: [{ type: "added", description: "v2" }] },
      ]);
      const idx1 = doc.content.indexOf("2.0.0");
      const idx2 = doc.content.indexOf("1.0.0");
      expect(idx1).toBeLessThan(idx2);
    });
  });

  describe("generateGuide", () => {
    test("should generate getting started guide", async () => {
      const { generateGuide } = await import("../src/tools/docs-writer");
      const doc = generateGuide("MyApp", [
        { title: "Quick Start", content: "Run `npm start` to begin" },
        { title: "Configuration", content: "Edit config.json to customize" },
      ], {
        prerequisites: ["Node.js 18+", "PostgreSQL"],
        installCommand: "npm install myapp",
      });

      expect(doc.type).toBe("guide");
      expect(doc.content).toContain("Getting Started Guide");
      expect(doc.content).toContain("Prerequisites");
      expect(doc.content).toContain("Node.js 18+");
      expect(doc.content).toContain("npm install myapp");
      expect(doc.content).toContain("Quick Start");
    });
  });

  describe("generateReadme", () => {
    test("should generate README", async () => {
      const { generateReadme } = await import("../src/tools/docs-writer");
      const doc = generateReadme("AwesomeProject", {
        description: "A great project for doing things",
        features: ["Fast", "Reliable", "Open Source"],
        installCommand: "pip install awesome",
        license: "MIT License",
      });

      expect(doc.type).toBe("readme");
      expect(doc.content).toContain("# AwesomeProject");
      expect(doc.content).toContain("A great project");
      expect(doc.content).toContain("Fast");
      expect(doc.content).toContain("pip install awesome");
      expect(doc.content).toContain("MIT License");
    });
  });

  describe("documentInterfaces", () => {
    test("should extract TypeScript interfaces", async () => {
      const { documentInterfaces } = await import("../src/tools/docs-writer");
      const source = `
export interface User {
  id: string;
  name: string;
  email: string;
  age?: number;
}

export type Status = "active" | "inactive";
`;
      const doc = documentInterfaces(source);
      expect(doc.type).toBe("type_docs");
      expect(doc.content).toContain("User");
      expect(doc.content).toContain("id");
      expect(doc.content).toContain("name");
      expect(doc.content).toContain("Status");
    });

    test("should handle empty source", async () => {
      const { documentInterfaces } = await import("../src/tools/docs-writer");
      const doc = documentInterfaces("const x = 1;");
      expect(doc.content).toContain("No interfaces or types found");
    });
  });

  describe("Tool Definition", () => {
    test("should include docs_writer in TOOLS", async () => {
      const { TOOLS } = await import("../src/tools/index");
      expect(TOOLS.find((t) => t.name === "docs_writer")).toBeTruthy();
    });
  });

  describe("executeTool", () => {
    test("should handle api_ref action", async () => {
      const { executeTool } = await import("../src/tools/index");
      const result = await executeTool("docs_writer", {
        action: "api_ref",
        project_name: "TestAPI",
        endpoints: [{ method: "GET", path: "/health", description: "Health check" }],
      });
      expect(result.success).toBe(true);
      expect((result.result as any).type).toBe("api_reference");
    });

    test("should handle readme action", async () => {
      const { executeTool } = await import("../src/tools/index");
      const result = await executeTool("docs_writer", {
        action: "readme",
        project_name: "TestProject",
        description: "A test project",
        features: ["Feature 1", "Feature 2"],
      });
      expect(result.success).toBe(true);
      expect((result.result as any).content).toContain("TestProject");
    });
  });
});
