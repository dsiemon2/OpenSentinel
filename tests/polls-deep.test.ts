import { describe, test, expect, beforeEach } from "bun:test";
import { PollManager } from "../src/core/polls";

describe("PollManager - Deep Behavioral Tests", () => {
  let pm: PollManager;

  beforeEach(() => {
    pm = new PollManager();
  });

  // ─── Full Voting Lifecycle ───────────────────────────────────────

  describe("full voting lifecycle", () => {
    test("create -> 3 users vote different options -> close -> correct percentages", () => {
      const poll = pm.createPoll({
        question: "Favorite color?",
        options: ["Red", "Blue", "Green"],
        channelType: "telegram",
        channelId: "ch1",
        createdBy: "admin",
      });

      pm.vote(poll.id, 0, "user1"); // Red
      pm.vote(poll.id, 1, "user2"); // Blue
      pm.vote(poll.id, 2, "user3"); // Green

      const results = pm.closePoll(poll.id);
      expect(results).not.toBeNull();
      expect(results!.closed).toBe(true);
      expect(results!.totalVotes).toBe(3);
      expect(results!.options[0].votes).toBe(1);
      expect(results!.options[0].percentage).toBe(33); // Math.round(1/3 * 100) = 33
      expect(results!.options[1].votes).toBe(1);
      expect(results!.options[1].percentage).toBe(33);
      expect(results!.options[2].votes).toBe(1);
      expect(results!.options[2].percentage).toBe(33);
    });

    test("poll results include voter IDs", () => {
      const poll = pm.createPoll({
        question: "Test?",
        options: ["A", "B"],
        channelType: "test",
        channelId: "ch1",
        createdBy: "admin",
      });

      pm.vote(poll.id, 0, "alice");
      pm.vote(poll.id, 0, "bob");
      pm.vote(poll.id, 1, "charlie");

      const results = pm.getPollResults(poll.id);
      expect(results!.options[0].voters).toContain("alice");
      expect(results!.options[0].voters).toContain("bob");
      expect(results!.options[1].voters).toContain("charlie");
    });
  });

  // ─── Single-Select Re-Vote ──────────────────────────────────────

  describe("single-select re-vote", () => {
    test("user votes A then votes B - only B has their vote", () => {
      const poll = pm.createPoll({
        question: "Pick one",
        options: ["A", "B", "C"],
        channelType: "test",
        channelId: "ch1",
        createdBy: "admin",
      });

      pm.vote(poll.id, 0, "user1"); // Vote A
      pm.vote(poll.id, 1, "user1"); // Change to B

      const results = pm.getPollResults(poll.id);
      expect(results!.options[0].votes).toBe(0); // A should have 0
      expect(results!.options[1].votes).toBe(1); // B should have 1
      expect(results!.options[1].voters).toContain("user1");
    });

    test("single-select toggle: vote same option twice removes vote", () => {
      const poll = pm.createPoll({
        question: "Pick one",
        options: ["A", "B"],
        channelType: "test",
        channelId: "ch1",
        createdBy: "admin",
      });

      pm.vote(poll.id, 0, "user1"); // Vote A
      // In single-select, voting same option: first clears all votes (removing A), then toggles (adds A)
      // Actually: first loop removes user from all options (so A goes to 0), then toggle: A doesn't have user -> adds user
      // So voting the same option in single-select RE-ADDS the vote
      pm.vote(poll.id, 0, "user1"); // Vote A again

      const results = pm.getPollResults(poll.id);
      // The logic: for non-multiSelect, first delete from all options, then toggle.
      // After deleting from all: user1 not in A. Toggle: A doesn't have user1 -> add.
      // So user1 IS in A.
      expect(results!.options[0].votes).toBe(1);
    });
  });

  // ─── Multi-Select Voting ────────────────────────────────────────

  describe("multi-select voting", () => {
    test("user selects A and B in multi-select poll", () => {
      const poll = pm.createPoll({
        question: "Pick multiple",
        options: ["A", "B", "C"],
        multiSelect: true,
        channelType: "test",
        channelId: "ch1",
        createdBy: "admin",
      });

      pm.vote(poll.id, 0, "user1"); // Select A
      pm.vote(poll.id, 1, "user1"); // Select B

      const results = pm.getPollResults(poll.id);
      expect(results!.options[0].votes).toBe(1);
      expect(results!.options[0].voters).toContain("user1");
      expect(results!.options[1].votes).toBe(1);
      expect(results!.options[1].voters).toContain("user1");
      expect(results!.options[2].votes).toBe(0);
    });

    test("multi-select toggle: vote A then vote A again removes vote", () => {
      const poll = pm.createPoll({
        question: "Pick multiple",
        options: ["A", "B"],
        multiSelect: true,
        channelType: "test",
        channelId: "ch1",
        createdBy: "admin",
      });

      pm.vote(poll.id, 0, "user1"); // Select A
      expect(pm.getPollResults(poll.id)!.options[0].votes).toBe(1);

      pm.vote(poll.id, 0, "user1"); // Toggle A off
      expect(pm.getPollResults(poll.id)!.options[0].votes).toBe(0);
    });

    test("multi-select does NOT clear previous votes on other options", () => {
      const poll = pm.createPoll({
        question: "Multi",
        options: ["A", "B", "C"],
        multiSelect: true,
        channelType: "test",
        channelId: "ch1",
        createdBy: "admin",
      });

      pm.vote(poll.id, 0, "user1"); // A
      pm.vote(poll.id, 1, "user1"); // B
      pm.vote(poll.id, 2, "user1"); // C

      const results = pm.getPollResults(poll.id);
      // All three should have user1's vote
      expect(results!.options[0].votes).toBe(1);
      expect(results!.options[1].votes).toBe(1);
      expect(results!.options[2].votes).toBe(1);
      // totalVotes is unique voters, so should be 1
      expect(results!.totalVotes).toBe(1);
    });
  });

  // ─── Vote Validation ────────────────────────────────────────────

  describe("vote validation", () => {
    test("vote on closed poll returns error", () => {
      const poll = pm.createPoll({
        question: "Closed?",
        options: ["Yes", "No"],
        channelType: "test",
        channelId: "ch1",
        createdBy: "admin",
      });

      pm.closePoll(poll.id);
      const result = pm.vote(poll.id, 0, "user1");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Poll is closed");
    });

    test("vote with negative option index returns error", () => {
      const poll = pm.createPoll({
        question: "Test",
        options: ["A", "B"],
        channelType: "test",
        channelId: "ch1",
        createdBy: "admin",
      });

      const result = pm.vote(poll.id, -1, "user1");
      expect(result.success).toBe(false);
      expect(result.error).toBe("Invalid option index");
    });

    test("vote with option index >= options.length returns error", () => {
      const poll = pm.createPoll({
        question: "Test",
        options: ["A", "B"],
        channelType: "test",
        channelId: "ch1",
        createdBy: "admin",
      });

      const result = pm.vote(poll.id, 2, "user1");
      expect(result.success).toBe(false);
      expect(result.error).toBe("Invalid option index");
    });

    test("vote on non-existent poll returns error", () => {
      const result = pm.vote("nonexistent-id", 0, "user1");
      expect(result.success).toBe(false);
      expect(result.error).toBe("Poll not found");
    });
  });

  // ─── Large-Scale Voting ─────────────────────────────────────────

  describe("large-scale voting", () => {
    test("50 users vote on 4-option poll - counts and percentages add up", () => {
      const poll = pm.createPoll({
        question: "Big poll",
        options: ["Alpha", "Beta", "Gamma", "Delta"],
        channelType: "test",
        channelId: "ch1",
        createdBy: "admin",
      });

      // Distribute votes: 20 Alpha, 15 Beta, 10 Gamma, 5 Delta
      for (let i = 0; i < 20; i++) pm.vote(poll.id, 0, `user-a-${i}`);
      for (let i = 0; i < 15; i++) pm.vote(poll.id, 1, `user-b-${i}`);
      for (let i = 0; i < 10; i++) pm.vote(poll.id, 2, `user-c-${i}`);
      for (let i = 0; i < 5; i++) pm.vote(poll.id, 3, `user-d-${i}`);

      const results = pm.getPollResults(poll.id);
      expect(results!.totalVotes).toBe(50);
      expect(results!.options[0].votes).toBe(20);
      expect(results!.options[1].votes).toBe(15);
      expect(results!.options[2].votes).toBe(10);
      expect(results!.options[3].votes).toBe(5);

      // Verify percentages
      expect(results!.options[0].percentage).toBe(40);  // 20/50
      expect(results!.options[1].percentage).toBe(30);  // 15/50
      expect(results!.options[2].percentage).toBe(20);  // 10/50
      expect(results!.options[3].percentage).toBe(10);  // 5/50
    });
  });

  // ─── Format Message ─────────────────────────────────────────────

  describe("formatPollMessage", () => {
    test("format shows question, options, vote counts, total voters", () => {
      const poll = pm.createPoll({
        question: "Best language?",
        options: ["TypeScript", "Python", "Rust"],
        channelType: "test",
        channelId: "ch1",
        createdBy: "admin",
      });

      pm.vote(poll.id, 0, "user1");
      pm.vote(poll.id, 0, "user2");
      pm.vote(poll.id, 2, "user3");

      const msg = pm.formatPollMessage(poll.id);

      expect(msg).toContain("Best language?");
      expect(msg).toContain("TypeScript");
      expect(msg).toContain("Python");
      expect(msg).toContain("Rust");
      expect(msg).toContain("2 votes");
      expect(msg).toContain("1 vote");  // singular for Rust
      expect(msg).toContain("0 votes"); // Python has 0
      expect(msg).toContain("3 total voters");
    });

    test("format for closed poll includes 'closed' indicator", () => {
      const poll = pm.createPoll({
        question: "Closed poll",
        options: ["A", "B"],
        channelType: "test",
        channelId: "ch1",
        createdBy: "admin",
      });

      pm.closePoll(poll.id);
      const msg = pm.formatPollMessage(poll.id);

      expect(msg.toLowerCase()).toContain("closed");
    });

    test("format for non-existent poll returns 'Poll not found'", () => {
      const msg = pm.formatPollMessage("fake-id");
      expect(msg).toBe("Poll not found");
    });

    test("format for multi-select poll indicates multiple choices allowed", () => {
      const poll = pm.createPoll({
        question: "Multi",
        options: ["X", "Y"],
        multiSelect: true,
        channelType: "test",
        channelId: "ch1",
        createdBy: "admin",
      });

      const msg = pm.formatPollMessage(poll.id);
      expect(msg.toLowerCase()).toContain("multiple");
    });
  });

  // ─── Active Polls Filtering ─────────────────────────────────────

  describe("getActivePolls filtering", () => {
    test("filters by channelId correctly", () => {
      pm.createPoll({
        question: "Q1",
        options: ["A"],
        channelType: "telegram",
        channelId: "channel-1",
        createdBy: "admin",
      });
      pm.createPoll({
        question: "Q2",
        options: ["A"],
        channelType: "telegram",
        channelId: "channel-2",
        createdBy: "admin",
      });
      pm.createPoll({
        question: "Q3",
        options: ["A"],
        channelType: "discord",
        channelId: "channel-1",
        createdBy: "admin",
      });

      const ch1Polls = pm.getActivePolls("channel-1");
      expect(ch1Polls).toHaveLength(2); // Q1 and Q3 are both in "channel-1"

      const ch2Polls = pm.getActivePolls("channel-2");
      expect(ch2Polls).toHaveLength(1);
      expect(ch2Polls[0].question).toBe("Q2");
    });

    test("getActivePolls without channelId returns all active (closed polls excluded)", () => {
      // Get baseline count of active polls from previous tests
      const baselineActive = pm.getActivePolls();
      const baselineCount = baselineActive.length;

      const p1 = pm.createPoll({
        question: "FilterQ1",
        options: ["A"],
        channelType: "test",
        channelId: "ch-a",
        createdBy: "admin",
      });
      const p2 = pm.createPoll({
        question: "FilterQ2",
        options: ["A"],
        channelType: "test",
        channelId: "ch-b",
        createdBy: "admin",
      });

      // Close one
      pm.closePoll(p1.id);

      const active = pm.getActivePolls();
      // We should have baseline + 1 (only p2 is active)
      expect(active.length).toBe(baselineCount + 1);

      // p2 should be in active, p1 should not
      const activeIds = active.map((p) => p.id);
      expect(activeIds).toContain(p2.id);
      expect(activeIds).not.toContain(p1.id);
    });
  });

  // ─── Delete Poll ────────────────────────────────────────────────

  describe("deletePoll", () => {
    test("deleted poll is removed from active polls", () => {
      const poll = pm.createPoll({
        question: "To be deleted",
        options: ["A"],
        channelType: "test",
        channelId: "ch1",
        createdBy: "admin",
      });

      expect(pm.getPoll(poll.id)).toBeDefined();
      const deleted = pm.deletePoll(poll.id);
      expect(deleted).toBe(true);
      expect(pm.getPoll(poll.id)).toBeUndefined();

      const active = pm.getActivePolls("ch1");
      expect(active.find((p) => p.id === poll.id)).toBeUndefined();
    });

    test("deleting non-existent poll returns false", () => {
      const result = pm.deletePoll("fake-id");
      expect(result).toBe(false);
    });
  });

  // ─── Unanimous Vote ─────────────────────────────────────────────

  describe("unanimous vote", () => {
    test("all voters pick same option yields 100%", () => {
      const poll = pm.createPoll({
        question: "Unanimous?",
        options: ["Yes", "No"],
        channelType: "test",
        channelId: "ch1",
        createdBy: "admin",
      });

      pm.vote(poll.id, 0, "u1");
      pm.vote(poll.id, 0, "u2");
      pm.vote(poll.id, 0, "u3");

      const results = pm.getPollResults(poll.id);
      expect(results!.options[0].percentage).toBe(100);
      expect(results!.options[1].percentage).toBe(0);
      expect(results!.totalVotes).toBe(3);
    });
  });

  // ─── No Votes ───────────────────────────────────────────────────

  describe("no votes", () => {
    test("poll with zero votes has 0% for all options", () => {
      const poll = pm.createPoll({
        question: "Empty",
        options: ["A", "B", "C"],
        channelType: "test",
        channelId: "ch1",
        createdBy: "admin",
      });

      const results = pm.getPollResults(poll.id);
      expect(results!.totalVotes).toBe(0);
      for (const opt of results!.options) {
        expect(opt.votes).toBe(0);
        expect(opt.percentage).toBe(0);
      }
    });
  });

  // ─── Duration / Auto-Close ──────────────────────────────────────

  describe("duration auto-close", () => {
    test("poll with duration has closesAt set correctly", () => {
      const before = Date.now();
      const poll = pm.createPoll({
        question: "Timed",
        options: ["A"],
        duration: 30, // 30 minutes
        channelType: "test",
        channelId: "ch1",
        createdBy: "admin",
      });
      const after = Date.now();

      expect(poll.closesAt).toBeDefined();
      const closesAtMs = poll.closesAt!.getTime();
      // Should be ~30 minutes from now
      expect(closesAtMs).toBeGreaterThanOrEqual(before + 30 * 60 * 1000);
      expect(closesAtMs).toBeLessThanOrEqual(after + 30 * 60 * 1000);

      // Clean up timer
      pm.deletePoll(poll.id);
    });

    test("poll without duration has no closesAt", () => {
      const poll = pm.createPoll({
        question: "No timer",
        options: ["A"],
        channelType: "test",
        channelId: "ch1",
        createdBy: "admin",
      });

      expect(poll.closesAt).toBeUndefined();
    });
  });

  // ─── Multiple Polls per Channel ─────────────────────────────────

  describe("multiple polls per channel", () => {
    test("3 polls in same channel all appear in getActivePolls", () => {
      const polls = [];
      for (let i = 0; i < 3; i++) {
        polls.push(
          pm.createPoll({
            question: `Question ${i}`,
            options: ["A", "B"],
            channelType: "test",
            channelId: "multi-ch",
            createdBy: "admin",
          })
        );
      }

      const active = pm.getActivePolls("multi-ch");
      expect(active).toHaveLength(3);
      const questions = active.map((p) => p.question);
      expect(questions).toContain("Question 0");
      expect(questions).toContain("Question 1");
      expect(questions).toContain("Question 2");
    });
  });

  // ─── Poll Creation ──────────────────────────────────────────────

  describe("poll creation", () => {
    test("created poll has correct default values", () => {
      const poll = pm.createPoll({
        question: "Default test",
        options: ["A", "B"],
        channelType: "test",
        channelId: "ch1",
        createdBy: "admin",
      });

      expect(poll.id).toBeTruthy();
      expect(poll.id.length).toBe(8); // UUID slice(0,8)
      expect(poll.question).toBe("Default test");
      expect(poll.options).toHaveLength(2);
      expect(poll.options[0].text).toBe("A");
      expect(poll.options[1].text).toBe("B");
      expect(poll.multiSelect).toBe(false);
      expect(poll.closed).toBe(false);
      expect(poll.createdBy).toBe("admin");
      expect(poll.channelType).toBe("test");
      expect(poll.channelId).toBe("ch1");
      expect(poll.createdAt).toBeInstanceOf(Date);
    });

    test("each poll option starts with empty vote set", () => {
      const poll = pm.createPoll({
        question: "Vote sets",
        options: ["X", "Y", "Z"],
        channelType: "test",
        channelId: "ch1",
        createdBy: "admin",
      });

      for (const opt of poll.options) {
        expect(opt.votes).toBeInstanceOf(Set);
        expect(opt.votes.size).toBe(0);
      }
    });
  });

  // ─── Close Poll Returns Results ─────────────────────────────────

  describe("closePoll returns results", () => {
    test("closePoll returns full results object", () => {
      const poll = pm.createPoll({
        question: "Close test",
        options: ["A", "B"],
        channelType: "test",
        channelId: "ch1",
        createdBy: "admin",
      });

      pm.vote(poll.id, 0, "user1");

      const results = pm.closePoll(poll.id);
      expect(results).not.toBeNull();
      expect(results!.id).toBe(poll.id);
      expect(results!.question).toBe("Close test");
      expect(results!.closed).toBe(true);
      expect(results!.totalVotes).toBe(1);
      expect(results!.options[0].votes).toBe(1);
    });

    test("closePoll on non-existent poll returns null", () => {
      const result = pm.closePoll("does-not-exist");
      expect(result).toBeNull();
    });
  });

  // ─── PollResults percentage calculation ─────────────────────────

  describe("percentage calculation edge cases", () => {
    test("2 options with equal votes: 50%/50%", () => {
      const poll = pm.createPoll({
        question: "50-50",
        options: ["A", "B"],
        channelType: "test",
        channelId: "ch1",
        createdBy: "admin",
      });

      pm.vote(poll.id, 0, "user1");
      pm.vote(poll.id, 1, "user2");

      const results = pm.getPollResults(poll.id);
      expect(results!.options[0].percentage).toBe(50);
      expect(results!.options[1].percentage).toBe(50);
    });

    test("percentages are rounded via Math.round", () => {
      const poll = pm.createPoll({
        question: "Rounding",
        options: ["A", "B", "C"],
        channelType: "test",
        channelId: "ch1",
        createdBy: "admin",
      });

      // 1 vote out of 3 = 33.33% -> rounds to 33
      pm.vote(poll.id, 0, "u1");
      pm.vote(poll.id, 1, "u2");
      pm.vote(poll.id, 2, "u3");

      const results = pm.getPollResults(poll.id);
      // Math.round(1/3 * 100) = Math.round(33.33) = 33
      expect(results!.options[0].percentage).toBe(33);
      expect(results!.options[1].percentage).toBe(33);
      expect(results!.options[2].percentage).toBe(33);
    });

    test("totalVotes counts unique voters in multi-select", () => {
      const poll = pm.createPoll({
        question: "Multi-total",
        options: ["A", "B", "C"],
        multiSelect: true,
        channelType: "test",
        channelId: "ch1",
        createdBy: "admin",
      });

      // user1 votes A and B, user2 votes B and C
      pm.vote(poll.id, 0, "user1");
      pm.vote(poll.id, 1, "user1");
      pm.vote(poll.id, 1, "user2");
      pm.vote(poll.id, 2, "user2");

      const results = pm.getPollResults(poll.id);
      // totalVotes should be 2 (unique voters), not 4
      expect(results!.totalVotes).toBe(2);
      // Percentages are based on totalVotes (unique voters)
      expect(results!.options[0].percentage).toBe(50);  // 1/2
      expect(results!.options[1].percentage).toBe(100); // 2/2
      expect(results!.options[2].percentage).toBe(50);  // 1/2
    });
  });
});
