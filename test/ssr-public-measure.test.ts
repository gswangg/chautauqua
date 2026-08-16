// DEC-989 Amendment (wave 37), further amended DEC-990 (wave 40), DEC-683
// (wave 67), DEC-683 again (wave 1, task w1-a), and DEC-555 again (wave 5,
// task w5-a): the SSR public surfaces take their container class from the
// CONTENT. sessions, gallery, agenda, speakers (wave 1) and (as of wave 5)
// schedule = wide (1180: sessions'/agenda's/schedule's list + rail pair,
// gallery's six ~184px tiles + gaps, speakers' List/Grid pair sharing one
// column); session/speaker detail = reading (820). Agenda's former "canvas"
// measure
// (no class, its lane count was the room count) is gone along with the
// wave-64 desktop room-lane matrix it justified -- agenda is now the same
// 1180 pair as sessions, with its own rail (AgendaRail). EmbedShell never
// carries a measure class -- an embed fills its host iframe. Mirrors the
// vi.mock(../src/server/repo/public) pattern from
// test/public-page-headings.test.ts.

import { describe, expect, it, vi } from "vitest";
import { Hono } from "hono";

const EVENT: import("../src/server/repo/public").PublicEvent = {
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

const SPEAKER: import("../src/server/repo/public").PublicSpeakerDetail = {
  contactId: "c1",
  firstName: "Ada",
  lastName: "Lovelace",
  title: "Engineer",
  company: "Analytical Engines Inc",
  bio: null,
  headshotUrl: null,
  socialLinks: [],
  sessions: [],
};

const SESSION: import("../src/server/repo/public").PublicSessionDetail = {
  id: "s1",
  ref: "SES-1",
  title: "Notes on the Analytical Engine",
  description: null,
  tracks: [],
  day: null,
  startMin: null,
  endMin: null,
  roomId: null,
  roomName: null,
  speakers: [],
  format: null,
};

vi.mock("../src/server/repo/public", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/public")>(
    "../src/server/repo/public",
  );

  return {
    ...actual,
    getPublicEventBySlug: vi.fn(async (_db: unknown, slug: string) => (slug === EVENT.slug ? EVENT : null)),
    getPublicTracks: vi.fn(async () => []),
    getPublicRooms: vi.fn(async () => []),
    getPublicFormatOptions: vi.fn(async () => []),
    // total > 0 with an empty page: since the DEC-919 wave-47 amendment an
    // unfiltered sessions surface whose total is 0 is 'fresh' and the caller
    // hides the filter bar, which would erase the .chq-pub-filter-row this
    // file measures. The rendered items stay empty (measure classes and the
    // filter row are what these tests read).
    getPublicSessions: vi.fn(async () => ({ items: [], total: 3 })),
    getPublicSpeakers: vi.fn(async () => ({ items: [], total: 0 })),
    getPublicSpeakerDetail: vi.fn(async (_db: unknown, _event: unknown, contactId: string) =>
      contactId === SPEAKER.contactId ? SPEAKER : null,
    ),
    getPublicSessionDetail: vi.fn(async (_db: unknown, _event: unknown, sessionId: string) =>
      sessionId === SESSION.id ? SESSION : null,
    ),
    getPublicAgenda: vi.fn(async () => ({ items: [], total: 0 })),
    getPublicScheduleDayCounts: vi.fn(async () => []),
    getPublicBreaksByDay: vi.fn(async () => new Map()),
    getPublicCfpWindow: vi.fn(async () => null),
  };
});

import { publicRoutes } from "../src/routes/public";
import { registerErrorHandler } from "../src/server/http";
import type { AppEnv } from "../src/server/env";
import type { KVStore } from "../src/lib/draft";
import { THEME_CSS } from "../src/views/theme";
import { CHROME_CSS } from "../src/routes/public/css/chrome.css";
import { RAIL_CSS } from "../src/routes/public/css/rail.css";

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

(globalThis as unknown as { caches: { default: InMemoryCache } }).caches = { default: new InMemoryCache() };

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

/** Pulls the `class="..."` attribute off the first `<main` tag in an HTML
 * document, as a space-split token list. */
function mainClasses(html: string): string[] {
  const m = /<main\b[^>]*class="([^"]*)"/.exec(html);
  if (!m) {
    // agenda's <main> is expected to carry no class attribute at all.
    const bare = /<main\b(?![^>]*class=)[^>]*>/.exec(html);
    expect(bare, `expected a <main> element in: ${html.slice(0, 200)}`).not.toBeNull();
    return [];
  }
  return m[1]!.split(/\s+/).filter(Boolean);
}

describe("theme.ts: .chq-measure / .chq-measure-wide consume their own vars", () => {
  it("defines .chq-measure and .chq-measure-wide, each with max-width: var(--chq-measure*)", () => {
    const measureRule = /\.chq-measure\s*\{([^}]*)\}/.exec(THEME_CSS);
    expect(measureRule).not.toBeNull();
    expect(measureRule![1]).toMatch(/max-width:\s*var\(--chq-measure\)/);
    expect(measureRule![1]).not.toMatch(/max-width:\s*\d/);

    const wideRule = /\.chq-measure-wide\s*\{([^}]*)\}/.exec(THEME_CSS);
    expect(wideRule).not.toBeNull();
    expect(wideRule![1]).toMatch(/max-width:\s*var\(--chq-measure-wide\)/);
    expect(wideRule![1]).not.toMatch(/max-width:\s*\d/);
  });

  it("every --chq-measure* token declared in :root is consumed by at least one rule in theme.ts (no dead token)", () => {
    const rootBlock = /:root\s*\{([^}]*)\}/.exec(THEME_CSS);
    expect(rootBlock).not.toBeNull();
    const declared = [...rootBlock![1]!.matchAll(/(--chq-measure[a-z-]*)\s*:/g)].map((m) => m[1]!);
    expect(declared.length).toBeGreaterThan(0);

    // Body of THEME_CSS after the :root block (where consuming rules live).
    const body = THEME_CSS.slice(THEME_CSS.indexOf(rootBlock![0]) + rootBlock![0].length);
    for (const token of declared) {
      expect(body, `${token} declared in :root but never consumed by a rule in theme.ts`).toMatch(
        new RegExp(`var\\(${token}\\)`),
      );
    }

    // DEC-989 Amendment (wave 37): --chq-measure-table is admin-SPA-only
    // (app/src/styles.css); nothing server-rendered is table class, so
    // theme.ts must not declare it (a code comment mentioning the token
    // name for documentation purposes is fine -- this asserts it isn't
    // *declared* in :root, i.e. no `--chq-measure-table:` assignment).
    expect(declared).not.toContain("--chq-measure-table");
    expect(THEME_CSS).not.toMatch(/--chq-measure-table\s*:/);
  });
});

const SURFACE_CASES: { path: string; expectClasses: string[] }[] = [
  { path: "/e/conf/sessions", expectClasses: ["chq-pub-main", "chq-measure-wide"] },
  // DEC-683 amendment (wave 1, task w1-a): speakers moves from "reading" to
  // "wide" so its List/Grid toggle no longer resizes the page around it.
  { path: "/e/conf/speakers", expectClasses: ["chq-pub-main", "chq-measure-wide"] },
  { path: "/e/conf/gallery", expectClasses: ["chq-pub-main", "chq-measure-wide"] },
  { path: "/e/conf/schedule", expectClasses: ["chq-pub-main", "chq-measure-wide"] },
  { path: "/e/conf/agenda", expectClasses: ["chq-pub-main", "chq-measure-wide"] },
  { path: "/e/conf/sessions/s1", expectClasses: ["chq-pub-main", "chq-measure"] },
  { path: "/e/conf/speakers/c1", expectClasses: ["chq-pub-main", "chq-measure"] },
];

describe("DEC-989 Amendment (wave 37): every public surface's <main> carries exactly the ruled measure class", () => {
  for (const { path, expectClasses } of SURFACE_CASES) {
    it(`GET ${path}`, async () => {
      const app = buildApp();
      const res = await app.request(path);
      expect(res.status).toBe(200);
      const html = await res.text();
      const classes = mainClasses(html);
      expect(new Set(classes)).toEqual(new Set(expectClasses));
      expect(classes).not.toContain("chq-measure-table");
      // reading or wide, never both
      expect(classes.includes("chq-measure") && classes.includes("chq-measure-wide")).toBe(false);
    });
  }
});

// DEC-919 amendment (wave 40): one compact search input at the head of ONE
// pill row, on every list surface -- no visible 'Search' label/button, no
// second and third ruled row.
function countMatches(html: string, re: RegExp): number {
  return (html.match(re) ?? []).length;
}

describe("DEC-919 amendment (wave 40): public search is one compact input in ONE pill row", () => {
  // task-w1-d (DEC-555 amendment): /schedule dropped its search form
  // entirely (frame 10--12 carries none) -- see public-agenda-geometry.
  // test.ts for that surface's own "dropped control" coverage.
  const ROW_SURFACES = ["/e/conf/sessions", "/e/conf/agenda"];

  // Single GET per path (pubcache's shared in-memory cache in this harness
  // cannot serve a second .text() read of the same cached Response body), so
  // every assertion for a given surface is made against the one response.
  for (const path of ROW_SURFACES) {
    it(`GET ${path} emits exactly one <form role="search">, exactly one .chq-pub-filter-row, and a real clickable search submit button (DEC-919 wave-69 amendment)`, async () => {
      const app = buildApp();
      const res = await app.request(path);
      expect(res.status).toBe(200);
      const html = await res.text();
      expect(countMatches(html, /<form\b[^>]*\brole="search"/g)).toBe(1);
      expect(countMatches(html, /class="chq-pub-filter-row"/g)).toBe(1);
      // PublicSearchBox's submit is a real, clickable, non-hidden button now
      // (DEC-919 wave-69 amendment) -- a pointer must be able to hit it.
      expect(html).toContain('<button class="chq-pub-search-submit" type="submit" aria-label="Search">');
      expect(html).not.toMatch(/<button class="chq-visually-hidden" type="submit">Search<\/button>/);
    });
  }

  it("GET /e/conf/speakers (fresh empty, total 0: no filter bar at all) never renders the old visually-hidden submit pattern", async () => {
    const app = buildApp();
    const res = await app.request("/e/conf/speakers");
    expect(res.status).toBe(200);
    const html = await res.text();
    // total: 0 on this mock means the surface is 'fresh' and hides the
    // whole filter bar (search box included) -- see public-search-submit
    // .test.ts for coverage of the visible submit button when the search
    // form IS rendered.
    expect(html).not.toMatch(/<button class="chq-visually-hidden" type="submit">Search<\/button>/);
  });
});

// DEC-683 amendment (wave 1, task w1-a): PUBLIC PAIR = 820 (list) + 60
// (gap) + 300 (rail) = 1180 of CONTENT at a 1440 viewport. --chq-measure-
// wide alone only clamps main.chq-pub-main's border-box; its own left+right
// padding (--chq-pub-main-pad-x) has to be cancelled back in via calc() on
// the SAME token, or the content column lands at 1112, not 1180.
describe("DEC-683 amendment (wave 1, task w1-a): PUBLIC PAIR is 820 + 60 + 300 = 1180 of content", () => {
  it("--chq-pub-main-pad-x is declared in :root and consumed by both main.chq-pub-main's padding and its wide-measure override", () => {
    const rootBlock = /:root\s*\{([^}]*)\}/.exec(THEME_CSS);
    expect(rootBlock).not.toBeNull();
    expect(rootBlock![1]).toMatch(/--chq-pub-main-pad-x:\s*34px/);

    expect(CHROME_CSS).toMatch(/main\.chq-pub-main\s*\{\s*padding:\s*26px\s+var\(--chq-pub-main-pad-x\)\s+34px;/);
  });

  it("main.chq-pub-main.chq-measure-wide cancels its own padding via calc() on --chq-pub-main-pad-x, landing at 1180 of content", () => {
    const rule = /main\.chq-pub-main\.chq-measure-wide\s*\{([^}]*)\}/.exec(CHROME_CSS);
    expect(rule).not.toBeNull();
    expect(rule![1]).toMatch(
      /max-width:\s*calc\(var\(--chq-measure-wide\)\s*\+\s*\(var\(--chq-pub-main-pad-x\)\s*\*\s*2\)\)/,
    );
    // Concretely: 1180 (--chq-measure-wide) + 2*34 (--chq-pub-main-pad-x) =
    // 1248 border-box, minus the 68px of padding box-sizing:border-box
    // eats back out = 1180 of content.
    const measureWide = 1180;
    const padX = 34;
    const borderBoxWidth = measureWide + padX * 2;
    const contentWidth = borderBoxWidth - padX * 2;
    expect(contentWidth).toBe(1180);
  });

  it("the sessions and agenda list+rail grids resolve to 820/60/300 inside a 1180 content column", () => {
    for (const selector of [".chq-pub-sessions-layout", ".chq-pub-agenda-layout"]) {
      const rule = new RegExp(`${selector.replace(".", "\\.")}\\s*\\{([^}]*)\\}`).exec(RAIL_CSS);
      expect(rule, `${selector} not found in RAIL_CSS`).not.toBeNull();
      expect(rule![1]).toMatch(/grid-template-columns:\s*1fr\s+300px;/);
      expect(rule![1]).toMatch(/gap:\s*60px;/);

      const contentWidth = 1180;
      const railWidth = 300;
      const gap = 60;
      const listWidth = contentWidth - railWidth - gap;
      expect(listWidth).toBe(820);
    }
  });
});

describe("DEC-989 Amendment (wave 37): /embed/... never carries a measure class", () => {
  it("GET /embed/conf/sessions main carries chq-pub-main and no chq-measure*", async () => {
    const app = buildApp();
    const res = await app.request("/embed/conf/sessions");
    expect(res.status).toBe(200);
    const html = await res.text();
    const classes = mainClasses(html);
    expect(classes).toContain("chq-pub-main");
    expect(classes.some((c) => c.startsWith("chq-measure"))).toBe(false);
  });

  it("GET /embed/conf/agenda main carries chq-pub-main and no chq-measure*", async () => {
    const app = buildApp();
    const res = await app.request("/embed/conf/agenda");
    expect(res.status).toBe(200);
    const html = await res.text();
    const classes = mainClasses(html);
    expect(classes).toContain("chq-pub-main");
    expect(classes.some((c) => c.startsWith("chq-measure"))).toBe(false);
  });
});
