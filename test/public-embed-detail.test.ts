// DEC-672 (half one): /embed/:eventSlug/sessions/:sessionId and
// /embed/:eventSlug/speakers/:contactId are chromeless twins of the
// existing /e/:eventSlug/sessions/:sessionId and /e/:eventSlug/speakers/
// :contactId drill-ins — same visibility-gated query (getPublicSessionDetail
// / getPublicSpeakerDetail), rendered inside EmbedShell (no chq-nav) instead
// of PublicShell, with Back/cross-links kept under /embed. Mirrors the
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

const SPEAKER: import("../src/server/repo/public").PublicSpeakerDetail = {
  contactId: "spk1",
  firstName: "Ada",
  lastName: "Lovelace",
  title: "Engineer",
  company: "Acme",
  bio: "A speaker bio.",
  headshotUrl: null,
  socialLinks: [],
  sessions: [
    { id: "sess1", title: "Building Embeds", day: "2026-08-10", startMin: 540, endMin: 600, room: "Room A", trackNames: [] },
  ],
};

// DEC-635 amendment: publicNotFound now resolves its eyebrow via
// resolveNotFoundEyebrow (src/server/not-found.tsx), which reads
// repo/public/home.ts directly -- a separate module from repo/public's
// index mocked below.
vi.mock("../src/server/repo/public/home", () => ({
  getHubOrg: vi.fn(async () => null),
  listHubEvents: vi.fn(async () => ({ items: [], capped: false })),
}));

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
    getPublicSpeakerDetail: vi.fn(async (_db: unknown, _event: unknown, contactId: string) =>
      contactId === SPEAKER.contactId ? SPEAKER : null,
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

describe("DEC-672: /embed session/speaker detail routes", () => {
  it("GET /embed/:eventSlug/sessions/:sessionId is 200 rendered inside EmbedShell (no chq-nav)", async () => {
    const app = buildApp();
    const res = await app.request(`/embed/${EVENT.slug}/sessions/${SESSION.id}`);
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).not.toContain('<nav class="chq-nav"');
    expect(body).toContain(SESSION.title);
  });

  it("GET /embed/:eventSlug/sessions/:sessionId Back link href starts with /embed/", async () => {
    const app = buildApp();
    const res = await app.request(`/embed/${EVENT.slug}/sessions/${SESSION.id}`);
    const body = await res.text();
    const match = body.match(/<a class="chq-pub-accent-link" href="([^"]+)">\s*← Back to/);
    expect(match).not.toBeNull();
    const href = match?.[1];
    expect(href).toBeDefined();
    expect(href!.startsWith("/embed/")).toBe(true);
  });

  it("GET /embed/:eventSlug/sessions/:sessionId 404s for an unknown session id", async () => {
    const app = buildApp();
    const res = await app.request(`/embed/${EVENT.slug}/sessions/does-not-exist`);
    expect(res.status).toBe(404);
  });

  it("GET /embed/:eventSlug/speakers/:contactId is 200 rendered inside EmbedShell (no chq-nav)", async () => {
    const app = buildApp();
    const res = await app.request(`/embed/${EVENT.slug}/speakers/${SPEAKER.contactId}`);
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).not.toContain('<nav class="chq-nav"');
    expect(body).toContain(SPEAKER.firstName);
  });

  it("GET /embed/:eventSlug/speakers/:contactId Back link href starts with /embed/", async () => {
    const app = buildApp();
    const res = await app.request(`/embed/${EVENT.slug}/speakers/${SPEAKER.contactId}`);
    const body = await res.text();
    const match = body.match(/<a class="chq-pub-accent-link" href="([^"]+)">\s*← Back to/);
    expect(match).not.toBeNull();
    const href = match?.[1];
    expect(href).toBeDefined();
    expect(href!.startsWith("/embed/")).toBe(true);
  });

  it("GET /embed/:eventSlug/speakers/:contactId 404s for an unknown contact id", async () => {
    const app = buildApp();
    const res = await app.request(`/embed/${EVENT.slug}/speakers/does-not-exist`);
    expect(res.status).toBe(404);
  });
});
