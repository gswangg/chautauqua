// DEC-782: public detail pages get the card's itinerary action (Save/Saved
// toggle + ItineraryScript) and the card's date grammar (formatDay, never a
// raw ISO day). /embed detail pages stay chromeless: no toggle, no script.
// Mirrors the vi.mock(../src/server/repo/public) pattern established in
// test/public-embed-detail.test.ts.

import { describe, expect, it, vi } from "vitest";
import { Hono } from "hono";

const EVENT: import("../src/server/repo/public").PublicEvent = {
  id: "ev1",
  orgId: "org1",
  name: "Test Event",
  slug: "conf",
  startDate: "2027-05-10",
  endDate: "2027-05-14",
  location: null,
  timezone: "UTC",
  recordPrefix: "SES",
  brandingJson: null,
};

const SESSION: import("../src/server/repo/public").PublicSessionDetail = {
  id: "sess1",
  ref: "SES-1",
  title: "Building Itineraries",
  description: "A talk about itineraries.",
  tracks: [],
  day: "2027-05-12",
  startMin: 540,
  endMin: 570,
  roomId: "room1",
  roomName: "Room A",
  speakers: [
    {
      contactId: "spk1",
      firstName: "Ada",
      lastName: "Lovelace",
      title: "Engineer",
      company: "Acme",
      headshotUrl: null,
      bio: null,
    },
  ],
  format: "talk",
};

vi.mock("../src/server/repo/public", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/public")>(
    "../src/server/repo/public",
  );

  return {
    ...actual,
    getPublicEventBySlug: vi.fn(async (_db: unknown, slug: string) => (slug === EVENT.slug ? EVENT : null)),
    getPublicSessionDetail: vi.fn(async (_db: unknown, _event: unknown, sessionId: string) =>
      sessionId === SESSION.id ? SESSION : null,
    ),
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
    // Never reached: the mocked repo functions above don't touch `db`.
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

describe("DEC-782: public session detail date grammar + itinerary control", () => {
  it("/e session detail prints the card's formatted day, never the raw ISO day", async () => {
    const app = buildApp();
    const res = await app.request(`/e/${EVENT.slug}/sessions/${SESSION.id}`);
    expect(res.status).toBe(200);
    const body = await res.text();
    // formatDay("2027-05-12") -> "Wed, May 12" (UTC calendar day, event tz UTC).
    expect(body).toContain("Wed, May 12");
    expect(body).not.toContain("2027-05-12,");
  });

  it("/e session detail renders the Save/Saved itinerary toggle and inlines ItineraryScript", async () => {
    const app = buildApp();
    const res = await app.request(`/e/${EVENT.slug}/sessions/${SESSION.id}`);
    const body = await res.text();
    expect(body).toContain('class="chq-itinerary-toggle"');
    expect(body).toContain(`value="${SESSION.id}"`);
    expect(body).toContain('class="chq-pub-save-off"');
    expect(body).toContain('class="chq-pub-save-on"');
    expect(body).toContain('id="chq-ics-link"');
    expect(body).toContain('id="chq-ics-count"');
    // ItineraryScript's IIFE is inlined (distinct from the /embed resize
    // postMessage script, which shares the same `(function(){` shell).
    expect(body).toContain("MAX_ITINERARY_IDS");
  });

  it("/embed session detail contains neither the itinerary toggle nor the itinerary script", async () => {
    const app = buildApp();
    const res = await app.request(`/embed/${EVENT.slug}/sessions/${SESSION.id}`);
    expect(res.status).toBe(200);
    const body = await res.text();
    // CSS rules for these classes ship globally (public.css.ts), so assert on
    // the actual element markup rather than a bare class-name substring.
    expect(body).not.toContain('class="chq-itinerary-toggle"');
    expect(body).not.toContain('class="chq-pub-save-off"');
    expect(body).not.toContain('class="chq-pub-save-on"');
    expect(body).not.toContain('id="chq-ics-link"');
    expect(body).not.toContain('id="chq-ics-count"');
    expect(body).not.toContain("MAX_ITINERARY_IDS");
    // Date grammar still holds in the embed variant.
    expect(body).toContain("Wed, May 12");
    expect(body).not.toContain("2027-05-12,");
  });
});
