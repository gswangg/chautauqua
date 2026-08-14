// DEC-111 (wave-61 amendment): one shared unique-violation detector
// (src/server/repo/constraints.ts) used by both tasks/crud.ts and
// contacts/segments.ts, so a colliding segment rename no longer 500s.

import { describe, expect, it } from "vitest";
import { isUniqueViolation } from "../src/server/repo/constraints";
import { patchSegment } from "../src/server/repo/contacts/segments";
import { ApiError } from "../src/server/http";
import type { Db } from "../src/server/context";

describe("isUniqueViolation (src/server/repo/constraints.ts)", () => {
  it("matches a raw Error thrown directly", () => {
    const err = new Error("UNIQUE constraint failed: segment.org_id, segment.name");
    expect(isUniqueViolation(err, "segment")).toBe(true);
  });

  it("matches when the message is carried on err.cause (driver-wrapped)", () => {
    const cause = new Error("UNIQUE constraint failed: task.event_id, task.title");
    const wrapped = new Error("D1_ERROR", { cause });
    expect(isUniqueViolation(wrapped, "task.title")) .toBe(true);
  });

  it("rejects an unrelated error", () => {
    const err = new Error("some other failure");
    expect(isUniqueViolation(err, "segment")).toBe(false);
  });

  it("rejects a UNIQUE violation whose message doesn't contain the fragment", () => {
    const err = new Error("UNIQUE constraint failed: task.event_id, task.title");
    expect(isUniqueViolation(err, "segment")).toBe(false);
  });

  it("rejects non-Error candidates", () => {
    expect(isUniqueViolation("UNIQUE constraint failed: segment.name", "segment")).toBe(false);
    expect(isUniqueViolation(undefined, "segment")).toBe(false);
  });
});

function makeFakeDb(row: { id: string; name: string }, throwErr: unknown): Db {
  return {
    update: () => ({
      set: () => ({
        where: async () => {
          throw throwErr;
        },
      }),
    }),
    select: () => ({
      from: () => ({
        where: () => ({
          limit: async () => [{ ...row, orgId: "org-a", rulesJson: "[]", createdAt: new Date(), updatedAt: new Date() }],
        }),
      }),
    }),
  } as unknown as Db;
}

describe("patchSegment (src/server/repo/contacts/segments.ts) rename collision", () => {
  it("raises ApiError('invalid') with the name field for a raw UNIQUE-violation Error", async () => {
    const db = makeFakeDb({ id: "seg-1", name: "Keynote speakers" }, new Error("UNIQUE constraint failed: segment.org_id, segment.name"));
    await expect(patchSegment(db, "seg-1", { name: "Keynote speakers" })).rejects.toMatchObject({
      code: "invalid",
      fields: { name: "A segment with this name already exists" },
    });
  });

  it("raises ApiError('invalid') with the name field when the driver wraps the error as .cause", async () => {
    const cause = new Error("UNIQUE constraint failed: segment.org_id, segment.name");
    const db = makeFakeDb({ id: "seg-1", name: "Keynote speakers" }, new Error("D1_ERROR", { cause }));
    await expect(patchSegment(db, "seg-1", { name: "Keynote speakers" })).rejects.toMatchObject({
      code: "invalid",
      fields: { name: "A segment with this name already exists" },
    });
    try {
      await patchSegment(db, "seg-1", { name: "Keynote speakers" });
      expect.unreachable("expected patchSegment to throw");
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
    }
  });

  it("re-throws an unrelated error unchanged", async () => {
    const db = makeFakeDb({ id: "seg-1", name: "Keynote speakers" }, new Error("disk I/O error"));
    await expect(patchSegment(db, "seg-1", { name: "Keynote speakers" })).rejects.toThrow("disk I/O error");
  });
});
