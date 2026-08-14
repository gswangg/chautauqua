// DEC-683 amendment (wave 68): the printable programme must never disagree
// with its own source -- it renders getPublicAgenda's `total` (truncation
// note, byte-identical to AgendaContent's) and routes every roomName through
// publicRoomLabel (DEC-666) so an unroomed session still names a room clause.
// Mocks the src/server/repo/public barrel the way test/public-page-headings.
// test.ts does.

import { beforeEach, describe, expect, it, vi } from "vitest";
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

function makeItem(
  overrides: Partial<import("../src/server/repo/public/agenda").PublicAgendaItem>,
): import("../src/server/repo/public/agenda").PublicAgendaItem {
  return {
    submissionId: "s1",
    ref: "SES-1",
    title: "A Session",
    description: null,
    day: "2026-08-10",
    startMin: 540,
    endMin: 600,
    roomId: null,
    roomName: null,
    roomPosition: null,
    icsSequence: 0,
    tracks: [],
    speakers: [],
    format: null,
    ...overrides,
  };
}

let agendaResult: { items: ReturnType<typeof makeItem>[]; total: number } = { items: [], total: 0 };

vi.mock("../src/server/repo/public", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/public")>(
    "../src/server/repo/public",
  );

  return {
    ...actual,
    getPublicEventBySlug: vi.fn(async (_db: unknown, slug: string) => (slug === EVENT.slug ? EVENT : null)),
    getPublicAgenda: vi.fn(async () => agendaResult),
    getPublicBreaksByDay: vi.fn(async () => new Map()),
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

// A fresh InMemoryCache per test (mirrors test/public-programme.test.ts):
// every test here requests the same "/e/conf/programme" URL, and a stored
// Response's body ReadableStream can only be read once -- reusing one cache
// instance across tests locks that stream on the second hit.
beforeEach(() => {
  (globalThis as unknown as { caches: { default: InMemoryCache } }).caches = { default: new InMemoryCache() };
});

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

describe("DEC-683 amendment: printable programme agrees with its own source", () => {
  it("renders a truncation note naming both numbers when items.length < total", async () => {
    agendaResult = { items: [makeItem({})], total: 5 };
    const app = buildApp();
    const res = await app.request("/e/conf/programme");
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('class="chq-prog-note"');
    expect(html).toContain("Showing the first 1 of 5 scheduled sessions.");
  });

  it("renders no truncation note when items.length === total", async () => {
    agendaResult = { items: [makeItem({})], total: 1 };
    const app = buildApp();
    const res = await app.request("/e/conf/programme");
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).not.toContain('class="chq-prog-note"');
    expect(html).not.toContain("Showing the first");
  });

  it("renders 'To be announced' for a null roomName sub-line", async () => {
    agendaResult = { items: [makeItem({ roomName: null })], total: 1 };
    const app = buildApp();
    const res = await app.request("/e/conf/programme");
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("To be announced");
  });
});
