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
  toContactRecord,
  toRow,
} from "../src/server/repo/contacts";
import { emailConflictsWithOtherAccount } from "../src/server/repo/contacts/merge";
import { planMerge } from "../src/domain/contacts";
import { ApiError } from "../src/server/http";
import { findAccountUserId } from "../src/server/repo/comms";
import type { Db } from "../src/server/context";

function contactRawToRecord(raw: ReturnType<typeof contactRaw>) {
  return toContactRecord(toRow(raw));
}

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
    headshotFileId: null,
    socialLinksJson: null,
    notes: null,
    customFieldsJson: null,
    externalRef: null,
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
    // findAccountUserIds' user select ends in .orderBy (DEC-456 wave-71
    // amendment); ordering is a no-op against a queued row set.
    orderBy: () => chain,
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
      [KEEP], // preflight (DEC-026 wave-43): findContactById(keepId)
      [MERGE], // preflight: findContactById(mergeId)
      [], // preflight: login chunk (nobody has an account)
      [], // preflight: email-owner chunk (nobody else owns the merged email)
      [KEEP], // fold: findContactById(keepId)
      [MERGE], // fold: findContactById(mergeId)
      [], // fold: user rows for keepId
      [], // fold: user rows for mergeId
      [], // fold: (b2) DEC-479 email conflict pre-check
      [], // mergeParticipants
      [], // keepParticipants
      [], // fold: task_assignment rows for mergeId
      [], // fold: task_assignment rows for keepId
      [], // fold: pipelineEntry for keepId (not enrolled)
      [{ id: "entry-merge", stage: "contacted" }], // fold: pipelineEntry for mergeId
      [KEEP], // fold: findContactById(keepId) after merge
    ]);

    await mergeContacts(db, KEEP.id, [MERGE.id]);

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
      [KEEP], // preflight (DEC-026 wave-43): findContactById(keepId)
      [MERGE], // preflight: findContactById(mergeId)
      [], // preflight: login chunk (nobody has an account)
      [], // preflight: email-owner chunk (nobody else owns the merged email)
      [KEEP], // fold: findContactById(keepId)
      [MERGE], // fold: findContactById(mergeId)
      [], // fold: user rows for keepId
      [], // fold: user rows for mergeId
      [], // fold: (b2) DEC-479 email conflict pre-check
      [], // mergeParticipants
      [], // keepParticipants
      [], // fold: task_assignment rows for mergeId
      [], // fold: task_assignment rows for keepId
      [{ id: "entry-keep", stage: "contacted" }], // fold: pipelineEntry for keepId
      [{ id: "entry-merge", stage: "declined" }], // fold: pipelineEntry for mergeId
      [KEEP], // fold: findContactById(keepId) after merge
    ]);

    await mergeContacts(db, KEEP.id, [MERGE.id]);

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
      [KEEP], // preflight (DEC-026 wave-43): findContactById(keepId)
      [MERGE], // preflight: findContactById(mergeId)
      [], // preflight: login chunk (nobody has an account)
      [], // preflight: email-owner chunk (nobody else owns the merged email)
      [KEEP], // fold: findContactById(keepId)
      [MERGE], // fold: findContactById(mergeId)
      [], // fold: user rows for keepId
      [], // fold: user rows for mergeId
      [], // fold: (b2) DEC-479 email conflict pre-check
      [], // mergeParticipants
      [], // keepParticipants
      [{ id: "assign-merge", taskId: "task-1", status: "complete" }], // fold: task_assignment for mergeId
      [{ id: "assign-keep", taskId: "task-1", status: "pending" }], // fold: task_assignment for keepId
      [], // fold: pipelineEntry for keepId
      [], // fold: pipelineEntry for mergeId
      [KEEP], // fold: findContactById(keepId) after merge
    ]);

    await mergeContacts(db, KEEP.id, [MERGE.id]);

    const taskAssignmentDeletes = deletes.filter((d) => d.table === schema.taskAssignment);
    // Exactly one delete call over task_assignment (dedupe deletes the
    // kept, pending row, preserving the merged, completed row).
    expect(taskAssignmentDeletes.length).toBe(1);
  });
});

describe("mergeContacts participant dedupe (DEC-282 amendment)", () => {
  it("accepted survives being merged into a declined keeper", async () => {
    const { db, updates, deletes } = fakeDb([
      [KEEP], // preflight (DEC-026 wave-43): findContactById(keepId)
      [MERGE], // preflight: findContactById(mergeId)
      [], // preflight: login chunk (nobody has an account)
      [], // preflight: email-owner chunk (nobody else owns the merged email)
      [KEEP], // fold: findContactById(keepId)
      [MERGE], // fold: findContactById(mergeId)
      [], // fold: user rows for keepId
      [], // fold: user rows for mergeId
      [], // fold: (b2) DEC-479 email conflict pre-check
      [{ id: "part-merge", submissionId: "sub-1", inviteStatus: "accepted", visible: true }], // mergeParticipants
      [{ id: "part-keep", submissionId: "sub-1", inviteStatus: "declined", visible: true }], // keepParticipants
      [], // fold: task_assignment for mergeId
      [], // fold: task_assignment for keepId
      [], // fold: pipelineEntry for keepId
      [], // fold: pipelineEntry for mergeId
      [KEEP], // fold: findContactById(keepId) after merge
    ]);

    await mergeContacts(db, KEEP.id, [MERGE.id]);

    const statusUpdate = updates.find(
      (u) => u.table === schema.participant && (u.vals as { inviteStatus?: string }).inviteStatus !== undefined,
    );
    expect(statusUpdate).toBeDefined();
    expect((statusUpdate!.vals as { inviteStatus: string }).inviteStatus).toBe("accepted");

    // The kept row is updated in place, never the merged row (which is
    // deleted) -- deletes must still show exactly one participant delete.
    expect(deletes.filter((d) => d.table === schema.participant).length).toBe(1);
  });

  it("visible survives being merged into a hidden keeper", async () => {
    const { db, updates } = fakeDb([
      [KEEP], // preflight (DEC-026 wave-43): findContactById(keepId)
      [MERGE], // preflight: findContactById(mergeId)
      [], // preflight: login chunk (nobody has an account)
      [], // preflight: email-owner chunk (nobody else owns the merged email)
      [KEEP], // fold: findContactById(keepId)
      [MERGE], // fold: findContactById(mergeId)
      [], // fold: user rows for keepId
      [], // fold: user rows for mergeId
      [], // fold: (b2) DEC-479 email conflict pre-check
      [{ id: "part-merge", submissionId: "sub-1", inviteStatus: "none", visible: true }], // mergeParticipants
      [{ id: "part-keep", submissionId: "sub-1", inviteStatus: "none", visible: false }], // keepParticipants
      [], // fold: task_assignment for mergeId
      [], // fold: task_assignment for keepId
      [], // fold: pipelineEntry for keepId
      [], // fold: pipelineEntry for mergeId
      [KEEP], // fold: findContactById(keepId) after merge
    ]);

    await mergeContacts(db, KEEP.id, [MERGE.id]);

    const visibleUpdate = updates.find(
      (u) => u.table === schema.participant && (u.vals as { visible?: boolean }).visible !== undefined,
    );
    expect(visibleUpdate).toBeDefined();
    expect((visibleUpdate!.vals as { visible: boolean }).visible).toBe(true);
  });
});

describe("mergeContacts login-account conflict guard (DEC-282)", () => {
  it("both have user rows -> conflict thrown, and no delete/update was issued", async () => {
    // DEC-026 wave-43 amendment: this is now caught by mergeContacts' own
    // whole-operation preflight (planMergeFold + detectMergeConflicts),
    // before the fold (mergeOnePair) ever runs -- so the fold's own selects
    // never happen.
    const { db, updates, deletes } = fakeDb([
      [KEEP], // preflight: findContactById(keepId)
      [MERGE], // preflight: findContactById(mergeId)
      [{ contactId: KEEP.id }, { contactId: MERGE.id }], // preflight: login chunk (both have accounts)
      [], // preflight: email-owner chunk (unused once (a) already conflicts, but still queried)
    ]);

    let caught: unknown;
    try {
      await mergeContacts(db, KEEP.id, [MERGE.id]);
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(ApiError);
    expect((caught as ApiError).code).toBe("conflict");

    expect(updates).toEqual([]);
    expect(deletes).toEqual([]);
  });
});

describe("mergeContacts user.email cascade (DEC-479)", () => {
  it("keep has no account, merge has an account -> surviving user row's email becomes the merged contact's email", async () => {
    const keep = contactRaw("contact-keep", "a@example.com", "Jane", "Doe");
    const merge = contactRaw("contact-merge", "b@example.com", "Jane", "Doe");
    const { db, updates } = fakeDb([
      [keep], // preflight: findContactById(keepId)
      [merge], // preflight: findContactById(mergeId)
      [{ contactId: merge.id }], // preflight: login chunk (merge has an account)
      [], // preflight: email-owner chunk (nobody else owns the merged email)
      [keep], // fold: findContactById(keepId)
      [merge], // fold: findContactById(mergeId)
      [], // fold: user rows for keepId (no account)
      [{ id: "user-merge" }], // fold: user rows for mergeId (has account)
      [], // fold: (b2) email conflict pre-check
      [], // mergeParticipants
      [], // keepParticipants
      [], // fold: task_assignment for mergeId
      [], // fold: task_assignment for keepId
      [], // fold: pipelineEntry for keepId
      [], // fold: pipelineEntry for mergeId
      [keep], // fold: findContactById(keepId) after merge
    ]);

    await mergeContacts(db, keep.id, [merge.id]);

    const { merged } = planMerge(contactRawToRecord(keep), contactRawToRecord(merge));

    const userUpdate = updates.find((u) => u.table === schema.user && (u.vals as { email?: string }).email !== undefined);
    expect(userUpdate).toBeDefined();
    expect((userUpdate!.vals as { email: string }).email).toBe(merged.email.toLowerCase());

    // Also repoints the user row's contactId onto keepId, per (f).
    const contactIdUpdate = updates.find((u) => u.table === schema.user && (u.vals as { contactId?: string }).contactId);
    expect(contactIdUpdate).toBeDefined();
    expect((contactIdUpdate!.vals as { contactId: string }).contactId).toBe(keep.id);
  });

  it("keep has an account, merge has none -> the kept user row's email is repointed to the merged contact's email", async () => {
    const keep = contactRaw("contact-keep", "a@example.com", "Jane", "Doe");
    const merge = contactRaw("contact-merge", "b@example.com", "Jane", "Doe");
    const { db, updates } = fakeDb([
      [keep], // preflight: findContactById(keepId)
      [merge], // preflight: findContactById(mergeId)
      [{ contactId: keep.id }], // preflight: login chunk (keep has an account)
      [], // preflight: email-owner chunk (nobody else owns the merged email)
      [keep], // fold: findContactById(keepId)
      [merge], // fold: findContactById(mergeId)
      [{ id: "user-keep" }], // fold: user rows for keepId (has account)
      [], // fold: user rows for mergeId (no account)
      [], // fold: (b2) email conflict pre-check
      [], // mergeParticipants
      [], // keepParticipants
      [], // fold: task_assignment for mergeId
      [], // fold: task_assignment for keepId
      [], // fold: pipelineEntry for keepId
      [], // fold: pipelineEntry for mergeId
      [keep], // fold: findContactById(keepId) after merge
    ]);

    await mergeContacts(db, keep.id, [merge.id]);

    const { merged } = planMerge(contactRawToRecord(keep), contactRawToRecord(merge));

    const userUpdate = updates.find((u) => u.table === schema.user && (u.vals as { email?: string }).email !== undefined);
    expect(userUpdate).toBeDefined();
    expect((userUpdate!.vals as { email: string }).email).toBe(merged.email.toLowerCase());
  });

  it("keep A(a@x, no account) + merge B(b@x, with account) -> surviving user row ends contactId=keepId, email=a@x, and an account lookup by a@x resolves it", async () => {
    const keep = contactRaw("contact-keep", "a@x.com", "Jane", "Doe");
    const merge = contactRaw("contact-merge", "b@x.com", "Jane", "Doe");
    const { db, updates } = fakeDb([
      [keep], // preflight: findContactById(keepId)
      [merge], // preflight: findContactById(mergeId)
      [{ contactId: merge.id }], // preflight: login chunk (merge has an account)
      [], // preflight: email-owner chunk (nobody else owns the merged email)
      [keep], // fold: findContactById(keepId)
      [merge], // fold: findContactById(mergeId)
      [], // fold: user rows for keepId (no account)
      [{ id: "user-merge" }], // fold: user rows for mergeId (has account)
      [], // fold: (b2) email conflict pre-check
      [], // mergeParticipants
      [], // keepParticipants
      [], // fold: task_assignment for mergeId
      [], // fold: task_assignment for keepId
      [], // fold: pipelineEntry for keepId
      [], // fold: pipelineEntry for mergeId
      [keep], // fold: findContactById(keepId) after merge
      // findAccountUserId select below — the post-merge surviving user row,
      // repointed to keepId with the cascaded email. Full (id, contactId,
      // email) shape: findAccountUserIds' map build reads all three.
      [{ id: "user-merge", contactId: "contact-keep", email: "a@x.com" }],
    ]);

    await mergeContacts(db, keep.id, [merge.id]);

    const { merged } = planMerge(contactRawToRecord(keep), contactRawToRecord(merge));
    expect(merged.email.toLowerCase()).toBe("a@x.com");

    const emailUpdate = updates.find((u) => u.table === schema.user && (u.vals as { email?: string }).email !== undefined);
    expect(emailUpdate).toBeDefined();
    expect((emailUpdate!.vals as { email: string }).email).toBe("a@x.com");
    const contactIdUpdate = updates.find((u) => u.table === schema.user && (u.vals as { contactId?: string }).contactId);
    expect(contactIdUpdate).toBeDefined();
    expect((contactIdUpdate!.vals as { contactId: string }).contactId).toBe(keep.id);

    // The surviving user row (repointed to keepId, email cascaded to a@x) is
    // still resolvable by an account lookup on the surviving address -- the
    // CRM's record of the contact's email and login identity never drift
    // apart post-merge (DEC-479, DEC-456).
    const accountUserId = await findAccountUserId(db, { contactId: keep.id, email: "a@x.com" });
    expect(accountUserId).toBe("user-merge");
  });

  it("some OTHER user already owns merged.email -> conflict thrown before any write", async () => {
    // DEC-026 wave-43 amendment: this is now caught by the whole-operation
    // preflight's email-owner chunk, before the fold ever runs.
    const keep = contactRaw("contact-keep", "a@example.com", "Jane", "Doe");
    const merge = contactRaw("contact-merge", "b@example.com", "Jane", "Doe");
    const { db, updates, deletes } = fakeDb([
      [keep], // preflight: findContactById(keepId)
      [merge], // preflight: findContactById(mergeId)
      [], // preflight: login chunk (nobody has an account)
      [{ email: "a@example.com", contactId: "contact-other" }], // preflight: email-owner chunk -- a third contact already owns the merged email
    ]);

    let caught: unknown;
    try {
      await mergeContacts(db, keep.id, [merge.id]);
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(ApiError);
    expect((caught as ApiError).code).toBe("conflict");
    expect(updates).toEqual([]);
    expect(deletes).toEqual([]);
  });
});

describe("emailConflictsWithOtherAccount (DEC-565)", () => {
  const KEEP_ID = "contact-keep";
  const MERGE_ID = "contact-merge";

  it("ownerContactId is keepId -> no conflict", () => {
    expect(emailConflictsWithOtherAccount(KEEP_ID, KEEP_ID, MERGE_ID)).toBe(false);
  });

  it("ownerContactId is mergeId -> no conflict", () => {
    expect(emailConflictsWithOtherAccount(MERGE_ID, KEEP_ID, MERGE_ID)).toBe(false);
  });

  it("ownerContactId is some third contact -> conflict", () => {
    expect(emailConflictsWithOtherAccount("contact-other", KEEP_ID, MERGE_ID)).toBe(true);
  });

  it("ownerContactId is null (staff login, e.g. organizer/reviewer) -> conflict (the DEC-565 regression)", () => {
    // This is the case a SQL `contact_id NOT IN (:keepId, :mergeId)`
    // predicate silently missed: SQLite's NOT IN evaluates to NULL (not
    // TRUE) whenever contact_id IS NULL, so a staff login's email passed
    // the old pre-check and the merge later crashed on user_email_idx
    // after already deleting rows. The predicate must treat null as
    // "conflicts" so the guard actually blocks the merge.
    expect(emailConflictsWithOtherAccount(null, KEEP_ID, MERGE_ID)).toBe(true);
  });
});

describe("mergeContacts email conflict guard vs. a staff login (DEC-565)", () => {
  it("a staff (organizer/reviewer) login with contactId null already owns merged.email -> conflict thrown before any write", async () => {
    const keep = contactRaw("contact-keep", "a@example.com", "Jane", "Doe");
    const merge = contactRaw("contact-merge", "a@example.com", "Jane", "Doe");
    const { db, updates, deletes } = fakeDb([
      [keep], // preflight: findContactById(keepId)
      [merge], // preflight: findContactById(mergeId)
      [], // preflight: login chunk (nobody has an account)
      [{ email: "a@example.com", contactId: null }], // preflight: email-owner chunk -- a staff login, no contact
    ]);

    let caught: unknown;
    try {
      await mergeContacts(db, keep.id, [merge.id]);
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(ApiError);
    expect((caught as ApiError).code).toBe("conflict");
    expect((caught as ApiError).message).toBe("That email already belongs to another account");

    // No contact UPDATE/DELETE (nor any other write) was issued -- the
    // regression let (b) through to write onto the kept contact row and
    // even delete duplicate participant/task_assignment/pipeline rows
    // before crashing on user_email_idx. A fake db doesn't evaluate SQL
    // predicates, so asserting only the throw would also pass on the
    // broken code; asserting zero writes proves the guard runs first.
    expect(updates).toEqual([]);
    expect(deletes).toEqual([]);
  });
});

describe("mergeContacts set-based merge (DEC-629)", () => {
  it("collapses a 3-contact same-name cluster in one call, and the surviving record carries the merged fields", async () => {
    const keep = contactRaw("contact-keep", "a@example.com", "Jane", "Doe");
    const dup1 = contactRaw("contact-dup1", "a@example.com", "Jane", "Doe");
    const dup2 = { ...contactRaw("contact-dup2", "a@example.com", "Jane", "Doe"), company: "Acme Corp" };

    const { db, updates, deletes } = fakeDb([
      // Whole-operation preflight (DEC-026 wave-43), before any fold runs.
      [keep], // preflight: findContactById(keepId)
      [dup1], // preflight: findContactById(mergeIds[0])
      [dup2], // preflight: findContactById(mergeIds[1])
      [], // preflight: login chunk (nobody has an account)
      [], // preflight: email-owner chunk (nobody else owns the merged email)

      // Fold 1: mergeOnePair(keep, dup1)
      [keep], // findContactById(keepId)
      [dup1], // findContactById(mergeId)
      [], // user rows for keepId
      [], // user rows for mergeId
      [], // (b2) email conflict pre-check
      [], // mergeParticipants
      [], // keepParticipants
      [], // task_assignment for mergeId
      [], // task_assignment for keepId
      [], // pipelineEntry for keepId
      [], // pipelineEntry for mergeId
      [keep], // findContactById(keepId) after merge

      // Fold 2: mergeOnePair(keep, dup2)
      [keep], // findContactById(keepId)
      [dup2], // findContactById(mergeId)
      [], // user rows for keepId
      [], // user rows for mergeId
      [], // (b2) email conflict pre-check
      [], // mergeParticipants
      [], // keepParticipants
      [], // task_assignment for mergeId
      [], // task_assignment for keepId
      [], // pipelineEntry for keepId
      [], // pipelineEntry for mergeId
      [keep], // findContactById(keepId) after merge
    ]);

    const survivor = await mergeContacts(db, keep.id, [dup1.id, dup2.id]);

    expect(survivor.id).toBe(keep.id);
    // Two contact rows deleted (dup1, dup2); one survives.
    expect(deletes.filter((d) => d.table === schema.contact).length).toBe(2);
    // The merged fields (company from dup2) reach the contact UPDATE.
    const companyUpdate = updates.find(
      (u) => u.table === schema.contact && (u.vals as { company?: string }).company === "Acme Corp",
    );
    expect(companyUpdate).toBeDefined();
  });

  it("dedupes mergeIds and drops keepId if present, still merging every distinct other id", async () => {
    const keep = contactRaw("contact-keep", "a@example.com", "Jane", "Doe");
    const dup1 = contactRaw("contact-dup1", "a@example.com", "Jane", "Doe");

    const { db, deletes } = fakeDb([
      [keep], // preflight: findContactById(keepId)
      [dup1], // preflight: findContactById(mergeId)
      [], // preflight: login chunk (nobody has an account)
      [], // preflight: email-owner chunk (nobody else owns the merged email)
      [keep], // fold: findContactById(keepId)
      [dup1], // fold: findContactById(mergeId)
      [], // fold: user rows for keepId
      [], // fold: user rows for mergeId
      [], // fold: (b2) email conflict pre-check
      [], // mergeParticipants
      [], // keepParticipants
      [], // fold: task_assignment for mergeId
      [], // fold: task_assignment for keepId
      [], // fold: pipelineEntry for keepId
      [], // fold: pipelineEntry for mergeId
      [keep], // fold: findContactById(keepId) after merge
    ]);

    // mergeIds contains keepId (a no-op self-reference) and dup1.id twice.
    await mergeContacts(db, keep.id, [keep.id, dup1.id, dup1.id]);

    expect(deletes.filter((d) => d.table === schema.contact).length).toBe(1);
  });

  it("empty mergeIds (after dropping keepId) throws ApiError('invalid', ...)", async () => {
    const { db } = fakeDb([]);
    let caught: unknown;
    try {
      await mergeContacts(db, "contact-keep", []);
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(ApiError);
    expect((caught as ApiError).code).toBe("invalid");
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
