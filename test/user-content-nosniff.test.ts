// DEC-551: every stored-user-content response must carry
// "X-Content-Type-Options: nosniff" so a browser never sniffs an uploaded
// file's bytes into a different content type than the server declared
// (a forced Content-Type is advisory until nosniff ships alongside it).
// Part (a) below exercises the three routes that serve bytes read from
// makeFileStore(...).get(...): GET /files/:fileId (submission deliverable),
// POST /api/v1/events/:eventId/files/archive (bulk ZIP), and GET
// /headshots/:fileId. Harness patterns follow test/reviewer-file-access.test.ts
// (fileServeRoutes), test/files-archive-route.test.ts (fileApiRoutes), and
// test/headshot-gate.test.ts (headshotServeRoutes).
//
// Part (b) is a static guard over the WHOLE repo (src/routes/**/*.ts and
// src/routes/**/*.tsx, enumerated, never hand-listed): for every handler
// whose response body comes from makeFileStore(...).get(...), assert the
// response literal that follows also sets "X-Content-Type-Options" — so no
// future handler anywhere under src/routes can stream a stored object
// without the header. Files are read with an explicit utf-8 decode (never
// assume a glob silently skips a binary/NUL file — DEC-546 field-guide
// lesson) and the enumerated file count is asserted non-zero so an empty
// match set can't pass the test vacuously.

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { registerErrorHandler } from "../src/server/http";
import type { AppEnv, AuthInfo } from "../src/server/env";

const ORG_A = "org-a";

const submissionFileScope = {
  fileId: "file-sub-1",
  submissionId: "sub-1",
  eventId: "event-1",
  orgId: ORG_A,
  uploadedByContactId: "contact-speaker",
  readParticipantContactIds: ["contact-speaker"],
  activeParticipantContactIds: ["contact-speaker"],
  filename: "slides.pdf",
  contentType: "application/pdf",
  r2Key: "sub/sub-1/slides.pdf",
};

vi.mock("../src/server/repo/files", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/files")>("../src/server/repo/files");
  return {
    ...actual,
    getFileScope: vi.fn(async (_db: unknown, fileId: string) =>
      fileId === submissionFileScope.fileId ? submissionFileScope : null,
    ),
    getResourceFileScope: vi.fn(async () => null),
    getTaskFileScope: vi.fn(async () => null),
    getEventFilesScope: vi.fn(async (_db: unknown, eventId: string) =>
      eventId === "event-1" ? { orgId: ORG_A, slug: "demo-event" } : null,
    ),
    resolveLatestVersions: vi.fn(async (_db: unknown, _eventId: string, fileIds: string[]) => {
      const map = new Map<
        string,
        { id: string; filename: string; contentType: string; r2Key: string; submissionTitle: string; sizeBytes: number }
      >();
      for (const id of fileIds) {
        map.set(id, {
          id: "file-v2",
          filename: "slides.pdf",
          contentType: "application/pdf",
          r2Key: "sub/sub-1/slides.pdf",
          submissionTitle: "Scaling Vector Search",
          sizeBytes: 1024,
        });
      }
      return map;
    }),
    listEventDeliverableFiles: vi.fn(async () => ({ items: [], total: 0, page: 1, perPage: 50 })),
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

const ORGANIZER: AuthInfo = { userId: "u1", role: "organizer", orgId: ORG_A };

describe("DEC-551: nosniff on stored-user-content responses", () => {
  it("GET /files/:fileId (submission deliverable serve) carries nosniff", async () => {
    const { fileServeRoutes } = await import("../src/routes/files");
    const app = new Hono<AppEnv>();
    registerErrorHandler(app);
    app.use("*", async (c, next) => {
      c.set("auth", ORGANIZER);
      c.set("db", {} as never);
      c.env = { ...(c.env ?? {}), FILES: fakeFilesBucket(new TextEncoder().encode("%PDF-1.4")) } as never;
      await next();
    });
    app.route("/", fileServeRoutes);
    const res = await app.request(`/files/${submissionFileScope.fileId}`);
    expect(res.status).toBe(200);
    expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
  });

  it("POST /api/v1/events/:eventId/files/archive (bulk ZIP) carries nosniff", async () => {
    const { fileApiRoutes } = await import("../src/routes/files");
    const app = new Hono<AppEnv>();
    registerErrorHandler(app);
    app.use("*", async (c, next) => {
      c.set("auth", ORGANIZER);
      c.set("db", {} as never);
      c.env = { ...(c.env ?? {}), FILES: fakeFilesBucket(new TextEncoder().encode("%PDF-1.4 fake bytes")) } as never;
      await next();
    });
    app.route("/api/v1", fileApiRoutes);
    const res = await app.request("/api/v1/events/event-1/files/archive", {
      method: "POST",
      headers: { "content-type": "application/json", "x-chq-csrf": "1" },
      body: JSON.stringify({ fileIds: ["file-v1"] }),
    });
    expect(res.status).toBe(200);
    expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
  });

  it("GET /headshots/:fileId carries nosniff", async () => {
    const { headshotServeRoutes } = await import("../src/routes/portal/profile");
    type FileRow = { kind: string; r2Key: string; contentType: string } | null;
    type ContactRow = { id: string; orgId: string } | null;
    function fakeDb(fileRow: FileRow, contactRow: ContactRow, visible: boolean) {
      let call = 0;
      function makeChain(rows: unknown[]) {
        const chain: any = {
          from: () => chain,
          innerJoin: () => chain,
          where: () => chain,
          orderBy: () => chain,
          limit: async () => rows,
        };
        return chain;
      }
      return {
        select: () => {
          call += 1;
          if (call === 1) return makeChain(fileRow ? [fileRow] : []);
          if (call === 2) return makeChain(contactRow ? [contactRow] : []);
          return makeChain(visible ? [{ id: "p1" }] : []);
        },
      } as unknown as AppEnv["Variables"]["db"];
    }
    const app = new Hono<AppEnv>();
    registerErrorHandler(app);
    app.use("*", async (c, next) => {
      c.set("db", fakeDb({ kind: "headshot", r2Key: "headshot/c1/abc.jpg", contentType: "image/jpeg" }, { id: "c1", orgId: "org1" }, true));
      await next();
    });
    app.route("/", headshotServeRoutes);
    const res = await app.request("/headshots/f1", undefined, {
      FILES: fakeFilesBucket(new TextEncoder().encode("\xff\xd8\xff")),
    } as unknown as AppEnv["Bindings"]);
    expect(res.status).toBe(200);
    expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
  });
});

// -----------------------------------------------------------------------
// Static guard: every response literal built from a makeFileStore(...).get(...)
// body must also set X-Content-Type-Options, so a fourth such route can't
// land silently missing the header.
// -----------------------------------------------------------------------

// Repo-wide enumeration (DEC-657): every .ts/.tsx file under src/routes,
// walked recursively — never a hand-listed set that can desync as new route
// files land.
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

describe("DEC-551/DEC-657 static guard: every makeFileStore(...).get(...) body response carries nosniff", () => {
  it("enumerates src/routes/**/*.ts(x) and asserts every such handler sets X-Content-Type-Options", () => {
    const repoRoot = join(__dirname, "..");
    const files = enumerateRouteFiles(join(repoRoot, "src", "routes"));
    expect(files.length).toBeGreaterThan(0);

    const offenders: string[] = [];
    let sawStoreGetBodyResponse = false;

    for (const file of files) {
      // Explicit utf-8 decode: a raw NUL or other binary byte sequence in a
      // source file must not silently drop it from the scan (a Buffer read
      // without an explicit encoding, or a naive text-mode tool, can treat
      // NUL-containing content as "binary" and skip it invisibly).
      const contents = readFileSync(file, { encoding: "utf-8" });
      if (!contents.includes(".get(")) continue;

      // Find every response literal (c.body(...) or return c.body(...)) that
      // follows a makeFileStore(...).get(...) call within the same handler
      // block, by scanning windows between successive store.get(...) calls
      // and checking the next few hundred characters for the header.
      const storeGetIdx: number[] = [];
      const storeGetRe = /store\.get\(/g;
      let m: RegExpExecArray | null;
      while ((m = storeGetRe.exec(contents)) !== null) {
        storeGetIdx.push(m.index);
      }
      if (storeGetIdx.length === 0) continue;

      for (const idx of storeGetIdx) {
        // Look ahead from the store.get( call to the next c.body(...) call
        // within a bounded window (the response is always constructed
        // shortly after fetching the object in this codebase's handlers).
        const window = contents.slice(idx, idx + 2000);
        const bodyCallIdx = window.indexOf("c.body(");
        if (bodyCallIdx === -1) continue; // not a body-returning use of store.get
        sawStoreGetBodyResponse = true;
        // Find the matching closing paren for this c.body( call by bracket
        // counting, so we scope the header check to exactly this response
        // literal (not a later, unrelated one).
        let depth = 0;
        let i = idx + bodyCallIdx + "c.body(".length - 1;
        let end = -1;
        for (; i < window.length; i++) {
          if (window[i] === "(") depth++;
          else if (window[i] === ")") {
            depth--;
            if (depth === 0) {
              end = i;
              break;
            }
          }
        }
        // Cover both an inline header object literal in the c.body(...) call
        // itself, and the (also-common in this codebase) pattern of a
        // `const headers = {...}` object built between the store.get(...)
        // call and a `c.body(obj.body, 200, headers)` that references it by
        // name — so the whole span from the store.get(...) call through the
        // end of the c.body(...) call is checked, not just the call's own
        // argument list.
        const span = end === -1 ? window : window.slice(0, end + 1);
        if (!span.includes("X-Content-Type-Options")) {
          offenders.push(`${file}: c.body(...) call near offset ${idx} using store.get(...) lacks X-Content-Type-Options`);
        }
      }
    }

    expect(sawStoreGetBodyResponse).toBe(true);
    expect(offenders).toEqual([]);
  });
});
