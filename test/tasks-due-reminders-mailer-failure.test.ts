// DEC-238 class 1 (cron, sendDueRemindersForEvent): a bad recipient's
// mailer.send() failure inside the due-date cron pass must not abort the
// event's whole reminder batch — sendDueRemindersForEvent must still send
// to every other due, un-deduped recipient and simply not stamp
// last_reminded_at for the failing one. This is the same guarantee
// test/tasks-remind-now-mailer-failure.test.ts proves for class 2
// (organizer "remind now"), but exercised through the cron entrypoint
// itself (src/routes/tasks.ts's runDueReminders calls this per event, and
// additionally try/catches per-event so one event's total failure can't
// abort other events' ticks either — see that function's own DEC-238
// comment). Mirrors this repo's fakeDb/fakeMailer conventions (no D1/
// miniflare binding in plain-node vitest).
import { describe, expect, it } from "vitest";
import { sendDueRemindersForEvent } from "../src/server/repo/tasks";
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
  eventEndDate: string;
  assignmentCreatedAt: Date;
}

function fakeDb(rows: OutstandingRowShape[]): { db: Db; updateCalls: unknown[] } {
  const updateCalls: unknown[] = [];
  // wave-38 amendment (DEC-319): the cron now bounds its read via
  // listDueReminderContactIds' ONE-innerJoin grouped query BEFORE the
  // existing THREE-innerJoin listOutstandingForEvent chain below — a dumb
  // mock, so it just returns the distinct contactIds present in `rows`
  // regardless of the query's actual WHERE/HAVING bounds (real window/dedupe
  // filtering is exercised in test/reminders-cron-bounded.test.ts against
  // real SQLite rows instead).
  const dueContactIdRows = () => {
    const seen = new Set<string>();
    const out: { contactId: string }[] = [];
    for (const r of rows) {
      if (!seen.has(r.contactId)) {
        seen.add(r.contactId);
        out.push({ contactId: r.contactId });
      }
    }
    return out;
  };
  const db = {
    select: () => ({
      from: () => ({
        innerJoin: () => ({
          // listDueReminderContactIds' ONE-innerJoin chain: where -> groupBy
          // -> having -> orderBy -> limit.
          where: () => ({
            groupBy: () => ({
              having: () => ({
                orderBy: () => ({
                  limit: async () => dueContactIdRows(),
                }),
              }),
            }),
          }),
          // listOutstandingForEvent's join chain (MAX_REMINDER_SCAN wave-56
          // amendment added a trailing .limit() after .where()).
          innerJoin: () => ({
            innerJoin: () => ({
              where: () => ({
                limit: async () => rows,
              }),
            }),
          }),
        }),
        // findAccountUserIds' single-table select — no accounts in this
        // fake, so every recipient resolves to a fresh claim link. The
        // DEC-456 wave-71 amendment made this query ORDER BY user.id, so
        // the chain is where -> orderBy.
        where: () => ({ orderBy: async () => [] }),
      }),
    }),
    update: () => ({
      set: (values: unknown) => ({
        where: (cond: unknown) => ({
          then: (resolve: (v: unknown) => void) => {
            updateCalls.push(values);
            resolve(undefined);
          },
          // DEC-023 wave-47 claim-before-send: the cron claims every
          // candidate assignment id up front via UPDATE ... RETURNING, then
          // releases the ids of any recipient whose send threw. Dumb mock,
          // per this fake's convention: ignores `cond` and wins every id.
          returning: async () => {
            updateCalls.push(values);
            void cond;
            return rows.map((r) => ({ id: r.assignmentId }));
          },
        }),
      }),
    }),
  } as unknown as Db;
  return { db, updateCalls };
}

function throwingForEmail(badEmail: string): { mailer: Mailer; sent: Array<{ to: { email: string } }> } {
  const sent: Array<{ to: { email: string } }> = [];
  const mailer: Mailer = {
    async send(m) {
      if (m.to.email === badEmail) {
        throw new Error("simulated provider rejection");
      }
      sent.push({ to: m.to });
    },
  };
  return { mailer, sent };
}

const NOW = new Date(1_700_000_000_000);
const HOUR = 60 * 60 * 1000;

describe("sendDueRemindersForEvent (DEC-238 class 1 cron, partial mailer failure)", () => {
  it("sends to the good recipient and stamps only their assignment, despite a bad recipient throwing", async () => {
    const rows: OutstandingRowShape[] = [
      {
        assignmentId: "assign_good",
        taskId: "task_1",
        taskTitle: "Hotel stay requirement form",
        dueDate: new Date(NOW.getTime() - HOUR),
        status: "pending",
        lastRemindedAt: null,
        contactId: "contact_good",
        firstName: "Priya",
        lastName: "Raman",
        email: "good@example.com",
        eventId: "event_1",
        eventName: "DevFlow Conf 2027",
        timezone: "America/Los_Angeles",
        eventEndDate: "2027-12-31",
        assignmentCreatedAt: new Date(0),
      },
      {
        assignmentId: "assign_bad",
        taskId: "task_2",
        taskTitle: "Flight reimbursement form",
        dueDate: new Date(NOW.getTime() - HOUR),
        status: "pending",
        lastRemindedAt: null,
        contactId: "contact_bad",
        firstName: "Grace",
        lastName: "Hopper",
        email: "bad@example.com",
        eventId: "event_1",
        eventName: "DevFlow Conf 2027",
        timezone: "America/Los_Angeles",
        eventEndDate: "2027-12-31",
        assignmentCreatedAt: new Date(0),
      },
    ];
    const { db, updateCalls } = fakeDb(rows);
    const { mailer, sent } = throwingForEmail("bad@example.com");

    // The exported cron function must not throw even though one of the two
    // recipients' sends fails — this call itself completing without
    // throwing is part of the assertion (a throw here would fail the test).
    const count = await sendDueRemindersForEvent(db, mailer, "event_1", NOW, new InMemoryKV(), ORIGIN);

    expect(count).toBe(1);
    expect(sent).toHaveLength(1);
    expect(sent[0]?.to.email).toBe("good@example.com");
    // DEC-023 wave-47 claim-before-send: last_reminded_at is now stamped by
    // the pre-loop claim (both candidates, since the claim cannot know which
    // send will fail) and the failed recipient's stamp is RELEASED back to
    // its pre-claim value after the loop — so the net stored state is
    // unchanged from the old post-loop stamp: only the successful recipient
    // stays marked as reminded, and the bad one retries on the next tick.
    // Two writes, both batched (never one per recipient).
    expect(updateCalls).toHaveLength(2);
    expect((updateCalls[0] as { lastRemindedAt: Date | null }).lastRemindedAt).toEqual(NOW);
    expect((updateCalls[1] as { lastRemindedAt: Date | null }).lastRemindedAt).toBeNull();
    // (Which ids ride in each write is asserted at id level by
    // test/reminders-claim-before-send.test.ts and
    // test/reminders-batched-stamp.test.ts, which mock inArray to inspect
    // the bound values; this file's scope is cron-path failure resilience.)
  });
});
