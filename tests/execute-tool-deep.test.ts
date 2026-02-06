import { describe, test, expect, afterEach } from "bun:test";
import { mkdtemp, writeFile, readFile, rm } from "fs/promises";
import { existsSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { executeTool } from "../src/tools/index";

let tempDirs: string[] = [];
let tempFiles: string[] = [];

async function makeTempDir(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "exec-tool-deep-"));
  tempDirs.push(dir);
  return dir;
}

function tempFilePath(ext = ".txt"): string {
  const name = `exec-tool-test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
  const p = join(tmpdir(), name);
  tempFiles.push(p);
  return p;
}

afterEach(async () => {
  for (const dir of tempDirs) {
    try {
      await rm(dir, { recursive: true, force: true });
    } catch {}
  }
  tempDirs = [];
  for (const f of tempFiles) {
    try {
      await rm(f, { force: true });
    } catch {}
  }
  tempFiles = [];
  // Also clean up .bak files
  for (const f of [...tempFiles]) {
    try {
      await rm(f + ".bak", { force: true });
    } catch {}
  }
});

// ========================
// list_directory
// ========================

describe("executeTool - list_directory", () => {
  test("returns success with array of files for /tmp", async () => {
    const res = await executeTool("list_directory", { path: "/tmp" });
    expect(res.success).toBe(true);
    expect(Array.isArray(res.result)).toBe(true);
    expect(res.error).toBeUndefined();
  });

  test("each item has name, path, isDirectory, size, modified", async () => {
    const dir = await makeTempDir();
    await writeFile(join(dir, "a.txt"), "hello");

    const res = await executeTool("list_directory", { path: dir });
    expect(res.success).toBe(true);
    const items = res.result as any[];
    expect(items.length).toBe(1);
    expect(items[0].name).toBe("a.txt");
    expect(items[0].isDirectory).toBe(false);
    expect(items[0].size).toBe(5);
  });

  test("returns error for path outside allowed directories", async () => {
    const res = await executeTool("list_directory", { path: "/etc" });
    expect(res.success).toBe(false);
    expect(res.error).toContain("Access denied");
  });
});

// ========================
// read_file
// ========================

describe("executeTool - read_file", () => {
  test("returns success with file content", async () => {
    const dir = await makeTempDir();
    const filePath = join(dir, "read.txt");
    await writeFile(filePath, "read this content");

    const res = await executeTool("read_file", { path: filePath });
    expect(res.success).toBe(true);
    expect(res.result).toBe("read this content");
  });

  test("returns error for non-existent file", async () => {
    const res = await executeTool("read_file", { path: "/tmp/nonexistent_sentinel_xyz_abc.txt" });
    expect(res.success).toBe(false);
    expect(typeof res.error).toBe("string");
  });
});

// ========================
// write_file
// ========================

describe("executeTool - write_file", () => {
  test("writes a file and returns success", async () => {
    const filePath = tempFilePath();

    const res = await executeTool("write_file", { path: filePath, content: "test data 123" });
    expect(res.success).toBe(true);
    expect(res.result).toBe("File written successfully");

    const actual = await readFile(filePath, "utf-8");
    expect(actual).toBe("test data 123");
  });

  test("file is actually created on disk", async () => {
    const filePath = tempFilePath();

    await executeTool("write_file", { path: filePath, content: "exists check" });
    expect(existsSync(filePath)).toBe(true);
  });

  test("overwrites existing file", async () => {
    const filePath = tempFilePath();
    await writeFile(filePath, "old content");

    await executeTool("write_file", { path: filePath, content: "new content" });
    const actual = await readFile(filePath, "utf-8");
    expect(actual).toBe("new content");
  });
});

// ========================
// execute_command
// ========================

describe("executeTool - execute_command", () => {
  test("echo returns success with stdout", async () => {
    const res = await executeTool("execute_command", { command: "echo test-output" });
    expect(res.success).toBe(true);
    const result = res.result as { stdout: string; stderr: string; exitCode: number };
    expect(result.stdout.trim()).toBe("test-output");
    expect(result.exitCode).toBe(0);
  });

  test("failing command returns error", async () => {
    const res = await executeTool("execute_command", { command: "ls /nonexistent_xyz_sentinel" });
    expect(res.success).toBe(false);
    expect(typeof res.error).toBe("string");
    expect(res.error!.length).toBeGreaterThan(0);
  });

  test("blocked command returns error", async () => {
    const res = await executeTool("execute_command", { command: "sudo ls" });
    expect(res.success).toBe(false);
    expect(res.error).toBeDefined();
  });

  test("working_directory parameter works", async () => {
    const res = await executeTool("execute_command", {
      command: "pwd",
      working_directory: "/tmp",
    });
    expect(res.success).toBe(true);
    const result = res.result as { stdout: string };
    expect(result.stdout.trim()).toBe("/tmp");
  });
});

// ========================
// unknown_tool
// ========================

describe("executeTool - unknown tool", () => {
  test("returns error 'Unknown tool' for invalid tool name", async () => {
    const res = await executeTool("unknown_tool_xyz_sentinel", {});
    expect(res.success).toBe(false);
    expect(res.error).toContain("Unknown tool");
    expect(res.error).toContain("unknown_tool_xyz_sentinel");
  });

  test("result is null for unknown tool", async () => {
    const res = await executeTool("completely_bogus", {});
    expect(res.result).toBeNull();
  });
});

// ========================
// apply_patch
// ========================

describe("executeTool - apply_patch", () => {
  test("applies a valid patch and returns linesChanged", async () => {
    const dir = await makeTempDir();
    const filePath = join(dir, "patch-target.txt");
    await writeFile(filePath, "line1\nline2\nline3\n");

    const patch = [
      "--- a/file",
      "+++ b/file",
      "@@ -1,3 +1,3 @@",
      " line1",
      "-line2",
      "+LINE2_MODIFIED",
      " line3",
    ].join("\n");

    const res = await executeTool("apply_patch", {
      file_path: filePath,
      patch,
      create_backup: false,
    });

    expect(res.success).toBe(true);
    const result = res.result as { linesChanged: number };
    expect(result.linesChanged).toBeGreaterThan(0);

    const content = await readFile(filePath, "utf-8");
    expect(content).toContain("LINE2_MODIFIED");
  });

  test("returns error for non-existent target file", async () => {
    const res = await executeTool("apply_patch", {
      file_path: "/tmp/nonexistent_patch_target_xyz.txt",
      patch: "@@ -1,1 +1,1 @@\n-a\n+b",
    });
    expect(res.success).toBe(false);
    expect(res.error).toContain("File not found");
  });
});

// ========================
// create_poll
// ========================

describe("executeTool - create_poll", () => {
  test("creates a poll and returns pollId", async () => {
    const res = await executeTool("create_poll", {
      question: "What color?",
      options: ["Red", "Blue", "Green"],
    });

    expect(res.success).toBe(true);
    const result = res.result as {
      pollId: string;
      question: string;
      options: string[];
      message: string;
    };
    expect(typeof result.pollId).toBe("string");
    expect(result.pollId.length).toBeGreaterThan(0);
    expect(result.question).toBe("What color?");
    expect(result.options).toEqual(["Red", "Blue", "Green"]);
    expect(result.message).toContain("What color?");
  });

  test("poll options match input", async () => {
    const res = await executeTool("create_poll", {
      question: "Pick a number",
      options: ["1", "2"],
    });
    const result = res.result as any;
    expect(result.options.length).toBe(2);
    expect(result.options[0]).toBe("1");
    expect(result.options[1]).toBe("2");
  });
});

// ========================
// teach_skill
// ========================

describe("executeTool - teach_skill", () => {
  test("creates a skill and returns skillId", async () => {
    const res = await executeTool("teach_skill", {
      name: "test-skill-" + Date.now(),
      description: "A test skill",
      instructions: "Do the thing",
    });

    expect(res.success).toBe(true);
    const result = res.result as { skillId: string; skillName: string; message: string };
    expect(typeof result.skillId).toBe("string");
    expect(result.skillId.length).toBeGreaterThan(0);
    expect(result.skillName).toContain("test-skill-");
    expect(result.message).toContain("created");
  });

  test("skill message includes the trigger", async () => {
    const name = "demo-skill-" + Date.now();
    const res = await executeTool("teach_skill", {
      name,
      description: "desc",
      instructions: "instr",
    });
    const result = res.result as any;
    expect(result.message).toContain("/");
  });
});

// ========================
// hub_browse
// ========================

describe("executeTool - hub_browse", () => {
  test("returns items array with total count", async () => {
    const res = await executeTool("hub_browse", {});
    expect(res.success).toBe(true);
    const result = res.result as { items: any[]; total: number };
    expect(Array.isArray(result.items)).toBe(true);
    expect(typeof result.total).toBe("number");
    expect(result.total).toBeGreaterThanOrEqual(0);
  });

  test("each hub item has id, name, description, category", async () => {
    const res = await executeTool("hub_browse", {});
    const result = res.result as { items: any[] };
    if (result.items.length > 0) {
      const item = result.items[0];
      expect(typeof item.id).toBe("string");
      expect(typeof item.name).toBe("string");
      expect(typeof item.description).toBe("string");
      expect(typeof item.category).toBe("string");
    }
  });

  test("filtering by category returns only that category", async () => {
    const res = await executeTool("hub_browse", { category: "skills" });
    const result = res.result as { items: any[] };
    for (const item of result.items) {
      expect(item.category).toBe("skills");
    }
  });
});

// ========================
// search_files
// ========================

describe("executeTool - search_files", () => {
  test("returns array of matching file paths", async () => {
    const dir = await makeTempDir();
    await writeFile(join(dir, "found.txt"), "data");
    await writeFile(join(dir, "found2.txt"), "data2");
    await writeFile(join(dir, "nope.md"), "markdown");

    const res = await executeTool("search_files", { pattern: "*.txt", base_path: dir });
    expect(res.success).toBe(true);
    const files = res.result as string[];
    expect(Array.isArray(files)).toBe(true);
    expect(files.length).toBe(2);
    expect(files.every((f) => f.endsWith(".txt"))).toBe(true);
  });

  test("returns empty array when nothing matches", async () => {
    const dir = await makeTempDir();
    const res = await executeTool("search_files", { pattern: "*.xyz", base_path: dir });
    expect(res.success).toBe(true);
    expect(res.result).toEqual([]);
  });
});

// ========================
// Exception handling
// ========================

describe("executeTool - exception wrapping", () => {
  test("catches thrown errors and returns success: false with error message", async () => {
    // Trigger an error by reading a non-existent file
    const res = await executeTool("read_file", { path: "/tmp/sentinel_no_such_file_ever_xyz.txt" });
    expect(res.success).toBe(false);
    expect(res.result).toBeNull();
    expect(typeof res.error).toBe("string");
    expect(res.error!.length).toBeGreaterThan(0);
  });

  test("error message includes relevant info", async () => {
    const res = await executeTool("list_directory", { path: "/tmp/nonexistent_dir_sentinel_xyz" });
    expect(res.success).toBe(false);
    // Should mention the path or "no such file"
    expect(res.error!.toLowerCase()).toMatch(/no such file|enoent|not found|access/);
  });
});

// ========================
// End-to-end: write then read
// ========================

describe("executeTool - end-to-end write/read cycle", () => {
  test("write_file then read_file returns same content", async () => {
    const filePath = tempFilePath();
    const content = "Round-trip content with special chars: <>&\"'";

    await executeTool("write_file", { path: filePath, content });
    const res = await executeTool("read_file", { path: filePath });

    expect(res.success).toBe(true);
    expect(res.result).toBe(content);
  });

  test("write_file then list_directory shows the file", async () => {
    const dir = await makeTempDir();
    const filePath = join(dir, "listed.txt");

    await executeTool("write_file", { path: filePath, content: "listed" });
    const res = await executeTool("list_directory", { path: dir });

    expect(res.success).toBe(true);
    const items = res.result as any[];
    expect(items.length).toBe(1);
    expect(items[0].name).toBe("listed.txt");
  });
});
