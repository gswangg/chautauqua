import { describe, expect, it } from "vitest";
import { Hono } from "hono";
import { groupHubEvents, hubState, isHubVisible, type HubEvent } from "../src/lib/home-hub";
import { rootRoutes } from "../src/routes/root";
import { HOME_CSS } from "../src/routes/public/home.css";
import type { AppEnv } from "../src/server/env";
import type { Db } from "../src/server/context";
import { registerErrorHandler } from "../src/server/http";

const NOW = Date.UTC(2026, 5, 1); // 2026-06-01
// Default start/endDate is deliberately far in the future so a test that
// doesn't care about dates never accidentally lands the event in `past`.
const DEFAULT_START = Date.UTC(2026, 9, 1);

function makeEvent(overrides: Partial<HubEvent>): HubEvent {
  return {
    id: "e1",
    name: "Event",
    slug: "event",
    startDate: DEFAULT_START,
    endDate: DEFAULT_START,
    location: null,
    timezone: "America/Los_Angeles",
    cfpCloseDate: null,
    cfpOpen: false,
    publishedSessionCount: 0,
    trackCount: 0,
    formatCount: 0,
    ...overrides,
  };
}

describe("groupHubEvents — visibility predicate (DEC-581)", () => {
  it("drops an event with a not_yet_open CFP and zero published sessions", () => {
    const event = makeEvent({ id: "e1", cfpOpen: false, publishedSessionCount: 0 });
    const sections = groupHubEvents([event], NOW);
    expect(sections.openCfp).toEqual([]);
    expect(sections.published).toEqual([]);
    expect(sections.past).toEqual([]);
  });

  it("keeps a closed CFP event that has published sessions", () => {
    const event = makeEvent({
      id: "e1",
      cfpOpen: false,
      publishedSessionCount: 3,
      startDate: Date.UTC(2026, 7, 1),
    });
    const sections = groupHubEvents([event], NOW);
    expect(sections.published.map((e) => e.id)).toEqual(["e1"]);
  });

  it("keeps an open CFP event with zero published sessions", () => {
    const event = makeEvent({
      id: "e1",
      cfpOpen: true,
      publishedSessionCount: 0,
      startDate: Date.UTC(2026, 9, 1),
    });
    const sections = groupHubEvents([event], NOW);
    expect(sections.openCfp.map((e) => e.id)).toEqual(["e1"]);
  });
});

describe("isHubVisible (DEC-581 amendment, w69-a)", () => {
  it("is true when cfpOpen is true, even with zero published sessions", () => {
    expect(isHubVisible({ cfpOpen: true, publishedSessionCount: 0 })).toBe(true);
  });

  it("is true when publishedSessionCount is positive, even with cfpOpen false", () => {
    expect(isHubVisible({ cfpOpen: false, publishedSessionCount: 1 })).toBe(true);
  });

  it("is false when neither holds", () => {
    expect(isHubVisible({ cfpOpen: false, publishedSessionCount: 0 })).toBe(false);
  });
});

describe("groupHubEvents — past boundary uses dayLabelEndInstant, not the raw day-label ms (DEC-581 amendment, w69-a)", () => {
  // endDate day label 2026-06-01, event in America/Los_Angeles (UTC-7 in
  // June). Local end-of-day is 2026-06-02T06:59:59.999Z.
  const endDate = Date.UTC(2026, 5, 1);

  it("an event whose endDate is today is NOT past at 09:00 local time in America/Los_Angeles", () => {
    // 09:00 PDT on 2026-06-01 == 16:00Z. The old `end < nowMs` compare
    // (end = UTC-midnight day label) would wrongly call this past.
    const nowMs = Date.UTC(2026, 5, 1, 16, 0, 0);
    const event = makeEvent({
      id: "e1",
      publishedSessionCount: 1,
      timezone: "America/Los_Angeles",
      startDate: endDate,
      endDate,
    });
    const sections = groupHubEvents([event], nowMs);
    expect(sections.past).toEqual([]);
    expect(sections.published.map((e) => e.id)).toEqual(["e1"]);
  });

  it("IS past once that day has ended in America/Los_Angeles", () => {
    // One ms after the local end-of-day instant.
    const nowMs = Date.UTC(2026, 5, 2, 7, 0, 0);
    const event = makeEvent({
      id: "e1",
      publishedSessionCount: 1,
      timezone: "America/Los_Angeles",
      startDate: endDate,
      endDate,
    });
    const sections = groupHubEvents([event], nowMs);
    expect(sections.past.map((e) => e.id)).toEqual(["e1"]);
    expect(sections.published).toEqual([]);
  });

  it("a UTC event's behaviour is unchanged: still past well after its end day, still not past well before it", () => {
    const utcEndDate = Date.UTC(2026, 0, 3);
    const event = makeEvent({
      id: "e1",
      publishedSessionCount: 1,
      timezone: "UTC",
      startDate: Date.UTC(2026, 0, 1),
      endDate: utcEndDate,
    });
    const pastSections = groupHubEvents([event], NOW);
    expect(pastSections.past.map((e) => e.id)).toEqual(["e1"]);

    const futureEvent = makeEvent({
      id: "e2",
      publishedSessionCount: 1,
      timezone: "UTC",
      startDate: Date.UTC(2026, 9, 1),
      endDate: Date.UTC(2026, 9, 3),
    });
    const futureSections = groupHubEvents([futureEvent], NOW);
    expect(futureSections.published.map((e) => e.id)).toEqual(["e2"]);
  });
});

describe("groupHubEvents — an ended event with no programme is dropped entirely (w11-a)", () => {
  it("a past event with cfpOpen true but zero published sessions appears in NO section", () => {
    const event = makeEvent({
      id: "e1",
      cfpOpen: true,
      publishedSessionCount: 0,
      startDate: Date.UTC(2026, 0, 1),
      endDate: Date.UTC(2026, 0, 3),
    });
    const sections = groupHubEvents([event], NOW);
    expect(sections.past).toEqual([]);
    expect(sections.openCfp).toEqual([]);
    expect(sections.published).toEqual([]);
  });

  it("a past event WITH published sessions still archives, ordering unchanged", () => {
    const a = makeEvent({
      id: "a",
      cfpOpen: true,
      publishedSessionCount: 2,
      startDate: Date.UTC(2025, 0, 1),
      endDate: Date.UTC(2025, 0, 1),
    });
    const b = makeEvent({
      id: "b",
      cfpOpen: false,
      publishedSessionCount: 1,
      startDate: Date.UTC(2025, 5, 1),
      endDate: Date.UTC(2025, 5, 1),
    });
    const sections = groupHubEvents([a, b], NOW);
    expect(sections.past.map((e) => e.id)).toEqual(["b", "a"]);
  });
});

describe("groupHubEvents — grouping", () => {
  it("buckets an ended event as past regardless of a still-open CFP window", () => {
    const event = makeEvent({
      id: "e1",
      cfpOpen: true,
      publishedSessionCount: 2,
      startDate: Date.UTC(2026, 0, 1),
      endDate: Date.UTC(2026, 0, 3),
    });
    const sections = groupHubEvents([event], NOW);
    expect(sections.past.map((e) => e.id)).toEqual(["e1"]);
    expect(sections.openCfp).toEqual([]);
  });

  it("buckets a future open-CFP event as openCfp", () => {
    const event = makeEvent({
      id: "e1",
      cfpOpen: true,
      publishedSessionCount: 0,
      startDate: Date.UTC(2026, 9, 1),
      endDate: Date.UTC(2026, 9, 3),
    });
    const sections = groupHubEvents([event], NOW);
    expect(sections.openCfp.map((e) => e.id)).toEqual(["e1"]);
  });

  it("buckets a future non-open-CFP event with published sessions as published", () => {
    const event = makeEvent({
      id: "e1",
      cfpOpen: false,
      publishedSessionCount: 5,
      startDate: Date.UTC(2026, 9, 1),
      endDate: Date.UTC(2026, 9, 3),
    });
    const sections = groupHubEvents([event], NOW);
    expect(sections.published.map((e) => e.id)).toEqual(["e1"]);
  });

  it("with default (future) dates, an open-CFP event lands in openCfp (never past)", () => {
    const event = makeEvent({ id: "e1", cfpOpen: true, publishedSessionCount: 0 });
    const sections = groupHubEvents([event], NOW);
    expect(sections.openCfp.map((e) => e.id)).toEqual(["e1"]);
  });
});

describe("groupHubEvents — ordering", () => {
  it("sorts openCfp by cfpCloseDate asc, nulls last, then id", () => {
    const a = makeEvent({ id: "a", cfpOpen: true, cfpCloseDate: null });
    const b = makeEvent({ id: "b", cfpOpen: true, cfpCloseDate: Date.UTC(2026, 9, 1) });
    const c = makeEvent({ id: "c", cfpOpen: true, cfpCloseDate: Date.UTC(2026, 8, 1) });
    const d = makeEvent({ id: "d", cfpOpen: true, cfpCloseDate: null });
    const sections = groupHubEvents([a, b, c, d], NOW);
    expect(sections.openCfp.map((e) => e.id)).toEqual(["c", "b", "a", "d"]);
  });

  it("breaks an openCfp cfpCloseDate tie by startDate asc, then id", () => {
    const closeDate = Date.UTC(2026, 9, 1);
    const a = makeEvent({ id: "z", cfpOpen: true, cfpCloseDate: closeDate, startDate: Date.UTC(2026, 9, 5) });
    const b = makeEvent({ id: "y", cfpOpen: true, cfpCloseDate: closeDate, startDate: Date.UTC(2026, 9, 1) });
    const c = makeEvent({ id: "x", cfpOpen: true, cfpCloseDate: closeDate, startDate: Date.UTC(2026, 9, 1) });
    const sections = groupHubEvents([a, b, c], NOW);
    // b and c tie on startDate too -> broken by id (x before y).
    expect(sections.openCfp.map((e) => e.id)).toEqual(["x", "y", "z"]);
  });

  it("sorts published by startDate asc, then id", () => {
    const a = makeEvent({ id: "a", publishedSessionCount: 1, startDate: Date.UTC(2026, 9, 9) });
    const b = makeEvent({ id: "b", publishedSessionCount: 1, startDate: Date.UTC(2026, 9, 5) });
    const c = makeEvent({ id: "c", publishedSessionCount: 1, startDate: Date.UTC(2026, 9, 1) });
    const sections = groupHubEvents([a, b, c], NOW);
    expect(sections.published.map((e) => e.id)).toEqual(["c", "b", "a"]);
  });

  it("breaks a published startDate tie by id asc", () => {
    const startDate = Date.UTC(2026, 9, 1);
    const a = makeEvent({ id: "z", publishedSessionCount: 1, startDate });
    const b = makeEvent({ id: "a", publishedSessionCount: 1, startDate });
    const sections = groupHubEvents([a, b], NOW);
    expect(sections.published.map((e) => e.id)).toEqual(["a", "z"]);
  });

  it("sorts past by startDate desc, then id asc", () => {
    const a = makeEvent({ id: "a", publishedSessionCount: 1, startDate: Date.UTC(2025, 0, 1), endDate: Date.UTC(2025, 0, 1) });
    const b = makeEvent({ id: "b", publishedSessionCount: 1, startDate: Date.UTC(2025, 5, 1), endDate: Date.UTC(2025, 5, 1) });
    const c = makeEvent({ id: "c", publishedSessionCount: 1, startDate: Date.UTC(2025, 2, 1), endDate: Date.UTC(2025, 2, 1) });
    const sections = groupHubEvents([a, b, c], NOW);
    expect(sections.past.map((e) => e.id)).toEqual(["b", "c", "a"]);
  });

  it("breaks a past startDate tie by id asc", () => {
    const startDate = Date.UTC(2025, 0, 1);
    const a = makeEvent({ id: "z", publishedSessionCount: 1, startDate, endDate: startDate });
    const b = makeEvent({ id: "a", publishedSessionCount: 1, startDate, endDate: startDate });
    const sections = groupHubEvents([a, b], NOW);
    expect(sections.past.map((e) => e.id)).toEqual(["a", "z"]);
  });
});

describe("hubState (DEC-581)", () => {
  it("is 'fresh' when all three sections are empty", () => {
    expect(hubState({ openCfp: [], published: [], past: [] })).toBe("fresh");
  });

  it("is 'between_cycles' when only past has entries", () => {
    const past = [makeEvent({ id: "a" })];
    expect(hubState({ openCfp: [], published: [], past })).toBe("between_cycles");
  });

  it("is 'full' when openCfp has entries", () => {
    const openCfp = [makeEvent({ id: "a" })];
    expect(hubState({ openCfp, published: [], past: [] })).toBe("full");
  });

  it("is 'full' when published has entries", () => {
    const published = [makeEvent({ id: "a" })];
    expect(hubState({ openCfp: [], published, past: [] })).toBe("full");
  });

  it("is 'full' when everything is populated", () => {
    const openCfp = [makeEvent({ id: "a" })];
    const published = [makeEvent({ id: "b" })];
    const past = [makeEvent({ id: "c" })];
    expect(hubState({ openCfp, published, past })).toBe("full");
  });
});

// w28-a: the anonymous hub matches its authoritative frame (docs/design/
// Chautauqua Home.dc.html's desktop block, lines 32-107) -- a published row
// has exactly one action, its own meta grammar ("N sessions · full
// programme up"), and the page carries proper landmarks (one <main>, one
// <footer>, one <h1>). Same fake-db/app harness as test/root.test.ts.

function fakeDb(resultQueue: unknown[][]): Db {
  let i = 0;
  return {
    select: () => {
      const results = resultQueue[i++] ?? [];
      const chain: any = {
        from: () => chain,
        leftJoin: () => chain,
        innerJoin: () => chain,
        where: () => chain,
        orderBy: () => chain,
        limit: () => chain,
        groupBy: () => chain,
        then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) => Promise.resolve(results).then(resolve, reject),
      };
      return chain;
    },
  } as unknown as Db;
}

function fakeAssets(): Fetcher {
  return {
    async fetch() {
      return new Response("not found", { status: 404 });
    },
  } as unknown as Fetcher;
}

const ORG = { id: "org1", name: "Hub Test Org" };

function eventRow(overrides: {
  id?: string;
  name?: string;
  slug?: string;
  startDate?: string;
  endDate?: string;
  location?: string | null;
  timezone?: string;
  openMs?: number | null;
  closeMs?: number | null;
}) {
  const { openMs = null, closeMs = null, ...rest } = overrides;
  return {
    id: "e1",
    name: "DevFlow Workshops, autumn 2027",
    slug: "devflow-workshops-2027",
    startDate: "2027-10-09",
    endDate: "2027-10-10",
    location: "Fort Mason, San Francisco",
    timezone: "America/Los_Angeles",
    ...rest,
    openDate: openMs === null ? null : new Date(openMs),
    closeDate: closeMs === null ? null : new Date(closeMs),
  };
}

function buildQueue(opts: {
  events: ReturnType<typeof eventRow>[];
  countRows?: { eventId: string; count: number }[];
  trackCountRows?: { eventId: string; count: number }[];
  formatCountRows?: { eventId: string; count: number }[];
}): unknown[][] {
  const hasEvents = opts.events.length > 0;
  const countRows = hasEvents ? (opts.countRows ?? []) : [];
  const trackCountRows = hasEvents ? (opts.trackCountRows ?? []) : [];
  const formatCountRows = hasEvents ? (opts.formatCountRows ?? []) : [];
  return [[ORG], opts.events, countRows, trackCountRows, formatCountRows];
}

function buildApp(queue: unknown[][]) {
  const app = new Hono<AppEnv>();
  app.use("*", async (c, next) => {
    c.set("db", fakeDb(queue));
    await next();
  });
  app.route("/", rootRoutes);
  registerErrorHandler(app);
  return app;
}

describe("GET / — published row matches the authoritative frame (w28-a)", () => {
  it("renders exactly one action, linking to /e/:slug/sessions", async () => {
    // closed CFP (past close date) + published sessions -> lands in the
    // "published" section, not openCfp.
    const events = [eventRow({ id: "e1", closeMs: Date.now() - 30 * 86_400_000 })];
    const app = buildApp(buildQueue({ events, countRows: [{ eventId: "e1", count: 12 }] }));
    const res = await app.request("/", {}, { ASSETS: fakeAssets() });
    const body = await res.text();
    const row = body.split('class="chq-home-actions"')[1]?.split("</div>")[0] ?? "";
    const anchors = [...row.matchAll(/<a\b[^>]*>/g)];
    expect(anchors.length).toBe(1);
    const hrefMatch = anchors[0]?.[0].match(/href="([^"]*)"/);
    expect(hrefMatch?.[1]).toBe("/e/devflow-workshops-2027/sessions");
  });

  it("renders a meta line matching the published grammar, with no 'tracks' clause", async () => {
    const events = [eventRow({ id: "e1", closeMs: Date.now() - 30 * 86_400_000 })];
    const app = buildApp(
      buildQueue({ events, countRows: [{ eventId: "e1", count: 12 }], trackCountRows: [{ eventId: "e1", count: 3 }] }),
    );
    const res = await app.request("/", {}, { ASSETS: fakeAssets() });
    const body = await res.text();
    const metaMatch = body.match(/<span class="chq-home-meta">([^<]*)<\/span>/);
    expect(metaMatch?.[1]).toBe("12 sessions · full programme up");
    expect(metaMatch?.[1]).toMatch(/^\d+ sessions? · full programme up$/);
    expect(metaMatch?.[1]).not.toContain("tracks");
  });

  it("the rendered document has exactly one <main>, one <footer>, and one <h1>", async () => {
    const events = [eventRow({ id: "e1", closeMs: Date.now() - 30 * 86_400_000 })];
    const app = buildApp(buildQueue({ events, countRows: [{ eventId: "e1", count: 12 }] }));
    const res = await app.request("/", {}, { ASSETS: fakeAssets() });
    const body = await res.text();
    expect([...body.matchAll(/<main[\s>]/g)].length).toBe(1);
    expect([...body.matchAll(/<\/main>/g)].length).toBe(1);
    expect([...body.matchAll(/<footer[\s>]/g)].length).toBe(1);
    expect([...body.matchAll(/<\/footer>/g)].length).toBe(1);
    expect([...body.matchAll(/<h1[\s>]/g)].length).toBe(1);
  });
});

describe("GET / — unseeded deployment (w11-a)", () => {
  it("returns 200 with the fresh state instead of 500ing when no org row exists", async () => {
    const app = buildApp([[]]); // getHubOrg's select resolves to an empty row set
    const res = await app.request("/", {}, { ASSETS: fakeAssets() });
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toContain('<span class="chq-home-org">Chautauqua</span>');
    expect(body).toContain("<h1>Nothing here yet</h1>");
  });
});

describe("HOME_CSS — desktop frame values (w28-a)", () => {
  // DEC-582 Amendment (wave 48): the shell is full bleed and no longer
  // carries its own background/border/max-width -- the paper ground shows
  // through it (see test/public-home-full-bleed.test.ts for the full
  // shell/header/body/footer coverage).
  it("shell carries no background, border or max-width of its own", () => {
    const shellRule = HOME_CSS.split("}").find((r) => r.includes(".chq-home-shell {"));
    expect(shellRule).toBeDefined();
    expect(shellRule).not.toContain("var(--chq-paper)");
    expect(shellRule).not.toMatch(/\bborder\s*:/);
    expect(shellRule).not.toMatch(/max-width\s*:/);
  });

  it("body gap is 34px", () => {
    expect(HOME_CSS).toContain("gap: 34px");
  });

  it("footer-link-end carries the 12px rule", () => {
    const rule = HOME_CSS.split("}").find((r) => r.includes(".chq-home-footer-link-end {"));
    expect(rule).toBeDefined();
    expect(rule).toContain("font-size: 12px");
  });
});
