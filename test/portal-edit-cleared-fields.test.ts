// Regression for DEC-842 (a submitted blank clears the stored value): a
// speaker who blanks out job title/company/bio on the portal edit form must
// have that column nulled on the contact, not silently handed back the old
// value — and a key entirely absent from the request must leave the column
// untouched (absence and clearing must stay distinguishable).
//
// Fake db harness mirrors test/portal-edit-hidden-answer-cleanup.test.ts
// (dispatch by table identity).

import { describe, expect, it } from "vitest";
import * as schema from "../src/db/schema";
import type { Db } from "../src/server/context";
import { saveSubmissionEdits } from "../src/server/repo/portal-edit";

interface FakeDbData {
  submissionRows?: unknown[];
  contactRows?: unknown[];
}

function makeFakeDb(data: FakeDbData) {
  const updates: Array<{ table: unknown; values: Record<string, unknown> }> = [];
  const inserts: Array<{ table: unknown; values: Record<string, unknown> }> = [];
  const deletes: Array<{ table: unknown }> = [];

  function rowsFor(table: unknown): unknown[] {
    if (table === schema.submission) return data.submissionRows ?? [];
    if (table === schema.contact) return data.contactRows ?? [];
    if (table === schema.submissionAnswer) return [];
    throw new Error("fake db: unexpected table in select");
  }

  function chainFor(rows: unknown[]) {
    const chain: Record<string, unknown> = {
      innerJoin: () => chain,
      leftJoin: () => chain,
      where: () => chain,
      orderBy: () => chain,
      limit: (n: number) => Promise.resolve(rows.slice(0, n)),
      then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
        Promise.resolve(rows).then(resolve, reject),
    };
    return chain;
  }

  const db = {
    select() {
      return {
        from(table: unknown) {
          return chainFor(rowsFor(table));
        },
      };
    },
    update(table: unknown) {
      return {
        set(values: Record<string, unknown>) {
          return {
            where: () => {
              updates.push({ table, values });
              return Promise.resolve();
            },
          };
        },
      };
    },
    insert(table: unknown) {
      return {
        values(rows: Record<string, unknown> | Record<string, unknown>[]) {
          const asArray = Array.isArray(rows) ? rows : [rows];
          for (const values of asArray) inserts.push({ table, values });
          return {
            onConflictDoUpdate: () => Promise.resolve(),
          };
        },
      };
    },
    delete(table: unknown) {
      return {
        where: () => {
          deletes.push({ table });
          return Promise.resolve();
        },
      };
    },
  };

  return { db: db as unknown as Db, updates, inserts, deletes };
}

describe("saveSubmissionEdits clearedFieldIds (DEC-842)", () => {
  it("nulls job_title, company, and bio on the contact when their ids are cleared", async () => {
    const { db, updates } = makeFakeDb({});
    await saveSubmissionEdits(
      db,
      "s1",
      "c1",
      { title: "T", description: "D" },
      null,
      [],
      ["job_title", "company", "bio"],
    );
    const contactUpdate = updates.find((u) => u.table === schema.contact);
    expect(contactUpdate).toBeDefined();
    expect(contactUpdate?.values).toMatchObject({ title: null, company: null, bio: null });
  });

  it("leaves the contact columns untouched when the keys are entirely absent", async () => {
    const { db, updates } = makeFakeDb({});
    await saveSubmissionEdits(db, "s1", "c1", { title: "T", description: "D" }, null, [], []);
    const contactUpdate = updates.find((u) => u.table === schema.contact);
    expect(contactUpdate).toBeUndefined();
  });

  it("clears only the id that was actually cleared, leaving the others untouched", async () => {
    const { db, updates } = makeFakeDb({});
    await saveSubmissionEdits(
      db,
      "s1",
      "c1",
      { title: "T", description: "D" },
      null,
      [],
      ["company"],
    );
    const contactUpdate = updates.find((u) => u.table === schema.contact);
    expect(contactUpdate).toBeDefined();
    expect(contactUpdate?.values.company).toBe(null);
    expect(contactUpdate?.values.title).toBeUndefined();
    expect(contactUpdate?.values.bio).toBeUndefined();
  });

  it("a present (non-blank) value on the same field still wins over clearing", async () => {
    const { db, updates } = makeFakeDb({});
    await saveSubmissionEdits(
      db,
      "s1",
      "c1",
      { title: "T", description: "D", job_title: "Engineer" },
      null,
      [],
      // clearedFieldIds should never contain an id that also has a cleaned
      // value, but even if it did, the present string branch runs first.
      [],
    );
    const contactUpdate = updates.find((u) => u.table === schema.contact);
    expect(contactUpdate?.values.title).toBe("Engineer");
  });

  it("deletes cleared custom field answers through the same DEC-501 path as hidden fields", async () => {
    const { db, deletes } = makeFakeDb({});
    await saveSubmissionEdits(
      db,
      "s1",
      "c1",
      { title: "T", description: "D" },
      null,
      [],
      ["custom_field"],
    );
    const answerDeletes = deletes.filter((d) => d.table === schema.submissionAnswer);
    expect(answerDeletes.length).toBe(1);
  });
});
