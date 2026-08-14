// DEC-559: the J6 reminder body carries the recipient's portal link via the
// ONE shared resolver (src/server/repo/portal-link.ts) — same resolver
// comms.ts (compose) uses. A contact with an account gets `${origin}/portal`,
// a contact without one gets a freshly minted `${origin}/claim/<token>`.
// previewRemindNow must mint nothing (DEC-397) and its rendered body must
// match a real send byte-for-byte except for the token. resolveBaseUrlForCron
// (DEC-559 #3) has no request to fall back to, so it throws loudly when
// PUBLIC_BASE_URL is unset.
import { describe, expect, it } from "vitest";
import { previewRemindNow, remindNow } from "../src/server/repo/tasks";
import { MANUAL_DEDUPE_WINDOW_MS } from "../src/domain/reminders";
import { resolveBaseUrlForCron } from "../src/server/origin";
import type { Db } from "../src/server/context";
import type { Mailer } from "../src/mail/types";
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
  get putCount(): number {
    return this.store.size;
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

// wave-56 amendment: remindNow/previewRemindNow now call
// listRemindableContactIds FIRST (one GROUP BY/HAVING query for the chosen
// contactIds, plus two count(*) subqueries for skipped/remaining), then
// re-query listOutstandingForEvent scoped to those ids. This file's
// fixtures never set last_reminded_at, so the fake below computes the SAME
// grouping the real SQL does — eligible = every distinct pending contactId
// — without needing to evaluate the opaque drizzle-orm sql`` condition
// objects passed to .having(). findAccountUserIds' plain
// select().from(table).where() path (no groupBy) still resolves to
// `accountRows`, unchanged.
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

/** A fake Db whose account-lookup select() returns exactly the account rows
 * given, keyed to the contact-id/email predicate findAccountUserIds uses. */
function fakeDb(
  rows: OutstandingRowShape[],
  accountRows: { id: string; contactId: string | null; email: string }[],
): { db: Db; updateCalls: unknown[] } {
  const updateCalls: unknown[] = [];
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
          // findAccountUserIds' plain select().from(user).where() path.
          resolve(accountRows);
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

const ROW_WITH_ACCOUNT: OutstandingRowShape = {
  assignmentId: "assign_account",
  taskId: "task_1",
  taskTitle: "Hotel stay requirement form",
  dueDate: new Date(NOW.getTime() - HOUR),
  status: "pending",
  lastRemindedAt: null,
  contactId: "contact_account",
  firstName: "Priya",
  lastName: "Raman",
  email: "priya@example.com",
  eventId: "event_1",
  eventName: "DevFlow Conf 2027",
  timezone: "America/Los_Angeles",
  assignmentCreatedAt: new Date(0),
};

const ROW_WITHOUT_ACCOUNT: OutstandingRowShape = {
  assignmentId: "assign_no_account",
  taskId: "task_2",
  taskTitle: "Speaker agreement",
  dueDate: new Date(NOW.getTime() - HOUR),
  status: "pending",
  lastRemindedAt: null,
  contactId: "contact_no_account",
  firstName: "Jamal",
  lastName: "Okoye",
  email: "jamal@example.com",
  eventId: "event_1",
  eventName: "DevFlow Conf 2027",
  timezone: "America/Los_Angeles",
  assignmentCreatedAt: new Date(0),
};

function normalizeClaimToken(text: string): string {
  return text.replace(/\/claim\/[A-Za-z0-9_-]+/g, "/claim/TOKEN");
}

describe("DEC-559: J6 reminder body carries the portal link via the shared resolver", () => {
  it("gives a contact with an account the /portal link", async () => {
    const { db } = fakeDb(
      [ROW_WITH_ACCOUNT],
      [{ id: "user_priya", contactId: "contact_account", email: "priya@example.com" }],
    );
    const { mailer, sent } = fakeMailer();
    const kv = new InMemoryKV();

    const result = await remindNow(db, mailer, "event_1", undefined, NOW, kv, ORIGIN);

    expect(result.sent).toBe(1);
    expect(sent[0]?.text).toContain(`${ORIGIN}/portal`);
    expect(sent[0]?.text).not.toContain("/claim/");
  });

  it("gives a contact without an account a freshly minted /claim/<token> link", async () => {
    const { db } = fakeDb([ROW_WITHOUT_ACCOUNT], []);
    const { mailer, sent } = fakeMailer();
    const kv = new InMemoryKV();

    const result = await remindNow(db, mailer, "event_1", undefined, NOW, kv, ORIGIN);

    expect(result.sent).toBe(1);
    const text = sent[0]?.text ?? "";
    const match = text.match(/\/claim\/([A-Za-z0-9_-]+)/);
    expect(match).not.toBeNull();
    const token = match?.[1] ?? "";
    expect(token.length).toBeGreaterThan(0);
    expect(token).not.toBe(PREVIEW_CLAIM_TOKEN);
    expect(text).toContain(`${ORIGIN}/claim/${token}`);
  });

  it("previewRemindNow performs zero KV puts and its body matches a real send except for the token", async () => {
    const { db: previewDb } = fakeDb([ROW_WITHOUT_ACCOUNT], []);
    const { db: sendDb } = fakeDb([ROW_WITHOUT_ACCOUNT], []);
    const { mailer, sent } = fakeMailer();
    const previewKv = new InMemoryKV();
    const sendKv = new InMemoryKV();

    const preview = await previewRemindNow(previewDb, "event_1", undefined, NOW, previewKv, ORIGIN);
    expect(previewKv.putCount).toBe(0);

    await remindNow(sendDb, mailer, "event_1", undefined, NOW, sendKv, ORIGIN);
    // DEC-949: createClaimToken now also writes the single-active-grant
    // index alongside the record — 2 puts for the one minted token.
    expect(sendKv.putCount).toBe(2);

    const draft = preview.drafts[0];
    expect(draft).toBeDefined();
    expect(draft?.text).toContain(`${ORIGIN}/claim/${PREVIEW_CLAIM_TOKEN}`);

    const sentCall = sent[0];
    expect(sentCall).toBeDefined();
    expect(normalizeClaimToken(draft?.text ?? "")).toBe(normalizeClaimToken(sentCall?.text ?? ""));
    expect(draft?.subject).toBe(sentCall?.subject);
  });
});

describe("DEC-559: resolveBaseUrlForCron", () => {
  it("throws when PUBLIC_BASE_URL is unset -- a scheduled job has no request to fall back to", () => {
    expect(() => resolveBaseUrlForCron({})).toThrow();
  });

  it("throws when PUBLIC_BASE_URL is malformed", () => {
    expect(() => resolveBaseUrlForCron({ PUBLIC_BASE_URL: "not-a-url" })).toThrow();
  });

  it("returns the parsed absolute origin when PUBLIC_BASE_URL is set", () => {
    expect(resolveBaseUrlForCron({ PUBLIC_BASE_URL: "https://events.example.com/" })).toBe(
      "https://events.example.com",
    );
  });
});
