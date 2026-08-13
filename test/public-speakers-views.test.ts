// DEC-990: "Speakers: one page, two views" -- Speakers is one public surface
// with a List (/speakers) and Grid (/gallery) view, reachable via a toggle
// beside the search box. Amendment (wave 53): Gallery is back in the top
// nav (NAV_SURFACES, frame 10--00) alongside the toggle -- both paths reach
// the same content.

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

const SPEAKER: import("../src/server/repo/public").PublicSpeakerWithSessions = {
  contactId: "c1",
  firstName: "Ada",
  lastName: "Lovelace",
  title: "Engineer",
  company: "Analytical Engines Inc",
  bio: null,
  headshotUrl: null,
  sessions: [],
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
    getPublicSpeakers: vi.fn(async (_db: unknown, _event: unknown, opts: { q?: string | null }) => ({
      items: opts?.q === "ada" ? [SPEAKER] : [SPEAKER],
      total: 1,
    })),
    getPublicSpeakerDetail: vi.fn(async () => null),
    getPublicSessionDetail: vi.fn(async () => null),
    getPublicAgenda: vi.fn(async () => ({ items: [], total: 0 })),
    getPublicScheduleDayCounts: vi.fn(async () => []),
    getPublicCfpWindow: vi.fn(async () => null),
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

describe("DEC-990 Amendment (wave 53): public shell nav includes Gallery", () => {
  it("GET /e/conf/sessions nav renders Sessions/Speakers/Agenda/My schedule/Gallery", async () => {
    const app = buildApp();
    const res = await app.request("/e/conf/sessions");
    expect(res.status).toBe(200);
    const html = await res.text();
    const nav = html.match(/<nav class="chq-nav">([\s\S]*?)<\/nav>/);
    expect(nav).toBeTruthy();
    const navHtml = nav![1]!;
    expect(navHtml).toContain(">Sessions<");
    expect(navHtml).toContain(">Speakers<");
    expect(navHtml).toContain(">Agenda<");
    // frame 10--00: the nav item's label is now 'My schedule'.
    expect(navHtml).toContain(">My schedule<");
    expect(navHtml).toContain(">Gallery<");
    expect(navHtml).toContain("/gallery");
  });
});

describe("DEC-990: /e/:slug/gallery URL still resolves", () => {
  it("GET /e/conf/gallery is 200 and renders the photo grid", async () => {
    const app = buildApp();
    const res = await app.request("/e/conf/gallery");
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("chq-pub-speaker-grid");
    expect(html).toContain("chq-pub-gallery-grid");
  });
});

describe("DEC-990: Speakers/Gallery share a List/Grid toggle", () => {
  it("/speakers renders a toggle with a Grid link pointing at /gallery", async () => {
    const app = buildApp();
    const res = await app.request("/e/conf/speakers");
    const html = await res.text();
    const toggle = html.match(/<nav aria-label="Speaker view"[^>]*>([\s\S]*?)<\/nav>/);
    expect(toggle).toBeTruthy();
    const toggleHtml = toggle![1]!;
    expect(toggleHtml).toContain('href="/e/conf/gallery"');
    expect(toggleHtml).toMatch(/aria-current="page"[^>]*>\s*List/);
  });

  it("/gallery renders a toggle with a List link pointing at /speakers", async () => {
    const app = buildApp();
    const res = await app.request("/e/conf/gallery");
    const html = await res.text();
    const toggle = html.match(/<nav aria-label="Speaker view"[^>]*>([\s\S]*?)<\/nav>/);
    expect(toggle).toBeTruthy();
    const toggleHtml = toggle![1]!;
    expect(toggleHtml).toContain('href="/e/conf/speakers"');
    expect(toggleHtml).toMatch(/aria-current="page"[^>]*>\s*Grid/);
  });

  it("?q=ada is carried onto both toggle links", async () => {
    const app = buildApp();
    const speakersRes = await app.request("/e/conf/speakers?q=ada");
    const speakersHtml = await speakersRes.text();
    const speakersToggle = speakersHtml.match(/<nav aria-label="Speaker view"[^>]*>([\s\S]*?)<\/nav>/)![1]!;
    expect(speakersToggle).toContain("q=ada");

    const galleryRes = await app.request("/e/conf/gallery?q=ada");
    const galleryHtml = await galleryRes.text();
    const galleryToggle = galleryHtml.match(/<nav aria-label="Speaker view"[^>]*>([\s\S]*?)<\/nav>/)![1]!;
    expect(galleryToggle).toContain("q=ada");
  });
});

describe("DEC-990: gallery empty-state guard", () => {
  it("an empty gallery renders 'No speakers to show yet.' not '0 of 0 speakers'", async () => {
    const { GalleryContent } = await import("../src/routes/public/speakers");
    const html = String(GalleryContent({ event: EVENT, speakers: [], total: 0, page: 1, q: null }));
    expect(html).toContain("No speakers to show yet.");
    expect(html).not.toContain("0 of 0");
  });
});
