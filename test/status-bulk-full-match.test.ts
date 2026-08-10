// DEC-133 regression: updateSubmissionStatuses enforces a DEC-122-style
// full-set id match before any mutation — unknown/foreign ids fail loudly
// naming the missing ids, with zero DB side effects (atomicity), while
// duplicate valid ids in the request are tolerated.

import { describe, expect, it } from "vitest";
import * as schema from "../src/db/schema";
import { updateSubmissionStatuses } from "../src/server/repo/submissions";
import { ApiError } from "../src/server/http";
import type { Db } from "../src/server/context";

interface FakeRow {
  id: string;
  status: string;
  acceptedAt: Date | null;
}

/**
 * Fake drizzle db exercising exactly the chains updateSubmissionStatuses
 * uses. `existingRows` models the set of rows that actually belong to the
 * event (what a real chunked event-scoped SELECT would return). The
 * select().where() filters that dataset down to whichever ids the caller
 * requested — mirroring a real inArray + eventId-scoped WHERE clause
 * without needing to introspect the drizzle AST.
 */
function fakeDb(existingRows: FakeRow[], requestedIds: string[]) {
  const updateCalls: { table: unknown; setValue: unknown }[] = [];
  const insertCalls: { table: unknown; value: unknown }[] = [];

  const db = {
    select() {
      return {
        from(table: unknown) {
          if (table === schema.submission) {
            return {
              where: async () => existingRows.filter((r) => requestedIds.includes(r.id)),
            };
          }
          // task_assignment / task lookups during acceptance planning —
          // not exercised by these declined-status tests.
          return { where: async () => [] };
        },
      };
    },
    update(table: unknown) {
      return {
        set(setValue: unknown) {
          updateCalls.push({ table, setValue });
          return {
            where: async () => undefined,
          };
        },
      };
    },
    insert(table: unknown) {
      return {
        values(value: unknown) {
          insertCalls.push({ table, value });
          return Promise.resolve(undefined);
        },
      };
    },
  };
  return { db: db as unknown as Db, updateCalls, insertCalls };
}

describe("updateSubmissionStatuses — DEC-133 full-set id match", () => {
  it("throws ApiError('invalid') naming missing ids and applies zero mutations for a mix of valid + foreign/unknown ids", async () => {
    const existingRows: FakeRow[] = [{ id: "sub-1", status: "pending", acceptedAt: null }];
    const requestedIds = ["sub-1", "sub-foreign", "sub-nonexistent"];
    const { db, updateCalls, insertCalls } = fakeDb(existingRows, requestedIds);

    await expect(updateSubmissionStatuses(db, "event-1", requestedIds, "declined", new Date())).rejects.toMatchObject(
      {
        code: "invalid",
      },
    );

    try {
      await updateSubmissionStatuses(db, "event-1", requestedIds, "declined", new Date());
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      const apiErr = err as ApiError;
      expect(apiErr.fields?.ids).toContain("sub-foreign");
      expect(apiErr.fields?.ids).toContain("sub-nonexistent");
      expect(apiErr.fields?.ids).not.toContain("sub-1");
    }

    expect(updateCalls).toHaveLength(0);
    expect(insertCalls).toHaveLength(0);
  });

  it("applies statuses for an all-valid id set, with updated equal to the distinct id count", async () => {
    const existingRows: FakeRow[] = [
      { id: "sub-1", status: "pending", acceptedAt: null },
      { id: "sub-2", status: "pending", acceptedAt: null },
    ];
    const requestedIds = ["sub-1", "sub-2"];
    const { db, updateCalls } = fakeDb(existingRows, requestedIds);

    const result = await updateSubmissionStatuses(db, "event-1", requestedIds, "declined", new Date());

    expect(result.updated).toBe(2);
    expect(updateCalls.length).toBeGreaterThan(0);
    for (const call of updateCalls) {
      expect(call.table).toBe(schema.submission);
    }
  });

  it("tolerates duplicated valid ids in the request without a false 'missing' error", async () => {
    const existingRows: FakeRow[] = [{ id: "sub-1", status: "pending", acceptedAt: null }];
    const requestedIds = ["sub-1", "sub-1", "sub-1"];
    const { db } = fakeDb(existingRows, requestedIds);

    const result = await updateSubmissionStatuses(db, "event-1", requestedIds, "declined", new Date());

    expect(result.updated).toBe(1);
  });
});
