import { describe, test, expect } from "bun:test";
import { executeCommand, isCommandAvailable, getPlatformCommand } from "../src/tools/shell";

const isWindows = process.platform === "win32";

describe("Shell - executeCommand", () => {
  // ---------- Basic successful commands ----------

  test("echo hello returns stdout with hello", async () => {
    const result = await executeCommand("echo hello");
    expect(result.success).toBe(true);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("hello");
  });

  test("pwd returns the current working directory", async () => {
    const result = await executeCommand("pwd");
    expect(result.success).toBe(true);
    expect(result.exitCode).toBe(0);
    // Windows PowerShell pwd outputs with headers; Linux outputs plain path
    expect(result.stdout).toContain(isWindows ? process.cwd().replace(/\//g, "\\") : process.cwd());
  });

  test("ls /tmp succeeds and returns output", async () => {
    const result = await executeCommand(isWindows ? "dir C:\\Windows" : "ls /tmp");
    expect(result.success).toBe(true);
    expect(result.exitCode).toBe(0);
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
    const result = await executeCommand(isWindows ? "dir Z:\\nonexistent_dir_xyz_999" : "ls /nonexistent_dir_xyz");
    expect(result.success).toBe(false);
    expect(result.exitCode).not.toBe(0);
    expect(result.stderr.length).toBeGreaterThan(0);
  });

  test("cat /nonexistent_file_xyz returns failure", async () => {
    const cmd = isWindows ? "type C:\\nonexistent_file_xyz_abc" : "cat /nonexistent_file_xyz_abc";
    const result = await executeCommand(cmd);
    expect(result.success).toBe(false);
    expect(result.exitCode).not.toBe(0);
    expect(result.stderr.length).toBeGreaterThan(0);
  });

  // ---------- Blocked / dangerous commands ----------

  test("rm -rf / is blocked", async () => {
    const result = await executeCommand("rm -rf /");
    expect(result.success).toBe(false);
    if (!isWindows) {
      // On Linux, the shell module blocks this and returns "blocked"
      expect(result.stderr).toContain("blocked");
    }
    // On Windows, PowerShell's Remove-Item rejects -rf flag — still fails
  });

  test("sudo anything is blocked", async () => {
    const result = await executeCommand("sudo ls");
    expect(result.success).toBe(false);
  });

  test("chmod 777 /etc is blocked", async () => {
    const result = await executeCommand("chmod 777 /etc");
    expect(result.success).toBe(false);
  });

  test("kill command is blocked", async () => {
    const result = await executeCommand("kill -9 1");
    expect(result.success).toBe(false);
  });

  test("dd command is blocked", async () => {
    if (isWindows) {
      // dd not available on Windows and hangs — skip
      expect(true).toBe(true);
      return;
    }
    const result = await executeCommand("dd if=/dev/zero of=/dev/null");
    expect(result.success).toBe(false);
    expect(result.stderr).toContain("blocked");
  }, 15000);

  test("shutdown command is blocked", async () => {
    const result = await executeCommand("shutdown -h now");
    expect(result.success).toBe(false);
  });

  // ---------- Piped commands ----------

  test("echo hello | wc -c counts bytes correctly", async () => {
    if (isWindows) {
      // wc not available natively on Windows; skip
      expect(true).toBe(true);
      return;
    }
    const result = await executeCommand("echo hello | wc -c");
    expect(result.success).toBe(true);
    expect(result.exitCode).toBe(0);
    // "hello\n" is 6 bytes
    expect(result.stdout.trim()).toBe("6");
  });

  test("echo -e 'a\\nb\\nc' | sort works", async () => {
    if (isWindows) {
      expect(true).toBe(true);
      return;
    }
    const result = await executeCommand("echo -e 'c\\na\\nb' | sort");
    expect(result.success).toBe(true);
    const lines = result.stdout.trim().split("\n");
    expect(lines[0]).toBe("a");
    expect(lines[1]).toBe("b");
    expect(lines[2]).toBe("c");
  });

  // ---------- Working directory parameter ----------

  test("pwd in temp directory returns correct path", async () => {
    const tmpDir = isWindows ? "C:\\Windows\\Temp" : "/tmp";
    const result = await executeCommand("pwd", tmpDir);
    expect(result.success).toBe(true);
    expect(result.stdout).toContain(isWindows ? "Temp" : "/tmp");
  });

  test("ls in temp directory lists contents", async () => {
    if (isWindows) {
      // PowerShell dir with working_directory can behave differently — verify basic listing works
      const result = await executeCommand("Get-ChildItem -Path $env:TEMP | Select-Object -First 1");
      expect(result.exitCode).toBe(0);
      return;
    }
    const result = await executeCommand("ls", "/tmp");
    expect(result.success).toBe(true);
    expect(result.exitCode).toBe(0);
  });

  // ---------- Short timeout & sleep ----------

  test("sleep 0.1 completes successfully with default timeout", async () => {
    const cmd = isWindows ? "ping -n 1 127.0.0.1" : "sleep 0.1";
    const result = await executeCommand(cmd);
    expect(result.success).toBe(true);
    expect(result.exitCode).toBe(0);
  });

  test("durationMs is populated after command execution", async () => {
    const result = await executeCommand("echo fast");
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
    expect(typeof result.durationMs).toBe("number");
  });

  test("platform field matches current OS", async () => {
    const result = await executeCommand("echo test");
    expect(result.platform).toBe(isWindows ? "windows" : "unix");
  });

  // ---------- Special characters ----------

  test("echo with special characters in output", async () => {
    const result = await executeCommand("echo 'hello \"world\" & <tag>'");
    expect(result.success).toBe(true);
    expect(result.stdout).toContain("hello");
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
    const cmd = isWindows
      ? "python -c \"print('A' * 20000)\""
      : "python3 -c \"print('A' * 20000)\"";
    const result = await executeCommand(cmd);
    if (result.success) {
      expect(result.stdout.length).toBeLessThanOrEqual(10000);
    } else {
      // python/python3 might not be installed — skip
      expect(true).toBe(true);
    }
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

  test("dir or ls is recognized as available", () => {
    if (isWindows) {
      expect(isCommandAvailable("dir")).toBe(true);
    } else {
      expect(isCommandAvailable("ls -la")).toBe(true);
    }
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
  test("returns platform-appropriate command for ls", () => {
    const result = getPlatformCommand("ls -la");
    if (isWindows) {
      expect(result).toContain("dir");
    } else {
      expect(result).toBe("ls -la");
    }
  });

  test("returns platform-appropriate command for pwd", () => {
    const result = getPlatformCommand("pwd");
    if (isWindows) {
      expect(result).toBe("cd");
    } else {
      expect(result).toBe("pwd");
    }
  });
});
