// DEC-396: compose/preview and compose/send share resolveComposeInput's
// submissionIds validation via parseBoundedIdArray (no hand-rolled second
// cap). DEC-397: preview never mints credentials — it renders the fixed
// PREVIEW_CLAIM_TOKEN placeholder with zero KV writes, while send mints one
// real claim token per userless recipient.

import { afterEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { registerErrorHandler } from "../src/server/http";
import type { AppEnv, AuthInfo } from "../src/server/env";
import { MAX_COMPOSE_RECIPIENTS, PREVIEW_CLAIM_TOKEN } from "../src/domain/compose";

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

function submissionFixture(id: string, contactId: string, email: string) {
  return {
    id,
    title: `Talk ${id}`,
    seq: 1,
    participants: [{ contactId, firstName: "Ada", lastName: "Lovelace", email }],
  };
}

const loadComposeSubmissionsMock = vi.fn(async (_db: unknown, _eventId: string, ids: string[]) =>
  ids.map((id) => submissionFixture(id, `ct-${id}`, `${id}@example.com`)),
);

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
    loadComposeSubmissions: (...args: Parameters<typeof loadComposeSubmissionsMock>) => loadComposeSubmissionsMock(...args),
    findAccountUserId: vi.fn(async () => null),
    findAccountUserIds: vi.fn(async (_db: unknown, params: { contactId: string }[]) => new Map(params.map((p) => [p.contactId, null]))),
    listFeedbackComments: vi.fn(async () => []),
    listFeedbackCommentsForSubmissions: vi.fn(async () => new Map()),
    // DEC-912: buildRenderTargets now unconditionally loads schedule data
    // for `scheduled` — unrelated to this file's claim-token scope.
    loadIcsScheduleData: vi.fn(async () => new Map()),
  };
});

// DEC-792: stub the batched outstanding-task lookup so this claim-token
// suite doesn't need a real db for buildRenderTargets's {task_list}/
// {due_date} vars.
vi.mock("../src/server/repo/tasks/reminders", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/tasks/reminders")>(
    "../src/server/repo/tasks/reminders",
  );
  return {
    ...actual,
    listOutstandingForEvent: vi.fn(async () => []),
  };
});

// DEC-397: delegate to the real createClaimToken (which does call kv.put)
// rather than a canned return value, so puts are actually observable.
vi.mock("../src/auth/claim", async () => {
  const actual = await vi.importActual<typeof import("../src/auth/claim")>("../src/auth/claim");
  return {
    ...actual,
    createClaimToken: vi.fn(actual.createClaimToken),
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
  loadComposeSubmissionsMock.mockImplementation(async (_db: unknown, _eventId: string, ids: string[]) =>
    ids.map((id) => submissionFixture(id, `ct-${id}`, `${id}@example.com`)),
  );
});

const organizerAuth: AuthInfo = { userId: "u-1", role: "organizer", orgId: ORG_A };

async function buildApp() {
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

function postJson(app: Hono<AppEnv>, path: string, body: unknown, kv: { put: (...a: unknown[]) => unknown }) {
  return app.request(
    `${ORIGIN}${path}`,
    {
      method: "POST",
      headers: { "content-type": "application/json", "x-chq-csrf": "1" },
      body: JSON.stringify(body),
    },
    { KV: kv },
  );
}

describe("resolveComposeInput submissionIds validation (DEC-396)", () => {
  it("rejects a submissionIds array longer than MAX_COMPOSE_RECIPIENTS as 400 invalid, fields.submissionIds, no D1 read", async () => {
    const app = await buildApp();
    const tooMany = Array.from({ length: MAX_COMPOSE_RECIPIENTS + 1 }, (_, i) => `sub-${i}`);
    const res = await postJson(
      app,
      "/api/v1/events/evt-1/compose/preview",
      { submissionIds: tooMany, subject: "Hi", bodyText: "Body" },
      { put: vi.fn() },
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string; fields?: Record<string, string> } };
    expect(body.error.code).toBe("invalid");
    expect(body.error.fields?.submissionIds).toBeDefined();
    expect(loadComposeSubmissionsMock).not.toHaveBeenCalled();
  });

  it("rejects a submissionIds element longer than 64 chars as 400", async () => {
    const app = await buildApp();
    const res = await postJson(
      app,
      "/api/v1/events/evt-1/compose/preview",
      { submissionIds: ["a".repeat(65)], subject: "Hi", bodyText: "Body" },
      { put: vi.fn() },
    );
    expect(res.status).toBe(400);
    expect(loadComposeSubmissionsMock).not.toHaveBeenCalled();
  });

  it("rejects a non-string submissionIds element as 400", async () => {
    const app = await buildApp();
    const res = await postJson(
      app,
      "/api/v1/events/evt-1/compose/preview",
      { submissionIds: [123], subject: "Hi", bodyText: "Body" },
      { put: vi.fn() },
    );
    expect(res.status).toBe(400);
    expect(loadComposeSubmissionsMock).not.toHaveBeenCalled();
  });
});

describe("compose/preview vs compose/send — claim-token minting (DEC-397)", () => {
  it("preview performs zero KV puts and renders the fixed placeholder claim token", async () => {
    const app = await buildApp();
    const puts: unknown[] = [];
    const fakeKv = { put: (...args: unknown[]) => puts.push(args) };

    const res = await postJson(
      app,
      "/api/v1/events/evt-1/compose/preview",
      { submissionIds: ["sub-a", "sub-b"], subject: "Update", bodyText: "Hi {speaker_name}: {portal_link}" },
      fakeKv,
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as { items: { text: string }[] };
    expect(puts).toHaveLength(0);
    expect(body.items).toHaveLength(2);
    for (const item of body.items) {
      expect(item.text).toContain(`${ORIGIN}/claim/${PREVIEW_CLAIM_TOKEN}`);
    }
  });

  it("send mints one claim token per userless recipient", async () => {
    const app = await buildApp();
    const puts: unknown[] = [];
    const fakeKv = { put: (...args: unknown[]) => puts.push(args) };

    const res = await postJson(
      app,
      "/api/v1/events/evt-1/compose/send",
      { submissionIds: ["sub-a", "sub-b"], subject: "Update", bodyText: "Hi {speaker_name}: {portal_link}" },
      fakeKv,
    );

    expect(res.status).toBe(200);
    expect(sentMails).toHaveLength(2);
    expect(puts).toHaveLength(2);
  });
});
