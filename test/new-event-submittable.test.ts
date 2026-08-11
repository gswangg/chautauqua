// DEC-301 regression coverage: a newly created event must ship a
// submittable CFP. POST /api/v1/events previously provisioned only the
// default form, leaving the event with zero tracks — the first submitter
// hit an unactionable "Select at least one track." dead end because
// src/routes/public/submit.tsx rendered a Track fieldset with nothing
// selectable. This test asserts the create-event handler now also
// provisions exactly one 'General' track (src/routes/api/events.ts).
// Repo calls are mocked so this is a pure route-level test (no D1/wrangler
// dependency in stage 1), matching the pattern in
// test/events-reviewer-access.test.ts.

import { afterEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { registerErrorHandler } from "../src/server/http";
import type { AppEnv, AuthInfo } from "../src/server/env";

const ORG_A = "org-a";

const createdEvent = {
  id: "event-new",
  orgId: ORG_A,
  name: "New Event",
  slug: "new-event",
  startDate: "2026-06-01",
  endDate: "2026-06-03",
  location: null,
  timezone: "UTC",
  recordPrefix: "A",
  branding: null,
  createdAt: 0,
  updatedAt: 0,
};

const createTrackMock = vi.fn(async (_db: unknown, eventId: string, input: { name: string; color?: string | null }) => ({
  id: "track-general",
  eventId,
  name: input.name,
  color: input.color ?? null,
  position: 0,
  createdAt: 0,
  updatedAt: 0,
}));

const createDefaultFormMock = vi.fn(async (_db: unknown, eventId: string) => ({
  id: "form-default",
  eventId,
}));

vi.mock("../src/server/repo/events", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/events")>(
    "../src/server/repo/events",
  );
  return {
    ...actual,
    isSlugTaken: vi.fn(async () => false),
    createEvent: vi.fn(async () => createdEvent),
    createTrack: createTrackMock,
  };
});

vi.mock("../src/server/repo/forms", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/forms")>(
    "../src/server/repo/forms",
  );
  return {
    ...actual,
    createDefaultForm: createDefaultFormMock,
  };
});

afterEach(() => {
  vi.clearAllMocks();
});

async function buildApp(auth: AuthInfo | undefined) {
  const { eventsRoutes } = await import("../src/routes/api/events");
  const app = new Hono<AppEnv>();
  registerErrorHandler(app);
  app.use("*", async (c, next) => {
    if (auth) c.set("auth", auth);
    c.set("db", {} as never);
    await next();
  });
  app.route("/api/v1", eventsRoutes);
  return app;
}

describe("DEC-301: POST /api/v1/events provisions a submittable CFP", () => {
  it("creates the default form AND exactly one 'General' track", async () => {
    const app = await buildApp({ userId: "u1", role: "organizer", orgId: ORG_A });
    const res = await app.request("/api/v1/events", {
      method: "POST",
      headers: { "content-type": "application/json", "x-chq-csrf": "1" },
      body: JSON.stringify({
        name: "New Event",
        slug: "new-event",
        startDate: "2026-06-01",
        endDate: "2026-06-03",
        timezone: "UTC",
      }),
    });
    expect(res.status).toBe(201);

    expect(createDefaultFormMock).toHaveBeenCalledTimes(1);
    expect(createDefaultFormMock).toHaveBeenCalledWith(expect.anything(), createdEvent.id);

    expect(createTrackMock).toHaveBeenCalledTimes(1);
    expect(createTrackMock).toHaveBeenCalledWith(expect.anything(), createdEvent.id, {
      name: "General",
      color: null,
    });
  });
});
