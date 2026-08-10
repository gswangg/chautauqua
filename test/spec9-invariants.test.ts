// SPEC.md §9 direct-unit-test coverage for the four named high-weight
// invariants (task w13-e). Three already have direct coverage elsewhere in
// test/ (cited below); this file adds the one that was missing: a
// behavioral check that a status-change write path never touches
// email_log. Existing tests are not edited (other lanes may touch them).
//
// Direct coverage that already exists (verified, not duplicated here):
// - close-date lock: test/edit-lock.test.ts, test/submit-core.test.ts
// - speaker isolation (cross-account IDOR): test/task-file-access.test.ts
//   "403s for another speaker (IDOR)"
// - hidden-speaker exclusion: test/headshot-gate.test.ts "404s
//   unauthenticated when the speaker isn't publicly visible (pending/hidden)"

import { describe, expect, it } from "vitest";
import * as schema from "../src/db/schema";
import { updateSubmissionStatuses } from "../src/server/repo/submissions";
import type { Db } from "../src/server/context";

/**
 * Minimal fake drizzle db that only supports the exact chains
 * updateSubmissionStatuses uses (select().from().where(), then
 * update().set().where()), and records every table object it's asked to
 * touch. A non-accepted status transition never invokes acceptance
 * planning, so this exercises the full status-change write path.
 */
function fakeDb(row: { id: string; status: string; acceptedAt: Date | null }) {
  const touchedTables: unknown[] = [];
  const db = {
    select() {
      return {
        from(table: unknown) {
          touchedTables.push(table);
          return {
            where: async () => [row],
          };
        },
      };
    },
    update(table: unknown) {
      touchedTables.push(table);
      return {
        set() {
          return {
            where: async () => undefined,
          };
        },
      };
    },
    insert(table: unknown) {
      touchedTables.push(table);
      throw new Error("unexpected insert during a plain status change");
    },
  };
  return { db: db as unknown as Db, touchedTables };
}

describe("SPEC §9 invariant: decision (status change) never auto-emails", () => {
  it("updateSubmissionStatuses (pending -> declined) never touches email_log", async () => {
    const { db, touchedTables } = fakeDb({ id: "sub-1", status: "pending", acceptedAt: null });

    const result = await updateSubmissionStatuses(db, "event-1", ["sub-1"], "declined", new Date());

    expect(result.updated).toBe(1);
    expect(touchedTables).not.toContain(schema.emailLog);
    // Only the submission table should ever be touched on a plain decision.
    for (const table of touchedTables) {
      expect(table).toBe(schema.submission);
    }
  });
});
