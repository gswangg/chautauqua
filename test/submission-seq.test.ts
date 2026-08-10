// DEC-100: submissionSeqSubquery() must produce a single-statement atomic
// seq allocation — no standalone SELECT MAX(seq) before the INSERT, which
// is exactly the race that used to blow the (event_id, seq) UNIQUE index
// under concurrent submits.

import { describe, expect, it } from "vitest";
import { SQLiteSyncDialect } from "drizzle-orm/sqlite-core";
import { submissionSeqSubquery } from "../src/server/repo/submissions/seq";
import { createSubmission } from "../src/server/repo/submissions/create";

const dialect = new SQLiteSyncDialect();

describe("submissionSeqSubquery", () => {
  it("generates COALESCE(MAX(...))+1 scoped to event_id", () => {
    const frag = submissionSeqSubquery("event-123");
    const { sql } = dialect.sqlToQuery(frag);
    expect(sql).toContain("COALESCE(MAX");
    expect(sql).toContain('"event_id" = ?');
  });
});

describe("createSubmission (submissions/create.ts)", () => {
  it("issues no standalone MAX(seq) select before the insert, and passes a SQL fragment as seq", async () => {
    const selectCalls: string[] = [];
    const inserts: any[] = [];

    function makeChain() {
      const chain: any = {
        from: () => chain,
        where: () => chain,
        limit: async () => [],
        then: (resolve: (v: unknown[]) => void) => resolve([]),
      };
      return chain;
    }

    const db = {
      select: (fields?: unknown) => {
        selectCalls.push(JSON.stringify(fields));
        return makeChain();
      },
      insert: () => ({
        values: async (vals: unknown) => {
          inserts.push(vals);
        },
      }),
    } as any;

    await createSubmission(db, "event-1", "org-1", { title: "Talk" });

    // No select was issued at all before/around the insert — seq comes
    // entirely from the fragment embedded in the INSERT.
    expect(selectCalls.length).toBe(0);
    expect(inserts.length).toBe(1);
    const insertedSeq = inserts[0].seq;
    expect(insertedSeq).toBeDefined();
    expect(typeof insertedSeq).not.toBe("number");
    const { sql } = dialect.sqlToQuery(insertedSeq);
    expect(sql).toContain("COALESCE(MAX");
  });
});
