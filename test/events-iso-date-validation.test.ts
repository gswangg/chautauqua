// DEC-510: event.startDate / event.endDate must be strict ISO YYYY-MM-DD at
// the API boundary. Before this, only isDateOrderValid (built on
// Date.parse) checked the dates, so non-ISO strings like 'August 5, 2026'
// or '2026-8-5' persisted verbatim and later broke downstream string-based
// date math (src/server/repo/agenda.ts computeDays / isDayWithinEventRange,
// which assume YYYY-MM-DD unconditionally). This test covers both the
// events API handlers (mocked repo, route-level, matching
// test/new-event-submittable.test.ts) and the pure isIsoDate / parseDay
// helpers directly.

import { afterEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { registerErrorHandler } from "../src/server/http";
import type { AppEnv, AuthInfo } from "../src/server/env";
import { isIsoDate } from "../src/routes/api/validators";
import { parseDay } from "../src/routes/public/query";

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

const existingEvent = {
  ...createdEvent,
  id: "event-existing",
  slug: "existing-event",
};

vi.mock("../src/server/repo/events", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/events")>(
    "../src/server/repo/events",
  );
  return {
    ...actual,
    isSlugTaken: vi.fn(async () => false),
    createEvent: vi.fn(async () => createdEvent),
    createTrack: vi.fn(async () => ({})),
    getEventForOrg: vi.fn(async () => existingEvent),
    updateEvent: vi.fn(async (_db: unknown, _eventId: string, _orgId: string, patch: unknown) => ({
      ...existingEvent,
      ...(patch as Record<string, unknown>),
    })),
  };
});

vi.mock("../src/server/repo/agenda", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/agenda")>(
    "../src/server/repo/agenda",
  );
  return {
    ...actual,
    // DEC-844: the PATCH route now also queries listSlotsOutsideWindow against
    // the real db after a successful update; this suite's db is a bare `{}`
    // mock, so stub it out (unrelated to what this file covers).
    listSlotsOutsideWindow: vi.fn(async () => ({ count: 0, sessions: [] })),
  };
});

vi.mock("../src/server/repo/breaks", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/breaks")>(
    "../src/server/repo/breaks",
  );
  return {
    ...actual,
    // DEC-844 amendment (wave 68): the PATCH route now also names the breaks
    // a narrowed window orphans, querying the real db alongside
    // listSlotsOutsideWindow above. Same reason, same stub.
    listBreaksOutsideWindow: vi.fn(async () => ({ count: 0, breaks: [] })),
  };
});

vi.mock("../src/server/repo/forms", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/forms")>(
    "../src/server/repo/forms",
  );
  return {
    ...actual,
    createDefaultForm: vi.fn(async () => ({ id: "form-default" })),
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

const BAD_DATES = ["August 5, 2026", "2026-8-5", "2026-02-30", "2026-13-01", ""];

describe("DEC-510: POST /api/v1/events rejects non-ISO dates", () => {
  for (const bad of BAD_DATES) {
    it(`rejects startDate='${bad}' with 400 and field key startDate`, async () => {
      const app = await buildApp({ userId: "u1", role: "organizer", orgId: ORG_A });
      const res = await app.request("/api/v1/events", {
        method: "POST",
        headers: { "content-type": "application/json", "x-chq-csrf": "1" },
        body: JSON.stringify({
          name: "New Event",
          slug: "new-event",
          startDate: bad,
          endDate: "2026-06-03",
          timezone: "UTC",
        }),
      });
      expect(res.status).toBe(400);
      const body = (await res.json()) as { error: { fields?: Record<string, string> } };
      expect(body.error.fields?.startDate).toBeDefined();
    });

    it(`rejects endDate='${bad}' with 400 and field key endDate`, async () => {
      const app = await buildApp({ userId: "u1", role: "organizer", orgId: ORG_A });
      const res = await app.request("/api/v1/events", {
        method: "POST",
        headers: { "content-type": "application/json", "x-chq-csrf": "1" },
        body: JSON.stringify({
          name: "New Event",
          slug: "new-event",
          startDate: "2026-06-01",
          endDate: bad,
          timezone: "UTC",
        }),
      });
      expect(res.status).toBe(400);
      const body = (await res.json()) as { error: { fields?: Record<string, string> } };
      expect(body.error.fields?.endDate).toBeDefined();
    });
  }

  it("accepts strict ISO dates", async () => {
    const app = await buildApp({ userId: "u1", role: "organizer", orgId: ORG_A });
    const res = await app.request("/api/v1/events", {
      method: "POST",
      headers: { "content-type": "application/json", "x-chq-csrf": "1" },
      body: JSON.stringify({
        name: "New Event",
        slug: "new-event",
        startDate: "2026-08-05",
        endDate: "2026-08-07",
        timezone: "UTC",
      }),
    });
    expect(res.status).toBe(201);
  });
});

describe("DEC-510: PATCH /api/v1/events/:eventId rejects non-ISO dates", () => {
  for (const bad of BAD_DATES) {
    it(`rejects startDate='${bad}' with 400 and field key startDate`, async () => {
      const app = await buildApp({ userId: "u1", role: "organizer", orgId: ORG_A });
      const res = await app.request(`/api/v1/events/${existingEvent.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json", "x-chq-csrf": "1" },
        body: JSON.stringify({ startDate: bad }),
      });
      expect(res.status).toBe(400);
      const body = (await res.json()) as { error: { fields?: Record<string, string> } };
      expect(body.error.fields?.startDate).toBeDefined();
    });

    it(`rejects endDate='${bad}' with 400 and field key endDate`, async () => {
      const app = await buildApp({ userId: "u1", role: "organizer", orgId: ORG_A });
      const res = await app.request(`/api/v1/events/${existingEvent.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json", "x-chq-csrf": "1" },
        body: JSON.stringify({ endDate: bad }),
      });
      expect(res.status).toBe(400);
      const body = (await res.json()) as { error: { fields?: Record<string, string> } };
      expect(body.error.fields?.endDate).toBeDefined();
    });
  }

  it("accepts strict ISO dates", async () => {
    const app = await buildApp({ userId: "u1", role: "organizer", orgId: ORG_A });
    const res = await app.request(`/api/v1/events/${existingEvent.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json", "x-chq-csrf": "1" },
      body: JSON.stringify({ startDate: "2026-08-05", endDate: "2026-08-07" }),
    });
    expect(res.status).toBe(200);
  });

  it("still order-checks a lone startDate against the stored endDate (effectiveStart/effectiveEnd survives)", async () => {
    // existingEvent.endDate is 2026-06-03; a startDate after that must fail
    // the order check, not merely the format check.
    const app = await buildApp({ userId: "u1", role: "organizer", orgId: ORG_A });
    const res = await app.request(`/api/v1/events/${existingEvent.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json", "x-chq-csrf": "1" },
      body: JSON.stringify({ startDate: "2026-06-10" }),
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { fields?: Record<string, string> } };
    expect(body.error.fields?.endDate).toBe("Must be on or after startDate");
  });

  it("a valid lone startDate before the stored endDate succeeds", async () => {
    const app = await buildApp({ userId: "u1", role: "organizer", orgId: ORG_A });
    const res = await app.request(`/api/v1/events/${existingEvent.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json", "x-chq-csrf": "1" },
      body: JSON.stringify({ startDate: "2026-05-01" }),
    });
    expect(res.status).toBe(200);
  });
});

describe("DEC-510: isIsoDate (pure)", () => {
  it("accepts strict YYYY-MM-DD calendar-valid dates", () => {
    expect(isIsoDate("2026-08-05")).toBe(true);
    expect(isIsoDate("2026-01-01")).toBe(true);
  });

  it("rejects non-ISO formats and calendar-invalid dates", () => {
    expect(isIsoDate("August 5, 2026")).toBe(false);
    expect(isIsoDate("2026-8-5")).toBe(false);
    expect(isIsoDate("2026-02-30")).toBe(false);
    expect(isIsoDate("2026-13-01")).toBe(false);
    expect(isIsoDate("")).toBe(false);
  });
});

describe("DEC-510: parseDay delegates to isIsoDate, never throws", () => {
  it("accepts '2026-08-05'", () => {
    expect(parseDay("2026-08-05")).toBe("2026-08-05");
  });

  it("rejects '2026-2-3' and 'not-a-day'", () => {
    expect(parseDay("2026-2-3")).toBeNull();
    expect(parseDay("not-a-day")).toBeNull();
  });

  it("returns null for undefined without throwing", () => {
    expect(() => parseDay(undefined)).not.toThrow();
    expect(parseDay(undefined)).toBeNull();
  });
});
