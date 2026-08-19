// DEC-952: every /e/:slug/* public surface names itself with exactly one
// <h1> naming the surface or the record, and no heading level is skipped
// (no <h3>/<h2> before the page's own <h1>). Mirrors the
// vi.mock(../src/server/repo/public) pattern established in
// test/public-entry-points.test.ts.

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
    getPublicBreaksByDay: vi.fn(async () => new Map()),
    getPublicCfpWindow: vi.fn(async () => null),
    getPriorPublicEvent: vi.fn(async () => null),
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

/** Extracts every <hN>...</hN> heading (tag + inner text) in document order,
 * ignoring attributes on the opening tag. */
function headings(html: string): { level: number; text: string }[] {
  const out: { level: number; text: string }[] = [];
  const re = /<h([1-3])[^>]*>([\s\S]*?)<\/h\1>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const level = m[1];
    const text = m[2];
    if (!level || text === undefined) continue;
    out.push({ level: Number(level), text: text.replace(/<[^>]+>/g, "").trim() });
  }
  return out;
}

const CASES: { path: string; nameIncludes: string }[] = [
  { path: "/e/conf/sessions", nameIncludes: "Sessions" },
  { path: "/e/conf/speakers", nameIncludes: "Speakers" },
  { path: "/e/conf/gallery", nameIncludes: "Speakers" },
  { path: "/e/conf/agenda", nameIncludes: "Agenda" },
  { path: "/e/conf/schedule", nameIncludes: "My schedule" },
  { path: "/e/conf/sessions/s1", nameIncludes: SESSION.title },
  { path: "/e/conf/speakers/c1", nameIncludes: `${SPEAKER.firstName} ${SPEAKER.lastName}` },
];

describe("DEC-952: public event surfaces name themselves", () => {
  for (const { path, nameIncludes } of CASES) {
    it(`GET ${path} has exactly one <h1> naming the surface/record, no level skip`, async () => {
      const app = buildApp();
      const res = await app.request(path);
      expect(res.status).toBe(200);
      const html = await res.text();

      const h1s = [...html.matchAll(/<h1[^>]*>/g)];
      expect(h1s.length).toBe(1);

      const all = headings(html);
      expect(all.length).toBeGreaterThan(0);
      expect(all[0]!.level).toBe(1);
      expect(all[0]!.text).toContain(nameIncludes);

      // No level skip: an <h3> must never appear before the first <h2>.
      const firstH2Index = all.findIndex((h) => h.level === 2);
      const firstH3Index = all.findIndex((h) => h.level === 3);
      if (firstH3Index !== -1) {
        expect(firstH2Index).not.toBe(-1);
        expect(firstH2Index).toBeLessThan(firstH3Index);
      }
    });
  }
});
