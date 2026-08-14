import { describe, expect, it } from "vitest";
import { Hono } from "hono";
import { icsDownloadHeaders } from "../src/mail/ics";
import { publicRoutes } from "../src/routes/public";
import { registerErrorHandler } from "../src/server/http";
import { MAX_ITINERARY_IDS } from "../src/lib/itinerary";
import { chunkIds } from "../src/lib/chunk";
import type { AppEnv } from "../src/server/env";

// DEC-080: GET /e/:slug/schedule.ics rejects ?ids= lists over
// MAX_ITINERARY_IDS with a 400 before ever touching the (unbounded, user-
// controlled) list. A minimal fake db stands in for D1 (see
// test/headshot-gate.test.ts for the established pattern) — a request that
// clears the cap check never needs to reach beyond the first two sequential
// db calls (event lookup, then getPublicAgenda's schedule-slot query) since
// an empty agenda short-circuits the rest of hydration.
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

const EVENT_ROW = {
  id: "ev1",
  orgId: "org1",
  name: "Test Event",
  slug: "conf",
  startDate: "2026-08-10",
  endDate: "2026-08-10",
  location: null,
  timezone: "UTC",
  recordPrefix: "SES",
  brandingJson: null,
};

function fakeDb(): AppEnv["Variables"]["db"] {
  let call = 0;
  return {
    select: () => {
      call += 1;
      if (call === 1) return makeChain([EVENT_ROW]);
      throw new Error(`unexpected select() call ${call}`);
    },
    selectDistinct: () => {
      call += 1;
      // getPublicAgenda's scheduleSlot query — empty rows short-circuits
      // before any further db calls (room lookup, hydrateSessions).
      return makeChain([]);
    },
  } as unknown as AppEnv["Variables"]["db"];
}

// DEC-947: schedule.ics resolves its ORGANIZER through
// resolveIcsOrganizerEmail, which requires MAIL_FROM_EMAIL or DEV_MODE="1"
// and otherwise throws (same policy as makeMailer, DEC-547). This harness
// models a local/dev deployment.
const TEST_ENV = { DEV_MODE: "1" } as unknown as AppEnv["Bindings"];

function buildApp() {
  const app = new Hono<AppEnv>();
  app.use("*", async (c, next) => {
    c.set("db", fakeDb());
    await next();
  });
  registerErrorHandler(app);
  app.route("/", publicRoutes);
  return {
    request: (path: string, init?: RequestInit) => app.request(path, init, TEST_ENV),
  };
}

describe("GET /e/:slug/schedule.ics (DEC-080 300-id cap)", () => {
  it("returns 400 naming the 300 cap for 301 ids", async () => {
    const app = buildApp();
    const ids = Array.from({ length: MAX_ITINERARY_IDS + 1 }, (_, i) => `s${i}`).join(",");
    const res = await app.request(`/e/conf/schedule.ics?ids=${ids}`);
    expect(res.status).toBe(400);
    // DEC-841 (wave 14): /e/:slug/* is an HTML surface, so the cap error is a
    // rendered page, not a JSON envelope. The 300 in the message is the point.
    expect(res.headers.get("content-type")).toMatch(/text\/html/);
    const body = await res.text();
    expect(body).toContain("300");
  });

  it("accepts exactly 300 ids", async () => {
    const app = buildApp();
    const ids = Array.from({ length: MAX_ITINERARY_IDS }, (_, i) => `s${i}`).join(",");
    const res = await app.request(`/e/conf/schedule.ics?ids=${ids}`);
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("text/calendar");
  });
});

describe("chunkIds order preservation (DEC-078)", () => {
  it("concatenating batches reproduces the original id order exactly", () => {
    const ids = Array.from({ length: 301 }, (_, i) => `id-${i}`);
    const batches = chunkIds(ids);
    expect(batches.flat()).toEqual(ids);
    expect(batches.every((b) => b.length <= 90)).toBe(true);
  });
});

describe("icsDownloadHeaders", () => {
  it("returns a text/calendar content-type", () => {
    const headers = icsDownloadHeaders("invite.ics");
    expect(headers["Content-Type"]).toBe("text/calendar; charset=utf-8");
  });

  it("serves the stored filename as an attachment", () => {
    const headers = icsDownloadHeaders("SES-014-agenda.ics");
    expect(headers["Content-Disposition"]).toBe('attachment; filename="SES-014-agenda.ics"');
  });

  it("strips header-injection characters from the filename", () => {
    const headers = icsDownloadHeaders('evil"\r\nX-Injected: 1.ics');
    expect(headers["Content-Disposition"]).not.toMatch(/[\r\n]/);
    expect(headers["Content-Disposition"]).toBe('attachment; filename="evilX-Injected: 1.ics"');
  });
});
