// DEC-471 (re-running DEC-466's own criterion): the two list reads it missed
// -- GET /api/v1/submissions/:id/files and GET /api/v1/files/:fileId/comments
// -- used to end `c.json({ items })` with no `total`/`page`/`perPage`, so the
// SPA's ListEnvelope<T> typed `total` as `number` while the wire sent
// `undefined`. Repo calls are mocked (same buildApp() pattern as
// test/admin-list-bounds-review.test.ts) so these are pure route-level
// paging tests, no D1/wrangler dependency in stage 1.

import { afterEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { registerErrorHandler } from "../src/server/http";
import type { AppEnv, AuthInfo } from "../src/server/env";

const ORG_A = "org-a";
const SUBMISSION_ID = "sub-1";
const FILE_ID = "file-1";

// 250 file versions, all under one kind, DESC createdAt (newest first) --
// mirrors listSubmissionFiles' real ordering so the route's flatten+slice is
// exercised the same way it would be against a real grouped result.
const ALL_VERSIONS = Array.from({ length: 250 }, (_, i) => {
  const n = 250 - i; // createdAt descending: v250 first, v1 last
  return {
    id: `file-v${String(n).padStart(4, "0")}`,
    filename: `slides-v${n}.pdf`,
    sizeBytes: 100,
    contentType: "application/pdf",
    previousFileId: null,
    uploadedByContactId: "contact-1",
    createdAt: n,
  };
});

const ALL_COMMENTS = Array.from({ length: 250 }, (_, i) => ({
  id: `comment-${String(i + 1).padStart(4, "0")}`,
  body: `comment ${i + 1}`,
  authorName: "Reviewer",
  authorRole: "organizer",
  createdAt: i + 1,
}));

vi.mock("../src/server/repo/files", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/files")>("../src/server/repo/files");
  return {
    ...actual,
    getSubmissionScope: vi.fn(async (_db: unknown, submissionId: string) =>
      submissionId === SUBMISSION_ID
        ? { submissionId, eventId: "event-1", orgId: ORG_A, participantContactIds: [] }
        : null,
    ),
    listSubmissionFiles: vi.fn(async (_db: unknown, submissionId: string) =>
      submissionId === SUBMISSION_ID ? { slides: ALL_VERSIONS } : {},
    ),
    getFileScope: vi.fn(async (_db: unknown, fileId: string) =>
      fileId === FILE_ID
        ? {
            fileId,
            submissionId: SUBMISSION_ID,
            eventId: "event-1",
            orgId: ORG_A,
            uploadedByContactId: "contact-1",
            participantContactIds: [],
            filename: "slides.pdf",
            contentType: "application/pdf",
            r2Key: "k",
          }
        : null,
    ),
    canAccessFile: vi.fn(() => true),
    listFileComments: vi.fn(
      async (_db: unknown, fileId: string, page?: { limit: number; offset: number }) => {
        const all = fileId === FILE_ID ? ALL_COMMENTS : [];
        const start = page ? page.offset : 0;
        const end = page ? start + page.limit : all.length;
        return {
          items: all.slice(start, end),
          total: all.length,
          page: page ? Math.floor(page.offset / page.limit) + 1 : 1,
          perPage: page ? page.limit : all.length || 1,
        };
      },
    ),
  };
});

afterEach(() => {
  vi.clearAllMocks();
});

async function buildApp(auth: AuthInfo) {
  const { fileApiRoutes } = await import("../src/routes/files");
  const app = new Hono<AppEnv>();
  registerErrorHandler(app);
  app.use("*", async (c, next) => {
    c.set("auth", auth);
    c.set("db", {} as never);
    await next();
  });
  app.route("/api/v1", fileApiRoutes);
  return app;
}

const organizer: AuthInfo = { userId: "org-user", role: "organizer", orgId: ORG_A };

interface Envelope {
  items: unknown[];
  total: number;
  page: number;
  perPage: number;
}

describe("DEC-471: GET /api/v1/submissions/:id/files", () => {
  it("no ?perPage returns exactly 200 items with total 250", async () => {
    const app = await buildApp(organizer);
    const res = await app.request(`/api/v1/submissions/${SUBMISSION_ID}/files`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as Envelope;
    expect(body.items.length).toBe(200);
    expect(body.total).toBe(250);
  });

  it("?perPage=abc (absent-or-invalid) still yields 200 items, not 50", async () => {
    const app = await buildApp(organizer);
    const res = await app.request(`/api/v1/submissions/${SUBMISSION_ID}/files?perPage=abc`);
    const body = (await res.json()) as Envelope;
    expect(body.perPage).toBe(200);
    expect(body.items.length).toBe(200);
  });

  it("?page=2&perPage=10 returns items 11-20 with total still 250", async () => {
    const app = await buildApp(organizer);
    const res = await app.request(`/api/v1/submissions/${SUBMISSION_ID}/files?page=2&perPage=10`);
    const body = (await res.json()) as { items: { id: string }[]; total: number };
    expect(body.items.length).toBe(10);
    expect(body.total).toBe(250);
    expect(body.items[0]?.id).toBe(ALL_VERSIONS[10]?.id);
    expect(body.items[9]?.id).toBe(ALL_VERSIONS[19]?.id);
  });

  it("envelope always carries all four keys", async () => {
    const app = await buildApp(organizer);
    const res = await app.request(`/api/v1/submissions/${SUBMISSION_ID}/files`);
    const body = (await res.json()) as Envelope;
    expect(Object.keys(body).sort()).toEqual(["items", "page", "perPage", "total"]);
  });
});

describe("DEC-471: GET /api/v1/files/:fileId/comments", () => {
  it("no ?perPage returns exactly 200 items with total 250", async () => {
    const app = await buildApp(organizer);
    const res = await app.request(`/api/v1/files/${FILE_ID}/comments`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as Envelope;
    expect(body.items.length).toBe(200);
    expect(body.total).toBe(250);
  });

  it("?perPage=abc (absent-or-invalid) still yields 200 items, not 50", async () => {
    const app = await buildApp(organizer);
    const res = await app.request(`/api/v1/files/${FILE_ID}/comments?perPage=abc`);
    const body = (await res.json()) as Envelope;
    expect(body.perPage).toBe(200);
    expect(body.items.length).toBe(200);
  });

  it("?page=2&perPage=10 returns items 11-20 with total still 250", async () => {
    const app = await buildApp(organizer);
    const res = await app.request(`/api/v1/files/${FILE_ID}/comments?page=2&perPage=10`);
    const body = (await res.json()) as { items: { id: string }[]; total: number };
    expect(body.items.length).toBe(10);
    expect(body.total).toBe(250);
    expect(body.items[0]?.id).toBe(ALL_COMMENTS[10]?.id);
    expect(body.items[9]?.id).toBe(ALL_COMMENTS[19]?.id);
  });

  it("envelope always carries all four keys", async () => {
    const app = await buildApp(organizer);
    const res = await app.request(`/api/v1/files/${FILE_ID}/comments`);
    const body = (await res.json()) as Envelope;
    expect(Object.keys(body).sort()).toEqual(["items", "page", "perPage", "total"]);
  });
});
