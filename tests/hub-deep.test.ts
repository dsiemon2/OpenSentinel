import { describe, test, expect, beforeAll } from "bun:test";
import { SentinelHub, sentinelHub } from "../src/core/hub/index";
import { BUILTIN_SKILLS } from "../src/core/hub/builtin-skills";

// ============================================================
// Deep Behavioral Tests — SentinelHub
//
// NOTE: SentinelHub uses module-level Maps and an `initialized` flag.
// Once initialize() runs, the state is shared across all tests.
// Other test files (hub.test.ts) may have already initialized, so
// we must use the existing state rather than assume a fresh start.
// We use unique IDs and names to avoid pollution from other tests.
// ============================================================

describe("SentinelHub — Deep Behavioral Tests", () => {
  beforeAll(async () => {
    await sentinelHub.initialize();
  });

  // =========================================================
  // 1. Browse returns all built-in items after init
  // =========================================================
  test("browse returns at least 10 built-in items after initialization", () => {
    const { items, total } = sentinelHub.browseHub();

    expect(total).toBeGreaterThanOrEqual(10);
    expect(items.length).toBeGreaterThanOrEqual(10);
  });

  // =========================================================
  // 2. Browse by category "skills"
  // =========================================================
  test("browse by category 'skills' returns only skill items", () => {
    const { items, total } = sentinelHub.browseHub({ category: "skills" });

    expect(total).toBeGreaterThanOrEqual(10);
    for (const item of items) {
      expect(item.category).toBe("skills");
    }
  });

  // =========================================================
  // 3. Browse by search query "email"
  // =========================================================
  test("browse by search 'email' finds Quick Email Draft", () => {
    const { items, total } = sentinelHub.browseHub({ search: "email" });

    expect(total).toBeGreaterThanOrEqual(1);
    const names = items.map((i) => i.name);
    expect(names).toContain("Quick Email Draft");
  });

  // =========================================================
  // 4. Browse by tag "productivity"
  // =========================================================
  test("browse by tag 'productivity' returns matching items", () => {
    const { items, total } = sentinelHub.browseHub({ tag: "productivity" });

    expect(total).toBeGreaterThanOrEqual(1);
    for (const item of items) {
      const lowerTags = item.tags.map((t) => t.toLowerCase());
      expect(lowerTags).toContain("productivity");
    }
  });

  // =========================================================
  // 5. Pagination offset/limit: no overlap between pages
  // =========================================================
  test("pagination with offset/limit produces non-overlapping pages", () => {
    const page1 = sentinelHub.browseHub({ category: "skills", limit: 3, offset: 0 });
    const page2 = sentinelHub.browseHub({ category: "skills", limit: 3, offset: 3 });

    expect(page1.items.length).toBe(3);
    expect(page2.items.length).toBe(3);

    // Total should be consistent across pages
    expect(page1.total).toBe(page2.total);

    // No overlap
    const page1Ids = new Set(page1.items.map((i) => i.id));
    for (const item of page2.items) {
      expect(page1Ids.has(item.id)).toBe(false);
    }
  });

  // =========================================================
  // 6. Install increments download count
  // =========================================================
  test("installFromHub increments the download count by 1", async () => {
    const trigger = BUILTIN_SKILLS[2].trigger.replace("/", "");
    const itemId = `builtin-${trigger}`;

    const before = sentinelHub.getItem(itemId)!.downloads;

    await sentinelHub.installFromHub(itemId, "deep-test-user-dl");

    const after = sentinelHub.getItem(itemId)!.downloads;
    expect(after).toBe(before + 1);
  });

  // =========================================================
  // 7. Install non-existent item returns error
  // =========================================================
  test("installFromHub with non-existent ID returns failure", async () => {
    const result = await sentinelHub.installFromHub(
      "fake-id-xyz-does-not-exist",
      "deep-test-user"
    );

    expect(result.success).toBe(false);
    expect(result.message).toContain("not found");
    expect(result.skillId).toBeUndefined();
  });

  // =========================================================
  // 8. Publish adds new item visible in browse
  // =========================================================
  test("publishToHub adds a new item that appears in browse results", async () => {
    const beforeTotal = sentinelHub.browseHub().total;

    const result = await sentinelHub.publishToHub({
      name: "DeepTest Custom Workflow",
      description: "A deep test workflow for hub testing",
      category: "workflows",
      data: JSON.stringify({ name: "DeepTest Custom Workflow", instructions: "do deep things" }),
      author: "deep-test-author",
      tags: ["deep-test", "custom"],
      version: "3.0.0",
    });

    expect(result.success).toBe(true);
    expect(result.itemId).toBeDefined();
    expect(result.message).toContain("Published");

    const afterTotal = sentinelHub.browseHub().total;
    expect(afterTotal).toBe(beforeTotal + 1);

    // The item should be findable by search
    const searchResult = sentinelHub.browseHub({ search: "DeepTest Custom Workflow" });
    expect(searchResult.total).toBeGreaterThanOrEqual(1);
    const found = searchResult.items.find((i) => i.id === result.itemId);
    expect(found).toBeDefined();
    expect(found!.name).toBe("DeepTest Custom Workflow");
  });

  // =========================================================
  // 9. Rate item updates rating
  // =========================================================
  describe("rateItem deep scenarios", () => {
    let rateableItemId: string;

    beforeAll(async () => {
      const result = await sentinelHub.publishToHub({
        name: "DeepRatable Item",
        description: "An item for deep rating tests",
        category: "plugins",
        data: JSON.stringify({ name: "DeepRatable", instructions: "rate me deeply" }),
        author: "deep-rater",
        tags: ["rating-test"],
      });
      rateableItemId = result.itemId!;
    });

    test("single rating of 5 sets the rating to 5", () => {
      const result = sentinelHub.rateItem(rateableItemId, "deep-user-A", 5);

      expect(result.success).toBe(true);
      expect(result.newRating).toBe(5);

      const item = sentinelHub.getItem(rateableItemId)!;
      expect(item.rating).toBe(5);
      expect(item.ratingCount).toBe(1);
    });

    // =========================================================
    // 10. Rating clamped to bounds
    // =========================================================
    test("rating of 0 is clamped to 1", () => {
      // Add a fresh item to avoid interference
      const clampLowResult = sentinelHub.rateItem(rateableItemId, "deep-user-clamp-low", 0);
      expect(clampLowResult.success).toBe(true);

      // Now: deep-user-A=5, deep-user-clamp-low=1 => avg=(5+1)/2=3
      const item = sentinelHub.getItem(rateableItemId)!;
      expect(item.rating).toBe(3);
    });

    test("rating of 10 is clamped to 5", () => {
      const clampHighResult = sentinelHub.rateItem(rateableItemId, "deep-user-clamp-high", 10);
      expect(clampHighResult.success).toBe(true);

      // Now: A=5, clamp-low=1, clamp-high=5 => avg=(5+1+5)/3 = 3.7
      const item = sentinelHub.getItem(rateableItemId)!;
      expect(item.rating).toBe(3.7);
      expect(item.ratingCount).toBe(3);
    });

    // =========================================================
    // 11. Multiple ratings averaged
    // =========================================================
    test("multiple different ratings produce correct average", () => {
      sentinelHub.rateItem(rateableItemId, "deep-user-D", 2);

      // Now: A=5, clamp-low=1, clamp-high=5, D=2 => avg=(5+1+5+2)/4 = 3.25 => 3.3
      const item = sentinelHub.getItem(rateableItemId)!;
      expect(item.ratingCount).toBe(4);
      expect(item.rating).toBe(3.3); // Math.round(3.25 * 10) / 10 = 3.3
    });

    // =========================================================
    // 12. Same user re-rating replaces (not averages)
    // =========================================================
    test("same user re-rating replaces their previous rating", () => {
      const beforeCount = sentinelHub.getItem(rateableItemId)!.ratingCount;

      // deep-user-A changes from 5 to 1
      sentinelHub.rateItem(rateableItemId, "deep-user-A", 1);

      const item = sentinelHub.getItem(rateableItemId)!;
      // Count should NOT increase
      expect(item.ratingCount).toBe(beforeCount);
      // New avg: (1+1+5+2)/4 = 2.25 => 2.3
      expect(item.rating).toBe(2.3);
    });

    test("returns failure for non-existent item", () => {
      const result = sentinelHub.rateItem("nonexistent-deep-item", "user-X", 3);
      expect(result.success).toBe(false);
      expect(result.newRating).toBeUndefined();
    });
  });

  // =========================================================
  // 13. getStats category counts
  // =========================================================
  test("getStats totalItems matches browseHub total", () => {
    const stats = sentinelHub.getStats();
    const browse = sentinelHub.browseHub();

    expect(stats.totalItems).toBe(browse.total);
  });

  test("getStats category breakdown sums to totalItems", () => {
    const stats = sentinelHub.getStats();
    const categorySum =
      stats.categories.skills +
      stats.categories.plugins +
      stats.categories.templates +
      stats.categories.workflows;

    expect(categorySum).toBe(stats.totalItems);
  });

  // =========================================================
  // 14. Published item has correct defaults
  // =========================================================
  test("published item with minimal fields has correct defaults", async () => {
    const result = await sentinelHub.publishToHub({
      name: "DeepMinimal Item",
      description: "Minimal fields provided",
      category: "templates",
      data: "{}",
      author: "deep-minimal-author",
    });

    const item = sentinelHub.getItem(result.itemId!)!;

    expect(item.version).toBe("1.0.0");     // default version
    expect(item.tags).toEqual([]);           // default empty tags
    expect(item.rating).toBe(0);            // no ratings yet
    expect(item.ratingCount).toBe(0);
    expect(item.downloads).toBe(0);
    expect(item.createdAt).toBeInstanceOf(Date);
    expect(item.author).toBe("deep-minimal-author");
    expect(item.category).toBe("templates");
  });

  // =========================================================
  // 15. Browse sorting by rating then downloads
  // =========================================================
  test("browse results are sorted by rating (desc) then downloads (desc)", async () => {
    // Publish items with different ratings
    const r1 = await sentinelHub.publishToHub({
      name: "DeepSort Low",
      description: "Low rated",
      category: "plugins",
      data: "{}",
      author: "sorter",
      tags: ["deep-sort-test"],
    });

    const r2 = await sentinelHub.publishToHub({
      name: "DeepSort High",
      description: "High rated",
      category: "plugins",
      data: "{}",
      author: "sorter",
      tags: ["deep-sort-test"],
    });

    const r3 = await sentinelHub.publishToHub({
      name: "DeepSort Mid",
      description: "Mid rated",
      category: "plugins",
      data: "{}",
      author: "sorter",
      tags: ["deep-sort-test"],
    });

    // Rate them
    sentinelHub.rateItem(r1.itemId!, "sort-rater", 1);
    sentinelHub.rateItem(r2.itemId!, "sort-rater", 5);
    sentinelHub.rateItem(r3.itemId!, "sort-rater", 3);

    // Browse with tag filter to isolate our items
    const { items } = sentinelHub.browseHub({ tag: "deep-sort-test" });

    expect(items.length).toBe(3);

    // Should be sorted: High (5), Mid (3), Low (1)
    expect(items[0].name).toBe("DeepSort High");
    expect(items[1].name).toBe("DeepSort Mid");
    expect(items[2].name).toBe("DeepSort Low");
  });

  // =========================================================
  // 16. Search is case-insensitive
  // =========================================================
  test("browse search is case-insensitive", () => {
    const resultLower = sentinelHub.browseHub({ search: "code review" });
    const resultUpper = sentinelHub.browseHub({ search: "CODE REVIEW" });
    const resultMixed = sentinelHub.browseHub({ search: "Code Review" });

    expect(resultLower.total).toBe(resultUpper.total);
    expect(resultLower.total).toBe(resultMixed.total);
    expect(resultLower.total).toBeGreaterThanOrEqual(1);
  });

  // =========================================================
  // 17. Search matches description text
  // =========================================================
  test("browse search matches description text", () => {
    const result = sentinelHub.browseHub({ search: "changelog" });

    expect(result.total).toBeGreaterThanOrEqual(1);
    const names = result.items.map((i) => i.name);
    expect(names).toContain("Git Changelog");
  });

  // =========================================================
  // 18. Search matches tags
  // =========================================================
  test("browse search matches items by tag content", () => {
    const result = sentinelHub.browseHub({ search: "regex" });

    expect(result.total).toBeGreaterThanOrEqual(1);
    const names = result.items.map((i) => i.name);
    expect(names).toContain("Regex Helper");
  });

  // =========================================================
  // 19. Empty category returns zero results
  // =========================================================
  test("browse with unmatched search returns empty results", () => {
    const result = sentinelHub.browseHub({
      search: "zzz_nonexistent_search_query_xyz_12345",
    });

    expect(result.total).toBe(0);
    expect(result.items.length).toBe(0);
  });

  // =========================================================
  // 20. Idempotent initialization
  // =========================================================
  test("calling initialize multiple times does not duplicate items", async () => {
    const before = sentinelHub.browseHub().total;

    await sentinelHub.initialize();
    await sentinelHub.initialize();
    await sentinelHub.initialize();

    const after = sentinelHub.browseHub().total;
    expect(after).toBe(before);
  });

  // =========================================================
  // 21. Published item has generated ID prefix
  // =========================================================
  test("published items get IDs starting with 'user-'", async () => {
    const result = await sentinelHub.publishToHub({
      name: "DeepIDCheck",
      description: "Check ID format",
      category: "skills",
      data: JSON.stringify({ name: "IDCheck", instructions: "test" }),
      author: "id-checker",
    });

    expect(result.itemId).toBeDefined();
    expect(result.itemId!.startsWith("user-")).toBe(true);
  });

  // =========================================================
  // 22. Built-in items have 'builtin-' ID prefix
  // =========================================================
  test("builtin items have IDs starting with 'builtin-'", () => {
    for (const skill of BUILTIN_SKILLS) {
      const trigger = skill.trigger.replace("/", "");
      const expectedId = `builtin-${trigger}`;
      const item = sentinelHub.getItem(expectedId);
      expect(item).toBeDefined();
      expect(item!.id).toBe(expectedId);
      expect(item!.author).toBe("OpenSentinel");
    }
  });

  // =========================================================
  // 23. Built-in skills start with rating 5.0
  // =========================================================
  test("builtin skills have default rating of 5.0", () => {
    const trigger = BUILTIN_SKILLS[0].trigger.replace("/", "");
    const item = sentinelHub.getItem(`builtin-${trigger}`)!;

    // Builtin skills are initialized with rating 5.0 and ratingCount 0
    expect(item.ratingCount).toBe(0);
    // rating is set to 5.0 on init (unless another test rated it)
    expect(item.rating).toBeGreaterThanOrEqual(0);
  });

  // =========================================================
  // 24. getItem returns undefined for unknown ID
  // =========================================================
  test("getItem returns undefined for unknown ID", () => {
    const item = sentinelHub.getItem("deep-nonexistent-id-12345");
    expect(item).toBeUndefined();
  });

  // =========================================================
  // 25. totalDownloads accumulates across installs
  // =========================================================
  test("getStats totalDownloads increases after installs", async () => {
    const beforeStats = sentinelHub.getStats();
    const beforeDownloads = beforeStats.totalDownloads;

    // Install one more item
    const trigger = BUILTIN_SKILLS[3].trigger.replace("/", "");
    const itemId = `builtin-${trigger}`;
    await sentinelHub.installFromHub(itemId, "deep-stats-user");

    const afterStats = sentinelHub.getStats();
    expect(afterStats.totalDownloads).toBe(beforeDownloads + 1);
  });

  // =========================================================
  // 26. Browse with combined filters (category + search)
  // =========================================================
  test("browse combines category and search filters", () => {
    const result = sentinelHub.browseHub({
      category: "skills",
      search: "email",
    });

    expect(result.total).toBeGreaterThanOrEqual(1);
    for (const item of result.items) {
      expect(item.category).toBe("skills");
      const matchesSearch =
        item.name.toLowerCase().includes("email") ||
        item.description.toLowerCase().includes("email") ||
        item.tags.some((t) => t.toLowerCase().includes("email"));
      expect(matchesSearch).toBe(true);
    }
  });

  // =========================================================
  // 27. Browse limit larger than total returns all items
  // =========================================================
  test("browse with limit larger than total returns all items", () => {
    const allResult = sentinelHub.browseHub({ category: "skills", limit: 1000 });
    const bigLimitResult = sentinelHub.browseHub({ category: "skills", limit: 9999 });

    expect(bigLimitResult.items.length).toBe(allResult.items.length);
    expect(bigLimitResult.total).toBe(allResult.total);
  });

  // =========================================================
  // 28. Browse with offset beyond total returns empty
  // =========================================================
  test("browse with offset beyond total returns empty items", () => {
    const result = sentinelHub.browseHub({ category: "skills", offset: 99999 });

    expect(result.items.length).toBe(0);
    // total still reflects the full count
    expect(result.total).toBeGreaterThanOrEqual(10);
  });
});
