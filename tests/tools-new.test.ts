import { describe, test, expect } from "bun:test";
import { TOOLS, executeTool } from "../src/tools/index";

describe("New Tools - TOOLS Array", () => {
  // Helper to find a tool by name
  function findTool(name: string) {
    return TOOLS.find((t) => t.name === name);
  }

  // Helper to get required params from a tool's input_schema
  function getRequiredParams(name: string): string[] {
    const tool = findTool(name);
    if (!tool) return [];
    return (tool.input_schema as { required?: string[] }).required ?? [];
  }

  describe("TOOLS array contains new tools", () => {
    test("should contain 'apply_patch' tool", () => {
      // Arrange & Act
      const tool = findTool("apply_patch");

      // Assert
      expect(tool).toBeDefined();
      expect(tool!.name).toBe("apply_patch");
    });

    test("should contain 'create_poll' tool", () => {
      // Arrange & Act
      const tool = findTool("create_poll");

      // Assert
      expect(tool).toBeDefined();
      expect(tool!.name).toBe("create_poll");
    });

    test("should contain 'teach_skill' tool", () => {
      // Arrange & Act
      const tool = findTool("teach_skill");

      // Assert
      expect(tool).toBeDefined();
      expect(tool!.name).toBe("teach_skill");
    });

    test("should contain 'run_skill' tool", () => {
      // Arrange & Act
      const tool = findTool("run_skill");

      // Assert
      expect(tool).toBeDefined();
      expect(tool!.name).toBe("run_skill");
    });

    test("should contain 'hub_browse' tool", () => {
      // Arrange & Act
      const tool = findTool("hub_browse");

      // Assert
      expect(tool).toBeDefined();
      expect(tool!.name).toBe("hub_browse");
    });

    test("should contain 'hub_install' tool", () => {
      // Arrange & Act
      const tool = findTool("hub_install");

      // Assert
      expect(tool).toBeDefined();
      expect(tool!.name).toBe("hub_install");
    });

    test("should contain 'hub_publish' tool", () => {
      // Arrange & Act
      const tool = findTool("hub_publish");

      // Assert
      expect(tool).toBeDefined();
      expect(tool!.name).toBe("hub_publish");
    });
  });

  describe("Total TOOLS count", () => {
    test("should have at least 60 tools", () => {
      // Arrange & Act (original tools + business tools + OSINT tools)
      const count = TOOLS.length;

      // Assert — count grows as new tools are added
      expect(count).toBeGreaterThanOrEqual(60);
    });
  });

  describe("Tool required parameters", () => {
    test("apply_patch should require file_path and patch", () => {
      // Arrange & Act
      const required = getRequiredParams("apply_patch");

      // Assert
      expect(required).toContain("file_path");
      expect(required).toContain("patch");
    });

    test("create_poll should require question and options", () => {
      // Arrange & Act
      const required = getRequiredParams("create_poll");

      // Assert
      expect(required).toContain("question");
      expect(required).toContain("options");
    });

    test("teach_skill should require name, description, and instructions", () => {
      // Arrange & Act
      const required = getRequiredParams("teach_skill");

      // Assert
      expect(required).toContain("name");
      expect(required).toContain("description");
      expect(required).toContain("instructions");
    });

    test("run_skill should require skill", () => {
      // Arrange & Act
      const required = getRequiredParams("run_skill");

      // Assert
      expect(required).toContain("skill");
    });

    test("hub_browse should have no required params", () => {
      // Arrange & Act
      const required = getRequiredParams("hub_browse");

      // Assert
      expect(required.length).toBe(0);
    });

    test("hub_install should require item_id", () => {
      // Arrange & Act
      const required = getRequiredParams("hub_install");

      // Assert
      expect(required).toContain("item_id");
    });

    test("hub_publish should require name, description, category, and data", () => {
      // Arrange & Act
      const required = getRequiredParams("hub_publish");

      // Assert
      expect(required).toContain("name");
      expect(required).toContain("description");
      expect(required).toContain("category");
      expect(required).toContain("data");
    });
  });

  describe("executeTool - create_poll", () => {
    test("should create a poll and return poll data", async () => {
      // Arrange
      const input = {
        question: "What is your favorite language?",
        options: ["TypeScript", "Python", "Rust"],
      };

      // Act
      const result = await executeTool("create_poll", input);

      // Assert
      expect(result.success).toBe(true);
      expect(result.result).toBeTruthy();
      const data = result.result as {
        pollId: string;
        question: string;
        options: string[];
        message: string;
      };
      expect(data.pollId).toBeTruthy();
      expect(data.question).toBe("What is your favorite language?");
      expect(data.options).toEqual(["TypeScript", "Python", "Rust"]);
      expect(typeof data.message).toBe("string");
    });
  });

  describe("executeTool - teach_skill", () => {
    test("should create a skill and return skill data", async () => {
      // Arrange
      const input = {
        name: "Test Skill",
        description: "A test skill for unit testing",
        instructions: "When invoked, respond with 'test passed'",
      };

      // Act
      const result = await executeTool("teach_skill", input);

      // Assert
      expect(result.success).toBe(true);
      expect(result.result).toBeTruthy();
      const data = result.result as {
        skillId: string;
        skillName: string;
        message: string;
      };
      expect(data.skillId).toBeTruthy();
      expect(data.skillName).toBe("Test Skill");
      expect(typeof data.message).toBe("string");
    });
  });

  describe("executeTool - hub_browse", () => {
    test("should return items list from the hub", async () => {
      // Arrange
      const input = {};

      // Act
      const result = await executeTool("hub_browse", input);

      // Assert
      expect(result.success).toBe(true);
      expect(result.result).toBeTruthy();
      const data = result.result as {
        items: Array<{
          id: string;
          name: string;
          description: string;
          category: string;
        }>;
        total: number;
      };
      expect(Array.isArray(data.items)).toBe(true);
      expect(typeof data.total).toBe("number");
    });
  });

  describe("executeTool - hub_publish", () => {
    test("should publish an item to the hub and return itemId", async () => {
      // Arrange
      const input = {
        name: "My Published Skill",
        description: "A skill published via test",
        category: "skills",
        data: JSON.stringify({
          name: "My Published Skill",
          instructions: "Do something cool",
        }),
      };

      // Act
      const result = await executeTool("hub_publish", input);

      // Assert
      expect(result.success).toBe(true);
      expect(result.result).toBeTruthy();
      const data = result.result as {
        itemId: string;
        message: string;
      };
      expect(data.itemId).toBeTruthy();
      expect(typeof data.message).toBe("string");
      expect(data.message).toContain("My Published Skill");
    });
  });
});
