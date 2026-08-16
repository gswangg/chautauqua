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
import { enumerateRegisteredRoutes } from "./helpers/registered-routes";

const ROUTES_DIR = resolve(fileURLToPath(import.meta.url), "../../src/routes");
// Split out of src/routes/public/submit.tsx purely to reduce merge
// contention on that file (no behavior change) -- the final-submit and
// save-draft handlers now live in their own per-route modules.
const SUBMIT_POST_PATH = resolve(fileURLToPath(import.meta.url), "../../src/routes/public/submit-post.tsx");

const CSRF_MIDDLEWARE = ["csrfJson", "csrfForm", "csrfFormOrHeader"];

/** Deliberate exceptions to the "every mutating route carries CSRF
 * middleware" rule. Each entry must be `{ file, method, path, reason }` with
 * a stated reason — never silent (DEC-628). `file` is relative to
 * src/routes; `method` + `path` key the registration by identity (its own
 * route path literal) rather than by source line, so an unrelated edit that
 * shifts line numbers elsewhere in the file cannot make this exemption
 * silently stop matching (wave 46 amendment). The type deliberately has no
 * `line` field so the old line-keyed shape cannot creep back. */
export const CSRF_EXEMPT: Array<{ file: string; method: string; path: string; reason: string }> = [
  {
    file: "public/submit-post.tsx",
    method: "post",
    path: "/submit/:eventSlug",
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
  /** The route's own path literal, e.g. "/submit/:eventSlug" — the first
   * quoted string literal inside headerSlice (identity key for exemptions,
   * wave 46 amendment; a line number moves, a path literal doesn't). */
  path: string;
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
    const pathMatch = /^[A-Za-z_][A-Za-z0-9_]*Routes\.(?:post|patch|put|delete)\(\s*"([^"]*)"/.exec(headerSlice);
    if (!pathMatch) {
      throw new Error(
        `${filePath}:${line}: found route registration '${receiver}.${method}(' but no parseable ` +
          `quoted path literal follows it — this scanner's assumption about this repo's route ` +
          `registration shape has drifted; update the scanner rather than silently skipping.`,
      );
    }
    const path = pathMatch[1] as string;
    registrations.push({ file: filePath, line, receiver, method, path, headerSlice });
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
      const exempt = CSRF_EXEMPT.find(
        (e) => e.file === relFile && e.method === reg.method && e.path === reg.path,
      );
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
        (reg) =>
          relative(ROUTES_DIR, reg.file) === exempt.file &&
          reg.method === exempt.method &&
          reg.path === exempt.path,
      );
      expect(
        match,
        `CSRF_EXEMPT names ${exempt.file} ${exempt.method.toUpperCase()} ${exempt.path}, which is not a route registration`,
      ).toBeDefined();
    }
  });

  it("no CSRF_EXEMPT entry carries a `line` property (identity-keyed only, wave 46 amendment)", () => {
    for (const exempt of CSRF_EXEMPT) {
      expect(Object.prototype.hasOwnProperty.call(exempt, "line")).toBe(false);
    }
  });

  // DEC-628 allows exceptions only with a stated reason — but an exemption
  // must never become a hole. The one exempt route (DEC-626) still performs
  // the double-submit comparison, just inside its handler; assert that here
  // so deleting the in-body check fails this test rather than passing on the
  // strength of the allowlist entry alone.
  it("the exempt public CFP post still performs an in-body double-submit CSRF check", () => {
    expect(CSRF_EXEMPT.map((e) => e.file)).toEqual(["public/submit-post.tsx"]);
    const submitSource = readFileSync(SUBMIT_POST_PATH, "utf-8");
    const slice = submitSource.slice(submitSource.indexOf('.post("/submit/:eventSlug"'));
    expect(slice).toMatch(/\bcheckDoubleSubmitCsrf\b/);
    expect(slice).toMatch(/\bCSRF_COOKIE_NAME\b/);
  });
});

// -----------------------------------------------------------------------
// SPEC §6: every anonymous-reachable mutating door is rate limited
// (DEC-628, DEC-180 wave-52 amendment).
//
// The describe block this replaces asserted the invariant against four
// hand-typed route literals (POST /login, POST /claim/:token, POST
// /submit/:eventSlug, POST /submit/:eventSlug/save-draft) — exactly the
// DEC-550 prose-manifest failure mode (a list that can drift silently the
// moment a new anonymous mutating door is added; src/routes/auth-reset.tsx's
// POST /forgot and POST /reset/:token were already budgeted but invisible to
// that list). This block instead DERIVES the population: every POST/PATCH/
// PUT/DELETE registration under src/routes/**, reusing
// test/helpers/registered-routes.ts's enumerateRegisteredRoutes() for the
// resolved full mounted path (per that helper's own header comment: "any
// test that needs every route registration, from source, with its resolved
// full mounted path" should reuse it rather than re-parsing src/routes/** +
// src/index.ts a second time), joined against this file's own
// scanRouteRegistrations() (already defined above, module-scope) for the
// per-registration middleware slice a rate-limit/guard check needs.
// -----------------------------------------------------------------------
describe("SPEC §6: anonymous-reachable mutating doors are rate limited (DEC-628, DEC-180 wave-52)", () => {
  // Guard identifiers that prove a registration is NOT anonymous-reachable:
  // real role guards harvested from src/server/middleware.ts's own exports
  // (never hand-typed — a rename here must not silently narrow the
  // vocabulary), plus the two guards that live outside middleware.ts and are
  // documented by test/anonymous-route-probe.test.ts as the vocabulary an
  // anonymous-authz probe in this repo already recognises: requireAuth
  // (src/routes/portal/tasks/shared.ts, called as the first statement in a
  // handler body), requireReviewerOrOrganizer (src/routes/review/shared.ts,
  // same pattern), and speakerGate (src/routes/portal/shared.tsx, applied
  // mount-level via `<subApp>.use(prefix, speakerGate)` to every portal
  // sub-app).
  const middlewareSource = readFileSync(join(ROUTES_DIR, "..", "server", "middleware.ts"), "utf-8");
  const MIDDLEWARE_GUARD_NAMES: string[] = [];
  {
    const re = /export const (require\w+)\b/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(middlewareSource))) {
      const name = m[1];
      if (name) MIDDLEWARE_GUARD_NAMES.push(name);
    }
  }
  if (!MIDDLEWARE_GUARD_NAMES.includes("requireOrganizer") || !MIDDLEWARE_GUARD_NAMES.includes("requireCookieSession")) {
    throw new Error(
      "src/server/middleware.ts no longer exports requireOrganizer/requireCookieSession the way this scan expects — " +
        "the guard-harvesting regex has drifted; update it rather than silently narrowing the guard vocabulary.",
    );
  }
  // requireAssignedPlan (src/routes/review/shared.ts) resolves the review
  // plan AND asserts the caller's own assignment on it in one call, called
  // as the first statement of a handler body alongside
  // requireReviewerOrOrganizer -- named by the same DEC-459 vocabulary
  // test/route-authz-enumeration.scan.test.ts already documents.
  // requireAuthOr302 (src/routes/account.tsx, local to that file) is named
  // explicitly by the same DEC-459 doc for the identical reason: a chain-
  // only scan would miss it.
  const EXTRA_GUARD_NAMES = [
    "requireAuth",
    "requireReviewerOrOrganizer",
    "requireAssignedPlan",
    "requireAuthOr302",
    "speakerGate",
  ];
  const GUARD_NAMES = new Set([...MIDDLEWARE_GUARD_NAMES, ...EXTRA_GUARD_NAMES]);

  // Object-level ownership markers (test/route-authz-enumeration.scan.test.ts's
  // own OWNERSHIP_MARKER vocabulary, DEC-459): requireOwned* / requireEvent /
  // requireOrgUser presuppose an already-established, org-scoped identity
  // (they read auth.orgId internally and throw on a missing one) — a route
  // whose only "guard" is one of these is not anonymous-reachable, but it is
  // also not proof of a SESSION/ROLE guard the way GUARD_NAMES is, so this
  // scan tracks it separately rather than folding it into GUARD_NAMES.
  const OWNERSHIP_MARKER = /^(requireOwned\w*|requireEvent|requireOrgUser)$/;
  // Guard-shaped identifiers that are NOT auth-related at all (field/body
  // validators sharing the require* naming convention by coincidence) — the
  // guard-shaped regex below would otherwise flag these as unrecognised.
  // requireAtLeastOneField (src/server/http.ts, DEC-627 wave-6 amendment)
  // refuses an all-optional PATCH whose body supplies no recognised field.
  // It reads only the parsed body, never auth/session state, so it belongs
  // with the other body-shape validators here rather than in GUARD_NAMES.
  const KNOWN_NON_GUARD_HELPERS = new Set([
    "requireString",
    "requireFullMatch",
    "requireAtLeastOneField",
  ]);
  // Ownership evidence that isn't require*-shaped at all — a LOCAL helper
  // (e.g. src/routes/files.ts's authzSubmissionWrite, which calls
  // requireAuth(c) internally but is itself the only identifier visible in
  // a registration's own body slice) can't be enumerated by name file-by-
  // file, so this scan reuses the exact naming-convention regex
  // test/route-authz-enumeration.scan.test.ts's OWNERSHIP_MARKER already
  // established as binding (DEC-459) for this same generalization problem:
  // requireAuth(, assert*(, authz*(, canAccess*(, c.var.auth,
  // auth.(userId|orgId|contactId) direct reads.
  const OWNERSHIP_EVIDENCE = /\brequireAuth\(|\bassert\w*\(|\bauthz\w*\(|\bcanAccess\w*\(|\bc\.var\.auth\b|\bauth\.(?:userId|orgId|contactId)\b/;

  // Deliberate exceptions to "every anonymous-reachable mutating door uses
  // checkAndIncrementScopedLimit" — each entry must state a reason that is
  // NOT "it has CSRF middleware" (CSRF proves the request came from our own
  // page, not that the caller isn't rate-limit-worthy). Identity-keyed
  // (file/method/path), never line-keyed, mirroring CSRF_EXEMPT above.
  const RATE_LIMIT_EXEMPT: Array<{ file: string; method: string; path: string; reason: string }> = [
    {
      file: "auth-login.tsx",
      method: "post",
      path: "/logout",
      reason:
        "DEC-459 (wave 35 amendment, cited by test/route-authz-enumeration.scan.test.ts's own PUBLIC_BY_DESIGN " +
        "ledger for this exact route): self-scoped by possession of the caller's own session cookie — it deletes " +
        "only the session row matching the presented cookie, if any, never another caller's, and is a no-op for " +
        "an anonymous caller with no cookie at all. There is no shared budget to protect: a request with no " +
        "cookie touches no row, and a request with a cookie can only ever burn its own single session.",
    },
  ];

  // The population: every real mutating registration (scanRouteRegistrations
  // already restricts to POST/PATCH/PUT/DELETE on a `<name>Routes.` Hono
  // sub-app receiver, same convention registered-routes.ts's routeVarNames
  // check enforces), joined against enumerateRegisteredRoutes() for the
  // resolved full mounted path.
  const files = listSourceFiles(ROUTES_DIR);
  const localRegistrations: RouteRegistration[] = [];
  for (const file of files) {
    const source = readFileSync(file, "utf-8");
    localRegistrations.push(...scanRouteRegistrations(file, source));
  }

  const resolvedRoutes = enumerateRegisteredRoutes().filter((r) =>
    ["POST", "PATCH", "PUT", "DELETE"].includes(r.method),
  );

  interface JoinedRegistration extends RouteRegistration {
    resolvedPath: string;
  }

  const joined: JoinedRegistration[] = localRegistrations.map((reg) => {
    const match = resolvedRoutes.find(
      (r) => r.file === reg.file && r.line === reg.line && r.method === reg.method.toUpperCase(),
    );
    if (!match) {
      throw new Error(
        `${relative(ROUTES_DIR, reg.file)}:${reg.line}: scanRouteRegistrations found a mutating registration ` +
          `(${reg.receiver}.${reg.method}(...)) that enumerateRegisteredRoutes did not — the two scanners' ` +
          `receiver/Hono-sub-app conventions have drifted apart; investigate rather than silently dropping this row.`,
      );
    }
    return { ...reg, resolvedPath: match.path };
  });

  it("found a non-trivial mutating registration population (a broken join must fail loudly, not pass vacuously)", () => {
    expect(joined.length).toBeGreaterThanOrEqual(80);
  });

  /** True when `identifier` matches the shape of a guard/refusal middleware
   * name this scan should be able to classify (require*, speakerGate,
   * guardDevMailbox) but is not in GUARD_NAMES — an unrecognised guard must
   * fail the scan loudly rather than being silently treated as "doesn't
   * authenticate" (which would misclassify a genuinely guarded route as
   * anonymous-reachable) or silently treated as "does authenticate" (which
   * would hide a real gap). */
  function assertNoUnrecognisedGuard(slice: string, context: string): void {
    const guardShaped = /\b(require[A-Z]\w*|speakerGate|guardDevMailbox)\b/g;
    let m: RegExpExecArray | null;
    while ((m = guardShaped.exec(slice))) {
      const name = m[1];
      if (!name) continue;
      if (GUARD_NAMES.has(name)) continue;
      if (name === "guardDevMailbox") continue;
      if (OWNERSHIP_MARKER.test(name)) continue;
      if (KNOWN_NON_GUARD_HELPERS.has(name)) continue;
      throw new Error(
        `${context}: found guard-shaped identifier '${name}' that isn't in this scan's known GUARD_NAMES, ` +
          `OWNERSHIP_MARKER, or KNOWN_NON_GUARD_HELPERS — either add it to the right vocabulary or this scan's ` +
          `assumption about guard-identifier naming has drifted. Refusing to guess.`,
      );
    }
  }

  /** True when `slice` names a guard from GUARD_NAMES (identity/role) or an
   * ownership marker from OWNERSHIP_MARKER (presupposes an established,
   * org-scoped identity) — either is sufficient evidence a registration is
   * not anonymous-reachable. */
  function slicedGuarded(slice: string): boolean {
    if ([...GUARD_NAMES].some((name) => new RegExp(`\\b${name}\\b`).test(slice))) return true;
    if (OWNERSHIP_EVIDENCE.test(slice)) return true;
    const identifierRegex = /\b(require[A-Z]\w*)\b/g;
    let m: RegExpExecArray | null;
    while ((m = identifierRegex.exec(slice))) {
      const name = m[1];
      if (name && OWNERSHIP_MARKER.test(name)) return true;
    }
    return false;
  }

  /** Extracts the source slice for a registration up to its next sibling
   * registration (or EOF) — unlike headerSlice (call site to the handler
   * arrow's opening brace, sized for middleware-chain detection), this
   * covers the whole handler BODY, which is where checkAndIncrementScopedLimit
   * is actually called (mirrors the pre-existing sliceForRoute technique this
   * describe block replaces). */
  function bodySliceFor(reg: RouteRegistration, source: string): string {
    // Locate the call site by (receiver, method, LINE) rather than a
    // `.method("path"` string marker -- a registration call can wrap its
    // arguments across multiple lines (e.g. `submissionsRoutes.post(\n
    // "/submissions/:id/revisions/:revisionId/restore",\n  requireOrganizer,`
    // in src/routes/api/submissions.ts), which a single-line marker misses
    // entirely.
    const callRegex = new RegExp(`\\b${reg.receiver}\\.${reg.method}\\(`, "g");
    let m: RegExpExecArray | null;
    let startIdx = -1;
    while ((m = callRegex.exec(source))) {
      const line = source.slice(0, m.index).split("\n").length;
      if (line === reg.line) {
        startIdx = m.index;
        break;
      }
    }
    if (startIdx === -1) {
      throw new Error(
        `${relative(ROUTES_DIR, reg.file)}:${reg.line}: could not re-find registration call site ` +
          `'${reg.receiver}.${reg.method}(' at this line for body slicing`,
      );
    }
    const nextCallRegex = /[A-Za-z_][A-Za-z0-9_]*Routes\.(post|patch|put|delete)\(/g;
    nextCallRegex.lastIndex = startIdx + `${reg.receiver}.${reg.method}(`.length;
    const nextMatch = nextCallRegex.exec(source);
    return source.slice(startIdx, nextMatch ? nextMatch.index : source.length);
  }

  const mountUseRegex = /([A-Za-z_][A-Za-z0-9_]*Routes)\.use\(\s*"([^"]*)"\s*,\s*([^)]*)\)/g;

  // Mount-level `.use(prefix, guard)` calls, collected across EVERY route
  // file (not just a registration's own file) — this repo's convention
  // routinely splits a sub-app's `.use(...)` guard declarations (its own
  // `index.ts`, e.g. src/routes/api/contacts/index.ts's
  // `contactsRoutes.use("/contacts", requireOrganizer)`) from its individual
  // route registrations (sibling files, e.g. crud.ts/bulk-email.ts/
  // segments.ts on that SAME `contactsRoutes` Hono instance). A same-file-only
  // check would misclassify every one of those registrations as
  // anonymous-reachable purely because the guard textually lives elsewhere —
  // the receiver identifier (not the file) is what identifies "the same
  // sub-app" here.
  interface MountUse {
    receiver: string;
    prefix: string;
    useArgs: string;
    file: string;
  }
  const allMountUses: MountUse[] = [];
  for (const file of files) {
    const source = readFileSync(file, "utf-8");
    mountUseRegex.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = mountUseRegex.exec(source))) {
      const receiver = m[1];
      const prefix = m[2];
      const useArgs = m[3];
      if (receiver === undefined || prefix === undefined || useArgs === undefined) continue;
      assertNoUnrecognisedGuard(useArgs, `${relative(ROUTES_DIR, file)} (${receiver}.use("${prefix}", ...))`);
      allMountUses.push({ receiver, prefix, useArgs, file });
    }
  }

  /** True when a `.use(prefix, ...)` registration's prefix covers `path` —
   * `"*"` covers everything; a trailing `/*` covers its base path and
   * anything under it (this repo's own convention, e.g. `/tracks/*`
   * covering `/tracks/:trackId`); otherwise an exact match. */
  function prefixCovers(prefix: string, path: string): boolean {
    if (prefix === "*") return true;
    if (prefix.endsWith("/*")) {
      const base = prefix.slice(0, -2);
      return path === base || path.startsWith(`${base}/`);
    }
    return path === prefix;
  }

  /** True when some `<sameReceiver>.use(prefix, guard)`, anywhere under
   * src/routes/**, covers `reg`'s own local path with a real guard from
   * GUARD_NAMES. */
  function mountLevelGuardCovers(reg: RouteRegistration): boolean {
    return allMountUses.some((u) => {
      if (u.receiver !== reg.receiver) return false;
      if (!prefixCovers(u.prefix, reg.path)) return false;
      return slicedGuarded(u.useArgs);
    });
  }

  it("every anonymous-reachable mutating door uses checkAndIncrementScopedLimit, or is RATE_LIMIT_EXEMPT with a reason", () => {
    const failures: string[] = [];
    for (const reg of joined) {
      const source = readFileSync(reg.file, "utf-8");
      // requireAuth/requireReviewerOrOrganizer/requireAssignedPlan are
      // called as the FIRST STATEMENT of the handler BODY in this repo's
      // convention (test/anonymous-route-probe.test.ts's own documented
      // vocabulary), not passed in the Hono middleware chain — headerSlice
      // (call site to the arrow's opening brace) can't see them, so guard
      // detection uses the full body slice, a superset of headerSlice.
      const bodySlice = bodySliceFor(reg, source);
      assertNoUnrecognisedGuard(bodySlice, `${relative(ROUTES_DIR, reg.file)}:${reg.line}`);
      const inlineGuarded = slicedGuarded(bodySlice);
      const mountGuarded = !inlineGuarded && mountLevelGuardCovers(reg);
      const anonymousReachable = !inlineGuarded && !mountGuarded;
      if (!anonymousReachable) continue;

      const relFile = relative(ROUTES_DIR, reg.file);
      const rateLimited = /\bcheckAndIncrementScopedLimit\b/.test(bodySlice);
      if (rateLimited) continue;

      const exempt = RATE_LIMIT_EXEMPT.find(
        (e) => e.file === relFile && e.method === reg.method && e.path === reg.path,
      );
      if (exempt) {
        expect(exempt.reason.length).toBeGreaterThan(0);
        continue;
      }
      failures.push(
        `${relFile}:${reg.line}: ${reg.receiver}.${reg.method}("${reg.resolvedPath}") is anonymous-reachable ` +
          `(no ${[...GUARD_NAMES].join("/")}) but has no checkAndIncrementScopedLimit and no RATE_LIMIT_EXEMPT entry`,
      );
    }
    expect(failures).toEqual([]);
  });

  it("every RATE_LIMIT_EXEMPT entry names a real anonymous-reachable registration", () => {
    for (const exempt of RATE_LIMIT_EXEMPT) {
      expect(exempt.reason.length).toBeGreaterThan(0);
      const match = joined.find(
        (reg) =>
          relative(ROUTES_DIR, reg.file) === exempt.file &&
          reg.method === exempt.method &&
          reg.path === exempt.path,
      );
      expect(
        match,
        `RATE_LIMIT_EXEMPT names ${exempt.file} ${exempt.method.toUpperCase()} ${exempt.path}, which is not a route registration`,
      ).toBeDefined();
    }
  });

  // DEC-948 (amendment): peekScopedLimit/incrementScopedLimit's read-then-write
  // shape let N concurrent requests all read the same pre-increment count and
  // all pass — replaced by the atomic checkAndIncrementScopedLimit, issued
  // before the password derivation runs. Kept as explicit named assertions
  // (not just population membership) because /login's consume-then-refund
  // shape (DEC-180 wave-29) is the one door in this population where a
  // missing refund is its own class of bug the population check above can't
  // see.
  it("POST /login (auth-login.tsx) uses checkAndIncrementScopedLimit (DEC-180 wave-29: consume-then-refund)", () => {
    const reg = joined.find((r) => relative(ROUTES_DIR, r.file) === "auth-login.tsx" && r.path === "/login");
    expect(reg, "POST /login registration not found by the derived scan").toBeDefined();
    const slice = bodySliceFor(reg!, readFileSync(reg!.file, "utf-8"));
    expect(slice).toMatch(/\bcheckAndIncrementScopedLimit\b/);
    expect(slice).toMatch(/\brefundScopedLimit\b/);
  });

  it("POST /claim/:token (auth-claim.tsx) uses checkAndIncrementScopedLimit", () => {
    const reg = joined.find((r) => relative(ROUTES_DIR, r.file) === "auth-claim.tsx" && r.path === "/claim/:token");
    expect(reg, "POST /claim/:token registration not found by the derived scan").toBeDefined();
    const slice = bodySliceFor(reg!, readFileSync(reg!.file, "utf-8"));
    expect(slice).toMatch(/\bcheckAndIncrementScopedLimit\b/);
  });
});
