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
import { join, relative } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { registerErrorHandler } from "../src/server/http";
import type { AppEnv, AuthInfo } from "../src/server/env";
import { stripComments } from "./helpers/strip-source-comments";

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

// -----------------------------------------------------------------------
// DEC-551 wave-46 (task w46-c): the population above (makeFileStore(...)
// .get(...) responses) is only PART of DEC-551's own sentence -- "every
// route that streams stored user content sets X-Content-Type-Options:
// nosniff". Seven live responses (src/routes/api/exports.ts x3,
// src/routes/review/plans-progress.ts x1, src/routes/public/index.tsx x3)
// stream stored user content via a DECLARED Content-Type header (literal or
// non-literal) that isn't reachable through the store.get(...) shape above,
// and neither this file's part (b) nor
// test/served-content-type-single-source.scan.test.ts's scan (which only
// checks the twin for NON-literal Content-Type values) ever looked at them.
// This makes the guard STRUCTURAL over the wider, accidental-gap-free
// population: every response under src/routes/**/*.{ts,tsx} that declares a
// Content-Type (literal OR non-literal) whose value is not text/html must
// set X-Content-Type-Options, either in the same header object literal, or
// via a sibling c.header(...) call in the same run before the next
// return/c.body/c.json.
// -----------------------------------------------------------------------

/** Brace-matches a `{` at `openIdx` (the index OF the `{`), returning the
 * index just past its matching `}`. */
function matchBraceNosniff(src: string, openIdx: number): number {
  let depth = 1;
  let i = openIdx + 1;
  while (i < src.length && depth > 0) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}") depth--;
    i++;
  }
  return i;
}

/** Finds the nearest UNMATCHED `{` at or before `pos` -- the opening brace
 * of the object literal `pos` sits inside. */
function findEnclosingBraceOpenNosniff(src: string, pos: number): number {
  let depth = 0;
  for (let i = pos - 1; i >= 0; i--) {
    if (src[i] === "}") depth++;
    else if (src[i] === "{") {
      if (depth === 0) return i;
      depth--;
    }
  }
  return -1;
}

/** Reads a call's argument list starting at the index of its opening `(`,
 * returning the text between the parens and the index just past the
 * matching `)`. */
function readParenArgs(src: string, openParenIdx: number): { args: string; endIdx: number } {
  let depth = 0;
  let i = openParenIdx;
  let start = -1;
  for (; i < src.length; i++) {
    if (src[i] === "(") {
      depth++;
      if (depth === 1) start = i + 1;
    } else if (src[i] === ")") {
      depth--;
      if (depth === 0) return { args: src.slice(start, i), endIdx: i + 1 };
    }
  }
  return { args: src.slice(start === -1 ? openParenIdx : start), endIdx: src.length };
}

function lineOfNosniff(src: string, idx: number): number {
  return src.slice(0, idx).split("\n").length;
}

const CT_HTML_LITERAL_RE = /^"text\/html/i;
const OBJECT_CT_KEY_RE = /"Content-Type"\s*:/g;
const HEADER_CALL_CT_RE = /c\.header\(\s*"Content-Type"\s*,/g;

/**
 * Pure classifier (no fs access): given already-read src/routes source
 * files, returns "path:line reason" strings for every declared,
 * non-text/html Content-Type response that lacks a same-scope
 * X-Content-Type-Options. Exported so the fixture controls below exercise
 * the exact function the real-tree scan uses (DEC-967: never validate a
 * detector by reading the same array it grades as its own evidence).
 */
export function findMissingNosniffProblems(files: { path: string; text: string }[]): {
  offenders: string[];
  populationSize: number;
  filesWithPopulation: Set<string>;
} {
  const offenders: string[] = [];
  const filesWithPopulation = new Set<string>();
  let populationSize = 0;

  for (const file of files) {
    const src = stripComments(file.text);

    // --- Style A: "Content-Type": <value> inside an object literal. ---
    OBJECT_CT_KEY_RE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = OBJECT_CT_KEY_RE.exec(src))) {
      let valueStart = m.index + m[0].length;
      while (valueStart < src.length && /\s/.test(src[valueStart] ?? "")) valueStart++;
      let depth = 0;
      let i = valueStart;
      let value = "";
      while (i < src.length) {
        const c = src[i];
        if (c === "(" || c === "[" || c === "{") depth++;
        if (c === ")" || c === "]" || c === "}") {
          if (depth === 0) break;
          depth--;
        }
        if (c === "," && depth === 0) break;
        value += c;
        i++;
      }
      value = value.trim();
      if (CT_HTML_LITERAL_RE.test(value)) continue; // text/html is out of scope for this ratchet.

      populationSize++;
      filesWithPopulation.add(file.path);
      const line = lineOfNosniff(src, m.index);

      const braceOpen = findEnclosingBraceOpenNosniff(src, m.index);
      if (braceOpen === -1) {
        offenders.push(`${file.path}:${line} declared "Content-Type": ${value} is not inside a recognizable object literal -- cannot verify X-Content-Type-Options (DEC-551).`);
        continue;
      }
      const braceClose = matchBraceNosniff(src, braceOpen);
      const objectBody = src.slice(braceOpen + 1, braceClose - 1);
      if (!objectBody.includes("X-Content-Type-Options")) {
        offenders.push(`${file.path}:${line} declared "Content-Type": ${value} has no X-Content-Type-Options in the same header object (DEC-551).`);
      }
    }

    // --- Style B: c.header("Content-Type", <value>) call. ---
    HEADER_CALL_CT_RE.lastIndex = 0;
    let hm: RegExpExecArray | null;
    while ((hm = HEADER_CALL_CT_RE.exec(src))) {
      const callOpenParen = src.indexOf("(", hm.index);
      const { args, endIdx } = readParenArgs(src, callOpenParen);
      const commaIdx = args.indexOf(",");
      const value = (commaIdx === -1 ? "" : args.slice(commaIdx + 1)).trim();
      if (CT_HTML_LITERAL_RE.test(value)) continue;

      populationSize++;
      filesWithPopulation.add(file.path);
      const line = lineOfNosniff(src, hm.index);

      // Same "run": scan forward from the end of this c.header(...) call,
      // stopping at the first `return` keyword -- a sibling
      // c.header("X-Content-Type-Options", ...) call anywhere before that
      // return satisfies DEC-551; anything after the return belongs to a
      // different response and does not count.
      const returnIdx = src.indexOf("return", endIdx);
      const window = returnIdx === -1 ? src.slice(endIdx) : src.slice(endIdx, returnIdx);
      if (!window.includes('c.header("X-Content-Type-Options"') && !window.includes("c.header('X-Content-Type-Options'")) {
        offenders.push(`${file.path}:${line} c.header("Content-Type", ${value}) has no sibling c.header("X-Content-Type-Options", ...) before the next return (DEC-551).`);
      }
    }
  }

  return { offenders, populationSize, filesWithPopulation };
}

function walkRouteSourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      out.push(...walkRouteSourceFiles(full));
    } else if (entry.endsWith(".ts") || entry.endsWith(".tsx")) {
      out.push(full);
    }
  }
  return out;
}

function readRealRouteFiles(): { path: string; text: string }[] {
  const repoRoot = join(__dirname, "..");
  const abs = walkRouteSourceFiles(join(repoRoot, "src", "routes"));
  return abs.map((full) => ({
    path: relative(repoRoot, full).split("\\").join("/"),
    text: readFileSync(full, { encoding: "utf-8" }),
  }));
}

// Ceiling constant (DEC-808 shape: may only be LOWERED). Two-sided
// companion below (test/campaign-ratchet-two-sided.scan.test.ts's peers'
// shape) forces it back down the moment the measured count falls below it.
export const DECLARED_CONTENT_TYPE_NOSNIFF_GAP_CEILING = 0;

describe("DEC-551 wave-46 structural guard: every declared, non-text/html Content-Type response sets X-Content-Type-Options", () => {
  it("vacuous-population tripwire: the real-tree population is non-empty and spans >= 4 route files", () => {
    const files = readRealRouteFiles();
    expect(files.length).toBeGreaterThan(0);
    const { populationSize, filesWithPopulation } = findMissingNosniffProblems(files);
    expect(populationSize).toBeGreaterThan(0);
    expect(filesWithPopulation.size).toBeGreaterThanOrEqual(4);
  });

  it(
    `real tree: no declared, non-text/html Content-Type response under src/routes/**/*.{ts,tsx} is missing X-Content-Type-Options ` +
      `(ceiling: DECLARED_CONTENT_TYPE_NOSNIFF_GAP_CEILING, may only be LOWERED)`,
    () => {
      const files = readRealRouteFiles();
      const { offenders } = findMissingNosniffProblems(files);
      if (offenders.length > DECLARED_CONTENT_TYPE_NOSNIFF_GAP_CEILING) {
        throw new Error(
          `${offenders.length} response(s) declare a Content-Type without X-Content-Type-Options, above the ratchet ` +
            `ceiling of ${DECLARED_CONTENT_TYPE_NOSNIFF_GAP_CEILING} (DEC-551, may only be LOWERED):\n${offenders.join("\n")}`,
        );
      }
      expect(offenders.length).toBeLessThanOrEqual(DECLARED_CONTENT_TYPE_NOSNIFF_GAP_CEILING);
    },
  );

  // Two-sided ratchet companion (DEC-808 wave-85 amendment, enforced by
  // test/campaign-ratchet-two-sided.scan.test.ts): forces the ceiling back
  // down if the measured count ever falls stale below it.
  it("the ceiling is not stale: the measured gap count does not fall below DECLARED_CONTENT_TYPE_NOSNIFF_GAP_CEILING (two-sided ratchet, DEC-808)", () => {
    const files = readRealRouteFiles();
    const { offenders } = findMissingNosniffProblems(files);
    if (offenders.length < DECLARED_CONTENT_TYPE_NOSNIFF_GAP_CEILING) {
      throw new Error(
        `${offenders.length} gap(s) measured, below DECLARED_CONTENT_TYPE_NOSNIFF_GAP_CEILING=` +
          `${DECLARED_CONTENT_TYPE_NOSNIFF_GAP_CEILING}. Lower the constant to exactly ${offenders.length} as part of ` +
          `the SAME batch that landed the fix: export const DECLARED_CONTENT_TYPE_NOSNIFF_GAP_CEILING = ${offenders.length};`,
      );
    }
    expect(offenders.length).toBe(DECLARED_CONTENT_TYPE_NOSNIFF_GAP_CEILING);
  });

  // --- Fixture controls (DEC-967: never validate a detector by reading the
  // same array it grades as its own evidence). ---

  it("positive control: a fixture route declaring text/csv with no nosniff FIRES", () => {
    const { offenders } = findMissingNosniffProblems([
      {
        path: "synthetic/fixture-missing.ts",
        text: `fixtureRoutes.get("/fixture.csv", async (c) => {\n  return c.body(csv, 200, { "Content-Type": "text/csv; charset=utf-8" });\n});\n`,
      },
    ]);
    expect(offenders.length).toBeGreaterThan(0);
    expect(offenders[0]).toContain("synthetic/fixture-missing.ts:2");
  });

  it("positive control: a fixture route using c.header(\"Content-Type\", ...) with no sibling nosniff call FIRES", () => {
    const { offenders } = findMissingNosniffProblems([
      {
        path: "synthetic/fixture-header-missing.ts",
        text: `fixtureRoutes.get("/fixture.csv", async (c) => {\n  c.header("Content-Type", "text/csv; charset=utf-8");\n  return c.body(csv);\n});\n`,
      },
    ]);
    expect(offenders.length).toBeGreaterThan(0);
    expect(offenders[0]).toContain("synthetic/fixture-header-missing.ts:2");
  });

  it("negative control: the same fixture route WITH nosniff does NOT fire", () => {
    const { offenders } = findMissingNosniffProblems([
      {
        path: "synthetic/fixture-present.ts",
        text: `fixtureRoutes.get("/fixture.csv", async (c) => {\n  return c.body(csv, 200, { "Content-Type": "text/csv; charset=utf-8", "X-Content-Type-Options": "nosniff" });\n});\n`,
      },
    ]);
    expect(offenders).toEqual([]);
  });

  it("negative control: the c.header(...) fixture route WITH a sibling nosniff call does NOT fire", () => {
    const { offenders } = findMissingNosniffProblems([
      {
        path: "synthetic/fixture-header-present.ts",
        text: `fixtureRoutes.get("/fixture.csv", async (c) => {\n  c.header("Content-Type", "text/csv; charset=utf-8");\n  c.header("X-Content-Type-Options", "nosniff");\n  return c.body(csv);\n});\n`,
      },
    ]);
    expect(offenders).toEqual([]);
  });

  it("negative control: text/html Content-Type is out of scope even with no nosniff", () => {
    const { offenders } = findMissingNosniffProblems([
      {
        path: "synthetic/fixture-html.ts",
        text: `fixtureRoutes.get("/fixture.html", async (c) => {\n  return c.body(html, 200, { "Content-Type": "text/html; charset=utf-8" });\n});\n`,
      },
    ]);
    expect(offenders).toEqual([]);
  });
});
