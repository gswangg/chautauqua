import { describe, expect, it } from "vitest";
import {
  isReminderDue,
  planManualReminders,
  planReminders,
  REMINDER_OVERDUE_TAIL_MS,
  type ReminderAssignment,
} from "../src/domain/reminders";
import { buildReminderMessage } from "../src/server/repo/tasks";

// wave-61 amendment (DEC-023): isReminderDue/planReminders/planManualReminders
// now expand dueDate through dayLabelEndInstant(dueDate, timeZone) before
// comparing. All tests here use TZ="UTC" and a midnight-aligned NOW so that
// each dueDate's calendar day (and its end-of-day instant) lines up cleanly
// with day-granular arithmetic — the same-zone-offset case is covered here;
// cross-zone boundary behavior is covered by
// test/reminder-window-timezone.test.ts.
const TZ = "UTC";
const NOW = Date.UTC(2023, 10, 15); // 2023-11-15T00:00:00.000Z, midnight UTC
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

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
    expect(isReminderDue(a, NOW, null, TZ)).toBe(false);
  });

  it("is false when dueDate is null (no due date, nothing to chase)", () => {
    const a = assignment({ dueDate: null });
    expect(isReminderDue(a, NOW, null, TZ)).toBe(false);
  });

  it("is true for an overdue assignment never reminded", () => {
    const a = assignment({ dueDate: NOW - HOUR, lastRemindedAt: null });
    expect(isReminderDue(a, NOW, null, TZ)).toBe(true);
  });

  it("is true for an assignment due within 72h", () => {
    const a = assignment({ dueDate: NOW + 71 * HOUR, lastRemindedAt: null });
    expect(isReminderDue(a, NOW, null, TZ)).toBe(true);
  });

  it("is false for an assignment due beyond 72h", () => {
    const a = assignment({ dueDate: NOW + 73 * HOUR, lastRemindedAt: null });
    expect(isReminderDue(a, NOW, null, TZ)).toBe(false);
  });

  it("is false when last reminded less than 24h ago", () => {
    const a = assignment({ dueDate: NOW - HOUR, lastRemindedAt: NOW - 23 * HOUR });
    expect(isReminderDue(a, NOW, null, TZ)).toBe(false);
  });

  it("is true when last reminded more than 24h ago", () => {
    const a = assignment({ dueDate: NOW - HOUR, lastRemindedAt: NOW - 25 * HOUR });
    expect(isReminderDue(a, NOW, null, TZ)).toBe(true);
  });

  it("is true at exactly the 24h boundary plus one ms", () => {
    const a = assignment({ dueDate: NOW - HOUR, lastRemindedAt: NOW - (24 * HOUR + 1) });
    expect(isReminderDue(a, NOW, null, TZ)).toBe(true);
  });
});

describe("planReminders (DEC-023 grouping)", () => {
  it("groups multiple due assignments per contact into one email", () => {
    const assignments: ReminderAssignment[] = [
      assignment({ assignmentId: "a1", contactId: "c1", dueDate: NOW - HOUR }),
      assignment({ assignmentId: "a2", contactId: "c1", dueDate: NOW + HOUR, taskId: "t2" }),
      assignment({ assignmentId: "a3", contactId: "c2", dueDate: NOW - HOUR }),
    ];
    const result = planReminders({ assignments, now: NOW, eventEndsAt: null, timeZone: TZ });
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
    const result = planReminders({ assignments, now: NOW, eventEndsAt: null, timeZone: TZ });
    expect(result.groups).toEqual([]);
  });

  it("returns an empty group list for no input assignments", () => {
    expect(planReminders({ assignments: [], now: NOW, eventEndsAt: null, timeZone: TZ }).groups).toEqual([]);
  });
});

describe("isReminderDue terminal conditions (DEC-023 wave-58 amendment)", () => {
  // wave-61 amendment: the window boundary is now the zone-expanded END of
  // the due day, not the raw dueDate instant, so "due exactly at now+72h"
  // no longer sits at the fence itself — the due day one calendar day
  // earlier does (its end-of-day instant falls just inside now+72h), and the
  // due day whose START is now+72h falls just outside it (its end-of-day
  // instant is ~24h later than the window edge).
  it("fires when the due day's end falls within the 72h lead window", () => {
    const a = assignment({ dueDate: NOW + 2 * DAY, lastRemindedAt: null });
    expect(isReminderDue(a, NOW, null, TZ)).toBe(true);
  });

  it("does NOT fire when the due day's end falls past the 72h lead window", () => {
    const a = assignment({ dueDate: NOW + 3 * DAY, lastRemindedAt: null });
    expect(isReminderDue(a, NOW, null, TZ)).toBe(false);
  });

  it("fires at due+6d (within the 7-day overdue tail)", () => {
    const a = assignment({ dueDate: NOW - 6 * DAY, lastRemindedAt: null });
    expect(isReminderDue(a, NOW, null, TZ)).toBe(true);
  });

  it("does NOT fire at due+8d (past the 7-day overdue tail)", () => {
    const a = assignment({ dueDate: NOW - 8 * DAY, lastRemindedAt: null });
    expect(isReminderDue(a, NOW, null, TZ)).toBe(false);
  });

  it("boundary: exactly REMINDER_OVERDUE_TAIL_MS past due still fires (strict greater-than)", () => {
    const a = assignment({ dueDate: NOW - REMINDER_OVERDUE_TAIL_MS, lastRemindedAt: null });
    expect(isReminderDue(a, NOW, null, TZ)).toBe(true);
  });

  it("does NOT fire when now > eventEndsAt, even for a task that just became due", () => {
    const eventEndsAt = NOW - HOUR;
    const a = assignment({ dueDate: NOW - 10 * 60 * 1000, lastRemindedAt: null });
    expect(isReminderDue(a, NOW, eventEndsAt, TZ)).toBe(false);
  });

  it("eventEndsAt null keeps the overdue-tail rule as the only terminal gate", () => {
    const withinTail = assignment({ dueDate: NOW - 6 * DAY, lastRemindedAt: null });
    const pastTail = assignment({ dueDate: NOW - 8 * DAY, lastRemindedAt: null });
    expect(isReminderDue(withinTail, NOW, null, TZ)).toBe(true);
    expect(isReminderDue(pastTail, NOW, null, TZ)).toBe(false);
  });
});

describe("planManualReminders still overrides every window (DEC-319)", () => {
  it("returns an ancient, never-completed assignment that isReminderDue would refuse forever", () => {
    const assignments: ReminderAssignment[] = [
      assignment({ assignmentId: "ancient", contactId: "c1", dueDate: NOW - 400 * DAY, lastRemindedAt: null }),
    ];
    // isReminderDue (the cron gate) would refuse this: far past the 7-day tail.
    expect(isReminderDue(assignments[0]!, NOW, null, TZ)).toBe(false);
    // but the organizer's explicit "remind now" still surfaces it — note no
    // timezone is passed at all: DEC-023 wave-9 amendment, planManualReminders
    // never reads one (compile-level proof the dead parameter is gone).
    const result = planManualReminders({ assignments, now: NOW });
    expect(result.groups).toHaveLength(1);
    expect(result.groups[0]?.assignments.map((a) => a.assignmentId)).toEqual(["ancient"]);
  });
});

describe("buildReminderMessage task line ordering (DEC-564)", () => {
  const eventName = "DevFlow Conf 2027";
  const portalLink = "https://events.example.com/portal";

  // Three assignments: one undated, two sharing a due date with different
  // titles. Declared order: dueDate asc (null last), then taskTitle asc,
  // then assignmentId asc.
  const undated = assignment({ assignmentId: "a_undated", taskTitle: "Zzz task", dueDate: null });
  const dueEarlyA = assignment({ assignmentId: "a_early_a", taskTitle: "Bravo task", dueDate: NOW });
  const dueEarlyB = assignment({ assignmentId: "a_early_b", taskTitle: "Alpha task", dueDate: NOW });

  it("renders task lines in the declared order regardless of input order", () => {
    const forward = buildReminderMessage(eventName, [undated, dueEarlyA, dueEarlyB], portalLink);
    const reversed = buildReminderMessage(eventName, [dueEarlyB, dueEarlyA, undated], portalLink);

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
    buildReminderMessage(eventName, input, portalLink);
    expect(input.map((a) => a.assignmentId)).toEqual(before);
  });

  it("keeps the {portal_link} footer, subject, and signature unchanged by ordering", () => {
    const forward = buildReminderMessage(eventName, [undated, dueEarlyA, dueEarlyB], portalLink);
    expect(forward.subject).toBe(`Action needed: outstanding tasks for ${eventName}`);
    expect(forward.text.endsWith(portalLink)).toBe(true);
  });
});
