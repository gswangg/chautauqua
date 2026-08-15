import { describe, expect, it } from "vitest";
import { canAccessFile, canAccessResourceFile, isValidContentStatus } from "../src/server/repo/files";
import { listFileComments } from "../src/server/repo/files-comments";
import * as schema from "../src/db/schema";
import type { Db } from "../src/server/context";

describe("canAccessFile", () => {
  const scope = { orgId: "org1", uploadedByContactId: "c1", readParticipantContactIds: ["c1", "c2"] };

  it("allows an organizer in the same org", () => {
    expect(canAccessFile({ role: "organizer", orgId: "org1" }, scope)).toBe(true);
  });

  it("denies an organizer from a different org", () => {
    expect(canAccessFile({ role: "organizer", orgId: "org2" }, scope)).toBe(false);
  });

  it("allows a speaker who is a participant", () => {
    expect(canAccessFile({ role: "speaker", orgId: "org1", contactId: "c2" }, scope)).toBe(true);
  });

  it("allows a speaker who is the uploader even if not currently a participant", () => {
    expect(canAccessFile({ role: "speaker", orgId: "org1", contactId: "c1" }, { ...scope, readParticipantContactIds: [] })).toBe(
      true,
    );
  });

  it("denies a speaker with no relation to the submission — no IDOR", () => {
    expect(canAccessFile({ role: "speaker", orgId: "org1", contactId: "c3" }, scope)).toBe(false);
  });

  it("denies a speaker session missing a contactId", () => {
    expect(canAccessFile({ role: "speaker", orgId: "org1" }, scope)).toBe(false);
  });

  it("denies a reviewer — DEC-020 doesn't name reviewers for this surface", () => {
    expect(canAccessFile({ role: "reviewer", orgId: "org1" }, scope)).toBe(false);
  });
});

describe("canAccessResourceFile (DEC-047 organizer-only resource-file authz)", () => {
  it("allows an organizer in the same org", () => {
    expect(canAccessResourceFile({ role: "organizer", orgId: "org1" }, { orgId: "org1" })).toBe(true);
  });

  it("denies an organizer from a different org — no cross-tenant leakage", () => {
    expect(canAccessResourceFile({ role: "organizer", orgId: "org2" }, { orgId: "org1" })).toBe(false);
  });

  it("denies a speaker — speakers use the dedicated /portal/resources/:id/download route", () => {
    expect(canAccessResourceFile({ role: "speaker", orgId: "org1" }, { orgId: "org1" })).toBe(false);
  });

  it("denies a reviewer", () => {
    expect(canAccessResourceFile({ role: "reviewer", orgId: "org1" }, { orgId: "org1" })).toBe(false);
  });
});

describe("isValidContentStatus", () => {
  it("accepts the three DEC-003 content_status literals", () => {
    expect(isValidContentStatus("pending")).toBe(true);
    expect(isValidContentStatus("approved")).toBe(true);
    expect(isValidContentStatus("changes_requested")).toBe(true);
  });

  it("rejects anything else, including internal submission-status literals", () => {
    expect(isValidContentStatus("accepted")).toBe(false);
    expect(isValidContentStatus(undefined)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// listFileComments (DEC-686): a paged read must touch only the page — one
// query against the comment table, not a full-chain scan sliced in JS.
// This repo has no local sqlite/D1 test driver (see test/migration-
// parity.test.ts and test/comms-batched-lookups.test.ts's sibling comment),
// so this fake db dispatches on the real schema table object passed to
// .from() and interprets the drizzle condition tree well enough to filter
// rows by the bound id/fileId literals.
// ---------------------------------------------------------------------------

function collectLiteralValues(node: unknown, seen = new Set<unknown>(), out: Set<string> = new Set()): Set<string> {
  if (typeof node === "string") {
    out.add(node);
    return out;
  }
  if (node === null || typeof node !== "object" || seen.has(node)) return out;
  seen.add(node);
  if (Array.isArray(node)) {
    for (const c of node) collectLiteralValues(c, seen, out);
    return out;
  }
  const n = node as Record<string, unknown>;
  if (typeof n.value === "string") out.add(n.value);
  if (Array.isArray(n.value)) {
    for (const v of n.value) {
      if (typeof v === "string") out.add(v);
      else collectLiteralValues(v, seen, out);
    }
  }
  if (Array.isArray(n.queryChunks)) collectLiteralValues(n.queryChunks, seen, out);
  return out;
}

interface FakeFileRow {
  id: string;
  previousFileId: string | null;
  versionNo: number;
}
interface FakeCommentRow {
  id: string;
  fileId: string;
  body: string;
  createdAt: Date;
  authorUserId: string | null;
}

function orderedResult(rows: FakeCommentRow[]) {
  return {
    limit(n: number) {
      return {
        offset(m: number) {
          return Promise.resolve(rows.slice(m, m + n));
        },
      };
    },
    then(resolve: (v: FakeCommentRow[]) => void, reject?: (e: unknown) => void) {
      return Promise.resolve(rows).then(resolve, reject);
    },
  };
}

function makeFilesCommentsDb(params: { fileRows: FakeFileRow[]; commentRows: FakeCommentRow[] }) {
  let commentSelectCalls = 0;
  const fileById = new Map(params.fileRows.map((f) => [f.id, f]));
  const fileByPrevious = new Map(
    params.fileRows.filter((f) => f.previousFileId).map((f) => [f.previousFileId as string, f]),
  );

  const db = {
    select(proj: Record<string, unknown>) {
      const keys = Object.keys(proj);
      return {
        from(table: unknown) {
          if (table === schema.file) {
            if (keys.length === 1 && keys[0] === "previousFileId") {
              return {
                where(cond: unknown) {
                  // Match against known ids rather than trusting literal
                  // insertion order — collectLiteralValues also picks up
                  // raw SQL text fragments (e.g. "" and " = ") which aren't
                  // bound param values.
                  const literals = collectLiteralValues(cond);
                  const id = [...fileById.keys()].find((k) => literals.has(k));
                  const row = id ? fileById.get(id) : undefined;
                  return { limit: async () => (row ? [{ previousFileId: row.previousFileId }] : []) };
                },
              };
            }
            if (keys.length === 1 && keys[0] === "id") {
              return {
                where(cond: unknown) {
                  const literals = collectLiteralValues(cond);
                  const prev = [...fileByPrevious.keys()].find((k) => literals.has(k));
                  const row = prev ? fileByPrevious.get(prev) : undefined;
                  return { limit: async () => (row ? [{ id: row.id }] : []) };
                },
              };
            }
            if (keys.length === 2 && keys.includes("id") && keys.includes("versionNo")) {
              // DEC-818: batched version_no lookup for the whole chain.
              return {
                where(cond: unknown) {
                  const literals = collectLiteralValues(cond);
                  const rows = [...fileById.values()]
                    .filter((f) => literals.has(f.id))
                    .map((f) => ({ id: f.id, versionNo: f.versionNo }));
                  return Promise.resolve(rows);
                },
              };
            }
            throw new Error(`unexpected file select shape: ${keys.join(",")}`);
          }
          if (table === schema.fileComment) {
            commentSelectCalls += 1;
            if ("count" in proj) {
              return {
                where(cond: unknown) {
                  const ids = collectLiteralValues(cond);
                  const n = params.commentRows.filter((r) => ids.has(r.fileId)).length;
                  return { then: (resolve: (v: unknown) => void) => Promise.resolve([{ count: n }]).then(resolve) };
                },
              };
            }
            return {
              where(cond: unknown) {
                const ids = collectLiteralValues(cond);
                const rows = params.commentRows.filter((r) => ids.has(r.fileId));
                return {
                  orderBy() {
                    const sorted = [...rows].sort(
                      (a, b) => a.createdAt.getTime() - b.createdAt.getTime() || a.id.localeCompare(b.id),
                    );
                    return orderedResult(sorted);
                  },
                };
              },
            };
          }
          if (table === schema.user) {
            return {
              where() {
                return {
                  then: (resolve: (v: unknown) => void) =>
                    Promise.resolve([{ id: "u-author", email: "author@example.com", role: "organizer", contactId: null }]).then(
                      resolve,
                    ),
                };
              },
            };
          }
          if (table === schema.contact) {
            return {
              where() {
                return { then: (resolve: (v: unknown) => void) => Promise.resolve([]).then(resolve) };
              },
            };
          }
          throw new Error("unexpected table in fake db select");
        },
      };
    },
  };
  return { db: db as unknown as Db, getCommentSelectCalls: () => commentSelectCalls };
}

function chainOf5() {
  const fileRows: FakeFileRow[] = [
    { id: "f1", previousFileId: null, versionNo: 1 },
    { id: "f2", previousFileId: "f1", versionNo: 2 },
  ];
  const commentRows: FakeCommentRow[] = [
    { id: "c1", fileId: "f1", body: "one", createdAt: new Date(1000), authorUserId: "u-author" },
    { id: "c2", fileId: "f1", body: "two", createdAt: new Date(2000), authorUserId: "u-author" },
    { id: "c3", fileId: "f2", body: "three", createdAt: new Date(3000), authorUserId: "u-author" },
    { id: "c4", fileId: "f2", body: "four", createdAt: new Date(4000), authorUserId: "u-author" },
    { id: "c5", fileId: "f2", body: "five", createdAt: new Date(5000), authorUserId: "u-author" },
  ];
  return { fileRows, commentRows };
}

describe("listFileComments paging (DEC-686)", () => {
  it("page 2 of a 5-comment thread (perPage 2) returns exactly the expected two rows in createdAt order with the chain-wide total", async () => {
    const { fileRows, commentRows } = chainOf5();
    const { db } = makeFilesCommentsDb({ fileRows, commentRows });

    const result = await listFileComments(db, "f2", { limit: 2, offset: 2 });

    expect(result.total).toBe(5);
    expect(result.items.map((r) => r.id)).toEqual(["c3", "c4"]);
    expect(result.items.map((r) => r.body)).toEqual(["three", "four"]);
  });

  it("issues exactly one comment-table select for the page (plus one for the count), regardless of thread length", async () => {
    const { fileRows, commentRows } = chainOf5();
    const { db, getCommentSelectCalls } = makeFilesCommentsDb({ fileRows, commentRows });

    await listFileComments(db, "f2", { limit: 2, offset: 2 });

    // one count(*) select + one page-row select — not one per chain link.
    expect(getCommentSelectCalls()).toBe(2);
  });

  it("throws rather than silently paging within a chunk when the chain exceeds ID_CHUNK_SIZE", async () => {
    const fileRows: FakeFileRow[] = [{ id: "root", previousFileId: null, versionNo: 1 }];
    let prev = "root";
    for (let i = 0; i < 95; i++) {
      const id = `f${i}`;
      fileRows.push({ id, previousFileId: prev, versionNo: i + 2 });
      prev = id;
    }
    const { db } = makeFilesCommentsDb({ fileRows, commentRows: [] });

    await expect(listFileComments(db, prev, { limit: 2, offset: 0 })).rejects.toThrow(/ID_CHUNK_SIZE/);
  });
});
