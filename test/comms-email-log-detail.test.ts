// DEC-833: GET /api/v1/events/:eventId/email-log/:emailId — the "Show what
// was sent" audit route. getEmailLogById is already org-scoped
// (src/server/repo/email.ts:184); this route additionally asserts the
// stored row's eventId matches the :eventId in the path, so an id belonging
// to a different event within the SAME org still 404s (object-level
// ownership, not just org scoping).

import { afterEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { registerErrorHandler } from "../src/server/http";
import type { AppEnv, AuthInfo } from "../src/server/env";
import type { EmailLogRow } from "../src/server/repo/email";

const ORG_A = "org-a";
const ORIGIN = "https://events.example.com";

function row(overrides: Partial<EmailLogRow> = {}): EmailLogRow {
  return {
    id: "log-1",
    eventId: "evt-1",
    eventName: "DevCon",
    templateId: null,
    contactId: "ct-1",
    toEmail: "ada@example.com",
    subject: "You are in!",
    bodyText: "Hi Ada, welcome aboard.",
    bodyHtml: null,
    icsText: null,
    icsFilename: null,
    provider: "dev",
    status: "sent",
    sentAt: 1700000000000,
    ...overrides,
  };
}

const getEmailLogByIdMock = vi.fn(async (_db: unknown, id: string, _orgId: string) => {
  if (id === "log-1") return row();
  if (id === "log-foreign-event") return row({ id: "log-foreign-event", eventId: "evt-2" });
  return null;
});

vi.mock("../src/server/repo/email", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/email")>("../src/server/repo/email");
  return {
    ...actual,
    getEmailLogById: getEmailLogByIdMock,
  };
});

afterEach(() => {
  vi.clearAllMocks();
});

const organizerAuth: AuthInfo = { userId: "u-1", role: "organizer", orgId: ORG_A };

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

describe("GET /api/v1/events/:eventId/email-log/:emailId (DEC-833)", () => {
  it("returns the full stored row, org-scoped through getEmailLogById", async () => {
    const app = await buildCommsApp();
    const res = await app.request(`${ORIGIN}/api/v1/events/evt-1/email-log/log-1`, { method: "GET" }, {});

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual(row());
    expect(getEmailLogByIdMock).toHaveBeenCalledWith(expect.anything(), "log-1", ORG_A);
  });

  it("404s when the stored row's eventId does not match the path event, even though it belongs to the same org", async () => {
    const app = await buildCommsApp();
    const res = await app.request(
      `${ORIGIN}/api/v1/events/evt-1/email-log/log-foreign-event`,
      { method: "GET" },
      {},
    );

    expect(res.status).toBe(404);
  });

  it("404s when getEmailLogById returns null (unknown id, or belongs to a different org)", async () => {
    const app = await buildCommsApp();
    const res = await app.request(`${ORIGIN}/api/v1/events/evt-1/email-log/unknown`, { method: "GET" }, {});

    expect(res.status).toBe(404);
  });
});
