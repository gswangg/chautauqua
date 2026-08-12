// DEC-420 (superseded in its timezone claim by DEC-522): reminder emails
// carry one line per outstanding task with its own due date — never
// toISOString, never one aggregate date for a group. DEC-522: a task due
// date is a DAY LABEL (UTC-midnight), not an instant — buildReminderMessage
// must format it via formatCalendarDate (no timezone re-interpretation), so
// the reminder line names the same calendar day the admin grid shows,
// regardless of the event's own timezone. Same fake-Db harness convention as
// test/tasks-due-reminders.test.ts (this repo's vitest run is plain node, no
// D1/miniflare binding).
import { describe, expect, it } from "vitest";
import { remindNow } from "../src/server/repo/tasks";
import type { Db } from "../src/server/context";
import type { Mailer } from "../src/mail/types";

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

function fakeMailer(): { mailer: Mailer; sent: Array<{ to: { email: string }; subject: string; text: string }> } {
  const sent: Array<{ to: { email: string }; subject: string; text: string }> = [];
  const mailer: Mailer = {
    async send(m) {
      sent.push({ to: m.to, subject: m.subject, text: m.text });
    },
  };
  return { mailer, sent };
}

const NOW = new Date(1_700_000_000_000);

describe("reminder email due dates (DEC-522: formatCalendarDate per-task, no aggregate date, no timezone re-interpretation)", () => {
  it("names the same calendar day as the stored UTC-midnight label, for a Pacific-timezone event", async () => {
    // 2027-03-02T00:00:00Z is the UTC-midnight day label for Mar 02 — under
    // the old (buggy) formatEventDate(ms, "America/Los_Angeles") path this
    // would have rolled back to Mon, Mar 01 (PST, UTC-8). DEC-522: the
    // reminder must name Tue, Mar 02 — the same day the admin grid shows —
    // regardless of the event's own timezone.
    const dueMs = Date.parse("2027-03-02T00:00:00Z");
    const rows: OutstandingRowShape[] = [
      {
        assignmentId: "assign_1",
        taskId: "task_1",
        taskTitle: "Hotel stay requirement form",
        dueDate: new Date(dueMs),
        status: "pending",
        lastRemindedAt: null,
        contactId: "contact_1",
        firstName: "Priya",
        lastName: "Raman",
        email: "speaker@example.com",
        eventId: "event_1",
        eventName: "DevFlow Conf 2027",
        timezone: "America/Los_Angeles",
      },
    ];
    const { db } = fakeDb(rows);
    const { mailer, sent } = fakeMailer();

    const result = await remindNow(db, mailer, "event_1", undefined, NOW);

    expect(result.sent).toBe(1);
    expect(sent).toHaveLength(1);
    expect(sent[0]?.text).toContain("Tue, Mar 02, 2027");
    expect(sent[0]?.text).not.toContain("Mon, Mar 01, 2027");
  });

  it("gives a contact with two different-due-date tasks both dates, each on its own line", async () => {
    const dueMsA = Date.parse("2027-03-02T00:00:00Z");
    const dueMsB = Date.parse("2027-04-15T00:00:00Z");
    const rows: OutstandingRowShape[] = [
      {
        assignmentId: "assign_a",
        taskId: "task_a",
        taskTitle: "Bio form",
        dueDate: new Date(dueMsA),
        status: "pending",
        lastRemindedAt: null,
        contactId: "contact_1",
        firstName: "Priya",
        lastName: "Raman",
        email: "speaker@example.com",
        eventId: "event_1",
        eventName: "DevFlow Conf 2027",
        timezone: "America/Los_Angeles",
      },
      {
        assignmentId: "assign_b",
        taskId: "task_b",
        taskTitle: "Headshot upload",
        dueDate: new Date(dueMsB),
        status: "pending",
        lastRemindedAt: null,
        contactId: "contact_1",
        firstName: "Priya",
        lastName: "Raman",
        email: "speaker@example.com",
        eventId: "event_1",
        eventName: "DevFlow Conf 2027",
        timezone: "America/Los_Angeles",
      },
    ];
    const { db } = fakeDb(rows);
    const { mailer, sent } = fakeMailer();

    const result = await remindNow(db, mailer, "event_1", undefined, NOW);

    expect(result.sent).toBe(1);
    expect(sent).toHaveLength(1);
    const text = sent[0]?.text ?? "";
    expect(text).toContain("- Bio form — due Tue, Mar 02, 2027");
    expect(text).toContain("- Headshot upload — due Thu, Apr 15, 2027");
  });

  it("renders 'No due date' for a task with a null due date", async () => {
    const rows: OutstandingRowShape[] = [
      {
        assignmentId: "assign_c",
        taskId: "task_c",
        taskTitle: "Speaker agreement",
        dueDate: null,
        status: "pending",
        lastRemindedAt: null,
        contactId: "contact_1",
        firstName: "Priya",
        lastName: "Raman",
        email: "speaker@example.com",
        eventId: "event_1",
        eventName: "DevFlow Conf 2027",
        timezone: "America/Los_Angeles",
      },
    ];
    const { db } = fakeDb(rows);
    const { mailer, sent } = fakeMailer();

    const result = await remindNow(db, mailer, "event_1", undefined, NOW);

    expect(result.sent).toBe(1);
    expect(sent).toHaveLength(1);
    expect(sent[0]?.text).toContain("- Speaker agreement — No due date");
  });
});
