// DEC-456 wave-71 amendment: "does this person already have an account?"
// has ONE deterministic answer — contact_id beats email — implemented once
// in findAccountUserIds and delegated to by the single-row findAccountUserId.
//
// This file proves the two rows disagree scenario stays deterministic
// regardless of insertion (row) order: a user U1 linked to contact A by
// contact_id, and a DIFFERENT user U2 whose email happens to equal contact
// A's email (contact_id null/different). contact_id must win, in both
// insert orders, for both the single-row and batched entry points.
//
// Uses the same fake-db-chain pattern as test/comms-batched-lookups.test.ts
// (this repo has no local sqlite/D1 test driver — see that file's header
// comment / test/comms-invite-scope.test.ts's walkCondition helper).

import { describe, expect, it } from "vitest";
import type { AppEnv } from "../src/server/env";
import { findAccountUserId, findAccountUserIds } from "../src/server/repo/comms";

interface UserRow {
  id: string;
  contactId: string | null;
  email: string;
}

function makeSelectChain(rows: unknown[], onWhere?: (cond: unknown) => unknown[] | void) {
  const chain: any = {
    from: () => chain,
    innerJoin: () => chain,
    where: (cond: unknown) => {
      const filtered = onWhere?.(cond);
      return filtered ? makeSelectChain(filtered) : chain;
    },
    orderBy: () => chain,
    limit: (n: number) => makeSelectChain(rows.slice(0, n)),
    then: (resolve: (v: unknown[]) => void) => resolve(rows),
  };
  return chain;
}

// Mirrors test/comms-batched-lookups.test.ts's collectLiteralValues: this
// repo has no local sqlite/D1 test driver, so the fake db's WHERE step
// interprets the real drizzle condition tree well enough to filter user
// rows by the bound contact_id/email literals.
function collectLiteralValues(node: unknown, seen = new Set<unknown>(), out: Set<string> = new Set()): Set<string> {
  if (typeof node === "string") {
    out.add(node);
    return out;
  }
  if (node === null || typeof node !== "object" || seen.has(node)) return out;
  seen.add(node);
  if (Array.isArray(node)) {
    for (const c of node) collectLiteralValues(c, seen, out);
    return out;
  }
  const n = node as Record<string, unknown>;
  if (typeof n.value === "string") out.add(n.value);
  if (Array.isArray(n.value)) {
    for (const v of n.value) {
      if (typeof v === "string") out.add(v);
      else collectLiteralValues(v, seen, out);
    }
  }
  if (Array.isArray(n.queryChunks)) collectLiteralValues(n.queryChunks, seen, out);
  return out;
}

function makeUserLookupDb(userRows: UserRow[]) {
  const db = {
    select: (_proj: Record<string, unknown>) => {
      return makeSelectChain(userRows, (cond) => {
        const literals = new Set([...collectLiteralValues(cond)].map((v) => v.toLowerCase()));
        return userRows.filter((r) => (r.contactId && literals.has(r.contactId.toLowerCase())) || literals.has(r.email.toLowerCase()));
      });
    },
  } as unknown as AppEnv["Variables"]["db"];
  return db;
}

const CONTACT_A = { id: "ct-a", email: "a@example.com" };

// U1: linked to contact A by contact_id, but its OWN email has drifted.
const U1: UserRow = { id: "user-1-contact-linked", contactId: CONTACT_A.id, email: "u1-drifted@example.com" };
// U2: a different user row whose email equals contact A's email, but whose
// contact_id points elsewhere (or is null) — an organizer account that
// happens to own the address, per DEC-456's rule (2).
const U2: UserRow = { id: "user-2-email-match", contactId: "ct-someone-else", email: CONTACT_A.email };

describe("account identity precedence is deterministic regardless of row order (DEC-456 wave-71)", () => {
  it("findAccountUserId resolves to the contact_id match (U1) when U1 is inserted before U2", async () => {
    const db = makeUserLookupDb([U1, U2]);
    const result = await findAccountUserId(db, { contactId: CONTACT_A.id, email: CONTACT_A.email });
    expect(result).toBe(U1.id);
  });

  it("findAccountUserId resolves to the contact_id match (U1) when U2 is inserted before U1", async () => {
    const db = makeUserLookupDb([U2, U1]);
    const result = await findAccountUserId(db, { contactId: CONTACT_A.id, email: CONTACT_A.email });
    expect(result).toBe(U1.id);
  });

  it("findAccountUserIds agrees with findAccountUserId for the same input, order U1-then-U2", async () => {
    const singularDb = makeUserLookupDb([U1, U2]);
    const singular = await findAccountUserId(singularDb, { contactId: CONTACT_A.id, email: CONTACT_A.email });

    const batchDb = makeUserLookupDb([U1, U2]);
    const batched = await findAccountUserIds(batchDb, [{ contactId: CONTACT_A.id, email: CONTACT_A.email }]);

    expect(batched.get(CONTACT_A.id)).toBe(singular);
    expect(batched.get(CONTACT_A.id)).toBe(U1.id);
  });

  it("findAccountUserIds agrees with findAccountUserId for the same input, order U2-then-U1", async () => {
    const singularDb = makeUserLookupDb([U2, U1]);
    const singular = await findAccountUserId(singularDb, { contactId: CONTACT_A.id, email: CONTACT_A.email });

    const batchDb = makeUserLookupDb([U2, U1]);
    const batched = await findAccountUserIds(batchDb, [{ contactId: CONTACT_A.id, email: CONTACT_A.email }]);

    expect(batched.get(CONTACT_A.id)).toBe(singular);
    expect(batched.get(CONTACT_A.id)).toBe(U1.id);
  });
});
