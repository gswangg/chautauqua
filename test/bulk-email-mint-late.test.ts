// DEC-397 wave-50 amendment (MINT LATE): POST /contacts/bulk-email used to
// mint real one-time /claim/<token> KV credentials BEFORE preflightRender
// could reject the batch — a 400 (unknown merge field) therefore still
// wrote live credentials to KV. This file guards: a rejected send performs
// ZERO KV writes, and a successful send resolves REAL (non-
// PREVIEW_CLAIM_TOKEN) portal links in the delivered body.

import { afterEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import type { AppEnv, AuthInfo } from "../src/server/env";
import { registerErrorHandler } from "../src/server/http";
import type { ContactRow } from "../src/server/repo/contacts";
import type { KVStore } from "../src/auth/claim";
import { PREVIEW_CLAIM_TOKEN } from "../src/domain/compose";

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

const sentMails: { to: { email: string }; text: string }[] = [];
vi.mock("../src/server/context", async () => {
  const actual = await vi.importActual<typeof import("../src/server/context")>("../src/server/context");
  const { ResendMailer } = await import("../src/mail/resend");
  return {
    ...actual,
    makeMailer: vi.fn((db: unknown) => {
      const fetchImpl = vi.fn(async (_url: string, init: RequestInit) => {
        const body = JSON.parse(init.body as string) as { to: string[]; text: string };
        sentMails.push({ to: { email: body.to[0]! }, text: body.text });
        return new Response(JSON.stringify({ id: "re_ok" }), { status: 200 });
      }) as unknown as typeof fetch;
      const log = actual.d1EmailLogWriter(db as never);
      return new ResendMailer(fetchImpl, "re_test_key", log, { email: "noreply@example.com", name: "Chautauqua" });
    }),
  };
});

afterEach(() => {
  vi.clearAllMocks();
  sentMails.length = 0;
});

/** Counts every put() call so a 400 can be asserted to perform ZERO KV
 * writes. */
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

const { contactsRoutes } = await import("../src/routes/api/contacts");

function buildApp() {
  const app = new Hono<AppEnv>();
  const auth: AuthInfo = { userId: "u1", role: "organizer", orgId: "org1" };
  app.use("*", async (c, next) => {
    c.set("auth", auth);
    c.set("db", { insert: () => ({ values: async () => {} }) } as never);
    await next();
  });
  registerErrorHandler(app);
  app.route("/", contactsRoutes);
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
    { KV: kv },
  );
}

describe("POST /contacts/bulk-email — MINT LATE (DEC-397 wave-50)", () => {
  it("a template referencing an unknown merge field returns 400 and performs ZERO KV writes", async () => {
    const app = buildApp();
    const kv = new CountingKV();
    const res = await postJson(
      app,
      { contactIds: ["ct-1"], eventId: "ev1", subject: "Hi {speaker_name}", bodyText: "See {no_such_field}" },
      kv,
    );

    expect(res.status).toBe(400);
    expect(kv.putCalls).toBe(0);
    expect(sentMails).toHaveLength(0);
  });

  it("a successful send resolves a REAL (non-PREVIEW_CLAIM_TOKEN) portal link in the delivered body", async () => {
    const app = buildApp();
    const kv = new CountingKV();
    const res = await postJson(
      app,
      { contactIds: ["ct-1"], eventId: "ev1", subject: "Hi {speaker_name}", bodyText: "See {portal_link}" },
      kv,
    );

    expect(res.status).toBe(200);
    expect(sentMails).toHaveLength(1);
    expect(kv.putCalls).toBeGreaterThan(0);
    expect(sentMails[0]?.text).not.toContain(PREVIEW_CLAIM_TOKEN);
    expect(sentMails[0]?.text).toMatch(/See https?:\/\/[^/]+\/claim\/\S+/);
  });
});
