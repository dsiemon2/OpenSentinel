import { describe, test, expect, beforeEach } from "bun:test";

describe("Meeting Assistant", () => {
  beforeEach(async () => {
    const { clearMeetings } = await import("../src/tools/meeting-assistant");
    clearMeetings();
  });

  describe("Module Exports", () => {
    test("should export core functions", async () => {
      const mod = await import("../src/tools/meeting-assistant");
      expect(typeof mod.addMeeting).toBe("function");
      expect(typeof mod.getMeeting).toBe("function");
      expect(typeof mod.listMeetings).toBe("function");
      expect(typeof mod.extractActionItems).toBe("function");
      expect(typeof mod.extractDecisions).toBe("function");
      expect(typeof mod.summarizeMeeting).toBe("function");
      expect(typeof mod.getAllPendingActions).toBe("function");
      expect(typeof mod.getWeeklyDigest).toBe("function");
    });
  });

  describe("extractActionItems", () => {
    test("should extract action items from text", async () => {
      const { extractActionItems } = await import("../src/tools/meeting-assistant");
      const actions = extractActionItems(
        "- TODO: Update the documentation\n- Action: John will review the PR\nAlice will schedule the deployment"
      );
      expect(actions.length).toBeGreaterThanOrEqual(2);
    });

    test("should detect owners from 'X will' pattern", async () => {
      const { extractActionItems } = await import("../src/tools/meeting-assistant");
      const actions = extractActionItems("Sarah will prepare the presentation for next week");
      const sarahAction = actions.find((a) => a.owner === "Sarah");
      expect(sarahAction).toBeTruthy();
    });

    test("should set pending status", async () => {
      const { extractActionItems } = await import("../src/tools/meeting-assistant");
      const actions = extractActionItems("- TODO: Fix the login bug");
      expect(actions.length).toBeGreaterThanOrEqual(1);
      expect(actions[0].status).toBe("pending");
    });
  });

  describe("extractDecisions", () => {
    test("should extract decisions", async () => {
      const { extractDecisions } = await import("../src/tools/meeting-assistant");
      const decisions = extractDecisions(
        "We decided to use PostgreSQL. The team agreed to launch on March 15. Going forward, we'll use Slack for communication."
      );
      expect(decisions.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe("summarizeMeeting", () => {
    test("should generate a summary", async () => {
      const { summarizeMeeting } = await import("../src/tools/meeting-assistant");
      const summary = summarizeMeeting(
        "We discussed the Q1 roadmap. The team reviewed the current sprint progress. We decided to prioritize the mobile app. " +
        "Action: Sarah will create mockups. The important deadline is March 31. Bob will handle the backend API. " +
        "We covered the budget allocation for the next quarter. The conclusion is that we need more engineers."
      );
      expect(summary.length).toBeGreaterThan(20);
    });

    test("should handle empty text", async () => {
      const { summarizeMeeting } = await import("../src/tools/meeting-assistant");
      const summary = summarizeMeeting("");
      expect(summary).toBe("No content to summarize.");
    });
  });

  describe("addMeeting", () => {
    test("should create a meeting with auto-extraction", async () => {
      const { addMeeting } = await import("../src/tools/meeting-assistant");
      const meeting = addMeeting("Sprint Planning", {
        transcript: "We decided to use React for the frontend. TODO: John will set up the project. Alice will create the design spec.",
        attendees: ["John", "Alice", "Bob"],
        duration: 60,
      });
      expect(meeting.id).toMatch(/^MTG-/);
      expect(meeting.title).toBe("Sprint Planning");
      expect(meeting.attendees).toHaveLength(3);
      expect(meeting.actionItems.length).toBeGreaterThanOrEqual(1);
      expect(meeting.decisions.length).toBeGreaterThanOrEqual(1);
    });

    test("should generate summary from transcript", async () => {
      const { addMeeting } = await import("../src/tools/meeting-assistant");
      const meeting = addMeeting("Review", {
        transcript: "Discussed the important quarterly results. Talked about hiring plans. We agreed to expand the team.",
      });
      expect(meeting.summary).toBeDefined();
      expect(meeting.summary!.length).toBeGreaterThan(10);
    });
  });

  describe("updateAction", () => {
    test("should update action status", async () => {
      const { addMeeting, updateAction } = await import("../src/tools/meeting-assistant");
      const meeting = addMeeting("Test", {
        transcript: "- TODO: Fix the bug\n- TODO: Update docs",
      });
      expect(meeting.actionItems.length).toBeGreaterThanOrEqual(1);
      const updated = updateAction(meeting.id, 0, "done");
      expect(updated.status).toBe("done");
    });
  });

  describe("getAllPendingActions", () => {
    test("should return pending actions across meetings", async () => {
      const { addMeeting, getAllPendingActions } = await import("../src/tools/meeting-assistant");
      addMeeting("Meeting 1", { transcript: "- TODO: Task A" });
      addMeeting("Meeting 2", { transcript: "- TODO: Task B" });
      const pending = getAllPendingActions();
      expect(pending.length).toBeGreaterThanOrEqual(2);
      expect(pending[0].meetingTitle).toBeDefined();
    });
  });

  describe("getWeeklyDigest", () => {
    test("should return weekly digest", async () => {
      const { addMeeting, getWeeklyDigest } = await import("../src/tools/meeting-assistant");
      addMeeting("Weekly Standup", { duration: 30, transcript: "We decided to launch the beta" });
      const digest = getWeeklyDigest();
      expect(digest.totalMeetings).toBeGreaterThanOrEqual(1);
      expect(digest.digest).toContain("meeting");
    });
  });

  describe("Tool Definition", () => {
    test("should include meeting_assistant in TOOLS", async () => {
      const { TOOLS } = await import("../src/tools/index");
      expect(TOOLS.find((t) => t.name === "meeting_assistant")).toBeTruthy();
    });
  });

  describe("executeTool", () => {
    test("should handle add action", async () => {
      const { executeTool } = await import("../src/tools/index");
      const result = await executeTool("meeting_assistant", {
        action: "add",
        title: "Test Meeting",
        transcript: "We decided to use TypeScript. TODO: Bob will update the config.",
      });
      expect(result.success).toBe(true);
      expect((result.result as any).meeting.id).toMatch(/^MTG-/);
    });

    test("should handle extract_actions", async () => {
      const { executeTool } = await import("../src/tools/index");
      const result = await executeTool("meeting_assistant", {
        action: "extract_actions",
        text: "- TODO: Fix the deployment\nAlice will write the tests",
      });
      expect(result.success).toBe(true);
      expect((result.result as any).count).toBeGreaterThanOrEqual(1);
    });
  });
});
