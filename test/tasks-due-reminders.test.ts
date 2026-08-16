// J6 due-date cron path (DEC-023): sendDueRemindersForEvent is the function
// runDueReminders(env) calls per outstanding event (src/routes/tasks.ts).
// This repo's test harness runs vitest in plain node with no D1/miniflare
// binding (see test/resource-file.test.ts, test/root.test.ts) — so, per
// this file's own convention (test/root.test.ts's fakeDbWithSlug), we stub
// the minimal chainable Db surface sendDueRemindersForEvent touches
// (select/where via listOutstandingForEvent, update for lastRemindedAt) and
// a fake Mailer to assert reminder emails are actually sent, never a
// status-change side effect (DEC-009: this path is due-date-driven only).
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
          // Dumb mock (per this file's own convention above): ignores `cond`
          // and claims the whole fixture set, matching the unconditional
          // accept every other chain link in this fake already does.
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

function fakeMailer(): { mailer: Mailer; sent: Array<{ to: { email: string }; subject: string }> } {
  const sent: Array<{ to: { email: string }; subject: string }> = [];
  const mailer: Mailer = {
    async send(m) {
      sent.push({ to: m.to, subject: m.subject });
    },
  };
  return { mailer, sent };
}

const NOW = new Date(1_700_000_000_000);
const HOUR = 60 * 60 * 1000;

describe("sendDueRemindersForEvent (DEC-023 due-date cron path, invoked per-event from runDueReminders)", () => {
  it("sends exactly one reminder email for an overdue, never-reminded assignment and stamps last_reminded_at", async () => {
    const rows: OutstandingRowShape[] = [
      {
        assignmentId: "assign_1",
        taskId: "task_1",
        taskTitle: "Hotel stay requirement form",
        dueDate: new Date(NOW.getTime() - HOUR),
        status: "pending",
        lastRemindedAt: null,
        contactId: "contact_1",
        firstName: "Priya",
        lastName: "Raman",
        email: "sbek-speaker@example.com",
        eventId: "event_1",
        eventName: "DevFlow Conf 2027",
        timezone: "America/Los_Angeles",
        eventEndDate: "2027-12-31",
        assignmentCreatedAt: new Date(NOW.getTime() - 200 * HOUR),
      },
    ];
    const { db, updateCalls } = fakeDb(rows);
    const { mailer, sent } = fakeMailer();

    const count = await sendDueRemindersForEvent(db, mailer, "event_1", NOW, new InMemoryKV(), ORIGIN);

    expect(count).toBe(1);
    expect(sent).toHaveLength(1);
    expect(sent[0]?.to.email).toBe("sbek-speaker@example.com");
    expect(sent[0]?.subject).toBe("Action needed: outstanding tasks for DevFlow Conf 2027");
    expect(updateCalls).toHaveLength(1);
  });

  it("sends nothing when every outstanding assignment is not yet due (DEC-023 window gate)", async () => {
    const rows: OutstandingRowShape[] = [
      {
        assignmentId: "assign_2",
        taskId: "task_2",
        taskTitle: "Flight reimbursement form",
        dueDate: new Date(NOW.getTime() + 100 * HOUR),
        status: "pending",
        lastRemindedAt: null,
        contactId: "contact_2",
        firstName: "Speaker",
        lastName: "Two",
        email: "sbek-speaker2@example.com",
        eventId: "event_1",
        eventName: "DevFlow Conf 2027",
        timezone: "America/Los_Angeles",
        eventEndDate: "2027-12-31",
        assignmentCreatedAt: new Date(NOW.getTime() - 200 * HOUR),
      },
    ];
    const { db } = fakeDb(rows);
    const { mailer, sent } = fakeMailer();

    const count = await sendDueRemindersForEvent(db, mailer, "event_1", NOW, new InMemoryKV(), ORIGIN);

    expect(count).toBe(0);
    expect(sent).toHaveLength(0);
  });

  it("returns 0 with no outstanding assignments at all (nothing to select through)", async () => {
    const { db } = fakeDb([]);
    const { mailer, sent } = fakeMailer();

    const count = await sendDueRemindersForEvent(db, mailer, "event_1", NOW, new InMemoryKV(), ORIGIN);

    expect(count).toBe(0);
    expect(sent).toHaveLength(0);
  });

  // wave-82 amendment (DEC-023): the missing-timezone guard must run BEFORE
  // zonedMinutesToUtc is called, so a row with an empty/absent
  // eventTimezone surfaces the named "no event timezone resolved" error —
  // not an opaque RangeError from the date computation one line below it
  // (which src/routes/tasks.ts's per-event try/catch would otherwise
  // swallow into failedEventIds with no useful message).
  it("throws the named 'no event timezone resolved' error, not a RangeError, for an outstanding row with an empty eventTimezone", async () => {
    const rows: OutstandingRowShape[] = [
      {
        assignmentId: "assign_3",
        taskId: "task_3",
        taskTitle: "Hotel stay requirement form",
        dueDate: new Date(NOW.getTime() - HOUR),
        status: "pending",
        lastRemindedAt: null,
        contactId: "contact_3",
        firstName: "Speaker",
        lastName: "Three",
        email: "sbek-speaker3@example.com",
        eventId: "event_1",
        eventName: "DevFlow Conf 2027",
        timezone: "",
        eventEndDate: "2027-12-31",
        assignmentCreatedAt: new Date(NOW.getTime() - 200 * HOUR),
      },
    ];
    const { db } = fakeDb(rows);
    const { mailer, sent } = fakeMailer();

    await expect(
      sendDueRemindersForEvent(db, mailer, "event_1", NOW, new InMemoryKV(), ORIGIN),
    ).rejects.toThrow("no event timezone resolved for eventId event_1");
    expect(sent).toHaveLength(0);
  });
});
