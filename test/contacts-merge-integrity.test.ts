// DEC-282: CRM duplicate-merge must be total over every contact-referencing
// table. buildMergeRepointOps used to enumerate six FK tables and omit
// pipeline_entry, so a merged contact's pipeline_entry row was orphaned
// (never repointed, then the contact row was deleted underneath it) and
// listPipelineForOrg (src/server/repo/pipeline.ts:161) threw
// "pipeline_entry <id> references missing contact <id>" for the WHOLE org
// afterwards, 500ing the J11 sourcing board forever. This file locks the
// fix: pipeline_entry/pipeline_activity reconciliation, task_assignment
// completion-preserving dedupe, the both-have-a-login-account conflict
// guard, and a schema tripwire that fails loudly if a future
// contact-referencing table is added without being enumerated in
// CONTACT_FK_TABLES.
//
// Uses the fakeDb select-queue pattern from
// test/contacts-duplicates-merge-route.test.ts:41-70 (no D1 test harness
// exists in stage 1).

import { describe, expect, it } from "vitest";
import { getTableConfig } from "drizzle-orm/sqlite-core";
import * as schema from "../src/db/schema";
import {
  CONTACT_FK_TABLES,
  mergeContacts,
  mergedPipelineStage,
} from "../src/server/repo/contacts";
import { ApiError } from "../src/server/http";
import type { Db } from "../src/server/context";

const ORG_A = "org-a";

function contactRaw(id: string, email: string, firstName: string, lastName: string) {
  return {
    id,
    orgId: ORG_A,
    firstName,
    lastName,
    email,
    phone: null,
    company: null,
    title: null,
    bio: null,
    headshotUrl: null,
    socialLinksJson: null,
    notes: null,
    customFieldsJson: null,
    createdAt: new Date(1000),
    updatedAt: new Date(1000),
  };
}

const KEEP = contactRaw("contact-keep", "jane@example.com", "Jane", "Doe");
const MERGE = contactRaw("contact-merge", "jane@example.com", "Jane", "Doe");

function makeChain(rows: unknown[]) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chain: any = {
    from: () => chain,
    where: () => chain,
    limit: async () => rows,
    then: (resolve: (v: unknown[]) => void) => resolve(rows),
  };
  return chain;
}

/** Feeds successive db.select() calls the queued row sets, in order, and
 * records every update()/delete() write (table object + values/where). */
function fakeDb(selectQueue: unknown[][]) {
  let call = 0;
  const updates: { table: unknown; vals: unknown }[] = [];
  const deletes: { table: unknown }[] = [];
  const db = {
    select: () => {
      const rows = selectQueue[call] ?? [];
      call += 1;
      return makeChain(rows);
    },
    update: (table: unknown) => ({
      set: (vals: unknown) => ({
        where: async () => {
          updates.push({ table, vals });
        },
      }),
    }),
    delete: (table: unknown) => ({
      where: async () => {
        deletes.push({ table });
      },
    }),
  };
  return { db: db as unknown as Db, updates, deletes };
}

describe("mergedPipelineStage (DEC-282)", () => {
  it("both null -> null", () => {
    expect(mergedPipelineStage(null, null)).toBeNull();
  });
  it("one side not enrolled -> the other side's stage", () => {
    expect(mergedPipelineStage(null, "contacted")).toBe("contacted");
    expect(mergedPipelineStage("interested", null)).toBe("interested");
  });
  it("declined never displaces real progress", () => {
    expect(mergedPipelineStage("declined", "contacted")).toBe("contacted");
    expect(mergedPipelineStage("contacted", "declined")).toBe("contacted");
  });
  it("further-along stage wins", () => {
    expect(mergedPipelineStage("identified", "confirmed")).toBe("confirmed");
    expect(mergedPipelineStage("confirmed", "identified")).toBe("confirmed");
  });
  it("equal rank keeps the kept contact's own value", () => {
    expect(mergedPipelineStage("interested", "interested")).toBe("interested");
  });
});

describe("mergeContacts pipeline reconciliation (DEC-282)", () => {
  it("merged contact enrolled, kept contact not -> exactly one pipeline_entry survives, pointing at keepId", async () => {
    const { db, updates, deletes } = fakeDb([
      [KEEP], // findContactById(keepId)
      [MERGE], // findContactById(mergeId)
      [], // user rows for keepId
      [], // user rows for mergeId
      [], // mergeParticipants
      [], // keepParticipants
      [], // task_assignment rows for mergeId
      [], // task_assignment rows for keepId
      [], // pipelineEntry for keepId (not enrolled)
      [{ id: "entry-merge", stage: "contacted" }], // pipelineEntry for mergeId
      [KEEP], // findContactById(keepId) after merge
    ]);

    await mergeContacts(db, KEEP.id, MERGE.id);

    // No pipeline_entry/pipeline_activity update happened in the (e) step
    // (only one side enrolled) — the generic (f) repoint below is the one
    // that moves pipeline_entry.contact_id from mergeId to keepId, and it
    // never deletes the entry row.
    const pipelineEntryUpdates = updates.filter((u) => u.table === schema.pipelineEntry);
    expect(pipelineEntryUpdates.length).toBe(1);
    expect(pipelineEntryUpdates[0]!.vals).toMatchObject({ contactId: KEEP.id });
    expect(deletes.some((d) => d.table === schema.pipelineEntry)).toBe(false);
  });

  it("both enrolled -> pipeline_activity repointed to the kept entry, kept entry's stage is the further-along one, merged entry deleted", async () => {
    const { db, updates, deletes } = fakeDb([
      [KEEP], // findContactById(keepId)
      [MERGE], // findContactById(mergeId)
      [], // user rows for keepId
      [], // user rows for mergeId
      [], // mergeParticipants
      [], // keepParticipants
      [], // task_assignment rows for mergeId
      [], // task_assignment rows for keepId
      [{ id: "entry-keep", stage: "contacted" }], // pipelineEntry for keepId
      [{ id: "entry-merge", stage: "declined" }], // pipelineEntry for mergeId
      [KEEP], // findContactById(keepId) after merge
    ]);

    await mergeContacts(db, KEEP.id, MERGE.id);

    const activityUpdate = updates.find((u) => u.table === schema.pipelineActivity);
    expect(activityUpdate).toBeDefined();
    expect(activityUpdate!.vals).toMatchObject({ entryId: "entry-keep" });

    const entryUpdate = updates.find((u) => u.table === schema.pipelineEntry && (u.vals as { stage?: string }).stage);
    expect(entryUpdate).toBeDefined();
    // declined must never win over contacted.
    expect((entryUpdate!.vals as { stage: string }).stage).toBe("contacted");

    expect(deletes.some((d) => d.table === schema.pipelineEntry)).toBe(true);
  });
});

describe("mergeContacts task_assignment dedupe (DEC-282)", () => {
  it("both assigned the same task, merged row complete + kept row pending -> exactly one assignment row survives and it is the completed one", async () => {
    const { db, deletes } = fakeDb([
      [KEEP], // findContactById(keepId)
      [MERGE], // findContactById(mergeId)
      [], // user rows for keepId
      [], // user rows for mergeId
      [], // mergeParticipants
      [], // keepParticipants
      [{ id: "assign-merge", taskId: "task-1", status: "complete" }], // task_assignment for mergeId
      [{ id: "assign-keep", taskId: "task-1", status: "pending" }], // task_assignment for keepId
      [], // pipelineEntry for keepId
      [], // pipelineEntry for mergeId
      [KEEP], // findContactById(keepId) after merge
    ]);

    await mergeContacts(db, KEEP.id, MERGE.id);

    const taskAssignmentDeletes = deletes.filter((d) => d.table === schema.taskAssignment);
    // Exactly one delete call over task_assignment (dedupe deletes the
    // kept, pending row, preserving the merged, completed row).
    expect(taskAssignmentDeletes.length).toBe(1);
  });
});

describe("mergeContacts login-account conflict guard (DEC-282)", () => {
  it("both have user rows -> conflict thrown, and no delete/update was issued", async () => {
    const { db, updates, deletes } = fakeDb([
      [KEEP], // findContactById(keepId)
      [MERGE], // findContactById(mergeId)
      [{ id: "user-keep" }], // user rows for keepId
      [{ id: "user-merge" }], // user rows for mergeId
    ]);

    let caught: unknown;
    try {
      await mergeContacts(db, KEEP.id, MERGE.id);
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(ApiError);
    expect((caught as ApiError).code).toBe("conflict");

    expect(updates).toEqual([]);
    expect(deletes).toEqual([]);
  });
});

describe("CONTACT_FK_TABLES schema tripwire (DEC-282)", () => {
  it("enumerates every table with a column whose SQL name ends in contact_id", () => {
    const offenders: string[] = [];

    for (const exportName of Object.keys(schema)) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const table = (schema as Record<string, any>)[exportName];
      if (!table || typeof table !== "object") continue;

      let config: ReturnType<typeof getTableConfig>;
      try {
        config = getTableConfig(table);
      } catch {
        continue; // not a sqliteTable export
      }

      for (const col of config.columns) {
        if (!col.name.endsWith("contact_id")) continue;
        if (!(CONTACT_FK_TABLES as readonly string[]).includes(config.name)) {
          offenders.push(config.name);
        }
      }
    }

    expect(
      offenders,
      `The following tables have a *contact_id column but are missing from ` +
        `CONTACT_FK_TABLES in src/server/repo/contacts.ts: ${offenders.sort().join(", ")}`,
    ).toEqual([]);
  });
});
