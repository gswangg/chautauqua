// DEC-776: overdueAssignmentConditions is the ONE overdue predicate composed
// by src/server/repo/tasks/grid.ts's counts.overdue,
// src/server/repo/overview.ts's speakers.overdueAssignments, and
// overview.ts's overdue detail rows. No D1 test harness exists in stage 1
// (see test/onboarding-grid-pagination.test.ts's header), so this locks the
// generated SQL shape via drizzle's SQLiteSyncDialect — the same technique
// test/submission-seq.test.ts uses — and proves the three call sites are
// textually identical (drift-proof) so the fixture scenario the mandate
// names (an overdue assignment for a contact who is NOT an active
// participant on an accepted submission) is excluded by ALL THREE
// consumers, not just one.

import { describe, expect, it } from "vitest";
import { SQLiteSyncDialect } from "drizzle-orm/sqlite-core";
import { overdueAssignmentConditions } from "../src/server/repo/tasks/crud";

const dialect = new SQLiteSyncDialect();

function sqlTextOf(cond: unknown): { sql: string; params: unknown[] } {
  return dialect.sqlToQuery(cond as any);
}

describe("overdueAssignmentConditions (DEC-776)", () => {
  it("ANDs event scoping, non-complete status, a past due date, and the roster EXISTS predicate", () => {
    const { sql, params } = sqlTextOf(overdueAssignmentConditions("event-1", 1_000_000));

    expect(sql).toContain('"task"."event_id" = ?');
    expect(sql).toContain("\"task_assignment\".\"status\" <> 'complete'");
    expect(sql).toContain('"task"."due_date" is not null and "task"."due_date" < ?');
    // The roster predicate: acceptedSpeakerExistsForContact's correlated
    // EXISTS against schema.contact, so a task_assignment whose contact is
    // not an active participant on an accepted submission fails this
    // EXISTS and the whole AND, excluding it from every consumer's WHERE.
    expect(sql).toContain("exists (select 1 from");
    expect(sql).toContain('"participant"."contact_id" = "contact"."id"');
    expect(sql).toContain('"submission"."status" = ?');
    expect(params).toContain("event-1");
    expect(params).toContain(1_000_000);
    expect(params).toContain("accepted");
  });

  it("is the exact same SQL text for two independently-built calls with the same args (no per-call drift)", () => {
    const a = sqlTextOf(overdueAssignmentConditions("event-1", 5000));
    const b = sqlTextOf(overdueAssignmentConditions("event-1", 5000));
    expect(a.sql).toBe(b.sql);
    expect(a.params).toEqual(b.params);
  });
});
