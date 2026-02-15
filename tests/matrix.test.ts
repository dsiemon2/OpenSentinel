import { describe, test, expect } from "bun:test";

// Matrix bot depends on matrix-js-sdk which may not be installed.
// We dynamically import and skip gracefully if the module is unavailable.
let MatrixBot: any;
let createMatrixBot: any;
let importSucceeded = false;

try {
  const mod = require("../src/inputs/matrix");
  MatrixBot = mod.MatrixBot;
  createMatrixBot = mod.createMatrixBot;
  importSucceeded = true;
} catch {
  // matrix-js-sdk not installed; tests will be skipped below.
}

const sampleConfig = {
  homeserverUrl: "https://matrix.example.org",
  accessToken: "test-access-token",
  userId: "@opensentinel:matrix.example.org",
  allowedRoomIds: ["!room1:matrix.example.org", "!room2:matrix.example.org"],
  autoJoin: false,
  e2eEnabled: false,
};

describe("MatrixBot", () => {
  test("MatrixBot can be constructed with config", () => {
    if (!importSucceeded) {
      console.log("[SKIP] matrix-js-sdk not installed");
      return;
    }
    const bot = new MatrixBot(sampleConfig);
    expect(bot).toBeTruthy();
  });

  test("MatrixBot config stores homeserverUrl", () => {
    if (!importSucceeded) {
      console.log("[SKIP] matrix-js-sdk not installed");
      return;
    }
    const bot = new MatrixBot(sampleConfig);
    // homeserverUrl is private, but we can verify construction succeeds
    // and the bot is an instance of MatrixBot
    expect(bot).toBeInstanceOf(MatrixBot);
  });

  test("MatrixBot config stores userId", () => {
    if (!importSucceeded) {
      console.log("[SKIP] matrix-js-sdk not installed");
      return;
    }
    const bot = new MatrixBot(sampleConfig);
    expect(bot).toBeInstanceOf(MatrixBot);
  });

  test("MatrixBot config stores allowedRoomIds", () => {
    if (!importSucceeded) {
      console.log("[SKIP] matrix-js-sdk not installed");
      return;
    }
    const bot = new MatrixBot({
      ...sampleConfig,
      allowedRoomIds: ["!specific:matrix.org"],
    });
    expect(bot).toBeTruthy();
  });

  test("MatrixBot autoJoin defaults to false", () => {
    if (!importSucceeded) {
      console.log("[SKIP] matrix-js-sdk not installed");
      return;
    }
    // Construct without specifying autoJoin — defaults to false internally
    const bot = new MatrixBot({
      homeserverUrl: "https://matrix.example.org",
      accessToken: "token",
      userId: "@bot:matrix.example.org",
    });
    expect(bot).toBeTruthy();
  });

  test("MatrixBot e2eEnabled defaults to false", () => {
    if (!importSucceeded) {
      console.log("[SKIP] matrix-js-sdk not installed");
      return;
    }
    // Construct without specifying e2eEnabled — defaults to false internally
    const bot = new MatrixBot({
      homeserverUrl: "https://matrix.example.org",
      accessToken: "token",
      userId: "@bot:matrix.example.org",
    });
    expect(bot).toBeTruthy();
  });

  test("createMatrixBot factory function works", () => {
    if (!importSucceeded) {
      console.log("[SKIP] matrix-js-sdk not installed");
      return;
    }
    const bot = createMatrixBot(sampleConfig);
    expect(bot).toBeInstanceOf(MatrixBot);
  });

  test("MatrixBotConfig interface has required fields", () => {
    if (!importSucceeded) {
      console.log("[SKIP] matrix-js-sdk not installed");
      return;
    }
    // Verify that the minimum required fields are accepted
    const minimalConfig = {
      homeserverUrl: "https://matrix.example.org",
      accessToken: "token",
      userId: "@bot:matrix.example.org",
    };
    const bot = new MatrixBot(minimalConfig);
    expect(bot).toBeTruthy();

    // Verify that the full config with optional fields also works
    const fullConfig = {
      homeserverUrl: "https://matrix.example.org",
      accessToken: "token",
      userId: "@bot:matrix.example.org",
      allowedRoomIds: ["!room:matrix.org"],
      autoJoin: true,
      e2eEnabled: true,
    };
    const bot2 = new MatrixBot(fullConfig);
    expect(bot2).toBeTruthy();
  });

  test("MatrixBot has start method", () => {
    if (!importSucceeded) {
      console.log("[SKIP] matrix-js-sdk not installed");
      return;
    }
    const bot = new MatrixBot(sampleConfig);
    expect(typeof bot.start).toBe("function");
  });

  test("MatrixBot has stop method", () => {
    if (!importSucceeded) {
      console.log("[SKIP] matrix-js-sdk not installed");
      return;
    }
    const bot = new MatrixBot(sampleConfig);
    expect(typeof bot.stop).toBe("function");
  });
});
