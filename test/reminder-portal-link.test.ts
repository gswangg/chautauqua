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

/** A fake Db whose account-lookup select() returns exactly the account rows
 * given, keyed to the contact-id/email predicate findAccountUserIds uses. */
function fakeDb(
  rows: OutstandingRowShape[],
  accountRows: { id: string; contactId: string | null; email: string }[],
): { db: Db; updateCalls: unknown[] } {
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
        where: async () => accountRows,
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
    expect(sendKv.putCount).toBe(1);

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
