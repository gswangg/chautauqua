// DEC-238 class 2 (organizer-triggered "remind now"): a bad recipient's
// mailer.send() failure must not abort the batch or stamp last_reminded_at
// for that recipient — remindNow keeps sending to everyone else and reports
// the failure in its {sent, failed} result (consumed as-is by POST
// /api/v1/events/:eventId/onboarding/remind, src/routes/tasks.ts). Mirrors
// test/tasks-due-reminders.test.ts's fakeDb/fakeMailer conventions.
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
}

function fakeDb(rows: OutstandingRowShape[]): { db: Db; updateCalls: unknown[] } {
  const updateCalls: unknown[] = [];
  const db = {
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
      set: (values: unknown) => ({
        where: async () => {
          updateCalls.push(values);
        },
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

describe("remindNow (DEC-238 class 2 organizer batch, partial mailer failure)", () => {
  it("sends to the good recipient, reports the bad one in 'failed', never throws", async () => {
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
      },
    ];
    const { db, updateCalls } = fakeDb(rows);
    const { mailer, sent } = throwingForEmail("bad@example.com");

    const result = await remindNow(db, mailer, "event_1", undefined, NOW, new InMemoryKV(), ORIGIN);

    expect(result.sent).toBe(1);
    expect(result.failed).toHaveLength(1);
    expect(result.failed[0]?.email).toBe("bad@example.com");
    expect(sent).toHaveLength(1);
    expect(sent[0]?.to.email).toBe("good@example.com");
    // Only the successful recipient's assignment gets last_reminded_at stamped.
    expect(updateCalls).toHaveLength(1);
  });
});
