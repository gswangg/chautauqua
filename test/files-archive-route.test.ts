// DEC-160 route-level coverage for POST /api/v1/events/:eventId/files/archive:
// authz (organizer + org-scoped), 1..50 fileIds validation, and the
// application/zip response with Content-Disposition naming the event slug.
// Repo functions are mocked here (route wiring under test, not repo logic —
// repo logic is covered against a fake DB in test/files-library.test.ts;
// kept in a separate file because vi.mock("../src/server/repo/files") hoists
// file-wide). Fake R2 bucket follows test/reviewer-file-access.test.ts.

import { describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { registerErrorHandler } from "../src/server/http";
import { ApiError } from "../src/server/http";
import type { AppEnv, AuthInfo } from "../src/server/env";

vi.mock("../src/server/repo/files", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/files")>("../src/server/repo/files");
  return {
    ...actual,
    getEventFilesScope: vi.fn(async (_db: unknown, eventId: string) =>
      eventId === "event-1" ? { orgId: "org-1", slug: "demo-event" } : null,
    ),
    resolveLatestVersions: vi.fn(async (_db: unknown, _eventId: string, fileIds: string[]) => {
      const map = new Map<string, { id: string; filename: string; contentType: string; r2Key: string; submissionTitle: string }>();
      for (const id of fileIds) {
        if (id === "unknown-file") {
          throw new ApiError("not_found", `File ${id} is not a deliverable of this event`);
        }
        map.set(id, {
          id: "file-v2",
          filename: "slides.pdf",
          contentType: "application/pdf",
          r2Key: "sub/sub-1/slides.pdf",
          submissionTitle: "Scaling Vector Search",
        });
      }
      return map;
    }),
    listEventDeliverableFiles: vi.fn(async () => ({
      items: [
        {
          rootFileId: "file-v1",
          latestFileId: "file-v2",
          filename: "slides.pdf",
          kind: "presentation",
          submissionId: "sub-1",
          submissionRef: "SES-014",
          submissionTitle: "Scaling Vector Search",
          speakerName: "Priya Raman",
          uploadedAt: Date.now(),
          versionCount: 2,
        },
      ],
      total: 137,
      page: 1,
      perPage: 50,
    })),
  };
});

function fakeFilesBucket(bytes: Uint8Array) {
  return {
    async get() {
      return {
        body: new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(bytes);
            controller.close();
          },
        }),
        httpMetadata: { contentType: "application/pdf" },
        size: bytes.length,
      };
    },
    async put() {},
    async delete() {},
  } as unknown as R2Bucket;
}

async function buildArchiveApp(auth: AuthInfo, bytes: Uint8Array) {
  const { fileApiRoutes } = await import("../src/routes/files");
  const app = new Hono<AppEnv>();
  registerErrorHandler(app);
  app.use("*", async (c, next) => {
    c.set("auth", auth);
    c.set("db", {} as never);
    c.env = { ...(c.env ?? {}), FILES: fakeFilesBucket(bytes) } as never;
    await next();
  });
  app.route("/api/v1", fileApiRoutes);
  return app;
}

const ORGANIZER: AuthInfo = { userId: "u1", role: "organizer", orgId: "org-1" };
const OTHER_ORG_ORGANIZER: AuthInfo = { userId: "u2", role: "organizer", orgId: "org-2" };

describe("GET /api/v1/events/:eventId/files (DEC-159/344)", () => {
  it("returns the server-paginated envelope with a real total independent of items.length", async () => {
    const app = await buildArchiveApp(ORGANIZER, new Uint8Array());
    const res = await app.request("/api/v1/events/event-1/files", { method: "GET" });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { items: unknown[]; total: number; page: number; perPage: number };
    expect(body.items).toHaveLength(1);
    expect(body.total).toBe(137);
    expect(body.total).toBeGreaterThan(body.items.length);
    expect(body.page).toBe(1);
    expect(body.perPage).toBe(50);
  });
});

describe("POST /api/v1/events/:eventId/files/archive (DEC-160)", () => {
  it("returns a ZIP with Content-Disposition naming the event slug", async () => {
    const app = await buildArchiveApp(ORGANIZER, new TextEncoder().encode("%PDF-1.4 fake bytes"));
    const res = await app.request("/api/v1/events/event-1/files/archive", {
      method: "POST",
      headers: { "content-type": "application/json", "x-chq-csrf": "1" },
      body: JSON.stringify({ fileIds: ["file-v1"] }),
    });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/zip");
    expect(res.headers.get("content-disposition")).toBe('attachment; filename="demo-event-files.zip"');
    const bytes = new Uint8Array(await res.arrayBuffer());
    expect([bytes[0], bytes[1], bytes[2], bytes[3]]).toEqual([0x50, 0x4b, 0x03, 0x04]);
  });

  it("403s an organizer from a different org", async () => {
    const app = await buildArchiveApp(OTHER_ORG_ORGANIZER, new Uint8Array());
    const res = await app.request("/api/v1/events/event-1/files/archive", {
      method: "POST",
      headers: { "content-type": "application/json", "x-chq-csrf": "1" },
      body: JSON.stringify({ fileIds: ["file-v1"] }),
    });
    expect(res.status).toBe(403);
  });

  it("400s over the 50-id cap", async () => {
    const app = await buildArchiveApp(ORGANIZER, new Uint8Array());
    const fileIds = Array.from({ length: 51 }, (_, i) => `file-${i}`);
    const res = await app.request("/api/v1/events/event-1/files/archive", {
      method: "POST",
      headers: { "content-type": "application/json", "x-chq-csrf": "1" },
      body: JSON.stringify({ fileIds }),
    });
    expect(res.status).toBe(400);
  });

  it("400s an empty fileIds array", async () => {
    const app = await buildArchiveApp(ORGANIZER, new Uint8Array());
    const res = await app.request("/api/v1/events/event-1/files/archive", {
      method: "POST",
      headers: { "content-type": "application/json", "x-chq-csrf": "1" },
      body: JSON.stringify({ fileIds: [] }),
    });
    expect(res.status).toBe(400);
  });

  it("404s (via resolveLatestVersions throwing) an unknown file id — no silent skip", async () => {
    const app = await buildArchiveApp(ORGANIZER, new Uint8Array());
    const res = await app.request("/api/v1/events/event-1/files/archive", {
      method: "POST",
      headers: { "content-type": "application/json", "x-chq-csrf": "1" },
      body: JSON.stringify({ fileIds: ["unknown-file"] }),
    });
    expect(res.status).toBe(404);
  });
});
