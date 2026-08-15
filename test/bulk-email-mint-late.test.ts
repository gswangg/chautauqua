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
import { createClaimToken, readClaimToken } from "../src/auth/claim";
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

// DEC-238 wave-14 amendment: bulk-email now reads loadRecentlySent before
// sending — this test's fake db has no D1 to query, so stub the reader to
// report nothing recently sent (this test is not exercising the dedupe
// window; see test/contacts-bulk-email-dedupe.test.ts for that).
vi.mock("../src/server/repo/comms", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/comms")>("../src/server/repo/comms");
  return { ...actual, loadRecentlySent: vi.fn(async () => new Map()) };
});

// Extracts and DECODES one MIME part's body (between its header block's
// trailing blank line and the next boundary line) out of EmailBindingMailer's
// raw message, so tests can inspect the plain-text body it built.
// Per DEC-996's wave-62 amendment the serializer emits base64 body parts and a
// per-message RANDOM boundary (`chq_<uuid>`), so this stops at the next
// boundary delimiter rather than a fixed token and base64-decodes as UTF-8.
function extractPart(raw: string, contentType: string): string {
  const headerIdx = raw.indexOf(`Content-Type: ${contentType}`);
  if (headerIdx === -1) return "";
  const bodyStart = raw.indexOf("\r\n\r\n", headerIdx);
  if (bodyStart === -1) return "";
  const contentStart = bodyStart + 4;
  const boundaryIdx = raw.indexOf("\r\n--chq_", contentStart);
  const encoded = raw.slice(contentStart, boundaryIdx === -1 ? raw.length : boundaryIdx);
  const binary = atob(encoded.replace(/\s+/g, ""));
  return new TextDecoder().decode(Uint8Array.from(binary, (c) => c.charCodeAt(0)));
}

const sentMails: { to: { email: string }; text: string }[] = [];
vi.mock("../src/server/context", async () => {
  const actual = await vi.importActual<typeof import("../src/server/context")>("../src/server/context");
  const { EmailBindingMailer } = await import("../src/mail/email-binding");
  return {
    ...actual,
    makeMailer: vi.fn((db: unknown) => {
      const binding = {
        send: vi.fn(async (message: unknown) => {
          const { to, raw } = message as { to: string; raw: string };
          sentMails.push({ to: { email: to }, text: extractPart(raw, "text/plain") });
        }),
      };
      const log = actual.d1EmailLogWriter(db as never);
      return new EmailBindingMailer(binding, log, { email: "noreply@example.com", name: "Chautauqua" }, (_from, to, raw) => ({ to, raw }));
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
    { KV: kv, PUBLIC_BASE_URL: "https://events.example.com" },
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

  it("a template with no {portal_link} performs ZERO KV writes and leaves a pre-existing claim grant untouched (DEC-397 wave-62 amendment)", async () => {
    const app = buildApp();
    const kv = new CountingKV();
    // Seed a live claim grant for the recipient before the send — a mint
    // for an unrelated field must not revoke it (DEC-949 single-active
    // grant: createClaimToken deletes the prior grant via claim-for:<id>).
    const priorToken = await createClaimToken(kv, { contactId: "ct-1", eventId: "ev1" });
    kv.putCalls = 0;

    const res = await postJson(
      app,
      { contactIds: ["ct-1"], eventId: "ev1", subject: "Hi {speaker_name}", bodyText: "No link here." },
      kv,
    );

    expect(res.status).toBe(200);
    expect(kv.putCalls).toBe(0);
    const record = await readClaimToken(kv, priorToken);
    expect(record).toEqual({ contactId: "ct-1", eventId: "ev1" });
  });
});
