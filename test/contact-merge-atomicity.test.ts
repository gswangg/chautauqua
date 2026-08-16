// DEC-026 wave-43 amendment: mergeContacts becomes ALL-OR-NOTHING across the
// whole id list. Before this, mergeContacts folded mergeOnePair over
// mergeIds one pair at a time -- each pair committed its FK repoints and its
// contact DELETE before the NEXT pair's own pre-checks ran, so an
// ApiError("conflict") on pair k (e.g. keepId and mergeIds[2] both holding a
// login account, which no single PAIR's own check can see) shipped contacts
// 1..k-1 already merged and destroyed. This file locks the fix: a pure
// whole-operation preflight (planMergeFold + detectMergeConflicts,
// src/server/repo/contacts/merge-preflight.ts) that runs before any write,
// plus the real mergeContacts wired to it.
//
// Uses the fakeDb select-queue pattern from
// test/contacts-merge-integrity.test.ts (no D1 test harness exists in stage
// 1).

import { describe, expect, it } from "vitest";
import * as schema from "../src/db/schema";
import { mergeContacts, toContactRecord, toRow } from "../src/server/repo/contacts";
import {
  planMergeFold,
  detectMergeConflicts,
  MERGE_BOTH_LOGINS_MESSAGE,
  MERGE_EMAIL_TAKEN_MESSAGE,
  type MergeFoldStep,
} from "../src/server/repo/contacts/merge-preflight";
import { ApiError } from "../src/server/http";
import type { Db } from "../src/server/context";
import type { ContactRecord } from "../src/domain/contacts";

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

function contactRawToRecord(raw: ReturnType<typeof contactRaw>): ContactRecord {
  return toContactRecord(toRow(raw));
}

function makeChain(rows: unknown[]) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chain: any = {
    from: () => chain,
    where: () => chain,
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

describe("planMergeFold (DEC-026 wave-43)", () => {
  it("folds planMerge cumulatively, keep -> m1 -> m2, one step per merge id", () => {
    const keep = contactRawToRecord(contactRaw("k", "", "Jane", ""));
    const m1 = contactRawToRecord(contactRaw("m1", "m1@example.com", "", "Doe"));
    const m2 = contactRawToRecord(contactRaw("m2", "m2@example.com", "", ""));

    const { steps, finalEmail } = planMergeFold(keep, [m1, m2]);

    expect(steps).toHaveLength(2);
    expect(steps[0]!.mergeId).toBe("m1");
    // keep's email is blank, so step 1 fills it from m1.
    expect(steps[0]!.mergedEmail).toBe("m1@example.com");
    expect(steps[1]!.mergeId).toBe("m2");
    // step 1's survivor already has a non-blank email, so step 2's merge
    // (m2, also non-blank) does not change it further.
    expect(steps[1]!.mergedEmail).toBe("m1@example.com");
    expect(finalEmail).toBe("m1@example.com");
  });

  it("no merges -> no steps, finalEmail is keep's own email", () => {
    const keep = contactRawToRecord(contactRaw("k", "k@example.com", "Jane", "Doe"));
    const { steps, finalEmail } = planMergeFold(keep, []);
    expect(steps).toEqual([]);
    expect(finalEmail).toBe("k@example.com");
  });
});

describe("detectMergeConflicts (DEC-026 wave-43)", () => {
  const emptySteps: MergeFoldStep[] = [{ mergeId: "m1", mergedEmail: "k@example.com" }];

  it("three-id fixture: pair (keep, m1) is clean, but keeper + m2 both hold a login -> both_logins, even though no individual pair trips it", () => {
    // The old per-pair check ran (keep, m1) then (keep, m2) as two SEPARATE
    // fold steps that each commit before the next runs -- neither pair
    // alone has both sides holding a login (m1 has none), so a per-pair
    // check never sees the keep+m2 collision until AFTER (keep, m1) has
    // already written. The whole-operation check sees it immediately.
    const result = detectMergeConflicts({
      keepId: "k",
      mergeIds: ["m1", "m2"],
      contactIdsWithLogin: new Set(["k", "m2"]),
      emailOwners: new Map(),
      steps: [
        { mergeId: "m1", mergedEmail: "k@example.com" },
        { mergeId: "m2", mergedEmail: "k@example.com" },
      ],
    });
    expect(result).toEqual({ code: "both_logins", message: MERGE_BOTH_LOGINS_MESSAGE });
  });

  it("only the keeper holds a login, no merge id does -> no conflict", () => {
    const result = detectMergeConflicts({
      keepId: "k",
      mergeIds: ["m1", "m2"],
      contactIdsWithLogin: new Set(["k"]),
      emailOwners: new Map(),
      steps: [
        { mergeId: "m1", mergedEmail: "k@example.com" },
        { mergeId: "m2", mergedEmail: "k@example.com" },
      ],
    });
    expect(result).toBeNull();
  });

  it("an intermediate merged email (not the final one) owned by a contact outside the full id set -> email_taken", () => {
    const result = detectMergeConflicts({
      keepId: "k",
      mergeIds: ["m1", "m2"],
      contactIdsWithLogin: new Set(),
      emailOwners: new Map([["intermediate@example.com", "contact-other"]]),
      steps: [
        { mergeId: "m1", mergedEmail: "intermediate@example.com" },
        { mergeId: "m2", mergedEmail: "final@example.com" },
      ],
    });
    expect(result).toEqual({ code: "email_taken", message: MERGE_EMAIL_TAKEN_MESSAGE });
  });

  it("a merged email owned by a staff login (contactId null) -> always email_taken, never silently passed", () => {
    const result = detectMergeConflicts({
      keepId: "k",
      mergeIds: ["m1"],
      contactIdsWithLogin: new Set(),
      emailOwners: new Map([["k@example.com", null]]),
      steps: emptySteps,
    });
    expect(result).toEqual({ code: "email_taken", message: MERGE_EMAIL_TAKEN_MESSAGE });
  });

  it("a merged email owned by one of the ids being merged -> no conflict (that's expected, it's part of the operation)", () => {
    const result = detectMergeConflicts({
      keepId: "k",
      mergeIds: ["m1"],
      contactIdsWithLogin: new Set(),
      emailOwners: new Map([["k@example.com", "m1"]]),
      steps: emptySteps,
    });
    expect(result).toBeNull();
  });

  it("no owner at all for the merged email -> no conflict", () => {
    const result = detectMergeConflicts({
      keepId: "k",
      mergeIds: ["m1"],
      contactIdsWithLogin: new Set(),
      emailOwners: new Map(),
      steps: emptySteps,
    });
    expect(result).toBeNull();
  });
});

describe("mergeContacts whole-operation atomicity (DEC-026 wave-43, DEC-069)", () => {
  const KEEP = contactRaw("contact-keep", "keep@example.com", "Jane", "Doe");
  const M1 = contactRaw("contact-m1", "keep@example.com", "Jane", "Doe");
  const M2 = contactRaw("contact-m2", "keep@example.com", "Jane", "Doe");

  it("keeper + third merge id both hold a login -> conflict thrown, ZERO delete statements against contact (the fold never runs)", async () => {
    const { db, updates, deletes } = fakeDb([
      [KEEP], // preflight: findContactById(keepId)
      [M1], // preflight: findContactById(mergeIds[0])
      [M2], // preflight: findContactById(mergeIds[1])
      // preflight: login chunk -- keeper AND the third id (m2) both have an
      // account; m1 does not. A per-pair check on (keep, m1) then (keep, m2)
      // would never see this until after the first pair already wrote.
      [{ contactId: KEEP.id }, { contactId: M2.id }],
      [], // preflight: email-owner chunk (nobody else owns the merged email)
    ]);

    let caught: unknown;
    try {
      await mergeContacts(db, KEEP.id, [M1.id, M2.id]);
    } catch (err) {
      caught = err;
    }

    expect(caught).toBeInstanceOf(ApiError);
    expect((caught as ApiError).code).toBe("conflict");
    expect((caught as ApiError).message).toBe(MERGE_BOTH_LOGINS_MESSAGE);

    // The regression this locks: zero contact deletes (and zero writes at
    // all) when the whole-operation preflight refuses -- never "contact 1
    // merged and destroyed, then a 409 on contact 2".
    expect(deletes.filter((d) => d.table === schema.contact)).toEqual([]);
    expect(deletes).toEqual([]);
    expect(updates).toEqual([]);
  });

  it("NEGATIVE CONTROL: a clean three-id merge still performs every repoint and every delete, surviving row unchanged from today's behavior", async () => {
    const { db, updates, deletes } = fakeDb([
      // Whole-operation preflight.
      [KEEP], // preflight: findContactById(keepId)
      [M1], // preflight: findContactById(mergeIds[0])
      [M2], // preflight: findContactById(mergeIds[1])
      [], // preflight: login chunk (nobody has an account)
      [], // preflight: email-owner chunk (nobody else owns the merged email)

      // Fold 1: mergeOnePair(keep, m1)
      [KEEP], // findContactById(keepId)
      [M1], // findContactById(mergeId)
      [], // user rows for keepId
      [], // user rows for mergeId
      [], // (b2) email conflict pre-check
      [], // mergeParticipants
      [], // keepParticipants
      [], // task_assignment for mergeId
      [], // task_assignment for keepId
      [], // pipelineEntry for keepId
      [], // pipelineEntry for mergeId
      [KEEP], // findContactById(keepId) after merge

      // Fold 2: mergeOnePair(keep, m2)
      [KEEP], // findContactById(keepId)
      [M2], // findContactById(mergeId)
      [], // user rows for keepId
      [], // user rows for mergeId
      [], // (b2) email conflict pre-check
      [], // mergeParticipants
      [], // keepParticipants
      [], // task_assignment for mergeId
      [], // task_assignment for keepId
      [], // pipelineEntry for keepId
      [], // pipelineEntry for mergeId
      [KEEP], // findContactById(keepId) after merge
    ]);

    const survivor = await mergeContacts(db, KEEP.id, [M1.id, M2.id]);

    expect(survivor.id).toBe(KEEP.id);
    // Every repoint table (DEC-282's CONTACT_FK_TABLES) is touched once per
    // discarded id via buildMergeRepointOps -- both folds ran, so a user
    // repoint update fires twice (once per discarded id).
    const userRepoints = updates.filter(
      (u) => u.table === schema.user && (u.vals as { contactId?: string }).contactId === KEEP.id,
    );
    expect(userRepoints.length).toBe(2);
    // Both discarded contact rows are deleted; the keeper survives.
    expect(deletes.filter((d) => d.table === schema.contact).length).toBe(2);
  });
});
