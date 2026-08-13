// DEC-989 Amendment (wave 37): the SSR public surfaces take their container
// class from the CONTENT. sessions = wide (1180, list + rail pair);
// speakers/gallery/schedule/session+speaker detail = reading (820);
// agenda = canvas (no class, its lane count is the room count). EmbedShell
// never carries a measure class -- an embed fills its host iframe. Mirrors
// the vi.mock(../src/server/repo/public) pattern from
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
    getPublicSessions: vi.fn(async () => ({ items: [], total: 0 })),
    getPublicSpeakers: vi.fn(async () => ({ items: [], total: 0 })),
    getPublicSpeakerDetail: vi.fn(async (_db: unknown, _event: unknown, contactId: string) =>
      contactId === SPEAKER.contactId ? SPEAKER : null,
    ),
    getPublicSessionDetail: vi.fn(async (_db: unknown, _event: unknown, sessionId: string) =>
      sessionId === SESSION.id ? SESSION : null,
    ),
    getPublicAgenda: vi.fn(async () => ({ items: [], total: 0 })),
    getPublicScheduleDayCounts: vi.fn(async () => []),
    getPublicCfpWindow: vi.fn(async () => null),
  };
});

import { publicRoutes } from "../src/routes/public";
import { registerErrorHandler } from "../src/server/http";
import type { AppEnv } from "../src/server/env";
import type { KVStore } from "../src/lib/draft";
import { THEME_CSS } from "../src/views/theme";

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
  { path: "/e/conf/speakers", expectClasses: ["chq-pub-main", "chq-measure"] },
  { path: "/e/conf/gallery", expectClasses: ["chq-pub-main", "chq-measure"] },
  { path: "/e/conf/schedule", expectClasses: ["chq-pub-main", "chq-measure"] },
  { path: "/e/conf/agenda", expectClasses: ["chq-pub-main"] },
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
      if (path !== "/e/conf/agenda") {
        // reading or wide, never both
        expect(classes.includes("chq-measure") && classes.includes("chq-measure-wide")).toBe(false);
      } else {
        expect(classes).not.toContain("chq-measure");
        expect(classes).not.toContain("chq-measure-wide");
      }
    });
  }
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
