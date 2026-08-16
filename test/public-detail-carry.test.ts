// DEC-151 (wave-59 amendment), extending DEC-489's `carry` mechanism from
// /embed to the full-chrome pages: a session/speaker detail page's Back
// link must restore the narrowing (day/q/trackId/format/roomId) the
// visitor was on when they drilled in, on BOTH /e and /embed. Before this
// fix src/routes/public/detail.tsx's BackLink built a bare surfacePath with
// no query, dropping the day and every filter (P3 #28). Modelled on
// test/public-embed-knob-carry.test.ts / test/public-embed-detail.test.ts's
// vi.mock(../src/server/repo/public) harness -- no db.select() chain
// needed since these routes are query-shape assertions, not data ones.

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

const SESSION: import("../src/server/repo/public").PublicSessionDetail = {
  id: "sess1",
  ref: "SES-1",
  title: "Building Embeds",
  description: "A talk about embeds.",
  tracks: [],
  day: "2026-08-10",
  startMin: 540,
  endMin: 600,
  roomId: "room1",
  roomName: "Room A",
  speakers: [],
  format: "talk",
};

vi.mock("../src/server/repo/public/home", () => ({
  getHubOrg: vi.fn(async () => null),
  listHubEvents: vi.fn(async () => ({ items: [], capped: false })),
}));

vi.mock("../src/server/repo/public", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/public")>("../src/server/repo/public");
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

function backHref(body: string): string | undefined {
  const match = body.match(/<a class="chq-pub-accent-link" href="([^"]+)">\s*← Back to/);
  return match?.[1];
}

describe("DEC-151 (wave-59 amendment): detail Back link carries the visitor's active surface state", () => {
  it("/e/: a session reached from /e/conf/agenda?day=...&trackId=... renders a Back link carrying both", async () => {
    const app = buildApp();
    const res = await app.request(`/e/${EVENT.slug}/sessions/${SESSION.id}?from=agenda&day=2026-08-10&trackId=trk-a`);
    expect(res.status).toBe(200);
    const body = await res.text();
    const href = backHref(body);
    expect(href).toBeDefined();
    // day/trackId are both declared knobs for "agenda" (EMBED_KNOB_TABLE) --
    // both must survive, in the table's declared order.
    expect(href).toBe("/e/conf/agenda?trackId=trk-a&amp;day=2026-08-10");
  });

  it("/e/: a param the surface does not declare is dropped (roomId is not an agenda knob)", async () => {
    const app = buildApp();
    const res = await app.request(`/e/${EVENT.slug}/sessions/${SESSION.id}?from=agenda&day=2026-08-10&roomId=room1`);
    const body = await res.text();
    const href = backHref(body);
    expect(href).toBe("/e/conf/agenda?day=2026-08-10");
    expect(href).not.toContain("roomId");
  });

  it("/e/: a detail reached with no narrowing params renders exactly today's bare Back link", async () => {
    const app = buildApp();
    const res = await app.request(`/e/${EVENT.slug}/sessions/${SESSION.id}?from=sessions`);
    const body = await res.text();
    const href = backHref(body);
    expect(href).toBe("/e/conf/sessions");
  });

  it("/embed/: keeps its existing knob-carry behaviour unchanged (no ?from= narrowing params on the request -> bare Back link under /embed)", async () => {
    const app = buildApp();
    const res = await app.request(`/embed/${EVENT.slug}/sessions/${SESSION.id}?from=sessions`);
    const body = await res.text();
    const href = backHref(body);
    expect(href).toBe("/embed/conf/sessions");
  });

  it("/embed/: also restores narrowing params supplied on the request (extends the same mechanism, does not regress it)", async () => {
    const app = buildApp();
    const res = await app.request(`/embed/${EVENT.slug}/sessions/${SESSION.id}?from=agenda&day=2026-08-10&q=foo`);
    const body = await res.text();
    const href = backHref(body);
    expect(href).toBe("/embed/conf/agenda?day=2026-08-10&amp;q=foo");
  });
});
