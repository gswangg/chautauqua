// DEC-023: the WRITE half of sendReminderEmails's fan-out used to stamp
// last_reminded_at inside the per-recipient send loop — one sequential D1
// UPDATE per successfully-emailed recipient, interleaved with the mail sends
// (the READ half, resolvePortalLinks, was already batched in wave 46). This
// file proves the loop body issues NO db.update call at all.
//
// wave-47 amendment (claim-before-send): the post-loop stamp is gone — the
// claim IS the stamp. sendReminderEmails now issues one chunked claim UPDATE
// ... RETURNING *before* the loop (carrying every candidate id, since it
// cannot yet know which sends fail) and, only when a send throws, one chunked
// release UPDATE after it restoring just those ids to their pre-claim value.
// The invariant this file defends is unchanged in spirit: the write half is
// batched around the loop, never per-recipient, and a failed send still
// retries on the next tick. Mocks inArray the same way
// test/submissions-bulk-delete-r2-batch.test.ts does, to inspect the ids
// bound into each UPDATE's WHERE clause.

import { describe, expect, it, vi } from "vitest";

vi.mock("drizzle-orm", async (importOriginal) => {
  const actual = await importOriginal<typeof import("drizzle-orm")>();
  return {
    ...actual,
    inArray: (col: unknown, vals: unknown[]) => ({ kind: "inArray" as const, col, vals }),
  };
});

import { remindNow } from "../src/server/repo/tasks";
import { MANUAL_DEDUPE_WINDOW_MS } from "../src/domain/reminders";
import type { Db } from "../src/server/context";
import type { Mailer } from "../src/mail/types";
import type { KVStore } from "../src/auth/claim";

class InMemoryKV implements KVStore {
  private readonly store = new Map<string, string>();
  async get(key: string): Promise<string | null> {
    return this.store.get(key) ?? null;
  }
  async put(key: string, value: string): Promise<void> {
    this.store.set(key, value);
  }
  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }
}

interface OutstandingRowShape {
  assignmentId: string;
  taskId: string;
  taskTitle: string;
  dueDate: Date | null;
  status: string;
  lastRemindedAt: Date | null;
  contactId: string;
  firstName: string;
  lastName: string;
  email: string;
  eventId: string;
  eventName: string;
  timezone: string;
  assignmentCreatedAt: Date;
}

interface UpdateCall {
  values: unknown;
  whereArg: unknown;
}

/** Pulls the ids bound into an UPDATE's WHERE. The claim UPDATE wraps the
 * mocked inArray in a real drizzle `and(...)` (its second operand, the
 * dedupe-cutoff predicate, is undefined for remindNow), so the mock object
 * is not always the top-level `whereArg` — search the graph for it. */
function idsOf(whereArg: unknown): string[] {
  const seen = new Set<unknown>();
  const stack: unknown[] = [whereArg];
  while (stack.length > 0) {
    const node = stack.pop();
    if (node === null || typeof node !== "object" || seen.has(node)) continue;
    seen.add(node);
    const rec = node as Record<string, unknown>;
    if (rec.kind === "inArray" && Array.isArray(rec.vals)) return rec.vals as string[];
    for (const v of Object.values(rec)) stack.push(v);
  }
  throw new Error("no mocked inArray(...) found in this UPDATE's WHERE clause -- the fake's assumption broke");
}

// wave-56 amendment: remindNow now calls listRemindableContactIds FIRST (one
// GROUP BY/HAVING query for the chosen contactIds, plus two count(*)
// subqueries for skipped/remaining), then re-queries listOutstandingForEvent
// scoped to those ids. This file's fixtures never set last_reminded_at, so
// the fake below computes the SAME grouping the real SQL does — eligible =
// every distinct pending contactId — without needing to evaluate the opaque
// drizzle-orm sql`` condition objects passed to .having().
function computeEligibleAndSkipped(rows: OutstandingRowShape[]): { eligible: string[]; skipped: number } {
  const byContact = new Map<string, OutstandingRowShape[]>();
  for (const r of rows) {
    if (r.status !== "pending") continue;
    const arr = byContact.get(r.contactId) ?? [];
    arr.push(r);
    byContact.set(r.contactId, arr);
  }
  let skipped = 0;
  const eligible: string[] = [];
  for (const [contactId, assignments] of byContact) {
    let maxRemindedAt: number | null = null;
    for (const a of assignments) {
      if (!a.lastRemindedAt) continue;
      const t = a.lastRemindedAt.getTime();
      if (maxRemindedAt === null || t > maxRemindedAt) maxRemindedAt = t;
    }
    if (maxRemindedAt !== null && maxRemindedAt > NOW.getTime() - MANUAL_DEDUPE_WINDOW_MS) {
      skipped += 1;
    } else {
      eligible.push(contactId);
    }
  }
  eligible.sort();
  return { eligible, skipped };
}

type SubqueryMarker = { __subqueryKind: "eligible" | "skipped" };

function fakeDb(rows: OutstandingRowShape[]): { db: Db; updateCalls: UpdateCall[] } {
  const updateCalls: UpdateCall[] = [];
  let asCallCount = 0;

  function makeChain(state: { grouped?: boolean; limited?: number; outstandingLimited?: boolean; subquery?: SubqueryMarker }): any {
    return {
      from: (table: unknown) => {
        const marker = table as SubqueryMarker | undefined;
        if (marker && marker.__subqueryKind) return makeChain({ subquery: marker });
        return makeChain({});
      },
      innerJoin: () => makeChain(state),
      where: () => makeChain(state),
      groupBy: () => makeChain({ ...state, grouped: true }),
      having: () => makeChain(state),
      orderBy: () => makeChain(state),
      limit: (n: number) => {
        if (state.grouped) return makeChain({ ...state, limited: n });
        return makeChain({ ...state, outstandingLimited: true });
      },
      as: (): SubqueryMarker => {
        asCallCount += 1;
        return { __subqueryKind: asCallCount === 1 ? "eligible" : "skipped" };
      },
      then: (resolve: (v: unknown) => void, reject?: (e: unknown) => void) => {
        try {
          if (state.subquery) {
            const { eligible, skipped } = computeEligibleAndSkipped(rows);
            const count = state.subquery.__subqueryKind === "eligible" ? eligible.length : skipped;
            resolve([{ count }]);
            return;
          }
          if (state.limited !== undefined) {
            const { eligible } = computeEligibleAndSkipped(rows);
            resolve(eligible.slice(0, state.limited).map((contactId) => ({ contactId })));
            return;
          }
          if (state.outstandingLimited) {
            resolve(rows);
            return;
          }
          resolve([]);
        } catch (err) {
          if (reject) reject(err);
        }
      },
    };
  }

  const db = {
    select: () => makeChain({}),
    update: () => ({
      set: (values: unknown) => ({
        where: (whereArg: { kind: "inArray"; vals: unknown[] }) => ({
          then: (resolve: (v: unknown) => void) => {
            updateCalls.push({ values, whereArg });
            resolve(undefined);
          },
          // DEC-023 wave-47 claim-before-send: the claim UPDATE returns the
          // ids it actually won. This fake's claim is unconditional (it has
          // no dedupe state), so it wins every id bound into the WHERE —
          // which is exactly what remindNow (claimCutoff=null) expects.
          returning: async () => {
            updateCalls.push({ values, whereArg });
            return idsOf(whereArg).map((id) => ({ id }));
          },
        }),
      }),
    }),
    insert: () => ({
      values: async () => {},
    }),
  } as unknown as Db;
  return { db, updateCalls };
}

const NOW = new Date(1_700_000_000_000);
const HOUR = 60 * 60 * 1000;

function rowFor(i: number): OutstandingRowShape {
  return {
    assignmentId: `assign_${i}`,
    taskId: `task_${i}`,
    taskTitle: "Hotel stay requirement form",
    dueDate: new Date(NOW.getTime() - HOUR),
    status: "pending",
    lastRemindedAt: null,
    contactId: `contact_${i}`,
    firstName: "First",
    lastName: `Last${i}`,
    email: `person${i}@example.com`,
    eventId: "event_1",
    eventName: "DevFlow Conf 2027",
    timezone: "America/Los_Angeles",
    assignmentCreatedAt: new Date(0),
  };
}

describe("sendReminderEmails write-half batching (DEC-023 claim-before-send, wave-47 amendment)", () => {
  it("brackets the send loop with one chunked claim UPDATE and one chunked release of only the failed ids", async () => {
    const rows = Array.from({ length: 5 }, (_, i) => rowFor(i));
    const { db, updateCalls } = fakeDb(rows);

    const BAD_INDEX = 2; // group 3 (0-indexed as 2)
    const badEmail = rows[BAD_INDEX]?.email;
    const sent: Array<{ to: { email: string } }> = [];
    const mailer: Mailer = {
      async send(m) {
        if (m.to.email === badEmail) {
          throw new Error("simulated provider rejection");
        }
        sent.push({ to: m.to });
      },
    };

    const result = await remindNow(db, mailer, "event_1", undefined, NOW, new InMemoryKV(), "https://events.example.com");

    expect(result.sent).toBe(4);
    expect(result.failed).toHaveLength(1);
    expect(result.failed[0]?.email).toBe(badEmail);

    // DEC-023 wave-47 amendment: the write half is still batched, but the
    // batching now brackets the loop instead of trailing it — ONE chunked
    // claim UPDATE before the first send, and (only because one send failed)
    // ONE chunked release UPDATE after the last. Still nothing per-recipient:
    // 5 recipients, 2 writes.
    expect(updateCalls).toHaveLength(2);

    // The claim carries EVERY candidate id (it runs before any send, so it
    // cannot yet know which will fail) and stamps last_reminded_at.
    const claim = updateCalls[0]!;
    expect(new Set(idsOf(claim.whereArg))).toEqual(new Set(rows.map((r) => r.assignmentId)));
    expect((claim.values as { lastRemindedAt: Date | null }).lastRemindedAt).toEqual(NOW);

    // The release carries ONLY the failed group's ids, restoring the
    // pre-claim value (null here) so the next tick retries just that one.
    const release = updateCalls[1]!;
    const releasedIds = idsOf(release.whereArg);
    expect(releasedIds).toEqual([rows[BAD_INDEX]?.assignmentId]);
    expect((release.values as { lastRemindedAt: Date | null }).lastRemindedAt).toBeNull();

    // The four successful recipients keep their claim: never released.
    for (const r of rows.filter((_, i) => i !== BAD_INDEX)) {
      expect(releasedIds).not.toContain(r.assignmentId);
    }
  });
});
