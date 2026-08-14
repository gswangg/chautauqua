// Ruling A26 (task-w26-h, DEC-782 amendment): the session detail page's
// itinerary control moves into the header beside the title -- a placement
// change only. SAME ItineraryToggle component, SAME chq_itinerary_<slug>
// key, SAME ItineraryScript. /embed stays chromeless.
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
  speakers: [],
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

describe("Ruling A26: itinerary toggle lives in the detail header", () => {
  it("/e session detail places the itinerary toggle inside <header class=\"chq-pub-detail-header\">, beside the title", async () => {
    const app = buildApp();
    const res = await app.request(`/e/${EVENT.slug}/sessions/${SESSION.id}`);
    const body = await res.text();

    const headerOpen = body.indexOf('<header class="chq-pub-detail-header">');
    expect(headerOpen).toBeGreaterThan(-1);
    const headerClose = body.indexOf("</header>", headerOpen);
    expect(headerClose).toBeGreaterThan(headerOpen);

    const header = body.slice(headerOpen, headerClose);
    // Title and toggle are both inside the header element.
    expect(header).toContain(SESSION.title);
    expect(header).toContain('class="chq-itinerary-toggle"');
    expect(header).toContain(`value="${SESSION.id}"`);

    // The description paragraph (which used to host the control) comes
    // AFTER the header closes -- placement change only, same mechanism.
    const descriptionIdx = body.indexOf(SESSION.description!, headerClose);
    expect(descriptionIdx).toBeGreaterThan(headerClose);

    // The picked-count/.ics line stays where it was (after the description).
    const icsIdx = body.indexOf('id="chq-ics-link"');
    expect(icsIdx).toBeGreaterThan(descriptionIdx);

    // Same ItineraryScript still inlined once.
    expect(body).toContain("MAX_ITINERARY_IDS");
  });

  it("/embed session detail stays chromeless: no header toggle, no script", async () => {
    const app = buildApp();
    const res = await app.request(`/embed/${EVENT.slug}/sessions/${SESSION.id}`);
    const body = await res.text();
    expect(body).toContain('<header class="chq-pub-detail-header">');
    expect(body).not.toContain('class="chq-itinerary-toggle"');
    expect(body).not.toContain("MAX_ITINERARY_IDS");
  });
});
