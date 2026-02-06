import { describe, test, expect, afterEach } from "bun:test";
import { mkdtemp, writeFile, readFile, rm } from "fs/promises";
import { existsSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { applyPatch } from "../src/tools/patch";

let tempDir: string;

// Helper to create a fresh temp directory for each test
async function makeTempDir(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "patch-test-"));
  tempDir = dir;
  return dir;
}

// Clean up after each test
afterEach(async () => {
  if (tempDir) {
    try {
      await rm(tempDir, { recursive: true, force: true });
    } catch {
      // ignore cleanup errors
    }
  }
});

describe("Patch Tool - applyPatch", () => {
  describe("Module exports", () => {
    test("applyPatch function exists and is exported", async () => {
      const mod = await import("../src/tools/patch");
      expect(typeof mod.applyPatch).toBe("function");
    });

    test("applyPatch is an async function (returns a promise)", async () => {
      const dir = await makeTempDir();
      const filePath = join(dir, "test.txt");
      await writeFile(filePath, "hello\n", "utf-8");
      const result = applyPatch(filePath, "");
      expect(result).toBeInstanceOf(Promise);
      await result; // let it settle
    });
  });

  describe("Apply valid patch", () => {
    test("should apply a simple single-line replacement patch", async () => {
      const dir = await makeTempDir();
      const filePath = join(dir, "file.txt");
      await writeFile(filePath, "line1\nline2\nline3\n", "utf-8");

      const patch = [
        "--- a/file.txt",
        "+++ b/file.txt",
        "@@ -1,3 +1,3 @@",
        " line1",
        "-line2",
        "+line2_modified",
        " line3",
      ].join("\n");

      const result = await applyPatch(filePath, patch, false);
      expect(result.applied).toBe(true);
      expect(result.linesChanged).toBeGreaterThan(0);
      expect(result.error).toBeUndefined();

      const content = await readFile(filePath, "utf-8");
      expect(content).toContain("line2_modified");
      expect(content).not.toContain("\nline2\n");
    });

    test("should apply a patch that replaces multiple lines", async () => {
      const dir = await makeTempDir();
      const filePath = join(dir, "multi.txt");
      await writeFile(filePath, "alpha\nbeta\ngamma\ndelta\n", "utf-8");

      const patch = [
        "--- a/multi.txt",
        "+++ b/multi.txt",
        "@@ -1,4 +1,4 @@",
        " alpha",
        "-beta",
        "-gamma",
        "+BETA",
        "+GAMMA",
        " delta",
      ].join("\n");

      const result = await applyPatch(filePath, patch, false);
      expect(result.applied).toBe(true);

      const content = await readFile(filePath, "utf-8");
      expect(content).toContain("BETA");
      expect(content).toContain("GAMMA");
      expect(content).not.toContain("\nbeta\n");
      expect(content).not.toContain("\ngamma\n");
    });
  });

  describe("Non-existent file", () => {
    test("should return error when file does not exist", async () => {
      const dir = await makeTempDir();
      const fakePath = join(dir, "nonexistent.txt");

      const patch = [
        "@@ -1,1 +1,1 @@",
        "-old",
        "+new",
      ].join("\n");

      const result = await applyPatch(fakePath, patch);
      expect(result.applied).toBe(false);
      expect(result.linesChanged).toBe(0);
      expect(result.error).toContain("File not found");
      expect(result.error).toContain("nonexistent.txt");
    });

    test("should return error with the exact file path in message", async () => {
      const result = await applyPatch("/tmp/definitely_does_not_exist_12345.txt", "@@ -1,1 +1,1 @@\n-a\n+b");
      expect(result.applied).toBe(false);
      expect(result.error).toBe("File not found: /tmp/definitely_does_not_exist_12345.txt");
    });
  });

  describe("Invalid hunk headers", () => {
    test("should return error when patch has no valid hunks", async () => {
      const dir = await makeTempDir();
      const filePath = join(dir, "test.txt");
      await writeFile(filePath, "content\n", "utf-8");

      const patch = "This is not a valid patch at all\nNo hunks here";

      const result = await applyPatch(filePath, patch);
      expect(result.applied).toBe(false);
      expect(result.error).toBe("No valid hunks found in patch");
    });

    test("should return error when patch has only file headers but no hunks", async () => {
      const dir = await makeTempDir();
      const filePath = join(dir, "test.txt");
      await writeFile(filePath, "content\n", "utf-8");

      const patch = [
        "--- a/test.txt",
        "+++ b/test.txt",
      ].join("\n");

      const result = await applyPatch(filePath, patch);
      expect(result.applied).toBe(false);
      expect(result.error).toBe("No valid hunks found in patch");
    });

    test("should return error for garbled hunk header", async () => {
      const dir = await makeTempDir();
      const filePath = join(dir, "test.txt");
      await writeFile(filePath, "content\n", "utf-8");

      const patch = "@@ not-a-valid-header @@\n-old\n+new";

      const result = await applyPatch(filePath, patch);
      expect(result.applied).toBe(false);
      expect(result.error).toBe("No valid hunks found in patch");
    });
  });

  describe("Context mismatch", () => {
    test("should fail when context lines do not match file content", async () => {
      const dir = await makeTempDir();
      const filePath = join(dir, "mismatch.txt");
      await writeFile(filePath, "actual_line1\nactual_line2\nactual_line3\n", "utf-8");

      const patch = [
        "@@ -1,3 +1,3 @@",
        " wrong_context_line1",
        "-actual_line2",
        "+modified_line2",
        " wrong_context_line3",
      ].join("\n");

      const result = await applyPatch(filePath, patch, false);
      expect(result.applied).toBe(false);
      expect(result.error).toBe("Patch context does not match file content");
    });

    test("should fail when removed lines do not match file content", async () => {
      const dir = await makeTempDir();
      const filePath = join(dir, "mismatch2.txt");
      await writeFile(filePath, "line_A\nline_B\nline_C\n", "utf-8");

      const patch = [
        "@@ -1,3 +1,3 @@",
        " line_A",
        "-line_WRONG",
        "+line_NEW",
        " line_C",
      ].join("\n");

      const result = await applyPatch(filePath, patch, false);
      expect(result.applied).toBe(false);
      expect(result.error).toBe("Patch context does not match file content");
    });
  });

  describe("Backup file creation", () => {
    test("should create .bak file when createBackup is true (default)", async () => {
      const dir = await makeTempDir();
      const filePath = join(dir, "backup_default.txt");
      const originalContent = "foo\nbar\nbaz\n";
      await writeFile(filePath, originalContent, "utf-8");

      const patch = [
        "@@ -1,3 +1,3 @@",
        " foo",
        "-bar",
        "+BAR",
        " baz",
      ].join("\n");

      const result = await applyPatch(filePath, patch);
      expect(result.applied).toBe(true);
      expect(result.backup).toBe(`${filePath}.bak`);

      const bakExists = existsSync(`${filePath}.bak`);
      expect(bakExists).toBe(true);

      const bakContent = await readFile(`${filePath}.bak`, "utf-8");
      expect(bakContent).toBe(originalContent);
    });

    test("should create .bak file when createBackup is explicitly true", async () => {
      const dir = await makeTempDir();
      const filePath = join(dir, "backup_true.txt");
      await writeFile(filePath, "one\ntwo\nthree\n", "utf-8");

      const patch = [
        "@@ -1,3 +1,3 @@",
        " one",
        "-two",
        "+TWO",
        " three",
      ].join("\n");

      const result = await applyPatch(filePath, patch, true);
      expect(result.applied).toBe(true);
      expect(result.backup).toBe(`${filePath}.bak`);
      expect(existsSync(`${filePath}.bak`)).toBe(true);
    });

    test("should NOT create .bak file when createBackup is false", async () => {
      const dir = await makeTempDir();
      const filePath = join(dir, "no_backup.txt");
      await writeFile(filePath, "one\ntwo\nthree\n", "utf-8");

      const patch = [
        "@@ -1,3 +1,3 @@",
        " one",
        "-two",
        "+TWO",
        " three",
      ].join("\n");

      const result = await applyPatch(filePath, patch, false);
      expect(result.applied).toBe(true);
      expect(result.backup).toBeUndefined();
      expect(existsSync(`${filePath}.bak`)).toBe(false);
    });
  });

  describe("Patch that adds lines", () => {
    test("should add new lines to a file", async () => {
      const dir = await makeTempDir();
      const filePath = join(dir, "add_lines.txt");
      await writeFile(filePath, "first\nsecond\nthird\n", "utf-8");

      const patch = [
        "@@ -1,3 +1,5 @@",
        " first",
        "+inserted_a",
        "+inserted_b",
        " second",
        " third",
      ].join("\n");

      const result = await applyPatch(filePath, patch, false);
      expect(result.applied).toBe(true);
      expect(result.linesChanged).toBeGreaterThan(0);

      const content = await readFile(filePath, "utf-8");
      const lines = content.split("\n");
      expect(lines[0]).toBe("first");
      expect(lines[1]).toBe("inserted_a");
      expect(lines[2]).toBe("inserted_b");
      expect(lines[3]).toBe("second");
      expect(lines[4]).toBe("third");
    });

    test("should add lines at the end of a file", async () => {
      const dir = await makeTempDir();
      const filePath = join(dir, "add_end.txt");
      await writeFile(filePath, "aaa\nbbb\n", "utf-8");

      const patch = [
        "@@ -1,2 +1,4 @@",
        " aaa",
        " bbb",
        "+ccc",
        "+ddd",
      ].join("\n");

      const result = await applyPatch(filePath, patch, false);
      expect(result.applied).toBe(true);

      const content = await readFile(filePath, "utf-8");
      expect(content).toContain("ccc");
      expect(content).toContain("ddd");
    });
  });

  describe("Patch that removes lines", () => {
    test("should remove lines from a file", async () => {
      const dir = await makeTempDir();
      const filePath = join(dir, "remove_lines.txt");
      await writeFile(filePath, "keep1\nremove_me\nkeep2\n", "utf-8");

      const patch = [
        "@@ -1,3 +1,2 @@",
        " keep1",
        "-remove_me",
        " keep2",
      ].join("\n");

      const result = await applyPatch(filePath, patch, false);
      expect(result.applied).toBe(true);

      const content = await readFile(filePath, "utf-8");
      expect(content).not.toContain("remove_me");
      expect(content).toContain("keep1");
      expect(content).toContain("keep2");
    });

    test("should remove multiple consecutive lines", async () => {
      const dir = await makeTempDir();
      const filePath = join(dir, "remove_multi.txt");
      await writeFile(filePath, "header\ndelete1\ndelete2\ndelete3\nfooter\n", "utf-8");

      const patch = [
        "@@ -1,5 +1,2 @@",
        " header",
        "-delete1",
        "-delete2",
        "-delete3",
        " footer",
      ].join("\n");

      const result = await applyPatch(filePath, patch, false);
      expect(result.applied).toBe(true);

      const content = await readFile(filePath, "utf-8");
      expect(content).not.toContain("delete1");
      expect(content).not.toContain("delete2");
      expect(content).not.toContain("delete3");
      expect(content).toContain("header");
      expect(content).toContain("footer");
    });
  });

  describe("Empty patch content", () => {
    test("should return error for empty string patch", async () => {
      const dir = await makeTempDir();
      const filePath = join(dir, "empty_patch.txt");
      await writeFile(filePath, "some content\n", "utf-8");

      const result = await applyPatch(filePath, "");
      expect(result.applied).toBe(false);
      expect(result.error).toBe("No valid hunks found in patch");
    });

    test("should return error for whitespace-only patch", async () => {
      const dir = await makeTempDir();
      const filePath = join(dir, "whitespace_patch.txt");
      await writeFile(filePath, "some content\n", "utf-8");

      const result = await applyPatch(filePath, "   \n  \n   ");
      expect(result.applied).toBe(false);
      expect(result.error).toBe("No valid hunks found in patch");
    });
  });

  describe("Edge cases", () => {
    test("should not modify original file when patch fails context check", async () => {
      const dir = await makeTempDir();
      const filePath = join(dir, "untouched.txt");
      const originalContent = "original_line1\noriginal_line2\n";
      await writeFile(filePath, originalContent, "utf-8");

      const patch = [
        "@@ -1,2 +1,2 @@",
        " wrong_context",
        "-original_line2",
        "+new_line2",
      ].join("\n");

      const result = await applyPatch(filePath, patch, false);
      expect(result.applied).toBe(false);

      const content = await readFile(filePath, "utf-8");
      expect(content).toBe(originalContent);
    });

    test("should handle a file with a single line", async () => {
      const dir = await makeTempDir();
      const filePath = join(dir, "single.txt");
      await writeFile(filePath, "only_line", "utf-8");

      const patch = [
        "@@ -1 +1 @@",
        "-only_line",
        "+replaced_line",
      ].join("\n");

      const result = await applyPatch(filePath, patch, false);
      expect(result.applied).toBe(true);

      const content = await readFile(filePath, "utf-8");
      expect(content).toBe("replaced_line");
    });

    test("should handle hunk header with no count (defaults to 1)", async () => {
      const dir = await makeTempDir();
      const filePath = join(dir, "nocount.txt");
      await writeFile(filePath, "hello", "utf-8");

      const patch = [
        "@@ -1 +1 @@",
        "-hello",
        "+world",
      ].join("\n");

      const result = await applyPatch(filePath, patch, false);
      expect(result.applied).toBe(true);

      const content = await readFile(filePath, "utf-8");
      expect(content).toBe("world");
    });

    test("should return applied=true and a positive linesChanged count", async () => {
      const dir = await makeTempDir();
      const filePath = join(dir, "count.txt");
      await writeFile(filePath, "a\nb\nc\n", "utf-8");

      const patch = [
        "@@ -1,3 +1,3 @@",
        " a",
        "-b",
        "+B",
        " c",
      ].join("\n");

      const result = await applyPatch(filePath, patch, false);
      expect(result.applied).toBe(true);
      expect(result.linesChanged).toBeGreaterThanOrEqual(2); // at least the + and - lines
    });

    test("should handle patch with diff and file headers", async () => {
      const dir = await makeTempDir();
      const filePath = join(dir, "headers.txt");
      await writeFile(filePath, "x\ny\nz\n", "utf-8");

      const patch = [
        "diff --git a/headers.txt b/headers.txt",
        "--- a/headers.txt",
        "+++ b/headers.txt",
        "@@ -1,3 +1,3 @@",
        " x",
        "-y",
        "+Y",
        " z",
      ].join("\n");

      const result = await applyPatch(filePath, patch, false);
      expect(result.applied).toBe(true);

      const content = await readFile(filePath, "utf-8");
      expect(content).toContain("Y");
    });

    test("should handle trailing whitespace fuzzy matching", async () => {
      const dir = await makeTempDir();
      const filePath = join(dir, "trailing.txt");
      // File has trailing spaces on the context line
      await writeFile(filePath, "context_line   \nold_line\nend\n", "utf-8");

      const patch = [
        "@@ -1,3 +1,3 @@",
        " context_line",
        "-old_line",
        "+new_line",
        " end",
      ].join("\n");

      const result = await applyPatch(filePath, patch, false);
      expect(result.applied).toBe(true);

      const content = await readFile(filePath, "utf-8");
      expect(content).toContain("new_line");
    });
  });
});
