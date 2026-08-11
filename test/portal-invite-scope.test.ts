// DEC-317 coverage: participant invite state gates portal read (not-declined)
// and write (active-only) access. Exercised against a small generic
// multi-table in-memory fake DB (built for this file — the single-table
// fakes used by test/files-library.test.ts and
// test/portal-deliverable-panel-repo.test.ts don't support the innerJoin/
// leftJoin cross-table WHERE clauses these repo functions issue) that
// evaluates the real drizzle-orm eq/and/inArray condition trees the repo
// builds, so the DEC-317 filter is proven at the SQL-WHERE layer (DEC-312),
// never as an app-code post-filter.

import { describe, expect, it, vi } from "vitest";
import * as schema from "../src/db/schema";
import type { Db } from "../src/server/context";

// ---------------------------------------------------------------------------
// drizzle-orm eq/and/inArray -> plain markers we can evaluate ourselves.
// ---------------------------------------------------------------------------

type Marker =
  | { __marker: "eq"; col: unknown; val: unknown }
  | { __marker: "and"; conds: unknown[] }
  | { __marker: "inArray"; col: unknown; vals: readonly unknown[] };

vi.mock("drizzle-orm", async (importOriginal) => {
  const actual = await importOriginal<typeof import("drizzle-orm")>();
  return {
    ...actual,
    eq: (col: unknown, val: unknown): Marker => ({ __marker: "eq", col, val }),
    and: (...conds: unknown[]): Marker => ({ __marker: "and", conds }),
    inArray: (col: unknown, vals: readonly unknown[]): Marker => ({ __marker: "inArray", col, vals }),
  };
});

const { getPortalData, getPortalSubmissionDetail, getMySessions, getMyEventIds } = await import(
  "../src/server/repo/portal"
);
const { loadEditableSubmission } = await import("../src/server/repo/portal-edit");
const { getSubmissionScope } = await import("../src/server/repo/files-authz");
const { canAccessFile } = await import("../src/server/repo/files-authz");

// ---------------------------------------------------------------------------
// Generic multi-table fake DB: a real (if minimal) join/where evaluator over
// plain per-table row arrays, keyed by the schema module's own export names
// so any table referenced by the repo functions under test resolves without
// hand-maintained mapping.
// ---------------------------------------------------------------------------

const TABLE_TAG = new Map<object, string>();
for (const [tag, val] of Object.entries(schema)) {
  if (val && typeof val === "object") TABLE_TAG.set(val as object, tag);
}

function colInfo(col: unknown): { tag: string; key: string } {
  for (const [tableObj, tag] of TABLE_TAG.entries()) {
    for (const [key, value] of Object.entries(tableObj)) {
      if (value === col) return { tag, key };
    }
  }
  throw new Error("fake db: condition referenced an unknown column");
}

function tryColInfo(val: unknown): { tag: string; key: string } | null {
  try {
    return colInfo(val);
  } catch {
    return null;
  }
}

type Rec = Record<string, Record<string, unknown> | undefined>;

function resolveJoinOperand(x: unknown, rec: Rec, joinRow: Record<string, unknown>, joinTag: string): unknown {
  const info = tryColInfo(x);
  if (!info) return x;
  if (info.tag === joinTag) return joinRow[info.key];
  return rec[info.tag]?.[info.key];
}

function evalJoinCond(cond: unknown, rec: Rec, joinRow: Record<string, unknown>, joinTag: string): boolean {
  const m = cond as Marker;
  if (m.__marker === "eq") {
    return resolveJoinOperand(m.col, rec, joinRow, joinTag) === resolveJoinOperand(m.val, rec, joinRow, joinTag);
  }
  throw new Error(`fake db: unsupported join condition ${JSON.stringify(cond)}`);
}

function evalWhereCond(cond: unknown, rec: Rec): boolean {
  const m = cond as Marker;
  if (m.__marker === "eq") {
    const info = colInfo(m.col);
    return rec[info.tag]?.[info.key] === m.val;
  }
  if (m.__marker === "and") return m.conds.every((c) => evalWhereCond(c, rec));
  if (m.__marker === "inArray") {
    const info = colInfo(m.col);
    return m.vals.includes(rec[info.tag]?.[info.key]);
  }
  throw new Error(`fake db: unsupported where condition ${JSON.stringify(cond)}`);
}

function project(records: Rec[], fields: Record<string, unknown>) {
  return records.map((rec) => {
    const out: Record<string, unknown> = {};
    for (const [outKey, col] of Object.entries(fields)) {
      const info = colInfo(col);
      out[outKey] = rec[info.tag]?.[info.key];
    }
    return out;
  });
}

function makeDb(dataByTag: Record<string, Record<string, unknown>[]>) {
  function rowsFor(table: unknown): { tag: string; rows: Record<string, unknown>[] } {
    const tag = TABLE_TAG.get(table as object);
    if (!tag) throw new Error("fake db: unknown table in from/join");
    return { tag, rows: dataByTag[tag] ?? [] };
  }

  function makeSelect(fields: Record<string, unknown>) {
    let records: Rec[] = [];
    let whereCond: unknown = null;
    const chain: any = {
      from(table: unknown) {
        const { tag, rows } = rowsFor(table);
        records = rows.map((r) => ({ [tag]: r }));
        return chain;
      },
      innerJoin(table: unknown, cond: unknown) {
        const { tag, rows } = rowsFor(table);
        const next: Rec[] = [];
        for (const rec of records) {
          for (const row of rows) {
            if (evalJoinCond(cond, rec, row, tag)) next.push({ ...rec, [tag]: row });
          }
        }
        records = next;
        return chain;
      },
      leftJoin(table: unknown, cond: unknown) {
        const { tag, rows } = rowsFor(table);
        const next: Rec[] = [];
        for (const rec of records) {
          const matches = rows.filter((row) => evalJoinCond(cond, rec, row, tag));
          if (matches.length === 0) next.push({ ...rec, [tag]: undefined });
          else for (const row of matches) next.push({ ...rec, [tag]: row });
        }
        records = next;
        return chain;
      },
      where(cond: unknown) {
        whereCond = cond;
        return chain;
      },
      orderBy() {
        return chain;
      },
      limit: async (n: number) => {
        const filtered = whereCond ? records.filter((r) => evalWhereCond(whereCond, r)) : records;
        return project(filtered, fields).slice(0, n);
      },
      then(resolve: (v: unknown) => void, reject?: (e: unknown) => void) {
        try {
          const filtered = whereCond ? records.filter((r) => evalWhereCond(whereCond, r)) : records;
          resolve(project(filtered, fields));
        } catch (e) {
          if (reject) reject(e);
          else throw e;
        }
      },
    };
    return chain;
  }

  const db = {
    select: makeSelect,
    selectDistinct: makeSelect,
  };
  return db as unknown as Db;
}

// ---------------------------------------------------------------------------
// Shared fixture: one submission, one event, one org, one form; a single
// participant contact whose inviteStatus varies per test.
// ---------------------------------------------------------------------------

function seedFor(inviteStatus: string) {
  const now = new Date("2026-01-05T00:00:00Z");
  return {
    event: [{ id: "event-1", orgId: "org-1", name: "Conf", recordPrefix: "SES" }],
    submission: [
      {
        id: "sub-1",
        eventId: "event-1",
        seq: 14,
        title: "Talk",
        description: "desc",
        status: "accepted",
        createdAt: now,
        formId: "form-1",
      },
    ],
    participant: [{ id: "p1", submissionId: "sub-1", contactId: "contact-1", inviteStatus, order: 0, role: "speaker" }],
    contact: [{ id: "contact-1", firstName: "Sam", lastName: "Speaker", email: "sam@example.test" }],
    form: [{ id: "form-1", closeDate: null, tracksJson: null }],
    formField: [],
    submissionAnswer: [],
    submissionTrack: [],
    track: [],
    taskAssignment: [],
    task: [],
    portalSettings: [],
    scheduleSlot: [],
    room: [],
  };
}

describe("DEC-317 portal invite-state gating", () => {
  it("declined participant: 404 from getPortalSubmissionDetail, null from loadEditableSubmission, absent from getPortalData/getMySessions, refused by files scope", async () => {
    const db = makeDb(seedFor("declined"));

    const detail = await getPortalSubmissionDetail(db, "sub-1", "contact-1", "org-1");
    expect(detail).toBeNull();

    const edit = await loadEditableSubmission(db, "contact-1", "sub-1");
    expect(edit).toBeNull();

    const portalData = await getPortalData(db, "contact-1", "org-1");
    expect(portalData.submissions).toHaveLength(0);

    const sessions = await getMySessions(db, "contact-1", "org-1");
    expect(sessions).toHaveLength(0);

    const eventIds = await getMyEventIds(db, "contact-1", "org-1");
    expect(eventIds).toHaveLength(0);

    const scope = await getSubmissionScope(db, "sub-1");
    expect(scope).not.toBeNull();
    expect(scope!.participantContactIds).not.toContain("contact-1");
    expect(canAccessFile({ role: "speaker", orgId: "org-1", contactId: "contact-1" }, { ...scope!, uploadedByContactId: null })).toBe(false);
  });

  it("invited participant: can READ the submission but gets null from loadEditableSubmission (write requires active)", async () => {
    const db = makeDb(seedFor("invited"));

    const detail = await getPortalSubmissionDetail(db, "sub-1", "contact-1", "org-1");
    expect(detail).not.toBeNull();
    expect(detail!.id).toBe("sub-1");

    const edit = await loadEditableSubmission(db, "contact-1", "sub-1");
    expect(edit).toBeNull();

    const portalData = await getPortalData(db, "contact-1", "org-1");
    expect(portalData.submissions).toHaveLength(1);

    const eventIds = await getMyEventIds(db, "contact-1", "org-1");
    expect(eventIds).toEqual(["event-1"]);

    const scope = await getSubmissionScope(db, "sub-1");
    expect(scope!.participantContactIds).not.toContain("contact-1");
    expect(canAccessFile({ role: "speaker", orgId: "org-1", contactId: "contact-1" }, { ...scope!, uploadedByContactId: null })).toBe(false);
  });

  for (const status of ["none", "accepted"] as const) {
    it(`'${status}' participant is unaffected: full read + write + file access`, async () => {
      const db = makeDb(seedFor(status));

      const detail = await getPortalSubmissionDetail(db, "sub-1", "contact-1", "org-1");
      expect(detail).not.toBeNull();

      const edit = await loadEditableSubmission(db, "contact-1", "sub-1");
      expect(edit).not.toBeNull();

      const portalData = await getPortalData(db, "contact-1", "org-1");
      expect(portalData.submissions).toHaveLength(1);

      const eventIds = await getMyEventIds(db, "contact-1", "org-1");
      expect(eventIds).toEqual(["event-1"]);

      const scope = await getSubmissionScope(db, "sub-1");
      expect(scope!.participantContactIds).toContain("contact-1");
      expect(canAccessFile({ role: "speaker", orgId: "org-1", contactId: "contact-1" }, { ...scope!, uploadedByContactId: null })).toBe(true);
    });
  }
});
