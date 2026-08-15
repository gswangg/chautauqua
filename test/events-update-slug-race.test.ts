// DEC-111 amendment (findings wave 15, task-w15-d): PATCH /api/v1/events/:eventId
// pre-checks the new slug with isSlugTaken (a fast path, not the gate) and then
// calls the real (unmocked) updateEvent. This proves the UPDATE-side door: when
// isSlugTaken's pre-check loses a race (raced or double-submitted rename), the
// raw D1 "UNIQUE constraint failed: event.slug" thrown by the update must
// surface as the same 400 { fields: { slug: ... } } the pre-check already
// raises -- never an unhandled 500.
import { afterEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { registerErrorHandler } from "../src/server/http";
import type { AppEnv, AuthInfo } from "../src/server/env";

const ORG_A = "org-a";
const EVENT_ID = "event-race";

const existingRow = {
  id: EVENT_ID,
  orgId: ORG_A,
  name: "Raced Event",
  slug: "raced-event",
  startDate: "2026-06-01",
  endDate: "2026-06-10",
  location: null,
  timezone: "UTC",
  recordPrefix: "EV",
  brandingJson: null,
  createdAt: new Date(0),
  updatedAt: new Date(0),
};

vi.mock("../src/server/repo/events", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/events")>("../src/server/repo/events");
  return {
    ...actual,
    // Fast-path pre-check passes -- the race is only visible once the real
    // (unmocked) updateEvent's UPDATE actually runs against the fake db below.
    isSlugTaken: vi.fn(async () => false),
  };
});

afterEach(() => {
  vi.clearAllMocks();
});

function makeSelectChain(rows: unknown[]) {
  const chain: any = {
    from: () => chain,
    where: () => chain,
    limit: async () => rows,
    then: (resolve: (v: unknown[]) => void) => resolve(rows),
  };
  return chain;
}

/** Mimics a real D1/drizzle unique-constraint failure: an Error whose
 * `.cause` carries the raw SQLite message, matching isUniqueViolation's
 * documented dual check (constraints.ts). */
function raceViolation(): Error {
  const cause = new Error("UNIQUE constraint failed: event.slug");
  const wrapper = new Error("D1_ERROR");
  (wrapper as Error & { cause?: unknown }).cause = cause;
  return wrapper;
}

function fakeDb() {
  return {
    select: () => makeSelectChain([existingRow]),
    update: () => ({
      set: () => ({
        where: async () => {
          throw raceViolation();
        },
      }),
    }),
  } as unknown as import("../src/server/context").Db;
}

async function buildApp(db: unknown, auth: AuthInfo | undefined) {
  const { eventsRoutes } = await import("../src/routes/api/events");
  const app = new Hono<AppEnv>();
  registerErrorHandler(app);
  app.use("*", async (c, next) => {
    if (auth) c.set("auth", auth);
    c.set("db", db as never);
    await next();
  });
  app.route("/api/v1", eventsRoutes);
  return app;
}

describe("DEC-111: PATCH /api/v1/events/:eventId slug rename raced against a concurrent write", () => {
  it("translates the UPDATE-side unique violation into a 400 with fields.slug -- never a 500", async () => {
    const db = fakeDb();
    const app = await buildApp(db, { userId: "u1", role: "organizer", orgId: ORG_A });

    const res = await app.request(`/api/v1/events/${EVENT_ID}`, {
      method: "PATCH",
      headers: { "content-type": "application/json", "x-chq-csrf": "1" },
      body: JSON.stringify({ slug: "taken-by-the-racer" }),
    });

    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string; message: string; fields?: Record<string, string> } };
    expect(body.error.code).toBe("invalid");
    expect(body.error.fields).toEqual({ slug: "Already in use" });
  });
});
