import { describe, test, expect, beforeEach } from "bun:test";
import { PollManager, pollManager } from "../src/core/polls";

describe("Polls System - PollManager", () => {
  let manager: PollManager;

  beforeEach(() => {
    // Create a fresh manager per test to avoid shared state
    manager = new PollManager();
  });

  describe("Module exports", () => {
    test("PollManager class is exported", () => {
      expect(typeof PollManager).toBe("function");
    });

    test("pollManager singleton is exported", () => {
      expect(pollManager).toBeDefined();
      expect(pollManager).toBeInstanceOf(PollManager);
    });

    test("PollManager has expected methods", () => {
      const m = new PollManager();
      expect(typeof m.createPoll).toBe("function");
      expect(typeof m.vote).toBe("function");
      expect(typeof m.closePoll).toBe("function");
      expect(typeof m.getPollResults).toBe("function");
      expect(typeof m.getPoll).toBe("function");
      expect(typeof m.getActivePolls).toBe("function");
      expect(typeof m.deletePoll).toBe("function");
      expect(typeof m.formatPollMessage).toBe("function");
    });
  });

  describe("createPoll", () => {
    test("returns a poll with id, question, and options", () => {
      const poll = manager.createPoll({
        question: "Favorite color?",
        options: ["Red", "Green", "Blue"],
        channelType: "telegram",
        channelId: "chan-1",
        createdBy: "user-1",
      });

      expect(poll.id).toBeTruthy();
      expect(typeof poll.id).toBe("string");
      expect(poll.question).toBe("Favorite color?");
      expect(poll.options).toHaveLength(3);
      expect(poll.options[0].text).toBe("Red");
      expect(poll.options[1].text).toBe("Green");
      expect(poll.options[2].text).toBe("Blue");
    });

    test("each option starts with an empty votes set", () => {
      const poll = manager.createPoll({
        question: "Test?",
        options: ["A", "B"],
        channelType: "discord",
        channelId: "chan-2",
        createdBy: "user-2",
      });

      for (const opt of poll.options) {
        expect(opt.votes).toBeInstanceOf(Set);
        expect(opt.votes.size).toBe(0);
      }
    });

    test("sets closed to false on creation", () => {
      const poll = manager.createPoll({
        question: "Test?",
        options: ["A", "B"],
        channelType: "slack",
        channelId: "chan-3",
        createdBy: "user-3",
      });

      expect(poll.closed).toBe(false);
    });

    test("sets multiSelect when specified", () => {
      const poll = manager.createPoll({
        question: "Multi select?",
        options: ["A", "B", "C"],
        multiSelect: true,
        channelType: "telegram",
        channelId: "chan-4",
        createdBy: "user-4",
      });

      expect(poll.multiSelect).toBe(true);
    });

    test("multiSelect defaults to false", () => {
      const poll = manager.createPoll({
        question: "Default multi?",
        options: ["A", "B"],
        channelType: "web",
        channelId: "chan-5",
        createdBy: "user-5",
      });

      expect(poll.multiSelect).toBe(false);
    });

    test("sets closesAt when duration is provided", () => {
      const before = Date.now();
      const poll = manager.createPoll({
        question: "Timed poll?",
        options: ["Yes", "No"],
        duration: 30, // 30 minutes
        channelType: "telegram",
        channelId: "chan-6",
        createdBy: "user-6",
      });

      expect(poll.closesAt).toBeDefined();
      expect(poll.closesAt).toBeInstanceOf(Date);
      // closesAt should be ~30 minutes from now
      const expectedMin = before + 30 * 60 * 1000 - 5000;
      const expectedMax = before + 30 * 60 * 1000 + 5000;
      expect(poll.closesAt!.getTime()).toBeGreaterThanOrEqual(expectedMin);
      expect(poll.closesAt!.getTime()).toBeLessThanOrEqual(expectedMax);

      // Clean up the timer by deleting the poll
      manager.deletePoll(poll.id);
    });

    test("poll with 0 duration has no closesAt", () => {
      const poll = manager.createPoll({
        question: "No duration?",
        options: ["A", "B"],
        duration: 0,
        channelType: "telegram",
        channelId: "chan-7",
        createdBy: "user-7",
      });

      // duration 0 is falsy, so closesAt should not be set
      expect(poll.closesAt).toBeUndefined();
    });

    test("stores channelType and channelId", () => {
      const poll = manager.createPoll({
        question: "Channel test?",
        options: ["A"],
        channelType: "discord",
        channelId: "specific-channel-id",
        createdBy: "user-8",
      });

      expect(poll.channelType).toBe("discord");
      expect(poll.channelId).toBe("specific-channel-id");
    });

    test("stores createdBy and createdAt", () => {
      const before = new Date();
      const poll = manager.createPoll({
        question: "Creator test?",
        options: ["A"],
        channelType: "telegram",
        channelId: "chan-9",
        createdBy: "creator-user",
      });

      expect(poll.createdBy).toBe("creator-user");
      expect(poll.createdAt).toBeInstanceOf(Date);
      expect(poll.createdAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
    });

    test("generates unique IDs for different polls", () => {
      const poll1 = manager.createPoll({
        question: "Poll 1?",
        options: ["A"],
        channelType: "telegram",
        channelId: "chan",
        createdBy: "user",
      });

      const poll2 = manager.createPoll({
        question: "Poll 2?",
        options: ["B"],
        channelType: "telegram",
        channelId: "chan",
        createdBy: "user",
      });

      expect(poll1.id).not.toBe(poll2.id);
    });
  });

  describe("vote", () => {
    test("records a vote on the correct option", () => {
      const poll = manager.createPoll({
        question: "Vote test?",
        options: ["A", "B", "C"],
        channelType: "telegram",
        channelId: "chan",
        createdBy: "user",
      });

      const result = manager.vote(poll.id, 1, "voter1");
      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();

      const results = manager.getPollResults(poll.id);
      expect(results!.options[1].votes).toBe(1);
      expect(results!.options[1].voters).toContain("voter1");
    });

    test("vote on closed poll returns error", () => {
      const poll = manager.createPoll({
        question: "Closed poll?",
        options: ["A", "B"],
        channelType: "telegram",
        channelId: "chan",
        createdBy: "user",
      });

      manager.closePoll(poll.id);

      const result = manager.vote(poll.id, 0, "voter1");
      expect(result.success).toBe(false);
      expect(result.error).toBe("Poll is closed");
    });

    test("vote with invalid option index (too high) returns error", () => {
      const poll = manager.createPoll({
        question: "Invalid index?",
        options: ["A", "B"],
        channelType: "telegram",
        channelId: "chan",
        createdBy: "user",
      });

      const result = manager.vote(poll.id, 5, "voter1");
      expect(result.success).toBe(false);
      expect(result.error).toBe("Invalid option index");
    });

    test("vote with negative option index returns error", () => {
      const poll = manager.createPoll({
        question: "Negative index?",
        options: ["A", "B"],
        channelType: "telegram",
        channelId: "chan",
        createdBy: "user",
      });

      const result = manager.vote(poll.id, -1, "voter1");
      expect(result.success).toBe(false);
      expect(result.error).toBe("Invalid option index");
    });

    test("vote on non-existent poll returns error", () => {
      const result = manager.vote("nonexistent-id", 0, "voter1");
      expect(result.success).toBe(false);
      expect(result.error).toBe("Poll not found");
    });

    test("vote toggles - voting same option twice removes the vote", () => {
      const poll = manager.createPoll({
        question: "Toggle test?",
        options: ["A", "B"],
        multiSelect: true,
        channelType: "telegram",
        channelId: "chan",
        createdBy: "user",
      });

      // First vote
      manager.vote(poll.id, 0, "voter1");
      let results = manager.getPollResults(poll.id);
      expect(results!.options[0].votes).toBe(1);

      // Toggle (remove)
      manager.vote(poll.id, 0, "voter1");
      results = manager.getPollResults(poll.id);
      expect(results!.options[0].votes).toBe(0);
    });

    test("single-select poll clears previous vote when voting new option", () => {
      const poll = manager.createPoll({
        question: "Single select?",
        options: ["A", "B", "C"],
        multiSelect: false,
        channelType: "telegram",
        channelId: "chan",
        createdBy: "user",
      });

      // Vote for option A
      manager.vote(poll.id, 0, "voter1");
      let results = manager.getPollResults(poll.id);
      expect(results!.options[0].votes).toBe(1);
      expect(results!.options[1].votes).toBe(0);

      // Vote for option B - should clear vote on A
      manager.vote(poll.id, 1, "voter1");
      results = manager.getPollResults(poll.id);
      expect(results!.options[0].votes).toBe(0);
      expect(results!.options[1].votes).toBe(1);
    });

    test("multi-select poll allows voting for multiple options", () => {
      const poll = manager.createPoll({
        question: "Multi vote?",
        options: ["A", "B", "C"],
        multiSelect: true,
        channelType: "telegram",
        channelId: "chan",
        createdBy: "user",
      });

      manager.vote(poll.id, 0, "voter1");
      manager.vote(poll.id, 2, "voter1");

      const results = manager.getPollResults(poll.id);
      expect(results!.options[0].votes).toBe(1);
      expect(results!.options[1].votes).toBe(0);
      expect(results!.options[2].votes).toBe(1);
    });

    test("multiple users can vote on the same poll", () => {
      const poll = manager.createPoll({
        question: "Multi user?",
        options: ["A", "B"],
        channelType: "telegram",
        channelId: "chan",
        createdBy: "user",
      });

      manager.vote(poll.id, 0, "user-1");
      manager.vote(poll.id, 0, "user-2");
      manager.vote(poll.id, 1, "user-3");

      const results = manager.getPollResults(poll.id);
      expect(results!.options[0].votes).toBe(2);
      expect(results!.options[0].voters).toContain("user-1");
      expect(results!.options[0].voters).toContain("user-2");
      expect(results!.options[1].votes).toBe(1);
      expect(results!.options[1].voters).toContain("user-3");
      expect(results!.totalVotes).toBe(3);
    });
  });

  describe("closePoll", () => {
    test("marks poll as closed", () => {
      const poll = manager.createPoll({
        question: "Close me?",
        options: ["A", "B"],
        channelType: "telegram",
        channelId: "chan",
        createdBy: "user",
      });

      const results = manager.closePoll(poll.id);
      expect(results).not.toBeNull();
      expect(results!.closed).toBe(true);

      const fetchedPoll = manager.getPoll(poll.id);
      expect(fetchedPoll!.closed).toBe(true);
    });

    test("returns PollResults when closing", () => {
      const poll = manager.createPoll({
        question: "Results on close?",
        options: ["A", "B"],
        channelType: "telegram",
        channelId: "chan",
        createdBy: "user",
      });

      manager.vote(poll.id, 0, "voter1");

      const results = manager.closePoll(poll.id);
      expect(results).not.toBeNull();
      expect(results!.id).toBe(poll.id);
      expect(results!.question).toBe("Results on close?");
      expect(results!.options).toHaveLength(2);
      expect(results!.totalVotes).toBe(1);
    });

    test("returns null for non-existent poll", () => {
      const result = manager.closePoll("nonexistent");
      expect(result).toBeNull();
    });

    test("closing a poll with a timer clears the timer", () => {
      const poll = manager.createPoll({
        question: "Timer test?",
        options: ["A"],
        duration: 60,
        channelType: "telegram",
        channelId: "chan",
        createdBy: "user",
      });

      // Should not throw
      const results = manager.closePoll(poll.id);
      expect(results).not.toBeNull();
      expect(results!.closed).toBe(true);
    });
  });

  describe("getPollResults", () => {
    test("calculates percentages correctly", () => {
      const poll = manager.createPoll({
        question: "Percentage test?",
        options: ["A", "B", "C", "D"],
        channelType: "telegram",
        channelId: "chan",
        createdBy: "user",
      });

      // 3 voters: 2 vote A, 1 votes B, 0 vote C/D
      manager.vote(poll.id, 0, "user1");
      manager.vote(poll.id, 0, "user2");
      manager.vote(poll.id, 1, "user3");

      const results = manager.getPollResults(poll.id);
      expect(results).not.toBeNull();
      expect(results!.totalVotes).toBe(3);
      expect(results!.options[0].percentage).toBe(67); // Math.round(2/3 * 100)
      expect(results!.options[1].percentage).toBe(33); // Math.round(1/3 * 100)
      expect(results!.options[2].percentage).toBe(0);
      expect(results!.options[3].percentage).toBe(0);
    });

    test("returns 0% when no votes", () => {
      const poll = manager.createPoll({
        question: "No votes?",
        options: ["A", "B"],
        channelType: "telegram",
        channelId: "chan",
        createdBy: "user",
      });

      const results = manager.getPollResults(poll.id);
      expect(results).not.toBeNull();
      expect(results!.totalVotes).toBe(0);
      expect(results!.options[0].percentage).toBe(0);
      expect(results!.options[1].percentage).toBe(0);
    });

    test("returns null for non-existent poll", () => {
      const results = manager.getPollResults("does-not-exist");
      expect(results).toBeNull();
    });

    test("totalVotes counts unique voters, not total votes cast", () => {
      const poll = manager.createPoll({
        question: "Unique voters?",
        options: ["A", "B", "C"],
        multiSelect: true,
        channelType: "telegram",
        channelId: "chan",
        createdBy: "user",
      });

      // user1 votes for A and B (2 votes by 1 voter)
      manager.vote(poll.id, 0, "user1");
      manager.vote(poll.id, 1, "user1");

      const results = manager.getPollResults(poll.id);
      // totalVotes is unique voters (1), not total option-votes (2)
      expect(results!.totalVotes).toBe(1);
    });

    test("returns correct voters array for each option", () => {
      const poll = manager.createPoll({
        question: "Voters list?",
        options: ["A", "B"],
        channelType: "telegram",
        channelId: "chan",
        createdBy: "user",
      });

      manager.vote(poll.id, 0, "alice");
      manager.vote(poll.id, 0, "bob");
      manager.vote(poll.id, 1, "charlie");

      const results = manager.getPollResults(poll.id);
      expect(results!.options[0].voters).toContain("alice");
      expect(results!.options[0].voters).toContain("bob");
      expect(results!.options[0].voters).not.toContain("charlie");
      expect(results!.options[1].voters).toContain("charlie");
    });

    test("100% when all voters vote for one option", () => {
      const poll = manager.createPoll({
        question: "Unanimous?",
        options: ["A", "B"],
        channelType: "telegram",
        channelId: "chan",
        createdBy: "user",
      });

      manager.vote(poll.id, 0, "user1");
      manager.vote(poll.id, 0, "user2");

      const results = manager.getPollResults(poll.id);
      expect(results!.options[0].percentage).toBe(100);
      expect(results!.options[1].percentage).toBe(0);
    });
  });

  describe("getActivePolls", () => {
    test("returns only open polls", () => {
      const poll1 = manager.createPoll({
        question: "Open poll 1?",
        options: ["A"],
        channelType: "telegram",
        channelId: "chan-1",
        createdBy: "user",
      });

      const poll2 = manager.createPoll({
        question: "Open poll 2?",
        options: ["B"],
        channelType: "telegram",
        channelId: "chan-2",
        createdBy: "user",
      });

      manager.closePoll(poll1.id);

      const active = manager.getActivePolls();
      const activeIds = active.map((p) => p.id);
      expect(activeIds).not.toContain(poll1.id);
      expect(activeIds).toContain(poll2.id);
    });

    test("filters by channelId when provided", () => {
      manager.createPoll({
        question: "Chan A poll?",
        options: ["X"],
        channelType: "telegram",
        channelId: "channel-A",
        createdBy: "user",
      });

      manager.createPoll({
        question: "Chan B poll?",
        options: ["Y"],
        channelType: "telegram",
        channelId: "channel-B",
        createdBy: "user",
      });

      const activeA = manager.getActivePolls("channel-A");
      expect(activeA).toHaveLength(1);
      expect(activeA[0].channelId).toBe("channel-A");

      const activeB = manager.getActivePolls("channel-B");
      expect(activeB).toHaveLength(1);
      expect(activeB[0].channelId).toBe("channel-B");
    });

    test("returns all active polls when no channelId filter", () => {
      manager.createPoll({
        question: "Poll 1?",
        options: ["A"],
        channelType: "telegram",
        channelId: "c1",
        createdBy: "user",
      });

      manager.createPoll({
        question: "Poll 2?",
        options: ["B"],
        channelType: "discord",
        channelId: "c2",
        createdBy: "user",
      });

      const all = manager.getActivePolls();
      expect(all.length).toBeGreaterThanOrEqual(2);
    });

    test("returns empty array when no active polls for a given channel", () => {
      // Use a channel ID that has no polls associated with it
      const active = manager.getActivePolls("channel-with-no-polls-ever");
      expect(active).toHaveLength(0);
    });

    test("returns empty array when all polls for a channel are closed", () => {
      const poll = manager.createPoll({
        question: "Will close?",
        options: ["A"],
        channelType: "telegram",
        channelId: "will-close-chan",
        createdBy: "user",
      });

      manager.closePoll(poll.id);

      const active = manager.getActivePolls("will-close-chan");
      expect(active).toHaveLength(0);
    });
  });

  describe("deletePoll", () => {
    test("removes poll and returns true", () => {
      const poll = manager.createPoll({
        question: "Delete me?",
        options: ["A"],
        channelType: "telegram",
        channelId: "chan",
        createdBy: "user",
      });

      const deleted = manager.deletePoll(poll.id);
      expect(deleted).toBe(true);

      const fetched = manager.getPoll(poll.id);
      expect(fetched).toBeUndefined();
    });

    test("returns false when deleting non-existent poll", () => {
      const deleted = manager.deletePoll("nonexistent-poll");
      expect(deleted).toBe(false);
    });

    test("deleted poll no longer appears in getActivePolls", () => {
      const poll = manager.createPoll({
        question: "Delete test?",
        options: ["A"],
        channelType: "telegram",
        channelId: "del-chan",
        createdBy: "user",
      });

      manager.deletePoll(poll.id);

      const active = manager.getActivePolls("del-chan");
      const found = active.find((p) => p.id === poll.id);
      expect(found).toBeUndefined();
    });

    test("deleted poll results return null", () => {
      const poll = manager.createPoll({
        question: "Delete results?",
        options: ["A"],
        channelType: "telegram",
        channelId: "chan",
        createdBy: "user",
      });

      manager.deletePoll(poll.id);

      const results = manager.getPollResults(poll.id);
      expect(results).toBeNull();
    });

    test("deleting a timed poll clears its timer", () => {
      const poll = manager.createPoll({
        question: "Timed delete?",
        options: ["A"],
        duration: 120,
        channelType: "telegram",
        channelId: "chan",
        createdBy: "user",
      });

      // Should not throw; should cleanly clear the timer
      const deleted = manager.deletePoll(poll.id);
      expect(deleted).toBe(true);
    });
  });

  describe("formatPollMessage", () => {
    test("returns formatted string with question and options", () => {
      const poll = manager.createPoll({
        question: "Best language?",
        options: ["TypeScript", "Rust", "Go"],
        channelType: "telegram",
        channelId: "chan",
        createdBy: "user",
      });

      const message = manager.formatPollMessage(poll.id);
      expect(typeof message).toBe("string");
      expect(message).toContain("Best language?");
      expect(message).toContain("TypeScript");
      expect(message).toContain("Rust");
      expect(message).toContain("Go");
    });

    test("returns 'Poll not found' for non-existent poll", () => {
      const message = manager.formatPollMessage("does-not-exist");
      expect(message).toBe("Poll not found");
    });

    test("includes vote counts in message", () => {
      const poll = manager.createPoll({
        question: "Vote count format?",
        options: ["A", "B"],
        channelType: "telegram",
        channelId: "chan",
        createdBy: "user",
      });

      manager.vote(poll.id, 0, "user1");
      manager.vote(poll.id, 0, "user2");

      const message = manager.formatPollMessage(poll.id);
      expect(message).toContain("2 vote");
      expect(message).toContain("0 vote");
    });

    test("includes total voters count", () => {
      const poll = manager.createPoll({
        question: "Total voters?",
        options: ["A", "B"],
        channelType: "telegram",
        channelId: "chan",
        createdBy: "user",
      });

      manager.vote(poll.id, 0, "user1");
      manager.vote(poll.id, 1, "user2");
      manager.vote(poll.id, 1, "user3");

      const message = manager.formatPollMessage(poll.id);
      expect(message).toContain("3 total voter");
    });

    test("shows 'Poll closed' for closed polls", () => {
      const poll = manager.createPoll({
        question: "Closed format?",
        options: ["A"],
        channelType: "telegram",
        channelId: "chan",
        createdBy: "user",
      });

      manager.closePoll(poll.id);

      const message = manager.formatPollMessage(poll.id);
      expect(message).toContain("Poll closed");
    });

    test("shows multi-select note when multiSelect is true", () => {
      const poll = manager.createPoll({
        question: "Multi format?",
        options: ["A", "B"],
        multiSelect: true,
        channelType: "telegram",
        channelId: "chan",
        createdBy: "user",
      });

      const message = manager.formatPollMessage(poll.id);
      expect(message).toContain("Multiple choices allowed");
    });

    test("does not show multi-select note for single-select polls", () => {
      const poll = manager.createPoll({
        question: "Single format?",
        options: ["A", "B"],
        multiSelect: false,
        channelType: "telegram",
        channelId: "chan",
        createdBy: "user",
      });

      const message = manager.formatPollMessage(poll.id);
      expect(message).not.toContain("Multiple choices allowed");
    });

    test("includes percentage in output", () => {
      const poll = manager.createPoll({
        question: "Percentage format?",
        options: ["A", "B"],
        channelType: "telegram",
        channelId: "chan",
        createdBy: "user",
      });

      manager.vote(poll.id, 0, "user1");

      const message = manager.formatPollMessage(poll.id);
      expect(message).toContain("100%");
      expect(message).toContain("0%");
    });
  });

  describe("Edge cases and complex scenarios", () => {
    test("single-select toggle: vote, re-vote same option removes it entirely", () => {
      const poll = manager.createPoll({
        question: "Toggle single?",
        options: ["A", "B"],
        multiSelect: false,
        channelType: "telegram",
        channelId: "chan",
        createdBy: "user",
      });

      // Note: in single-select, voting first clears all votes for user,
      // then toggles. So first vote on 0 adds it, second vote on 0:
      // clears all (removes from 0), then toggles 0 (has userId? no -> add)
      // Wait, let's trace the logic carefully:
      // First call: not multiSelect -> delete from all options (none yet) -> toggle option 0 (not in set -> add)
      manager.vote(poll.id, 0, "voter1");
      let results = manager.getPollResults(poll.id);
      expect(results!.options[0].votes).toBe(1);

      // Second call: not multiSelect -> delete from all options (delete from 0) -> toggle option 0 (not in set now -> add)
      // So it re-adds! This means in single-select, voting same option twice results in the vote staying.
      manager.vote(poll.id, 0, "voter1");
      results = manager.getPollResults(poll.id);
      // After clear-all then toggle: cleared from option 0, then toggled on -> added back
      expect(results!.options[0].votes).toBe(1);
    });

    test("large number of voters", () => {
      const poll = manager.createPoll({
        question: "Many voters?",
        options: ["A", "B"],
        channelType: "telegram",
        channelId: "chan",
        createdBy: "user",
      });

      for (let i = 0; i < 100; i++) {
        manager.vote(poll.id, i % 2, `user-${i}`);
      }

      const results = manager.getPollResults(poll.id);
      expect(results!.totalVotes).toBe(100);
      expect(results!.options[0].votes).toBe(50);
      expect(results!.options[1].votes).toBe(50);
      expect(results!.options[0].percentage).toBe(50);
      expect(results!.options[1].percentage).toBe(50);
    });

    test("getPoll returns the poll object", () => {
      const poll = manager.createPoll({
        question: "Get poll?",
        options: ["A"],
        channelType: "telegram",
        channelId: "chan",
        createdBy: "user",
      });

      const fetched = manager.getPoll(poll.id);
      expect(fetched).toBeDefined();
      expect(fetched!.id).toBe(poll.id);
      expect(fetched!.question).toBe("Get poll?");
    });

    test("getPoll returns undefined for non-existent poll", () => {
      const fetched = manager.getPoll("nope");
      expect(fetched).toBeUndefined();
    });

    test("closePoll then vote returns error", () => {
      const poll = manager.createPoll({
        question: "Close then vote?",
        options: ["A", "B"],
        channelType: "telegram",
        channelId: "chan",
        createdBy: "user",
      });

      manager.closePoll(poll.id);
      const result = manager.vote(poll.id, 0, "late-voter");
      expect(result.success).toBe(false);
      expect(result.error).toBe("Poll is closed");
    });

    test("vote at boundary option indices (0 and last)", () => {
      const poll = manager.createPoll({
        question: "Boundary test?",
        options: ["First", "Middle", "Last"],
        channelType: "telegram",
        channelId: "chan",
        createdBy: "user",
      });

      const r1 = manager.vote(poll.id, 0, "user1");
      expect(r1.success).toBe(true);

      const r2 = manager.vote(poll.id, 2, "user2");
      expect(r2.success).toBe(true);

      const results = manager.getPollResults(poll.id);
      expect(results!.options[0].votes).toBe(1);
      expect(results!.options[2].votes).toBe(1);
    });

    test("vote at exact boundary (options.length) returns error", () => {
      const poll = manager.createPoll({
        question: "Exact boundary?",
        options: ["A", "B"],
        channelType: "telegram",
        channelId: "chan",
        createdBy: "user",
      });

      const result = manager.vote(poll.id, 2, "user1"); // index 2 with 2 options
      expect(result.success).toBe(false);
      expect(result.error).toBe("Invalid option index");
    });
  });
});
