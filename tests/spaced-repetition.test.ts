import { describe, test, expect, beforeEach } from "bun:test";
import {
  addItem,
  reviewItem,
  getDueItems,
  getUserItems,
  getStats,
  deleteItem,
  getItem,
} from "../src/core/intelligence/spaced-repetition";

describe("Spaced Repetition System", () => {
  const userId = "sr-test-user";

  describe("addItem", () => {
    test("should create a new review item", () => {
      const item = addItem(userId, "What is the capital of France?", "Paris", "geography");
      expect(item.id).toBeTruthy();
      expect(item.front).toBe("What is the capital of France?");
      expect(item.back).toBe("Paris");
      expect(item.category).toBe("geography");
      expect(item.easeFactor).toBe(2.5);
      expect(item.repetitions).toBe(0);
      expect(item.interval).toBe(0);
      expect(item.userId).toBe(userId);
    });

    test("should be immediately due for review", () => {
      const item = addItem(userId, "Test Q", "Test A");
      expect(item.nextReview.getTime()).toBeLessThanOrEqual(Date.now());
    });
  });

  describe("reviewItem", () => {
    test("should schedule 1 day interval after first correct review", () => {
      const item = addItem(userId, "Q1", "A1");
      const result = reviewItem(item.id, 4); // correct after hesitation
      expect(result).not.toBeNull();
      expect(result!.newInterval).toBe(1);
      expect(result!.item.repetitions).toBe(1);
    });

    test("should schedule 6 day interval after second correct review", () => {
      const item = addItem(userId, "Q2", "A2");
      reviewItem(item.id, 5); // first review: interval = 1
      const result = reviewItem(item.id, 5); // second review: interval = 6
      expect(result!.newInterval).toBe(6);
      expect(result!.item.repetitions).toBe(2);
    });

    test("should multiply interval by ease factor on subsequent reviews", () => {
      const item = addItem(userId, "Q3", "A3");
      reviewItem(item.id, 5); // interval = 1
      reviewItem(item.id, 5); // interval = 6
      const result = reviewItem(item.id, 5); // interval = 6 * EF ≈ 16
      expect(result!.newInterval).toBeGreaterThan(6);
    });

    test("should reset to interval 1 on failed review (quality < 3)", () => {
      const item = addItem(userId, "Q4", "A4");
      reviewItem(item.id, 5); // interval = 1
      reviewItem(item.id, 5); // interval = 6
      const result = reviewItem(item.id, 1); // FAIL — reset
      expect(result!.newInterval).toBe(1);
      expect(result!.item.repetitions).toBe(0);
    });

    test("should decrease ease factor on low quality", () => {
      const item = addItem(userId, "Q5", "A5");
      const initialEF = item.easeFactor;
      const result = reviewItem(item.id, 3); // correct with difficulty
      expect(result!.item.easeFactor).toBeLessThan(initialEF);
    });

    test("should never drop ease factor below 1.3", () => {
      const item = addItem(userId, "Q6", "A6");
      // Fail many times
      for (let i = 0; i < 20; i++) {
        reviewItem(item.id, 0);
      }
      const updated = getItem(item.id);
      expect(updated!.easeFactor).toBeGreaterThanOrEqual(1.3);
    });

    test("should increment totalReviews", () => {
      const item = addItem(userId, "Q7", "A7");
      reviewItem(item.id, 5);
      reviewItem(item.id, 5);
      reviewItem(item.id, 5);
      const updated = getItem(item.id);
      expect(updated!.totalReviews).toBe(3);
    });

    test("should return null for non-existent item", () => {
      const result = reviewItem("nonexistent-id", 5);
      expect(result).toBeNull();
    });
  });

  describe("getDueItems", () => {
    test("should return newly added items (immediately due)", () => {
      const item = addItem(userId + "-due", "Due Q", "Due A");
      const due = getDueItems(userId + "-due");
      expect(due.length).toBeGreaterThanOrEqual(1);
      expect(due.some((d) => d.id === item.id)).toBe(true);
    });

    test("should respect limit parameter", () => {
      const uid = userId + "-limit";
      addItem(uid, "Q1", "A1");
      addItem(uid, "Q2", "A2");
      addItem(uid, "Q3", "A3");
      const due = getDueItems(uid, 2);
      expect(due.length).toBeLessThanOrEqual(2);
    });
  });

  describe("getUserItems", () => {
    test("should return all items for a user", () => {
      const uid = userId + "-all";
      addItem(uid, "Q1", "A1", "math");
      addItem(uid, "Q2", "A2", "science");
      addItem(uid, "Q3", "A3", "math");
      const all = getUserItems(uid);
      expect(all.length).toBe(3);
    });

    test("should filter by category", () => {
      const uid = userId + "-cat";
      addItem(uid, "Q1", "A1", "math");
      addItem(uid, "Q2", "A2", "science");
      const math = getUserItems(uid, "math");
      expect(math.length).toBe(1);
      expect(math[0].category).toBe("math");
    });
  });

  describe("getStats", () => {
    test("should return correct statistics", () => {
      const uid = userId + "-stats";
      addItem(uid, "Q1", "A1", "math");
      addItem(uid, "Q2", "A2", "science");
      const stats = getStats(uid);
      expect(stats.totalItems).toBe(2);
      expect(stats.dueNow).toBe(2);
      expect(stats.averageEaseFactor).toBe(2.5);
      expect(stats.categories).toEqual({ math: 1, science: 1 });
    });
  });

  describe("deleteItem", () => {
    test("should delete an existing item", () => {
      const item = addItem(userId + "-del", "Q", "A");
      expect(deleteItem(item.id)).toBe(true);
      expect(getItem(item.id)).toBeNull();
    });

    test("should return false for non-existent item", () => {
      expect(deleteItem("nonexistent")).toBe(false);
    });
  });
});
