// DEC-627 (amendment, wave 6): PATCH /api/v1/events/:eventId (and its
// nested tracks/rooms siblings) must refuse an empty body with a 400
// instead of returning 200 with the unchanged event and still bumping the
// public cache. repo/events, repo/agenda/breaks-outside-window and tracks
// are mocked so this exercises route-level wiring only -- the underlying
// updateEvent/updateTrack/updateRoom validation is covered elsewhere.

import { afterEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { registerErrorHandler } from "../src/server/http";
import type { AppEnv, AuthInfo } from "../src/server/env";

const ORG_A = "org-a";
const EVENT_ID = "event-empty-patch";
const TRACK_ID = "track-1";
const ROOM_ID = "room-1";

const existingEvent = {
  id: EVENT_ID,
  orgId: ORG_A,
  name: "Empty Patch Event",
  slug: "empty-patch-event",
  startDate: "2026-06-01",
  endDate: "2026-06-10",
  location: null,
  timezone: "UTC",
  recordPrefix: "EV",
  branding: null,
  createdAt: 0,
  updatedAt: 0,
};

vi.mock("../src/server/repo/events", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/events")>(
    "../src/server/repo/events",
  );
  return {
    ...actual,
    isSlugTaken: vi.fn(async () => false),
    getEventForOrg: vi.fn(async () => existingEvent),
    updateEvent: vi.fn(async () => {
      throw new Error("updateEvent must never be called for an empty-body PATCH");
    }),
    trackEventId: vi.fn(async () => EVENT_ID),
    updateTrack: vi.fn(async () => {
      throw new Error("updateTrack must never be called for an empty-body PATCH");
    }),
    roomEventId: vi.fn(async () => EVENT_ID),
    getRoomForEvent: vi.fn(async () => ({ id: ROOM_ID, eventId: EVENT_ID, name: "Room A", capacity: null })),
    updateRoom: vi.fn(async () => {
      throw new Error("updateRoom must never be called for an empty-body PATCH");
    }),
  };
});

afterEach(() => {
  vi.clearAllMocks();
});

// Minimal chainable select() stub -- covers trackEventId/roomEventId's own
// direct db.select() lookups (not routed through repo/events) plus the
// PATCH /events/:eventId handler's post-write listSlotsOutsideWindow /
// listBreaksOutsideWindow reads (mirrors test/events-api.test.ts's
// fakeDb/makeChain, trimmed to "no rows anywhere" since this file only
// cares about the empty-body guard, not window-narrowing behavior).
function makeChain(rows: unknown[]) {
  const chain: any = {
    from: () => chain,
    innerJoin: () => chain,
    where: () => chain,
    orderBy: () => chain,
    limit: async () => rows,
    then: (resolve: (v: unknown[]) => void) => resolve(rows),
  };
  return chain;
}

function fakeDb() {
  let call = 0;
  return {
    select: () => {
      call += 1;
      if (call === 1) return makeChain([{ eventId: EVENT_ID, recordPrefix: "EV" }]); // trackEventId/roomEventId, or (for PATCH /events/:eventId) the window-scan's own event lookup
      if (call === 2) return makeChain([{ count: 0 }]); // breaks COUNT(*)
      if (call === 3) return makeChain([{ count: 0 }]); // sessions COUNT(*)
      if (call === 4) return makeChain([]); // breaks LIMITed rows
      return makeChain([]); // sessions LIMITed rows
    },
  } as unknown as import("../src/server/context").Db;
}

async function buildApp(auth: AuthInfo | undefined) {
  const { eventsRoutes } = await import("../src/routes/api/events");
  const app = new Hono<AppEnv>();
  registerErrorHandler(app);
  app.use("*", async (c, next) => {
    if (auth) c.set("auth", auth);
    c.set("db", fakeDb());
    await next();
  });
  app.route("/api/v1", eventsRoutes);
  return app;
}

const AUTH: AuthInfo = { userId: "u1", role: "organizer", orgId: ORG_A };

describe("DEC-627 (amendment, wave 6): PATCH refuses an empty body", () => {
  it("PATCH /api/v1/events/:eventId 400s on {} without calling updateEvent", async () => {
    const app = await buildApp(AUTH);
    const res = await app.request(`/api/v1/events/${EVENT_ID}`, {
      method: "PATCH",
      headers: { "content-type": "application/json", "x-chq-csrf": "1" },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string; fields?: Record<string, string> } };
    expect(body.error.code).toBe("invalid");
    expect(body.error.fields).toBeDefined();
  });

  it("PATCH /api/v1/events/:eventId 200s when a recognised field is present", async () => {
    const { updateEvent } = await import("../src/server/repo/events");
    (updateEvent as unknown as ReturnType<typeof vi.fn>).mockImplementation(async () => existingEvent);
    const app = await buildApp(AUTH);
    const res = await app.request(`/api/v1/events/${EVENT_ID}`, {
      method: "PATCH",
      headers: { "content-type": "application/json", "x-chq-csrf": "1" },
      body: JSON.stringify({ name: "New Name" }),
    });
    expect(res.status).toBe(200);
    expect(updateEvent).toHaveBeenCalledTimes(1);
  });

  it("PATCH /api/v1/tracks/:trackId 400s on {} without calling updateTrack", async () => {
    const app = await buildApp(AUTH);
    const res = await app.request(`/api/v1/tracks/${TRACK_ID}`, {
      method: "PATCH",
      headers: { "content-type": "application/json", "x-chq-csrf": "1" },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
  });

  it("PATCH /api/v1/rooms/:roomId 400s on {} without calling updateRoom", async () => {
    const app = await buildApp(AUTH);
    const res = await app.request(`/api/v1/rooms/${ROOM_ID}`, {
      method: "PATCH",
      headers: { "content-type": "application/json", "x-chq-csrf": "1" },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
  });
});
