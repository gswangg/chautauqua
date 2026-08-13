import { afterEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import {
  isDateOrderValid,
  isValidSlug,
  isValidTimezone,
} from "../src/routes/api/validators";
import { isValidHexColor } from "../src/domain/color";
import { registerErrorHandler } from "../src/server/http";
import type { AppEnv, AuthInfo } from "../src/server/env";

describe("isValidSlug", () => {
  it("accepts lowercase letters, digits, hyphens", () => {
    expect(isValidSlug("devcon-2026")).toBe(true);
    expect(isValidSlug("abc")).toBe(true);
    expect(isValidSlug("2026")).toBe(true);
  });

  it("rejects uppercase, spaces, underscores, empty", () => {
    expect(isValidSlug("DevCon")).toBe(false);
    expect(isValidSlug("dev con")).toBe(false);
    expect(isValidSlug("dev_con")).toBe(false);
    expect(isValidSlug("")).toBe(false);
    expect(isValidSlug("dev.con")).toBe(false);
  });
});

describe("isValidHexColor", () => {
  it("accepts 6-digit and 3-digit hex with or without a leading #", () => {
    expect(isValidHexColor("#336699")).toBe(true);
    expect(isValidHexColor("#FFF")).toBe(true);
    expect(isValidHexColor("#000000")).toBe(true);
    // DEC-371 amendment (wave 43): the unified grammar (src/domain/color.ts)
    // tolerates an optional leading '#' everywhere — a bare '336699' now
    // validates the same as '#336699'.
    expect(isValidHexColor("336699")).toBe(true);
  });

  it("rejects wrong length, non-hex chars", () => {
    expect(isValidHexColor("#12345")).toBe(false);
    expect(isValidHexColor("#zzzzzz")).toBe(false);
    expect(isValidHexColor("")).toBe(false);
  });
});

describe("isValidTimezone", () => {
  it("accepts well-known IANA zones", () => {
    expect(isValidTimezone("America/New_York")).toBe(true);
    expect(isValidTimezone("UTC")).toBe(true);
    expect(isValidTimezone("Europe/London")).toBe(true);
  });

  it("rejects empty and bogus zones", () => {
    expect(isValidTimezone("")).toBe(false);
    expect(isValidTimezone("   ")).toBe(false);
    expect(isValidTimezone("Not/A_Zone")).toBe(false);
  });
});

describe("isDateOrderValid", () => {
  it("accepts start before or equal to end", () => {
    expect(isDateOrderValid("2026-06-01", "2026-06-03")).toBe(true);
    expect(isDateOrderValid("2026-06-01", "2026-06-01")).toBe(true);
  });

  it("rejects end before start", () => {
    expect(isDateOrderValid("2026-06-03", "2026-06-01")).toBe(false);
  });

  it("rejects unparseable dates", () => {
    expect(isDateOrderValid("not-a-date", "2026-06-01")).toBe(false);
    expect(isDateOrderValid("2026-06-01", "not-a-date")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// DEC-844: narrowing an event's window never blocks the write, but the PATCH
// response names every placed session it unschedules. repo/events is mocked
// (its own PATCH validation/order-check behavior is already covered by
// test/events-iso-date-validation.test.ts); repo/agenda's
// listSlotsOutsideWindow runs FOR REAL against a fake db chain, so this
// exercises the actual day-range filtering, not just wiring.
// ---------------------------------------------------------------------------

const ORG_A = "org-a";
const EVENT_ID = "event-narrow";

const existingEvent = {
  id: EVENT_ID,
  orgId: ORG_A,
  name: "Narrowed Event",
  slug: "narrowed-event",
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
    updateEvent: vi.fn(async (_db: unknown, _eventId: string, _orgId: string, patch: Record<string, unknown>) => {
      const defined = Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined));
      return { ...existingEvent, ...defined };
    }),
  };
});

afterEach(() => {
  vi.clearAllMocks();
});

// Fake db: three select() calls inside listSlotsOutsideWindow — (1) the
// event row for recordPrefix, (2) a COUNT(*) over the scheduleSlot/submission
// join, (3) the LIMITed row query over the same join (DEC-844 wave 54: both
// now carry the day-outside-range condition in SQL, so the fake db is given
// the ALREADY-outside-window rows directly, standing in for what a real WHERE
// clause would have filtered down to). Mirrors the makeChain pattern
// established in test/agenda-repo.test.ts.
function makeChain(rows: unknown[], onLimit?: (n: number) => void) {
  const chain: any = {
    from: () => chain,
    innerJoin: () => chain,
    where: () => chain,
    orderBy: () => chain,
    limit: async (n: number) => {
      onLimit?.(n);
      return rows.slice(0, n);
    },
    then: (resolve: (v: unknown[]) => void) => resolve(rows),
  };
  return chain;
}

function fakeDb(outsideRows: { submissionId: string; day: string; seq: number; title: string }[]) {
  let call = 0;
  return {
    select: () => {
      call += 1;
      if (call === 1) return makeChain([{ recordPrefix: "EV" }]); // event lookup
      if (call === 2) return makeChain([{ count: outsideRows.length }]); // COUNT(*)
      return makeChain(outsideRows); // LIMITed row query
    },
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

describe("DEC-844: PATCH /api/v1/events/:eventId narrowing names unscheduled sessions", () => {
  it("applies the write and names the placed session that now falls outside the new window", async () => {
    const db = fakeDb([
      { submissionId: "sub-1", day: "2026-06-15", seq: 4, title: "Outside Talk" }, // outside new 06-01..06-05 window
      // "Inside Talk" (still inside) is not in this list — the WHERE clause
      // that would exclude it lives in SQL now, not a JS filter, so the fake
      // db is handed only what the real query would have returned.
    ]);
    const app = await buildApp(db, { userId: "u1", role: "organizer", orgId: ORG_A });

    const res = await app.request(`/api/v1/events/${EVENT_ID}`, {
      method: "PATCH",
      headers: { "content-type": "application/json", "x-chq-csrf": "1" },
      body: JSON.stringify({ endDate: "2026-06-05" }),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      startDate: string;
      endDate: string;
      unscheduledByWindow: { count: number; sessions: { submissionId: string; ref: string; title: string }[] };
    };
    // the write applied (the mocked updateEvent's patch flowed through to the response)
    expect(body.endDate).toBe("2026-06-05");
    // the payload named the session that fell outside the new window
    expect(body.unscheduledByWindow.count).toBe(1);
    expect(body.unscheduledByWindow.sessions).toEqual([
      { submissionId: "sub-1", ref: "EV-004", title: "Outside Talk", day: "2026-06-15" },
    ]);
  });

  it("reports count 0 with the key present when narrowing unschedules nothing", async () => {
    const db = fakeDb([]); // no row falls outside the (unchanged) window
    const app = await buildApp(db, { userId: "u1", role: "organizer", orgId: ORG_A });

    const res = await app.request(`/api/v1/events/${EVENT_ID}`, {
      method: "PATCH",
      headers: { "content-type": "application/json", "x-chq-csrf": "1" },
      body: JSON.stringify({ endDate: "2026-06-10" }),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { unscheduledByWindow: { count: number; sessions: unknown[] } };
    expect(body.unscheduledByWindow).toEqual({ count: 0, sessions: [] });
  });
});
