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

function fakeDb(rows: OutstandingRowShape[]): Db {
  return {
    select: () => ({
      from: () => ({
        innerJoin: () => ({
          innerJoin: () => ({
            innerJoin: () => ({
              where: async () => rows,
            }),
          }),
        }),
        where: async () => [],
      }),
    }),
    update: () => ({
      set: () => ({
        where: async () => {},
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
