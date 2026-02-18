#!/usr/bin/env bun

/**
 * OpenSentinel CLI
 *
 * Usage:
 *   opensentinel              Start the server (default)
 *   opensentinel start        Start the server
 *   opensentinel setup        Interactive setup wizard
 *   opensentinel stop         Stop the system service
 *   opensentinel status       Show service status
 *   opensentinel version      Show version
 *   opensentinel help         Show this help
 */

const command = process.argv[2];

switch (command) {
  case "setup":
    import("./commands/setup").then((m) => m.default());
    break;

  case "start":
    import("./commands/start").then((m) => m.default());
    break;

  case "stop":
    import("./commands/stop").then((m) => m.default());
    break;

  case "status":
    import("./commands/status").then((m) => m.default());
    break;

  case "pair":
    import("./commands/pair").then((m) => m.showPairingInfo());
    break;

  case "version":
  case "--version":
  case "-v":
    console.log("opensentinel v3.0.0");
    break;

  case "help":
  case "--help":
  case "-h":
    console.log(`
OpenSentinel - Your Personal AI Assistant

Usage:
  opensentinel [command]

Commands:
  start     Start the server (default)
  setup     Interactive setup wizard
  stop      Stop the system service
  status    Show service status
  pair      Show device pairing info
  version   Show version
  help      Show this help

Examples:
  opensentinel                  Start with default config
  opensentinel setup            Run the setup wizard
  opensentinel status           Check service health

Documentation: https://docs.opensentinel.ai
`);
    break;

  default:
    // Default: start the server (backward compatibility)
    import("./commands/start").then((m) => m.default());
    break;
}
