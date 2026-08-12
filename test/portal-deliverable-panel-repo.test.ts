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

type Marker =
  | { __marker: "eq"; col: unknown; val: unknown }
  | { __marker: "inArray"; col: unknown; vals: unknown[] };

vi.mock("drizzle-orm", async (importOriginal) => {
  const actual = await importOriginal<typeof import("drizzle-orm")>();
  return {
    ...actual,
    eq: (col: unknown, val: unknown): Marker => ({ __marker: "eq", col, val }),
    inArray: (col: unknown, vals: unknown[]): Marker => ({ __marker: "inArray", col, vals }),
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
      let whereCond: { __marker: "eq"; col: unknown; val: unknown } | null = null;
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
        where: (cond: { __marker: "eq"; col: unknown; val: unknown }) => {
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
// view uses, AND (DEC-573) that the whole version chain's comments survive a
// re-upload no matter which link in the chain the reader opens.
// ---------------------------------------------------------------------------

type TableKey = "file" | "fileComment" | "user" | "contact";

const TABLE_SCHEMAS: Record<TableKey, object> = {
  file: schema.file,
  fileComment: schema.fileComment,
  user: schema.user,
  contact: schema.contact,
};

function tableKeyFor(tableRef: unknown): TableKey {
  for (const [key, obj] of Object.entries(TABLE_SCHEMAS)) {
    if (obj === tableRef) return key as TableKey;
  }
  throw new Error("fake db: unknown table reference");
}

function matchesCond(row: Record<string, unknown>, cond: Marker | null, schemaObj: object): boolean {
  if (!cond) return true;
  const key = colKeyIn(schemaObj, cond.col);
  if (!key) throw new Error("fake db: condition referenced a column not on this table");
  if (cond.__marker === "eq") return row[key] === cond.val;
  return (cond as { vals: unknown[] }).vals.includes(row[key]);
}

function project(rows: Record<string, unknown>[], fields: Record<string, unknown> | undefined, schemaObj: object) {
  if (!fields) return rows.map((r) => ({ ...r }));
  return rows.map((r) => {
    const out: Record<string, unknown> = {};
    for (const [outKey, col] of Object.entries(fields)) {
      const key = colKeyIn(schemaObj, col);
      out[outKey] = key ? r[key] : undefined;
    }
    return out;
  });
}

/** Chain-aware fake DB: real tables (file/fileComment/user/contact), real
 * eq/inArray-shaped where clauses evaluated in JS, `.limit()` for
 * listFileChainIds' walk and `count(*)` aggregate detection (by field key
 * `count`) for listFileComments' total. */
function makeChainDb(data: Record<TableKey, Record<string, unknown>[]>) {
  return {
    insert(table: unknown) {
      const key = tableKeyFor(table);
      return {
        values: async (row: Record<string, unknown>) => {
          data[key].push(row);
        },
      };
    },
    select(fields?: Record<string, unknown>) {
      let tableRef: unknown;
      let whereCond: Marker | null = null;
      const run = () => {
        const key = tableKeyFor(tableRef);
        const schemaObj = TABLE_SCHEMAS[key];
        const rows = data[key].filter((r) => matchesCond(r, whereCond, schemaObj));
        if (fields && "count" in fields) return [{ count: rows.length }];
        return project(rows, fields, schemaObj);
      };
      const chain: any = {
        from: (t: unknown) => {
          tableRef = t;
          return chain;
        },
        where: (cond: Marker) => {
          whereCond = cond;
          return chain;
        },
        orderBy: () => chain,
        limit: async (n: number) => run().slice(0, n),
        then: (resolve: (v: unknown[]) => void, reject: (e: unknown) => void) => {
          try {
            resolve(run());
          } catch (e) {
            reject(e);
          }
        },
      };
      return chain;
    },
  } as unknown as AppEnv["Variables"]["db"];
}

function fileRow(id: string, previousFileId: string | null, createdAt: string) {
  return {
    id,
    previousFileId,
    filename: `${id}.pdf`,
    contentType: "application/pdf",
    r2Key: `sub/${id}.pdf`,
    createdAt: new Date(createdAt),
  };
}

describe("insertFileComment + listFileComments round trip (DEC-244 'one thread, two surfaces')", () => {
  it("a speaker-authored comment carries both author ids and is visible via listFileComments", async () => {
    const CONTACT_A = "contact-a";
    const FILE_ID = "file-latest-1";
    const db = makeChainDb({
      file: [fileRow(FILE_ID, null, "2026-01-01T00:00:00Z")],
      fileComment: [],
      user: [{ id: "u1", email: "speaker@example.com", role: "speaker", contactId: CONTACT_A }],
      contact: [{ id: CONTACT_A, firstName: "Sam", lastName: "Speaker" }],
    });

    await insertFileComment(db, {
      fileId: FILE_ID,
      body: "Here is v2.",
      authorUserId: "u1",
      authorContactId: CONTACT_A,
    });

    const result = await listFileComments(db, FILE_ID);
    expect(result.items).toHaveLength(1);
    expect(result.total).toBe(1);
    expect(result.items[0]).toMatchObject({
      body: "Here is v2.",
      authorName: "Sam Speaker",
      authorRole: "speaker",
      versionNumber: 1,
    });
  });
});

// ---------------------------------------------------------------------------
// DEC-573: comment thread survives re-uploads (walks the whole chain)
// ---------------------------------------------------------------------------

describe("listFileComments across a version chain (DEC-573)", () => {
  function buildThreeLinkChain() {
    const db = makeChainDb({
      file: [
        fileRow("file-v1", null, "2026-01-01T00:00:00Z"),
        fileRow("file-v2", "file-v1", "2026-01-02T00:00:00Z"),
        fileRow("file-v3", "file-v2", "2026-01-03T00:00:00Z"),
      ],
      fileComment: [
        {
          id: "c1",
          fileId: "file-v1",
          authorUserId: null,
          authorContactId: null,
          body: "Comment on v1",
          createdAt: new Date("2026-01-01T01:00:00Z"),
        },
        {
          id: "c2",
          fileId: "file-v3",
          authorUserId: null,
          authorContactId: null,
          body: "Comment on v3",
          createdAt: new Date("2026-01-03T01:00:00Z"),
        },
      ],
      user: [],
      contact: [],
    });
    return db;
  }

  it("returns comments from every link in the chain, oldest first, with correct versionNumbers, no matter which link is opened", async () => {
    for (const openId of ["file-v1", "file-v2", "file-v3"]) {
      const db = buildThreeLinkChain();
      const result = await listFileComments(db, openId);
      expect(result.items.map((c) => c.body)).toEqual(["Comment on v1", "Comment on v3"]);
      expect(result.items.map((c) => c.versionNumber)).toEqual([1, 3]);
      expect(result.total).toBe(2);
    }
  });

  it("total is the true chain-wide count even when a page limit truncates items", async () => {
    const db = buildThreeLinkChain();
    const result = await listFileComments(db, "file-v3", { limit: 1, offset: 0 });
    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.body).toBe("Comment on v1");
    expect(result.total).toBe(2);
    expect(result.page).toBe(1);
    expect(result.perPage).toBe(1);
  });

  it("throws loudly on a previous_file_id cycle instead of looping forever", async () => {
    const db = makeChainDb({
      file: [
        { ...fileRow("file-a", "file-b", "2026-01-01T00:00:00Z") },
        { ...fileRow("file-b", "file-a", "2026-01-01T00:00:00Z") },
      ],
      fileComment: [],
      user: [],
      contact: [],
    });
    await expect(listFileComments(db, "file-a")).rejects.toThrow(/cycle/);
  });
});
