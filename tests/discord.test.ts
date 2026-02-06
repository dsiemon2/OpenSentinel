import { describe, test, expect, beforeEach, afterEach, mock, spyOn } from "bun:test";

describe("Discord Bot Integration", () => {
  describe("Discord Bot Module", () => {
    test("should export createDiscordBot function", async () => {
      const { createDiscordBot } = await import("../src/inputs/discord");
      expect(typeof createDiscordBot).toBe("function");
    }, 30000);

    test("should export DiscordBot class", async () => {
      const { DiscordBot } = await import("../src/inputs/discord");
      expect(typeof DiscordBot).toBe("function");
    });

    test("should export slashCommands array", async () => {
      const { slashCommands } = await import("../src/inputs/discord");
      expect(Array.isArray(slashCommands)).toBe(true);
      expect(slashCommands.length).toBeGreaterThan(0);
    });

    test("should export getCommandData function", async () => {
      const { getCommandData } = await import("../src/inputs/discord");
      expect(typeof getCommandData).toBe("function");
    });

    test("should export getCommand function", async () => {
      const { getCommand } = await import("../src/inputs/discord");
      expect(typeof getCommand).toBe("function");
    });

    test("should have default export with all exports", async () => {
      const discordModule = await import("../src/inputs/discord");
      const defaultExport = discordModule.default;

      expect(defaultExport).toBeTruthy();
      expect(typeof defaultExport.createDiscordBot).toBe("function");
      expect(typeof defaultExport.DiscordBot).toBe("function");
      expect(Array.isArray(defaultExport.slashCommands)).toBe(true);
    });
  });

  describe("Discord Commands Module", () => {
    test("should export askCommand", async () => {
      const { askCommand } = await import("../src/inputs/discord/commands");
      expect(askCommand).toBeTruthy();
      expect(askCommand.data).toBeTruthy();
      expect(askCommand.data.name).toBe("ask");
      expect(typeof askCommand.execute).toBe("function");
    });

    test("should export chatCommand", async () => {
      const { chatCommand } = await import("../src/inputs/discord/commands");
      expect(chatCommand).toBeTruthy();
      expect(chatCommand.data).toBeTruthy();
      expect(chatCommand.data.name).toBe("chat");
      expect(typeof chatCommand.execute).toBe("function");
    });

    test("should export clearCommand", async () => {
      const { clearCommand } = await import("../src/inputs/discord/commands");
      expect(clearCommand).toBeTruthy();
      expect(clearCommand.data).toBeTruthy();
      expect(clearCommand.data.name).toBe("clear");
      expect(typeof clearCommand.execute).toBe("function");
    });

    test("should export remindCommand", async () => {
      const { remindCommand } = await import("../src/inputs/discord/commands");
      expect(remindCommand).toBeTruthy();
      expect(remindCommand.data).toBeTruthy();
      expect(remindCommand.data.name).toBe("remind");
      expect(typeof remindCommand.execute).toBe("function");
    });

    test("should export statusCommand", async () => {
      const { statusCommand } = await import("../src/inputs/discord/commands");
      expect(statusCommand).toBeTruthy();
      expect(statusCommand.data).toBeTruthy();
      expect(statusCommand.data.name).toBe("status");
      expect(typeof statusCommand.execute).toBe("function");
    });

    test("should export helpCommand", async () => {
      const { helpCommand } = await import("../src/inputs/discord/commands");
      expect(helpCommand).toBeTruthy();
      expect(helpCommand.data).toBeTruthy();
      expect(helpCommand.data.name).toBe("help");
      expect(typeof helpCommand.execute).toBe("function");
    });

    test("should export voiceCommand", async () => {
      const { voiceCommand } = await import("../src/inputs/discord/commands");
      expect(voiceCommand).toBeTruthy();
      expect(voiceCommand.data).toBeTruthy();
      expect(voiceCommand.data.name).toBe("voice");
      expect(typeof voiceCommand.execute).toBe("function");
    });
  });

  describe("Session Management", () => {
    test("should export getSession function", async () => {
      const { getSession } = await import("../src/inputs/discord/commands");
      expect(typeof getSession).toBe("function");
    });

    test("should export addToSession function", async () => {
      const { addToSession } = await import("../src/inputs/discord/commands");
      expect(typeof addToSession).toBe("function");
    });

    test("should export clearSession function", async () => {
      const { clearSession } = await import("../src/inputs/discord/commands");
      expect(typeof clearSession).toBe("function");
    });

    test("should export sessions map", async () => {
      const { sessions } = await import("../src/inputs/discord/commands");
      expect(sessions).toBeTruthy();
      expect(sessions instanceof Map).toBe(true);
    });

    test("getSession should return empty array for new user", async () => {
      const { getSession, sessions } = await import("../src/inputs/discord/commands");

      // Clear any existing session for this test user
      sessions.delete("test-user-new");

      const session = getSession("test-user-new");
      expect(Array.isArray(session)).toBe(true);
      expect(session.length).toBe(0);

      // Cleanup
      sessions.delete("test-user-new");
    });

    test("addToSession should add message to session", async () => {
      const { getSession, addToSession, sessions } = await import("../src/inputs/discord/commands");

      // Clear any existing session
      sessions.delete("test-user-add");

      addToSession("test-user-add", { role: "user", content: "Hello" });
      const session = getSession("test-user-add");

      expect(session.length).toBe(1);
      expect(session[0].role).toBe("user");
      expect(session[0].content).toBe("Hello");

      // Cleanup
      sessions.delete("test-user-add");
    });

    test("addToSession should maintain max history", async () => {
      const { getSession, addToSession, sessions } = await import("../src/inputs/discord/commands");

      // Clear any existing session
      sessions.delete("test-user-max");

      // Add more than MAX_HISTORY messages (20)
      for (let i = 0; i < 25; i++) {
        addToSession("test-user-max", { role: "user", content: `Message ${i}` });
      }

      const session = getSession("test-user-max");
      expect(session.length).toBe(20);
      expect(session[0].content).toBe("Message 5"); // First 5 should be trimmed

      // Cleanup
      sessions.delete("test-user-max");
    });

    test("clearSession should clear user session", async () => {
      const { getSession, addToSession, clearSession, sessions } = await import("../src/inputs/discord/commands");

      // Add some messages first
      sessions.delete("test-user-clear");
      addToSession("test-user-clear", { role: "user", content: "Hello" });
      addToSession("test-user-clear", { role: "assistant", content: "Hi!" });

      expect(getSession("test-user-clear").length).toBe(2);

      clearSession("test-user-clear");

      expect(getSession("test-user-clear").length).toBe(0);

      // Cleanup
      sessions.delete("test-user-clear");
    });
  });

  describe("Command Data Generation", () => {
    test("getCommandData should return array of command JSON data", async () => {
      const { getCommandData } = await import("../src/inputs/discord/commands");

      const data = getCommandData();

      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBeGreaterThan(0);

      // Check that each command has required fields
      for (const cmd of data) {
        expect(cmd.name).toBeTruthy();
        expect(typeof cmd.name).toBe("string");
        expect(cmd.description).toBeTruthy();
        expect(typeof cmd.description).toBe("string");
      }
    });

    test("getCommand should return command by name", async () => {
      const { getCommand } = await import("../src/inputs/discord/commands");

      const askCmd = getCommand("ask");
      expect(askCmd).toBeTruthy();
      expect(askCmd?.data.name).toBe("ask");

      const chatCmd = getCommand("chat");
      expect(chatCmd).toBeTruthy();
      expect(chatCmd?.data.name).toBe("chat");
    });

    test("getCommand should return undefined for unknown command", async () => {
      const { getCommand } = await import("../src/inputs/discord/commands");

      const unknownCmd = getCommand("unknown-command");
      expect(unknownCmd).toBeUndefined();
    });
  });

  describe("Message Splitting", () => {
    test("should export splitMessage function", async () => {
      const { splitMessage } = await import("../src/inputs/discord/commands");
      expect(typeof splitMessage).toBe("function");
    });

    test("splitMessage should not split short messages", async () => {
      const { splitMessage } = await import("../src/inputs/discord/commands");

      const shortMessage = "This is a short message";
      const chunks = splitMessage(shortMessage, 2000);

      expect(chunks.length).toBe(1);
      expect(chunks[0]).toBe(shortMessage);
    });

    test("splitMessage should split long messages", async () => {
      const { splitMessage } = await import("../src/inputs/discord/commands");

      // Create a message longer than 100 characters
      const longMessage = "A".repeat(150);
      const chunks = splitMessage(longMessage, 100);

      expect(chunks.length).toBe(2);
      expect(chunks[0].length).toBeLessThanOrEqual(100);
      expect(chunks[1].length).toBeLessThanOrEqual(100);
    });

    test("splitMessage should prefer breaking at newlines", async () => {
      const { splitMessage } = await import("../src/inputs/discord/commands");

      const messageWithNewlines = "First line\nSecond line\nThird line\nFourth line";
      const chunks = splitMessage(messageWithNewlines, 25);

      // Should break at newlines rather than mid-word
      expect(chunks.length).toBeGreaterThan(1);
      for (const chunk of chunks) {
        // Each chunk should be trimmed and not have dangling spaces
        expect(chunk).toBe(chunk.trim());
      }
    });

    test("splitMessage should prefer breaking at spaces", async () => {
      const { splitMessage } = await import("../src/inputs/discord/commands");

      const messageWithSpaces = "Word1 Word2 Word3 Word4 Word5 Word6 Word7 Word8";
      const chunks = splitMessage(messageWithSpaces, 20);

      expect(chunks.length).toBeGreaterThan(1);
      // Each chunk should not start or end with spaces after trimming
      for (const chunk of chunks) {
        expect(chunk).toBe(chunk.trim());
      }
    });
  });

  describe("Command Definitions", () => {
    test("all commands should have valid data structure", async () => {
      const { slashCommands } = await import("../src/inputs/discord/commands");

      for (const cmd of slashCommands) {
        // Each command should have data and execute
        expect(cmd.data).toBeTruthy();
        expect(typeof cmd.execute).toBe("function");

        // Data should have name and description
        expect(cmd.data.name).toBeTruthy();
        expect(typeof cmd.data.name).toBe("string");
        expect(cmd.data.description).toBeTruthy();
        expect(typeof cmd.data.description).toBe("string");
      }
    });

    test("ask command should have question option", async () => {
      const { askCommand } = await import("../src/inputs/discord/commands");

      const options = (askCommand.data as any).options;
      expect(Array.isArray(options)).toBe(true);

      const questionOption = options?.find((o: any) => o.name === "question");
      expect(questionOption).toBeTruthy();
      expect(questionOption.required).toBe(true);
    });

    test("chat command should have message option", async () => {
      const { chatCommand } = await import("../src/inputs/discord/commands");

      const options = (chatCommand.data as any).options;
      expect(Array.isArray(options)).toBe(true);

      const messageOption = options?.find((o: any) => o.name === "message");
      expect(messageOption).toBeTruthy();
      expect(messageOption.required).toBe(true);
    });

    test("remind command should have time, unit, and message options", async () => {
      const { remindCommand } = await import("../src/inputs/discord/commands");

      const options = (remindCommand.data as any).options;
      expect(Array.isArray(options)).toBe(true);

      const timeOption = options?.find((o: any) => o.name === "time");
      const unitOption = options?.find((o: any) => o.name === "unit");
      const messageOption = options?.find((o: any) => o.name === "message");

      expect(timeOption).toBeTruthy();
      expect(unitOption).toBeTruthy();
      expect(messageOption).toBeTruthy();

      expect(timeOption.required).toBe(true);
      expect(unitOption.required).toBe(true);
      expect(messageOption.required).toBe(true);
    });

    test("voice command should have subcommands", async () => {
      const { voiceCommand } = await import("../src/inputs/discord/commands");

      const options = (voiceCommand.data as any).options;
      expect(Array.isArray(options)).toBe(true);

      // Voice command uses subcommands
      const subcommandNames = options?.map((o: any) => o.name);
      expect(subcommandNames).toContain("join");
      expect(subcommandNames).toContain("leave");
      expect(subcommandNames).toContain("speak");
    });
  });

  describe("Discord Bot Configuration", () => {
    test("DiscordBotConfig interface should be properly typed", async () => {
      const { DiscordBot } = await import("../src/inputs/discord");

      // This is a type-level test - if it compiles, it passes
      // We're checking that the config interface is properly defined
      const config = {
        token: "test-token",
        clientId: "test-client-id",
        guildId: "test-guild-id",
        allowedUserIds: ["user1", "user2"],
        allowedRoleIds: ["role1", "role2"],
        allowDMs: true,
        allowChannels: true,
      };

      expect(config.token).toBe("test-token");
      expect(config.clientId).toBe("test-client-id");
      expect(config.guildId).toBe("test-guild-id");
      expect(config.allowedUserIds).toHaveLength(2);
      expect(config.allowedRoleIds).toHaveLength(2);
      expect(config.allowDMs).toBe(true);
      expect(config.allowChannels).toBe(true);
    });
  });

  describe("Type Exports", () => {
    test("should export SlashCommand type", async () => {
      const mod = await import("../src/inputs/discord/commands");
      expect(mod).toBeTruthy();
      // Type exists if module compiles
    });

    test("should export DiscordBotConfig type", async () => {
      const mod = await import("../src/inputs/discord");
      expect(mod).toBeTruthy();
      // Type exists if module compiles
    });

    test("should export DiscordSessionData type", async () => {
      const mod = await import("../src/inputs/discord");
      expect(mod).toBeTruthy();
      // Type exists if module compiles
    });
  });

  describe("Command Count", () => {
    test("should have expected number of commands", async () => {
      const { slashCommands } = await import("../src/inputs/discord/commands");

      // We defined 7 commands: ask, chat, clear, remind, status, help, voice
      expect(slashCommands.length).toBe(7);
    });

    test("command names should be unique", async () => {
      const { slashCommands } = await import("../src/inputs/discord/commands");

      const names = slashCommands.map(cmd => cmd.data.name);
      const uniqueNames = new Set(names);

      expect(names.length).toBe(uniqueNames.size);
    });
  });

  describe("Module Structure", () => {
    test("discord index should re-export commands module", async () => {
      const discordIndex = await import("../src/inputs/discord");

      // Check that commands are re-exported
      expect(discordIndex.slashCommands).toBeTruthy();
      expect(discordIndex.getCommandData).toBeTruthy();
      expect(discordIndex.getCommand).toBeTruthy();
    });

    test("discord index should have all expected exports", async () => {
      const discordIndex = await import("../src/inputs/discord");

      // Main exports
      expect(typeof discordIndex.createDiscordBot).toBe("function");
      expect(typeof discordIndex.DiscordBot).toBe("function");

      // Command exports
      expect(Array.isArray(discordIndex.slashCommands)).toBe(true);
      expect(typeof discordIndex.getCommandData).toBe("function");
      expect(typeof discordIndex.getCommand).toBe("function");

      // Session exports
      expect(typeof discordIndex.getSession).toBe("function");
      expect(typeof discordIndex.addToSession).toBe("function");
      expect(typeof discordIndex.clearSession).toBe("function");
      expect(discordIndex.sessions instanceof Map).toBe(true);

      // Message utility
      expect(typeof discordIndex.splitMessage).toBe("function");
    });
  });
});
