// Browser Troubleshooting — Diagnostics and debugging for browser automation

import { execSync } from "child_process";
import { existsSync } from "fs";

export interface BrowserDiagnostics {
  chromiumInstalled: boolean;
  chromiumPath: string | null;
  playwrightInstalled: boolean;
  displayAvailable: boolean;
  sandboxSupported: boolean;
  memoryMB: number;
  issues: string[];
  suggestions: string[];
}

/**
 * Run full browser diagnostics
 */
export async function diagnoseBrowser(): Promise<BrowserDiagnostics> {
  const issues: string[] = [];
  const suggestions: string[] = [];

  // Check Chromium installation
  let chromiumPath: string | null = null;
  let chromiumInstalled = false;

  const possiblePaths = [
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/snap/bin/chromium",
  ];

  for (const p of possiblePaths) {
    if (existsSync(p)) {
      chromiumPath = p;
      chromiumInstalled = true;
      break;
    }
  }

  // Check via playwright's bundled browser
  try {
    const pw = await import("playwright");
    const browserPath = pw.chromium.executablePath();
    if (browserPath && existsSync(browserPath)) {
      chromiumPath = browserPath;
      chromiumInstalled = true;
    }
  } catch {
    // Playwright not available
  }

  if (!chromiumInstalled) {
    issues.push("Chromium/Chrome not found on system");
    suggestions.push("Install Chromium: sudo apt install chromium-browser");
    suggestions.push("Or install Playwright browsers: npx playwright install chromium");
  }

  // Check Playwright
  let playwrightInstalled = false;
  try {
    await import("playwright");
    playwrightInstalled = true;
  } catch {
    issues.push("Playwright package not installed");
    suggestions.push("Install: bun add playwright");
  }

  // Check display (for non-headless mode)
  let displayAvailable = false;
  try {
    const display = process.env.DISPLAY;
    if (display) {
      displayAvailable = true;
    } else {
      // Check if Xvfb is available
      try {
        execSync("which Xvfb", { stdio: "pipe" });
        suggestions.push("No DISPLAY set. Start Xvfb: Xvfb :99 & export DISPLAY=:99");
      } catch {
        suggestions.push("No display available. Browser will run in headless mode only.");
      }
    }
  } catch {
    // Not critical
  }

  // Check sandbox support
  let sandboxSupported = true;
  try {
    const kernelVersion = execSync("uname -r", { encoding: "utf-8" }).trim();
    // Check if running in container (usually no sandbox)
    if (existsSync("/.dockerenv") || existsSync("/run/.containerenv")) {
      sandboxSupported = false;
      suggestions.push("Running in container — use --no-sandbox flag for Chromium");
    }
  } catch {
    // Not critical
  }

  // Check available memory
  let memoryMB = 0;
  try {
    const memInfo = execSync("free -m | grep Mem", { encoding: "utf-8" });
    const parts = memInfo.trim().split(/\s+/);
    memoryMB = parseInt(parts[1], 10) || 0;
    const availableMB = parseInt(parts[6], 10) || 0;

    if (availableMB < 256) {
      issues.push(`Low available memory: ${availableMB}MB (browser needs ~256MB minimum)`);
      suggestions.push("Free up memory or increase swap space");
    }
  } catch {
    // Not critical
  }

  // Check for common library dependencies
  const requiredLibs = [
    { lib: "libgbm.so", pkg: "libgbm1" },
    { lib: "libnss3.so", pkg: "libnss3" },
    { lib: "libatk-1.0.so", pkg: "libatk1.0-0" },
    { lib: "libdrm.so", pkg: "libdrm2" },
  ];

  for (const { lib, pkg } of requiredLibs) {
    try {
      execSync(`ldconfig -p | grep ${lib}`, { stdio: "pipe" });
    } catch {
      issues.push(`Missing library: ${lib}`);
      suggestions.push(`Install: sudo apt install ${pkg}`);
    }
  }

  return {
    chromiumInstalled,
    chromiumPath,
    playwrightInstalled,
    displayAvailable,
    sandboxSupported,
    memoryMB,
    issues,
    suggestions,
  };
}

/**
 * Attempt to fix common browser issues automatically
 */
export async function autoFixBrowser(): Promise<{
  actions: string[];
  success: boolean;
}> {
  const actions: string[] = [];
  const diag = await diagnoseBrowser();

  // Install Playwright browsers if missing
  if (!diag.chromiumInstalled && diag.playwrightInstalled) {
    try {
      execSync("npx playwright install chromium --with-deps", {
        stdio: "pipe",
        timeout: 120000,
      });
      actions.push("Installed Playwright Chromium browser with dependencies");
    } catch {
      actions.push("Failed to install Playwright Chromium — try manually: npx playwright install chromium");
    }
  }

  // Set environment variables for headless container mode
  if (!diag.sandboxSupported) {
    process.env.PLAYWRIGHT_CHROMIUM_SANDBOX = "false";
    actions.push("Disabled Chromium sandbox for container environment");
  }

  if (!diag.displayAvailable) {
    process.env.PLAYWRIGHT_BROWSERS_PATH = "0";
    actions.push("Set headless mode (no display available)");
  }

  return {
    actions,
    success: diag.issues.length === 0 || actions.length > 0,
  };
}

/**
 * Format diagnostics as a readable report
 */
export function formatDiagnostics(diag: BrowserDiagnostics): string {
  const lines: string[] = [];
  lines.push("=== Browser Diagnostics Report ===\n");

  lines.push(`Chromium: ${diag.chromiumInstalled ? "\u2705 Installed" : "\u274c Not found"}`);
  if (diag.chromiumPath) lines.push(`  Path: ${diag.chromiumPath}`);
  lines.push(`Playwright: ${diag.playwrightInstalled ? "\u2705 Installed" : "\u274c Not found"}`);
  lines.push(`Display: ${diag.displayAvailable ? "\u2705 Available" : "\u26a0\ufe0f Headless only"}`);
  lines.push(`Sandbox: ${diag.sandboxSupported ? "\u2705 Supported" : "\u26a0\ufe0f Not supported (container)"}`);
  lines.push(`Memory: ${diag.memoryMB}MB total`);

  if (diag.issues.length > 0) {
    lines.push("\n\u274c Issues:");
    for (const issue of diag.issues) {
      lines.push(`  - ${issue}`);
    }
  }

  if (diag.suggestions.length > 0) {
    lines.push("\n\ud83d\udca1 Suggestions:");
    for (const suggestion of diag.suggestions) {
      lines.push(`  - ${suggestion}`);
    }
  }

  if (diag.issues.length === 0) {
    lines.push("\n\u2705 All checks passed — browser should work correctly");
  }

  return lines.join("\n");
}
