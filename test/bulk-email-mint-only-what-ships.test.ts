// DEC-397 wave-62 amendment (MINT ONLY WHAT SHIPS): POST /contacts/bulk-email
// used to mint real one-time /claim/<token> KV credentials BEFORE the
// intra-batch and cross-call dedupe stages could drop a recipient —
// createClaimToken supersedes the prior grant onto a 48h TTL, so minting for
// a recipient that ends up skipped would revoke their live, already-
// delivered portal link and never deliver a replacement. Mirrors
// test/bulk-email-mint-late.test.ts's mocking technique.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import type { AppEnv, AuthInfo } from "../src/server/env";
import { registerErrorHandler } from "../src/server/http";
import type { ContactRow } from "../src/server/repo/contacts";
import type { KVStore } from "../src/auth/claim";
import { createClaimToken, readClaimToken } from "../src/auth/claim";
import { dedupeKey } from "../src/domain/comms-dedupe";

const CONTACT: ContactRow = {
  id: "ct-1",
  orgId: "org1",
  firstName: "Ada",
  lastName: "Lovelace",
  email: "ada@example.com",
  phone: null,
  company: null,
  title: null,
  bio: null,
  headshotUrl: null,
  socialLinksJson: null,
  notes: null,
  customFieldsJson: null,
  createdAt: 0,
  updatedAt: 0,
};

vi.mock("../src/server/repo/contacts", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/contacts")>("../src/server/repo/contacts");
  return {
    ...actual,
    findContactsForOrg: vi.fn(async (_db: unknown, ids: string[], orgId: string) => {
      if (orgId !== "org1") return [];
      return [CONTACT].filter((c) => ids.includes(c.id));
    }),
    findAccountUserIds: vi.fn(async (_db: unknown, params: { contactId: string }[]) => new Map(params.map((p) => [p.contactId, null]))),
  };
});

vi.mock("../src/server/repo/events", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/events")>("../src/server/repo/events");
  return {
    ...actual,
    getEventForOrg: vi.fn(async (_db: unknown, eventId: string, orgId: string) =>
      orgId === "org1" && eventId === "ev1" ? { id: "ev1", name: "DevCon" } : null,
    ),
  };
});

let loggedRows: { eventId: string; toEmail: string; subject: string; sentAt: number }[] = [];

vi.mock("../src/server/repo/comms", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/comms")>("../src/server/repo/comms");
  return {
    ...actual,
    loadRecentlySent: vi.fn(
      async (_db: unknown, eventId: string, keys: { email: string; subject: string }[], cutoffMs: number) => {
        const map = new Map<string, number>();
        for (const row of loggedRows) {
          if (row.eventId !== eventId) continue;
          if (row.sentAt < cutoffMs) continue;
          const hit = keys.some(
            (k) => k.email.trim().toLowerCase() === row.toEmail.trim().toLowerCase() && k.subject === row.subject,
          );
          if (!hit) continue;
          const key = dedupeKey(row.toEmail, row.subject);
          const existing = map.get(key);
          if (existing === undefined || row.sentAt > existing) map.set(key, row.sentAt);
        }
        return map;
      },
    ),
  };
});

const sentMails: { to: string; subject: string }[] = [];
vi.mock("../src/server/context", async () => {
  const actual = await vi.importActual<typeof import("../src/server/context")>("../src/server/context");
  return {
    ...actual,
    makeMailer: vi.fn(() => ({
      send: vi.fn(async (attempt: { to: { email: string }; subject: string }) => {
        sentMails.push({ to: attempt.to.email, subject: attempt.subject });
        loggedRows.push({ eventId: "ev1", toEmail: attempt.to.email, subject: attempt.subject, sentAt: Date.now() });
      }),
    })),
  };
});

afterEach(() => {
  vi.clearAllMocks();
  sentMails.length = 0;
  loggedRows = [];
  vi.useRealTimers();
});

beforeEach(() => {
  vi.useFakeTimers();
});

/** Counts every put() call. */
class CountingKV implements KVStore {
  private readonly store = new Map<string, string>();
  putCalls = 0;
  async get(key: string): Promise<string | null> {
    return this.store.get(key) ?? null;
  }
  async put(key: string, value: string): Promise<void> {
    this.putCalls += 1;
    this.store.set(key, value);
  }
  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }
}

function buildApp() {
  const app = new Hono<AppEnv>();
  const auth: AuthInfo = { userId: "u1", role: "organizer", orgId: "org1" };
  app.use("*", async (c, next) => {
    c.set("auth", auth);
    c.set("db", { insert: () => ({ values: async () => {} }) } as never);
    await next();
  });
  registerErrorHandler(app);
  return app;
}

function postJson(app: Hono<AppEnv>, body: unknown, kv: KVStore) {
  return app.request(
    "/contacts/bulk-email",
    {
      method: "POST",
      headers: { "content-type": "application/json", "x-chq-csrf": "1" },
      body: JSON.stringify(body),
    },
    { KV: kv, PUBLIC_BASE_URL: "https://events.example.com" },
  );
}

describe("POST /contacts/bulk-email — MINT ONLY WHAT SHIPS (DEC-397 wave-62)", () => {
  it("a recipient skipped by the cross-call dedupe stage keeps their prior claim token un-superseded", async () => {
    const { contactsRoutes } = await import("../src/routes/api/contacts");
    const app = buildApp();
    app.route("/", contactsRoutes);
    const kv = new CountingKV();
    const t0 = 1_700_000_000_000;
    vi.setSystemTime(t0);

    const first = await postJson(
      app,
      { contactIds: ["ct-1"], eventId: "ev1", subject: "Reminder", bodyText: "Hi {speaker_name}." },
      kv,
    );
    expect(first.status).toBe(200);

    const priorToken = await createClaimToken(kv, { contactId: "ct-1", eventId: "ev1" });
    kv.putCalls = 0;

    vi.setSystemTime(t0 + 40_000);
    const second = await postJson(
      app,
      { contactIds: ["ct-1"], eventId: "ev1", subject: "Reminder", bodyText: "Hi {speaker_name}, see {portal_link}." },
      kv,
    );
    expect(second.status).toBe(200);
    const body = (await second.json()) as { sent: number; skipped: number };
    expect(body.sent).toBe(0);
    expect(body.skipped).toBe(1);

    expect(kv.putCalls).toBe(0);
    const record = await readClaimToken(kv, priorToken);
    expect(record).toEqual({ contactId: "ct-1", eventId: "ev1" });
  });
});
