import { describe, expect, it } from "vitest";
import { ASSIGNED_LATE_GRACE_DAYS, effectiveAssignmentDueDate } from "../src/domain/task-due";

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
