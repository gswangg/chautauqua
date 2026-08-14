// DEC-023 wave-48 amendment: the WRITE half of sendReminderEmails's fan-out
// used to stamp last_reminded_at inside the per-recipient send loop — one
// sequential D1 UPDATE per successfully-emailed recipient, interleaved with
// the mail sends (the READ half, resolvePortalLinks, was already batched in
// wave 46). This proves the loop body issues NO db.update call at all, and
// that exactly one chunked UPDATE is issued after the loop, carrying only
// the assignment ids of recipients whose send actually resolved — a
// recipient whose mailer.send throws contributes none of its ids, and
// `sent`/`failed` semantics are unchanged. Mocks inArray the same way
// test/submissions-bulk-delete-r2-batch.test.ts does, to inspect the ids
// bound into the single UPDATE's WHERE clause.

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
  whereArg: { kind: "inArray"; vals: unknown[] };
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
        where: async (whereArg: { kind: "inArray"; vals: unknown[] }) => {
          updateCalls.push({ values, whereArg });
        },
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

describe("sendReminderEmails write-half batching (DEC-023 wave-48 amendment)", () => {
  it("issues exactly ONE update call carrying only the successful groups' assignment ids", async () => {
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

    // Exactly one UPDATE was issued (not one per recipient).
    expect(updateCalls).toHaveLength(1);

    const idsUpdated = updateCalls[0]?.whereArg.vals as string[];
    const expectedIds = rows.filter((_, i) => i !== BAD_INDEX).map((r) => r.assignmentId);
    expect(new Set(idsUpdated)).toEqual(new Set(expectedIds));
    expect(idsUpdated).not.toContain(rows[BAD_INDEX]?.assignmentId);
    expect(idsUpdated).toHaveLength(4);
  });
});
