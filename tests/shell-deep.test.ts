import { describe, test, expect } from "bun:test";
import { executeCommand, isCommandAvailable, getPlatformCommand } from "../src/tools/shell";

describe("Shell - executeCommand", () => {
  // ---------- Basic successful commands ----------

  test("echo hello returns stdout with hello", async () => {
    const result = await executeCommand("echo hello");
    expect(result.success).toBe(true);
    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim()).toBe("hello");
    expect(result.stderr).toBe("");
  });

  test("pwd returns the current working directory", async () => {
    const result = await executeCommand("pwd");
    expect(result.success).toBe(true);
    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim()).toBe(process.cwd());
  });

  test("ls /tmp succeeds and returns output", async () => {
    const result = await executeCommand("ls /tmp");
    expect(result.success).toBe(true);
    expect(result.exitCode).toBe(0);
    // /tmp should exist and is likely non-empty
    expect(typeof result.stdout).toBe("string");
  });

  test("date returns a non-empty string", async () => {
    const result = await executeCommand("date");
    expect(result.success).toBe(true);
    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim().length).toBeGreaterThan(0);
  });

  test("whoami returns a non-empty username", async () => {
    const result = await executeCommand("whoami");
    expect(result.success).toBe(true);
    expect(result.stdout.trim().length).toBeGreaterThan(0);
  });

  // ---------- Failed commands ----------

  test("ls /nonexistent_dir_xyz returns non-zero exit code and stderr", async () => {
    const result = await executeCommand("ls /nonexistent_dir_xyz");
    expect(result.success).toBe(false);
    expect(result.exitCode).not.toBe(0);
    expect(result.stderr.length).toBeGreaterThan(0);
  });

  test("cat /nonexistent_file_xyz returns failure", async () => {
    const result = await executeCommand("cat /nonexistent_file_xyz_abc");
    expect(result.success).toBe(false);
    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toContain("No such file or directory");
  });

  // ---------- Blocked / dangerous commands ----------

  test("rm -rf / is blocked", async () => {
    const result = await executeCommand("rm -rf /");
    expect(result.success).toBe(false);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("blocked");
  });

  test("sudo anything is blocked", async () => {
    const result = await executeCommand("sudo ls");
    expect(result.success).toBe(false);
    expect(result.exitCode).toBe(1);
    expect(result.stderr.toLowerCase()).toContain("sudo");
  });

  test("chmod 777 /etc is blocked", async () => {
    const result = await executeCommand("chmod 777 /etc");
    expect(result.success).toBe(false);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("blocked");
  });

  test("kill command is blocked", async () => {
    const result = await executeCommand("kill -9 1");
    expect(result.success).toBe(false);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("blocked");
  });

  test("dd command is blocked", async () => {
    const result = await executeCommand("dd if=/dev/zero of=/dev/null");
    expect(result.success).toBe(false);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("blocked");
  });

  test("shutdown command is blocked", async () => {
    const result = await executeCommand("shutdown -h now");
    expect(result.success).toBe(false);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("blocked");
  });

  // ---------- Piped commands ----------

  test("echo hello | wc -c counts bytes correctly", async () => {
    const result = await executeCommand("echo hello | wc -c");
    expect(result.success).toBe(true);
    expect(result.exitCode).toBe(0);
    // "hello\n" is 6 bytes
    expect(result.stdout.trim()).toBe("6");
  });

  test("echo -e 'a\\nb\\nc' | sort works", async () => {
    const result = await executeCommand("echo -e 'c\\na\\nb' | sort");
    expect(result.success).toBe(true);
    const lines = result.stdout.trim().split("\n");
    expect(lines[0]).toBe("a");
    expect(lines[1]).toBe("b");
    expect(lines[2]).toBe("c");
  });

  // ---------- Working directory parameter ----------

  test("pwd in /tmp returns /tmp", async () => {
    const result = await executeCommand("pwd", "/tmp");
    expect(result.success).toBe(true);
    expect(result.stdout.trim()).toBe("/tmp");
  });

  test("ls in /tmp lists real temp contents", async () => {
    const result = await executeCommand("ls", "/tmp");
    expect(result.success).toBe(true);
    expect(result.exitCode).toBe(0);
  });

  // ---------- Short timeout & sleep ----------

  test("sleep 0.1 completes successfully with default timeout", async () => {
    const result = await executeCommand("sleep 0.1");
    expect(result.success).toBe(true);
    expect(result.exitCode).toBe(0);
  });

  test("durationMs is populated after command execution", async () => {
    const result = await executeCommand("echo fast");
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
    expect(typeof result.durationMs).toBe("number");
  });

  test("platform field is set to unix on Linux", async () => {
    const result = await executeCommand("echo test");
    expect(result.platform).toBe("unix");
  });

  // ---------- Special characters ----------

  test("echo with special characters in output", async () => {
    const result = await executeCommand("echo 'hello \"world\" & <tag>'");
    expect(result.success).toBe(true);
    expect(result.stdout).toContain("hello");
    expect(result.stdout).toContain("world");
    expect(result.stdout).toContain("<tag>");
  });

  test("echo with unicode characters", async () => {
    const result = await executeCommand("echo 'cafe\\u0301'");
    expect(result.success).toBe(true);
    expect(result.stdout.trim().length).toBeGreaterThan(0);
  });

  // ---------- Empty/whitespace command ----------

  test("empty string command still runs through the shell (returns success)", async () => {
    // An empty string passed to bash -c returns exit 0
    const result = await executeCommand("");
    expect(result.exitCode).toBe(0);
  });

  // ---------- Output size limit ----------

  test("stdout is truncated to max 10000 characters", async () => {
    // Generate > 10000 chars of output
    const result = await executeCommand("python3 -c \"print('A' * 20000)\"");
    expect(result.success).toBe(true);
    expect(result.stdout.length).toBeLessThanOrEqual(10000);
  });

  // ---------- command field in result ----------

  test("result contains the original command string", async () => {
    const cmd = "echo result-test-marker";
    const result = await executeCommand(cmd);
    expect(result.command).toBe(cmd);
  });
});

describe("Shell - isCommandAvailable", () => {
  test("echo is recognized as available", () => {
    expect(isCommandAvailable("echo hello")).toBe(true);
  });

  test("ls is recognized as available", () => {
    expect(isCommandAvailable("ls -la")).toBe(true);
  });

  test("git is recognized as available", () => {
    expect(isCommandAvailable("git status")).toBe(true);
  });

  test("bun is recognized as available", () => {
    expect(isCommandAvailable("bun test")).toBe(true);
  });

  test("random_nonexistent_binary is not available", () => {
    expect(isCommandAvailable("random_nonexistent_binary")).toBe(false);
  });

  test("first word is extracted correctly with multiple spaces", () => {
    expect(isCommandAvailable("  echo   hello")).toBe(true);
  });
});

describe("Shell - getPlatformCommand", () => {
  test("returns the same command on Linux (no translation)", () => {
    expect(getPlatformCommand("ls -la")).toBe("ls -la");
  });

  test("returns pwd unchanged on Linux", () => {
    expect(getPlatformCommand("pwd")).toBe("pwd");
  });
});
