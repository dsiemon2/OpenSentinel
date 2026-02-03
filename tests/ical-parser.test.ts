import { describe, test, expect } from "bun:test";
import {
  parseICalContent,
  CalendarEvent,
} from "../src/inputs/calendar/ical-parser";

describe("iCal Parser", () => {
  describe("parseICalContent", () => {
    test("should parse basic VEVENT", () => {
      const icalContent = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
DTSTART:20240115T100000Z
DTEND:20240115T110000Z
SUMMARY:Team Meeting
DESCRIPTION:Weekly sync
UID:test-event-1
END:VEVENT
END:VCALENDAR`;

      const result = parseICalContent(icalContent);

      expect(result.events.length).toBe(1);
      expect(result.events[0].summary).toBe("Team Meeting");
      expect(result.events[0].description).toBe("Weekly sync");
      expect(result.events[0].uid).toBe("test-event-1");
    });

    test("should parse multiple events", () => {
      const icalContent = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
DTSTART:20240115T100000Z
DTEND:20240115T110000Z
SUMMARY:Event 1
UID:event-1
END:VEVENT
BEGIN:VEVENT
DTSTART:20240115T140000Z
DTEND:20240115T150000Z
SUMMARY:Event 2
UID:event-2
END:VEVENT
END:VCALENDAR`;

      const result = parseICalContent(icalContent);

      expect(result.events.length).toBe(2);
      expect(result.events[0].summary).toBe("Event 1");
      expect(result.events[1].summary).toBe("Event 2");
    });

    test("should handle events without description", () => {
      const icalContent = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
DTSTART:20240115T100000Z
DTEND:20240115T110000Z
SUMMARY:Quick Meeting
UID:quick-meeting
END:VEVENT
END:VCALENDAR`;

      const result = parseICalContent(icalContent);

      expect(result.events.length).toBe(1);
      expect(result.events[0].description).toBeUndefined();
    });

    test("should handle events with location", () => {
      const icalContent = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
DTSTART:20240115T100000Z
DTEND:20240115T110000Z
SUMMARY:Office Meeting
LOCATION:Conference Room A
UID:office-meeting
END:VEVENT
END:VCALENDAR`;

      const result = parseICalContent(icalContent);

      expect(result.events.length).toBe(1);
      expect(result.events[0].location).toBe("Conference Room A");
    });

    test("should parse dates correctly", () => {
      const icalContent = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
DTSTART:20240115T100000Z
DTEND:20240115T110000Z
SUMMARY:Test Event
UID:test
END:VEVENT
END:VCALENDAR`;

      const result = parseICalContent(icalContent);

      expect(result.events[0].startDate).toBeInstanceOf(Date);
      expect(result.events[0].endDate).toBeInstanceOf(Date);
      expect(result.events[0].startDate.getUTCFullYear()).toBe(2024);
      expect(result.events[0].startDate.getUTCMonth()).toBe(0); // January is 0
      expect(result.events[0].startDate.getUTCDate()).toBe(15);
    });

    test("should handle empty calendar", () => {
      const icalContent = `BEGIN:VCALENDAR
VERSION:2.0
END:VCALENDAR`;

      const result = parseICalContent(icalContent);

      expect(result.events.length).toBe(0);
    });

    test("should handle malformed content gracefully", () => {
      const icalContent = `not valid ical content`;

      const result = parseICalContent(icalContent);

      expect(result.events.length).toBe(0);
    });

    test("should handle all-day events", () => {
      const icalContent = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
DTSTART;VALUE=DATE:20240115
DTEND;VALUE=DATE:20240116
SUMMARY:All Day Event
UID:all-day
END:VEVENT
END:VCALENDAR`;

      const result = parseICalContent(icalContent);

      expect(result.events.length).toBe(1);
      expect(result.events[0].isAllDay).toBe(true);
    });

    test("should handle recurring events indicator", () => {
      const icalContent = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
DTSTART:20240115T100000Z
DTEND:20240115T110000Z
SUMMARY:Weekly Meeting
RRULE:FREQ=WEEKLY;BYDAY=MO
UID:recurring
END:VEVENT
END:VCALENDAR`;

      const result = parseICalContent(icalContent);

      expect(result.events.length).toBeGreaterThanOrEqual(1);
      // Should have the recurring rule info
      expect(result.events[0].recurrence).toBeTruthy();
    });
  });

  describe("Event properties", () => {
    test("CalendarEvent should have required fields", () => {
      const icalContent = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
DTSTART:20240115T100000Z
DTEND:20240115T110000Z
SUMMARY:Test
UID:test
END:VEVENT
END:VCALENDAR`;

      const result = parseICalContent(icalContent);
      const event = result.events[0];

      expect(event).toHaveProperty("uid");
      expect(event).toHaveProperty("summary");
      expect(event).toHaveProperty("startDate");
      expect(event).toHaveProperty("endDate");
    });
  });
});
