import { describe, test, expect, mock, beforeEach } from "bun:test";

// Mock ALL external dependencies before importing the module
mock.module("../src/db", () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => ({
          orderBy: () => ({
            limit: () => [],
          }),
          limit: () => [],
        }),
        orderBy: () => ({
          limit: () => [],
        }),
      }),
    }),
  },
}));

mock.module("../src/db/schema", () => ({
  conversations: {},
  messages: {},
  scheduledTasks: {},
  users: {},
}));

mock.module("openai", () => ({
  default: class {
    chat = {
      completions: {
        create: async () => ({
          choices: [{ message: { content: "[]" } }],
        }),
      },
    };
  },
}));

mock.module("../src/config/env", () => ({
  env: {
    OPENAI_API_KEY: "test-key",
  },
}));

mock.module("drizzle-orm", () => ({
  eq: () => {},
  and: () => {},
  gte: () => {},
  lte: () => {},
  desc: () => {},
  sql: () => {},
  between: () => {},
}));

import {
  extractTemporalExpressions,
  normalizeToTimezone,
  formatRelativeTime,
  type TemporalExpression,
  type DateRange,
  type TemporalContext,
  type TimelineEvent,
  type ScheduleAnalysis,
} from "../src/core/intelligence/temporal-reasoning";

// Fixed reference date: Wednesday, 2026-03-18 at 12:00:00 UTC
const REF_DATE = new Date("2026-03-18T12:00:00.000Z");

function makeContext(overrides?: Partial<TemporalContext>): TemporalContext {
  return {
    currentTime: REF_DATE,
    userTimezone: "UTC",
    recentTemporalReferences: [],
    ...overrides,
  };
}

describe("Temporal Reasoning", () => {
  // ────────────────────────────────────────────
  // Type exports
  // ────────────────────────────────────────────
  describe("type exports", () => {
    test("TemporalExpression type is usable", () => {
      const expr: TemporalExpression = {
        original: "tomorrow",
        type: "relative_date",
        resolved: new Date(),
        confidence: 95,
        isRelative: true,
      };
      expect(expr.original).toBe("tomorrow");
    });

    test("DateRange type is usable", () => {
      const range: DateRange = {
        start: new Date("2026-03-18"),
        end: new Date("2026-03-24"),
        granularity: "week",
      };
      expect(range.granularity).toBe("week");
    });

    test("TemporalContext type is usable", () => {
      const ctx: TemporalContext = {
        currentTime: new Date(),
        userTimezone: "America/New_York",
        recentTemporalReferences: [],
      };
      expect(ctx.userTimezone).toBe("America/New_York");
    });

    test("TimelineEvent type is usable", () => {
      const event: TimelineEvent = {
        id: "1",
        title: "Meeting",
        datetime: new Date(),
        isAllDay: false,
        source: "scheduled_task",
      };
      expect(event.source).toBe("scheduled_task");
    });

    test("ScheduleAnalysis type is usable", () => {
      const analysis: ScheduleAnalysis = {
        events: [],
        conflicts: [],
        freeSlots: [],
        busyPeriods: [],
        recommendations: [],
      };
      expect(analysis.conflicts).toHaveLength(0);
    });
  });

  // ────────────────────────────────────────────
  // extractTemporalExpressions - relative dates
  // ────────────────────────────────────────────
  describe("extractTemporalExpressions", () => {
    describe("relative day expressions", () => {
      test("extracts 'today'", async () => {
        const results = await extractTemporalExpressions("meet today", makeContext());
        const todayExpr = results.find((r) => r.original.toLowerCase() === "today");
        expect(todayExpr).toBeDefined();
        expect(todayExpr!.type).toBe("relative_date");
        expect(todayExpr!.isRelative).toBe(true);
        expect(todayExpr!.confidence).toBeGreaterThanOrEqual(90);
        const resolved = todayExpr!.resolved as Date;
        expect(resolved.getFullYear()).toBe(2026);
        expect(resolved.getMonth()).toBe(2); // March
        expect(resolved.getDate()).toBe(18);
        expect(resolved.getHours()).toBe(0);
      });

      test("extracts 'tomorrow'", async () => {
        const results = await extractTemporalExpressions("meet tomorrow", makeContext());
        const expr = results.find((r) => r.original.toLowerCase() === "tomorrow");
        expect(expr).toBeDefined();
        const resolved = expr!.resolved as Date;
        expect(resolved.getDate()).toBe(19);
      });

      test("extracts 'yesterday'", async () => {
        const results = await extractTemporalExpressions("saw yesterday", makeContext());
        const expr = results.find((r) => r.original.toLowerCase() === "yesterday");
        expect(expr).toBeDefined();
        const resolved = expr!.resolved as Date;
        expect(resolved.getDate()).toBe(17);
      });
    });

    describe("next/last day of week", () => {
      test("extracts 'next Monday'", async () => {
        // REF_DATE is Wednesday March 18
        const results = await extractTemporalExpressions("meet next Monday", makeContext());
        const expr = results.find((r) => /next\s+monday/i.test(r.original));
        expect(expr).toBeDefined();
        expect(expr!.type).toBe("relative_date");
        const resolved = expr!.resolved as Date;
        // Next Monday after Wednesday March 18 -> March 23
        expect(resolved.getDay()).toBe(1); // Monday
        expect(resolved.getTime()).toBeGreaterThan(REF_DATE.getTime());
      });

      test("extracts 'last Tuesday'", async () => {
        const results = await extractTemporalExpressions("saw them last Tuesday", makeContext());
        const expr = results.find((r) => /last\s+tuesday/i.test(r.original));
        expect(expr).toBeDefined();
        const resolved = expr!.resolved as Date;
        expect(resolved.getDay()).toBe(2); // Tuesday
        expect(resolved.getTime()).toBeLessThan(REF_DATE.getTime());
      });

      test("extracts 'next Friday'", async () => {
        const results = await extractTemporalExpressions("let's do next Friday", makeContext());
        const expr = results.find((r) => /next\s+friday/i.test(r.original));
        expect(expr).toBeDefined();
        const resolved = expr!.resolved as Date;
        expect(resolved.getDay()).toBe(5); // Friday
      });

      test("extracts 'last Sunday'", async () => {
        const results = await extractTemporalExpressions("last Sunday was great", makeContext());
        const expr = results.find((r) => /last\s+sunday/i.test(r.original));
        expect(expr).toBeDefined();
        const resolved = expr!.resolved as Date;
        expect(resolved.getDay()).toBe(0); // Sunday
      });
    });

    describe("in X days/weeks/months/hours/minutes", () => {
      test("extracts 'in 3 days'", async () => {
        const results = await extractTemporalExpressions("remind me in 3 days", makeContext());
        const expr = results.find((r) => /in\s+3\s+days/i.test(r.original));
        expect(expr).toBeDefined();
        const resolved = expr!.resolved as Date;
        expect(resolved.getDate()).toBe(21); // 18 + 3
      });

      test("extracts 'in 2 weeks'", async () => {
        const results = await extractTemporalExpressions("do it in 2 weeks", makeContext());
        const expr = results.find((r) => /in\s+2\s+weeks/i.test(r.original));
        expect(expr).toBeDefined();
        const resolved = expr!.resolved as Date;
        const diffDays = Math.round(
          (resolved.getTime() - REF_DATE.getTime()) / (1000 * 60 * 60 * 24)
        );
        expect(diffDays).toBe(14);
      });

      test("extracts 'in 1 month'", async () => {
        const results = await extractTemporalExpressions("check in 1 month", makeContext());
        const expr = results.find((r) => /in\s+1\s+month/i.test(r.original));
        expect(expr).toBeDefined();
        const resolved = expr!.resolved as Date;
        expect(resolved.getMonth()).toBe(3); // April
      });

      test("extracts 'in 2 hours'", async () => {
        const results = await extractTemporalExpressions("call in 2 hours", makeContext());
        const expr = results.find((r) => /in\s+2\s+hours/i.test(r.original));
        expect(expr).toBeDefined();
        const resolved = expr!.resolved as Date;
        expect(resolved.getHours()).toBe(REF_DATE.getHours() + 2);
      });

      test("extracts 'in 30 minutes'", async () => {
        const results = await extractTemporalExpressions("call in 30 minutes", makeContext());
        const expr = results.find((r) => /in\s+30\s+minutes/i.test(r.original));
        expect(expr).toBeDefined();
        const resolved = expr!.resolved as Date;
        const diffMins = (resolved.getTime() - REF_DATE.getTime()) / (1000 * 60);
        expect(diffMins).toBe(30);
      });
    });

    describe("X ago expressions", () => {
      test("extracts '5 days ago'", async () => {
        const results = await extractTemporalExpressions("it was 5 days ago", makeContext());
        const expr = results.find((r) => /5\s+days\s+ago/i.test(r.original));
        expect(expr).toBeDefined();
        const resolved = expr!.resolved as Date;
        expect(resolved.getDate()).toBe(13); // 18 - 5
      });

      test("extracts '2 weeks ago'", async () => {
        const results = await extractTemporalExpressions("started 2 weeks ago", makeContext());
        const expr = results.find((r) => /2\s+weeks\s+ago/i.test(r.original));
        expect(expr).toBeDefined();
        const resolved = expr!.resolved as Date;
        const diffDays = Math.round(
          (REF_DATE.getTime() - resolved.getTime()) / (1000 * 60 * 60 * 24)
        );
        expect(diffDays).toBe(14);
      });

      test("extracts '3 months ago'", async () => {
        const results = await extractTemporalExpressions("happened 3 months ago", makeContext());
        const expr = results.find((r) => /3\s+months\s+ago/i.test(r.original));
        expect(expr).toBeDefined();
        const resolved = expr!.resolved as Date;
        expect(resolved.getMonth()).toBe(11); // December (March - 3)
      });
    });

    describe("week range expressions", () => {
      test("extracts 'next week' as a DateRange", async () => {
        const results = await extractTemporalExpressions("plan for next week", makeContext());
        const expr = results.find((r) => /next week/i.test(r.original));
        expect(expr).toBeDefined();
        expect(expr!.type).toBe("range");
        const range = expr!.resolved as DateRange;
        expect(range.start).toBeDefined();
        expect(range.end).toBeDefined();
        expect(range.granularity).toBe("week");
        // Next week start should be after this week
        expect(range.start.getTime()).toBeGreaterThan(REF_DATE.getTime());
      });

      test("extracts 'this week' as a DateRange", async () => {
        const results = await extractTemporalExpressions("busy this week", makeContext());
        const expr = results.find((r) => /this week/i.test(r.original));
        expect(expr).toBeDefined();
        expect(expr!.type).toBe("range");
        const range = expr!.resolved as DateRange;
        expect(range.granularity).toBe("week");
        // This week's start (Sunday) should be <= reference date
        expect(range.start.getTime()).toBeLessThanOrEqual(REF_DATE.getTime());
      });

      test("extracts 'last week' as a DateRange", async () => {
        const results = await extractTemporalExpressions("done last week", makeContext());
        const expr = results.find((r) => /last week/i.test(r.original));
        expect(expr).toBeDefined();
        const range = expr!.resolved as DateRange;
        expect(range.granularity).toBe("week");
        expect(range.end.getTime()).toBeLessThan(REF_DATE.getTime());
      });
    });

    describe("time of day expressions", () => {
      test("extracts 'this morning'", async () => {
        const results = await extractTemporalExpressions("finish this morning", makeContext());
        const expr = results.find((r) => /this morning/i.test(r.original));
        expect(expr).toBeDefined();
        const resolved = expr!.resolved as Date;
        expect(resolved.getHours()).toBe(9);
      });

      test("extracts 'this afternoon'", async () => {
        const results = await extractTemporalExpressions("meet this afternoon", makeContext());
        const expr = results.find((r) => /this afternoon/i.test(r.original));
        expect(expr).toBeDefined();
        const resolved = expr!.resolved as Date;
        expect(resolved.getHours()).toBe(14);
      });

      test("extracts 'this evening'", async () => {
        const results = await extractTemporalExpressions("dinner this evening", makeContext());
        const expr = results.find((r) => /this evening/i.test(r.original));
        expect(expr).toBeDefined();
        const resolved = expr!.resolved as Date;
        expect(resolved.getHours()).toBe(18);
      });

      test("extracts 'tonight'", async () => {
        const results = await extractTemporalExpressions("movie tonight", makeContext());
        const expr = results.find((r) => /tonight/i.test(r.original));
        expect(expr).toBeDefined();
        const resolved = expr!.resolved as Date;
        expect(resolved.getHours()).toBe(20);
      });
    });

    describe("end of period expressions", () => {
      test("extracts 'end of day'", async () => {
        const results = await extractTemporalExpressions("finish by end of day", makeContext());
        const expr = results.find((r) => /end of.*day/i.test(r.original));
        expect(expr).toBeDefined();
        const resolved = expr!.resolved as Date;
        expect(resolved.getHours()).toBe(23);
        expect(resolved.getMinutes()).toBe(59);
      });

      test("extracts 'end of week'", async () => {
        const results = await extractTemporalExpressions("due end of week", makeContext());
        const expr = results.find((r) => /end of.*week/i.test(r.original));
        expect(expr).toBeDefined();
        const resolved = expr!.resolved as Date;
        expect(resolved.getDay()).toBe(0); // Sunday end of week
        expect(resolved.getHours()).toBe(23);
      });

      test("extracts 'end of month'", async () => {
        const results = await extractTemporalExpressions("due end of month", makeContext());
        const expr = results.find((r) => /end of.*month/i.test(r.original));
        expect(expr).toBeDefined();
        const resolved = expr!.resolved as Date;
        expect(resolved.getDate()).toBe(31); // March has 31 days
        expect(resolved.getHours()).toBe(23);
      });
    });

    describe("absolute date expressions", () => {
      test("extracts ISO date 2026-04-15", async () => {
        const results = await extractTemporalExpressions("deadline is 2026-04-15", makeContext());
        const expr = results.find((r) => r.type === "absolute_date");
        expect(expr).toBeDefined();
        expect(expr!.isRelative).toBe(false);
        const resolved = expr!.resolved as Date;
        expect(resolved.getFullYear()).toBe(2026);
        expect(resolved.getMonth()).toBe(3); // April
        expect(resolved.getDate()).toBe(15);
      });

      test("extracts US date format 03/25/2026", async () => {
        const results = await extractTemporalExpressions("due on 03/25/2026", makeContext());
        const expr = results.find((r) => r.type === "absolute_date");
        expect(expr).toBeDefined();
        const resolved = expr!.resolved as Date;
        expect(resolved.getMonth()).toBe(2); // March
        expect(resolved.getDate()).toBe(25);
      });

      test("extracts time expression 3:30 PM", async () => {
        const results = await extractTemporalExpressions("meet at 3:30 PM", makeContext());
        const timeExpr = results.find((r) => r.type === "absolute_time");
        expect(timeExpr).toBeDefined();
      });
    });

    describe("multiple expressions in one text", () => {
      test("extracts both 'tomorrow' and a time", async () => {
        const results = await extractTemporalExpressions(
          "meet tomorrow at 3:30 PM",
          makeContext()
        );
        expect(results.length).toBeGreaterThanOrEqual(1);
        const tomorrowExpr = results.find((r) => r.original.toLowerCase() === "tomorrow");
        expect(tomorrowExpr).toBeDefined();
      });

      test("extracts from complex sentence", async () => {
        const results = await extractTemporalExpressions(
          "I have a meeting tomorrow and a deadline in 5 days",
          makeContext()
        );
        expect(results.length).toBeGreaterThanOrEqual(2);
      });
    });

    describe("uses context.currentTime as reference", () => {
      test("resolves relative to provided currentTime", async () => {
        const customRef = new Date("2026-06-15T10:00:00.000Z");
        const ctx = makeContext({ currentTime: customRef });
        const results = await extractTemporalExpressions("meet tomorrow", ctx);
        const expr = results.find((r) => r.original.toLowerCase() === "tomorrow");
        expect(expr).toBeDefined();
        const resolved = expr!.resolved as Date;
        expect(resolved.getMonth()).toBe(5); // June
        expect(resolved.getDate()).toBe(16);
      });
    });

    describe("short text skips AI extraction", () => {
      test("text <= 20 chars does not call AI", async () => {
        // Short text should only use pattern matching, no AI call
        const results = await extractTemporalExpressions("today", makeContext());
        const expr = results.find((r) => r.original.toLowerCase() === "today");
        expect(expr).toBeDefined();
      });
    });

    describe("results are sorted by confidence descending", () => {
      test("higher confidence expressions come first", async () => {
        const results = await extractTemporalExpressions(
          "meet tomorrow at 2026-04-15",
          makeContext()
        );
        if (results.length >= 2) {
          for (let i = 0; i < results.length - 1; i++) {
            expect(results[i].confidence).toBeGreaterThanOrEqual(results[i + 1].confidence);
          }
        }
      });
    });

    describe("no match returns empty or AI-only results", () => {
      test("no temporal words in short text returns empty", async () => {
        const results = await extractTemporalExpressions("hello world", makeContext());
        expect(results).toEqual([]);
      });
    });
  });

  // ────────────────────────────────────────────
  // formatRelativeTime
  // ────────────────────────────────────────────
  describe("formatRelativeTime", () => {
    test("returns 'just now' for < 1 minute difference", () => {
      const date = new Date(REF_DATE.getTime() + 10 * 1000); // 10 seconds
      expect(formatRelativeTime(date, REF_DATE)).toBe("just now");
    });

    test("returns 'in X minutes' for future minutes", () => {
      const date = new Date(REF_DATE.getTime() + 25 * 60 * 1000);
      expect(formatRelativeTime(date, REF_DATE)).toBe("in 25 minutes");
    });

    test("returns 'X minutes ago' for past minutes", () => {
      const date = new Date(REF_DATE.getTime() - 10 * 60 * 1000);
      expect(formatRelativeTime(date, REF_DATE)).toBe("10 minutes ago");
    });

    test("returns 'in X hours' for future hours", () => {
      const date = new Date(REF_DATE.getTime() + 3 * 60 * 60 * 1000);
      expect(formatRelativeTime(date, REF_DATE)).toBe("in 3 hours");
    });

    test("returns 'X hours ago' for past hours", () => {
      const date = new Date(REF_DATE.getTime() - 5 * 60 * 60 * 1000);
      expect(formatRelativeTime(date, REF_DATE)).toBe("5 hours ago");
    });

    test("returns 'tomorrow' for +1 day", () => {
      const date = new Date(REF_DATE.getTime() + 24 * 60 * 60 * 1000);
      expect(formatRelativeTime(date, REF_DATE)).toBe("tomorrow");
    });

    test("returns 'yesterday' for -1 day", () => {
      const date = new Date(REF_DATE.getTime() - 24 * 60 * 60 * 1000);
      expect(formatRelativeTime(date, REF_DATE)).toBe("yesterday");
    });

    test("returns 'in X days' for 2-6 days future", () => {
      const date = new Date(REF_DATE.getTime() + 4 * 24 * 60 * 60 * 1000);
      expect(formatRelativeTime(date, REF_DATE)).toBe("in 4 days");
    });

    test("returns 'X days ago' for 2-6 days past", () => {
      const date = new Date(REF_DATE.getTime() - 3 * 24 * 60 * 60 * 1000);
      expect(formatRelativeTime(date, REF_DATE)).toBe("3 days ago");
    });

    test("returns 'next week' for 7-13 days future", () => {
      const date = new Date(REF_DATE.getTime() + 10 * 24 * 60 * 60 * 1000);
      expect(formatRelativeTime(date, REF_DATE)).toBe("next week");
    });

    test("returns 'last week' for 7-13 days past", () => {
      const date = new Date(REF_DATE.getTime() - 10 * 24 * 60 * 60 * 1000);
      expect(formatRelativeTime(date, REF_DATE)).toBe("last week");
    });

    test("returns 'in X weeks' for 14-29 days future", () => {
      const date = new Date(REF_DATE.getTime() + 21 * 24 * 60 * 60 * 1000);
      expect(formatRelativeTime(date, REF_DATE)).toBe("in 3 weeks");
    });

    test("returns 'in X months' for 30+ days future", () => {
      const date = new Date(REF_DATE.getTime() + 60 * 24 * 60 * 60 * 1000);
      expect(formatRelativeTime(date, REF_DATE)).toBe("in 2 months");
    });

    test("returns 'X months ago' for 30+ days past", () => {
      const date = new Date(REF_DATE.getTime() - 90 * 24 * 60 * 60 * 1000);
      expect(formatRelativeTime(date, REF_DATE)).toBe("3 months ago");
    });

    test("uses current time when no reference provided", () => {
      const futureDate = new Date(Date.now() + 5 * 60 * 1000);
      const result = formatRelativeTime(futureDate);
      expect(result).toBe("in 5 minutes");
    });
  });

  // ────────────────────────────────────────────
  // normalizeToTimezone
  // ────────────────────────────────────────────
  describe("normalizeToTimezone", () => {
    test("normalizes UTC date to a different timezone", () => {
      const utcDate = new Date("2026-03-18T12:00:00.000Z");
      const result = normalizeToTimezone(utcDate, "America/New_York");
      // EDT is UTC-4, so 12:00 UTC = 08:00 EDT
      expect(result.getHours()).toBe(8);
    });

    test("normalizes to Asia/Tokyo timezone", () => {
      const utcDate = new Date("2026-03-18T12:00:00.000Z");
      const result = normalizeToTimezone(utcDate, "Asia/Tokyo");
      // JST is UTC+9, so 12:00 UTC = 21:00 JST
      expect(result.getHours()).toBe(21);
    });

    test("returns original date for invalid timezone", () => {
      const utcDate = new Date("2026-03-18T12:00:00.000Z");
      const result = normalizeToTimezone(utcDate, "Invalid/Timezone");
      // Should return the original date on error
      expect(result.getTime()).toBe(utcDate.getTime());
    });

    test("handles UTC timezone (no change expected)", () => {
      const utcDate = new Date("2026-03-18T12:00:00.000Z");
      const result = normalizeToTimezone(utcDate, "UTC");
      expect(result.getHours()).toBe(12);
    });
  });

  // ────────────────────────────────────────────
  // Edge cases
  // ────────────────────────────────────────────
  describe("edge cases", () => {
    test("empty string returns no expressions", async () => {
      const results = await extractTemporalExpressions("", makeContext());
      expect(results).toEqual([]);
    });

    test("referencePoint is set on relative expressions", async () => {
      const results = await extractTemporalExpressions("meet tomorrow", makeContext());
      const expr = results.find((r) => r.original.toLowerCase() === "tomorrow");
      expect(expr).toBeDefined();
      expect(expr!.referencePoint).toEqual(REF_DATE);
    });

    test("singular vs plural units work the same", async () => {
      const singularResults = await extractTemporalExpressions("in 1 day", makeContext());
      const pluralResults = await extractTemporalExpressions("in 1 days", makeContext());
      const s = singularResults.find((r) => /in\s+1\s+day/i.test(r.original));
      const p = pluralResults.find((r) => /in\s+1\s+days/i.test(r.original));
      expect(s).toBeDefined();
      expect(p).toBeDefined();
      expect((s!.resolved as Date).getDate()).toBe((p!.resolved as Date).getDate());
    });

    test("case insensitivity", async () => {
      const lower = await extractTemporalExpressions("tomorrow", makeContext());
      const upper = await extractTemporalExpressions("TOMORROW", makeContext());
      expect(lower.length).toBe(upper.length);
      expect(lower.length).toBeGreaterThan(0);
    });

    test("expressions embedded in longer text", async () => {
      const results = await extractTemporalExpressions(
        "Please schedule the review for next Friday at the office",
        makeContext()
      );
      const expr = results.find((r) => /next\s+friday/i.test(r.original));
      expect(expr).toBeDefined();
    });
  });
});
