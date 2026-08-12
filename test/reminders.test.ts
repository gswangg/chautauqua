import { describe, expect, it } from "vitest";
import { isReminderDue, planReminders, type ReminderAssignment } from "../src/domain/reminders";
import { buildReminderMessage } from "../src/server/repo/tasks";

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

describe("buildReminderMessage task line ordering (DEC-564)", () => {
  const eventName = "DevFlow Conf 2027";
  const eventTimezone = "America/Los_Angeles";
  const portalLink = "https://events.example.com/portal";

  // Three assignments: one undated, two sharing a due date with different
  // titles. Declared order: dueDate asc (null last), then taskTitle asc,
  // then assignmentId asc.
  const undated = assignment({ assignmentId: "a_undated", taskTitle: "Zzz task", dueDate: null });
  const dueEarlyA = assignment({ assignmentId: "a_early_a", taskTitle: "Bravo task", dueDate: NOW });
  const dueEarlyB = assignment({ assignmentId: "a_early_b", taskTitle: "Alpha task", dueDate: NOW });

  it("renders task lines in the declared order regardless of input order", () => {
    const forward = buildReminderMessage(eventName, eventTimezone, [undated, dueEarlyA, dueEarlyB], portalLink);
    const reversed = buildReminderMessage(eventName, eventTimezone, [dueEarlyB, dueEarlyA, undated], portalLink);

    expect(forward.text).toBe(reversed.text);
    expect(forward.subject).toBe(reversed.subject);

    const lines = forward.text.split("\n");
    const aliceIdx = lines.findIndex((l) => l.includes("Alpha task"));
    const bravoIdx = lines.findIndex((l) => l.includes("Bravo task"));
    const zzzIdx = lines.findIndex((l) => l.includes("Zzz task"));
    expect(aliceIdx).toBeGreaterThan(-1);
    expect(bravoIdx).toBeGreaterThan(aliceIdx);
    expect(zzzIdx).toBeGreaterThan(bravoIdx);
  });

  it("does not mutate the caller's input array order", () => {
    const input = [undated, dueEarlyA, dueEarlyB];
    const before = input.map((a) => a.assignmentId);
    buildReminderMessage(eventName, eventTimezone, input, portalLink);
    expect(input.map((a) => a.assignmentId)).toEqual(before);
  });

  it("keeps the {portal_link} footer, subject, and signature unchanged by ordering", () => {
    const forward = buildReminderMessage(eventName, eventTimezone, [undated, dueEarlyA, dueEarlyB], portalLink);
    expect(forward.subject).toBe(`Action needed: outstanding tasks for ${eventName}`);
    expect(forward.text.endsWith(portalLink)).toBe(true);
  });
});
