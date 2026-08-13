// DEC-890: GET /api/v1/events/:eventId/templates joins each row's
// "Last used" onto the response via exactly ONE grouped query over
// email_log (listTemplateLastUsedAt) -- never a per-row query -- and a
// template no logged send has ever named gets lastUsedAt: null (the client
// renders that as "Not used yet").

import { afterEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { registerErrorHandler } from "../src/server/http";
import type { AppEnv, AuthInfo } from "../src/server/env";
import type { EmailTemplateRow } from "../src/server/repo/comms";

const ORG_A = "org-a";
const EVENT_ID = "evt-1";
const ORIGIN = "https://events.example.com";

function template(overrides: Partial<EmailTemplateRow> = {}): EmailTemplateRow {
  return {
    id: "tpl-1",
    eventId: EVENT_ID,
    name: "Acceptance",
    subject: "You are in!",
    bodyText: "Hi {speaker_name}",
    createdAt: 1700000000000,
    updatedAt: 1700000000000,
    ...overrides,
  };
}

const listTemplateLastUsedAtMock = vi.fn(async (_db: unknown, _eventId: string) => new Map<string, number>([["tpl-1", 1700000500000]]));

vi.mock("../src/server/repo/email", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/email")>("../src/server/repo/email");
  return {
    ...actual,
    listTemplateLastUsedAt: listTemplateLastUsedAtMock,
  };
});

vi.mock("../src/server/repo/comms", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/comms")>("../src/server/repo/comms");
  return {
    ...actual,
    listTemplates: vi.fn(async () => [
      template({ id: "tpl-1", name: "Acceptance" }),
      template({ id: "tpl-2", name: "Decline" }),
      template({ id: "tpl-3", name: "Waitlist" }),
    ]),
    countTemplates: vi.fn(async () => 3),
  };
});

vi.mock("../src/server/repo/events", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/events")>("../src/server/repo/events");
  return {
    ...actual,
    getEventForOrg: vi.fn(async (_db: unknown, eventId: string, orgId: string) =>
      eventId === EVENT_ID && orgId === ORG_A ? { id: EVENT_ID, orgId: ORG_A, name: "DevCon" } : null,
    ),
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

describe("GET /api/v1/events/:eventId/templates lastUsedAt (DEC-890)", () => {
  it("issues exactly one aggregate call for lastUsedAt regardless of row count", async () => {
    const app = await buildCommsApp();
    const res = await app.request(`${ORIGIN}/api/v1/events/${EVENT_ID}/templates`, { method: "GET" }, {});

    expect(res.status).toBe(200);
    const body = (await res.json()) as { items: unknown[] };
    expect(body.items).toHaveLength(3);
    // The 3-row response cost exactly one grouped query, not one per row.
    expect(listTemplateLastUsedAtMock).toHaveBeenCalledTimes(1);
  });

  it("joins the aggregate map onto rows: a matched id gets its timestamp, an unmatched id gets null", async () => {
    const app = await buildCommsApp();
    const res = await app.request(`${ORIGIN}/api/v1/events/${EVENT_ID}/templates`, { method: "GET" }, {});
    const body = (await res.json()) as { items: { id: string; lastUsedAt: number | null }[] };

    const byId = Object.fromEntries(body.items.map((t) => [t.id, t.lastUsedAt]));
    expect(byId["tpl-1"]).toBe(1700000500000);
    expect(byId["tpl-2"]).toBeNull();
    expect(byId["tpl-3"]).toBeNull();
  });
});
