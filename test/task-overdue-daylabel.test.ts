// DEC-801 (wave 58 amendment, J6): task.dueDate is a DAY LABEL (a
// UTC-midnight stand-in for a calendar date), not an instant. Comparing it
// directly to `now` (the pre-amendment behavior) flags a task overdue as
// soon as UTC midnight passes -- for an America/Los_Angeles event, up to
// ~16 hours before the due day even begins locally. This locks
// isAssignmentOverdue/dayLabelOfInstant/overdueDayCutoff at the LA and
// Tokyo day boundaries: still NOT overdue at 23:59 event-local on the due
// day, and OVERDUE at 00:00 event-local the day after, plus the pre-DEC-801
// grace-window branch (assignment created after the task's own due date).

import { describe, expect, it } from "vitest";
import { dayLabelOfInstant } from "../src/lib/timezone";
import { ASSIGNED_LATE_GRACE_DAYS, isAssignmentOverdue, overdueDayCutoff } from "../src/domain/task-due";

const GRACE_MS = ASSIGNED_LATE_GRACE_DAYS * 24 * 60 * 60 * 1000;

// A day-label instant is UTC midnight of the intended calendar day (DEC-522
// convention) -- Date.UTC(2026, 0, 15) == the day label for '2026-01-15',
// well away from any DST transition in either zone under test.
const DUE_DAY_LABEL = Date.UTC(2026, 0, 15);
const ASSIGNMENT_CREATED_AT = Date.UTC(2026, 0, 1); // well before the due day.

describe("dayLabelOfInstant (DEC-801 wave-58 amendment)", () => {
  it("throws on an empty timeZone", () => {
    expect(() => dayLabelOfInstant(Date.UTC(2026, 0, 15), "")).toThrow(/non-empty timeZone/);
  });

  it("throws on a non-finite/out-of-range instant", () => {
    expect(() => dayLabelOfInstant(Number.NaN, "America/Los_Angeles")).toThrow(/finite epoch-ms/);
    expect(() => dayLabelOfInstant(1e18, "America/Los_Angeles")).toThrow(/finite epoch-ms/);
  });

  it("America/Los_Angeles (UTC-8 in January): 07:59 UTC is still Jan 15 local, 08:00 UTC rolls to Jan 16", () => {
    const stillJan15 = Date.UTC(2026, 0, 16, 7, 59, 0); // 2026-01-15 23:59 PST
    const nowJan16 = Date.UTC(2026, 0, 16, 8, 0, 0); // 2026-01-16 00:00 PST
    expect(dayLabelOfInstant(stillJan15, "America/Los_Angeles")).toBe(Date.UTC(2026, 0, 15));
    expect(dayLabelOfInstant(nowJan16, "America/Los_Angeles")).toBe(Date.UTC(2026, 0, 16));
  });

  it("Asia/Tokyo (UTC+9): 14:59 UTC is still Jan 15 local, 15:00 UTC rolls to Jan 16", () => {
    const stillJan15 = Date.UTC(2026, 0, 15, 14, 59, 0); // 2026-01-15 23:59 JST
    const nowJan16 = Date.UTC(2026, 0, 15, 15, 0, 0); // 2026-01-16 00:00 JST
    expect(dayLabelOfInstant(stillJan15, "Asia/Tokyo")).toBe(Date.UTC(2026, 0, 15));
    expect(dayLabelOfInstant(nowJan16, "Asia/Tokyo")).toBe(Date.UTC(2026, 0, 16));
  });
});

describe("overdueDayCutoff (DEC-801 wave-58 amendment)", () => {
  it("is exactly dayLabelOfInstant(now, timeZone)", () => {
    const now = Date.UTC(2026, 0, 16, 8, 0, 0);
    expect(overdueDayCutoff(now, "America/Los_Angeles")).toBe(dayLabelOfInstant(now, "America/Los_Angeles"));
  });
});

describe("isAssignmentOverdue (DEC-801 wave-58 amendment)", () => {
  it("a null task due date is never overdue", () => {
    expect(isAssignmentOverdue(null, ASSIGNMENT_CREATED_AT, Date.now(), "America/Los_Angeles")).toBe(false);
  });

  it("America/Los_Angeles: NOT overdue at 23:59 local on the due day, OVERDUE at 00:00 local the next day", () => {
    const stillDueDay = Date.UTC(2026, 0, 16, 7, 59, 0); // 2026-01-15 23:59 PST
    const dayAfter = Date.UTC(2026, 0, 16, 8, 0, 0); // 2026-01-16 00:00 PST
    expect(isAssignmentOverdue(DUE_DAY_LABEL, ASSIGNMENT_CREATED_AT, stillDueDay, "America/Los_Angeles")).toBe(false);
    expect(isAssignmentOverdue(DUE_DAY_LABEL, ASSIGNMENT_CREATED_AT, dayAfter, "America/Los_Angeles")).toBe(true);
  });

  it("Asia/Tokyo: NOT overdue at 23:59 local on the due day, OVERDUE at 00:00 local the next day", () => {
    const stillDueDay = Date.UTC(2026, 0, 15, 14, 59, 0); // 2026-01-15 23:59 JST
    const dayAfter = Date.UTC(2026, 0, 15, 15, 0, 0); // 2026-01-16 00:00 JST
    expect(isAssignmentOverdue(DUE_DAY_LABEL, ASSIGNMENT_CREATED_AT, stillDueDay, "Asia/Tokyo")).toBe(false);
    expect(isAssignmentOverdue(DUE_DAY_LABEL, ASSIGNMENT_CREATED_AT, dayAfter, "Asia/Tokyo")).toBe(true);
  });

  // The pre-existing grace branch (DEC-801's original mandate): when the
  // assignment was created AFTER the task's raw due date, lateness is
  // judged against assignmentCreatedAt + GRACE_MS -- a real instant, so no
  // timezone expansion applies.
  it("grace branch: an assignment created after the task's due date is judged against createdAt + GRACE_MS as a plain instant", () => {
    const lateAssignmentCreatedAt = Date.UTC(2026, 1, 1); // after DUE_DAY_LABEL
    const justBeforeGraceEnds = lateAssignmentCreatedAt + GRACE_MS - 1;
    const justAfterGraceEnds = lateAssignmentCreatedAt + GRACE_MS + 1;
    expect(isAssignmentOverdue(DUE_DAY_LABEL, lateAssignmentCreatedAt, justBeforeGraceEnds, "America/Los_Angeles")).toBe(false);
    expect(isAssignmentOverdue(DUE_DAY_LABEL, lateAssignmentCreatedAt, justAfterGraceEnds, "America/Los_Angeles")).toBe(true);
  });
});
