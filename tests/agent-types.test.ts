import { describe, test, expect } from "bun:test";
import {
  AGENT_SYSTEM_PROMPTS,
  AGENT_TOOL_PERMISSIONS,
} from "../src/core/agents/agent-types";

describe("Agent Types", () => {
  describe("AGENT_SYSTEM_PROMPTS", () => {
    const agentTypes = ["research", "coding", "writing", "analysis"] as const;

    test("should have prompts for all agent types", () => {
      for (const type of agentTypes) {
        expect(AGENT_SYSTEM_PROMPTS[type]).toBeTruthy();
        expect(typeof AGENT_SYSTEM_PROMPTS[type]).toBe("string");
      }
    });

    test("research agent should have research-focused prompt", () => {
      const prompt = AGENT_SYSTEM_PROMPTS.research;
      expect(prompt.toLowerCase()).toContain("research");
      expect(prompt.toLowerCase()).toContain("investigate");
    });

    test("coding agent should have coding-focused prompt", () => {
      const prompt = AGENT_SYSTEM_PROMPTS.coding;
      expect(prompt.toLowerCase()).toContain("code");
      expect(prompt.toLowerCase()).toContain("implement");
    });

    test("writing agent should have writing-focused prompt", () => {
      const prompt = AGENT_SYSTEM_PROMPTS.writing;
      expect(prompt.toLowerCase()).toContain("writ");
      expect(prompt.toLowerCase()).toContain("content");
    });

    test("analysis agent should have analysis-focused prompt", () => {
      const prompt = AGENT_SYSTEM_PROMPTS.analysis;
      expect(prompt.toLowerCase()).toContain("analy");
      expect(prompt.toLowerCase()).toContain("data");
    });

    test("all prompts should include process section", () => {
      for (const type of agentTypes) {
        const prompt = AGENT_SYSTEM_PROMPTS[type];
        expect(prompt.toLowerCase()).toContain("process");
      }
    });

    test("all prompts should include guidelines section", () => {
      for (const type of agentTypes) {
        const prompt = AGENT_SYSTEM_PROMPTS[type];
        expect(prompt.toLowerCase()).toContain("guideline");
      }
    });

    test("all prompts should mention progress reporting", () => {
      for (const type of agentTypes) {
        const prompt = AGENT_SYSTEM_PROMPTS[type];
        expect(prompt.toLowerCase()).toContain("progress");
      }
    });
  });

  describe("AGENT_TOOL_PERMISSIONS", () => {
    const agentTypes = ["research", "coding", "writing", "analysis"] as const;

    test("should have tool permissions for all agent types", () => {
      for (const type of agentTypes) {
        expect(AGENT_TOOL_PERMISSIONS[type]).toBeTruthy();
        expect(Array.isArray(AGENT_TOOL_PERMISSIONS[type])).toBe(true);
      }
    });

    test("all agent types should have at least one tool", () => {
      for (const type of agentTypes) {
        expect(AGENT_TOOL_PERMISSIONS[type].length).toBeGreaterThan(0);
      }
    });

    test("research agent should have web search tools", () => {
      const tools = AGENT_TOOL_PERMISSIONS.research;
      expect(tools).toContain("web_search");
      expect(tools).toContain("browse_url");
    });

    test("research agent should have read_file but not write_file", () => {
      const tools = AGENT_TOOL_PERMISSIONS.research;
      expect(tools).toContain("read_file");
      expect(tools).not.toContain("write_file");
    });

    test("coding agent should have file manipulation tools", () => {
      const tools = AGENT_TOOL_PERMISSIONS.coding;
      expect(tools).toContain("read_file");
      expect(tools).toContain("write_file");
      expect(tools).toContain("execute_command");
    });

    test("coding agent should have search_files tool", () => {
      const tools = AGENT_TOOL_PERMISSIONS.coding;
      expect(tools).toContain("search_files");
    });

    test("writing agent should have write_file tool", () => {
      const tools = AGENT_TOOL_PERMISSIONS.writing;
      expect(tools).toContain("write_file");
      expect(tools).toContain("read_file");
    });

    test("writing agent should not have execute_command", () => {
      const tools = AGENT_TOOL_PERMISSIONS.writing;
      expect(tools).not.toContain("execute_command");
    });

    test("analysis agent should have read-focused tools", () => {
      const tools = AGENT_TOOL_PERMISSIONS.analysis;
      expect(tools).toContain("read_file");
      expect(tools).toContain("list_directory");
    });

    test("analysis agent should not have write_file", () => {
      const tools = AGENT_TOOL_PERMISSIONS.analysis;
      expect(tools).not.toContain("write_file");
    });
  });

  describe("Tool permission security", () => {
    test("only coding agent should have execute_command", () => {
      const agentTypes = ["research", "writing", "analysis"] as const;
      for (const type of agentTypes) {
        expect(AGENT_TOOL_PERMISSIONS[type]).not.toContain("execute_command");
      }
      expect(AGENT_TOOL_PERMISSIONS.coding).toContain("execute_command");
    });

    test("read-only agents should not have write_file", () => {
      expect(AGENT_TOOL_PERMISSIONS.research).not.toContain("write_file");
      expect(AGENT_TOOL_PERMISSIONS.analysis).not.toContain("write_file");
    });

    test("web research tools should be available to appropriate agents", () => {
      // Research and analysis agents need web access
      expect(AGENT_TOOL_PERMISSIONS.research).toContain("web_search");
      expect(AGENT_TOOL_PERMISSIONS.analysis).toContain("web_search");

      // Coding agent doesn't need web access
      expect(AGENT_TOOL_PERMISSIONS.coding).not.toContain("web_search");
    });
  });
});
