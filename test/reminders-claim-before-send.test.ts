// DEC-023 amendment (closes CONFIRMED-DEFECT #1, docs/verification-log/
// index/0232): sendReminderEmails used to mail every group in the loop and
// only afterwards write the last_reminded_at dedupe stamp in one chunked
// UPDATE after the loop — so two overlapping calls (e.g. two overlapping
// cron ticks) both pass isReminderDue and both send, and a crash between
// the loop and the stamp UPDATE re-sends the whole batch on retry. The fix
// claims (a conditional chunked UPDATE, RETURNING the ids actually won)
// BEFORE the mail loop, and only mails groups with at least one claimed id.
//
// This file proves TWO things a regression back to the old send-then-stamp
// order would fail:
//   1. when the claim UPDATE's WHERE only wins a SUBSET of the requested
//      ids (simulating a losing race against a concurrent claimant), only
//      the contacts backed by a claimed id are mailed — a contact whose
//      claim lost sends nothing and isn't counted in `sent`.
//   2. the claim write is issued strictly before the first mailer.send call
//      — recorded via one shared `calls` order log the fakeDb's `returning`
//      and the fakeMailer's `send` both push onto, so send-then-stamp
//      (claim after the loop) fails assertion (2) even if it happened to
//      still pass assertion (1) by coincidence.
import { describe, expect, it } from "vitest";
import { remindNow } from "../src/server/repo/tasks";
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

const ORIGIN = "https://events.example.com";
const NOW = new Date(1_700_000_000_000);
const HOUR = 60 * 60 * 1000;

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

function computeEligible(rows: OutstandingRowShape[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const r of rows) {
    if (r.status !== "pending") continue;
    if (seen.has(r.contactId)) continue;
    seen.add(r.contactId);
    out.push(r.contactId);
  }
  out.sort();
  return out;
}

/** Minimal fakeDb (same "grouped chain" shape as
 * test/reminders-batched-stamp.test.ts) whose update().set().where()
 * .returning() call: (a) records "claim" onto the shared `calls` order log
 * BEFORE resolving, and (b) only RETURNS `winningIds` regardless of what the
 * WHERE's inArray actually asked for — simulating a concurrent claimant
 * having already won the rest of the batch. */
function fakeDb(
  rows: OutstandingRowShape[],
  winningIds: Set<string>,
  calls: string[],
): { db: Db } {
  let asCallCount = 0;

  function makeChain(state: { grouped?: boolean; limited?: number; outstandingLimited?: boolean; subquery?: boolean }): any {
    return {
      from: (table: unknown) => {
        if (table && (table as { __subqueryKind?: string }).__subqueryKind) return makeChain({ subquery: true });
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
      as: () => {
        asCallCount += 1;
        return { __subqueryKind: asCallCount === 1 ? "eligible" : "skipped" };
      },
      then: (resolve: (v: unknown) => void) => {
        if (state.subquery) {
          resolve([{ count: computeEligible(rows).length }]);
          return;
        }
        if (state.limited !== undefined) {
          resolve(computeEligible(rows).slice(0, state.limited).map((contactId) => ({ contactId })));
          return;
        }
        if (state.outstandingLimited) {
          resolve(rows);
          return;
        }
        resolve([]);
      },
    };
  }

  const db = {
    select: () => makeChain({}),
    update: () => ({
      set: () => ({
        where: () => ({
          returning: async () => {
            calls.push("claim");
            return rows.filter((r) => winningIds.has(r.assignmentId)).map((r) => ({ id: r.assignmentId }));
          },
        }),
      }),
    }),
    insert: () => ({ values: async () => {} }),
  } as unknown as Db;
  return { db };
}

describe("sendReminderEmails claim-before-send (DEC-023 amendment, closes CONFIRMED-DEFECT #1)", () => {
  it("mails only the contacts backed by a claimed id, when the claim UPDATE wins a strict subset", async () => {
    const rows = [rowFor(1), rowFor(2), rowFor(3)];
    const calls: string[] = [];
    // Only assign_1 and assign_3 win the race; assign_2's contact must not
    // be mailed at all, and must not be counted in `sent`.
    const { db } = fakeDb(rows, new Set(["assign_1", "assign_3"]), calls);

    const mailer: Mailer = {
      async send(m) {
        calls.push(`send:${m.to.email}`);
      },
    };

    const result = await remindNow(db, mailer, "event_1", undefined, NOW, new InMemoryKV(), ORIGIN);

    expect(result.sent).toBe(2);
    const mailedEmails = calls.filter((c) => c.startsWith("send:")).map((c) => c.slice("send:".length));
    expect(new Set(mailedEmails)).toEqual(new Set(["person1@example.com", "person3@example.com"]));
    expect(mailedEmails).not.toContain("person2@example.com");
  });

  it("issues the claim write before the first mailer.send — a send-then-stamp regression fails this", async () => {
    const rows = [rowFor(1), rowFor(2)];
    const calls: string[] = [];
    const { db } = fakeDb(rows, new Set(["assign_1", "assign_2"]), calls);

    const mailer: Mailer = {
      async send(m) {
        calls.push(`send:${m.to.email}`);
      },
    };

    await remindNow(db, mailer, "event_1", undefined, NOW, new InMemoryKV(), ORIGIN);

    expect(calls.length).toBeGreaterThan(0);
    expect(calls[0]).toBe("claim");
    const firstSendIndex = calls.findIndex((c) => c.startsWith("send:"));
    const claimIndex = calls.indexOf("claim");
    expect(claimIndex).toBeLessThan(firstSendIndex);
  });
});
