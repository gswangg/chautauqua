// DEC-530 (wave 48 amendment): the portal /tasks page must resolve its
// version chains, comment threads, and linked-deliverable filenames with a
// query count proportional to chain DEPTH (or a small constant), never to
// the number of file_request assignments or deliverable candidates on the
// page. This drives the new batched readers (resolveTaskFileChainLatestMany,
// listFileChainVersionsMany, listFileCommentsForFiles) against a real
// (filtering) fake db and asserts both (a) the query count stays flat as
// the number of chains/assignments grows and (b) the produced values match
// what the pre-change PER-ID singular functions (resolveTaskFileChainLatest,
// listFileChainVersions, listFileComments) return for the exact same data —
// same shape, byte-identical field values.

import { describe, expect, it } from "vitest";
import * as schema from "../src/db/schema";
import type { Db } from "../src/server/context";
import {
  listFileChainVersions,
  listFileChainVersionsMany,
  resolveTaskFileChainLatest,
  resolveTaskFileChainLatestMany,
} from "../src/server/repo/files-versions";
import { listFileComments, listFileCommentsForFiles } from "../src/server/repo/files-comments";

// -----------------------------------------------------------------------
// Fake db: real WHERE filtering (not a canned-response stub) — extracts
// eq()/inArray() predicates out of the actual drizzle condition tree and
// applies them to an in-memory row set, keyed by the column's PHYSICAL sql
// name (snake_case), same technique as test/agenda-repo.test.ts.
// -----------------------------------------------------------------------

function extractPredicates(node: unknown): { col: string; val: unknown }[] {
  const seen = new Set<unknown>();
  const predicates: { col: string; val: unknown }[] = [];
  let currentCol: string | null = null;
  function walk(n: unknown): void {
    if (n === null || typeof n !== "object") return;
    if (seen.has(n)) return;
    seen.add(n);
    const rec = n as Record<string, unknown>;
    const ctorName = (n as { constructor?: { name?: string } }).constructor?.name;
    if (ctorName === "SQLiteText" || ctorName === "SQLiteInteger") {
      if (typeof rec.name === "string") {
        currentCol = rec.name;
        return;
      }
    }
    if (ctorName === "Param") {
      if (currentCol) predicates.push({ col: currentCol, val: (rec as { value: unknown }).value });
      return;
    }
    if (ctorName === "StringChunk") {
      const v = (rec.value as unknown[] | undefined)?.[0];
      if (typeof v === "string" && v.includes(" and ")) currentCol = null;
      return;
    }
    if (Array.isArray(n)) {
      for (const c of n) walk(c);
      return;
    }
    if (Array.isArray(rec.queryChunks)) {
      for (const c of rec.queryChunks) walk(c);
    }
  }
  walk(node);
  return predicates;
}

function filterByCondition<T extends Record<string, unknown>>(rows: T[], cond: unknown): T[] {
  const predicates = extractPredicates(cond);
  const byCol = new Map<string, unknown[]>();
  for (const p of predicates) {
    const arr = byCol.get(p.col) ?? [];
    arr.push(p.val);
    byCol.set(p.col, arr);
  }
  return rows.filter((row) => {
    for (const [col, vals] of byCol) {
      if (!vals.includes(row[col])) return false;
    }
    return true;
  });
}

interface FakeTables {
  file: Record<string, unknown>[];
  file_comment: Record<string, unknown>[];
  contact: Record<string, unknown>[];
  user: Record<string, unknown>[];
}

function tableName(table: unknown): keyof FakeTables {
  if (table === schema.file) return "file";
  if (table === schema.fileComment) return "file_comment";
  if (table === schema.contact) return "contact";
  if (table === schema.user) return "user";
  throw new Error("makeCountingDb: unexpected table in fake db");
}

/** Projects a raw (physical-column-keyed) row onto the JS-alias shape a real
 * drizzle `.select({...})` call returns, using each selected column's own
 * `.name` (physical sql name) to look up the source field. */
function project(row: Record<string, unknown>, cols: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, col] of Object.entries(cols)) {
    const physicalName = (col as { name?: string }).name;
    // listFileComments' count(*) select has no real column — count is
    // computed over the already-filtered row set below instead.
    if (!physicalName) continue;
    out[key] = row[physicalName];
  }
  return out;
}

/** count(*) projections (listFileComments' total) select no real column, so
 * they need the row COUNT rather than a per-row field lookup. */
function isCountQuery(cols: Record<string, unknown>): boolean {
  return Object.keys(cols).length === 1 && "count" in cols && !(cols.count as { name?: string })?.name;
}

/** Every top-level `.where(...)` call is the genuine D1 round trip this test
 * counts — mirrors test/portal-home-roundtrips.test.ts's convention. */
function makeCountingDb(data: FakeTables): { db: Db; queryCount: () => number } {
  let count = 0;
  const db = {
    select: (cols: Record<string, unknown>) => ({
      from: (table: unknown) => {
        const rows = data[tableName(table)];
        return {
          where: (cond: unknown) => {
            count += 1;
            const matched = filterByCondition(rows, cond);
            const filtered = isCountQuery(cols) ? [{ count: matched.length }] : matched.map((row) => project(row, cols));
            return {
              orderBy: () => Promise.resolve(filtered),
              limit: () => Promise.resolve(filtered),
              then: (resolve: (v: unknown[]) => void, reject?: (e: unknown) => void) =>
                Promise.resolve(filtered).then(resolve, reject),
            };
          },
        };
      },
    }),
  } as unknown as Db;
  return { db, queryCount: () => count };
}

// -----------------------------------------------------------------------
// Fixture: two independent version chains — f1 -> f2 -> f3 (3 versions) and
// f4 -> f5 (2 versions) — plus comments scattered across every link of
// both chains, and a contact to resolve author names against.
// -----------------------------------------------------------------------

function makeChainData(): FakeTables {
  const t = (ms: number) => new Date(ms);
  return {
    file: [
      { id: "f1", previous_file_id: null, filename: "slides-v1.pdf", content_type: "application/pdf", r2_key: "k1", version_no: 1, created_at: t(1000) },
      { id: "f2", previous_file_id: "f1", filename: "slides-v2.pdf", content_type: "application/pdf", r2_key: "k2", version_no: 2, created_at: t(2000) },
      { id: "f3", previous_file_id: "f2", filename: "slides-v3.pdf", content_type: "application/pdf", r2_key: "k3", version_no: 3, created_at: t(3000) },
      { id: "f4", previous_file_id: null, filename: "poster-v1.pdf", content_type: "application/pdf", r2_key: "k4", version_no: 1, created_at: t(4000) },
      { id: "f5", previous_file_id: "f4", filename: "poster-v2.pdf", content_type: "application/pdf", r2_key: "k5", version_no: 2, created_at: t(5000) },
    ],
    file_comment: [
      { id: "c1", file_id: "f1", author_contact_id: "ct-1", author_user_id: null, body: "first note", created_at: t(1500) },
      { id: "c2", file_id: "f2", author_contact_id: "ct-1", author_user_id: null, body: "second note", created_at: t(2500) },
      { id: "c3", file_id: "f3", author_contact_id: "ct-1", author_user_id: null, body: "third note", created_at: t(3500) },
      { id: "c4", file_id: "f4", author_contact_id: "ct-1", author_user_id: null, body: "poster note", created_at: t(4500) },
    ],
    contact: [{ id: "ct-1", first_name: "Ada", last_name: "Lovelace" }],
    user: [],
  };
}

describe("DEC-530 (wave 48): resolveTaskFileChainLatestMany", () => {
  it("resolves the chain-latest for every seed id with a query count that does NOT grow with the number of chains", () => {
    return (async () => {
      const twoChains = makeCountingDb(makeChainData());
      const many = await resolveTaskFileChainLatestMany(twoChains.db, ["f1", "f4"]);
      expect(many.get("f1")).toEqual({ id: "f3", filename: "slides-v3.pdf", contentType: "application/pdf", r2Key: "k3", createdAt: 3000 });
      expect(many.get("f4")).toEqual({ id: "f5", filename: "poster-v2.pdf", contentType: "application/pdf", r2Key: "k5", createdAt: 5000 });

      // Bounded by chain depth (max 3 hops) + a constant, not by chain count.
      const twoChainCount = twoChains.queryCount();
      expect(twoChainCount).toBeLessThanOrEqual(5);

      // Adding many more same-depth chains must not raise the query count.
      const manyChainsData = makeChainData();
      for (let i = 0; i < 50; i++) {
        manyChainsData.file.push({ id: `g${i}`, previous_file_id: null, filename: `x${i}.pdf`, content_type: "application/pdf", r2_key: `kg${i}`, version_no: 1, created_at: new Date(9000 + i) });
      }
      const manyChains = makeCountingDb(manyChainsData);
      const seeds = ["f1", "f4", ...Array.from({ length: 50 }, (_, i) => `g${i}`)];
      await resolveTaskFileChainLatestMany(manyChains.db, seeds);
      expect(manyChains.queryCount()).toBe(twoChainCount);
    })();
  });

  it("matches the singular resolveTaskFileChainLatest for the same seed, byte-identical shape", async () => {
    const singularDb = makeCountingDb(makeChainData());
    const singular = await resolveTaskFileChainLatest(singularDb.db, "f1");

    const manyDb = makeCountingDb(makeChainData());
    const many = await resolveTaskFileChainLatestMany(manyDb.db, ["f1"]);

    expect(many.get("f1")).toEqual(singular);
  });

  it("returns an empty map for an empty input with no queries issued", async () => {
    const { db, queryCount } = makeCountingDb(makeChainData());
    const many = await resolveTaskFileChainLatestMany(db, []);
    expect(many.size).toBe(0);
    expect(queryCount()).toBe(0);
  });
});

describe("DEC-530 (wave 48): listFileChainVersionsMany", () => {
  it("resolves the full oldest-first chain for every seed id, matching listFileChainVersions exactly", async () => {
    const singularDb = makeCountingDb(makeChainData());
    const singularChain = await listFileChainVersions(singularDb.db, "f2"); // seeded from a MIDDLE link

    const manyDb = makeCountingDb(makeChainData());
    const many = await listFileChainVersionsMany(manyDb.db, ["f2"]);

    expect(many.get("f2")).toEqual(singularChain);
    expect(many.get("f2")).toEqual([
      { id: "f1", filename: "slides-v1.pdf", contentType: "application/pdf", r2Key: "k1", createdAt: 1000, versionNo: 1 },
      { id: "f2", filename: "slides-v2.pdf", contentType: "application/pdf", r2Key: "k2", createdAt: 2000, versionNo: 2 },
      { id: "f3", filename: "slides-v3.pdf", contentType: "application/pdf", r2Key: "k3", createdAt: 3000, versionNo: 3 },
    ]);
  });

  it("query count does not grow with the number of chains requested", async () => {
    const twoChains = makeCountingDb(makeChainData());
    await listFileChainVersionsMany(twoChains.db, ["f1", "f4"]);
    const twoChainCount = twoChains.queryCount();
    expect(twoChainCount).toBeLessThanOrEqual(6);

    const manyChainsData = makeChainData();
    for (let i = 0; i < 50; i++) {
      manyChainsData.file.push({ id: `g${i}`, previous_file_id: null, filename: `x${i}.pdf`, content_type: "application/pdf", r2_key: `kg${i}`, version_no: 1, created_at: new Date(9000 + i) });
    }
    const manyChains = makeCountingDb(manyChainsData);
    const seeds = ["f1", "f4", ...Array.from({ length: 50 }, (_, i) => `g${i}`)];
    await listFileChainVersionsMany(manyChains.db, seeds);
    expect(manyChains.queryCount()).toBe(twoChainCount);
  });
});

describe("DEC-530 (wave 48): listFileCommentsForFiles", () => {
  it("groups comments per exact input file id, resolvable author name included, one query per data source", async () => {
    const { db, queryCount } = makeCountingDb(makeChainData());
    const byFileId = await listFileCommentsForFiles(db, ["f1", "f2", "f3"]);

    expect(byFileId.get("f1")?.map((c) => c.body)).toEqual(["first note"]);
    expect(byFileId.get("f2")?.map((c) => c.body)).toEqual(["second note"]);
    expect(byFileId.get("f3")?.map((c) => c.body)).toEqual(["third note"]);
    expect(byFileId.get("f1")?.[0]).toMatchObject({ authorName: "Ada Lovelace", versionNumber: 1 });

    // versionNo lookup + comment fetch + author/contact resolution — a small
    // constant, not one query per file id in the set.
    expect(queryCount()).toBeLessThanOrEqual(4);
  });

  it("a file id with no comments maps to an empty array, not a missing key", async () => {
    const { db } = makeCountingDb(makeChainData());
    const byFileId = await listFileCommentsForFiles(db, ["f5"]); // poster v2, no comment
    expect(byFileId.get("f5")).toEqual([]);
  });

  it("flattening + re-sorting a chain's per-link buckets reproduces listFileComments' chain-wide thread", async () => {
    const singularDb = makeCountingDb(makeChainData());
    const singular = await listFileComments(singularDb.db, "f3"); // chain-latest anchor, like the route uses

    const manyDb = makeCountingDb(makeChainData());
    const byFileId = await listFileCommentsForFiles(manyDb.db, ["f1", "f2", "f3"]);
    const flattened = ["f1", "f2", "f3"]
      .flatMap((id) => byFileId.get(id) ?? [])
      .sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id));

    expect(flattened).toEqual(singular.items);
  });
});
