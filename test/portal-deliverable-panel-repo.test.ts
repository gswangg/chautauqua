// DEC-244 coverage (task w2-a), repo layer only: resolveTaskFileChainLatest
// exercised against an in-memory fake DB that evaluates real drizzle eq()
// conditions (pattern from test/files-library.test.ts) — proves the
// forward-walk actually finds an organizer-side replacement the
// assignment's stored file id doesn't point at. Also proves a
// speaker-authored file_comment (authorContactId + authorUserId both set)
// is visible via listFileComments — the same read the organizer
// DeliverableDetail view uses (DEC-244 "one thread, two surfaces").
//
// Kept in its own file (not test/portal-deliverable-panel.test.ts) because
// that file's route-level tests vi.mock("../src/server/repo/files") — since
// vi.mock is hoisted per-file, the two styles (real functions vs. mocked
// module) can't coexist in one spec file.

import { describe, expect, it, vi } from "vitest";
import type { AppEnv } from "../src/server/env";
import * as schema from "../src/db/schema";

type Marker = { __marker: "eq"; col: unknown; val: unknown };

vi.mock("drizzle-orm", async (importOriginal) => {
  const actual = await importOriginal<typeof import("drizzle-orm")>();
  return {
    ...actual,
    eq: (col: unknown, val: unknown): Marker => ({ __marker: "eq", col, val }),
  };
});

const { resolveTaskFileChainLatest, insertFileComment, listFileComments } = await import("../src/server/repo/files");

function colKeyIn(tableObj: object, col: unknown): string | undefined {
  return Object.entries(tableObj).find(([, v]) => v === col)?.[0];
}

function colKey(col: unknown): string {
  const key = colKeyIn(schema.file, col);
  if (!key) throw new Error("fake db: condition referenced a column not on schema.file");
  return key;
}

function makeFakeFileDb(rows: Record<string, unknown>[]) {
  const db = {
    select(fields?: Record<string, unknown>) {
      let whereCond: Marker | null = null;
      const run = () => {
        const filtered = whereCond ? rows.filter((r) => r[colKey(whereCond!.col)] === whereCond!.val) : rows.slice();
        return fields
          ? filtered.map((r) => {
              const out: Record<string, unknown> = {};
              for (const [outKey, col] of Object.entries(fields)) out[outKey] = r[colKey(col)];
              return out;
            })
          : filtered.map((r) => ({ ...r }));
      };
      const chain: any = {
        from: () => chain,
        where: (cond: Marker) => {
          whereCond = cond;
          return chain;
        },
        limit: async (n: number) => run().slice(0, n),
      };
      return chain;
    },
  };
  return db as unknown as AppEnv["Variables"]["db"];
}

describe("resolveTaskFileChainLatest (DEC-244)", () => {
  it("returns the file itself when it has no forward link", async () => {
    const db = makeFakeFileDb([
      {
        id: "file-only",
        filename: "slides.pdf",
        contentType: "application/pdf",
        r2Key: "task/a1/slides.pdf",
        previousFileId: null,
        createdAt: new Date("2026-01-01T00:00:00Z"),
      },
    ]);
    const latest = await resolveTaskFileChainLatest(db, "file-only");
    expect(latest).toMatchObject({ id: "file-only", filename: "slides.pdf" });
  });

  it("walks forward through an organizer-side replacement the assignment's stored file id doesn't point at", async () => {
    const db = makeFakeFileDb([
      {
        id: "file-v1",
        filename: "slides-v1.pdf",
        contentType: "application/pdf",
        r2Key: "task/a1/slides-v1.pdf",
        previousFileId: null,
        createdAt: new Date("2026-01-01T00:00:00Z"),
      },
      {
        id: "file-v2",
        filename: "slides-v2.pdf",
        contentType: "application/pdf",
        r2Key: "sub/sub-1/slides-v2.pdf",
        previousFileId: "file-v1",
        createdAt: new Date("2026-01-02T00:00:00Z"),
      },
    ]);
    // assignment.file_id is still "file-v1" (never rewritten by the
    // organizer-side submission-files replace) — resolution must still find
    // file-v2.
    const latest = await resolveTaskFileChainLatest(db, "file-v1");
    expect(latest).toMatchObject({ id: "file-v2", filename: "slides-v2.pdf", r2Key: "sub/sub-1/slides-v2.pdf" });
  });

  it("throws loudly on a missing chain-latest row (data corruption)", async () => {
    const db = makeFakeFileDb([]);
    await expect(resolveTaskFileChainLatest(db, "file-missing")).rejects.toThrow(/not found/);
  });
});

// ---------------------------------------------------------------------------
// insertFileComment / listFileComments round trip (real functions, fake db)
// — proves a portal-authored comment (authorContactId + authorUserId set)
// renders through the same listFileComments the organizer DeliverableDetail
// view uses.
// ---------------------------------------------------------------------------

describe("insertFileComment + listFileComments round trip (DEC-244 'one thread, two surfaces')", () => {
  it("a speaker-authored comment carries both author ids and is visible via listFileComments", async () => {
    const CONTACT_A = "contact-a";
    const FILE_ID = "file-latest-1";
    const commentRows: Record<string, unknown>[] = [];
    const userRows = [{ id: "u1", email: "speaker@example.com", role: "speaker", contactId: CONTACT_A }];
    const contactRows = [{ id: CONTACT_A, firstName: "Sam", lastName: "Speaker" }];

    const fakeDb = {
      insert(table: unknown) {
        return {
          values: async (row: Record<string, unknown>) => {
            if (table === schema.fileComment) commentRows.push(row);
          },
        };
      },
      select(fields: Record<string, unknown>) {
        let table: unknown = null;
        const chain: any = {
          from: (t: unknown) => {
            table = t;
            return chain;
          },
          where: () => chain,
          orderBy: () => chain,
          then: (resolve: (v: unknown[]) => void, reject: (e: unknown) => void) => {
            try {
              const tableObj =
                table === schema.fileComment ? schema.fileComment : table === schema.user ? schema.user : schema.contact;
              const source = table === schema.fileComment ? commentRows : table === schema.user ? userRows : contactRows;
              resolve(
                source.map((r) => {
                  const out: Record<string, unknown> = {};
                  for (const [outKey, col] of Object.entries(fields)) {
                    const key = colKeyIn(tableObj, col);
                    out[outKey] = key ? (r as Record<string, unknown>)[key] : undefined;
                  }
                  return out;
                }),
              );
            } catch (e) {
              reject(e);
            }
          },
        };
        return chain;
      },
    } as unknown as AppEnv["Variables"]["db"];

    await insertFileComment(fakeDb, {
      fileId: FILE_ID,
      body: "Here is v2.",
      authorUserId: "u1",
      authorContactId: CONTACT_A,
    });

    expect(commentRows).toHaveLength(1);
    expect(commentRows[0]).toMatchObject({ authorUserId: "u1", authorContactId: CONTACT_A, body: "Here is v2." });

    const comments = await listFileComments(fakeDb, FILE_ID);
    expect(comments).toHaveLength(1);
    expect(comments[0]).toMatchObject({ body: "Here is v2.", authorName: "Sam Speaker", authorRole: "speaker" });
  });
});
