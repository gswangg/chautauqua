// DEC-683 amendment (wave 65): the printable programme -- a public,
// no-login, print-first one-page rendering of the whole published
// programme. Mirrors the vi.mock(../src/server/repo/public) pattern
// established in test/public-entry-points.test.ts / test/public-page-
// headings.test.ts (no local sqlite/D1 test driver is wired up for the
// public repo layer in this repo).

import { beforeEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";

const EVENT: import("../src/server/repo/public").PublicEvent = {
  id: "ev1",
  orgId: "org1",
  name: "Test Conf",
  slug: "conf",
  startDate: "2026-08-10",
  endDate: "2026-08-11",
  location: "Moscone West",
  timezone: "UTC",
  recordPrefix: "SES",
  brandingJson: null,
};

function agendaItem(overrides: Partial<import("../src/server/repo/public").PublicAgendaItem>): import("../src/server/repo/public").PublicAgendaItem {
  return {
    submissionId: "sub",
    ref: "SES-1",
    title: "Talk",
    description: null,
    day: "2026-08-10",
    startMin: 540,
    endMin: 600,
    roomId: "room-a",
    roomName: "Alpha Hall",
    roomPosition: 0,
    icsSequence: 0,
    tracks: [],
    speakers: [],
    format: null,
    ...overrides,
  };
}

function brk(overrides: Partial<import("../src/server/repo/breaks").ScheduleBreak>): import("../src/server/repo/breaks").ScheduleBreak {
  return {
    id: "brk-1",
    eventId: "ev1",
    day: "2026-08-10",
    label: "Lunch",
    location: "Foyer",
    startMin: 720,
    durationMin: 60,
    createdAt: 0,
    updatedAt: 0,
    ...overrides,
  };
}

// DEC-656/gates: a hidden co-presenter / unapproved session never reaches
// getPublicAgenda's returned items -- the gate is enforced INSIDE the mocked
// repo call, so "excluded by the visibility gate" here is modeled the same
// way test/public-page-headings.test.ts models every other surface's data:
// the mock simply never returns the excluded row, exactly as the real
// visibleSessionConditions()-gated SQL would.
const VISIBLE_ITEMS = [
  agendaItem({ submissionId: "s1", day: "2026-08-10", startMin: 540, endMin: 600, title: "Day One Keynote" }),
  agendaItem({ submissionId: "s2", day: "2026-08-11", startMin: 600, endMin: 660, title: "Day Two Workshop" }),
];
// A hidden-speaker / unapproved-content session that visibleSessionConditions()
// would exclude -- never appears in getPublicAgenda's mocked return, mirroring
// test/public-copresenter-visibility.test.ts's fixture shape.
const HIDDEN_TITLE = "Unapproved Hidden Talk";

const BREAKS_BY_DAY = new Map([["2026-08-10", [brk({})]]]);

// DEC-635 amendment: publicNotFound resolves its eyebrow via
// resolveNotFoundEyebrow (src/server/not-found.tsx), which reads
// repo/public/home.ts directly -- a separate module from repo/public's
// index below, so it needs its own mock against the {} test db (mirrors
// test/public-404-no-store.test.ts).
vi.mock("../src/server/repo/public/home", () => ({
  getHubOrg: vi.fn(async () => null),
  listHubEvents: vi.fn(async () => ({ items: [], capped: false })),
}));

vi.mock("../src/server/repo/public", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/public")>("../src/server/repo/public");
  return {
    ...actual,
    getPublicEventBySlug: vi.fn(async (_db: unknown, slug: string) => (slug === EVENT.slug ? EVENT : null)),
    getPublicAgenda: vi.fn(async () => ({ items: VISIBLE_ITEMS, total: VISIBLE_ITEMS.length })),
    getPublicBreaksByDay: vi.fn(async () => BREAKS_BY_DAY),
  };
});

import { publicRoutes } from "../src/routes/public";
import { registerErrorHandler } from "../src/server/http";
import type { AppEnv } from "../src/server/env";
import type { KVStore } from "../src/lib/draft";

class InMemoryKV implements KVStore {
  private store = new Map<string, string>();
  async get(key: string) {
    return this.store.get(key) ?? null;
  }
  async put(key: string, value: string) {
    this.store.set(key, value);
  }
  async delete(key: string) {
    this.store.delete(key);
  }
}

class InMemoryCache {
  private store = new Map<string, Response>();
  async match(request: Request) {
    return this.store.get(request.url);
  }
  async put(request: Request, response: Response) {
    this.store.set(request.url, response);
  }
}

// A fresh InMemoryCache per test (rather than one shared instance across
// the whole file): every test here requests the same "/e/conf/programme"
// URL, and a stored Response's body ReadableStream can only be read once --
// reusing one cache instance across tests locks that stream on the second
// hit ("Response body object should not be disturbed or locked").
beforeEach(() => {
  (globalThis as unknown as { caches: { default: InMemoryCache } }).caches = { default: new InMemoryCache() };
});

function buildApp() {
  const app = new Hono<AppEnv>();
  app.use("*", async (c, next) => {
    c.set("db", {} as AppEnv["Variables"]["db"]);
    await next();
  });
  registerErrorHandler(app);
  app.route("/", publicRoutes);
  const env = { KV: new InMemoryKV() as unknown as AppEnv["Bindings"]["KV"] };
  return {
    request: (path: string, init?: RequestInit) => app.request(path, init, env),
  };
}

describe("GET /e/:eventSlug/programme (DEC-683 wave-65 amendment)", () => {
  it("200s with every published day heading and every visible session title present", async () => {
    const app = buildApp();
    const res = await app.request("/e/conf/programme");
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("Day One Keynote");
    expect(html).toContain("Day Two Workshop");
  });

  it("excludes a session the visibility gate never returned", async () => {
    const app = buildApp();
    const res = await app.request("/e/conf/programme");
    const html = await res.text();
    expect(html).not.toContain(HIDDEN_TITLE);
  });

  it("renders a break row's label on its day", async () => {
    const app = buildApp();
    const res = await app.request("/e/conf/programme");
    const html = await res.text();
    expect(html).toContain("Lunch");
    expect(html).toContain("Foyer");
    expect(html).toContain("60 min");
  });

  it("returns 404 for an unknown slug", async () => {
    const app = buildApp();
    const res = await app.request("/e/nope/programme");
    expect(res.status).toBe(404);
  });

  it("carries no nav markup and no itinerary toggle", async () => {
    const app = buildApp();
    const res = await app.request("/e/conf/programme");
    const html = await res.text();
    expect(html).not.toContain('class="chq-nav"');
    expect(html).not.toContain("chq-itinerary-toggle");
  });
});
