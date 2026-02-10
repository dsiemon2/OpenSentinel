import { describe, test, expect } from "bun:test";
import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dirname, "..");

describe("install.sh", () => {
  const scriptPath = join(ROOT, "install.sh");

  test("exists", () => {
    expect(existsSync(scriptPath)).toBe(true);
  });

  test("is executable", () => {
    const stats = statSync(scriptPath);
    // Check owner execute bit (0o100)
    expect(stats.mode & 0o100).toBeTruthy();
  });

  test("starts with proper shebang", () => {
    const content = readFileSync(scriptPath, "utf-8");
    expect(content.startsWith("#!/usr/bin/env bash")).toBe(true);
  });

  test("has set -euo pipefail for safety", () => {
    const content = readFileSync(scriptPath, "utf-8");
    expect(content).toContain("set -euo pipefail");
  });

  test("checks for and installs Bun", () => {
    const content = readFileSync(scriptPath, "utf-8");
    expect(content).toContain("bun");
    expect(content).toContain("bun.sh/install");
  });

  test("installs opensentinel globally", () => {
    const content = readFileSync(scriptPath, "utf-8");
    expect(content).toContain("bun install -g opensentinel");
  });

  test("runs opensentinel setup", () => {
    const content = readFileSync(scriptPath, "utf-8");
    expect(content).toContain("opensentinel setup");
  });
});

describe("Project Structure", () => {
  test("package.json has correct bin entry", () => {
    const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf-8"));
    expect(pkg.bin).toHaveProperty("opensentinel");
    expect(pkg.bin.opensentinel).toBe("./dist/cli.js");
  });

  test("package.json includes drizzle in files", () => {
    const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf-8"));
    expect(pkg.files).toContain("drizzle");
  });

  test("package.json name is opensentinel", () => {
    const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf-8"));
    expect(pkg.name).toBe("opensentinel");
  });

  test("package.json version is 2.0.0", () => {
    const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf-8"));
    expect(pkg.version).toBe("2.0.0");
  });

  test(".env.example exists", () => {
    expect(existsSync(join(ROOT, ".env.example"))).toBe(true);
  });

  test("drizzle migrations directory exists", () => {
    expect(existsSync(join(ROOT, "drizzle"))).toBe(true);
  });

  test("Dockerfile has optional header", () => {
    const content = readFileSync(join(ROOT, "Dockerfile"), "utf-8");
    expect(content).toContain("OPTIONAL");
  });

  test("docker-compose.yml has optional header", () => {
    const content = readFileSync(join(ROOT, "docker-compose.yml"), "utf-8");
    expect(content).toContain("OPTIONAL");
  });

  test("tsup.config.ts includes command entry points", () => {
    const content = readFileSync(join(ROOT, "tsup.config.ts"), "utf-8");
    expect(content).toContain("commands/start");
    expect(content).toContain("commands/setup");
    expect(content).toContain("commands/stop");
    expect(content).toContain("commands/status");
  });
});

describe("Website", () => {
  const websiteDir = join(ROOT, "website");

  test("index.html exists", () => {
    expect(existsSync(join(websiteDir, "index.html"))).toBe(true);
  });

  test("splash page shows curl install command", () => {
    const content = readFileSync(join(websiteDir, "index.html"), "utf-8");
    expect(content).toContain("curl -fsSL https://opensentinel.ai/install.sh");
  });

  test("splash page shows npm install option", () => {
    const content = readFileSync(join(websiteDir, "index.html"), "utf-8");
    expect(content).toContain("npm install");
  });

  test("splash page shows opensentinel setup command", () => {
    const content = readFileSync(join(websiteDir, "index.html"), "utf-8");
    expect(content).toContain("opensentinel setup");
  });

  test("docs getting-started.html shows native install as primary", () => {
    const content = readFileSync(join(websiteDir, "docs", "getting-started.html"), "utf-8");
    expect(content).toContain("curl -fsSL https://opensentinel.ai/install.sh");
    expect(content).toContain("npm install -g opensentinel");
  });

  test("docs marks Docker as optional", () => {
    const content = readFileSync(join(websiteDir, "docs", "getting-started.html"), "utf-8");
    expect(content).toContain("optional");
  });
});
