// DEC-962 coverage: getLatestDeliverable/listLatestDeliverables push the
// speaker portal's ownership check into the SQL WHERE (a correlated EXISTS
// over participant ⋈ submission ⋈ event) instead of trusting the caller to
// have already scoped the submissionId(s) it passes in. This is exercised
// against a generic multi-table in-memory fake DB (same pattern as
// test/portal-invite-scope.test.ts) extended to evaluate the real
// drizzle-orm sql`exists (...)` predicate the repo now issues — proving the
// scope is enforced at the query layer, not by a comment about the caller.
//
// Also covers the DEC-962 audit-pass fix to getMySubmissions' inner answer
// batch (src/server/repo/portal/submissions.ts:56), which now joins back
// through participant/event and ANDs the same contactId/orgId in that
// query's own WHERE.

import { describe, expect, it, vi } from "vitest";
import * as schema from "../src/db/schema";
import type { Db } from "../src/server/context";

// ---------------------------------------------------------------------------
// drizzle-orm eq/and/inArray/sql -> plain markers we can evaluate ourselves.
// ---------------------------------------------------------------------------

type Marker =
  | { __marker: "eq"; col: unknown; val: unknown }
  | { __marker: "and"; conds: unknown[] }
  | { __marker: "inArray"; col: unknown; vals: readonly unknown[] }
  | { __marker: "sql"; values: unknown[] };

vi.mock("drizzle-orm", async (importOriginal) => {
  const actual = await importOriginal<typeof import("drizzle-orm")>();
  return {
    ...actual,
    eq: (col: unknown, val: unknown): Marker => ({ __marker: "eq", col, val }),
    and: (...conds: unknown[]): Marker => ({ __marker: "and", conds }),
    inArray: (col: unknown, vals: readonly unknown[]): Marker => ({ __marker: "inArray", col, vals }),
    // A tagged-template mock: captures every interpolated expression in
    // order (tables, columns, and — for fileSubmissionOwnedByContact —
    // exactly two trailing plain-string literals: contactId then orgId).
    sql: (_strings: TemplateStringsArray, ...values: unknown[]): Marker => ({ __marker: "sql", values }),
  };
});

const { getLatestDeliverable, listLatestDeliverables } = await import("../src/server/repo/portal/sessions");
const { getMySubmissions } = await import("../src/server/repo/portal/submissions");

// ---------------------------------------------------------------------------
// Generic multi-table fake DB (pattern from test/portal-invite-scope.test.ts)
// extended with a "sql-exists" evaluator for the DEC-962 predicate.
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
type DataByTag = Record<string, Record<string, unknown>[]>;

function evalWhereCond(cond: unknown, rec: Rec, data: DataByTag): boolean {
  const m = cond as Marker;
  if (m.__marker === "eq") {
    const info = colInfo(m.col);
    return rec[info.tag]?.[info.key] === m.val;
  }
  if (m.__marker === "and") return m.conds.every((c) => evalWhereCond(c, rec, data));
  if (m.__marker === "inArray") {
    const info = colInfo(m.col);
    return m.vals.includes(rec[info.tag]?.[info.key]);
  }
  if (m.__marker === "sql") {
    // Every interpolated value that ISN'T a known table/column is a literal
    // string passed by the caller, in call order. TWO distinct sql``
    // predicates reach this fake:
    const literals = m.values.filter((v) => tryColInfo(v) === null && !TABLE_TAG.has(v as object));
    // (a) DEC-592/DEC-755 answerFieldRoleCondition(role) — an EXISTS over
    // form_field matching submission_answer.form_field_id to a field
    // carrying the given ROLE (never the old global-PK literal id).
    // Recognised by form_field.role among the interpolated expressions.
    if (m.values.some((v) => v === schema.formField.role)) {
      const [role] = literals as [string];
      const answerFieldId = rec.submissionAnswer?.formFieldId;
      return (data.formField ?? []).some((f) => f.id === answerFieldId && f.role === role);
    }
    // (b) DEC-962 fileSubmissionOwnedByContact(contactId, orgId).
    const [contactId, orgId] = literals as [string, string];
    const fileSubmissionId = rec.file?.submissionId;
    const participants = data.participant ?? [];
    const submissions = data.submission ?? [];
    const events = data.event ?? [];
    return participants.some((p) => {
      if (p.submissionId !== fileSubmissionId || p.contactId !== contactId) return false;
      const submission = submissions.find((s) => s.id === p.submissionId);
      if (!submission) return false;
      const event = events.find((e) => e.id === submission.eventId);
      return !!event && event.orgId === orgId;
    });
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

function makeDb(dataByTag: DataByTag) {
  function rowsFor(table: unknown): { tag: string; rows: Record<string, unknown>[] } {
    const tag = TABLE_TAG.get(table as object);
    if (!tag) throw new Error("fake db: unknown table in from/join");
    return { tag, rows: dataByTag[tag] ?? [] };
  }

  function makeSelect(fields: Record<string, unknown>) {
    let records: Rec[] = [];
    let whereCond: unknown = null;
    let sortDescCreatedAt = false;
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
            const joinRec = { ...rec, [tag]: row };
            if (evalJoinCond(cond, joinRec)) next.push(joinRec);
          }
        }
        records = next;
        return chain;
      },
      where(cond: unknown) {
        whereCond = cond;
        return chain;
      },
      orderBy() {
        sortDescCreatedAt = true;
        return chain;
      },
      limit: async (n: number) => finalize().slice(0, n),
      then(resolve: (v: unknown) => void, reject?: (e: unknown) => void) {
        try {
          resolve(finalize());
        } catch (e) {
          if (reject) reject(e);
          else throw e;
        }
      },
    };
    function evalJoinCond(cond: unknown, rec: Rec): boolean {
      const m = cond as Marker;
      if (m.__marker === "eq") {
        const leftInfo = tryColInfo(m.col);
        const rightInfo = tryColInfo(m.val);
        const left = leftInfo ? rec[leftInfo.tag]?.[leftInfo.key] : m.col;
        const right = rightInfo ? rec[rightInfo.tag]?.[rightInfo.key] : m.val;
        return left === right;
      }
      throw new Error(`fake db: unsupported join condition ${JSON.stringify(cond)}`);
    }
    function finalize() {
      let filtered = whereCond ? records.filter((r) => evalWhereCond(whereCond, r, dataByTag)) : records.slice();
      const projected = project(filtered, fields);
      if (sortDescCreatedAt && "createdAt" in fields) {
        projected.sort((a: any, b: any) => (b.createdAt as Date).getTime() - (a.createdAt as Date).getTime());
      }
      return projected;
    }
    return chain;
  }

  const db = { select: makeSelect };
  return db as unknown as Db;
}

// ---------------------------------------------------------------------------
// Fixture: two speakers (A, B) on two different orgs, each with their own
// event/submission/file. Speaker B has an uploaded file; speaker A does not.
// ---------------------------------------------------------------------------

function buildTwoOrgFixture(): DataByTag {
  const now = new Date("2026-01-05T00:00:00Z");
  return {
    event: [
      { id: "event-a", orgId: "org-a", name: "Conf A", recordPrefix: "SES" },
      { id: "event-b", orgId: "org-b", name: "Conf B", recordPrefix: "SES" },
    ],
    submission: [
      { id: "sub-a", eventId: "event-a", seq: 1, title: "A's talk", status: "accepted", createdAt: now, formId: "form-1" },
      { id: "sub-b", eventId: "event-b", seq: 1, title: "B's talk", status: "accepted", createdAt: now, formId: "form-1" },
    ],
    participant: [
      { id: "p-a", submissionId: "sub-a", contactId: "contact-a", inviteStatus: "accepted", order: 0, role: "speaker" },
      { id: "p-b", submissionId: "sub-b", contactId: "contact-b", inviteStatus: "accepted", order: 0, role: "speaker" },
    ],
    file: [
      {
        id: "file-b1",
        submissionId: "sub-b",
        filename: "b-slides.pdf",
        sizeBytes: 100,
        createdAt: now,
      },
    ],
    // DEC-592/DEC-755: session format is resolved through the field's ROLE,
    // so the form must actually carry a role-tagged field for any answer to
    // resolve. The id is incidental — only `role` matches.
    formField: [
      { id: "field_session_format", formId: "form-1", role: "session_format", section: "session", kind: "dropdown" },
    ],
    submissionAnswer: [],
  };
}

describe("DEC-962: portal batched deliverable reads scope in the SQL, not the caller", () => {
  it("listLatestDeliverables: speaker A asking for speaker B's submissionId gets an empty Map", async () => {
    const db = makeDb(buildTwoOrgFixture());
    const result = await listLatestDeliverables(db, "contact-a", "org-a", ["sub-b"]);
    expect(result.size).toBe(0);
  });

  it("getLatestDeliverable: speaker A asking for speaker B's submissionId gets null", async () => {
    const db = makeDb(buildTwoOrgFixture());
    const result = await getLatestDeliverable(db, "contact-a", "org-a", "sub-b");
    expect(result).toBeNull();
  });

  it("listLatestDeliverables: speaker B's own submissionId still resolves for speaker B", async () => {
    const db = makeDb(buildTwoOrgFixture());
    const result = await listLatestDeliverables(db, "contact-b", "org-b", ["sub-b"]);
    expect(result.size).toBe(1);
    expect(result.get("sub-b")).toMatchObject({ id: "file-b1", filename: "b-slides.pdf" });
  });

  it("getLatestDeliverable: speaker B's own submissionId still resolves for speaker B", async () => {
    const db = makeDb(buildTwoOrgFixture());
    const result = await getLatestDeliverable(db, "contact-b", "org-b", "sub-b");
    expect(result).toMatchObject({ id: "file-b1", filename: "b-slides.pdf" });
  });

  it("listLatestDeliverables: a submissionId from the RIGHT contact but the WRONG org still gets no rows", async () => {
    const db = makeDb(buildTwoOrgFixture());
    // contact-b's own id, but org-a (a caller that mismatched org) — still refused.
    const result = await listLatestDeliverables(db, "contact-b", "org-a", ["sub-b"]);
    expect(result.size).toBe(0);
  });
});

describe("DEC-962 audit fix: getMySubmissions' answer batch stays scoped when re-checked in its own query", () => {
  it("speaker A's own submission format resolves correctly after the participant/event join was added", async () => {
    const fixture = buildTwoOrgFixture();
    fixture.submissionAnswer!.push({
      id: "ans-a",
      submissionId: "sub-a",
      formFieldId: "field_session_format",
      valueJson: JSON.stringify("Talk"),
    });
    const db = makeDb(fixture);
    const result = await getMySubmissions(db, "contact-a", "org-a");
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ id: "sub-a", format: "Talk" });
  });
});
