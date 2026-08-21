// DEC-941 wave-20 amendment: mergeContacts's docstring (wave-19) claims a
// mid-loop IO failure re-raises an ApiError naming folded/not-folded ids.
// That claim was TRUE only once at least one pair had already folded --
// before this fix, a failure on the very FIRST pair (nothing folded yet,
// behaviourally identical to the preflight's own zero-write refusal) was
// ALSO wrapped into a new ApiError, giving the common failure path a new
// error shape it never had before. This file locks the fix: a failure with
// zero folds rethrows the ORIGINAL error object, unchanged; a failure after
// at least one fold still gets the named, ApiError-wrapped treatment from
// test/contact-merge-atomicity.test.ts's existing "mid-loop failure" tests.
//
// Reuses the fakeDb select-queue pattern from
// test/contact-merge-atomicity.test.ts (no D1 test harness exists in stage
// 1) -- a queue entry may be a zero-arg thrower function to simulate a
// runtime failure at a specific select.

import { describe, expect, it } from "vitest";
import { mergeContacts } from "../src/server/repo/contacts";
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
    headshotFileId: null,
    socialLinksJson: null,
    notes: null,
    customFieldsJson: null,
    externalRef: null,
    createdAt: new Date(1000),
    updatedAt: new Date(1000),
  };
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

/** Same fakeDb as test/contact-merge-atomicity.test.ts: feeds successive
 * db.select() calls the queued row sets, in order; a queue entry may be a
 * zero-arg thrower function to simulate a runtime failure partway through
 * the fold, at the exact select that would otherwise feed the next step. */
function fakeDb(selectQueue: (unknown[] | (() => never))[]) {
  let call = 0;
  const updates: { table: unknown; vals: unknown }[] = [];
  const deletes: { table: unknown }[] = [];
  const db = {
    select: () => {
      const entry = selectQueue[call] ?? [];
      call += 1;
      if (typeof entry === "function") return entry();
      return makeChain(entry);
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

describe("mergeContacts mid-loop failure honesty before any fold (DEC-941 wave-20)", () => {
  const KEEP = contactRaw("contact-keep", "keep@example.com", "Jane", "Doe");
  const M1 = contactRaw("contact-m1", "keep@example.com", "Jane", "Doe");
  const M2 = contactRaw("contact-m2", "keep@example.com", "Jane", "Doe");
  const M3 = contactRaw("contact-m3", "keep@example.com", "Jane", "Doe");

  it("NEGATIVE CONTROL: a failure on pair 1 (nothing folded yet) rethrows the ORIGINAL error object, unchanged", async () => {
    const original = new Error("simulated transient failure on the very first pair");
    const { db } = fakeDb([
      // Whole-operation preflight (clean).
      [KEEP], // findContactById(keepId)
      [M1], // findContactById(mergeIds[0])
      [M2], // findContactById(mergeIds[1])
      [], // login chunk
      [], // email-owner chunk

      // Fold 1: mergeOnePair(keep, m1) -- fails on its very first select,
      // before anything has folded.
      () => {
        throw original;
      },
    ]);

    let caught: unknown;
    try {
      await mergeContacts(db, KEEP.id, [M1.id, M2.id]);
    } catch (err) {
      caught = err;
    }

    // Identity, not just message equality: the exact same object, no
    // wrapping, no new ApiError shape on the common (nothing-folded) path.
    expect(caught).toBe(original);
    expect(caught).not.toBeInstanceOf(ApiError);
  });

  it("NEGATIVE CONTROL: an ApiError thrown on pair 1 (nothing folded yet) is rethrown as the SAME ApiError instance, code and message untouched", async () => {
    const original = new ApiError("conflict", "unexpected unique-index collision on pair 1");
    const { db } = fakeDb([
      [KEEP],
      [M1],
      [M2],
      [],
      [],
      () => {
        throw original;
      },
    ]);

    let caught: unknown;
    try {
      await mergeContacts(db, KEEP.id, [M1.id, M2.id]);
    } catch (err) {
      caught = err;
    }

    expect(caught).toBe(original);
    expect((caught as ApiError).code).toBe("conflict");
    expect((caught as ApiError).message).toBe("unexpected unique-index collision on pair 1");
  });

  it("a mid-loop failure on pair 2 of 3 (one pair already folded) names the folded id, the failed id, and preserves the original ApiError's code as cause", async () => {
    const original = new ApiError("conflict", "unexpected unique-index collision on pair 2");
    const { db } = fakeDb([
      // Whole-operation preflight (clean).
      [KEEP],
      [M1],
      [M2],
      [M3],
      [],
      [],

      // Fold 1: mergeOnePair(keep, m1) -- succeeds fully.
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

      // Fold 2: mergeOnePair(keep, m2) -- throws on its first select.
      () => {
        throw original;
      },
    ]);

    let caught: unknown;
    try {
      await mergeContacts(db, KEEP.id, [M1.id, M2.id, M3.id]);
    } catch (err) {
      caught = err;
    }

    expect(caught).toBeInstanceOf(ApiError);
    // Wrapped, not the same instance -- one pair had already folded.
    expect(caught).not.toBe(original);
    const apiErr = caught as ApiError;
    expect(apiErr.code).toBe(original.code);
    expect(apiErr.message).toContain(original.message);
    expect(apiErr.message).toContain(`[${M1.id}]`);
    expect(apiErr.message).toContain(M2.id);
    expect(apiErr.message).toContain(M3.id);
    expect(apiErr.cause).toBe(original);
  });
});
