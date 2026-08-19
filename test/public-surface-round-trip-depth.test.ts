// DEC-774 (wave-34 amendment): renderSurfaceContent's public surface cases
// must issue their independent repo reads as concurrent Promise.all waves,
// not a chain of strictly-sequential awaits. This test proves concurrency
// BEHAVIOURALLY -- every getPublic* repo function is replaced with an
// instrumented stand-in that resolves only after a real macrotask delay,
// tracking the maximum number of simultaneously in-flight calls -- rather
// than a source grep for the string `Promise.all` (same discipline as
// test/reviewer-queue-round-trip-depth.test.ts, DEC-338's own ruling). A
// second set of assertions pins the total repo-call COUNT per surface shape
// (proving no read was added and no conditional skip was lost), and a third
// pins the rendered title/HTML byte-identical for the sessions and agenda
// surfaces.

import { afterEach, describe, expect, it, vi } from "vitest";

interface Tracker {
  inFlight: number;
  max: number;
  calls: string[];
}

const state = vi.hoisted(() => ({
  tracker: { inFlight: 0, max: 0, calls: [] as string[] } as Tracker,
}));

function resetTracker() {
  state.tracker.inFlight = 0;
  state.tracker.max = 0;
  state.tracker.calls = [];
}

/** Wraps a canned return value in a delayed, concurrency-tracked stand-in
 * for a real repo call -- a real macrotask delay (setTimeout) so genuinely
 * concurrent callers overlap in wall-clock time and genuinely sequential
 * callers never do, exactly like reviewer-queue-round-trip-depth's fake Db
 * chain, but at the repo-function boundary since dispatch.tsx never touches
 * a Db chain directly -- it only calls these named repo functions. */
function tracked<T>(name: string, value: T) {
  return vi.fn(async (..._args: unknown[]) => {
    state.tracker.calls.push(name);
    state.tracker.inFlight += 1;
    state.tracker.max = Math.max(state.tracker.max, state.tracker.inFlight);
    await new Promise((r) => setTimeout(r, 8));
    state.tracker.inFlight -= 1;
    return value;
  });
}

vi.mock("../src/server/repo/public", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/public")>("../src/server/repo/public");
  return {
    ...actual,
    getPublicTracks: tracked("tracks", []),
    getPublicRooms: tracked("rooms", []),
    getPublicFormatOptions: tracked("formatOptions", []),
    getPublicSessions: tracked("sessions", { items: [], total: 0 }),
    getPublicScheduleDayCounts: tracked("dayCounts", []),
    getPublicCfpWindow: tracked("cfpWindow", null),
    getPublicSpeakers: tracked("speakers", { items: [], total: 0 }),
    getPublicAgenda: tracked("agenda", { items: [], total: 0 }),
    getPublicBreaksByDay: tracked("breaks", []),
    // DEC-745 (wave-107 amendment): resolved only on the sessions
    // fresh-empty branch (see dispatch.tsx's isFreshEmpty) -- every mocked
    // sessions read here returns total:0, so the no-filter/non-embed shape
    // below is fresh-empty and does issue this read.
    getPriorPublicEvent: tracked("lastYear", null),
  };
});

import { renderSurfaceContent } from "../src/routes/public/dispatch";
import type { PublicEvent } from "../src/server/repo/public";

const EVENT: PublicEvent = {
  id: "e1",
  orgId: "org1",
  name: "Test Event",
  slug: "ev",
  startDate: "2026-08-10",
  endDate: "2026-08-11",
  location: null,
  timezone: "UTC",
  recordPrefix: "SES",
  brandingJson: null,
};

const DB = {} as Parameters<typeof renderSurfaceContent>[0];

afterEach(() => {
  vi.clearAllMocks();
  resetTracker();
});

describe("DEC-774 wave-34 amendment: public surfaces collapse their render waterfall", () => {
  it("sessions with a filter active issues a wave with >= 4 simultaneously in-flight reads", async () => {
    resetTracker();
    await renderSurfaceContent(DB, EVENT, "sessions", { q: "talk" });
    expect(state.tracker.max).toBeGreaterThanOrEqual(4);
  });

  it("speakers issues a wave with >= 2 simultaneously in-flight reads", async () => {
    resetTracker();
    await renderSurfaceContent(DB, EVENT, "speakers", {});
    expect(state.tracker.max).toBeGreaterThanOrEqual(2);
  });

  it("gallery issues a wave with >= 2 simultaneously in-flight reads", async () => {
    resetTracker();
    await renderSurfaceContent(DB, EVENT, "gallery", {});
    expect(state.tracker.max).toBeGreaterThanOrEqual(2);
  });

  it("agenda issues exactly two waves, each with >= 2 simultaneously in-flight reads", async () => {
    resetTracker();
    await renderSurfaceContent(DB, EVENT, "agenda", {});
    expect(state.tracker.max).toBeGreaterThanOrEqual(2);
    // Never all four reads concurrently: wave 2 (agenda/breaks) depends on
    // wave 1's dayCounts result for `effectiveDay`, so the two waves cannot
    // collapse into one.
    expect(state.tracker.max).toBeLessThan(4);
  });

  it("schedule issues a wave with >= 2 simultaneously in-flight reads", async () => {
    resetTracker();
    await renderSurfaceContent(DB, EVENT, "schedule", { day: "2026-08-10" });
    expect(state.tracker.max).toBeGreaterThanOrEqual(2);
  });

  it("sessions non-embed, no filter: total call count unchanged plus DEC-745's fresh-empty lastYear probe (tracks/rooms/formatOptions/sessions/dayCounts/cfpWindow/lastYear, no grandTotal probe)", async () => {
    resetTracker();
    await renderSurfaceContent(DB, EVENT, "sessions", {});
    // Every mocked getPublicSessions call here returns total:0 with no
    // filter active, i.e. the fresh-empty branch (DEC-745) -- so
    // getPriorPublicEvent is the one extra read this shape issues.
    expect(state.tracker.calls.sort()).toEqual(
      ["cfpWindow", "dayCounts", "formatOptions", "lastYear", "rooms", "sessions", "tracks"].sort(),
    );
  });

  it("sessions non-embed, filter active: total call count unchanged (adds exactly one grandTotal probe)", async () => {
    resetTracker();
    await renderSurfaceContent(DB, EVENT, "sessions", { q: "talk" });
    expect(state.tracker.calls.sort()).toEqual(
      ["cfpWindow", "dayCounts", "formatOptions", "rooms", "sessions", "sessions", "tracks"].sort(),
    );
  });

  it("sessions embed shape: total call count unchanged (rail reads and grandTotal probe both skipped)", async () => {
    resetTracker();
    await renderSurfaceContent(DB, EVENT, "sessions", { embed: true, q: "talk" });
    expect(state.tracker.calls.sort()).toEqual(["formatOptions", "rooms", "sessions", "tracks"].sort());
  });

  it("schedule without ?day=: total call count unchanged (day-switcher read skipped)", async () => {
    resetTracker();
    await renderSurfaceContent(DB, EVENT, "schedule", {});
    expect(state.tracker.calls.sort()).toEqual(["agenda", "breaks", "tracks"].sort());
  });

  // DEC-851 (wave-55 amendment): the day-switcher dayCounts read was only
  // ever there to feed the deleted `allDays` prop -- schedule never issues
  // it now, ?day= or not (a skipped read stays skipped, never
  // fetched-then-discarded).
  it("schedule with ?day=: total call count unchanged (still no day-switcher read)", async () => {
    resetTracker();
    await renderSurfaceContent(DB, EVENT, "schedule", { day: "2026-08-10" });
    expect(state.tracker.calls.sort()).toEqual(["agenda", "breaks", "tracks"].sort());
  });

  it("pins the sessions surface title and rendered HTML byte-identical", async () => {
    resetTracker();
    const { title, content } = await renderSurfaceContent(DB, EVENT, "sessions", {});
    expect(title).toBe("Sessions - Test Event");
    const html = String(content);
    expect(html).toMatchSnapshot();
  });

  it("pins the agenda surface title and rendered HTML byte-identical", async () => {
    resetTracker();
    const { title, content } = await renderSurfaceContent(DB, EVENT, "agenda", {});
    expect(title).toBe("Agenda - Test Event");
    const html = String(content);
    expect(html).toMatchSnapshot();
  });
});
