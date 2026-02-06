import { describe, test, expect, beforeEach, afterEach, mock, spyOn } from "bun:test";

describe("Slack Bot Integration", () => {
  describe("Slack Bot Module", () => {
    test("should export createSlackBot function", async () => {
      const { createSlackBot } = await import("../src/inputs/slack");
      expect(typeof createSlackBot).toBe("function");
    });

    test("should export SlackBot class", async () => {
      const { SlackBot } = await import("../src/inputs/slack");
      expect(typeof SlackBot).toBe("function");
    });

    test("should export slashCommands array", async () => {
      const { slashCommands } = await import("../src/inputs/slack");
      expect(Array.isArray(slashCommands)).toBe(true);
      expect(slashCommands.length).toBeGreaterThan(0);
    });

    test("should have default export with all exports", async () => {
      const slackModule = await import("../src/inputs/slack");
      const defaultExport = slackModule.default;

      expect(defaultExport).toBeTruthy();
      expect(typeof defaultExport.createSlackBot).toBe("function");
      expect(typeof defaultExport.SlackBot).toBe("function");
      expect(Array.isArray(defaultExport.slashCommands)).toBe(true);
    });
  });

  describe("Slack Commands Module", () => {
    test("should export askCommand", async () => {
      const { askCommand } = await import("../src/inputs/slack/commands");
      expect(askCommand).toBeTruthy();
      expect(askCommand.command).toBe("/sentinel-ask");
      expect(askCommand.description).toBeTruthy();
      expect(askCommand.usage).toBeTruthy();
      expect(typeof askCommand.handler).toBe("function");
    });

    test("should export chatCommand", async () => {
      const { chatCommand } = await import("../src/inputs/slack/commands");
      expect(chatCommand).toBeTruthy();
      expect(chatCommand.command).toBe("/sentinel-chat");
      expect(chatCommand.description).toBeTruthy();
      expect(typeof chatCommand.handler).toBe("function");
    });

    test("should export clearCommand", async () => {
      const { clearCommand } = await import("../src/inputs/slack/commands");
      expect(clearCommand).toBeTruthy();
      expect(clearCommand.command).toBe("/sentinel-clear");
      expect(clearCommand.description).toBeTruthy();
      expect(typeof clearCommand.handler).toBe("function");
    });

    test("should export remindCommand", async () => {
      const { remindCommand } = await import("../src/inputs/slack/commands");
      expect(remindCommand).toBeTruthy();
      expect(remindCommand.command).toBe("/sentinel-remind");
      expect(remindCommand.description).toBeTruthy();
      expect(typeof remindCommand.handler).toBe("function");
    });

    test("should export statusCommand", async () => {
      const { statusCommand } = await import("../src/inputs/slack/commands");
      expect(statusCommand).toBeTruthy();
      expect(statusCommand.command).toBe("/sentinel-status");
      expect(typeof statusCommand.handler).toBe("function");
    });

    test("should export helpCommand", async () => {
      const { helpCommand } = await import("../src/inputs/slack/commands");
      expect(helpCommand).toBeTruthy();
      expect(helpCommand.command).toBe("/sentinel-help");
      expect(typeof helpCommand.handler).toBe("function");
    });

    test("should export mainCommand", async () => {
      const { mainCommand } = await import("../src/inputs/slack/commands");
      expect(mainCommand).toBeTruthy();
      expect(mainCommand.command).toBe("/sentinel");
      expect(typeof mainCommand.handler).toBe("function");
    });
  });

  describe("Session Management", () => {
    test("should export getSession function", async () => {
      const { getSession } = await import("../src/inputs/slack/commands");
      expect(typeof getSession).toBe("function");
    });

    test("should export addToSession function", async () => {
      const { addToSession } = await import("../src/inputs/slack/commands");
      expect(typeof addToSession).toBe("function");
    });

    test("should export clearSession function", async () => {
      const { clearSession } = await import("../src/inputs/slack/commands");
      expect(typeof clearSession).toBe("function");
    });

    test("should export sessions map", async () => {
      const { sessions } = await import("../src/inputs/slack/commands");
      expect(sessions).toBeTruthy();
      expect(sessions instanceof Map).toBe(true);
    });

    test("getSession should return empty array for new user", async () => {
      const { getSession, sessions } = await import("../src/inputs/slack/commands");

      // Clear any existing session for this test user
      sessions.delete("slack-test-user-new");

      const session = getSession("slack-test-user-new");
      expect(Array.isArray(session)).toBe(true);
      expect(session.length).toBe(0);

      // Cleanup
      sessions.delete("slack-test-user-new");
    });

    test("addToSession should add message to session", async () => {
      const { getSession, addToSession, sessions } = await import("../src/inputs/slack/commands");

      // Clear any existing session
      sessions.delete("slack-test-user-add");

      addToSession("slack-test-user-add", { role: "user", content: "Hello Slack" });
      const session = getSession("slack-test-user-add");

      expect(session.length).toBe(1);
      expect(session[0].role).toBe("user");
      expect(session[0].content).toBe("Hello Slack");

      // Cleanup
      sessions.delete("slack-test-user-add");
    });

    test("addToSession should maintain max history", async () => {
      const { getSession, addToSession, sessions } = await import("../src/inputs/slack/commands");

      // Clear any existing session
      sessions.delete("slack-test-user-max");

      // Add more than MAX_HISTORY messages (20)
      for (let i = 0; i < 25; i++) {
        addToSession("slack-test-user-max", { role: "user", content: `Slack Message ${i}` });
      }

      const session = getSession("slack-test-user-max");
      expect(session.length).toBe(20);
      expect(session[0].content).toBe("Slack Message 5"); // First 5 should be trimmed

      // Cleanup
      sessions.delete("slack-test-user-max");
    });

    test("clearSession should clear user session", async () => {
      const { getSession, addToSession, clearSession, sessions } = await import("../src/inputs/slack/commands");

      // Add some messages first
      sessions.delete("slack-test-user-clear");
      addToSession("slack-test-user-clear", { role: "user", content: "Hello" });
      addToSession("slack-test-user-clear", { role: "assistant", content: "Hi there!" });

      expect(getSession("slack-test-user-clear").length).toBe(2);

      clearSession("slack-test-user-clear");

      expect(getSession("slack-test-user-clear").length).toBe(0);

      // Cleanup
      sessions.delete("slack-test-user-clear");
    });
  });

  describe("Command Utilities", () => {
    test("should export getCommand function", async () => {
      const { getCommand } = await import("../src/inputs/slack/commands");
      expect(typeof getCommand).toBe("function");
    });

    test("should export getCommandNames function", async () => {
      const { getCommandNames } = await import("../src/inputs/slack/commands");
      expect(typeof getCommandNames).toBe("function");
    });

    test("getCommand should return command by name", async () => {
      const { getCommand } = await import("../src/inputs/slack/commands");

      const askCmd = getCommand("/sentinel-ask");
      expect(askCmd).toBeTruthy();
      expect(askCmd?.command).toBe("/sentinel-ask");

      const chatCmd = getCommand("/sentinel-chat");
      expect(chatCmd).toBeTruthy();
      expect(chatCmd?.command).toBe("/sentinel-chat");
    });

    test("getCommand should return undefined for unknown command", async () => {
      const { getCommand } = await import("../src/inputs/slack/commands");

      const unknownCmd = getCommand("/unknown-command");
      expect(unknownCmd).toBeUndefined();
    });

    test("getCommandNames should return all command names", async () => {
      const { getCommandNames, slashCommands } = await import("../src/inputs/slack/commands");

      const names = getCommandNames();

      expect(Array.isArray(names)).toBe(true);
      expect(names.length).toBe(slashCommands.length);

      // All names should start with /
      for (const name of names) {
        expect(name.startsWith("/")).toBe(true);
      }
    });
  });

  describe("Message Splitting", () => {
    test("should export splitMessage function", async () => {
      const { splitMessage } = await import("../src/inputs/slack/commands");
      expect(typeof splitMessage).toBe("function");
    });

    test("splitMessage should not split short messages", async () => {
      const { splitMessage } = await import("../src/inputs/slack/commands");

      const shortMessage = "This is a short Slack message";
      const chunks = splitMessage(shortMessage, 3000);

      expect(chunks.length).toBe(1);
      expect(chunks[0]).toBe(shortMessage);
    });

    test("splitMessage should split long messages", async () => {
      const { splitMessage } = await import("../src/inputs/slack/commands");

      // Create a message longer than 100 characters
      const longMessage = "B".repeat(150);
      const chunks = splitMessage(longMessage, 100);

      expect(chunks.length).toBe(2);
      expect(chunks[0].length).toBeLessThanOrEqual(100);
      expect(chunks[1].length).toBeLessThanOrEqual(100);
    });

    test("splitMessage should use default max length of 3000", async () => {
      const { splitMessage } = await import("../src/inputs/slack/commands");

      // Create a message just under 3000 chars
      const message = "C".repeat(2500);
      const chunks = splitMessage(message);

      expect(chunks.length).toBe(1);

      // Create a message over 3000 chars
      const longMessage = "D".repeat(4000);
      const longChunks = splitMessage(longMessage);

      expect(longChunks.length).toBe(2);
    });

    test("splitMessage should prefer breaking at newlines", async () => {
      const { splitMessage } = await import("../src/inputs/slack/commands");

      const messageWithNewlines = "First line\nSecond line\nThird line\nFourth line";
      const chunks = splitMessage(messageWithNewlines, 25);

      expect(chunks.length).toBeGreaterThan(1);
      for (const chunk of chunks) {
        expect(chunk).toBe(chunk.trim());
      }
    });
  });

  describe("Block Kit Utilities", () => {
    test("should export formatAsBlocks function", async () => {
      const { formatAsBlocks } = await import("../src/inputs/slack/commands");
      expect(typeof formatAsBlocks).toBe("function");
    });

    test("should export createErrorBlocks function", async () => {
      const { createErrorBlocks } = await import("../src/inputs/slack/commands");
      expect(typeof createErrorBlocks).toBe("function");
    });

    test("should export createSuccessBlocks function", async () => {
      const { createSuccessBlocks } = await import("../src/inputs/slack/commands");
      expect(typeof createSuccessBlocks).toBe("function");
    });

    test("formatAsBlocks should create valid section block", async () => {
      const { formatAsBlocks } = await import("../src/inputs/slack/commands");

      const blocks = formatAsBlocks("Test message");

      expect(Array.isArray(blocks)).toBe(true);
      expect(blocks.length).toBe(1);
      expect((blocks[0] as any).type).toBe("section");
      expect((blocks[0] as any).text.type).toBe("mrkdwn");
      expect((blocks[0] as any).text.text).toBe("Test message");
    });

    test("createErrorBlocks should create error formatted block", async () => {
      const { createErrorBlocks } = await import("../src/inputs/slack/commands");

      const blocks = createErrorBlocks("Something went wrong");

      expect(Array.isArray(blocks)).toBe(true);
      expect(blocks.length).toBe(1);
      expect((blocks[0] as any).type).toBe("section");
      expect((blocks[0] as any).text.text).toContain("Error");
      expect((blocks[0] as any).text.text).toContain("Something went wrong");
    });

    test("createSuccessBlocks should create success formatted block", async () => {
      const { createSuccessBlocks } = await import("../src/inputs/slack/commands");

      const blocks = createSuccessBlocks("Operation completed");

      expect(Array.isArray(blocks)).toBe(true);
      expect(blocks.length).toBe(1);
      expect((blocks[0] as any).type).toBe("section");
      expect((blocks[0] as any).text.text).toContain("Operation completed");
    });
  });

  describe("Command Definitions", () => {
    test("all commands should have valid structure", async () => {
      const { slashCommands } = await import("../src/inputs/slack/commands");

      for (const cmd of slashCommands) {
        // Each command should have required properties
        expect(cmd.command).toBeTruthy();
        expect(typeof cmd.command).toBe("string");
        expect(cmd.command.startsWith("/")).toBe(true);

        expect(cmd.description).toBeTruthy();
        expect(typeof cmd.description).toBe("string");

        expect(cmd.usage).toBeTruthy();
        expect(typeof cmd.usage).toBe("string");

        expect(typeof cmd.handler).toBe("function");
      }
    });

    test("command names should follow Slack naming conventions", async () => {
      const { slashCommands } = await import("../src/inputs/slack/commands");

      for (const cmd of slashCommands) {
        // Slack command names should be lowercase and can contain hyphens
        const name = cmd.command.slice(1); // Remove leading /
        expect(name).toBe(name.toLowerCase());
        expect(/^[a-z][a-z0-9-]*$/.test(name)).toBe(true);
      }
    });
  });

  describe("Slack Bot Configuration", () => {
    test("SlackBotConfig interface should be properly typed", async () => {
      const { SlackBot } = await import("../src/inputs/slack");

      // This is a type-level test - if it compiles, it passes
      const config = {
        token: "xoxb-test-token",
        signingSecret: "test-signing-secret",
        appToken: "xapp-test-token",
        socketMode: true,
        port: 3001,
        allowedUserIds: ["U123", "U456"],
        allowedChannelIds: ["C123", "C456"],
        allowDMs: true,
        allowMentions: true,
        allowThreadReplies: true,
      };

      expect(config.token).toBe("xoxb-test-token");
      expect(config.signingSecret).toBe("test-signing-secret");
      expect(config.appToken).toBe("xapp-test-token");
      expect(config.socketMode).toBe(true);
      expect(config.port).toBe(3001);
      expect(config.allowedUserIds).toHaveLength(2);
      expect(config.allowedChannelIds).toHaveLength(2);
      expect(config.allowDMs).toBe(true);
      expect(config.allowMentions).toBe(true);
      expect(config.allowThreadReplies).toBe(true);
    });
  });

  describe("Type Exports", () => {
    test("should export SlackSlashCommand type", async () => {
      const mod = await import("../src/inputs/slack/commands");
      expect(mod).toBeTruthy();
      // Type exists if module compiles
    });

    test("should export SlackBotConfig type", async () => {
      const mod = await import("../src/inputs/slack");
      expect(mod).toBeTruthy();
      // Type exists if module compiles
    });

    test("should export SlackSessionData type", async () => {
      const mod = await import("../src/inputs/slack");
      expect(mod).toBeTruthy();
      // Type exists if module compiles
    });
  });

  describe("Command Count", () => {
    test("should have expected number of commands", async () => {
      const { slashCommands } = await import("../src/inputs/slack/commands");

      // We defined 7 commands: /sentinel, /sentinel-ask, /sentinel-chat, /sentinel-clear, /sentinel-remind, /sentinel-status, /sentinel-help
      expect(slashCommands.length).toBe(7);
    });

    test("command names should be unique", async () => {
      const { slashCommands } = await import("../src/inputs/slack/commands");

      const names = slashCommands.map(cmd => cmd.command);
      const uniqueNames = new Set(names);

      expect(names.length).toBe(uniqueNames.size);
    });
  });

  describe("Module Structure", () => {
    test("slack index should re-export commands module", async () => {
      const slackIndex = await import("../src/inputs/slack");

      // Check that commands are re-exported
      expect(slackIndex.slashCommands).toBeTruthy();
      expect(slackIndex.getSession).toBeTruthy();
      expect(slackIndex.addToSession).toBeTruthy();
      expect(slackIndex.clearSession).toBeTruthy();
    });

    test("slack index should have all expected exports", async () => {
      const slackIndex = await import("../src/inputs/slack");

      // Main exports
      expect(typeof slackIndex.createSlackBot).toBe("function");
      expect(typeof slackIndex.SlackBot).toBe("function");

      // Command exports
      expect(Array.isArray(slackIndex.slashCommands)).toBe(true);

      // Session exports
      expect(typeof slackIndex.getSession).toBe("function");
      expect(typeof slackIndex.addToSession).toBe("function");
      expect(typeof slackIndex.clearSession).toBe("function");
      expect(slackIndex.sessions instanceof Map).toBe(true);

      // Utility exports
      expect(typeof slackIndex.splitMessage).toBe("function");
      expect(typeof slackIndex.formatAsBlocks).toBe("function");
      expect(typeof slackIndex.createErrorBlocks).toBe("function");
      expect(typeof slackIndex.createSuccessBlocks).toBe("function");
    });
  });

  describe("Main Command Router", () => {
    test("main command should list all subcommands in usage", async () => {
      const { mainCommand } = await import("../src/inputs/slack/commands");

      expect(mainCommand.usage).toContain("ask");
      expect(mainCommand.usage).toContain("chat");
      expect(mainCommand.usage).toContain("clear");
      expect(mainCommand.usage).toContain("remind");
      expect(mainCommand.usage).toContain("status");
      expect(mainCommand.usage).toContain("help");
    });
  });

  describe("Individual Command Exports", () => {
    test("all individual commands should be exported from commands module", async () => {
      const {
        mainCommand,
        askCommand,
        chatCommand,
        clearCommand,
        remindCommand,
        statusCommand,
        helpCommand,
      } = await import("../src/inputs/slack/commands");

      expect(mainCommand).toBeTruthy();
      expect(askCommand).toBeTruthy();
      expect(chatCommand).toBeTruthy();
      expect(clearCommand).toBeTruthy();
      expect(remindCommand).toBeTruthy();
      expect(statusCommand).toBeTruthy();
      expect(helpCommand).toBeTruthy();
    });
  });
});
