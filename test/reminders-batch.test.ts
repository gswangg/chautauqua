import { describe, expect, it } from "vitest";
import {
  capReminderGroups,
  MANUAL_DEDUPE_WINDOW_MS,
  MAX_REMINDER_BATCH,
  planManualReminders,
  type ReminderAssignment,
} from "../src/domain/reminders";

const NOW = 1_700_000_000_000;
const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;

function assignment(overrides: Partial<ReminderAssignment>): ReminderAssignment {
  return {
    assignmentId: "a1",
    contactId: "c1",
    status: "pending",
    dueDate: null,
    lastRemindedAt: null,
    taskId: "t1",
    taskTitle: "Some task",
    ...overrides,
  };
}

function contactId(i: number): string {
  // zero-padded so lexicographic ("<"/">") ordering matches numeric ordering
  return `contact-${String(i).padStart(4, "0")}`;
}

describe("capReminderGroups (DEC-319)", () => {
  it("is a no-op under the cap", () => {
    const groups = [
      { contactId: "b" },
      { contactId: "a" },
      { contactId: "c" },
    ];
    const result = capReminderGroups(groups, 100);
    expect(result.remaining).toBe(0);
    expect(result.groups).toHaveLength(3);
    // still sorted, but nothing dropped
    expect(result.groups.map((g) => g.contactId)).toEqual(["a", "b", "c"]);
  });

  it("caps at MAX_REMINDER_BATCH by default, sorted by contactId ascending", () => {
    const groups = Array.from({ length: 250 }, (_, i) => ({ contactId: contactId(250 - i) }));
    const result = capReminderGroups(groups);
    expect(result.groups).toHaveLength(MAX_REMINDER_BATCH);
    expect(result.remaining).toBe(150);
    expect(result.groups.map((g) => g.contactId)).toEqual(
      Array.from({ length: 100 }, (_, i) => contactId(i + 1)),
    );
  });

  it("is deterministic so repeat passes advance rather than repeat", () => {
    const groups = Array.from({ length: 250 }, (_, i) => ({ contactId: contactId(i + 1) }));
    const first = capReminderGroups(groups);
    const remainingGroups = groups.filter((g) => !first.groups.some((f) => f.contactId === g.contactId));
    const second = capReminderGroups(remainingGroups);
    expect(second.groups).toHaveLength(100);
    expect(second.remaining).toBe(50);
    // no overlap between the two passes
    const firstIds = new Set(first.groups.map((g) => g.contactId));
    for (const g of second.groups) {
      expect(firstIds.has(g.contactId)).toBe(false);
    }
  });
});

describe("planManualReminders (DEC-319)", () => {
  it("yields 100 groups and remaining=150 for 250 contacts, stable contactId ordering", () => {
    const assignments: ReminderAssignment[] = Array.from({ length: 250 }, (_, i) =>
      assignment({ assignmentId: `a${i}`, contactId: contactId(i + 1) }),
    );
    const result = planManualReminders({ assignments, now: NOW });
    expect(result.groups).toHaveLength(100);
    expect(result.remaining).toBe(150);
    expect(result.skipped).toBe(0);
    const ids = result.groups.map((g) => g.contactId);
    const sortedIds = [...ids].sort();
    expect(ids).toEqual(sortedIds);
    expect(ids[0]).toBe(contactId(1));
    expect(ids[ids.length - 1]).toBe(contactId(100));
  });

  it("groups ALL outstanding assignments per contact regardless of dueDate", () => {
    const assignments: ReminderAssignment[] = [
      assignment({ assignmentId: "a1", contactId: "c1", dueDate: NOW + 200 * HOUR }),
      assignment({ assignmentId: "a2", contactId: "c1", dueDate: null, taskId: "t2" }),
    ];
    const result = planManualReminders({ assignments, now: NOW });
    expect(result.groups).toHaveLength(1);
    expect(result.groups[0]?.assignments.map((a) => a.assignmentId).sort()).toEqual(["a1", "a2"]);
  });

  it("skips a contact reminded 10 minutes ago", () => {
    const assignments: ReminderAssignment[] = [
      assignment({ assignmentId: "a1", contactId: "c1", lastRemindedAt: NOW - 10 * MINUTE }),
    ];
    const result = planManualReminders({ assignments, now: NOW });
    expect(result.groups).toEqual([]);
    expect(result.skipped).toBe(1);
    expect(result.remaining).toBe(0);
  });

  it("does not skip a contact reminded 90 minutes ago", () => {
    const assignments: ReminderAssignment[] = [
      assignment({ assignmentId: "a1", contactId: "c1", lastRemindedAt: NOW - 90 * MINUTE }),
    ];
    const result = planManualReminders({ assignments, now: NOW });
    expect(result.groups).toHaveLength(1);
    expect(result.skipped).toBe(0);
  });

  it("uses the most recent lastRemindedAt across a contact's assignments", () => {
    const assignments: ReminderAssignment[] = [
      assignment({ assignmentId: "a1", contactId: "c1", lastRemindedAt: NOW - 90 * MINUTE }),
      assignment({ assignmentId: "a2", contactId: "c1", lastRemindedAt: NOW - 10 * MINUTE, taskId: "t2" }),
    ];
    const result = planManualReminders({ assignments, now: NOW });
    // most recent reminder (10 min ago) is within the dedupe window, so skip
    expect(result.groups).toEqual([]);
    expect(result.skipped).toBe(1);
  });

  it("excludes complete assignments from consideration entirely", () => {
    const assignments: ReminderAssignment[] = [
      assignment({ assignmentId: "a1", contactId: "c1", status: "complete" }),
    ];
    const result = planManualReminders({ assignments, now: NOW });
    expect(result.groups).toEqual([]);
    expect(result.skipped).toBe(0);
  });

  it("boundary: exactly MANUAL_DEDUPE_WINDOW_MS ago is not skipped (strict less-than)", () => {
    const assignments: ReminderAssignment[] = [
      assignment({ assignmentId: "a1", contactId: "c1", lastRemindedAt: NOW - MANUAL_DEDUPE_WINDOW_MS }),
    ];
    const result = planManualReminders({ assignments, now: NOW });
    expect(result.groups).toHaveLength(1);
    expect(result.skipped).toBe(0);
  });
});
