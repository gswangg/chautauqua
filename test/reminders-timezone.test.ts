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

// wave-56 amendment: remindNow now calls listRemindableContactIds FIRST (one
// GROUP BY/HAVING query for the chosen contactIds, plus two count(*)
// subqueries for skipped/remaining), then re-queries listOutstandingForEvent
// scoped to those ids. Since this file's fixtures never exercise the
// dedupe/cap boundary (see reminders-batch.test.ts / reminders-sql-batch.test.ts
// for that), the fake below computes the SAME grouping the real SQL does —
// eligible = every distinct pending contactId whose most-recent
// lastRemindedAt (if any) is outside MANUAL_DEDUPE_WINDOW_MS of `now` —
// purely from the row-shape chain, without needing to evaluate the opaque
// drizzle-orm sql`` condition objects passed to .having().
function fakeDb(rows: OutstandingRowShape[]): { db: Db; updateCalls: unknown[] } {
  const updateCalls: unknown[] = [];
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

  const db = {
    select: () => makeChain({}),
    update: () => ({
      set: (values: unknown) => ({
        where: (cond: unknown) => ({
          then: (resolve: (v: unknown) => void) => {
            updateCalls.push(values);
            resolve(undefined);
          },
          // DEC-023 wave-47 claim-before-send: sendReminderEmails claims the
          // assignment ids up front via UPDATE ... RETURNING. Dumb mock, per
          // this fake's own convention: ignores `cond` and claims the whole
          // fixture set, matching the unconditional accept every other chain
          // link here already does.
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
        assignmentCreatedAt: new Date(0),
      },
    ];
    const { db } = fakeDb(rows);
    const { mailer, sent } = fakeMailer();

    const result = await remindNow(db, mailer, "event_1", undefined, NOW, new InMemoryKV(), ORIGIN);

    expect(result.sent).toBe(1);
    expect(sent).toHaveLength(1);
    expect(sent[0]?.text).toContain("Tue 2 Mar 2027");
    expect(sent[0]?.text).not.toContain("Mon 1 Mar 2027");
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
        assignmentCreatedAt: new Date(0),
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
        assignmentCreatedAt: new Date(0),
      },
    ];
    const { db } = fakeDb(rows);
    const { mailer, sent } = fakeMailer();

    const result = await remindNow(db, mailer, "event_1", undefined, NOW, new InMemoryKV(), ORIGIN);

    expect(result.sent).toBe(1);
    expect(sent).toHaveLength(1);
    const text = sent[0]?.text ?? "";
    expect(text).toContain("- Bio form — due Tue 2 Mar 2027");
    expect(text).toContain("- Headshot upload — due Thu 15 Apr 2027");
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
        assignmentCreatedAt: new Date(0),
      },
    ];
    const { db } = fakeDb(rows);
    const { mailer, sent } = fakeMailer();

    const result = await remindNow(db, mailer, "event_1", undefined, NOW, new InMemoryKV(), ORIGIN);

    expect(result.sent).toBe(1);
    expect(sent).toHaveLength(1);
    expect(sent[0]?.text).toContain("- Speaker agreement — No due date");
  });
});
