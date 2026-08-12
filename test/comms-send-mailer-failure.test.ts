// DEC-238 class 2 (organizer-triggered batch): a bad recipient in a compose
// send must not abort the whole batch or surface a 500 — every other
// recipient still gets sent, and the response reports a structured
// {sent, failed} summary instead. Mirrors the mocking pattern in
// test/compose-full-set.test.ts.

import { afterEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { registerErrorHandler } from "../src/server/http";
import type { AppEnv, AuthInfo } from "../src/server/env";
import type { KVStore } from "../src/auth/claim";

const ORG_A = "org-a";
const ORIGIN = "https://events.example.com";

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
    id: "sub-good",
    title: "On Engines",
    participants: [{ contactId: "ct-good", firstName: "Ada", lastName: "Lovelace", email: "good@example.com" }],
  },
  {
    id: "sub-bad",
    title: "On Failure",
    participants: [{ contactId: "ct-bad", firstName: "Grace", lastName: "Hopper", email: "bad@example.com" }],
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
  };
});

const sentMails: { to: { email: string }; text: string }[] = [];
vi.mock("../src/server/context", async () => {
  const actual = await vi.importActual<typeof import("../src/server/context")>("../src/server/context");
  return {
    ...actual,
    makeMailer: vi.fn(() => ({
      send: vi.fn(async (mail: { to: { email: string }; text: string }) => {
        if (mail.to.email === "bad@example.com") {
          throw new Error("simulated provider rejection");
        }
        sentMails.push(mail);
      }),
    })),
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

async function buildCommsApp() {
  const { commsRoutes } = await import("../src/routes/comms");
  const app = new Hono<AppEnv>();
  registerErrorHandler(app);
  app.use("*", async (c, next) => {
    c.set("auth", organizerAuth);
    c.set("db", {} as never);
    await next();
  });
  app.route("/", commsRoutes);
  return app;
}

function composeBody(submissionIds: string[]) {
  return JSON.stringify({
    submissionIds,
    subject: "Update on {talk_title}",
    bodyText: "Hi {speaker_name}, see {portal_link}.",
  });
}

describe("POST /api/v1/events/:eventId/compose/send — partial mailer failure (DEC-238 class 2)", () => {
  it("never 500s; sends the good recipient, reports the bad one in 'failed'", async () => {
    const app = await buildCommsApp();
    const res = await app.request(
      `${ORIGIN}/api/v1/events/evt-1/compose/send`,
      {
        method: "POST",
        headers: { "content-type": "application/json", "x-chq-csrf": "1" },
        body: composeBody(["sub-good", "sub-bad"]),
      },
      withEnv(new InMemoryKV()),
    );

    expect(res.status).toBe(200);
    expect(sentMails).toHaveLength(1);
    expect(sentMails[0]?.to.email).toBe("good@example.com");

    const body = (await res.json()) as {
      sent: number;
      failed: { email: string; message: string }[];
      items: unknown[];
    };
    expect(body.sent).toBe(1);
    expect(body.failed).toHaveLength(1);
    expect(body.failed[0]?.email).toBe("bad@example.com");
    expect(body.failed[0]?.message).toContain("simulated provider rejection");
  });
});
