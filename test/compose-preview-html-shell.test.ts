// DEC-037 amendment (w49-d): the compose preview response carries the exact
// HTML shell the send call wraps every body in (composeEmailShellOptions,
// shared by both routes) — not a separately hand-typed reason string that
// can drift from it.

import { afterEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { registerErrorHandler } from "../src/server/http";
import type { AppEnv, AuthInfo } from "../src/server/env";

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

vi.mock("../src/auth/claim", async () => {
  const actual = await vi.importActual<typeof import("../src/auth/claim")>("../src/auth/claim");
  return {
    ...actual,
    createClaimToken: vi.fn(actual.createClaimToken),
  };
});

const sentMails: { text: string; html: string }[] = [];
vi.mock("../src/server/context", async () => {
  const actual = await vi.importActual<typeof import("../src/server/context")>("../src/server/context");
  return {
    ...actual,
    makeMailer: vi.fn(() => ({
      send: vi.fn(async (mail: { text: string; html: string }) => {
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

function postJson(
  app: Hono<AppEnv>,
  path: string,
  body: unknown,
  kv: { put: (...a: unknown[]) => unknown; get?: (...a: unknown[]) => unknown; delete?: (...a: unknown[]) => unknown },
) {
  return app.request(
    `${ORIGIN}${path}`,
    {
      method: "POST",
      headers: { "content-type": "application/json", "x-chq-csrf": "1" },
      body: JSON.stringify(body),
    },
    { KV: kv, PUBLIC_BASE_URL: ORIGIN },
  );
}

describe("compose/preview html carries the send shell (DEC-037 amendment)", () => {
  it("preview items carry html with the 560px shell table and the same footer reason as send", async () => {
    const previewApp = await buildApp();
    const previewRes = await postJson(
      previewApp,
      "/api/v1/events/evt-1/compose/preview",
      { submissionIds: ["sub-a"], subject: "Update", bodyText: "Hi {speaker_name}" },
      { put: vi.fn() },
    );
    expect(previewRes.status).toBe(200);
    const previewBody = (await previewRes.json()) as { items: { html: string }[] };
    expect(previewBody.items).toHaveLength(1);
    const html = previewBody.items[0]!.html;
    expect(html).toContain("width:560px");
    expect(html).toContain("you&#39;re a participant in a submission at DevCon");

    const sendApp = await buildApp();
    const sendRes = await postJson(
      sendApp,
      "/api/v1/events/evt-1/compose/send",
      { submissionIds: ["sub-a"], subject: "Update", bodyText: "Hi {speaker_name}" },
      { put: vi.fn(), get: () => null, delete: () => {} },
    );
    expect(sendRes.status).toBe(200);
    expect(sentMails).toHaveLength(1);

    // Both routes' html came from the SAME shared helper: the footer reason
    // clause and the shell markup match byte-for-byte modulo the rendered
    // body text (identical templates/inputs here, so they match exactly).
    expect(sentMails[0]!.html).toBe(html);
  });
});
