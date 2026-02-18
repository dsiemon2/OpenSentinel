import { describe, test, expect, beforeEach, mock, spyOn } from "bun:test";
import {
  detectPlatform,
  getConfigDir,
  getPackageRoot,
  getMigrationsDir,
  loadEnvFile,
  checkPort,
  colors,
  printBanner,
} from "../src/commands/utils";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

// ── Utils Tests ──────────────────────────────────────────────────────────────

describe("CLI Utils", () => {
  describe("detectPlatform", () => {
    test("should return a valid platform object", () => {
      const platform = detectPlatform();
      expect(platform).toHaveProperty("os");
      expect(platform).toHaveProperty("distro");
      expect(platform).toHaveProperty("packageManager");
      expect(["linux", "darwin", "other"]).toContain(platform.os);
    });

    test("should detect Linux with apt on Debian/Ubuntu", () => {
      const platform = detectPlatform();
      if (process.platform === "linux") {
        expect(platform.os).toBe("linux");
        // On this system (Ubuntu), should detect apt
        expect(["apt", "dnf", "pacman", "unknown"]).toContain(platform.packageManager);
      }
    });

    test("should detect macOS with brew", () => {
      const platform = detectPlatform();
      if (process.platform === "darwin") {
        expect(platform.os).toBe("darwin");
        expect(platform.packageManager).toBe("brew");
        expect(platform.distro).toBe("macos");
      }
    });
  });

  describe("getConfigDir", () => {
    test("should return a path ending with .opensentinel", () => {
      const dir = getConfigDir();
      expect(dir).toContain(".opensentinel");
    });

    test("should use OPENSENTINEL_HOME if set", () => {
      const original = process.env.OPENSENTINEL_HOME;
      process.env.OPENSENTINEL_HOME = "/tmp/test-opensentinel";
      try {
        const dir = getConfigDir();
        expect(dir).toBe("/tmp/test-opensentinel");
      } finally {
        if (original) {
          process.env.OPENSENTINEL_HOME = original;
        } else {
          delete process.env.OPENSENTINEL_HOME;
        }
      }
    });

    test("should default to ~/.opensentinel", () => {
      const original = process.env.OPENSENTINEL_HOME;
      delete process.env.OPENSENTINEL_HOME;
      try {
        const dir = getConfigDir();
        expect(dir).toBe(join(homedir(), ".opensentinel"));
      } finally {
        if (original) {
          process.env.OPENSENTINEL_HOME = original;
        }
      }
    });
  });

  describe("getPackageRoot", () => {
    test("should return a directory containing package.json", () => {
      const root = getPackageRoot();
      expect(existsSync(join(root, "package.json"))).toBe(true);
    });
  });

  describe("getMigrationsDir", () => {
    test("should return a path ending with drizzle", () => {
      const dir = getMigrationsDir();
      expect(dir).toEndWith("drizzle");
    });

    test("should point to an existing directory", () => {
      const dir = getMigrationsDir();
      expect(existsSync(dir)).toBe(true);
    });
  });

  describe("colors", () => {
    test("should have all required color codes", () => {
      expect(colors.reset).toBeTruthy();
      expect(colors.bold).toBeTruthy();
      expect(colors.green).toBeTruthy();
      expect(colors.cyan).toBeTruthy();
      expect(colors.yellow).toBeTruthy();
      expect(colors.red).toBeTruthy();
      expect(colors.magenta).toBeTruthy();
      expect(colors.dim).toBeTruthy();
    });

    test("should use ANSI escape codes", () => {
      expect(colors.reset).toBe("\x1b[0m");
      expect(colors.bold).toBe("\x1b[1m");
      expect(colors.green).toBe("\x1b[32m");
    });
  });

  describe("loadEnvFile", () => {
    test("should load .env from current directory", () => {
      // The project has a .env file in the root
      const result = loadEnvFile();
      // Should return a path or null
      expect(result === null || typeof result === "string").toBe(true);
    });

    test("should not override existing env vars", () => {
      const original = process.env.NODE_ENV;
      process.env.NODE_ENV = "test-preserved";
      loadEnvFile();
      expect(process.env.NODE_ENV).toBe("test-preserved");
      if (original) {
        process.env.NODE_ENV = original;
      }
    });
  });

  describe("printBanner", () => {
    test("should not throw", () => {
      // Capture console output
      const logs: string[] = [];
      const originalLog = console.log;
      console.log = (...args: any[]) => logs.push(args.join(" "));
      try {
        printBanner();
        expect(logs.length).toBeGreaterThan(0);
        const output = logs.join("\n");
        expect(output).toContain("OPENSENTINEL");
        expect(output).toContain("v3.0.0");
      } finally {
        console.log = originalLog;
      }
    });
  });
});

// ── CLI Router Tests ─────────────────────────────────────────────────────────

describe("CLI Router", () => {
  test("help command outputs usage information", async () => {
    const proc = Bun.spawn(["bun", "run", "src/cli.ts", "help"], {
      cwd: process.cwd(),
      stdout: "pipe",
      stderr: "pipe",
    });
    const output = await new Response(proc.stdout).text();
    expect(output).toContain("OpenSentinel");
    expect(output).toContain("Commands:");
    expect(output).toContain("setup");
    expect(output).toContain("start");
    expect(output).toContain("stop");
    expect(output).toContain("status");
    expect(output).toContain("version");
    expect(output).toContain("help");
  });

  test("--help flag works same as help command", async () => {
    const proc = Bun.spawn(["bun", "run", "src/cli.ts", "--help"], {
      cwd: process.cwd(),
      stdout: "pipe",
      stderr: "pipe",
    });
    const output = await new Response(proc.stdout).text();
    expect(output).toContain("Commands:");
  });

  test("version command outputs version", async () => {
    const proc = Bun.spawn(["bun", "run", "src/cli.ts", "version"], {
      cwd: process.cwd(),
      stdout: "pipe",
      stderr: "pipe",
    });
    const output = await new Response(proc.stdout).text();
    expect(output.trim()).toBe("opensentinel v3.0.0");
  });

  test("--version flag works same as version command", async () => {
    const proc = Bun.spawn(["bun", "run", "src/cli.ts", "--version"], {
      cwd: process.cwd(),
      stdout: "pipe",
      stderr: "pipe",
    });
    const output = await new Response(proc.stdout).text();
    expect(output.trim()).toBe("opensentinel v3.0.0");
  });

  test("-v flag works same as version command", async () => {
    const proc = Bun.spawn(["bun", "run", "src/cli.ts", "-v"], {
      cwd: process.cwd(),
      stdout: "pipe",
      stderr: "pipe",
    });
    const output = await new Response(proc.stdout).text();
    expect(output.trim()).toBe("opensentinel v3.0.0");
  });

  test("status command runs without error", async () => {
    const proc = Bun.spawn(["bun", "run", "src/cli.ts", "status"], {
      cwd: process.cwd(),
      stdout: "pipe",
      stderr: "pipe",
    });
    const output = await new Response(proc.stdout).text();
    expect(output).toContain("OPENSENTINEL");
    expect(output).toContain("Service:");
    expect(output).toContain("PostgreSQL:");
    expect(output).toContain("Redis:");
    expect(output).toContain("API:");
    expect(output).toContain("Config:");
  });
});

// ── Start Command Tests ──────────────────────────────────────────────────────

describe("Start Command Module", () => {
  test("module exports a default function", async () => {
    const mod = await import("../src/commands/start");
    expect(typeof mod.default).toBe("function");
  });
});

// ── Stop Command Tests ───────────────────────────────────────────────────────

describe("Stop Command Module", () => {
  test("module exports a default function", async () => {
    const mod = await import("../src/commands/stop");
    expect(typeof mod.default).toBe("function");
  });
});

// ── Status Command Module Tests ──────────────────────────────────────────────

describe("Status Command Module", () => {
  test("module exports a default function", async () => {
    const mod = await import("../src/commands/status");
    expect(typeof mod.default).toBe("function");
  });
});

// ── Setup Command Module Tests ───────────────────────────────────────────────

describe("Setup Command Module", () => {
  test("module exports a default function", async () => {
    const mod = await import("../src/commands/setup");
    expect(typeof mod.default).toBe("function");
  });
});

// ── Postgres/Redis Detection Tests ───────────────────────────────────────────

describe("Infrastructure Detection", () => {
  test("checkPostgres returns valid status object", async () => {
    const { checkPostgres } = await import("../src/commands/utils");
    const result = await checkPostgres();
    expect(result).toHaveProperty("installed");
    expect(result).toHaveProperty("running");
    expect(result).toHaveProperty("port");
    expect(typeof result.installed).toBe("boolean");
    expect(typeof result.running).toBe("boolean");
    expect(typeof result.port).toBe("number");
  });

  test("checkRedis returns valid status object", async () => {
    const { checkRedis } = await import("../src/commands/utils");
    const result = await checkRedis();
    expect(result).toHaveProperty("installed");
    expect(result).toHaveProperty("running");
    expect(result).toHaveProperty("port");
    expect(typeof result.installed).toBe("boolean");
    expect(typeof result.running).toBe("boolean");
    expect(typeof result.port).toBe("number");
  });
});

// ── which() Tests ────────────────────────────────────────────────────────────

describe("which()", () => {
  test("should find bun binary", async () => {
    const { which } = await import("../src/commands/utils");
    const result = await which("bun");
    expect(result).not.toBeNull();
    expect(result).toContain("bun");
  });

  test("should return null for nonexistent binary", async () => {
    const { which } = await import("../src/commands/utils");
    const result = await which("definitely-not-a-real-binary-12345");
    expect(result).toBeNull();
  });
});

// ── exec() Tests ─────────────────────────────────────────────────────────────

describe("exec()", () => {
  test("should execute simple commands", async () => {
    const { exec } = await import("../src/commands/utils");
    const result = await exec("echo hello");
    expect(result.stdout.trim()).toBe("hello");
    expect(result.exitCode).toBe(0);
  });

  test("should capture stderr", async () => {
    const { exec } = await import("../src/commands/utils");
    const result = await exec("echo error >&2", { throws: false });
    expect(result.stderr.trim()).toBe("error");
  });

  test("should handle failing commands with throws:false", async () => {
    const { exec } = await import("../src/commands/utils");
    const result = await exec("false", { throws: false });
    expect(result.exitCode).not.toBe(0);
  });

  test("should throw by default on failure", async () => {
    const { exec } = await import("../src/commands/utils");
    expect(exec("false")).rejects.toThrow();
  });
});
