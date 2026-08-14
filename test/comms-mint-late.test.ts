// DEC-397 wave-50 amendment (MINT LATE): both compose/send and CRM
// bulk-email/send used to mint real one-time /claim/<token> KV credentials
// BEFORE preflightRender could reject the batch — a 400 (e.g. an unknown
// merge field) therefore still wrote live credentials to KV, and a
// resubmit minted the whole set again. This file guards: (1) a rejected
// send performs ZERO KV writes on both fan-out paths, and (2) a successful
// send resolves REAL (non-PREVIEW_CLAIM_TOKEN) portal links in the
// delivered bodies.

import { afterEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { registerErrorHandler } from "../src/server/http";
import type { AppEnv, AuthInfo } from "../src/server/env";
import type { KVStore } from "../src/auth/claim";
import { createClaimToken, readClaimToken } from "../src/auth/claim";
import { PREVIEW_CLAIM_TOKEN } from "../src/domain/compose";

const ORG_A = "org-a";
const ORIGIN = "https://events.example.com";

/** Counts every put()/get()/delete() call so a 400 can be asserted to
 * perform ZERO KV writes (MINTING IS IO — a guard placed after the cost
 * guards nothing). */
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

const event = {
  id: "evt-1",
  orgId: ORG_A,
  name: "DevCon",
  slug: "devcon",
  startDate: "2026-01-01",
  endDate: "2026-01-02",
  location: null,
  timezone: "UTC",
  recordPrefix: "DEV",
  branding: null,
  createdAt: 0,
  updatedAt: 0,
};

const existingSubmissions = [
  {
    id: "sub-1",
    title: "On Engines",
    seq: 1,
    participants: [{ contactId: "ct-1", firstName: "Ada", lastName: "Lovelace", email: "ada@example.com" }],
  },
];

vi.mock("../src/server/repo/events", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/events")>("../src/server/repo/events");
  return {
    ...actual,
    getEventForOrg: vi.fn(async () => event),
  };
});

vi.mock("../src/server/repo/comms", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/comms")>("../src/server/repo/comms");
  return {
    ...actual,
    loadComposeSubmissions: vi.fn(async () => existingSubmissions),
    findAccountUserId: vi.fn(async () => null),
    findAccountUserIds: vi.fn(async (_db: unknown, params: { contactId: string }[]) => new Map(params.map((p) => [p.contactId, null]))),
    listFeedbackComments: vi.fn(async () => []),
    listFeedbackCommentsForSubmissions: vi.fn(async () => new Map()),
    loadIcsScheduleData: vi.fn(async () => new Map()),
  };
});

vi.mock("../src/server/repo/tasks/reminders", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/tasks/reminders")>(
    "../src/server/repo/tasks/reminders",
  );
  return {
    ...actual,
    listOutstandingForEvent: vi.fn(async () => []),
  };
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

const organizerAuth: AuthInfo = { userId: "u-1", role: "organizer", orgId: ORG_A };

function withEnv(kv: KVStore) {
  return { KV: kv as unknown as AppEnv["Bindings"]["KV"] };
}

function fakeDb() {
  const db = {
    insert: () => ({
      values: async () => {},
    }),
  };
  return db as never;
}

async function buildCommsApp() {
  const { commsRoutes } = await import("../src/routes/comms");
  const app = new Hono<AppEnv>();
  registerErrorHandler(app);
  app.use("*", async (c, next) => {
    c.set("auth", organizerAuth);
    c.set("db", fakeDb());
    await next();
  });
  app.route("/", commsRoutes);
  return app;
}

describe("POST /api/v1/events/:eventId/compose/send — MINT LATE (DEC-397 wave-50)", () => {
  it("a template referencing an unknown merge field returns 400 and performs ZERO KV writes", async () => {
    const app = await buildCommsApp();
    const kv = new CountingKV();
    const res = await app.request(
      `${ORIGIN}/api/v1/events/evt-1/compose/send`,
      {
        method: "POST",
        headers: { "content-type": "application/json", "x-chq-csrf": "1" },
        body: JSON.stringify({
          submissionIds: ["sub-1"],
          subject: "Update on {talk_title}",
          bodyText: "Hi {speaker_name}, {no_such_field}",
        }),
      },
      withEnv(kv),
    );

    expect(res.status).toBe(400);
    expect(kv.putCalls).toBe(0);
    expect(sentMails).toHaveLength(0);
  });

  it("a successful send resolves a REAL (non-PREVIEW_CLAIM_TOKEN) portal link in the delivered body", async () => {
    const app = await buildCommsApp();
    const kv = new CountingKV();
    const res = await app.request(
      `${ORIGIN}/api/v1/events/evt-1/compose/send`,
      {
        method: "POST",
        headers: { "content-type": "application/json", "x-chq-csrf": "1" },
        body: JSON.stringify({
          submissionIds: ["sub-1"],
          subject: "Update on {talk_title}",
          bodyText: "Hi {speaker_name}, see {portal_link}.",
        }),
      },
      withEnv(kv),
    );

    expect(res.status).toBe(200);
    expect(sentMails).toHaveLength(1);
    expect(kv.putCalls).toBeGreaterThan(0);
    expect(sentMails[0]?.text).not.toContain(PREVIEW_CLAIM_TOKEN);
    expect(sentMails[0]?.text).toMatch(/see https:\/\/events\.example\.com\/claim\/\S+\./);
  });

  it("a template with no {portal_link} performs ZERO KV writes and leaves a pre-existing claim grant untouched (DEC-397 wave-62 amendment)", async () => {
    const app = await buildCommsApp();
    const kv = new CountingKV();
    // Seed a live claim grant for the recipient before the send — a mint
    // for an unrelated field must not revoke it (DEC-949 single-active
    // grant: createClaimToken deletes the prior grant via claim-for:<id>).
    const priorToken = await createClaimToken(kv, { contactId: "ct-1", eventId: "evt-1" });
    kv.putCalls = 0;

    const res = await app.request(
      `${ORIGIN}/api/v1/events/evt-1/compose/send`,
      {
        method: "POST",
        headers: { "content-type": "application/json", "x-chq-csrf": "1" },
        body: JSON.stringify({
          submissionIds: ["sub-1"],
          subject: "Update on {talk_title}",
          bodyText: "Hi {speaker_name}, no link here.",
        }),
      },
      withEnv(kv),
    );

    expect(res.status).toBe(200);
    expect(kv.putCalls).toBe(0);
    const record = await readClaimToken(kv, priorToken);
    expect(record).toEqual({ contactId: "ct-1", eventId: "evt-1" });
  });
});
