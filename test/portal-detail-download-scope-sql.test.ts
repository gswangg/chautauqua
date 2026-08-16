// DEC-962 (wave 47 amendment) coverage: getPortalSubmissionDetail and
// getResourceDownloadScope must carry the requesting contactId inside the
// content-bearing SELECT's own WHERE (a correlated sql`exists (...)`), not
// merely in a JS check run AFTER the row is fetched. This test recovers the
// drizzle bindings of that WHERE clause directly — via a fake db that
// captures the raw condition-marker tree rather than evaluating it — and
// asserts the requesting contactId literal is present among the sql``
// predicate's interpolated values. If the predicate were deleted (relying
// on the JS `eventOrgId`/`isOwnedByContact`/`isParticipantInEvent` checks
// alone), the WHERE clause would carry no contactId binding at all and this
// test would fail, exactly the regression DEC-962's wave-47 amendment
// closes (CONFIRMED-DEFECT #2, docs/verification-log/index/0232).

import { describe, expect, it, vi } from "vitest";
import * as schema from "../src/db/schema";
import type { Db } from "../src/server/context";

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
    sql: (_strings: TemplateStringsArray, ...values: unknown[]): Marker => ({ __marker: "sql", values }),
  };
});

const { getPortalSubmissionDetail } = await import("../src/server/repo/portal/data");
const { getResourceDownloadScope } = await import("../src/server/repo/portal/resources");

// ---------------------------------------------------------------------------
// A capturing (not evaluating) fake db: every select().from()...where(cond)
// records `cond` verbatim and returns zero rows — this test never depends
// on row-level behavior, only on what predicate the WHERE clause carries.
// ---------------------------------------------------------------------------

function makeCapturingDb(captured: unknown[]) {
  function chain(): any {
    return {
      from() {
        return this;
      },
      innerJoin() {
        return this;
      },
      leftJoin() {
        return this;
      },
      where(cond: unknown) {
        captured.push(cond);
        return this;
      },
      orderBy() {
        return this;
      },
      limit: async () => [],
      then(resolve: (v: unknown) => void) {
        resolve([]);
      },
    };
  }
  const db = { select: () => chain(), selectDistinct: () => chain() };
  return db as unknown as Db;
}

// ---------------------------------------------------------------------------
// Walk a captured marker tree, collecting every literal (non-column,
// non-table) value interpolated into a sql`` predicate.
// ---------------------------------------------------------------------------

const TABLE_TAG = new Map<object, string>();
for (const [tag, val] of Object.entries(schema)) {
  if (val && typeof val === "object") TABLE_TAG.set(val as object, tag);
}

function isColumnOrTable(v: unknown): boolean {
  if (v && typeof v === "object" && TABLE_TAG.has(v as object)) return true;
  for (const tableObj of TABLE_TAG.keys()) {
    if (Object.values(tableObj).includes(v)) return true;
  }
  return false;
}

function collectSqlLiterals(cond: unknown, out: unknown[] = []): unknown[] {
  const m = cond as Marker | null | undefined;
  if (!m || typeof m !== "object") return out;
  if (m.__marker === "and") {
    for (const c of m.conds) collectSqlLiterals(c, out);
  } else if (m.__marker === "sql") {
    for (const v of m.values) {
      if (v && typeof v === "object" && (v as Marker).__marker) {
        collectSqlLiterals(v, out); // nested marker (e.g. an inArray fragment)
      } else if (!isColumnOrTable(v)) {
        out.push(v);
      }
    }
  }
  return out;
}

describe("DEC-962 (wave 47 amendment): portal detail/download doors carry contactId in their own WHERE", () => {
  it("getPortalSubmissionDetail's SELECT WHERE binds the requesting contactId, not just submissionId/orgId", async () => {
    const captured: unknown[] = [];
    const db = makeCapturingDb(captured);
    await getPortalSubmissionDetail(db, "submission-x", "contact-x", "org-x");

    // The FIRST captured where() is the content-bearing SELECT (title/
    // description/status/schedule) — the door this DEC closes.
    const detailWhere = captured[0];
    const literals = collectSqlLiterals(detailWhere);
    expect(literals).toContain("contact-x");
  });

  it("getPortalSubmissionDetail's WHERE also still binds submissionId and orgId directly (not sql-only)", async () => {
    const captured: unknown[] = [];
    const db = makeCapturingDb(captured);
    await getPortalSubmissionDetail(db, "submission-x", "contact-x", "org-x");
    const detailWhere = captured[0] as Marker;
    expect(detailWhere.__marker).toBe("and");
    const conds = (detailWhere as { __marker: "and"; conds: Marker[] }).conds;
    const eqVals = conds.filter((c) => c.__marker === "eq").map((c) => (c as { val: unknown }).val);
    expect(eqVals).toContain("submission-x");
    expect(eqVals).toContain("org-x");
  });

  it("getResourceDownloadScope's SELECT WHERE binds the requesting contactId, not just resourceId/orgId", async () => {
    const captured: unknown[] = [];
    const db = makeCapturingDb(captured);
    await getResourceDownloadScope(db, "resource-x", "contact-x", "org-x");

    const scopeWhere = captured[0];
    const literals = collectSqlLiterals(scopeWhere);
    expect(literals).toContain("contact-x");
  });

  it("getResourceDownloadScope's WHERE also still binds resourceId and orgId directly", async () => {
    const captured: unknown[] = [];
    const db = makeCapturingDb(captured);
    await getResourceDownloadScope(db, "resource-x", "contact-x", "org-x");
    const scopeWhere = captured[0] as Marker;
    expect(scopeWhere.__marker).toBe("and");
    const conds = (scopeWhere as { __marker: "and"; conds: Marker[] }).conds;
    const eqVals = conds.filter((c) => c.__marker === "eq").map((c) => (c as { val: unknown }).val);
    expect(eqVals).toContain("resource-x");
    expect(eqVals).toContain("org-x");
  });
});
