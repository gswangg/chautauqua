import { describe, expect, it } from "vitest";
import { ASSIGNED_LATE_GRACE_DAYS, assignmentDaysLate, effectiveAssignmentDueDate, isAssignmentOverdue } from "../src/domain/task-due";

const GRACE_MS = ASSIGNED_LATE_GRACE_DAYS * 24 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

describe("effectiveAssignmentDueDate (DEC-801)", () => {
  it("null taskDueDate stays null", () => {
    expect(effectiveAssignmentDueDate(null, 1_000_000)).toBeNull();
  });

  it("a due date at or after assignment creation is returned unchanged", () => {
    expect(effectiveAssignmentDueDate(1_000_000, 1_000_000)).toBe(1_000_000);
    expect(effectiveAssignmentDueDate(2_000_000, 1_000_000)).toBe(2_000_000);
  });

  it("a due date before assignment creation shifts to assignedAt + grace days", () => {
    const assignedAt = 1_000_000;
    const graceMs = ASSIGNED_LATE_GRACE_DAYS * 24 * 60 * 60 * 1000;
    expect(effectiveAssignmentDueDate(assignedAt - 1, assignedAt)).toBe(assignedAt + graceMs);
    expect(effectiveAssignmentDueDate(0, assignedAt)).toBe(assignedAt + graceMs);
  });
});

// DEC-801 (wave 63 amendment, w63-b): assignmentDaysLate must agree with
// isAssignmentOverdue at both edges -- 0 when not overdue, >= 1 the instant
// the predicate flips true, in the SAME event-local timezone.
describe("assignmentDaysLate (DEC-801 wave-63 amendment)", () => {
  const DUE_DAY_LABEL = Date.UTC(2026, 0, 15);
  const ASSIGNMENT_CREATED_AT = Date.UTC(2026, 0, 1);

  it("is 0 when taskDueDate is null", () => {
    expect(assignmentDaysLate(null, ASSIGNMENT_CREATED_AT, Date.now(), "America/Los_Angeles")).toBe(0);
  });

  it("is 0 when not yet overdue by isAssignmentOverdue's own rule", () => {
    const stillDueDay = Date.UTC(2026, 0, 16, 7, 59, 0); // 2026-01-15 23:59 PST
    expect(isAssignmentOverdue(DUE_DAY_LABEL, ASSIGNMENT_CREATED_AT, stillDueDay, "America/Los_Angeles")).toBe(false);
    expect(assignmentDaysLate(DUE_DAY_LABEL, ASSIGNMENT_CREATED_AT, stillDueDay, "America/Los_Angeles")).toBe(0);
  });

  it("America/Los_Angeles: is 1 the instant the predicate flips true (00:00 local the day after), never 0", () => {
    const dayAfter = Date.UTC(2026, 0, 16, 8, 0, 0); // 2026-01-16 00:00 PST
    expect(isAssignmentOverdue(DUE_DAY_LABEL, ASSIGNMENT_CREATED_AT, dayAfter, "America/Los_Angeles")).toBe(true);
    expect(assignmentDaysLate(DUE_DAY_LABEL, ASSIGNMENT_CREATED_AT, dayAfter, "America/Los_Angeles")).toBe(1);
  });

  it("America/Los_Angeles: counts whole event-local calendar days for a multi-day-late row", () => {
    const threeDaysLate = Date.UTC(2026, 0, 19, 8, 0, 0); // 2026-01-19 00:00 PST (4 local cal days after due day, 3 late)
    expect(assignmentDaysLate(DUE_DAY_LABEL, ASSIGNMENT_CREATED_AT, threeDaysLate, "America/Los_Angeles")).toBe(4);
  });

  it("Asia/Tokyo: is 1 the instant the predicate flips true (00:00 local the day after), never 0", () => {
    const dayAfter = Date.UTC(2026, 0, 15, 15, 0, 0); // 2026-01-16 00:00 JST
    expect(isAssignmentOverdue(DUE_DAY_LABEL, ASSIGNMENT_CREATED_AT, dayAfter, "Asia/Tokyo")).toBe(true);
    expect(assignmentDaysLate(DUE_DAY_LABEL, ASSIGNMENT_CREATED_AT, dayAfter, "Asia/Tokyo")).toBe(1);
  });

  it("Asia/Tokyo: still not overdue (0) one minute before the due day locally elapses, even though the old UTC-bare Math.floor already reads positive", () => {
    const stillDueDay = Date.UTC(2026, 0, 15, 14, 59, 0); // 2026-01-15 23:59 JST
    // Reproduces w63-b's headline bug: a raw UTC-bare `now - dueDate` is
    // already positive here (dueDate's day-label instant is UTC midnight
    // Jan 15, `now` is later that same UTC day), which is exactly the old
    // Math.floor((now - dueDate) / DAY_MS) defect this fix replaces.
    expect(stillDueDay > DUE_DAY_LABEL).toBe(true);
    expect(isAssignmentOverdue(DUE_DAY_LABEL, ASSIGNMENT_CREATED_AT, stillDueDay, "Asia/Tokyo")).toBe(false);
    expect(assignmentDaysLate(DUE_DAY_LABEL, ASSIGNMENT_CREATED_AT, stillDueDay, "Asia/Tokyo")).toBe(0);
  });

  it("grace branch: uses createdAt + GRACE_MS collapsed to a day label, never below 1 once overdue", () => {
    const lateAssignmentCreatedAt = Date.UTC(2026, 1, 1); // after DUE_DAY_LABEL
    const justAfterGraceEnds = lateAssignmentCreatedAt + GRACE_MS + DAY_MS + 1;
    expect(isAssignmentOverdue(DUE_DAY_LABEL, lateAssignmentCreatedAt, justAfterGraceEnds, "America/Los_Angeles")).toBe(true);
    expect(assignmentDaysLate(DUE_DAY_LABEL, lateAssignmentCreatedAt, justAfterGraceEnds, "America/Los_Angeles")).toBeGreaterThanOrEqual(1);
  });
});
