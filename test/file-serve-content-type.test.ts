// DEC-995: a served file's Content-Type comes from the validated DB column
// (written by validateUpload's extension allowlist), never from mutable R2
// object metadata. This test proves the inversion is fixed for GET
// /files/:fileId — a store stub whose object metadata claims text/html for
// a file whose DB row says image/png must still serve image/png (and a
// non-image DB row must still get Content-Disposition: attachment even if
// the stub's metadata disagrees). It also enumerates src/routes/**/*.ts(x)
// and asserts none of them contain the substring "obj.contentType" — the
// FileStore.get() return shape no longer carries a content type at all, so
// that shape should be structurally unreachable, not merely unused.

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { registerErrorHandler } from "../src/server/http";
import type { AppEnv, AuthInfo } from "../src/server/env";

const ORG_A = "org-a";

const imageFileScope = {
  fileId: "file-img-1",
  submissionId: "sub-1",
  eventId: "event-1",
  orgId: ORG_A,
  uploadedByContactId: "contact-speaker",
  readParticipantContactIds: ["contact-speaker"],
  activeParticipantContactIds: ["contact-speaker"],
  filename: "headshot.png",
  contentType: "image/png",
  r2Key: "sub/sub-1/headshot.png",
};

const pdfFileScope = {
  ...imageFileScope,
  fileId: "file-pdf-1",
  filename: "slides.pdf",
  contentType: "application/pdf",
  r2Key: "sub/sub-1/slides.pdf",
};

vi.mock("../src/server/repo/files", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/files")>("../src/server/repo/files");
  return {
    ...actual,
    getFileScope: vi.fn(async (_db: unknown, fileId: string) => {
      if (fileId === imageFileScope.fileId) return imageFileScope;
      if (fileId === pdfFileScope.fileId) return pdfFileScope;
      return null;
    }),
    getResourceFileScope: vi.fn(async () => null),
    getTaskFileScope: vi.fn(async () => null),
  };
});

// Object store stub: metadata LIES and claims text/html regardless of the
// DB row's actual content type — proving the server never reads it back.
function lyingFilesBucket(bytes: Uint8Array) {
  return {
    async get() {
      return {
        body: new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(bytes);
            controller.close();
          },
        }),
        httpMetadata: { contentType: "text/html" },
        size: bytes.length,
      };
    },
    async put() {},
    async delete() {},
  } as unknown as R2Bucket;
}

const ORGANIZER: AuthInfo = { userId: "u1", role: "organizer", orgId: ORG_A };

describe("DEC-995: served Content-Type comes from the DB column, never R2 metadata", () => {
  it("GET /files/:fileId serves the DB row's content type even when R2 metadata disagrees (image row)", async () => {
    const { fileServeRoutes } = await import("../src/routes/files");
    const app = new Hono<AppEnv>();
    registerErrorHandler(app);
    app.use("*", async (c, next) => {
      c.set("auth", ORGANIZER);
      c.set("db", {} as never);
      c.env = { ...(c.env ?? {}), FILES: lyingFilesBucket(new TextEncoder().encode("\x89PNG")) } as never;
      await next();
    });
    app.route("/", fileServeRoutes);
    const res = await app.request(`/files/${imageFileScope.fileId}`);
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("image/png");
    // image content type -> inline, not attachment
    expect(res.headers.get("Content-Disposition")).toBeNull();
  });

  it("GET /files/:fileId attaches a non-image DB row even when R2 metadata disagrees", async () => {
    const { fileServeRoutes } = await import("../src/routes/files");
    const app = new Hono<AppEnv>();
    registerErrorHandler(app);
    app.use("*", async (c, next) => {
      c.set("auth", ORGANIZER);
      c.set("db", {} as never);
      c.env = { ...(c.env ?? {}), FILES: lyingFilesBucket(new TextEncoder().encode("%PDF-1.4")) } as never;
      await next();
    });
    app.route("/", fileServeRoutes);
    const res = await app.request(`/files/${pdfFileScope.fileId}`);
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("application/pdf");
    expect(res.headers.get("Content-Disposition")).toMatch(/^attachment;/);
  });
});

// -----------------------------------------------------------------------
// Static guard: the untrusted `obj.contentType` shape must be structurally
// unreachable — FileStore.get() no longer returns it, so no file under
// src/routes/ should ever reference it again.
// -----------------------------------------------------------------------

function enumerateRouteFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      out.push(...enumerateRouteFiles(full));
    } else if (entry.endsWith(".ts") || entry.endsWith(".tsx")) {
      out.push(full);
    }
  }
  return out;
}

describe("DEC-995 static guard: no src/routes file references obj.contentType", () => {
  it("enumerates src/routes/**/*.ts(x) and asserts none contain 'obj.contentType'", () => {
    const repoRoot = join(__dirname, "..");
    const files = enumerateRouteFiles(join(repoRoot, "src", "routes"));
    expect(files.length).toBeGreaterThan(0);

    const offenders: string[] = [];
    for (const file of files) {
      const contents = readFileSync(file, { encoding: "utf-8" });
      if (contents.includes("obj.contentType")) {
        offenders.push(file);
      }
    }
    expect(offenders).toEqual([]);
  });
});
