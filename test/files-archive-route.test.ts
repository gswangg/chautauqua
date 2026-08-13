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
      const map = new Map<
        string,
        { id: string; filename: string; contentType: string; r2Key: string; submissionTitle: string; sizeBytes: number }
      >();
      for (const id of fileIds) {
        if (id === "unknown-file") {
          throw new ApiError("not_found", `File ${id} is not a deliverable of this event`);
        }
        // Multi-file tests (file-a/file-b/file-c...) get one distinct row per
        // id so entry naming/order can be checked against a per-id store;
        // everything else (the single-file DEC-160 base tests) keeps the
        // original shared file-v2/slides.pdf row.
        if (/^file-[a-z]$/.test(id)) {
          map.set(id, {
            id,
            filename: `${id}.pdf`,
            contentType: "application/pdf",
            r2Key: `sub/${id}/${id}.pdf`,
            submissionTitle: `Talk ${id}`,
            sizeBytes: 10,
          });
        } else {
          map.set(id, {
            id: "file-v2",
            filename: "slides.pdf",
            contentType: "application/pdf",
            r2Key: "sub/sub-1/slides.pdf",
            submissionTitle: "Scaling Vector Search",
            sizeBytes: 1024,
          });
        }
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

/** Walks a STORE-only zip's local file headers (per test/zip.test.ts's own
 * layout math) and returns entry names in on-disk order — i.e. the order
 * `entries` was built in, independent of any async completion order. */
function readZipEntryNamesInOrder(zip: Uint8Array): string[] {
  const dec = new TextDecoder();
  const names: string[] = [];
  let offset = 0;
  while (zip[offset] === 0x50 && zip[offset + 1] === 0x4b && zip[offset + 2] === 0x03 && zip[offset + 3] === 0x04) {
    const nameLen = (zip[offset + 26] ?? 0) | ((zip[offset + 27] ?? 0) << 8);
    const extraLen = (zip[offset + 28] ?? 0) | ((zip[offset + 29] ?? 0) << 8);
    const dataLen =
      (zip[offset + 18] ?? 0) |
      ((zip[offset + 19] ?? 0) << 8) |
      ((zip[offset + 20] ?? 0) << 16) |
      ((zip[offset + 21] ?? 0) << 24);
    const nameStart = offset + 30;
    names.push(dec.decode(zip.slice(nameStart, nameStart + nameLen)));
    offset = nameStart + nameLen + extraLen + dataLen;
  }
  return names;
}

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

describe("POST /api/v1/events/:eventId/files/archive — parallel R2 wave (DEC-160 wave-49 amendment)", () => {
  // Reuses the top-level resolveLatestVersions mock (which gives file-a/
  // file-b/file-c each a distinct row) with a bucket that lets each test
  // control per-key resolution order / missing objects. Deliberately avoids
  // vi.resetModules()/vi.doMock() here: reloading src/routes/files.ts under
  // a fresh module registry mid-suite gives it a DIFFERENT ApiError class
  // than the one registerErrorHandler's `instanceof ApiError` check was
  // bound to at static-import time, so a thrown ApiError silently falls
  // through to the generic 500 branch instead of its mapped status.
  async function buildMultiFileApp(
    auth: AuthInfo,
    opts: {
      resolveOrder?: string[]; // order in which store.get() promises resolve, defaults to request order
      missing?: Set<string>; // r2Keys that resolve to null (object not found)
      getCallOrder?: string[]; // records r2Key at call time (issue order, before await)
    },
  ) {
    const { fileApiRoutes } = await import("../src/routes/files");

    const resolveOrder = opts.resolveOrder ?? [];
    const missing = opts.missing ?? new Set<string>();
    const getCallOrder = opts.getCallOrder ?? [];

    // Deferred resolution per r2Key, released in `resolveOrder` sequence so
    // the test controls completion order independently of call order.
    const deferreds = new Map<string, { resolve: () => void }>();
    const gate = new Map<string, Promise<void>>();
    for (const key of resolveOrder) {
      gate.set(
        key,
        new Promise<void>((resolve) => {
          deferreds.set(key, { resolve });
        }),
      );
    }

    const fakeBucket = {
      async get(key: string) {
        getCallOrder.push(key);
        if (resolveOrder.length > 0) {
          await gate.get(key);
        }
        if (missing.has(key)) return null;
        return {
          body: new ReadableStream<Uint8Array>({
            start(controller) {
              controller.enqueue(new TextEncoder().encode(`bytes-${key}`));
              controller.close();
            },
          }),
          httpMetadata: { contentType: "application/pdf" },
          size: 10,
        };
      },
      async put() {},
      async delete() {},
    } as unknown as R2Bucket;

    const app = new Hono<AppEnv>();
    registerErrorHandler(app);
    app.use("*", async (c, next) => {
      c.set("auth", auth);
      c.set("db", {} as never);
      c.env = { ...(c.env ?? {}), FILES: fakeBucket } as never;
      await next();
    });
    app.route("/api/v1", fileApiRoutes);

    // Release resolution gates in `resolveOrder` sequence after a tick, so
    // all `get()` calls have already been issued before the first settles.
    if (resolveOrder.length > 0) {
      queueMicrotask(() => {
        for (const key of resolveOrder) {
          deferreds.get(key)?.resolve();
        }
      });
    }

    return app;
  }

  it("keeps entry order/naming matching request order even when the store resolves out of order", async () => {
    const getCallOrder: string[] = [];
    const app = await buildMultiFileApp(ORGANIZER, {
      // store resolves file-c's key first, then file-a's, then file-b's —
      // completion order must not leak into the zip entry order.
      resolveOrder: ["sub/file-c/file-c.pdf", "sub/file-a/file-a.pdf", "sub/file-b/file-b.pdf"],
      getCallOrder,
    });
    const res = await app.request("/api/v1/events/event-1/files/archive", {
      method: "POST",
      headers: { "content-type": "application/json", "x-chq-csrf": "1" },
      body: JSON.stringify({ fileIds: ["file-a", "file-b", "file-c"] }),
    });
    expect(res.status).toBe(200);
    const bytes = new Uint8Array(await res.arrayBuffer());
    expect(readZipEntryNamesInOrder(bytes)).toEqual([
      "1-talk-file-a/file-a.pdf",
      "2-talk-file-b/file-b.pdf",
      "3-talk-file-c/file-c.pdf",
    ]);

    // All three GETs were issued before any resolved — no serialisation.
    expect(getCallOrder.sort()).toEqual(["sub/file-a/file-a.pdf", "sub/file-b/file-b.pdf", "sub/file-c/file-c.pdf"].sort());
  });

  it("names the FIRST missing file in request order when several objects are missing", async () => {
    const app = await buildMultiFileApp(ORGANIZER, {
      missing: new Set(["sub/file-a/file-a.pdf", "sub/file-c/file-c.pdf"]),
    });
    const res = await app.request("/api/v1/events/event-1/files/archive", {
      method: "POST",
      headers: { "content-type": "application/json", "x-chq-csrf": "1" },
      body: JSON.stringify({ fileIds: ["file-a", "file-b", "file-c"] }),
    });
    expect(res.status).toBe(404);
    const body = (await res.json()) as { error: { message: string } };
    expect(body.error.message).toContain("file-a.pdf");
    expect(body.error.message).not.toContain("file-c.pdf");
  });

  it("issues all GETs before the first resolves — no serialisation", async () => {
    const getCallOrder: string[] = [];
    const app = await buildMultiFileApp(ORGANIZER, {
      resolveOrder: ["sub/file-a/file-a.pdf", "sub/file-b/file-b.pdf", "sub/file-c/file-c.pdf"],
      getCallOrder,
    });
    const res = await app.request("/api/v1/events/event-1/files/archive", {
      method: "POST",
      headers: { "content-type": "application/json", "x-chq-csrf": "1" },
      body: JSON.stringify({ fileIds: ["file-a", "file-b", "file-c"] }),
    });
    expect(res.status).toBe(200);
    // If GETs were sequential, the second/third get() would not be called
    // until after the first's promise resolved (which happens on a
    // queued microtask after all three are issued) — so all three call
    // sites must be recorded before any gate is released.
    expect(getCallOrder).toEqual(["sub/file-a/file-a.pdf", "sub/file-b/file-b.pdf", "sub/file-c/file-c.pdf"]);
  });
});
