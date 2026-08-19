// SPEC §10 #3 (DEC-441): assisted chasing — previewRemindNow must never send
// (no mailer call) and never write (no task_assignment touch), and each
// draft it renders must equal buildReminderMessage's output for the same
// input, byte for byte, since it is the ONE builder used by both the real
// send and the preview. Fake-db harness convention follows
// test/reminders-timezone.test.ts (query-chain) and
// test/spec9-invariants.test.ts (touched-tables recording).

import { describe, expect, it } from "vitest";
import * as schema from "../src/db/schema";
import { buildReminderMessage, previewRemindNow, remindNow } from "../src/server/repo/tasks";
import { MANUAL_DEDUPE_WINDOW_MS } from "../src/domain/reminders";
import type { Db } from "../src/server/context";
import type { Mailer } from "../src/mail/types";
import type { ReminderAssignment } from "../src/domain/reminders";
import type { KVStore } from "../src/auth/claim";
import { PREVIEW_CLAIM_TOKEN } from "../src/domain/compose";

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

/** Normalizes a minted /claim/:token link to a fixed placeholder so a real
 * send's freshly-minted token doesn't fail a byte-for-byte body comparison
 * against a preview's fixed PREVIEW_CLAIM_TOKEN. */
function normalizeClaimToken(text: string): string {
  return text.replace(/\/claim\/[A-Za-z0-9_-]+/g, "/claim/TOKEN");
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

// wave-56 amendment: remindNow/previewRemindNow now call
// listRemindableContactIds FIRST (one GROUP BY/HAVING query for the chosen
// contactIds, plus two count(*) subqueries for skipped/remaining), then
// re-query listOutstandingForEvent scoped to those ids. This file's
// fixtures never set last_reminded_at, so the fake below computes the SAME
// grouping the real SQL does — eligible = every distinct pending contactId
// — without needing to evaluate the opaque drizzle-orm sql`` condition
// objects passed to .having().
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

function makeReminderSelectChain(rows: OutstandingRowShape[]) {
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
  return () => makeChain({});
}

/** Records every table touched by update()/insert() — a preview must
 * touch neither task_assignment nor any other row. */
function fakeDb(rows: OutstandingRowShape[]): { db: Db; touchedTables: unknown[] } {
  const touchedTables: unknown[] = [];
  const db = {
    select: makeReminderSelectChain(rows),
    update(table: unknown) {
      touchedTables.push(table);
      return {
        set: () => ({
          where: (cond: unknown) => ({
            then: (resolve: (v: unknown) => void) => resolve(undefined),
            // DEC-023 wave-47 claim-before-send: only the send path (remindNow)
            // ever reaches this — a preview still touches nothing, which the
            // touchedTables assertion above continues to police. Claims the
            // whole fixture set so the send path mails every seeded contact.
            returning: async () => {
              void cond;
              return rows.map((r) => ({ id: r.assignmentId }));
            },
          }),
        }),
      };
    },
    insert(table: unknown) {
      touchedTables.push(table);
      throw new Error("unexpected insert during a preview (read-only)");
    },
  } as unknown as Db;
  return { db, touchedTables };
}

/** A mailer whose send() records every call — a preview must never invoke
 * it (0 calls). */
function fakeMailer(): { mailer: Mailer; sendCalls: unknown[] } {
  const sendCalls: unknown[] = [];
  const mailer: Mailer = {
    async send(m) {
      sendCalls.push(m);
    },
  };
  return { mailer, sendCalls };
}

const NOW = new Date(1_700_000_000_000);

const ROWS: OutstandingRowShape[] = [
  {
    assignmentId: "assign_1",
    taskId: "task_1",
    taskTitle: "Hotel stay requirement form",
    dueDate: new Date(Date.parse("2027-03-02T07:30:00Z")),
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
    assignmentId: "assign_2",
    taskId: "task_2",
    taskTitle: "Speaker agreement",
    dueDate: null,
    status: "pending",
    lastRemindedAt: null,
    contactId: "contact_2",
    firstName: "Jamal",
    lastName: "Okoye",
    email: "jamal@example.com",
    eventId: "event_1",
    eventName: "DevFlow Conf 2027",
    timezone: "America/Los_Angeles",
    assignmentCreatedAt: new Date(0),
  },
  {
    assignmentId: "assign_3",
    taskId: "task_3",
    taskTitle: "Confirm bio",
    dueDate: new Date(Date.parse("2020-01-06T00:00:00Z")),
    status: "pending",
    lastRemindedAt: null,
    contactId: "contact_2",
    firstName: "Jamal",
    lastName: "Okoye",
    email: "jamal@example.com",
    eventId: "event_1",
    eventName: "DevFlow Conf 2027",
    timezone: "America/Los_Angeles",
    assignmentCreatedAt: new Date(0),
  },
];

describe("previewRemindNow (SPEC §10 #3, DEC-441)", () => {
  it("never invokes the mailer's send", async () => {
    const { db } = fakeDb(ROWS);
    const { mailer, sendCalls } = fakeMailer();
    void mailer; // previewRemindNow takes no mailer at all -- see signature below

    const result = await previewRemindNow(db, "event_1", undefined, NOW, new InMemoryKV(), ORIGIN);

    expect(result.drafts.length).toBe(2);
    expect(sendCalls).toHaveLength(0);
  });

  it("never touches task_assignment (or any table) via update/insert", async () => {
    const { db, touchedTables } = fakeDb(ROWS);

    await previewRemindNow(db, "event_1", undefined, NOW, new InMemoryKV(), ORIGIN);

    expect(touchedTables).not.toContain(schema.taskAssignment);
    expect(touchedTables).toHaveLength(0);
  });

  it("renders each draft's subject/text identically to buildReminderMessage's own output", async () => {
    const { db } = fakeDb(ROWS);

    const result = await previewRemindNow(db, "event_1", undefined, NOW, new InMemoryKV(), ORIGIN);

    const eventName = "DevFlow Conf 2027";
    const portalLink = `${ORIGIN}/claim/${PREVIEW_CLAIM_TOKEN}`;

    for (const draft of result.drafts) {
      const row = ROWS.find((r) => r.contactId === draft.contactId);
      expect(row).toBeDefined();
      const assignments: ReminderAssignment[] = ROWS.filter((r) => r.contactId === draft.contactId).map((r) => ({
        assignmentId: r.assignmentId,
        contactId: r.contactId,
        status: r.status,
        dueDate: r.dueDate ? r.dueDate.getTime() : null,
        lastRemindedAt: r.lastRemindedAt ? r.lastRemindedAt.getTime() : null,
        taskId: r.taskId,
        taskTitle: r.taskTitle,
      }));
      const expected = buildReminderMessage(eventName, assignments, portalLink);
      expect(draft.subject).toBe(expected.subject);
      expect(draft.text).toBe(expected.text);
    }
  });

  it("matches remindNow's own sent text for the same input (send path uses the same builder)", async () => {
    const { db: previewDb } = fakeDb(ROWS);
    const { db: sendDb } = fakeDb(ROWS);
    const { mailer, sendCalls } = fakeMailer();

    const preview = await previewRemindNow(previewDb, "event_1", undefined, NOW, new InMemoryKV(), ORIGIN);
    await remindNow(sendDb, mailer, "event_1", undefined, NOW, new InMemoryKV(), ORIGIN);

    expect(sendCalls).toHaveLength(2);
    for (const call of sendCalls as { to: { email: string }; subject: string; text: string }[]) {
      const draft = preview.drafts.find((d) => d.email === call.to.email);
      expect(draft).toBeDefined();
      expect(draft?.subject).toBe(call.subject);
      // DEC-559/DEC-397: preview never mints a claim token, so its body
      // matches a real send except for the token value itself.
      expect(normalizeClaimToken(draft?.text ?? "")).toBe(normalizeClaimToken(call.text));
    }
  });

  // DEC-441 wave-110 amendment: the review dialog frame draws a
  // per-recipient task list (name, dueLabel, overdue), built from the SAME
  // assignments buildReminderMessage consumes -- never re-derived from the
  // rendered text.
  it("carries each recipient's own outstanding task summary (title, dueLabel, overdue)", async () => {
    const { db } = fakeDb(ROWS);

    const result = await previewRemindNow(db, "event_1", undefined, NOW, new InMemoryKV(), ORIGIN);

    const priya = result.drafts.find((d) => d.contactId === "contact_1");
    expect(priya).toBeDefined();
    // dueDate 2027-03-02T07:30:00Z is well AFTER NOW (2023-11-14), so it is
    // not yet overdue.
    expect(priya?.tasks).toEqual([
      { title: "Hotel stay requirement form", dueLabel: "Tue 2 Mar 2027", overdue: false },
    ]);

    const jamal = result.drafts.find((d) => d.contactId === "contact_2");
    expect(jamal).toBeDefined();
    // Sorted dueDate-ascending with null last (sortReminderAssignments):
    // the overdue "Confirm bio" (due 2020) precedes the no-due-date
    // "Speaker agreement".
    expect(jamal?.tasks).toEqual([
      { title: "Confirm bio", dueLabel: "Mon 6 Jan 2020", overdue: true },
      { title: "Speaker agreement", dueLabel: "No due date", overdue: false },
    ]);
  });
});
