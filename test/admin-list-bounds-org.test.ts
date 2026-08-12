// DEC-460/DEC-461 coverage: the three org-wide admin list endpoints
// (pipeline, users, segments) must bound `perPage` to <=200 (default 200),
// honor `page` offsets, and report the TRUE total regardless of the page
// size requested. Repo calls are mocked (mirrors test/users-api.test.ts's
// pattern) so this is route-level, no D1/wrangler dependency in stage 1.

import { afterEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { registerErrorHandler } from "../src/server/http";
import type { AppEnv, AuthInfo } from "../src/server/env";

const ORG_A = "org-a";
const ORGANIZER_A: AuthInfo = { userId: "u-organizer-a", role: "organizer", orgId: ORG_A };

function makeApp(mount: (app: Hono<AppEnv>) => void, auth: AuthInfo | undefined) {
  const app = new Hono<AppEnv>();
  registerErrorHandler(app);
  app.use("*", async (c, next) => {
    if (auth) c.set("auth", auth);
    c.set("db", {} as never);
    await next();
  });
  mount(app);
  return app;
}

/** Builds a full org's worth of fake rows (id0..idN-1), and mock
 * list/count fns that honor an optional `page` the way the real repo fns
 * do: `page` absent returns everything, present slices [offset, offset+limit). */
function makeFakeRows(n: number) {
  return Array.from({ length: n }, (_, i) => ({ id: `id-${String(i).padStart(5, "0")}` }));
}

function slice<T>(rows: T[], page?: { limit: number; offset: number }): T[] {
  if (!page) return rows;
  return rows.slice(page.offset, page.offset + page.limit);
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.resetModules();
});

describe("GET /api/v1/pipeline bounds (DEC-460/461)", () => {
  const ALL = makeFakeRows(250).map((r) => ({
    id: r.id,
    contactId: r.id,
    firstName: "F",
    lastName: "L",
    company: null,
    email: "f@example.com",
    stage: "identified" as const,
    updatedAt: 0,
  }));

  async function buildPipelineApp() {
    vi.doMock("../src/server/repo/pipeline", async () => {
      const actual = await vi.importActual<typeof import("../src/server/repo/pipeline")>("../src/server/repo/pipeline");
      return {
        ...actual,
        listPipelineForOrg: vi.fn(async (_db: unknown, orgId: string, page?: { limit: number; offset: number }) => {
          if (orgId !== ORG_A) return [];
          return slice(ALL, page);
        }),
        countPipelineForOrg: vi.fn(async (_db: unknown, orgId: string) => (orgId === ORG_A ? ALL.length : 0)),
      };
    });
    const { pipelineRoutes } = await import("../src/routes/api/pipeline");
    return makeApp((app) => app.route("/api/v1", pipelineRoutes), ORGANIZER_A);
  }

  it("caps perPage=100000 at 200 items", async () => {
    const app = await buildPipelineApp();
    const res = await app.request("/api/v1/pipeline?perPage=100000");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { items: unknown[]; total: number; page: number; perPage: number };
    expect(body.items.length).toBeLessThanOrEqual(200);
    expect(body.perPage).toBe(200);
  });

  // DEC-465: pipeline.ts now uses the shared listPerPage helper, which
  // resolves an invalid perPage (like "abc") to MAX_PER_PAGE (200), not
  // clampPerPage's own 50 default -- fixing the gap DEC-461(a) intended.
  it("uses listPerPage's 200 default when perPage=abc", async () => {
    const app = await buildPipelineApp();
    const res = await app.request("/api/v1/pipeline?perPage=abc");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { items: unknown[]; perPage: number };
    expect(body.perPage).toBe(200);
    expect(body.items.length).toBeLessThanOrEqual(200);
  });

  it("offsets by page=2", async () => {
    const app = await buildPipelineApp();
    const res = await app.request("/api/v1/pipeline?page=2&perPage=100");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { items: { id: string }[] };
    expect(body.items[0]?.id).toBe(ALL[100]?.id);
  });

  it("reports the full total regardless of perPage", async () => {
    const app = await buildPipelineApp();
    const res = await app.request("/api/v1/pipeline?perPage=10");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { total: number };
    expect(body.total).toBe(250);
  });
});

describe("GET /api/v1/users bounds (DEC-460/461)", () => {
  const ALL = makeFakeRows(250).map((r) => ({ id: r.id, orgId: ORG_A, email: `${r.id}@example.com`, role: "reviewer", contactId: null, createdAt: 0 }));

  async function buildUsersApp() {
    vi.doMock("../src/server/repo/users", async () => {
      const actual = await vi.importActual<typeof import("../src/server/repo/users")>("../src/server/repo/users");
      return {
        ...actual,
        listOrgUsers: vi.fn(async (_db: unknown, orgId: string, _role?: string, page?: { limit: number; offset: number }) => {
          if (orgId !== ORG_A) return [];
          return slice(ALL, page);
        }),
        countOrgUsers: vi.fn(async (_db: unknown, orgId: string) => (orgId === ORG_A ? ALL.length : 0)),
      };
    });
    vi.doMock("../src/server/repo/events", async () => {
      const actual = await vi.importActual<typeof import("../src/server/repo/events")>("../src/server/repo/events");
      return { ...actual, listEventsForOrg: vi.fn(async () => []) };
    });
    const { usersRoutes } = await import("../src/routes/api/users");
    return makeApp((app) => app.route("/", usersRoutes), ORGANIZER_A);
  }

  it("caps perPage=100000 at 200 items", async () => {
    const app = await buildUsersApp();
    const res = await app.request("/api/v1/users?perPage=100000");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { items: unknown[]; perPage: number };
    expect(body.items.length).toBeLessThanOrEqual(200);
    expect(body.perPage).toBe(200);
  });

  // DEC-465: users.ts's GET list handler now uses listPerPage, which
  // resolves an invalid perPage (like "abc") to MAX_PER_PAGE (200).
  it("uses listPerPage's 200 default when perPage=abc", async () => {
    const app = await buildUsersApp();
    const res = await app.request("/api/v1/users?perPage=abc");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { items: unknown[]; perPage: number };
    expect(body.perPage).toBe(200);
    expect(body.items.length).toBeLessThanOrEqual(200);
  });

  it("offsets by page=2", async () => {
    const app = await buildUsersApp();
    const res = await app.request("/api/v1/users?page=2&perPage=100");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { items: { id: string }[] };
    expect(body.items[0]?.id).toBe(ALL[100]?.id);
  });

  it("reports the full total regardless of perPage", async () => {
    const app = await buildUsersApp();
    const res = await app.request("/api/v1/users?perPage=10");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { total: number };
    expect(body.total).toBe(250);
  });
});

describe("GET /api/v1/segments bounds (DEC-460/461)", () => {
  const ALL = makeFakeRows(250).map((r) => ({ id: r.id, orgId: ORG_A, name: r.id, rulesJson: "[]", createdAt: 0, updatedAt: 0 }));

  async function buildSegmentsApp() {
    vi.doMock("../src/server/repo/contacts", async () => {
      const actual = await vi.importActual<typeof import("../src/server/repo/contacts")>("../src/server/repo/contacts");
      return {
        ...actual,
        listSegmentsForOrg: vi.fn(async (_db: unknown, orgId: string, page?: { limit: number; offset: number }) => {
          if (orgId !== ORG_A) return [];
          return slice(ALL, page);
        }),
        countSegmentsForOrg: vi.fn(async (_db: unknown, orgId: string) => (orgId === ORG_A ? ALL.length : 0)),
      };
    });
    const { contactsRoutes } = await import("../src/routes/api/contacts");
    return makeApp((app) => app.route("/api/v1", contactsRoutes), ORGANIZER_A);
  }

  it("caps perPage=100000 at 200 items", async () => {
    const app = await buildSegmentsApp();
    const res = await app.request("/api/v1/segments?perPage=100000");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { items: unknown[]; perPage: number };
    expect(body.items.length).toBeLessThanOrEqual(200);
    expect(body.perPage).toBe(200);
  });

  // DEC-465: contacts/segments.ts now uses listPerPage, which resolves an
  // invalid perPage (like "abc") to MAX_PER_PAGE (200).
  it("uses listPerPage's 200 default when perPage=abc", async () => {
    const app = await buildSegmentsApp();
    const res = await app.request("/api/v1/segments?perPage=abc");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { items: unknown[]; perPage: number };
    expect(body.perPage).toBe(200);
    expect(body.items.length).toBeLessThanOrEqual(200);
  });

  it("offsets by page=2", async () => {
    const app = await buildSegmentsApp();
    const res = await app.request("/api/v1/segments?page=2&perPage=100");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { items: { id: string }[] };
    expect(body.items[0]?.id).toBe(ALL[100]?.id);
  });

  it("reports the full total regardless of perPage", async () => {
    const app = await buildSegmentsApp();
    const res = await app.request("/api/v1/segments?perPage=10");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { total: number };
    expect(body.total).toBe(250);
  });
});
