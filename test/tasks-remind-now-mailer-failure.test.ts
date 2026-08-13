// DEC-238 class 2 (organizer-triggered "remind now"): a bad recipient's
// mailer.send() failure must not abort the batch or stamp last_reminded_at
// for that recipient — remindNow keeps sending to everyone else and reports
// the failure in its {sent, failed} result (consumed as-is by POST
// /api/v1/events/:eventId/onboarding/remind, src/routes/tasks.ts). Mirrors
// test/tasks-due-reminders.test.ts's fakeDb/fakeMailer conventions.
import { describe, expect, it } from "vitest";
import { remindNow } from "../src/server/repo/tasks";
import { d1EmailLogWriter, type Db } from "../src/server/context";
import { EmailBindingMailer, type EmailSender } from "../src/mail/email-binding";
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
  assignmentCreatedAt: Date;
}

function fakeDb(rows: OutstandingRowShape[]): { db: Db; updateCalls: unknown[]; inserts: unknown[] } {
  const updateCalls: unknown[] = [];
  const inserts: unknown[] = [];
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
    insert: () => ({
      values: async (vals: unknown) => {
        inserts.push(vals);
      },
    }),
  } as unknown as Db;
  return { db, updateCalls, inserts };
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
        assignmentCreatedAt: new Date(0),
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

  // DEC-923: reminders.ts has no logFailedSend call of its own — it inherits
  // the audit row purely from the mailer it's given. A fully-failed remindNow
  // batch driven by a REAL EmailBindingMailer (over a throwing EmailSender)
  // must still leave one 'failed' email_log row per recipient, sharing a
  // batchId — the regression the graders filed as '0 total' for a
  // fully-failed multi-recipient send.
  it("leaves a 'failed' email_log row per recipient when every send is rejected by a real EmailBindingMailer", async () => {
    const contacts = ["a", "b", "c"].map((letter, i) => ({
      assignmentId: `assign_${letter}`,
      taskId: `task_${i}`,
      taskTitle: "Flight reimbursement form",
      dueDate: new Date(NOW.getTime() - HOUR),
      status: "pending",
      lastRemindedAt: null,
      contactId: `contact_${letter}`,
      firstName: "First",
      lastName: letter.toUpperCase(),
      email: `${letter}@example.com`,
      eventId: "event_1",
      eventName: "DevFlow Conf 2027",
      timezone: "America/Los_Angeles",
      assignmentCreatedAt: new Date(0),
    }));
    const { db, updateCalls, inserts } = fakeDb(contacts);

    const throwingSender: EmailSender = {
      send: async () => {
        throw new Error("simulated total provider outage");
      },
    };
    const log = d1EmailLogWriter(db);
    const mailer: Mailer = new EmailBindingMailer(throwingSender, log, {
      email: "noreply@example.com",
      name: "Chautauqua",
    });

    const result = await remindNow(db, mailer, "event_1", undefined, NOW, new InMemoryKV(), ORIGIN);

    expect(result.sent).toBe(0);
    expect(result.failed).toHaveLength(3);
    // No recipient's assignment gets stamped when its send fails.
    expect(updateCalls).toHaveLength(0);

    const failedRows = inserts.filter((v) => (v as { status: string }).status === "failed") as {
      toEmail: string;
      batchId: string;
      status: string;
    }[];
    expect(failedRows).toHaveLength(3);
    expect(new Set(failedRows.map((r) => r.batchId)).size).toBe(1);
    expect(failedRows.map((r) => r.toEmail).sort()).toEqual(["a@example.com", "b@example.com", "c@example.com"]);
  });
});
