import { describe, test, expect, beforeAll } from "bun:test";
import { SentinelHub, sentinelHub } from "../src/core/hub/index";
import { BUILTIN_SKILLS } from "../src/core/hub/builtin-skills";

// The SentinelHub uses a module-level Map and a module-level `initialized` flag.
// Since `initialize()` is guarded by the flag, it can only run once per process.
// We call it once via beforeAll and then test the shared state.

describe("Sentinel Hub", () => {
  // =========================================================================
  // Module exports
  // =========================================================================
  describe("Module exports", () => {
    test("SentinelHub class is exported", () => {
      expect(typeof SentinelHub).toBe("function");
    });

    test("sentinelHub singleton is exported and is an instance of SentinelHub", () => {
      expect(sentinelHub).toBeDefined();
      expect(sentinelHub).toBeInstanceOf(SentinelHub);
    });
  });

  // =========================================================================
  // BUILTIN_SKILLS
  // =========================================================================
  describe("BUILTIN_SKILLS", () => {
    test("is an array with at least 10 items", () => {
      expect(Array.isArray(BUILTIN_SKILLS)).toBe(true);
      expect(BUILTIN_SKILLS.length).toBeGreaterThanOrEqual(10);
    });

    test("each builtin skill has name, description, trigger, instructions, tools, tags, category", () => {
      for (const skill of BUILTIN_SKILLS) {
        expect(typeof skill.name).toBe("string");
        expect(skill.name.length).toBeGreaterThan(0);

        expect(typeof skill.description).toBe("string");
        expect(skill.description.length).toBeGreaterThan(0);

        expect(typeof skill.trigger).toBe("string");
        expect(skill.trigger.startsWith("/")).toBe(true);

        expect(typeof skill.instructions).toBe("string");
        expect(skill.instructions.length).toBeGreaterThan(0);

        expect(Array.isArray(skill.tools)).toBe(true);

        expect(Array.isArray(skill.tags)).toBe(true);
        expect(skill.tags.length).toBeGreaterThan(0);

        expect(typeof skill.category).toBe("string");
        expect(["productivity", "development", "research", "communication", "utility"]).toContain(
          skill.category
        );
      }
    });

    test("all builtin skill names are unique", () => {
      const names = BUILTIN_SKILLS.map((s) => s.name);
      const uniqueNames = new Set(names);
      expect(uniqueNames.size).toBe(names.length);
    });

    test("all builtin skill triggers are unique", () => {
      const triggers = BUILTIN_SKILLS.map((s) => s.trigger);
      const uniqueTriggers = new Set(triggers);
      expect(uniqueTriggers.size).toBe(triggers.length);
    });
  });

  // =========================================================================
  // SentinelHub methods (uses sentinelHub singleton)
  // =========================================================================
  describe("SentinelHub operations", () => {
    beforeAll(async () => {
      await sentinelHub.initialize();
    });

    // --- initialize ------------------------------------------------------

    describe("initialize", () => {
      test("populates hub with builtin skills", () => {
        // Act
        const { items, total } = sentinelHub.browseHub();

        // Assert — at least 10 builtin skills should be present
        expect(total).toBeGreaterThanOrEqual(10);
      });

      test("calling initialize again is idempotent (does not duplicate)", async () => {
        // Arrange
        const before = sentinelHub.browseHub().total;

        // Act
        await sentinelHub.initialize();

        // Assert
        const after = sentinelHub.browseHub().total;
        expect(after).toBe(before);
      });
    });

    // --- browseHub -------------------------------------------------------

    describe("browseHub", () => {
      test("returns items array and total count", () => {
        // Act
        const result = sentinelHub.browseHub();

        // Assert
        expect(Array.isArray(result.items)).toBe(true);
        expect(typeof result.total).toBe("number");
        expect(result.items.length).toBeGreaterThan(0);
      });

      test("filters by category", () => {
        // Act
        const result = sentinelHub.browseHub({ category: "skills" });

        // Assert
        expect(result.total).toBeGreaterThan(0);
        for (const item of result.items) {
          expect(item.category).toBe("skills");
        }
      });

      test("filters by category with no matches returns empty", () => {
        // Act — builtin skills are all category "skills", "plugins" should be empty initially
        // (unless publishToHub added some — we haven't yet at this point in the describe block)
        const result = sentinelHub.browseHub({ category: "nonexistent_category_xyz" });

        // Assert
        expect(result.items.length).toBe(0);
        expect(result.total).toBe(0);
      });

      test("filters by search query (name match)", () => {
        // Act — "Code Review" is a builtin skill name
        const result = sentinelHub.browseHub({ search: "Code Review" });

        // Assert
        expect(result.total).toBeGreaterThanOrEqual(1);
        const names = result.items.map((i) => i.name);
        expect(names).toContain("Code Review");
      });

      test("filters by search query (description match)", () => {
        // Act — "changelog" appears in Git Changelog description
        const result = sentinelHub.browseHub({ search: "changelog" });

        // Assert
        expect(result.total).toBeGreaterThanOrEqual(1);
      });

      test("filters by tag", () => {
        // Act — "research" is a tag on Summarize Webpage and Research Topic
        const result = sentinelHub.browseHub({ tag: "research" });

        // Assert
        expect(result.total).toBeGreaterThanOrEqual(1);
        for (const item of result.items) {
          const tagLower = item.tags.map((t) => t.toLowerCase());
          expect(tagLower).toContain("research");
        }
      });

      test("supports pagination with offset and limit", () => {
        // Arrange
        const allResult = sentinelHub.browseHub({ category: "skills" });
        const allTotal = allResult.total;

        // Act — get first 3
        const page1 = sentinelHub.browseHub({ category: "skills", limit: 3, offset: 0 });

        // Act — get next 3
        const page2 = sentinelHub.browseHub({ category: "skills", limit: 3, offset: 3 });

        // Assert
        expect(page1.items.length).toBe(3);
        expect(page1.total).toBe(allTotal); // total is unaffected by pagination
        expect(page2.items.length).toBe(3);

        // Pages should not overlap
        const page1Ids = page1.items.map((i) => i.id);
        const page2Ids = page2.items.map((i) => i.id);
        for (const id of page2Ids) {
          expect(page1Ids).not.toContain(id);
        }
      });

      test("items are sorted by rating then downloads", () => {
        // Act
        const { items } = sentinelHub.browseHub({ category: "skills" });

        // Assert — verify sorting: higher rating first, then higher downloads
        for (let i = 1; i < items.length; i++) {
          const prev = items[i - 1];
          const curr = items[i];
          if (prev.rating === curr.rating) {
            expect(prev.downloads).toBeGreaterThanOrEqual(curr.downloads);
          } else {
            expect(prev.rating).toBeGreaterThanOrEqual(curr.rating);
          }
        }
      });
    });

    // --- installFromHub --------------------------------------------------

    describe("installFromHub", () => {
      test("installs a builtin skill successfully", async () => {
        // Arrange — use the first builtin skill's hub ID
        const trigger = BUILTIN_SKILLS[0].trigger.replace("/", "");
        const itemId = `builtin-${trigger}`;

        // Act
        const result = await sentinelHub.installFromHub(itemId, "install-user");

        // Assert
        expect(result.success).toBe(true);
        expect(result.message).toContain("Installed");
        expect(result.skillId).toBeDefined();
      });

      test("increments download count on install", async () => {
        // Arrange
        const trigger = BUILTIN_SKILLS[1].trigger.replace("/", "");
        const itemId = `builtin-${trigger}`;
        const before = sentinelHub.getItem(itemId)!.downloads;

        // Act
        await sentinelHub.installFromHub(itemId, "dl-user");

        // Assert
        const after = sentinelHub.getItem(itemId)!.downloads;
        expect(after).toBe(before + 1);
      });

      test("returns error for invalid/unknown item ID", async () => {
        // Act
        const result = await sentinelHub.installFromHub("nonexistent-id-xyz", "user-1");

        // Assert
        expect(result.success).toBe(false);
        expect(result.message).toContain("not found");
      });
    });

    // --- publishToHub ----------------------------------------------------

    describe("publishToHub", () => {
      test("adds a new item to the hub", async () => {
        // Arrange
        const beforeCount = sentinelHub.browseHub().total;

        // Act
        const result = await sentinelHub.publishToHub({
          name: "Custom Plugin",
          description: "My custom plugin",
          category: "plugins",
          data: JSON.stringify({ name: "Custom Plugin", instructions: "do stuff" }),
          author: "test-author",
          tags: ["custom"],
          version: "2.0.0",
        });

        // Assert
        expect(result.success).toBe(true);
        expect(result.message).toContain("Published");
        expect(sentinelHub.browseHub().total).toBe(beforeCount + 1);
      });

      test("returns a valid item ID", async () => {
        // Act
        const result = await sentinelHub.publishToHub({
          name: "ID Check Plugin",
          description: "Check ID",
          category: "templates",
          data: "{}",
          author: "author-x",
        });

        // Assert
        expect(result.itemId).toBeDefined();
        expect(result.itemId!.startsWith("user-")).toBe(true);

        // The item should be retrievable
        const item = sentinelHub.getItem(result.itemId!);
        expect(item).toBeDefined();
        expect(item!.name).toBe("ID Check Plugin");
      });

      test("published item has correct default values", async () => {
        // Act
        const result = await sentinelHub.publishToHub({
          name: "Defaults Check",
          description: "Check defaults",
          category: "workflows",
          data: "{}",
          author: "author-y",
        });

        // Assert
        const item = sentinelHub.getItem(result.itemId!)!;
        expect(item.version).toBe("1.0.0"); // default version
        expect(item.tags).toEqual([]); // default tags
        expect(item.rating).toBe(0);
        expect(item.ratingCount).toBe(0);
        expect(item.downloads).toBe(0);
        expect(item.createdAt).toBeInstanceOf(Date);
      });
    });

    // --- rateItem --------------------------------------------------------

    describe("rateItem", () => {
      let rateItemId: string;

      beforeAll(async () => {
        const result = await sentinelHub.publishToHub({
          name: "Ratable Item",
          description: "For rating tests",
          category: "skills",
          data: JSON.stringify({ name: "Ratable", instructions: "rate me" }),
          author: "rate-author",
        });
        rateItemId = result.itemId!;
      });

      test("updates the rating successfully", () => {
        // Act
        const result = sentinelHub.rateItem(rateItemId, "rater-1", 4);

        // Assert
        expect(result.success).toBe(true);
        expect(result.newRating).toBeDefined();
        expect(result.newRating).toBe(4);
      });

      test("clamps rating below 1 to 1", () => {
        // Act
        const result = sentinelHub.rateItem(rateItemId, "rater-clamp-low", 0);

        // Assert
        expect(result.success).toBe(true);
        const item = sentinelHub.getItem(rateItemId)!;
        // rater-1 gave 4, rater-clamp-low clamped to 1 => avg = (4+1)/2 = 2.5
        expect(item.rating).toBeGreaterThanOrEqual(1);
      });

      test("clamps rating above 5 to 5", () => {
        // Act
        const result = sentinelHub.rateItem(rateItemId, "rater-clamp-high", 10);

        // Assert
        expect(result.success).toBe(true);
        const item = sentinelHub.getItem(rateItemId)!;
        // All ratings: rater-1=4, rater-clamp-low=1, rater-clamp-high=5 => avg = (4+1+5)/3 = 3.3
        expect(item.rating).toBeLessThanOrEqual(5);
      });

      test("recalculates average with multiple raters", () => {
        // Arrange — already have 3 ratings from prior tests
        // rater-1=4, rater-clamp-low=1, rater-clamp-high=5
        // Average = (4+1+5)/3 = 3.3 rounded to 1 decimal

        // Act — add another rating
        sentinelHub.rateItem(rateItemId, "rater-avg", 3);

        // Assert
        const item = sentinelHub.getItem(rateItemId)!;
        // (4+1+5+3)/4 = 3.25 => rounded to 3.3
        expect(item.ratingCount).toBe(4);
        expect(item.rating).toBe(3.3); // Math.round(3.25 * 10) / 10 = 3.3
      });

      test("same user re-rating updates their previous rating", () => {
        // Arrange
        const beforeCount = sentinelHub.getItem(rateItemId)!.ratingCount;

        // Act — rater-1 changes from 4 to 5
        sentinelHub.rateItem(rateItemId, "rater-1", 5);

        // Assert — count should NOT increase (same user)
        const item = sentinelHub.getItem(rateItemId)!;
        expect(item.ratingCount).toBe(beforeCount);
        // New average: (5+1+5+3)/4 = 3.5
        expect(item.rating).toBe(3.5);
      });

      test("returns failure for non-existent item", () => {
        // Act
        const result = sentinelHub.rateItem("bad-item-id", "user-1", 3);

        // Assert
        expect(result.success).toBe(false);
        expect(result.newRating).toBeUndefined();
      });
    });

    // --- getItem ---------------------------------------------------------

    describe("getItem", () => {
      test("returns item by ID", () => {
        // Arrange
        const trigger = BUILTIN_SKILLS[0].trigger.replace("/", "");
        const itemId = `builtin-${trigger}`;

        // Act
        const item = sentinelHub.getItem(itemId);

        // Assert
        expect(item).toBeDefined();
        expect(item!.id).toBe(itemId);
        expect(item!.name).toBe(BUILTIN_SKILLS[0].name);
      });

      test("returns undefined for unknown ID", () => {
        // Act
        const item = sentinelHub.getItem("nonexistent-xyz-123");

        // Assert
        expect(item).toBeUndefined();
      });
    });

    // --- getStats --------------------------------------------------------

    describe("getStats", () => {
      test("returns counts by category", () => {
        // Act
        const stats = sentinelHub.getStats();

        // Assert
        expect(typeof stats.totalItems).toBe("number");
        expect(stats.totalItems).toBeGreaterThan(0);

        expect(typeof stats.categories.skills).toBe("number");
        expect(typeof stats.categories.plugins).toBe("number");
        expect(typeof stats.categories.templates).toBe("number");
        expect(typeof stats.categories.workflows).toBe("number");

        // At minimum, builtin skills are in the "skills" category
        expect(stats.categories.skills).toBeGreaterThanOrEqual(10);
      });

      test("totalItems equals sum of all categories", () => {
        // Act
        const stats = sentinelHub.getStats();

        // Assert
        const sum =
          stats.categories.skills +
          stats.categories.plugins +
          stats.categories.templates +
          stats.categories.workflows;
        expect(stats.totalItems).toBe(sum);
      });

      test("totalDownloads reflects installs", () => {
        // Act
        const stats = sentinelHub.getStats();

        // Assert — we did at least 2 installs earlier
        expect(typeof stats.totalDownloads).toBe("number");
        expect(stats.totalDownloads).toBeGreaterThanOrEqual(2);
      });
    });
  });
});
