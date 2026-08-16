// DEC-822/DEC-839: a saved embed stores its recipe, not just its name.
// POST/PATCH /api/v1/.../embeds validate every option key through the SAME
// parsers the live public route runs (src/routes/public/query.ts); GET
// /embed/e/:id re-hydrates the stored JSON once (src/server/repo/embeds.ts
// parseStoredEmbedOptions) and feeds it straight into the render pipeline.
// This test proves the two ends agree: every option key the API accepts
// round-trips, byte for byte, into the params renderSurfaceContent receives.

import { describe, expect, it, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import { embedsRoutes } from "../src/routes/api/embeds";
import { savedEmbedRoutes } from "../src/routes/public/saved-embed";
import { registerErrorHandler } from "../src/server/http";
import type { AppEnv, AuthInfo } from "../src/server/env";
import type { KVStore } from "../src/lib/draft";

const ORG = "org-a";
const EVENT_ID = "event-1";

const EVENT = {
  id: EVENT_ID,
  orgId: ORG,
  name: "Test Event",
  slug: "conf",
  startDate: "2026-08-10",
  endDate: "2026-08-10",
  location: null,
  timezone: "UTC",
  recordPrefix: "SES",
  brandingJson: null,
};

// In-memory embed store, standing in for the D1-backed repo (no local
// sqlite/D1 test driver is wired up -- same rationale as
// test/saved-embed-route.test.ts).
interface StoredEmbed {
  id: string;
  orgId: string;
  eventId: string;
  name: string;
  surface: string;
  format: string;
  optionsJson: string;
  enabled: boolean;
  createdAt: number;
  updatedAt: number;
}

let store: Map<string, StoredEmbed>;
let nextId: number;

function toRecord(row: StoredEmbed) {
  return { ...row, options: JSON.parse(row.optionsJson) };
}

vi.mock("../src/server/repo/embeds", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/embeds")>("../src/server/repo/embeds");
  return {
    ...actual,
    // DEC-822 cap: POST now counts existing embeds before creating. The
    // fake db here has no .select, so this must be mocked like every other
    // repo call this file already stubs.
    countEmbeds: vi.fn(async () => store.size),
    createEmbed: vi.fn(
      async (_db: unknown, orgId: string, eventId: string, name: string, surface: string, format: string, optionsJson: string) => {
        const id = `emb-${nextId++}`;
        const row: StoredEmbed = { id, orgId, eventId, name, surface, format, optionsJson, enabled: true, createdAt: 1, updatedAt: 1 };
        store.set(id, row);
        return toRecord(row);
      },
    ),
    getEmbedOwnership: vi.fn(async (_db: unknown, id: string) => {
      const row = store.get(id);
      return row ? { orgId: row.orgId, eventId: row.eventId, surface: row.surface, options: JSON.parse(row.optionsJson) } : null;
    }),
    trackBelongsToEvent: vi.fn(async (_db: unknown, trackId: string, eventId: string) => trackId === "track-1" && eventId === EVENT_ID),
    roomBelongsToEvent: vi.fn(async () => true),
    updateEmbed: vi.fn(
      async (
        _db: unknown,
        id: string,
        patch: { name?: string; surface?: string; format?: string; optionsJson?: string; enabled?: boolean },
      ) => {
        const row = store.get(id);
        if (!row) return null;
        if (patch.name !== undefined) row.name = patch.name;
        if (patch.surface !== undefined) row.surface = patch.surface;
        if (patch.format !== undefined) row.format = patch.format;
        if (patch.optionsJson !== undefined) row.optionsJson = patch.optionsJson;
        if (patch.enabled !== undefined) row.enabled = patch.enabled;
        store.set(id, row);
        return toRecord(row);
      },
    ),
    getEmbedById: vi.fn(async (_db: unknown, id: string) => {
      const row = store.get(id);
      return row ? toRecord(row) : null;
    }),
  };
});

vi.mock("../src/server/repo/submissions", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/submissions")>("../src/server/repo/submissions");
  return { ...actual, getEventOrgId: vi.fn(async (_db: unknown, eventId: string) => (eventId === EVENT_ID ? ORG : null)) };
});

vi.mock("../src/server/repo/public", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/public")>("../src/server/repo/public");
  return { ...actual, getPublicEventById: vi.fn(async (_db: unknown, id: string) => (id === EVENT_ID ? EVENT : null)) };
});

// Captures exactly the params the public render pipeline receives, so the
// test can assert the API's validated options and the renderer's consumed
// params are the SAME values.
vi.mock("../src/routes/public/dispatch", () => ({
  renderSurfaceContent: vi.fn(async () => ({ title: "Sessions", content: "<div>ok</div>" })),
}));
import { renderSurfaceContent } from "../src/routes/public/dispatch";
const renderSurfaceContentMock = vi.mocked(renderSurfaceContent);

class InMemoryKV implements KVStore {
  private map = new Map<string, string>();
  async get(key: string) {
    return this.map.get(key) ?? null;
  }
  async put(key: string, value: string) {
    this.map.set(key, value);
  }
  async delete(key: string) {
    this.map.delete(key);
  }
}

class InMemoryCache {
  map = new Map<string, Response>();
  async match(request: Request) {
    return this.map.get(request.url);
  }
  async put(request: Request, response: Response) {
    this.map.set(request.url, response);
  }
}

const publicCache = new InMemoryCache();
(globalThis as unknown as { caches: { default: InMemoryCache } }).caches = { default: publicCache };

const ORGANIZER: AuthInfo = { userId: "u-organizer", role: "organizer", orgId: ORG };

function buildApp() {
  const app = new Hono<AppEnv>();
  registerErrorHandler(app);
  app.use("*", async (c, next) => {
    c.set("db", {} as AppEnv["Variables"]["db"]);
    c.set("auth", ORGANIZER);
    await next();
  });
  app.route("/api/v1", embedsRoutes);
  app.route("/", savedEmbedRoutes);
  const env = { KV: new InMemoryKV() as unknown as AppEnv["Bindings"]["KV"] };
  return {
    request: (path: string, init?: RequestInit) =>
      app.request(path, { ...init, headers: { "content-type": "application/json", "x-chq-csrf": "1", ...(init?.headers ?? {}) } }, env),
  };
}

const FULL_OPTIONS = {
  trackId: "track-1",
  day: "2026-08-10",
  q: "AI Engineering",
  limit: 6,
  fields: ["track", "time", "speaker"],
  accent: "#ABC",
};

describe("DEC-822/DEC-839: saved-embed options round-trip", () => {
  beforeEach(() => {
    store = new Map();
    nextId = 1;
    renderSurfaceContentMock.mockClear();
    publicCache.map.clear();
  });

  it("POST stores every option key, validated, and the response returns the PARSED shape (not a JSON string)", async () => {
    const app = buildApp();
    const res = await app.request(`/api/v1/events/${EVENT_ID}/embeds`, {
      method: "POST",
      body: JSON.stringify({ name: "Homepage widget", surface: "sessions", format: "iframe", options: FULL_OPTIONS }),
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as { options: Record<string, unknown> };
    expect(body.options).toEqual({
      trackId: "track-1",
      day: "2026-08-10",
      q: "AI Engineering",
      limit: 6,
      fields: ["track", "time", "speaker"],
      accent: "#aabbcc", // parseAccent normalizes 3-digit hex, lowercased
    });
  });

  it("every option key the API accepts round-trips through the public renderer", async () => {
    const app = buildApp();
    const createRes = await app.request(`/api/v1/events/${EVENT_ID}/embeds`, {
      method: "POST",
      body: JSON.stringify({ name: "Homepage widget", surface: "sessions", format: "iframe", options: FULL_OPTIONS }),
    });
    const embed = (await createRes.json()) as { id: string };

    const renderRes = await app.request(`/embed/e/${embed.id}`);
    expect(renderRes.status).toBe(200);

    expect(renderSurfaceContentMock).toHaveBeenCalledTimes(1);
    const params = renderSurfaceContentMock.mock.calls[0]![3] as Record<string, unknown>;
    expect(params.trackId).toBe("track-1");
    expect(params.day).toBe("2026-08-10");
    expect(params.q).toBe("AI Engineering");
    expect(params.limit).toBe(6);
    expect(params.fields).toEqual({ track: true, time: true, room: false, speaker: true, description: false, format: false });
    expect(params.embed).toBe(true);
  });

  it("PATCH validates options through the same parsers and rejects an unparseable value loudly (400 naming the field)", async () => {
    const app = buildApp();
    const createRes = await app.request(`/api/v1/events/${EVENT_ID}/embeds`, {
      method: "POST",
      body: JSON.stringify({ name: "Homepage widget", surface: "sessions", format: "iframe", options: {} }),
    });
    const embed = (await createRes.json()) as { id: string };

    const badRes = await app.request(`/api/v1/embeds/${embed.id}`, {
      method: "PATCH",
      body: JSON.stringify({ options: { day: "not-a-date" } }),
    });
    expect(badRes.status).toBe(400);
    const body = (await badRes.json()) as { error: { fields?: Record<string, string> } };
    expect(body.error.fields).toHaveProperty("day");

    const badLimitRes = await app.request(`/api/v1/embeds/${embed.id}`, {
      method: "PATCH",
      body: JSON.stringify({ options: { limit: 999 } }),
    });
    expect(badLimitRes.status).toBe(400);

    const badFieldRes = await app.request(`/api/v1/embeds/${embed.id}`, {
      method: "PATCH",
      body: JSON.stringify({ options: { fields: ["not-a-real-field"] } }),
    });
    expect(badFieldRes.status).toBe(400);
  });

  it("PATCH updates options and the change round-trips through the renderer", async () => {
    const app = buildApp();
    const createRes = await app.request(`/api/v1/events/${EVENT_ID}/embeds`, {
      method: "POST",
      body: JSON.stringify({ name: "Homepage widget", surface: "sessions", format: "iframe", options: {} }),
    });
    const embed = (await createRes.json()) as { id: string };

    const patchRes = await app.request(`/api/v1/embeds/${embed.id}`, {
      method: "PATCH",
      body: JSON.stringify({ options: { day: "2026-08-11" } }),
    });
    expect(patchRes.status).toBe(200);
    const patched = (await patchRes.json()) as { options: Record<string, unknown> };
    expect(patched.options.day).toBe("2026-08-11");

    await app.request(`/embed/e/${embed.id}`);
    const params = renderSurfaceContentMock.mock.calls[0]![3] as Record<string, unknown>;
    expect(params.day).toBe("2026-08-11");
  });

  // DEC-839 amendment: trackId/roomId/sessionFormat/q go through
  // parseBoundedText BEFORE the live (unbounded) parser, and a trackId/
  // roomId is confirmed to belong to the embed's OWN event — a foreign-event
  // id must never persist into options_json. Both routes share the same
  // parseEmbedOptionsInput, so both must reject identically.
  it("POST rejects an over-length q as a 400 naming the field", async () => {
    const app = buildApp();
    const res = await app.request(`/api/v1/events/${EVENT_ID}/embeds`, {
      method: "POST",
      body: JSON.stringify({
        name: "Homepage widget",
        surface: "sessions",
        format: "iframe",
        options: { q: "x".repeat(500) },
      }),
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { fields?: Record<string, string> } };
    expect(body.error.fields).toHaveProperty("q");
  });

  it("PATCH rejects an over-length q as a 400 naming the field", async () => {
    const app = buildApp();
    const createRes = await app.request(`/api/v1/events/${EVENT_ID}/embeds`, {
      method: "POST",
      body: JSON.stringify({ name: "Homepage widget", surface: "sessions", format: "iframe", options: {} }),
    });
    const embed = (await createRes.json()) as { id: string };

    const res = await app.request(`/api/v1/embeds/${embed.id}`, {
      method: "PATCH",
      body: JSON.stringify({ options: { q: "x".repeat(500) } }),
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { fields?: Record<string, string> } };
    expect(body.error.fields).toHaveProperty("q");
  });

  it("POST rejects a trackId that does not belong to this event as a 400 naming the field", async () => {
    const app = buildApp();
    const res = await app.request(`/api/v1/events/${EVENT_ID}/embeds`, {
      method: "POST",
      body: JSON.stringify({
        name: "Homepage widget",
        surface: "sessions",
        format: "iframe",
        options: { trackId: "track-from-another-event" },
      }),
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { fields?: Record<string, string> } };
    expect(body.error.fields).toHaveProperty("trackId");
  });

  it("PATCH rejects a trackId that does not belong to this event as a 400 naming the field", async () => {
    const app = buildApp();
    const createRes = await app.request(`/api/v1/events/${EVENT_ID}/embeds`, {
      method: "POST",
      body: JSON.stringify({ name: "Homepage widget", surface: "sessions", format: "iframe", options: {} }),
    });
    const embed = (await createRes.json()) as { id: string };

    const res = await app.request(`/api/v1/embeds/${embed.id}`, {
      method: "PATCH",
      body: JSON.stringify({ options: { trackId: "track-from-another-event" } }),
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { fields?: Record<string, string> } };
    expect(body.error.fields).toHaveProperty("trackId");
  });

  // DEC-822 wave-59 amendment: the disabled blank is a MINIMAL designed
  // document (one quiet line), not a literal empty body. Status, cache
  // headers and the "render pipeline is never touched" guarantee are
  // unchanged -- the blank renders with no event lookup at all.
  it("a disabled embed returns a minimal designed 200 without touching the render pipeline", async () => {
    const app = buildApp();
    const createRes = await app.request(`/api/v1/events/${EVENT_ID}/embeds`, {
      method: "POST",
      body: JSON.stringify({ name: "Homepage widget", surface: "sessions", format: "iframe", options: {} }),
    });
    const embed = (await createRes.json()) as { id: string };

    await app.request(`/api/v1/embeds/${embed.id}`, { method: "PATCH", body: JSON.stringify({ enabled: false }) });

    const res = await app.request(`/embed/e/${embed.id}`);
    expect(res.status).toBe(200);
    expect(await res.text()).toContain("This embed has been turned off.");
    expect(renderSurfaceContentMock).not.toHaveBeenCalled();
  });
});
