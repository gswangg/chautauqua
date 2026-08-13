// DEC-159/160/344 coverage: the central files library repo query
// (listEventDeliverableFiles/resolveLatestVersions) is now server-paginated
// and server-filtered — one paginated statement over chain roots per page,
// plus bounded per-page hydration. Exercised against an in-memory fake DB
// that evaluates the actual drizzle where/join conditions the repo builds
// (no D1 test harness exists in this repo — same rationale as
// test/contacts-import.test.ts). eq/and/or/inArray/isNull are mocked to
// simple markers (pattern from the pre-DEC-344 version of this file); `sql`
// stays the real drizzle-orm tag so its queryChunks can be rendered and
// matched structurally for the LIKE/EXISTS/count(*) pieces.
//
// The archive route's authz/validation/ZIP-response wiring with a mocked
// repo + fake R2 bucket lives in test/files-archive-route.test.ts (kept
// separate: vi.mock("../src/server/repo/files") hoists file-wide there and
// would otherwise shadow the real repo functions exercised directly here).

import { describe, expect, it, vi } from "vitest";
import * as schema from "../src/db/schema";
import { ApiError } from "../src/server/http";
import type { EventFilesQuery } from "../src/server/repo/files-library";

type Marker =
  | { __marker: "eq"; col: unknown; val: unknown }
  | { __marker: "and"; conds: unknown[] }
  | { __marker: "or"; conds: unknown[] }
  | { __marker: "inArray"; col: unknown; vals: unknown[] }
  | { __marker: "isNull"; col: unknown }
  | { __marker: "isNotNull"; col: unknown };

vi.mock("drizzle-orm", async (importOriginal) => {
  const actual = await importOriginal<typeof import("drizzle-orm")>();
  return {
    ...actual,
    eq: (col: unknown, val: unknown): Marker => ({ __marker: "eq", col, val }),
    and: (...conds: unknown[]): Marker => ({ __marker: "and", conds }),
    or: (...conds: unknown[]): Marker => ({ __marker: "or", conds }),
    inArray: (col: unknown, vals: unknown[]): Marker => ({ __marker: "inArray", col, vals }),
    isNull: (col: unknown): Marker => ({ __marker: "isNull", col }),
    isNotNull: (col: unknown): Marker => ({ __marker: "isNotNull", col }),
  };
});

const { listEventDeliverableFiles, resolveLatestVersions } = await import("../src/server/repo/files-library");

const TABLE_SCHEMAS = {
  event: schema.event,
  submission: schema.submission,
  file: schema.file,
  participant: schema.participant,
  contact: schema.contact,
};

function colKey(col: unknown): string {
  for (const tableObj of Object.values(TABLE_SCHEMAS)) {
    for (const [key, value] of Object.entries(tableObj)) {
      if (value === col) return key;
    }
  }
  throw new Error("fake db: condition referenced a column not on a known table");
}

function isColumnRef(x: unknown): boolean {
  for (const tableObj of Object.values(TABLE_SCHEMAS)) {
    for (const value of Object.values(tableObj)) {
      if (value === x) return true;
    }
  }
  return false;
}

/** A raw table reference interpolated directly (`${schema.participant}` in
 * `from ${schema.participant} inner join ...`) — not a column, not a bind
 * param; only its identifier text matters for our structural matching, and
 * it must never be pushed into `params` (it isn't a LIKE/exists bind). */
function isTableRef(x: unknown): boolean {
  return Object.values(TABLE_SCHEMAS).includes(x as (typeof TABLE_SCHEMAS)[keyof typeof TABLE_SCHEMAS]);
}

function isSqlNode(x: unknown): x is { queryChunks: unknown[] } {
  return typeof x === "object" && x !== null && "queryChunks" in (x as Record<string, unknown>);
}

/** drizzle-orm's sql`` tag wraps each literal-text segment in a StringChunk
 * (constructor name "StringChunk", a `.value: string[]` array) rather than
 * a raw JS string — only the interpolated values are un-wrapped. */
function isStringChunk(x: unknown): x is { value: string[] } {
  return (
    typeof x === "object" &&
    x !== null &&
    x.constructor?.name === "StringChunk" &&
    Array.isArray((x as { value: unknown }).value)
  );
}

/** Renders a drizzle sql`` template's literal text with `?` in place of
 * bound params (prefixing column refs with `#colKey`), and returns the
 * collected params — enough to evaluate the small set of LIKE/EXISTS/COUNT
 * templates this repo module builds. */
function renderSql(node: { queryChunks: unknown[] }): { text: string; params: unknown[] } {
  let text = "";
  const params: unknown[] = [];
  for (const chunk of node.queryChunks) {
    // drizzle-orm's sql`` tag wraps each literal-text template segment in a
    // StringChunk (not a plain JS string) — a plain `string` chunk here is
    // always an interpolated *value*, not literal SQL text.
    if (isStringChunk(chunk)) {
      text += chunk.value.join("");
    } else if (isTableRef(chunk)) {
      text += "@table";
    } else if (isSqlNode(chunk)) {
      const inner = renderSql(chunk);
      text += inner.text;
      params.push(...inner.params);
    } else if (isColumnRef(chunk)) {
      text += `#${colKey(chunk)}`;
    } else {
      text += "?";
      params.push(chunk);
    }
  }
  return { text, params };
}

/** likeContains always wraps in %...% and escapes every \\/%/_ in the inner
 * text (DEC-333/335's likeContains), so after stripping the wrapper and
 * un-escaping, matching reduces to a literal substring test — this is what
 * proves the ESCAPE clause: a raw % or _ in the search term is matched as a
 * literal character, never as a SQL wildcard. */
function likeMatches(value: string, likePattern: string): boolean {
  const inner = likePattern.slice(1, -1);
  const literal = inner.replace(/\\(.)/g, "$1");
  return value.includes(literal);
}

/** Evaluates the sql`` shapes this module emits: a plain `lower(#col) like ?
 * escape '\'`, or the correlated EXISTS over participant/contact for
 * speaker-name matching, against a fully-joined row (file+submission
 * fields) plus the full participant/contact seed for the EXISTS case. */
function evalSqlNode(node: { queryChunks: unknown[] }, row: Record<string, unknown>, seed: Seed): boolean {
  const { text, params } = renderSql(node);
  if (text.includes("exists (select 1 from")) {
    const like = params[0] as string;
    // The merged file+submission row keeps file's own "id" on collision
    // (see innerJoin below), so submission.id isn't directly readable off
    // row["id"] — but row["submissionId"] (file.submission_id) is exactly
    // that value by construction of the join predicate itself.
    const submissionId = row["submissionId"] as string;
    return seed.participant.some((p) => {
      if (p.submissionId !== submissionId) return false;
      const contact = seed.contact.find((c) => c.id === p.contactId);
      if (!contact) return false;
      const name = `${contact.firstName} ${contact.lastName}`.toLowerCase();
      return likeMatches(name, like);
    });
  }
  const colMatch = text.match(/lower\(#(\w+)\)/);
  if (colMatch) {
    const key = colMatch[1]!;
    const value = String(row[key] ?? "").toLowerCase();
    const like = params[0] as string;
    return likeMatches(value, like);
  }
  throw new Error(`fake db: unsupported sql node: ${text}`);
}

function evalCond(cond: unknown, row: Record<string, unknown>, seed: Seed): boolean {
  if (isSqlNode(cond)) return evalSqlNode(cond, row, seed);
  const m = cond as Marker;
  if (m.__marker === "eq") {
    const right = isColumnRef(m.val) ? row[colKey(m.val)] : m.val;
    return row[colKey(m.col)] === right;
  }
  if (m.__marker === "and") return m.conds.every((c) => evalCond(c, row, seed));
  if (m.__marker === "or") return m.conds.some((c) => evalCond(c, row, seed));
  if (m.__marker === "inArray") return m.vals.includes(row[colKey(m.col)]);
  if (m.__marker === "isNull") return row[colKey(m.col)] == null;
  if (m.__marker === "isNotNull") return row[colKey(m.col)] != null;
  throw new Error(`fake db: unsupported condition ${JSON.stringify(cond)}`);
}

/** Resolves a join predicate's column operand against whichever row (the
 * freshly-joined `jRow`, checked first, or the accumulated `sRow`) actually
 * carries that column's key — the newly-joined table's own row is checked
 * first so its "id" is never shadowed by an accumulated row's "id" from an
 * earlier join (every table's PK is literally "id"). Key-based rather than
 * schema-membership-based so it stays correct across 3+-way join chains
 * (e.g. the headshot join's participant->submission->contact->file), where
 * a stale "the FROM table" reference would otherwise mis-resolve a
 * mid-chain table's column (DEC-773). */
function resolveJoinOperand(col: unknown, sRow: Record<string, unknown>, jRow: Record<string, unknown>): unknown {
  const key = colKey(col); // throws if `col` isn't a known column at all
  return key in jRow ? jRow[key] : sRow[key];
}

/** The headshot join's `${contact.headshotUrl} = '/headshots/' || ${file.id}`
 * predicate — the only sql`` join condition this module ever emits. */
function evalJoinSqlNode(node: { queryChunks: unknown[] }, sRow: Record<string, unknown>, jRow: Record<string, unknown>): boolean {
  const colChunks = node.queryChunks.filter((c) => isColumnRef(c));
  if (colChunks.length !== 2) throw new Error("fake db: unsupported join sql node");
  const left = resolveJoinOperand(colChunks[0], sRow, jRow);
  const right = resolveJoinOperand(colChunks[1], sRow, jRow);
  return left === `/headshots/${String(right)}`;
}

function evalJoinCond(cond: unknown, sRow: Record<string, unknown>, jRow: Record<string, unknown>): boolean {
  if (isSqlNode(cond)) return evalJoinSqlNode(cond, sRow, jRow);
  const m = cond as Marker;
  if (m.__marker !== "eq") throw new Error("fake db: only eq join predicates supported");
  const left = resolveJoinOperand(m.col, sRow, jRow);
  const right = resolveJoinOperand(m.val, sRow, jRow);
  return left === right;
}

function project(row: Record<string, unknown>, fields: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  for (const [outKey, col] of Object.entries(fields)) {
    out[outKey] = isColumnRef(col) ? row[colKey(col)] : row[outKey];
  }
  return out;
}

function isCountStarFields(fields: Record<string, unknown> | undefined): boolean {
  if (!fields || Object.keys(fields).length !== 1) return false;
  return isSqlNode(fields.count);
}

/** `count(distinct <col>)` — DEC-680's headshot-branch total. Dedupes by
 * the referenced column's value rather than falling back to matched.length
 * (which the plain `count(*)` branch above uses). */
function isCountDistinctFields(fields: Record<string, unknown> | undefined): { col: unknown } | null {
  if (!fields || Object.keys(fields).length !== 1) return null;
  const node = fields.count;
  if (!isSqlNode(node)) return null;
  const colChunks = node.queryChunks.filter((c) => isColumnRef(c));
  if (colChunks.length !== 1) return null;
  return { col: colChunks[0] };
}

interface Seed {
  event: Record<string, unknown>[];
  submission: Record<string, unknown>[];
  file: Record<string, unknown>[];
  participant: { submissionId: string; contactId: string; order: number; role: string }[];
  contact: { id: string; firstName: string; lastName: string }[];
}

function makeFakeFilesDb(seed: Seed) {
  const byTable = new Map<unknown, Record<string, unknown>[]>([
    [schema.event, seed.event],
    [schema.submission, seed.submission],
    [schema.file, seed.file],
    [schema.participant, seed.participant as unknown as Record<string, unknown>[]],
    [schema.contact, seed.contact as unknown as Record<string, unknown>[]],
  ]);

  function select(fields: Record<string, unknown> | undefined, distinct: boolean) {
    let source: Record<string, unknown>[] = [];
    let whereCond: unknown = null;
    let orderByArg: unknown = null;
    let limitN: number | undefined;
    let offsetN = 0;
    const run = () => {
      const matched = whereCond ? source.filter((r) => evalCond(whereCond, r, seed)) : source.slice();
      const countDistinct = isCountDistinctFields(fields);
      if (countDistinct) {
        const key = colKey(countDistinct.col);
        return [{ count: new Set(matched.map((r) => r[key])).size }];
      }
      if (isCountStarFields(fields)) return [{ count: matched.length }];
      let filtered = matched;
      if (orderByArg) {
        filtered = filtered.slice().sort((a, b) => {
          const av = (a.createdAt as Date | undefined)?.getTime() ?? 0;
          const bv = (b.createdAt as Date | undefined)?.getTime() ?? 0;
          if (bv !== av) return bv - av; // created_at desc
          return String(a.id).localeCompare(String(b.id)); // id asc tiebreak
        });
      }
      let projected = fields ? filtered.map((r) => project(r, fields)) : filtered.map((r) => ({ ...r }));
      if (distinct) {
        const seen = new Set<string>();
        projected = projected.filter((p) => {
          const key = JSON.stringify(p);
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
      }
      if (offsetN) projected = projected.slice(offsetN);
      if (limitN !== undefined) projected = projected.slice(0, limitN);
      return projected;
    };
    const chain: any = {
      from: (table: Record<string, unknown>) => {
        source = (byTable.get(table) ?? []).map((r) => ({ ...r }));
        return chain;
      },
      innerJoin: (table: Record<string, unknown>, cond: unknown) => {
        const joinRows = byTable.get(table) ?? [];
        const merged: Record<string, unknown>[] = [];
        for (const s of source) {
          for (const j of joinRows) {
            if (evalJoinCond(cond, s, j)) {
              // s (the accumulated/driving side) wins on key collisions
              // (every table's PK is literally "id") — downstream
              // where/select in this module only ever reference the
              // driving table's id. evalJoinCond itself resolves each
              // join's OWN predicate against the fresh `j`/accumulated `s`
              // pair directly (checking `j` first), so this storage-order
              // choice never affects join correctness, only what a LATER
              // join step or the final WHERE/projection sees for columns
              // this table doesn't declare.
              merged.push({ ...j, ...s });
            }
          }
        }
        source = merged;
        return chain;
      },
      where: (cond: unknown) => {
        whereCond = cond;
        return chain;
      },
      orderBy: (arg: unknown) => {
        orderByArg = arg;
        return chain;
      },
      limit: (n: number) => {
        limitN = n;
        return chain;
      },
      offset: (n: number) => {
        offsetN = n;
        return chain;
      },
      then: (resolve: (v: unknown[]) => void) => resolve(run()),
    };
    return chain;
  }

  const db = {
    select: (fields?: Record<string, unknown>) => select(fields, false),
    selectDistinct: (fields?: Record<string, unknown>) => select(fields, true),
  };
  return db as unknown as import("../src/server/context").Db;
}

function q(overrides: Partial<EventFilesQuery> = {}): EventFilesQuery {
  return { page: 1, perPage: 50, kinds: [], q: null, ...overrides };
}

// ---------------------------------------------------------------------------
// Fixture: mirrors the shape of the DEC-145 seed's slides.pdf version chain
// (Priya Raman's accepted submission, presentation file replaced once).
// ---------------------------------------------------------------------------

function baseSeed(): Seed {
  const now = new Date("2026-01-05T00:00:00Z");
  const later = new Date("2026-01-06T00:00:00Z");
  return {
    event: [{ id: "event-1", orgId: "org-1", slug: "demo-event", recordPrefix: "SES" }],
    submission: [{ id: "sub-1", eventId: "event-1", seq: 14, title: "Scaling Vector Search" }],
    file: [
      {
        id: "file-v1",
        submissionId: "sub-1",
        kind: "presentation",
        filename: "slides-v1.pdf",
        previousFileId: null,
        contentType: "application/pdf",
        r2Key: "r2/file-v1",
        createdAt: now,
        sizeBytes: 1000000,
      },
      {
        id: "file-v2",
        submissionId: "sub-1",
        kind: "presentation",
        filename: "slides.pdf",
        previousFileId: "file-v1",
        contentType: "application/pdf",
        r2Key: "r2/file-v2",
        createdAt: later,
        sizeBytes: 1234567,
      },
    ],
    participant: [
      { submissionId: "sub-1", contactId: "contact-priya", order: 0, role: "speaker" },
      { submissionId: "sub-1", contactId: "contact-other", order: 1, role: "speaker" },
    ],
    contact: [
      { id: "contact-priya", firstName: "Priya", lastName: "Raman" },
      { id: "contact-other", firstName: "Someone", lastName: "Else" },
    ],
  };
}

describe("listEventDeliverableFiles (DEC-159/344)", () => {
  it("surfaces one row per version chain: latest filename, versionCount 2, lead speaker Priya Raman (min order)", async () => {
    const db = makeFakeFilesDb(baseSeed());
    const result = await listEventDeliverableFiles(db, "event-1", q());
    expect(result.items).toHaveLength(1);
    expect(result.total).toBe(1);
    const chain = result.items[0];
    expect(chain).toMatchObject({
      rootFileId: "file-v1",
      latestFileId: "file-v2",
      filename: "slides.pdf",
      kind: "presentation",
      submissionId: "sub-1",
      submissionRef: "SES-014",
      submissionTitle: "Scaling Vector Search",
      speakerName: "Priya Raman",
      versionCount: 2,
      // DEC-606: the CHAIN's latest version's size, not the root/oldest
      // version's — file-v2 (the later upload) is 1234567 bytes.
      sizeBytes: 1234567,
    });
    expect(chain?.uploadedAt).toBe(new Date("2026-01-06T00:00:00Z").getTime());
  });

  it("returns an empty page (total 0) for an event with no submissions", async () => {
    const seed = baseSeed();
    seed.submission = [];
    seed.file = [];
    const db = makeFakeFilesDb(seed);
    const result = await listEventDeliverableFiles(db, "event-1", q());
    expect(result).toEqual({ items: [], total: 0, totalSizeBytes: 0, page: 1, perPage: 50 });
  });

  it("keeps unrelated single-version files as their own one-item chain", async () => {
    const seed = baseSeed();
    seed.submission.push({ id: "sub-2", eventId: "event-1", seq: 20, title: "Other Talk" });
    seed.file.push({
      id: "file-poster",
      submissionId: "sub-2",
      kind: "poster",
      filename: "poster.png",
      previousFileId: null,
      contentType: "image/png",
      r2Key: "r2/file-poster",
      createdAt: new Date("2026-01-07T00:00:00Z"),
    });
    seed.participant.push({ submissionId: "sub-2", contactId: "contact-other", order: 0, role: "speaker" });
    const db = makeFakeFilesDb(seed);
    const result = await listEventDeliverableFiles(db, "event-1", q());
    expect(result.items).toHaveLength(2);
    const poster = result.items.find((i) => i.rootFileId === "file-poster");
    expect(poster).toMatchObject({ versionCount: 1, latestFileId: "file-poster", speakerName: "Someone Else" });
  });

  it("paginates: perPage 1 returns one row per page, order stable by created_at desc / id asc, total is event-wide", async () => {
    const seed = baseSeed();
    seed.submission.push({ id: "sub-2", eventId: "event-1", seq: 20, title: "Other Talk" });
    seed.file.push({
      id: "file-poster",
      submissionId: "sub-2",
      kind: "poster",
      filename: "poster.png",
      previousFileId: null,
      contentType: "image/png",
      r2Key: "r2/file-poster",
      createdAt: new Date("2026-01-07T00:00:00Z"), // newest — created_at desc puts it first
    });
    seed.participant.push({ submissionId: "sub-2", contactId: "contact-other", order: 0, role: "speaker" });

    const db1 = makeFakeFilesDb(seed);
    const page1 = await listEventDeliverableFiles(db1, "event-1", q({ perPage: 1, page: 1 }));
    expect(page1.total).toBe(2);
    expect(page1.items).toHaveLength(1);
    expect(page1.items[0]!.rootFileId).toBe("file-poster"); // newest first

    const db2 = makeFakeFilesDb(seed);
    const page2 = await listEventDeliverableFiles(db2, "event-1", q({ perPage: 1, page: 2 }));
    expect(page2.total).toBe(2);
    expect(page2.items).toHaveLength(1);
    expect(page2.items[0]!.rootFileId).toBe("file-v1");
  });

  it("kinds filters to only the requested deliverable kind", async () => {
    const seed = baseSeed();
    seed.submission.push({ id: "sub-2", eventId: "event-1", seq: 20, title: "Other Talk" });
    seed.file.push({
      id: "file-poster",
      submissionId: "sub-2",
      kind: "poster",
      filename: "poster.png",
      previousFileId: null,
      contentType: "image/png",
      r2Key: "r2/file-poster",
      createdAt: new Date("2026-01-07T00:00:00Z"),
    });
    seed.participant.push({ submissionId: "sub-2", contactId: "contact-other", order: 0, role: "speaker" });
    const db = makeFakeFilesDb(seed);
    const result = await listEventDeliverableFiles(db, "event-1", q({ kinds: ["poster"] }));
    expect(result.items).toHaveLength(1);
    expect(result.items[0]!.kind).toBe("poster");
    expect(result.total).toBe(1);
  });

  it("q matches only via speaker name (not filename or title)", async () => {
    const seed = baseSeed();
    const db = makeFakeFilesDb(seed);
    const result = await listEventDeliverableFiles(db, "event-1", q({ q: "raman" }));
    expect(result.items).toHaveLength(1);
    expect(result.items[0]!.rootFileId).toBe("file-v1");

    const dbMiss = makeFakeFilesDb(seed);
    const noMatch = await listEventDeliverableFiles(dbMiss, "event-1", q({ q: "nonexistent-name" }));
    expect(noMatch.items).toHaveLength(0);
    expect(noMatch.total).toBe(0);
  });

  it("q containing % or _ is matched literally (ESCAPE proven: no unintended wildcard match)", async () => {
    const seed = baseSeed();
    seed.file[0]!.filename = "100%_done.pdf";
    seed.file[1]!.filename = "100%_done-v2.pdf";
    const db = makeFakeFilesDb(seed);
    const result = await listEventDeliverableFiles(db, "event-1", q({ q: "100%_done" }));
    expect(result.items).toHaveLength(1);
    expect(result.items[0]!.rootFileId).toBe("file-v1");

    // A search term that would match everything if % / _ weren't escaped as
    // literals: only differs from the real filename by one char, so a naive
    // unescaped % wildcard would still hit — proves the escape is real.
    const dbNoMatch = makeFakeFilesDb(seed);
    const noMatch = await listEventDeliverableFiles(dbNoMatch, "event-1", q({ q: "999%_done" }));
    expect(noMatch.items).toHaveLength(0);
  });
});

describe("resolveLatestVersions (DEC-160/344)", () => {
  it("resolves an older-version id to its chain's latest file row, with submissionTitle", async () => {
    const db = makeFakeFilesDb(baseSeed());
    const resolved = await resolveLatestVersions(db, "event-1", ["file-v1"]);
    expect(resolved.get("file-v1")).toMatchObject({
      id: "file-v2",
      filename: "slides.pdf",
      submissionTitle: "Scaling Vector Search",
    });
  });

  it("throws (no silent skip) when a requested id isn't a deliverable at all", async () => {
    const db = makeFakeFilesDb(baseSeed());
    await expect(resolveLatestVersions(db, "event-1", ["file-v2", "not-a-real-file"])).rejects.toThrow();
  });

  it("throws when a requested file belongs to a submission in a different event", async () => {
    const seed = baseSeed();
    seed.event.push({ id: "event-2", orgId: "org-1", slug: "other-event", recordPrefix: "OTH" });
    seed.submission.push({ id: "sub-other", eventId: "event-2", seq: 1, title: "Other Event Talk" });
    seed.file.push({
      id: "file-other-event",
      submissionId: "sub-other",
      kind: "presentation",
      filename: "other.pdf",
      previousFileId: null,
      contentType: "application/pdf",
      r2Key: "r2/other",
      createdAt: new Date("2026-01-08T00:00:00Z"),
    });
    const db = makeFakeFilesDb(seed);
    await expect(resolveLatestVersions(db, "event-1", ["file-other-event"])).rejects.toThrow(ApiError);
  });
});
