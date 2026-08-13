// DEC-847: a subject is one line. {task_list}/{feedback} render as
// multi-line blocks, so a compose preview/send whose subject references
// either must 400 before any submission/merge-field work — one shared
// check in resolveComposeInput covers both routes, both the typed
// subject/bodyText branch and a stored template's subject.

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

const eligibleSubmissions: ComposeSubmission[] = [
  {
    id: "sub-1",
    title: "On Rejection",
    seq: 1,
    participants: [
      {
        contactId: "c-1",
        firstName: "Ada",
        lastName: "Lovelace",
        email: "ada@example.com",
      },
    ],
  },
];

const storedTemplate = {
  id: "tpl-1",
  eventId: "evt-1",
  subject: "Reminder: {task_list}",
  bodyText: "Hi {speaker_name}, {task_list}",
};

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
    loadComposeSubmissions: vi.fn(async () => eligibleSubmissions),
    findAccountUserId: vi.fn(async () => null),
    listFeedbackComments: vi.fn(async () => []),
    findTemplateForOrg: vi.fn(async () => storedTemplate),
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

describe("compose preview/send reject a subject referencing a block merge field (DEC-847)", () => {
  it("POST .../compose/preview: 400s naming {task_list} for a typed subject", async () => {
    const app = await buildCommsApp();
    const res = await app.request(
      `${ORIGIN}/api/v1/events/evt-1/compose/preview`,
      {
        method: "POST",
        headers: { "content-type": "application/json", "x-chq-csrf": "1" },
        body: JSON.stringify({
          submissionIds: ["sub-1"],
          subject: "Reminder: {task_list}",
          bodyText: "Hi {speaker_name}, {task_list}",
        }),
      },
      withEnv(new InMemoryKV()),
    );

    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { message: string; fields?: Record<string, string> } };
    expect(body.error.message).toContain("{task_list}");
    expect(body.error.fields?.subject).toContain("{task_list}");
  });

  it("POST .../compose/send: 400s naming {task_list} and never calls mailer.send", async () => {
    const app = await buildCommsApp();
    const res = await app.request(
      `${ORIGIN}/api/v1/events/evt-1/compose/send`,
      {
        method: "POST",
        headers: { "content-type": "application/json", "x-chq-csrf": "1" },
        body: JSON.stringify({
          submissionIds: ["sub-1"],
          subject: "Reminder: {task_list}",
          bodyText: "Hi {speaker_name}, {task_list}",
        }),
      },
      withEnv(new InMemoryKV()),
    );

    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { message: string; fields?: Record<string, string> } };
    expect(body.error.message).toContain("{task_list}");
    expect(sendSpy).not.toHaveBeenCalled();
  });

  it("POST .../compose/preview: a stored template's subject with a block field 400s too", async () => {
    const app = await buildCommsApp();
    const res = await app.request(
      `${ORIGIN}/api/v1/events/evt-1/compose/preview`,
      {
        method: "POST",
        headers: { "content-type": "application/json", "x-chq-csrf": "1" },
        body: JSON.stringify({ submissionIds: ["sub-1"], templateId: "tpl-1" }),
      },
      withEnv(new InMemoryKV()),
    );

    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { message: string } };
    expect(body.error.message).toContain("{task_list}");
  });
});
