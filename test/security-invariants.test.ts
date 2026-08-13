// DEC-628: SPEC §6 requires CSRF on every mutating route and rate limits on
// auth + public submission. Both hold today via 88-odd hand-written
// registrations and a few spot checks; a route added without csrfJson/
// csrfForm/csrfFormOrHeader would be a silent CSRF hole nothing catches.
// This is the DEC-518-style source-scan pattern already used in this repo
// (see test/docs-route-coverage.test.ts, test/manifest-parity-exports.test.ts):
// rather than hand-listing every route, it derives the route registrations
// straight from the src/routes/** source text and fails loudly, naming
// file:line, the moment a mutating route drifts out of coverage. No source
// files change here — the invariants already hold; this test just stops
// them rotting silently.

import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROUTES_DIR = resolve(fileURLToPath(import.meta.url), "../../src/routes");
const AUTH_PATH = resolve(fileURLToPath(import.meta.url), "../../src/routes/auth.tsx");
const SUBMIT_PATH = resolve(fileURLToPath(import.meta.url), "../../src/routes/public/submit.tsx");

const CSRF_MIDDLEWARE = ["csrfJson", "csrfForm", "csrfFormOrHeader"];

/** Deliberate exceptions to the "every mutating route carries CSRF
 * middleware" rule. Each entry must be `{ file, line, reason }` with a
 * stated reason — never silent (DEC-628). `file` is relative to src/routes,
 * `line` is the 1-based line the route registration's call starts on. An
 * edit that shifts that line makes this test fail loudly rather than
 * silently widening the exemption. */
export const CSRF_EXEMPT: Array<{ file: string; line: number; reason: string }> = [
  {
    file: "public/submit.tsx",
    line: 265,
    reason:
      "DEC-626: the public CFP post checks CSRF in-body via the shared " +
      "checkDoubleSubmitCsrf predicate (DEC-544) instead of the csrfForm " +
      "middleware, so a missing/mismatched cookie re-renders the form with " +
      "the submitter's answers and a fresh token rather than throwing away " +
      "what they typed. Protection is present, only its location differs — " +
      "asserted below.",
  },
];

/** Recursively lists every .ts/.tsx file under `dir`. */
function listSourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      out.push(...listSourceFiles(full));
    } else if (/\.(ts|tsx)$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

interface RouteRegistration {
  file: string;
  line: number;
  receiver: string;
  method: string;
  /** Source slice from the registration call to the handler arrow
   * function's opening `{`, i.e. everything that could hold middleware. */
  headerSlice: string;
}

/** Scans `source` for `<identifier>Routes.<method>(` registrations where
 * the receiver is a Hono sub-app identifier (ends in "Routes", per this
 * repo's convention — e.g. authRoutes, contactsRoutes, portalTasksRoutes).
 * This deliberately excludes non-route calls like store.put/store.delete or
 * db.delete/db.update, whose receivers never end in "Routes". Each
 * registration's handler is a same-signature `async (c) => {` arrow
 * (verified below to appear for every match); the slice from the call site
 * to that arrow's opening brace is scanned for CSRF middleware. */
function scanRouteRegistrations(filePath: string, source: string): RouteRegistration[] {
  const registrations: RouteRegistration[] = [];
  const callRegex = /([A-Za-z_][A-Za-z0-9_]*Routes)\.(post|patch|put|delete)\(/g;
  let m: RegExpExecArray | null;
  while ((m = callRegex.exec(source))) {
    const receiver = m[1];
    const method = m[2];
    if (!receiver || !method) continue;
    const startIdx = m.index;
    const handlerRegex = /async\s*\(c\)\s*=>\s*\{/g;
    handlerRegex.lastIndex = startIdx;
    const handlerMatch = handlerRegex.exec(source);
    if (!handlerMatch) {
      const line = source.slice(0, startIdx).split("\n").length;
      throw new Error(
        `${filePath}:${line}: found route registration '${receiver}.${method}(' but no ` +
          `'async (c) => {' handler follows it — this scanner's assumption about this ` +
          `repo's handler signature has drifted; update the scanner rather than silently skipping.`,
      );
    }
    const headerSlice = source.slice(startIdx, handlerMatch.index + handlerMatch[0].length);
    const line = source.slice(0, startIdx).split("\n").length;
    registrations.push({ file: filePath, line, receiver, method, headerSlice });
  }
  return registrations;
}

describe("SPEC §6: every mutating route registration carries CSRF middleware (DEC-628)", () => {
  const files = listSourceFiles(ROUTES_DIR);
  expect(files.length).toBeGreaterThan(0);

  const allRegistrations: RouteRegistration[] = [];
  for (const file of files) {
    const source = readFileSync(file, "utf-8");
    allRegistrations.push(...scanRouteRegistrations(file, source));
  }

  it("found at least 80 mutating route registrations (a broken regex must fail loudly, not pass vacuously)", () => {
    expect(allRegistrations.length).toBeGreaterThanOrEqual(80);
  });

  it("every registration carries csrfJson, csrfForm, or csrfFormOrHeader, unless explicitly exempted", () => {
    const failures: string[] = [];
    for (const reg of allRegistrations) {
      const relFile = relative(ROUTES_DIR, reg.file);
      const hasCsrf = CSRF_MIDDLEWARE.some((name) => new RegExp(`\\b${name}\\b`).test(reg.headerSlice));
      if (hasCsrf) continue;
      const exempt = CSRF_EXEMPT.find((e) => e.file === relFile && e.line === reg.line);
      if (exempt) {
        expect(exempt.reason.length).toBeGreaterThan(0);
        continue;
      }
      failures.push(`${relFile}:${reg.line}: ${reg.receiver}.${reg.method}(...) has no CSRF middleware`);
    }
    expect(failures).toEqual([]);
  });

  it("every CSRF_EXEMPT entry names a real registration and states a reason", () => {
    for (const exempt of CSRF_EXEMPT) {
      expect(exempt.reason.length).toBeGreaterThan(0);
      const match = allRegistrations.find(
        (reg) => relative(ROUTES_DIR, reg.file) === exempt.file && reg.line === exempt.line,
      );
      expect(match, `CSRF_EXEMPT names ${exempt.file}:${exempt.line}, which is not a route registration`).toBeDefined();
    }
  });

  // DEC-628 allows exceptions only with a stated reason — but an exemption
  // must never become a hole. The one exempt route (DEC-626) still performs
  // the double-submit comparison, just inside its handler; assert that here
  // so deleting the in-body check fails this test rather than passing on the
  // strength of the allowlist entry alone.
  it("the exempt public CFP post still performs an in-body double-submit CSRF check", () => {
    expect(CSRF_EXEMPT.map((e) => e.file)).toEqual(["public/submit.tsx"]);
    const submitSource = readFileSync(SUBMIT_PATH, "utf-8");
    const slice = submitSource.slice(submitSource.indexOf('.post("/submit/:eventSlug"'));
    expect(slice).toMatch(/\bcheckDoubleSubmitCsrf\b/);
    expect(slice).toMatch(/\bCSRF_COOKIE_NAME\b/);
  });
});

describe("SPEC §6: unauthenticated write paths are rate limited (DEC-628)", () => {
  const authSource = readFileSync(AUTH_PATH, "utf-8");
  const submitSource = readFileSync(SUBMIT_PATH, "utf-8");

  /** Extracts the source slice for a `<receiver>.post("<path>", ...)`
   * registration up to its next sibling registration (or EOF), so the slice
   * covers the whole handler body without needing to balance braces. */
  function sliceForRoute(source: string, pathLiteral: string): string {
    const marker = `.post("${pathLiteral}"`;
    const startIdx = source.indexOf(marker);
    if (startIdx === -1) {
      throw new Error(`Could not find route registration for POST "${pathLiteral}" in source`);
    }
    const nextCallRegex = /[A-Za-z_][A-Za-z0-9_]*Routes\.(post|patch|put|delete)\(/g;
    nextCallRegex.lastIndex = startIdx + marker.length;
    const nextMatch = nextCallRegex.exec(source);
    return source.slice(startIdx, nextMatch ? nextMatch.index : source.length);
  }

  it("POST /login (auth.tsx) uses peekScopedLimit and incrementScopedLimit", () => {
    const slice = sliceForRoute(authSource, "/login");
    expect(slice).toMatch(/\bpeekScopedLimit\b/);
    expect(slice).toMatch(/\bincrementScopedLimit\b/);
  });

  it("POST /claim/:token (auth.tsx) uses checkAndIncrementScopedLimit", () => {
    const slice = sliceForRoute(authSource, "/claim/:token");
    expect(slice).toMatch(/\bcheckAndIncrementScopedLimit\b/);
  });

  it("POST /submit/:eventSlug (public/submit.tsx) uses checkAndIncrementScopedLimit", () => {
    const slice = sliceForRoute(submitSource, "/submit/:eventSlug");
    expect(slice).toMatch(/\bcheckAndIncrementScopedLimit\b/);
  });

  it("POST /submit/:eventSlug/save-draft (public/submit.tsx) uses checkAndIncrementScopedLimit", () => {
    const slice = sliceForRoute(submitSource, "/submit/:eventSlug/save-draft");
    expect(slice).toMatch(/\bcheckAndIncrementScopedLimit\b/);
  });
});
