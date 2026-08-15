// DEC-983: two participant readers whose WHERE let a declined participant
// through were named by the wave-32 scan (participant-reader-invite-filter
// .test.ts) as flagged-but-unfixed gaps:
//   1. src/server/repo/files-library.ts's lead-speaker batch read (the
//      Content library row's displayed speaker) — now filtered to
//      ACTIVE_INVITE_STATUSES.
//   2. src/server/repo/review/submissions.ts's listSpeakerNamesForSubmissions
//      (a results-page/export speaker-name batch read) — now filtered via
//      gates.ts's visibleParticipantConditions() (DEC-274's whole predicate,
//      not just participant.visible).
//
// This file proves both readers omit a 'declined' participant and still
// include an 'accepted'/'none' one. Uses the same in-memory fake DB harness
// as test/files-library.test.ts (eq/and/or/inArray/isNull mocked to simple
// markers, `sql` left real so its queryChunks can be evaluated structurally
// — no D1 test driver exists in this repo).

import { describe, expect, it, vi } from "vitest";
import * as schema from "../src/db/schema";
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

const { listEventDeliverableFiles } = await import("../src/server/repo/files-library");
const { listSpeakerNamesForSubmissions } = await import("../src/server/repo/review/submissions");

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

function isTableRef(x: unknown): boolean {
  return Object.values(TABLE_SCHEMAS).includes(x as (typeof TABLE_SCHEMAS)[keyof typeof TABLE_SCHEMAS]);
}

function isSqlNode(x: unknown): x is { queryChunks: unknown[] } {
  return typeof x === "object" && x !== null && "queryChunks" in (x as Record<string, unknown>);
}

function isStringChunk(x: unknown): x is { value: string[] } {
  return (
    typeof x === "object" &&
    x !== null &&
    x.constructor?.name === "StringChunk" &&
    Array.isArray((x as { value: unknown }).value)
  );
}

function renderSql(node: { queryChunks: unknown[] }): { text: string; params: unknown[] } {
  let text = "";
  const params: unknown[] = [];
  for (const chunk of node.queryChunks) {
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

function evalCond(cond: unknown, row: Record<string, unknown>): boolean {
  if (isSqlNode(cond)) throw new Error("fake db: sql`` where conditions unused by this test's queries");
  const m = cond as Marker;
  if (m.__marker === "eq") {
    const right = isColumnRef(m.val) ? row[colKey(m.val)] : m.val;
    return row[colKey(m.col)] === right;
  }
  if (m.__marker === "and") return m.conds.every((c) => evalCond(c, row));
  if (m.__marker === "or") return m.conds.some((c) => evalCond(c, row));
  if (m.__marker === "inArray") return m.vals.includes(row[colKey(m.col)]);
  if (m.__marker === "isNull") return row[colKey(m.col)] == null;
  if (m.__marker === "isNotNull") return row[colKey(m.col)] != null;
  throw new Error(`fake db: unsupported condition ${JSON.stringify(cond)}`);
}

function resolveJoinOperand(col: unknown, sRow: Record<string, unknown>, jRow: Record<string, unknown>): unknown {
  const key = colKey(col);
  return key in jRow ? jRow[key] : sRow[key];
}

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

function isCountDistinctFields(fields: Record<string, unknown> | undefined): { col: unknown } | null {
  if (!fields || Object.keys(fields).length !== 1) return null;
  const node = fields.count;
  if (!isSqlNode(node)) return null;
  const colChunks = node.queryChunks.filter((c) => isColumnRef(c));
  if (colChunks.length !== 1) return null;
  return { col: colChunks[0] };
}

interface ParticipantSeedRow {
  submissionId: string;
  contactId: string;
  order: number;
  role: string;
  inviteStatus: string;
  visible: boolean;
}

interface ContactSeedRow {
  id: string;
  firstName: string;
  lastName: string;
  headshotUrl?: string | null;
}

interface Seed {
  event: Record<string, unknown>[];
  submission: Record<string, unknown>[];
  file: Record<string, unknown>[];
  participant: ParticipantSeedRow[];
  contact: ContactSeedRow[];
}

/** Same from/innerJoin/where/groupBy/orderBy/limit/offset fake-chain
 * pattern as test/files-library.test.ts, minus the LIKE/EXISTS sql``
 * evaluation (unused by q()-less calls / listSpeakerNamesForSubmissions). */
function makeFakeDb(seed: Seed) {
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
    let groupByCols: unknown[] | null = null;
    const run = () => {
      const matched = whereCond ? source.filter((r) => evalCond(whereCond, r)) : source.slice();
      if (groupByCols && groupByCols.length > 0) {
        const keys = groupByCols.map((c) => colKey(c));
        const groups = new Map<string, Record<string, unknown>[]>();
        for (const r of matched) {
          const gkey = keys.map((k) => String(r[k])).join("||");
          const arr = groups.get(gkey) ?? [];
          arr.push(r);
          groups.set(gkey, arr);
        }
        const rows: Record<string, unknown>[] = [];
        for (const groupRows of groups.values()) {
          const rep = groupRows[0]!;
          const out: Record<string, unknown> = {};
          for (const [outKey, col] of Object.entries(fields ?? {})) {
            out[outKey] = isSqlNode(col) ? groupRows.length : isColumnRef(col) ? rep[colKey(col)] : rep[outKey];
          }
          rows.push(out);
        }
        return rows;
      }
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
          if (bv !== av) return bv - av;
          return String(a.id).localeCompare(String(b.id));
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
            if (evalJoinCond(cond, s, j)) merged.push({ ...j, ...s });
          }
        }
        source = merged;
        return chain;
      },
      where: (cond: unknown) => {
        whereCond = cond;
        return chain;
      },
      groupBy: (...cols: unknown[]) => {
        groupByCols = cols;
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

const PARTICIPANTS: ParticipantSeedRow[] = [
  // order 0, declined co-presenter — must never be the printed lead speaker
  // and must never appear in a results-page speaker-name list.
  { submissionId: "sub-1", contactId: "contact-declined", order: 0, role: "speaker", inviteStatus: "declined", visible: true },
  // order 1, accepted — the only eligible lead/listed speaker.
  { submissionId: "sub-1", contactId: "contact-accepted", order: 1, role: "speaker", inviteStatus: "accepted", visible: true },
];

const CONTACTS: ContactSeedRow[] = [
  { id: "contact-declined", firstName: "Declined", lastName: "Speaker" },
  { id: "contact-accepted", firstName: "Accepted", lastName: "Speaker" },
];

describe("files-library.ts lead-speaker batch read excludes a declined participant (DEC-983)", () => {
  it("prints the accepted co-presenter (order 1), never the declined order-0 participant, as the chain's speaker", async () => {
    const now = new Date("2026-01-05T00:00:00Z");
    const seed: Seed = {
      event: [{ id: "event-1", orgId: "org-1", slug: "demo-event", recordPrefix: "SES" }],
      submission: [{ id: "sub-1", eventId: "event-1", seq: 14, title: "Scaling Vector Search" }],
      file: [
        {
          id: "file-1",
          submissionId: "sub-1",
          kind: "presentation",
          filename: "slides.pdf",
          previousFileId: null,
          contentType: "application/pdf",
          r2Key: "r2/file-1",
          createdAt: now,
          sizeBytes: 1000,
          versionNo: 1,
          uploadedByContactId: null,
        },
      ],
      participant: PARTICIPANTS,
      contact: CONTACTS,
    };
    const db = makeFakeDb(seed);
    const result = await listEventDeliverableFiles(db, "event-1", q());
    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.speakerName).toBe("Accepted Speaker");
  });
});

describe("review/submissions.ts listSpeakerNamesForSubmissions excludes a declined participant (DEC-983)", () => {
  it("returns only the accepted participant's name for the submission, never the declined one", async () => {
    const seed: Seed = { event: [], submission: [], file: [], participant: PARTICIPANTS, contact: CONTACTS };
    const db = makeFakeDb(seed);
    const result = await listSpeakerNamesForSubmissions(db, ["sub-1"]);
    expect(result.get("sub-1")).toEqual(["Accepted Speaker"]);
  });

  it("also includes a 'none' invite-status participant (never invited/solo case)", async () => {
    const participants: ParticipantSeedRow[] = [
      { submissionId: "sub-2", contactId: "contact-solo", order: 0, role: "speaker", inviteStatus: "none", visible: true },
      { submissionId: "sub-2", contactId: "contact-declined2", order: 1, role: "speaker", inviteStatus: "declined", visible: true },
    ];
    const contacts: ContactSeedRow[] = [
      { id: "contact-solo", firstName: "Solo", lastName: "Speaker" },
      { id: "contact-declined2", firstName: "Also", lastName: "Declined" },
    ];
    const seed: Seed = { event: [], submission: [], file: [], participant: participants, contact: contacts };
    const db = makeFakeDb(seed);
    const result = await listSpeakerNamesForSubmissions(db, ["sub-2"]);
    expect(result.get("sub-2")).toEqual(["Solo Speaker"]);
  });

  // DEC-974 amendment (w49-a): an organiser-added co-presenter is minted at
  // inviteStatus 'invited' (participants.ts) and this reader gates an
  // ORGANISER-ONLY results page/export — so unlike the public-facing
  // visibleParticipantConditions() this used to call, an 'invited'
  // participant must be included (they DID speak on the session for
  // results purposes), while 'declined' is still excluded.
  it("includes an 'invited' co-presenter's name (organiser results page/export, DEC-974)", async () => {
    const participants: ParticipantSeedRow[] = [
      { submissionId: "sub-3", contactId: "contact-primary", order: 0, role: "speaker", inviteStatus: "accepted", visible: true },
      { submissionId: "sub-3", contactId: "contact-invited", order: 1, role: "speaker", inviteStatus: "invited", visible: false },
      { submissionId: "sub-3", contactId: "contact-declined3", order: 2, role: "speaker", inviteStatus: "declined", visible: true },
    ];
    const contacts: ContactSeedRow[] = [
      { id: "contact-primary", firstName: "Primary", lastName: "Speaker" },
      { id: "contact-invited", firstName: "Invited", lastName: "CoPresenter" },
      { id: "contact-declined3", firstName: "Still", lastName: "Declined" },
    ];
    const seed: Seed = { event: [], submission: [], file: [], participant: participants, contact: contacts };
    const db = makeFakeDb(seed);
    const result = await listSpeakerNamesForSubmissions(db, ["sub-3"]);
    // Fake db harness doesn't implement participant.order sorting (real SQL
    // does, via ORDER BY), so assert set membership rather than order here.
    expect(result.get("sub-3")).toHaveLength(2);
    expect(new Set(result.get("sub-3"))).toEqual(new Set(["Primary Speaker", "Invited CoPresenter"]));
    expect(result.get("sub-3")).not.toContain("Still Declined");
  });
});
