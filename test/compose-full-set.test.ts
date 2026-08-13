// DEC-122 (DEC-019 no-silent-skips) regression: loadComposeSubmissions
// silently excludes submission ids that don't belong to the target event
// (its contract comment in src/server/repo/comms.ts says the caller must
// validate the full set). Both compose/preview and compose/send must fail
// loudly with a 400 naming the unknown ids instead of quietly composing to
// a smaller recipient set — and send must not dispatch ANY email on that
// failure path.

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

// The repo layer only returns rows for ids that actually belong to this
// event — sub-foreign and sub-missing are requested by the tests below but
// never come back, simulating the silent-drop the repo contract promises.
const existingSubmissions = [
  {
    id: "sub-existing",
    title: "On Engines",
    seq: 1,
    participants: [{ contactId: "ct-existing", firstName: "Ada", lastName: "Lovelace", email: "ada@example.com" }],
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
    // DEC-912: buildRenderTargets now unconditionally loads schedule data
    // for `scheduled` — unrelated to this file's DEC-122 scope.
    loadIcsScheduleData: vi.fn(async () => new Map()),
  };
});

// DEC-792: buildRenderTargets now batches an outstanding-task lookup for
// {task_list}/{due_date} — stub it to zero outstanding tasks so these tests
// (unrelated to reminders) stay focused on DEC-122 full-match behavior.
vi.mock("../src/server/repo/tasks/reminders", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/tasks/reminders")>(
    "../src/server/repo/tasks/reminders",
  );
  return {
    ...actual,
    listOutstandingForEvent: vi.fn(async () => []),
  };
});

const sentMails: { to: { email: string }; text: string }[] = [];
vi.mock("../src/server/context", async () => {
  const actual = await vi.importActual<typeof import("../src/server/context")>("../src/server/context");
  return {
    ...actual,
    makeMailer: vi.fn(() => ({
      send: vi.fn(async (mail: { to: { email: string }; text: string }) => {
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

describe("POST /api/v1/events/:eventId/compose/preview — full submission-id set match (DEC-122)", () => {
  it("400s with a submissionIds field error for a nonexistent id", async () => {
    const app = await buildCommsApp();
    const res = await app.request(
      `${ORIGIN}/api/v1/events/evt-1/compose/preview`,
      {
        method: "POST",
        headers: { "content-type": "application/json", "x-chq-csrf": "1" },
        body: composeBody(["sub-existing", "sub-nonexistent"]),
      },
      withEnv(new InMemoryKV()),
    );

    expect(res.status).toBe(400);
    const payload = (await res.json()) as { error: { code: string; fields?: Record<string, string> } };
    expect(payload.error.code).toBe("invalid");
    expect(payload.error.fields?.submissionIds).toContain("sub-nonexistent");
  });

  it("400s with a submissionIds field error for an id belonging to a different event", async () => {
    const app = await buildCommsApp();
    const res = await app.request(
      `${ORIGIN}/api/v1/events/evt-1/compose/preview`,
      {
        method: "POST",
        headers: { "content-type": "application/json", "x-chq-csrf": "1" },
        body: composeBody(["sub-existing", "sub-foreign-event"]),
      },
      withEnv(new InMemoryKV()),
    );

    expect(res.status).toBe(400);
    const payload = (await res.json()) as { error: { code: string; fields?: Record<string, string> } };
    expect(payload.error.code).toBe("invalid");
    expect(payload.error.fields?.submissionIds).toContain("sub-foreign-event");
  });

  it("previews normally for a fully-valid set", async () => {
    const app = await buildCommsApp();
    const res = await app.request(
      `${ORIGIN}/api/v1/events/evt-1/compose/preview`,
      {
        method: "POST",
        headers: { "content-type": "application/json", "x-chq-csrf": "1" },
        body: composeBody(["sub-existing"]),
      },
      withEnv(new InMemoryKV()),
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as { items: { contactId: string }[] };
    expect(body.items).toHaveLength(1);
    expect(body.items[0]?.contactId).toBe("ct-existing");
  });
});

describe("POST /api/v1/events/:eventId/compose/send — full submission-id set match (DEC-122)", () => {
  it("400s with a submissionIds field error for a nonexistent id, sending ZERO emails", async () => {
    const app = await buildCommsApp();
    const res = await app.request(
      `${ORIGIN}/api/v1/events/evt-1/compose/send`,
      {
        method: "POST",
        headers: { "content-type": "application/json", "x-chq-csrf": "1" },
        body: composeBody(["sub-existing", "sub-nonexistent"]),
      },
      withEnv(new InMemoryKV()),
    );

    expect(res.status).toBe(400);
    const payload = (await res.json()) as { error: { code: string; fields?: Record<string, string> } };
    expect(payload.error.code).toBe("invalid");
    expect(payload.error.fields?.submissionIds).toContain("sub-nonexistent");
    expect(sentMails).toHaveLength(0);
  });

  it("400s with a submissionIds field error for an id belonging to a different event, sending ZERO emails", async () => {
    const app = await buildCommsApp();
    const res = await app.request(
      `${ORIGIN}/api/v1/events/evt-1/compose/send`,
      {
        method: "POST",
        headers: { "content-type": "application/json", "x-chq-csrf": "1" },
        body: composeBody(["sub-existing", "sub-foreign-event"]),
      },
      withEnv(new InMemoryKV()),
    );

    expect(res.status).toBe(400);
    const payload = (await res.json()) as { error: { code: string; fields?: Record<string, string> } };
    expect(payload.error.code).toBe("invalid");
    expect(payload.error.fields?.submissionIds).toContain("sub-foreign-event");
    expect(sentMails).toHaveLength(0);
  });

  it("sends normally for a fully-valid set", async () => {
    const app = await buildCommsApp();
    const res = await app.request(
      `${ORIGIN}/api/v1/events/evt-1/compose/send`,
      {
        method: "POST",
        headers: { "content-type": "application/json", "x-chq-csrf": "1" },
        body: composeBody(["sub-existing"]),
      },
      withEnv(new InMemoryKV()),
    );

    expect(res.status).toBe(200);
    expect(sentMails).toHaveLength(1);
    expect(sentMails[0]?.to.email).toBe("ada@example.com");
  });
});
