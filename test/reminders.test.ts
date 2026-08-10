import { describe, expect, it } from "vitest";
import { isReminderDue, planReminders, type ReminderAssignment } from "../src/domain/reminders";

const NOW = 1_700_000_000_000;
const HOUR = 60 * 60 * 1000;

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

describe("isReminderDue (DEC-023)", () => {
  it("is false for complete assignments regardless of due date", () => {
    const a = assignment({ status: "complete", dueDate: NOW - HOUR });
    expect(isReminderDue(a, NOW)).toBe(false);
  });

  it("is false when dueDate is null (no due date, nothing to chase)", () => {
    const a = assignment({ dueDate: null });
    expect(isReminderDue(a, NOW)).toBe(false);
  });

  it("is true for an overdue assignment never reminded", () => {
    const a = assignment({ dueDate: NOW - HOUR, lastRemindedAt: null });
    expect(isReminderDue(a, NOW)).toBe(true);
  });

  it("is true for an assignment due within 72h", () => {
    const a = assignment({ dueDate: NOW + 71 * HOUR, lastRemindedAt: null });
    expect(isReminderDue(a, NOW)).toBe(true);
  });

  it("is false for an assignment due beyond 72h", () => {
    const a = assignment({ dueDate: NOW + 73 * HOUR, lastRemindedAt: null });
    expect(isReminderDue(a, NOW)).toBe(false);
  });

  it("is false when last reminded less than 24h ago", () => {
    const a = assignment({ dueDate: NOW - HOUR, lastRemindedAt: NOW - 23 * HOUR });
    expect(isReminderDue(a, NOW)).toBe(false);
  });

  it("is true when last reminded more than 24h ago", () => {
    const a = assignment({ dueDate: NOW - HOUR, lastRemindedAt: NOW - 25 * HOUR });
    expect(isReminderDue(a, NOW)).toBe(true);
  });

  it("is true at exactly the 24h boundary plus one ms", () => {
    const a = assignment({ dueDate: NOW - HOUR, lastRemindedAt: NOW - (24 * HOUR + 1) });
    expect(isReminderDue(a, NOW)).toBe(true);
  });
});

describe("planReminders (DEC-023 grouping)", () => {
  it("groups multiple due assignments per contact into one email", () => {
    const assignments: ReminderAssignment[] = [
      assignment({ assignmentId: "a1", contactId: "c1", dueDate: NOW - HOUR }),
      assignment({ assignmentId: "a2", contactId: "c1", dueDate: NOW + HOUR, taskId: "t2" }),
      assignment({ assignmentId: "a3", contactId: "c2", dueDate: NOW - HOUR }),
    ];
    const result = planReminders({ assignments, now: NOW });
    expect(result.groups).toHaveLength(2);
    const c1 = result.groups.find((g) => g.contactId === "c1");
    expect(c1?.assignments.map((a) => a.assignmentId).sort()).toEqual(["a1", "a2"]);
    const c2 = result.groups.find((g) => g.contactId === "c2");
    expect(c2?.assignments.map((a) => a.assignmentId)).toEqual(["a3"]);
  });

  it("excludes complete, not-yet-due, and recently-reminded assignments", () => {
    const assignments: ReminderAssignment[] = [
      assignment({ assignmentId: "done", status: "complete", dueDate: NOW - HOUR }),
      assignment({ assignmentId: "future", dueDate: NOW + 100 * HOUR }),
      assignment({ assignmentId: "recent", dueDate: NOW - HOUR, lastRemindedAt: NOW - HOUR }),
    ];
    const result = planReminders({ assignments, now: NOW });
    expect(result.groups).toEqual([]);
  });

  it("returns an empty group list for no input assignments", () => {
    expect(planReminders({ assignments: [], now: NOW }).groups).toEqual([]);
  });
});
