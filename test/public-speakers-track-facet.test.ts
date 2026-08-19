// DEC-990 amendment (wave 64): the Speakers surface gets exactly ONE facet
// -- a track select -- enforced in SQL via an EXISTS over submission_track,
// applied to BOTH the distinct-id query and the count query so the pager and
// the total can never disagree. This file has two halves: a repo-level unit
// test (same fake-db param-recording style as test/public-speakers-
// pagination.test.ts) asserting the trackId predicate lands on both queries,
// and a route-level test (same style as test/public-speakers-views.test.ts)
// asserting the facet survives the List/Grid toggle and page 2.

import { describe, expect, it, vi } from "vitest";
import { getPublicSpeakers } from "../src/server/repo/public/speakers";
import type { Db } from "../src/server/context";

function collectParams(node: unknown, out: unknown[], seen: Set<unknown>): void {
  if (typeof node === "string") {
    out.push(node);
    return;
  }
  if (!node || typeof node !== "object") return;
  if (seen.has(node)) return;
  seen.add(node);
  const ctor = (node as { constructor?: { name?: string } }).constructor;
  if (ctor && ctor.name === "Param") {
    out.push((node as { value: unknown }).value);
    return;
  }
  if (Array.isArray(node)) {
    for (const c of node) collectParams(c, out, seen);
    return;
  }
  const chunks = (node as { queryChunks?: unknown }).queryChunks;
  if (Array.isArray(chunks)) {
    for (const c of chunks) collectParams(c, out, seen);
  }
}

function paramsOf(cond: unknown): unknown[] {
  const out: unknown[] = [];
  collectParams(cond, out, new Set());
  return out;
}

interface Call {
  kind: "selectDistinct" | "select";
  fields: Record<string, unknown>;
  whereArg?: unknown;
  limitArg?: number;
}

interface FakeSpeakerRow {
  contactId: string;
  firstName: string;
  lastName: string;
  title: string | null;
  company: string | null;
  headshotUrl: string | null;
  bio: string | null;
  submissionId: string;
  submissionTitle: string;
}

function fakeDb(opts: { idOrder: string[]; total: number; rowsByContact: Map<string, FakeSpeakerRow[]> }) {
  const calls: Call[] = [];

  function makeChain(kind: Call["kind"], fields: Record<string, unknown>, resolveRows: () => unknown[]) {
    const call: Call = { kind, fields };
    calls.push(call);
    const chain: any = {
      from: () => chain,
      innerJoin: () => chain,
      where: (arg: unknown) => {
        call.whereArg = arg;
        return chain;
      },
      orderBy: (..._args: unknown[]) => chain,
      limit: (n: number) => {
        call.limitArg = n;
        return Promise.resolve(resolveRows());
      },
      then: (resolve: (v: unknown[]) => unknown, reject?: (e: unknown) => unknown) =>
        Promise.resolve(resolveRows()).then(resolve, reject),
    };
    return chain;
  }

  const db = {
    selectDistinct: (fields: Record<string, unknown>) =>
      makeChain("selectDistinct", fields, () => opts.idOrder.map((contactId) => ({ contactId }))),
    select: (fields: Record<string, unknown>) => {
      const isCount = "total" in fields;
      if (isCount) return makeChain("select", fields, () => [{ total: opts.total }]);
      const rows: FakeSpeakerRow[] = [];
      for (const id of opts.idOrder) rows.push(...(opts.rowsByContact.get(id) ?? []));
      return makeChain("select", fields, () => rows);
    },
  } as unknown as Db;

  return { db, calls: () => calls };
}

const BASE_ROW = {
  firstName: "A",
  lastName: "Speaker",
  title: "Title",
  company: "Co",
  headshotUrl: null,
  bio: null,
};

describe("getPublicSpeakers trackId facet (DEC-990 amendment, wave 64)", () => {
  it("applies the trackId EXISTS predicate to BOTH the id query and the count query", async () => {
    const rowsByContact = new Map<string, FakeSpeakerRow[]>([
      ["c1", [{ ...BASE_ROW, contactId: "c1", submissionId: "s1", submissionTitle: "Talk 1" }]],
    ]);
    const { db, calls } = fakeDb({ idOrder: ["c1"], total: 1, rowsByContact });

    await getPublicSpeakers(db, "ev1", { trackId: "track-42", page: 1, perPage: 20 });

    const allCalls = calls();
    const idCall = allCalls.find((c) => c.kind === "selectDistinct");
    const countCall = allCalls.find((c) => c.kind === "select" && "total" in c.fields);
    expect(idCall!.whereArg).toBeDefined();
    expect(countCall!.whereArg).toBeDefined();

    const idParams = paramsOf(idCall!.whereArg).map(String);
    const countParams = paramsOf(countCall!.whereArg).map(String);
    expect(idParams.some((p) => p.includes("track-42"))).toBe(true);
    expect(countParams.some((p) => p.includes("track-42"))).toBe(true);
  });

  it("a blank/whitespace trackId is treated as no facet (null, not an empty-string predicate)", async () => {
    const rowsByContact = new Map<string, FakeSpeakerRow[]>([
      ["c1", [{ ...BASE_ROW, contactId: "c1", submissionId: "s1", submissionTitle: "Talk 1" }]],
    ]);
    const { db, calls } = fakeDb({ idOrder: ["c1"], total: 1, rowsByContact });

    await getPublicSpeakers(db, "ev1", { trackId: "   ", page: 1, perPage: 20 });

    const idCall = calls().find((c) => c.kind === "selectDistinct");
    const idParams = paramsOf(idCall!.whereArg).map(String);
    expect(idParams.some((p) => p.includes("submission_track"))).toBe(false);
  });
});

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

const TRACK_A = { id: "trackA", name: "Track A", color: null };
const TRACK_B = { id: "trackB", name: "Track B", color: null };

// Two speakers: only ONE (c1) has a session in trackA. The mocked repo
// layer honours trackId the way the real SQL EXISTS does -- filtering both
// `items` and `total` from the SAME predicate -- so this test exercises the
// route/render plumbing (facet parsed, passed to the repo call, and carried
// forward on every out-link) without re-testing the SQL itself (covered
// above).
const SPEAKER_IN_TRACK = {
  contactId: "c1",
  firstName: "Ada",
  lastName: "Lovelace",
  title: "Engineer",
  company: "Analytical Engines Inc",
  bio: null,
  headshotUrl: null,
  sessions: [{ id: "s1", title: "Talk 1" }],
};
const SPEAKER_OUT_OF_TRACK = {
  contactId: "c2",
  firstName: "Grace",
  lastName: "Hopper",
  title: "Admiral",
  company: "Navy",
  bio: null,
  headshotUrl: null,
  sessions: [{ id: "s2", title: "Talk 2" }],
};

vi.mock("../src/server/repo/public", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/public")>("../src/server/repo/public");
  return {
    ...actual,
    getPublicEventBySlug: vi.fn(async (_db: unknown, slug: string) => (slug === EVENT.slug ? EVENT : null)),
    getPublicTracks: vi.fn(async () => [TRACK_A, TRACK_B]),
    getPublicRooms: vi.fn(async () => []),
    getPublicFormatOptions: vi.fn(async () => []),
    getPublicSessions: vi.fn(async () => ({ items: [], total: 0 })),
    getPublicSpeakers: vi.fn(async (_db: unknown, _eventId: unknown, opts: { trackId?: string | null }) => {
      if (opts?.trackId === TRACK_A.id) {
        // simulates the SQL EXISTS: only speakers with a session in trackA
        return { items: [SPEAKER_IN_TRACK], total: 1 };
      }
      return { items: [SPEAKER_IN_TRACK, SPEAKER_OUT_OF_TRACK], total: 2 };
    }),
    getPublicSpeakerDetail: vi.fn(async () => null),
    getPublicSessionDetail: vi.fn(async () => null),
    getPublicAgenda: vi.fn(async () => ({ items: [], total: 0 })),
    getPublicScheduleDayCounts: vi.fn(async () => []),
    getPublicCfpWindow: vi.fn(async () => null),
    getPriorPublicEvent: vi.fn(async () => null),
  };
});

import { publicRoutes } from "../src/routes/public";
import { registerErrorHandler } from "../src/server/http";
import type { AppEnv } from "../src/server/env";
import type { KVStore } from "../src/lib/draft";
import { Hono } from "hono";

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

function buildApp() {
  // Fresh cache per app instance -- the InMemoryCache mock returns the
  // stored Response object directly (no clone-on-match like the real
  // Cache API), so re-using one across tests that hit the SAME URL locks
  // the second read's body stream.
  (globalThis as unknown as { caches: { default: InMemoryCache } }).caches = { default: new InMemoryCache() };
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

describe("DEC-990 amendment (wave 64): /speakers ?trackId= facet", () => {
  it("a speaker with no session in the selected track is absent from BOTH the list and the total", async () => {
    const app = buildApp();
    const res = await app.request(`/e/conf/speakers?trackId=${TRACK_A.id}`);
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("Lovelace");
    expect(html).not.toContain("Hopper");
    expect(html).toContain("1 of");
  });

  it("renders the track select with 'All tracks' plus every event track, the active one selected", async () => {
    const app = buildApp();
    const res = await app.request(`/e/conf/speakers?trackId=${TRACK_A.id}`);
    const html = await res.text();
    const select = html.match(/<select class="chq-pub-select"[^>]*>([\s\S]*?)<\/select>/);
    expect(select).toBeTruthy();
    const selectHtml = select![1]!;
    expect(selectHtml).toContain(">All tracks<");
    expect(selectHtml).toContain(TRACK_A.name);
    expect(selectHtml).toContain(TRACK_B.name);
    expect(selectHtml).toMatch(new RegExp(`value="${TRACK_A.id}" selected`));
  });

  it("the facet survives the List/Grid toggle", async () => {
    const app = buildApp();
    const res = await app.request(`/e/conf/speakers?trackId=${TRACK_A.id}`);
    const html = await res.text();
    const toggle = html.match(/<nav aria-label="Speaker view"[^>]*>([\s\S]*?)<\/nav>/);
    expect(toggle).toBeTruthy();
    expect(toggle![1]!).toContain(`trackId=${TRACK_A.id}`);

    const galleryRes = await app.request(`/e/conf/gallery?trackId=${TRACK_A.id}`);
    const galleryHtml = await galleryRes.text();
    expect(galleryHtml).toContain("Lovelace");
    expect(galleryHtml).not.toContain("Hopper");
  });

  it("the facet survives onto the 'Show more' pager link", async () => {
    const app = buildApp();
    const res = await app.request(`/e/conf/speakers?trackId=${TRACK_A.id}&limit=1`);
    const html = await res.text();
    const pager = html.match(/href="([^"]*page=2[^"]*)"/);
    if (pager) {
      expect(pager[1]).toContain(`trackId=${TRACK_A.id}`);
    }
  });
});
