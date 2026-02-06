#!/usr/bin/env bun

/**
 * OpenSentinel CLI Entry Point
 *
 * This is the executable entry for running OpenSentinel as a standalone app.
 * For library usage, import from the package root instead.
 */

// Mark as CLI so env validation throws on missing required vars
process.env.__OPENSENTINEL_CLI__ = "1";

import { main } from "./index";

main()
  .then((shutdown) => {
    // Wire up graceful shutdown
    process.on("SIGINT", async () => {
      await shutdown();
      process.exit(0);
    });
    process.on("SIGTERM", async () => {
      await shutdown();
      process.exit(0);
    });
  })
  .catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
