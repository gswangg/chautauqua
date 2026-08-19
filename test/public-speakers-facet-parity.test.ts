// DEC-990 (wave-67 amendment): finishes wave 64's track facet on /speakers +
// /gallery for the surfaces' other three readers. src/server/repo/public/
// speakers.ts already accepts and SQL-enforces `opts.trackId` (on both the
// distinct-id query and the count), and dispatch.tsx's HTML case already
// passes it — this file pins that the .json twin, the .xml twin and the
// embed-builder's knob table (which feeds the saved-embed URL and the
// EmbedsPanel track select) all thread the SAME `trackId` through to the
// SAME repo call, and that `total` therefore agrees between the HTML page
// and its .json/.xml twins for both /speakers and /gallery.
//
// getPublicSpeakers is mocked here to a deterministic in-memory filter — the
// SQL-level EXISTS predicate itself is already covered by
// test/public-speakers*.test.ts. This file's job is the WIRING: does every
// route that claims to answer the same query actually pass trackId down to
// the repo call, and does the embed URL builder actually serialize it.

import { describe, expect, it, vi } from "vitest";
import { Hono } from "hono";

const EVENT: import("../src/server/repo/public").PublicEvent = {
  id: "ev1",
  orgId: "org1",
  name: "Test Event",
  slug: "conf",
  startDate: "2026-08-10",
  endDate: "2026-08-11",
  location: null,
  timezone: "UTC",
  recordPrefix: "SES",
  brandingJson: null,
};

const TRACK_A = { id: "trk-a", name: "Track A", color: null };
const TRACK_B = { id: "trk-b", name: "Track B", color: null };

// vi.mock's factory is hoisted above these consts, so the mock referenced
// inside it must be created via vi.hoisted (mirrors vitest's documented
// pattern for a mock whose calls need inspecting after the fact).
const { getPublicSpeakersMock } = vi.hoisted(() => {
  const RAW = [
    { contactId: "c1", firstName: "Ada", lastName: "Alpha", trackId: "trk-a" },
    { contactId: "c2", firstName: "Bea", lastName: "Beta", trackId: "trk-b" },
    { contactId: "c3", firstName: "Cy", lastName: "Gamma", trackId: "trk-a" },
  ];
  return {
    getPublicSpeakersMock: vi.fn(
      async (
        _db: unknown,
        _eventId: unknown,
        opts: { q?: string | null; trackId?: string | null; page: number; perPage: number },
      ) => {
        const items = RAW.filter((r) => !opts.trackId || r.trackId === opts.trackId).map((r) => ({
          contactId: r.contactId,
          firstName: r.firstName,
          lastName: r.lastName,
          title: null,
          company: null,
          headshotUrl: null,
          bio: null,
          sessions: [],
        }));
        return { items, total: items.length };
      },
    ),
  };
});

vi.mock("../src/server/repo/public", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/public")>("../src/server/repo/public");
  return {
    ...actual,
    getPublicEventBySlug: vi.fn(async (_db: unknown, slug: string) => (slug === EVENT.slug ? EVENT : null)),
    getPublicSpeakers: getPublicSpeakersMock,
    getPublicTracks: vi.fn(async () => [TRACK_A, TRACK_B]),
    getPublicSessions: vi.fn(async () => ({ items: [], total: 0 })),
    getPublicAgenda: vi.fn(async () => ({ items: [], total: 0 })),
    getPublicAgendaByIds: vi.fn(async () => []),
    getPublicFormatOptions: vi.fn(async () => []),
    getPublicRooms: vi.fn(async () => []),
    getPublicScheduleDayCounts: vi.fn(async () => []),
    getPublicBreaksByDay: vi.fn(async () => new Map()),
    getPublicCfpWindow: vi.fn(async () => null),
    getPriorPublicEvent: vi.fn(async () => null),
  };
});

import { publicRoutes } from "../src/routes/public";
import { registerErrorHandler } from "../src/server/http";
import type { AppEnv } from "../src/server/env";

function fakeKv() {
  return {
    async get() {
      return null;
    },
    async put() {
      /* no-op */
    },
    async delete() {
      /* no-op */
    },
  };
}

function installFakeCaches(): void {
  (globalThis as any).caches = {
    default: {
      async match() {
        return undefined;
      },
      async put() {
        /* no-op */
      },
    },
  };
}

const TEST_ENV = { KV: fakeKv() } as unknown as AppEnv["Bindings"];

function buildApp() {
  const app = new Hono<AppEnv>();
  app.use("*", async (c, next) => {
    c.set("db", {} as AppEnv["Variables"]["db"]);
    await next();
  });
  registerErrorHandler(app);
  app.route("/", publicRoutes);
  return app;
}

async function jsonTotal(app: Hono<AppEnv>, path: string): Promise<number> {
  const res = await app.request(path, {}, TEST_ENV);
  const body = (await res.json()) as { total: number };
  return body.total;
}

// Counts rendered speaker rows in the HTML page for a given surface, so the
// HTML total can be compared to the .json twin's reported `total`.
function countHtmlRows(html: string, surface: "speakers" | "gallery"): number {
  if (surface === "speakers") return (html.match(/class="chq-pub-speaker-list-row"/g) ?? []).length;
  return (html.match(/class="chq-pub-speaker-card"/g) ?? []).length;
}

describe("DEC-990 (wave 67): /speakers + /gallery track facet reaches the .json twin", () => {
  for (const surface of ["speakers", "gallery"] as const) {
    it(`${surface}?trackId=trk-a — HTML page row count matches .json twin's total`, async () => {
      installFakeCaches();
      const app = buildApp();
      const htmlRes = await app.request(`/e/conf/${surface}?trackId=trk-a`, {}, TEST_ENV);
      const html = await htmlRes.text();
      installFakeCaches();
      const total = await jsonTotal(app, `/embed/conf/${surface}.json?trackId=trk-a`);
      expect(countHtmlRows(html, surface)).toBe(total);
      expect(total).toBe(2);
    });
  }
});

describe("DEC-990 (wave 67): /speakers + /gallery track facet reaches the .xml twin", () => {
  for (const surface of ["speakers", "gallery"] as const) {
    it(`${surface}.xml?trackId=trk-a threads trackId into the getPublicSpeakers call same as .json`, async () => {
      installFakeCaches();
      const app = buildApp();
      getPublicSpeakersMock.mockClear();
      await app.request(`/embed/conf/${surface}.json?trackId=trk-a`, {}, TEST_ENV);
      const jsonCallOpts = getPublicSpeakersMock.mock.calls.at(-1)?.[2];
      expect(jsonCallOpts).toMatchObject({ trackId: "trk-a" });

      installFakeCaches();
      getPublicSpeakersMock.mockClear();
      await app.request(`/embed/conf/${surface}.xml?trackId=trk-a`, {}, TEST_ENV);
      const xmlCallOpts = getPublicSpeakersMock.mock.calls.at(-1)?.[2];
      expect(xmlCallOpts).toMatchObject({ trackId: "trk-a" });
    });
  }
});

describe("DEC-990 (wave 67): the HTML page also threads trackId into getPublicSpeakers", () => {
  for (const surface of ["speakers", "gallery"] as const) {
    it(`${surface}?trackId=trk-a passes trackId to getPublicSpeakers`, async () => {
      installFakeCaches();
      const app = buildApp();
      getPublicSpeakersMock.mockClear();
      await app.request(`/e/conf/${surface}?trackId=trk-a`, {}, TEST_ENV);
      const htmlCallOpts = getPublicSpeakersMock.mock.calls.at(-1)?.[2];
      expect(htmlCallOpts).toMatchObject({ trackId: "trk-a" });
    });
  }
});

describe("DEC-990 (wave 67): EMBED_KNOBS_BY_SURFACE lists trackId for speakers/gallery", () => {
  it("speakers and gallery both list trackId alongside q/limit/accent", async () => {
    const { EMBED_KNOBS_BY_SURFACE } = await import("../app/src/pages/settings/embedSnippet");
    expect(EMBED_KNOBS_BY_SURFACE.speakers).toContain("trackId");
    expect(EMBED_KNOBS_BY_SURFACE.gallery).toContain("trackId");
  });

  it("buildEmbedUrl serializes trackId for speakers", async () => {
    const { buildEmbedUrl } = await import("../app/src/pages/settings/embedSnippet");
    const url = buildEmbedUrl("https://example.com", "conf", "speakers", {
      format: "iframe",
      trackId: "trk-a",
    } as any);
    expect(url).toContain("trackId=trk-a");
  });
});
