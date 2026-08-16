// DEC-530 wave-46 amendment: task reminders were the last per-recipient KV
// path still awaiting the (now-deleted) singular resolvePortalLink inside a
// loop. Two contracts: (a) a source scan proving the singular call is gone
// from reminders.ts and the batched resolver is imported, and (b) a
// concurrency proof that the organizer-triggered fan-out (remindNow,
// mintClaimTokens=true) actually issues every recipient's claim-token KV
// write before any of them resolves — the thing a sequential per-recipient
// await loop cannot do. Mirrors test/tasks-remind-now-mailer-failure.test.ts's
// fakeDb conventions.

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { remindNow } from "../src/server/repo/tasks";
import { MANUAL_DEDUPE_WINDOW_MS } from "../src/domain/reminders";
import type { Db } from "../src/server/context";
import type { Mailer } from "../src/mail/types";
import type { KVStore } from "../src/auth/claim";

const REMINDERS_SRC = join(__dirname, "..", "src", "server", "repo", "tasks", "reminders.ts");

describe("src/server/repo/tasks/reminders.ts — no per-recipient KV await (DEC-530 wave-46)", () => {
  it("contains no resolvePortalLink( call and imports the batched resolvePortalLinks", () => {
    const source = readFileSync(REMINDERS_SRC, "utf8");
    expect(source).not.toMatch(/resolvePortalLink\(/);
    expect(source).toMatch(/import\s*\{\s*resolvePortalLinks\s*\}\s*from\s*"\.\.\/portal-link"/);
  });
});

/** KV stub whose `put` never resolves until the test explicitly releases it
 * — lets the test observe how many puts were ISSUED (called) before any of
 * them completed. A sequential await-in-a-loop implementation can only ever
 * have 1 put in flight at a time; Promise.all issues them all up front. */
function controllableKV(): { kv: KVStore; issued: string[]; release: () => void } {
  const issued: string[] = [];
  let releaseAll: (() => void) | null = null;
  const gate = new Promise<void>((resolve) => {
    releaseAll = resolve;
  });
  const kv: KVStore = {
    async get() {
      return null;
    },
    async put(key: string) {
      issued.push(key);
      await gate;
    },
    async delete() {},
  };
  return {
    kv,
    issued,
    release: () => releaseAll?.(),
  };
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

// wave-56 amendment: remindNow now calls listRemindableContactIds FIRST (one
// GROUP BY/HAVING query for the chosen contactIds, plus two count(*)
// subqueries for skipped/remaining), then re-queries listOutstandingForEvent
// scoped to those ids. This file's fixtures never set last_reminded_at, so
// the fake below computes the SAME grouping the real SQL does — eligible =
// every distinct pending contactId — without needing to evaluate the opaque
// drizzle-orm sql`` condition objects passed to .having().
function fakeDb(rows: OutstandingRowShape[]): Db {
  let asCallCount = 0;

  function computeEligibleAndSkipped(): { eligible: string[]; skipped: number } {
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
            const { eligible, skipped } = computeEligibleAndSkipped();
            const count = state.subquery.__subqueryKind === "eligible" ? eligible.length : skipped;
            resolve([{ count }]);
            return;
          }
          if (state.limited !== undefined) {
            const { eligible } = computeEligibleAndSkipped();
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

  return {
    select: () => makeChain({}),
    update: () => ({
      set: () => ({
        where: (cond: unknown) => ({
          then: (resolve: (v: unknown) => void) => resolve(undefined),
          // DEC-023 wave-47 claim-before-send: claims the whole fixture set,
          // so every seeded contact still reaches the (batched) send loop
          // this file is actually asserting on.
          returning: async () => {
            void cond;
            return rows.map((r) => ({ id: r.assignmentId }));
          },
        }),
      }),
    }),
    insert: () => ({
      values: async () => {},
    }),
  } as unknown as Db;
}

const NOW = new Date(1_700_000_000_000);
const HOUR = 60 * 60 * 1000;
const N = 12;

describe("remindNow — organizer fan-out mints all claim tokens concurrently (DEC-530 wave-46)", () => {
  it("issues all N claim-token KV puts before releasing the first one", async () => {
    const rows: OutstandingRowShape[] = Array.from({ length: N }, (_, i) => ({
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
    }));

    const db = fakeDb(rows);
    const sent: Array<{ to: { email: string } }> = [];
    const mailer: Mailer = {
      async send(m) {
        sent.push({ to: m.to });
      },
    };
    const { kv, issued, release } = controllableKV();

    const resultPromise = remindNow(db, mailer, "event_1", undefined, NOW, kv, "https://events.example.com");

    // Let every recipient's createClaimToken run its (real, async
    // crypto.subtle) token generation far enough to reach its FIRST kv.put
    // — a real macrotask delay, since SubtleCrypto resolves across actual
    // event-loop ticks, not just queued microtasks.
    await new Promise((r) => setTimeout(r, 50));

    // Every recipient's createClaimToken has reached (and blocked on) its
    // first kv.put — one issued put per recipient — before any of them
    // resolved. A sequential per-recipient await loop could only ever have
    // 1 in flight at a time; Promise.all issues all N up front.
    expect(issued.length).toBe(N);

    release();
    const result = await resultPromise;
    expect(result.sent).toBe(N);
    expect(result.failed).toHaveLength(0);
    expect(sent).toHaveLength(N);
    // createClaimToken performs 2 puts per mint (claim:<hash> + claim-for
    // index) — both now issued for every recipient once released.
    expect(issued.length).toBe(N * 2);
  });
});
