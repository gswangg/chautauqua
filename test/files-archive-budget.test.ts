// DEC-353 coverage for the bulk ZIP archive's total-byte memory budget:
// POST /api/v1/events/:eventId/files/archive sums resolveLatestVersions'
// resolved sizeBytes BEFORE issuing any R2 get, and rejects the whole
// request with a 400 {error:{code,message,fields}} envelope (no
// truncation, no partial archive, no silent skip) when the total exceeds
// ARCHIVE_MAX_TOTAL_BYTES. Repo functions are mocked here (route wiring
// under test), same pattern as test/files-archive-route.test.ts — kept in
// its own file for the same vi.mock hoisting reason noted there.

import { describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { registerErrorHandler } from "../src/server/http";
import type { AppEnv, AuthInfo } from "../src/server/env";
import { ARCHIVE_MAX_TOTAL_BYTES } from "../src/routes/files";

interface ResolvedEntry {
  id: string;
  filename: string;
  contentType: string;
  r2Key: string;
  submissionTitle: string;
  sizeBytes: number;
}

let resolvedSizes: Record<string, number> = {};

vi.mock("../src/server/repo/files", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/files")>("../src/server/repo/files");
  return {
    ...actual,
    getEventFilesScope: vi.fn(async (_db: unknown, eventId: string) =>
      eventId === "event-1" ? { orgId: "org-1", slug: "demo-event" } : null,
    ),
    resolveLatestVersions: vi.fn(async (_db: unknown, _eventId: string, fileIds: string[]) => {
      const map = new Map<string, ResolvedEntry>();
      for (const id of fileIds) {
        map.set(id, {
          id,
          filename: `${id}.pdf`,
          contentType: "application/pdf",
          r2Key: `sub/sub-1/${id}.pdf`,
          submissionTitle: "Scaling Vector Search",
          sizeBytes: resolvedSizes[id] ?? 1024,
        });
      }
      return map;
    }),
  };
});

function countingFakeFilesBucket(bytes: Uint8Array, getCount: { count: number }) {
  return {
    async get() {
      getCount.count += 1;
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

async function buildArchiveApp(auth: AuthInfo, bytes: Uint8Array, getCount: { count: number }) {
  const { fileApiRoutes } = await import("../src/routes/files");
  const app = new Hono<AppEnv>();
  registerErrorHandler(app);
  app.use("*", async (c, next) => {
    c.set("auth", auth);
    c.set("db", {} as never);
    c.env = { ...(c.env ?? {}), FILES: countingFakeFilesBucket(bytes, getCount) } as never;
    await next();
  });
  app.route("/api/v1", fileApiRoutes);
  return app;
}

const ORGANIZER: AuthInfo = { userId: "u1", role: "organizer", orgId: "org-1" };

describe("POST /api/v1/events/:eventId/files/archive total-byte budget (DEC-353)", () => {
  it("400s with no R2 gets issued when the resolved total exceeds ARCHIVE_MAX_TOTAL_BYTES", async () => {
    resolvedSizes = {
      "file-1": ARCHIVE_MAX_TOTAL_BYTES,
      "file-2": 10 * 1024 * 1024,
    };
    const getCount = { count: 0 };
    const app = await buildArchiveApp(ORGANIZER, new TextEncoder().encode("fake"), getCount);
    const res = await app.request("/api/v1/events/event-1/files/archive", {
      method: "POST",
      headers: { "content-type": "application/json", "x-chq-csrf": "1" },
      body: JSON.stringify({ fileIds: ["file-1", "file-2"] }),
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string; message: string; fields?: Record<string, string> } };
    expect(body.error.code).toBe("invalid");
    expect(body.error.message).toMatch(/50\.0MB/);
    expect(body.error.message).toMatch(/40MB/);
    expect(body.error.fields).toEqual({ fileIds: "Too large" });
    expect(getCount.count).toBe(0);
  });

  it("still returns a 200 application/zip archive for a small multi-file request under budget", async () => {
    resolvedSizes = {
      "file-1": 1024,
      "file-2": 2048,
      "file-3": 4096,
    };
    const getCount = { count: 0 };
    const app = await buildArchiveApp(ORGANIZER, new TextEncoder().encode("%PDF-1.4 fake bytes"), getCount);
    const res = await app.request("/api/v1/events/event-1/files/archive", {
      method: "POST",
      headers: { "content-type": "application/json", "x-chq-csrf": "1" },
      body: JSON.stringify({ fileIds: ["file-1", "file-2", "file-3"] }),
    });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/zip");
    expect(getCount.count).toBe(3);
  });
});
