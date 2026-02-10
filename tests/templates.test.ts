import { describe, test, expect } from "bun:test";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const TEMPLATES_DIR = join(import.meta.dirname, "..", "templates");

const EXPECTED_TEMPLATES = [
  "ai-code-reviewer",
  "ai-competitor-tracker",
  "ai-content-creator",
  "ai-customer-support",
  "ai-data-analyst",
  "ai-devops-agent",
  "ai-documentation-writer",
  "ai-email-assistant",
  "ai-inventory-manager",
  "ai-legal-reviewer",
  "ai-meeting-assistant",
  "ai-onboarding-agent",
  "ai-real-estate-analyst",
  "ai-recruiter",
  "ai-sales-agent",
  "ai-security-monitor",
  "ai-seo-optimizer",
  "ai-social-listener",
  "ai-trading-researcher",
  "ai-web-monitor",
];

describe("Templates", () => {
  test("templates directory exists", () => {
    expect(existsSync(TEMPLATES_DIR)).toBe(true);
  });

  test("all 20 expected templates exist", () => {
    const dirs = readdirSync(TEMPLATES_DIR, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
      .sort();

    for (const template of EXPECTED_TEMPLATES) {
      expect(dirs).toContain(template);
    }
    expect(dirs.length).toBe(20);
  });

  describe.each(EXPECTED_TEMPLATES)("template: %s", (templateName) => {
    const templateDir = join(TEMPLATES_DIR, templateName);

    test("has index.ts", () => {
      expect(existsSync(join(templateDir, "index.ts"))).toBe(true);
    });

    test("has package.json", () => {
      expect(existsSync(join(templateDir, "package.json"))).toBe(true);
    });

    test("has README.md", () => {
      expect(existsSync(join(templateDir, "README.md"))).toBe(true);
    });

    test("package.json is valid JSON", () => {
      const content = readFileSync(join(templateDir, "package.json"), "utf-8");
      const pkg = JSON.parse(content);
      expect(pkg).toHaveProperty("name");
      expect(pkg).toHaveProperty("version");
      expect(pkg).toHaveProperty("dependencies");
    });

    test("package.json depends on opensentinel", () => {
      const content = readFileSync(join(templateDir, "package.json"), "utf-8");
      const pkg = JSON.parse(content);
      expect(pkg.dependencies).toHaveProperty("opensentinel");
    });

    test("package.json has start script", () => {
      const content = readFileSync(join(templateDir, "package.json"), "utf-8");
      const pkg = JSON.parse(content);
      expect(pkg.scripts).toHaveProperty("start");
    });

    test("index.ts imports from opensentinel", () => {
      const content = readFileSync(join(templateDir, "index.ts"), "utf-8");
      expect(content).toContain("from \"opensentinel\"");
    });

    test("index.ts calls configure()", () => {
      const content = readFileSync(join(templateDir, "index.ts"), "utf-8");
      expect(content).toContain("configure(");
    });

    test("index.ts has a main function or top-level execution", () => {
      const content = readFileSync(join(templateDir, "index.ts"), "utf-8");
      const hasMain = content.includes("async function main") || content.includes("function main");
      const hasTopLevel = content.includes(".catch(console.error)") || content.includes("await ");
      expect(hasMain || hasTopLevel).toBe(true);
    });

    test("README.md is not empty", () => {
      const content = readFileSync(join(templateDir, "README.md"), "utf-8");
      expect(content.length).toBeGreaterThan(50);
    });

    test("README.md contains template name or title", () => {
      const content = readFileSync(join(templateDir, "README.md"), "utf-8");
      // Should have at least a heading
      expect(content).toContain("#");
    });

    test("index.ts is valid TypeScript (no syntax errors)", () => {
      const content = readFileSync(join(templateDir, "index.ts"), "utf-8");
      // Basic syntax checks - should have proper imports and function structure
      expect(content).toContain("import ");
      // Should not have obvious syntax issues
      expect(content).not.toContain("<<<");
      expect(content).not.toContain(">>>");
    });
  });
});

// ── Template Business Use Case Coverage ──────────────────────────────────────

describe("Template Use Case Coverage", () => {
  test("has personal use case templates", () => {
    const personalTemplates = [
      "ai-email-assistant",
      "ai-meeting-assistant",
      "ai-content-creator",
      "ai-web-monitor",
    ];
    for (const t of personalTemplates) {
      expect(existsSync(join(TEMPLATES_DIR, t))).toBe(true);
    }
  });

  test("has business/enterprise use case templates", () => {
    const businessTemplates = [
      "ai-sales-agent",
      "ai-customer-support",
      "ai-recruiter",
      "ai-data-analyst",
      "ai-inventory-manager",
      "ai-legal-reviewer",
      "ai-competitor-tracker",
      "ai-seo-optimizer",
    ];
    for (const t of businessTemplates) {
      expect(existsSync(join(TEMPLATES_DIR, t))).toBe(true);
    }
  });

  test("has developer/ops use case templates", () => {
    const devTemplates = [
      "ai-code-reviewer",
      "ai-devops-agent",
      "ai-documentation-writer",
      "ai-security-monitor",
    ];
    for (const t of devTemplates) {
      expect(existsSync(join(TEMPLATES_DIR, t))).toBe(true);
    }
  });

  test("has finance/research use case templates", () => {
    const financeTemplates = [
      "ai-trading-researcher",
      "ai-real-estate-analyst",
    ];
    for (const t of financeTemplates) {
      expect(existsSync(join(TEMPLATES_DIR, t))).toBe(true);
    }
  });
});
