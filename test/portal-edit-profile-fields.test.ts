// Regression for DEC-415 (J7 — speaker portal-edit silently discarded
// job_title/company/bio): saveSubmissionEdits must write these three locked
// speaker fields (LOCKED_SPEAKER_FIELDS[3..5]) onto schema.contact.title /
// .company / .bio using the same trim-or-null semantics as POST
// /portal/profile (src/routes/portal/profile.tsx:278-280), must never write
// them (or any locked speaker field) into submission_answer, and must never
// touch schema.participant — DEC-258's frozen public snapshot
// (titleAtTime/orgAtTime) is out of scope for this edit path.
//
// Harness mirrors test/portal-edit-speaker-locked.test.ts's fake drizzle-style
// db (dispatch by table identity).

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
        values(values: Record<string, unknown>) {
          inserts.push({ table, values });
          return Promise.resolve();
        },
      };
    },
    delete() {
      return {
        where: () => Promise.resolve(),
      };
    },
  };

  return { db: db as unknown as Db, updates, inserts };
}

describe("saveSubmissionEdits (DEC-415 job_title/company/bio persistence)", () => {
  it("writes title/company/bio onto contact alongside firstName/lastName when all present", async () => {
    const { db, updates } = makeFakeDb({});
    await saveSubmissionEdits(
      db,
      "s1",
      "c1",
      {
        title: "T",
        description: "D",
        first_name: "Jane",
        last_name: "Doe",
        job_title: "Engineer",
        company: "Acme",
        bio: "Loves TypeScript.",
      },
      null,
      [],
    );
    const contactUpdate = updates.find((u) => u.table === schema.contact);
    expect(contactUpdate).toBeDefined();
    expect(contactUpdate!.values).toMatchObject({
      firstName: "Jane",
      lastName: "Doe",
      title: "Engineer",
      company: "Acme",
      bio: "Loves TypeScript.",
    });
  });

  it("bio submitted as empty string clears the stored bio to null", async () => {
    const { db, updates } = makeFakeDb({});
    await saveSubmissionEdits(db, "s1", "c1", { title: "T", description: "D", bio: "" }, null, []);
    const contactUpdate = updates.find((u) => u.table === schema.contact);
    expect(contactUpdate).toBeDefined();
    expect(contactUpdate!.values.bio).toBeNull();
  });

  it("also trims whitespace-only job_title to null (matches profile.tsx semantics)", async () => {
    const { db, updates } = makeFakeDb({});
    await saveSubmissionEdits(db, "s1", "c1", { title: "T", description: "D", job_title: "   " }, null, []);
    const contactUpdate = updates.find((u) => u.table === schema.contact);
    expect(contactUpdate!.values.title).toBeNull();
  });

  it("job_title absent from cleanedAnswers leaves the title key off the update entirely", async () => {
    const { db, updates } = makeFakeDb({});
    await saveSubmissionEdits(
      db,
      "s1",
      "c1",
      { title: "T", description: "D", company: "Acme" },
      null,
      [],
    );
    const contactUpdate = updates.find((u) => u.table === schema.contact);
    expect(contactUpdate).toBeDefined();
    expect(Object.prototype.hasOwnProperty.call(contactUpdate!.values, "title")).toBe(false);
    // company was present, so it should be on the update.
    expect(contactUpdate!.values.company).toBe("Acme");
  });

  it("never writes to schema.participant from this path", async () => {
    const { db, updates } = makeFakeDb({});
    await saveSubmissionEdits(
      db,
      "s1",
      "c1",
      { title: "T", description: "D", job_title: "Engineer", company: "Acme", bio: "Bio text" },
      null,
      [],
    );
    expect(updates.find((u) => u.table === schema.participant)).toBeUndefined();
  });

  it("never inserts or updates a submission_answer row for job_title/company/bio", async () => {
    const { db, updates, inserts } = makeFakeDb({});
    await saveSubmissionEdits(
      db,
      "s1",
      "c1",
      { title: "T", description: "D", job_title: "Engineer", company: "Acme", bio: "Bio text" },
      null,
      [],
    );
    expect(updates.find((u) => u.table === schema.submissionAnswer)).toBeUndefined();
    expect(inserts.find((i) => i.table === schema.submissionAnswer)).toBeUndefined();
  });
});
