// DEC-317: a submission whose only participant declined (or is still
// 'invited') loads with zero eligible participants once loadComposeSubmissions
// scopes to ACTIVE_INVITE_STATUSES. This atomically rejects the whole
// compose batch — before any render/send — mirroring DEC-051's
// preflightIcsSchedule pattern. Split into its own file (rather than living
// alongside test/comms-invite-scope.test.ts's unmocked repo-layer tests)
// because vi.mock is hoisted to the top of its file and would otherwise
// shadow those tests' real loadComposeSubmissions import.

import { afterEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { registerErrorHandler } from "../src/server/http";
import type { AppEnv, AuthInfo } from "../src/server/env";
import type { KVStore } from "../src/auth/claim";
import type { ComposeSubmission } from "../src/domain/compose";

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

const ORG_A = "org-a";
const ORIGIN = "https://events.example.com";

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

// Simulates DB output for a submission whose only participant declined: the
// DEC-317-scoped query returns zero participant rows for it.
const declinedOnlySubmissions: ComposeSubmission[] = [{ id: "sub-declined", title: "On Rejection", participants: [] }];

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
    loadComposeSubmissions: vi.fn(async () => declinedOnlySubmissions),
    findAccountUserId: vi.fn(async () => null),
    listFeedbackComments: vi.fn(async () => []),
  };
});

const sendSpy = vi.fn(async () => undefined);
vi.mock("../src/server/context", async () => {
  const actual = await vi.importActual<typeof import("../src/server/context")>("../src/server/context");
  return {
    ...actual,
    makeMailer: vi.fn(() => ({ send: sendSpy })),
  };
});

afterEach(() => {
  vi.clearAllMocks();
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

describe("compose preview/send reject a batch with a no-eligible-recipients submission (DEC-317)", () => {
  it("POST .../compose/send: 400s with the fields map and never calls mailer.send", async () => {
    const app = await buildCommsApp();
    const res = await app.request(
      `${ORIGIN}/api/v1/events/evt-1/compose/send`,
      {
        method: "POST",
        headers: { "content-type": "application/json", "x-chq-csrf": "1" },
        body: composeBody(["sub-declined"]),
      },
      withEnv(new InMemoryKV()),
    );

    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { fields?: Record<string, string> } };
    expect(body.error.fields).toEqual({ "sub-declined": "no eligible recipients" });
    expect(sendSpy).not.toHaveBeenCalled();
  });

  it("POST .../compose/preview: 400s with the fields map", async () => {
    const app = await buildCommsApp();
    const res = await app.request(
      `${ORIGIN}/api/v1/events/evt-1/compose/preview`,
      {
        method: "POST",
        headers: { "content-type": "application/json", "x-chq-csrf": "1" },
        body: composeBody(["sub-declined"]),
      },
      withEnv(new InMemoryKV()),
    );

    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { fields?: Record<string, string> } };
    expect(body.error.fields).toEqual({ "sub-declined": "no eligible recipients" });
  });
});
