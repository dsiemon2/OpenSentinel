import { describe, test, expect, afterEach } from "bun:test";
import { mkdtemp, writeFile as fsWriteFile, readFile as fsReadFile, rm, mkdir } from "fs/promises";
import { existsSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import {
  listDirectory,
  readFileContent,
  writeFileContent,
  searchFiles,
} from "../src/tools/files";

let tempDirs: string[] = [];

async function makeTempDir(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "files-deep-test-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(async () => {
  for (const dir of tempDirs) {
    try {
      await rm(dir, { recursive: true, force: true });
    } catch {
      // ignore cleanup errors
    }
  }
  tempDirs = [];
});

// ========================
// listDirectory
// ========================

describe("Files - listDirectory", () => {
  test("lists files in a temp directory with correct names", async () => {
    const dir = await makeTempDir();
    await fsWriteFile(join(dir, "alpha.txt"), "aaa");
    await fsWriteFile(join(dir, "beta.txt"), "bbb");

    const result = await listDirectory(dir);
    expect(result.length).toBe(2);

    const names = result.map((f) => f.name).sort();
    expect(names).toEqual(["alpha.txt", "beta.txt"]);
  });

  test("returns correct size for each file", async () => {
    const dir = await makeTempDir();
    await fsWriteFile(join(dir, "small.txt"), "hi");
    await fsWriteFile(join(dir, "bigger.txt"), "hello world, this is bigger");

    const result = await listDirectory(dir);
    const small = result.find((f) => f.name === "small.txt");
    const bigger = result.find((f) => f.name === "bigger.txt");

    expect(small).toBeDefined();
    expect(bigger).toBeDefined();
    expect(small!.size).toBe(2);
    expect(bigger!.size).toBeGreaterThan(small!.size);
  });

  test("distinguishes files from subdirectories via isDirectory", async () => {
    const dir = await makeTempDir();
    await fsWriteFile(join(dir, "file.txt"), "data");
    await mkdir(join(dir, "subdir"));

    const result = await listDirectory(dir);
    const file = result.find((f) => f.name === "file.txt");
    const sub = result.find((f) => f.name === "subdir");

    expect(file).toBeDefined();
    expect(sub).toBeDefined();
    expect(file!.isDirectory).toBe(false);
    expect(sub!.isDirectory).toBe(true);
  });

  test("returns empty array for an empty directory", async () => {
    const dir = await makeTempDir();
    const result = await listDirectory(dir);
    expect(result).toEqual([]);
  });

  test("throws for a non-existent directory", async () => {
    await expect(listDirectory("/tmp/nonexistent_dir_xyz_abc_123")).rejects.toThrow();
  });

  test("each entry has a path field that is an absolute path", async () => {
    const dir = await makeTempDir();
    await fsWriteFile(join(dir, "test.txt"), "x");

    const result = await listDirectory(dir);
    expect(result[0].path.startsWith("/")).toBe(true);
    expect(result[0].path).toBe(join(dir, "test.txt"));
  });

  test("each entry has a modified Date", async () => {
    const dir = await makeTempDir();
    await fsWriteFile(join(dir, "dated.txt"), "hello");

    const result = await listDirectory(dir);
    expect(result[0].modified).toBeInstanceOf(Date);
    // Should be very recent (within last 10 seconds)
    const age = Date.now() - result[0].modified.getTime();
    expect(age).toBeLessThan(10000);
  });
});

// ========================
// readFileContent
// ========================

describe("Files - readFileContent", () => {
  test("reads back exact content that was written", async () => {
    const dir = await makeTempDir();
    const filePath = join(dir, "read-test.txt");
    const content = "Hello, this is a test file.\nWith multiple lines.\n";
    await fsWriteFile(filePath, content, "utf-8");

    const result = await readFileContent(filePath);
    expect(result).toBe(content);
  });

  test("throws 'File too large' when file exceeds maxSize", async () => {
    const dir = await makeTempDir();
    const filePath = join(dir, "big.txt");
    // Write 200 bytes, then ask for maxSize of 100
    await fsWriteFile(filePath, "A".repeat(200), "utf-8");

    await expect(readFileContent(filePath, 100)).rejects.toThrow("File too large");
  });

  test("throws for a non-existent file", async () => {
    await expect(readFileContent("/tmp/nonexistent_file_xyz_abc_123.txt")).rejects.toThrow();
  });

  test("returns empty string for an empty file", async () => {
    const dir = await makeTempDir();
    const filePath = join(dir, "empty.txt");
    await fsWriteFile(filePath, "", "utf-8");

    const result = await readFileContent(filePath);
    expect(result).toBe("");
  });

  test("reads unicode content correctly", async () => {
    const dir = await makeTempDir();
    const filePath = join(dir, "unicode.txt");
    const unicode = "Hello \u4e16\u754c \ud83c\udf0d caf\u00e9 \u00fc\u00f6\u00e4";
    await fsWriteFile(filePath, unicode, "utf-8");

    const result = await readFileContent(filePath);
    expect(result).toBe(unicode);
  });

  test("succeeds when file size equals maxSize exactly", async () => {
    const dir = await makeTempDir();
    const filePath = join(dir, "exact.txt");
    const content = "X".repeat(50);
    await fsWriteFile(filePath, content, "utf-8");

    // maxSize = 50, file is 50 bytes
    const result = await readFileContent(filePath, 50);
    expect(result).toBe(content);
  });
});

// ========================
// writeFileContent
// ========================

describe("Files - writeFileContent", () => {
  test("writes content that can be verified with fs.readFile", async () => {
    const dir = await makeTempDir();
    const filePath = join(dir, "write-test.txt");
    const content = "Written by writeFileContent test";

    await writeFileContent(filePath, content);

    const read = await fsReadFile(filePath, "utf-8");
    expect(read).toBe(content);
  });

  test("creates parent directories automatically (nested path)", async () => {
    const dir = await makeTempDir();
    const filePath = join(dir, "a", "b", "c", "nested.txt");

    await writeFileContent(filePath, "nested content");

    expect(existsSync(filePath)).toBe(true);
    const read = await fsReadFile(filePath, "utf-8");
    expect(read).toBe("nested content");
  });

  test("overwrites an existing file", async () => {
    const dir = await makeTempDir();
    const filePath = join(dir, "overwrite.txt");

    await writeFileContent(filePath, "original");
    await writeFileContent(filePath, "replaced");

    const read = await fsReadFile(filePath, "utf-8");
    expect(read).toBe("replaced");
  });

  test("writes unicode content correctly", async () => {
    const dir = await makeTempDir();
    const filePath = join(dir, "unicode-write.txt");
    const unicode = "\u2603 \u2764 \u2728 \u00e4\u00f6\u00fc\u00df \u4e2d\u6587";

    await writeFileContent(filePath, unicode);

    const read = await fsReadFile(filePath, "utf-8");
    expect(read).toBe(unicode);
  });

  test("writes empty string without error", async () => {
    const dir = await makeTempDir();
    const filePath = join(dir, "empty-write.txt");

    await writeFileContent(filePath, "");

    const read = await fsReadFile(filePath, "utf-8");
    expect(read).toBe("");
  });
});

// ========================
// searchFiles
// ========================

describe("Files - searchFiles", () => {
  test("finds files matching a glob pattern", async () => {
    const dir = await makeTempDir();
    await fsWriteFile(join(dir, "one.txt"), "1");
    await fsWriteFile(join(dir, "two.txt"), "2");
    await fsWriteFile(join(dir, "three.md"), "3");

    const results = await searchFiles("*.txt", dir);
    expect(results.length).toBe(2);
    expect(results.every((f) => f.endsWith(".txt"))).toBe(true);
  });

  test("returns absolute paths", async () => {
    const dir = await makeTempDir();
    await fsWriteFile(join(dir, "abs.txt"), "data");

    const results = await searchFiles("*.txt", dir);
    expect(results.length).toBe(1);
    expect(results[0].startsWith("/")).toBe(true);
  });

  test("excludes node_modules by default", async () => {
    const dir = await makeTempDir();
    await mkdir(join(dir, "node_modules"), { recursive: true });
    await fsWriteFile(join(dir, "node_modules", "hidden.txt"), "x");
    await fsWriteFile(join(dir, "visible.txt"), "y");

    const results = await searchFiles("**/*.txt", dir);
    expect(results.some((f) => f.includes("node_modules"))).toBe(false);
    expect(results.some((f) => f.includes("visible.txt"))).toBe(true);
  });

  test("returns empty array when no files match", async () => {
    const dir = await makeTempDir();
    await fsWriteFile(join(dir, "file.md"), "data");

    const results = await searchFiles("*.xyz", dir);
    expect(results).toEqual([]);
  });

  test("finds files in subdirectories with ** glob", async () => {
    const dir = await makeTempDir();
    await mkdir(join(dir, "sub"), { recursive: true });
    await fsWriteFile(join(dir, "sub", "deep.txt"), "deep");

    const results = await searchFiles("**/*.txt", dir);
    expect(results.length).toBe(1);
    expect(results[0]).toContain("deep.txt");
  });
});

// ========================
// Security - isPathAllowed
// ========================

describe("Files - Security (path restrictions)", () => {
  test("listDirectory rejects paths outside HOME and /tmp", async () => {
    await expect(listDirectory("/etc")).rejects.toThrow("Access denied");
  });

  test("readFileContent rejects /etc/passwd", async () => {
    await expect(readFileContent("/etc/passwd")).rejects.toThrow("Access denied");
  });

  test("writeFileContent rejects writing to /var/something", async () => {
    await expect(writeFileContent("/var/test-sentinel-xyz.txt", "x")).rejects.toThrow(
      "Access denied"
    );
  });

  test("searchFiles rejects base path outside allowed directories", async () => {
    await expect(searchFiles("*", "/etc")).rejects.toThrow("Access denied");
  });

  test("/tmp paths are allowed", async () => {
    const dir = await makeTempDir();
    await fsWriteFile(join(dir, "ok.txt"), "allowed");

    // Should not throw
    const result = await readFileContent(join(dir, "ok.txt"));
    expect(result).toBe("allowed");
  });
});
