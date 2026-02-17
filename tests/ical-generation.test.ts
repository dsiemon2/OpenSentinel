import { describe, test, expect } from "bun:test";
import { generateICal, quickEvent } from "../src/tools/file-generation/ical";
import { readFile, unlink } from "fs/promises";

describe("iCal Generation", () => {
  describe("module exports", () => {
    test("should export generateICal function", async () => {
      const ical = await import("../src/tools/file-generation/ical");
      expect(typeof ical.generateICal).toBe("function");
    });

    test("should export quickEvent function", async () => {
      const ical = await import("../src/tools/file-generation/ical");
      expect(typeof ical.quickEvent).toBe("function");
    });
  });

  describe("generateICal", () => {
    test("should generate valid ICS content with single event", async () => {
      const result = await generateICal([
        {
          title: "Team Meeting",
          start: "2026-03-15T10:00:00Z",
          end: "2026-03-15T11:00:00Z",
          description: "Weekly standup",
          location: "Conference Room A",
        },
      ]);

      expect(result.success).toBe(true);
      expect(result.eventCount).toBe(1);
      expect(result.filePath).toBeTruthy();
      expect(result.icsContent).toContain("BEGIN:VCALENDAR");
      expect(result.icsContent).toContain("END:VCALENDAR");
      expect(result.icsContent).toContain("BEGIN:VEVENT");
      expect(result.icsContent).toContain("SUMMARY:Team Meeting");
      expect(result.icsContent).toContain("DESCRIPTION:Weekly standup");
      expect(result.icsContent).toContain("LOCATION:Conference Room A");

      // Clean up
      if (result.filePath) await unlink(result.filePath).catch(() => {});
    });

    test("should generate ICS with multiple events", async () => {
      const result = await generateICal([
        { title: "Event 1", start: "2026-03-15T09:00:00Z" },
        { title: "Event 2", start: "2026-03-15T14:00:00Z" },
        { title: "Event 3", start: "2026-03-16T09:00:00Z" },
      ]);

      expect(result.success).toBe(true);
      expect(result.eventCount).toBe(3);
      const veventCount = (result.icsContent!.match(/BEGIN:VEVENT/g) || []).length;
      expect(veventCount).toBe(3);

      if (result.filePath) await unlink(result.filePath).catch(() => {});
    });

    test("should handle all-day events", async () => {
      const result = await generateICal([
        { title: "Holiday", start: "2026-12-25", allDay: true },
      ]);

      expect(result.success).toBe(true);
      expect(result.icsContent).toContain("DTSTART;VALUE=DATE:");
      expect(result.icsContent).not.toContain("DTSTART:20261225T");

      if (result.filePath) await unlink(result.filePath).catch(() => {});
    });

    test("should include alarm/reminder", async () => {
      const result = await generateICal([
        {
          title: "Important Meeting",
          start: "2026-03-15T10:00:00Z",
          alarm: { trigger: 15, description: "Meeting in 15 minutes" },
        },
      ]);

      expect(result.success).toBe(true);
      expect(result.icsContent).toContain("BEGIN:VALARM");
      expect(result.icsContent).toContain("TRIGGER:-PT15M");
      expect(result.icsContent).toContain("END:VALARM");

      if (result.filePath) await unlink(result.filePath).catch(() => {});
    });

    test("should include recurrence rules", async () => {
      const result = await generateICal([
        {
          title: "Weekly Standup",
          start: "2026-03-15T10:00:00Z",
          recurrence: { frequency: "weekly", byDay: ["MO", "WE", "FR"], count: 52 },
        },
      ]);

      expect(result.success).toBe(true);
      expect(result.icsContent).toContain("RRULE:FREQ=WEEKLY");
      expect(result.icsContent).toContain("BYDAY=MO,WE,FR");
      expect(result.icsContent).toContain("COUNT=52");

      if (result.filePath) await unlink(result.filePath).catch(() => {});
    });

    test("should include attendees", async () => {
      const result = await generateICal([
        {
          title: "Team Sync",
          start: "2026-03-15T10:00:00Z",
          attendees: [
            { name: "Alice", email: "alice@example.com" },
            { name: "Bob", email: "bob@example.com", rsvp: false },
          ],
        },
      ]);

      expect(result.success).toBe(true);
      expect(result.icsContent).toContain("ATTENDEE;CN=Alice;RSVP=TRUE:mailto:alice@example.com");
      expect(result.icsContent).toContain("ATTENDEE;CN=Bob:mailto:bob@example.com");

      if (result.filePath) await unlink(result.filePath).catch(() => {});
    });

    test("should set calendar name and timezone", async () => {
      const result = await generateICal(
        [{ title: "Test", start: "2026-03-15T10:00:00Z" }],
        undefined,
        { calendarName: "My Calendar", timezone: "America/New_York" }
      );

      expect(result.success).toBe(true);
      expect(result.icsContent).toContain("X-WR-CALNAME:My Calendar");
      expect(result.icsContent).toContain("X-WR-TIMEZONE:America/New_York");

      if (result.filePath) await unlink(result.filePath).catch(() => {});
    });

    test("should escape special characters in text", async () => {
      const result = await generateICal([
        {
          title: "Meeting; with, special chars",
          start: "2026-03-15T10:00:00Z",
          description: "Line 1\nLine 2",
        },
      ]);

      expect(result.success).toBe(true);
      expect(result.icsContent).toContain("SUMMARY:Meeting\\; with\\, special chars");
      expect(result.icsContent).toContain("DESCRIPTION:Line 1\\nLine 2");

      if (result.filePath) await unlink(result.filePath).catch(() => {});
    });

    test("should write file to disk", async () => {
      const result = await generateICal([
        { title: "Test", start: "2026-03-15T10:00:00Z" },
      ]);

      expect(result.filePath).toBeTruthy();
      const content = await readFile(result.filePath!, "utf-8");
      expect(content).toContain("BEGIN:VCALENDAR");

      await unlink(result.filePath!).catch(() => {});
    });
  });

  describe("quickEvent", () => {
    test("should create a quick single-event ICS", async () => {
      const result = await quickEvent(
        "Quick Meeting",
        "2026-03-15T10:00:00Z",
        "2026-03-15T11:00:00Z",
        "A quick test event",
        "Office"
      );

      expect(result.success).toBe(true);
      expect(result.eventCount).toBe(1);
      expect(result.icsContent).toContain("SUMMARY:Quick Meeting");
      expect(result.icsContent).toContain("LOCATION:Office");

      if (result.filePath) await unlink(result.filePath).catch(() => {});
    });
  });
});
