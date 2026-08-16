// DEC-773 coverage (supersedes DEC-669): a headshot file (kind 'headshot',
// submissionId null, linked via contact.headshot_url = '/headshots/<fileId>')
// is now a ROW in the ONE files library list, not a separate tab/endpoint.
// This exercises listEventDeliverableFiles's headshot branch (kinds:
// ['headshot']) and resolveLatestVersions' headshot resolution, against an
// in-memory fake DB that evaluates the actual drizzle where/join/orderBy
// conditions the repo builds — same rationale as test/files-library.test.ts
// ("no D1 test harness exists in this repo").

import { describe, expect, it, vi } from "vitest";
import * as schema from "../src/db/schema";
import { ApiError } from "../src/server/http";

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
const { listAcceptedContactIds } = await import("../src/server/repo/tasks");

// -----------------------------------------------------------------------
// Fake DB: joined rows are kept as TAGGED sub-objects (never flat-merged),
// so contact.id and file.id — both literally named "id" in the schema — can
// never collide, unlike a naive object spread merge.
// -----------------------------------------------------------------------

const TABLES = {
  event: schema.event,
  participant: schema.participant,
  submission: schema.submission,
  contact: schema.contact,
  file: schema.file,
} as const;
type TableKey = keyof typeof TABLES;

interface JoinedRow {
  event?: Record<string, unknown>;
  participant?: Record<string, unknown>;
  submission?: Record<string, unknown>;
  contact?: Record<string, unknown>;
  file?: Record<string, unknown>;
}

function colInfo(col: unknown): { table: TableKey; prop: string } {
  for (const [tableKey, tableObj] of Object.entries(TABLES)) {
    for (const [prop, value] of Object.entries(tableObj)) {
      if (value === col) return { table: tableKey as TableKey, prop };
    }
  }
  throw new Error("fake db: condition referenced a column not on a known table");
}

function isColumnRef(x: unknown): boolean {
  for (const tableObj of Object.values(TABLES)) {
    for (const value of Object.values(tableObj)) {
      if (value === x) return true;
    }
  }
  return false;
}

function resolveVal(x: unknown, row: JoinedRow): unknown {
  if (!isColumnRef(x)) return x;
  const { table, prop } = colInfo(x);
  const sub = row[table];
  if (!sub) throw new Error(`fake db: column on table "${table}" referenced before it was joined`);
  return sub[prop];
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

/** likeContains wraps in %...% and escapes \/%/_ — reverse it to a literal
 * substring test (mirrors test/files-library.test.ts's likeMatches). */
function likeMatches(value: string, likePattern: string): boolean {
  const inner = likePattern.slice(1, -1);
  const literal = inner.replace(/\\(.)/g, "$1");
  return value.includes(literal);
}

/** Renders a sql`` node's literal text with column refs embedded as
 * `#table.prop` and every other interpolated value collected as a param —
 * only the shapes this module emits (the headshot join predicate and the
 * q-filter LIKE templates) are ever evaluated. */
function renderSql(node: { queryChunks: unknown[] }): { text: string; cols: unknown[]; params: unknown[] } {
  let text = "";
  const cols: unknown[] = [];
  const params: unknown[] = [];
  for (const chunk of node.queryChunks) {
    if (isStringChunk(chunk)) {
      text += chunk.value.join("");
    } else if (isSqlNode(chunk)) {
      const inner = renderSql(chunk);
      text += inner.text;
      cols.push(...inner.cols);
      params.push(...inner.params);
    } else if (isColumnRef(chunk)) {
      const { table, prop } = colInfo(chunk);
      text += `#${table}.${prop}`;
      cols.push(chunk);
    } else {
      text += "?";
      params.push(chunk);
    }
  }
  return { text, cols, params };
}

// DEC-773 amendment (w29-b): the headshot join used to be a sql`` predicate
// (`contact.headshot_url = '/headshots/' || file.id`) evaluated here as a
// " || "+" = " text match -- it's now a plain `eq(contact.headshot_file_id,
// file.id)` marker like every other join in this module (see evalCond's
// generic "eq" branch), so no sql-node join shape is left for evalSqlNode
// to special-case.
function evalSqlNode(node: { queryChunks: unknown[] }, row: JoinedRow): boolean {
  const { text, cols, params } = renderSql(node);
  if (text.includes(" like ")) {
    const like = params[0] as string;
    if (cols.length === 2) {
      // lower(firstName || ' ' || lastName) like ?
      const combined = `${String(resolveVal(cols[0], row))} ${String(resolveVal(cols[1], row))}`.toLowerCase();
      return likeMatches(combined, like);
    }
    // lower(filename) like ? / lower(coalesce(company, '')) like ?
    const value = String(resolveVal(cols[0], row) ?? "").toLowerCase();
    return likeMatches(value, like);
  }
  throw new Error(`fake db: unsupported sql node: ${text}`);
}

function evalCond(cond: unknown, row: JoinedRow): boolean {
  if (isSqlNode(cond)) return evalSqlNode(cond, row);
  const m = cond as Marker;
  if (m.__marker === "eq") return resolveVal(m.col, row) === resolveVal(m.val, row);
  if (m.__marker === "and") return m.conds.every((c) => evalCond(c, row));
  if (m.__marker === "or") return m.conds.some((c) => evalCond(c, row));
  if (m.__marker === "inArray") return m.vals.includes(resolveVal(m.col, row));
  if (m.__marker === "isNull") return resolveVal(m.col, row) == null;
  if (m.__marker === "isNotNull") return resolveVal(m.col, row) != null;
  throw new Error(`fake db: unsupported condition ${JSON.stringify(cond)}`);
}

interface Seed {
  event: { id: string; orgId: string; slug: string; recordPrefix: string }[];
  participant: { submissionId: string; contactId: string; order: number; role: string; inviteStatus: string }[];
  submission: { id: string; eventId: string; status: string; seq?: number; title?: string }[];
  contact: { id: string; firstName: string; lastName: string; company: string | null; headshotFileId: string | null }[];
  file: { id: string; filename: string; sizeBytes: number; contentType: string; r2Key?: string; createdAt: Date; uploadedByContactId?: string | null }[];
}

function makeFakeHeadshotsDb(seed: Seed) {
  const byTable: Record<TableKey, Record<string, unknown>[]> = {
    event: seed.event as unknown as Record<string, unknown>[],
    participant: seed.participant as unknown as Record<string, unknown>[],
    submission: seed.submission as unknown as Record<string, unknown>[],
    contact: seed.contact as unknown as Record<string, unknown>[],
    file: seed.file as unknown as Record<string, unknown>[],
  };
  const keyOf = (table: Record<string, unknown>): TableKey => {
    const found = (Object.entries(TABLES) as [TableKey, unknown][]).find(([, t]) => t === table);
    if (!found) throw new Error("fake db: unknown table in from()/innerJoin()");
    return found[0];
  };

  /** `count(distinct <col>)` aggregate — the only aggregate this module's
   * select() fields ever request for the headshot branch (DEC-680's total,
   * DEC-773's totalSizeBytes uses a plain selectDistinct instead). */
  function isCountDistinctNode(x: unknown): x is { queryChunks: unknown[] } {
    if (!isSqlNode(x)) return false;
    const { text } = renderSql(x);
    return text.startsWith("count(distinct");
  }

  function select(fields: Record<string, unknown>, distinct: boolean) {
    let source: JoinedRow[] = [];
    let whereCond: unknown = null;
    let orderByArg: unknown = null;
    let limitN: number | undefined;
    let offsetN = 0;
    let groupByCols: unknown[] | null = null;
    const countField = Object.entries(fields).find(([, v]) => isCountDistinctNode(v));
    const run = () => {
      let matched = whereCond ? source.filter((r) => evalCond(whereCond, r)) : source.slice();
      // DEC-902: `group by <col[, col...]>` — one output row per distinct
      // combination of the grouped columns, with a plain `sql\`count(*)\``
      // field (if present) resolved to that group's own row count. Used by
      // computeKindCounts's `group by kind` aggregate and its
      // dedupe-by-file-id headshot count.
      if (groupByCols && groupByCols.length > 0) {
        const groups = new Map<string, JoinedRow[]>();
        for (const r of matched) {
          const gkey = groupByCols.map((c) => String(resolveVal(c, r))).join("||");
          const arr = groups.get(gkey) ?? [];
          arr.push(r);
          groups.set(gkey, arr);
        }
        const rows: Record<string, unknown>[] = [];
        for (const groupRows of groups.values()) {
          const rep = groupRows[0]!;
          const out: Record<string, unknown> = {};
          for (const [outKey, col] of Object.entries(fields)) {
            out[outKey] = isSqlNode(col) ? groupRows.length : resolveVal(col, rep);
          }
          rows.push(out);
        }
        return rows;
      }
      if (countField) {
        const [outKey, node] = countField as [string, { queryChunks: unknown[] }];
        const { cols } = renderSql(node);
        const distinctVals = new Set(matched.map((r) => resolveVal(cols[0], r)));
        return [{ [outKey]: distinctVals.size }];
      }
      if (orderByArg) {
        matched = matched.slice().sort((a, b) => {
          const at = (a.file?.createdAt as Date | undefined)?.getTime() ?? 0;
          const bt = (b.file?.createdAt as Date | undefined)?.getTime() ?? 0;
          if (bt !== at) return bt - at;
          return String(a.file?.id).localeCompare(String(b.file?.id));
        });
      }
      let projected = matched.map((r) => {
        const out: Record<string, unknown> = {};
        for (const [outKey, col] of Object.entries(fields)) {
          out[outKey] = resolveVal(col, r);
        }
        return out;
      });
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
        const tableKey = keyOf(table);
        source = (byTable[tableKey] ?? []).map((r) => ({ [tableKey]: r }) as unknown as JoinedRow);
        return chain;
      },
      innerJoin: (table: Record<string, unknown>, cond: unknown) => {
        const tableKey = keyOf(table);
        const joinRows = byTable[tableKey] ?? [];
        const merged: JoinedRow[] = [];
        for (const s of source) {
          for (const j of joinRows) {
            const candidate: JoinedRow = { ...s, [tableKey]: j };
            if (evalCond(cond, candidate)) merged.push(candidate);
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
    select: (fields: Record<string, unknown>) => select(fields, false),
    selectDistinct: (fields: Record<string, unknown>) => select(fields, true),
  };
  return db as unknown as import("../src/server/context").Db;
}

// ---------------------------------------------------------------------------
// Fixture: one accepted speaker with a headshot (Priya), one accepted
// speaker with none (Someone Else, headshotUrl null — excluded), one
// speaker on a NOT-accepted submission with a headshot (excluded).
// ---------------------------------------------------------------------------

function baseSeed(): Seed {
  return {
    event: [{ id: "event-1", orgId: "org-1", slug: "demo-event", recordPrefix: "SES" }],
    participant: [
      { submissionId: "sub-1", contactId: "contact-priya", order: 0, role: "speaker", inviteStatus: "accepted" },
      { submissionId: "sub-1", contactId: "contact-other", order: 1, role: "speaker", inviteStatus: "accepted" },
      { submissionId: "sub-2", contactId: "contact-declined", order: 0, role: "speaker", inviteStatus: "accepted" },
    ],
    submission: [
      { id: "sub-1", eventId: "event-1", status: "accepted" },
      { id: "sub-2", eventId: "event-1", status: "submitted" },
    ],
    contact: [
      { id: "contact-priya", firstName: "Priya", lastName: "Raman", company: "Acme Corp", headshotFileId: "file-hs-priya" },
      { id: "contact-other", firstName: "Someone", lastName: "Else", company: null, headshotFileId: null },
      { id: "contact-declined", firstName: "Not", lastName: "Accepted", company: null, headshotFileId: "file-hs-declined" },
    ],
    file: [
      {
        id: "file-hs-priya",
        filename: "priya.jpg",
        sizeBytes: 234567,
        contentType: "image/jpeg",
        r2Key: "r2/priya",
        createdAt: new Date("2026-01-05T00:00:00Z"),
        uploadedByContactId: "contact-priya",
      },
      {
        id: "file-hs-declined",
        filename: "declined.jpg",
        sizeBytes: 111,
        contentType: "image/jpeg",
        r2Key: "r2/declined",
        createdAt: new Date("2026-01-05T00:00:00Z"),
        uploadedByContactId: "contact-declined",
      },
    ],
  };
}

describe("listEventDeliverableFiles kinds:['headshot'] (DEC-773)", () => {
  it("surfaces only the accepted speaker with a headshot, joined via contact.headshot_url = '/headshots/' || file.id", async () => {
    const db = makeFakeHeadshotsDb(baseSeed());
    const result = await listEventDeliverableFiles(db, "event-1", { page: 1, perPage: 50, kinds: ["headshot"], q: null });
    expect(result.total).toBe(1);
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      rootFileId: "file-hs-priya",
      latestFileId: "file-hs-priya",
      filename: "priya.jpg",
      kind: "headshot",
      submissionId: "",
      submissionRef: "",
      submissionTitle: "",
      speakerName: "Priya Raman",
      versionCount: 1,
      sizeBytes: 234567,
      uploaderName: "Priya Raman",
    });
    expect(result.totalSizeBytes).toBe(234567);
  });

  it("excludes a speaker with no headshot and a headshot belonging to a non-accepted submission's speaker", async () => {
    const db = makeFakeHeadshotsDb(baseSeed());
    const result = await listEventDeliverableFiles(db, "event-1", { page: 1, perPage: 50, kinds: ["headshot"], q: null });
    const names = result.items.map((i) => i.speakerName);
    expect(names).not.toContain("Someone Else");
    expect(names).not.toContain("Not Accepted");
  });

  it("q filters by speaker name", async () => {
    const db = makeFakeHeadshotsDb(baseSeed());
    const hit = await listEventDeliverableFiles(db, "event-1", { page: 1, perPage: 50, kinds: ["headshot"], q: "raman" });
    expect(hit.items).toHaveLength(1);

    const dbMiss = makeFakeHeadshotsDb(baseSeed());
    const miss = await listEventDeliverableFiles(dbMiss, "event-1", { page: 1, perPage: 50, kinds: ["headshot"], q: "nonexistent" });
    expect(miss.items).toHaveLength(0);
    expect(miss.total).toBe(0);
    expect(miss.totalSizeBytes).toBe(0);
  });

  it("returns items, total, and totalSizeBytes from the same where clause for an event with no eligible contacts", async () => {
    const seed = baseSeed();
    seed.contact[0]!.headshotFileId = null; // Priya no longer has a headshot
    const db = makeFakeHeadshotsDb(seed);
    const result = await listEventDeliverableFiles(db, "event-1", { page: 1, perPage: 50, kinds: ["headshot"], q: null });
    expect(result).toEqual({
      items: [],
      total: 0,
      totalSizeBytes: 0,
      page: 1,
      perPage: 50,
      kindCounts: { presentation: 0, poster: 0, handout: 0, recording: 0, photo: 0, headshot: 0 },
    });
  });
});

// -----------------------------------------------------------------------
// DEC-680: total is count(distinct file.id), never rows.length of a
// materialized scan — and 'accepted speaker' is the ONE predicate
// (tasks/crud.ts's acceptedSpeakerConditions) both listAcceptedContactIds
// and the headshot branch compose.
// -----------------------------------------------------------------------

function manySpeakerSeed(n: number): Seed {
  const participant: Seed["participant"] = [];
  const submission: Seed["submission"] = [];
  const contact: Seed["contact"] = [];
  const file: Seed["file"] = [];
  for (let i = 0; i < n; i++) {
    const subId = `sub-${i}`;
    const contactId = `contact-${i}`;
    const fileId = `file-${i}`;
    submission.push({ id: subId, eventId: "event-1", status: "accepted" });
    participant.push({ submissionId: subId, contactId, order: 0, role: "speaker", inviteStatus: "accepted" });
    contact.push({
      id: contactId,
      firstName: "Speaker",
      lastName: String(i).padStart(3, "0"),
      company: null,
      headshotFileId: fileId,
    });
    file.push({
      id: fileId,
      filename: `${contactId}.jpg`,
      sizeBytes: 100,
      contentType: "image/jpeg",
      r2Key: `r2/${fileId}`,
      createdAt: new Date(2026, 0, 5, 0, 0, 0, i), // strictly increasing so createdAt-desc order is stable
      uploadedByContactId: contactId,
    });
  }
  return { event: [{ id: "event-1", orgId: "org-1", slug: "demo-event", recordPrefix: "SES" }], participant, submission, contact, file };
}

describe("listEventDeliverableFiles headshot total (DEC-680/773)", () => {
  it("counts with count(distinct file.id) — total is the true roster size even when page 1 truncates it", async () => {
    const db = makeFakeHeadshotsDb(manySpeakerSeed(75));
    const page1 = await listEventDeliverableFiles(db, "event-1", { page: 1, perPage: 50, kinds: ["headshot"], q: null });
    expect(page1.items).toHaveLength(50); // page window truncates...
    expect(page1.total).toBe(75); // ...but total is the full distinct-file count, not items.length
    expect(page1.totalSizeBytes).toBe(75 * 100); // ...and so is totalSizeBytes, summed over every match.
  });
});

describe("acceptedSpeakerConditions is the ONE predicate (DEC-680)", () => {
  it("a participant whose invite status is not active is excluded from BOTH listAcceptedContactIds and the headshot branch", async () => {
    const seed = baseSeed();
    // Flip Priya's invite status to 'declined' — an inactive status per
    // ACTIVE_INVITE_STATUSES — while keeping her headshot and her
    // submission accepted.
    seed.participant[0]!.inviteStatus = "declined";
    const db = makeFakeHeadshotsDb(seed);

    const acceptedIds = await listAcceptedContactIds(db, "event-1");
    expect(acceptedIds).not.toContain("contact-priya");

    const dbHeadshots = makeFakeHeadshotsDb(seed);
    const headshots = await listEventDeliverableFiles(dbHeadshots, "event-1", { page: 1, perPage: 50, kinds: ["headshot"], q: null });
    expect(headshots.items.map((i) => i.speakerName)).not.toContain("Priya Raman");
    expect(headshots.total).toBe(0);
  });
});

// -----------------------------------------------------------------------
// DEC-160/773: resolveLatestVersions also resolves headshot file ids (the
// bulk-ZIP archive route accepts any row's latestFileId, headshot or
// deliverable) — scoped the same way the headshot branch is (accepted
// speaker, reverse headshot_url match).
// -----------------------------------------------------------------------

describe("resolveLatestVersions resolves headshot ids (DEC-773)", () => {
  it("resolves a headshot file id to its own row, submissionTitle carrying the contact's name", async () => {
    const db = makeFakeHeadshotsDb(baseSeed());
    const resolved = await resolveLatestVersions(db, "event-1", ["file-hs-priya"]);
    expect(resolved.get("file-hs-priya")).toMatchObject({
      id: "file-hs-priya",
      filename: "priya.jpg",
      contentType: "image/jpeg",
      r2Key: "r2/priya",
      submissionTitle: "Priya Raman",
      sizeBytes: 234567,
    });
  });

  it("throws (no silent skip) for a headshot file id outside the event's accepted-speaker scope", async () => {
    const db = makeFakeHeadshotsDb(baseSeed());
    await expect(resolveLatestVersions(db, "event-1", ["file-hs-declined"])).rejects.toThrow(ApiError);
  });
});
