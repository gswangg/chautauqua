// DEC-027 wave-18 amendment (this wave's closure): the requireCookieSession
// "claim-mint" population must be DERIVED from the tree, never hand-listed
// (a hand-listed population is not a population, DEC-180). This file is
// that derivation, plus a request-level check that the guard actually
// refuses a bearer-authenticated mint attempt on the onboarding remind
// route (harness copied from test/users-bearer-containment.test.ts).
//
// Derivation, in two steps:
//  1. Read src/server/repo/tasks/reminders.ts and
//     src/server/repo/portal-link.ts for every EXPORTED function whose body
//     calls sendReminderEmails(...) or resolvePortalLinks(...) passing a
//     literal `true` for the mintClaimTokens parameter. Those functions
//     (plus the two base primitives createClaimToken and
//     applyMintedPortalLinks) are the "mint-reaching identifiers".
//  2. Walk every file under src/routes/** (readdirSync recursive, never a
//     hand list, DEC-808). For each `.post(`/`.patch(`/`.delete(`
//     registration, capture its full argument-list text by paren-depth
//     matching (so the captured text is the registration's own middleware
//     chain AND its own handler body, not the whole module). If that text
//     calls a mint-reaching identifier, the registration is a mint
//     reacher, and must list requireCookieSession in its own middleware
//     chain -- UNLESS the registration itself carries no role guard, which
//     means it is an unauthenticated public route with no session to
//     require (src/routes/public/submit-post.tsx's sole registration).

import { describe, expect, it, vi } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { afterEach } from "vitest";
import { Hono } from "hono";
import { registerErrorHandler } from "../src/server/http";
import type { AppEnv, AuthInfo } from "../src/server/env";

const REPO_ROOT = join(__dirname, "..");
const ROUTES_DIR = join(REPO_ROOT, "src/routes");
const REMINDERS_FILE = join(REPO_ROOT, "src/server/repo/tasks/reminders.ts");
const PORTAL_LINK_FILE = join(REPO_ROOT, "src/server/repo/portal-link.ts");

const ROLE_GUARDS = ["requireOrganizer", "requireReviewer", "requireSpeaker"];

/** Extracts the source text of every top-level `export async function NAME(`
 * / `export function NAME(` body in `src`, keyed by function name, via
 * brace-depth matching from the function's own opening `{` to its matching
 * closing `}`. */
function extractExportedFunctionBodies(src: string): Map<string, string> {
  const bodies = new Map<string, string>();
  const sigRe = /export\s+(?:async\s+)?function\s+([A-Za-z0-9_]+)\s*\(/g;
  let m: RegExpExecArray | null;
  while ((m = sigRe.exec(src)) !== null) {
    const name = m[1];
    if (!name) continue;
    // Find the params list's own closing ')' by paren-depth matching from
    // the '(' the signature regex already stopped at.
    const paramsOpenParen = src.indexOf("(", m.index);
    let pDepth = 0;
    let p = paramsOpenParen;
    for (; p < src.length; p++) {
      if (src[p] === "(") pDepth++;
      else if (src[p] === ")") {
        pDepth--;
        if (pDepth === 0) break;
      }
    }
    // The body's opening '{' is the first '{' after the params close that
    // sits OUTSIDE any '<...>' return-type generic (e.g. `Promise<{ ... }>`
    // has an inner object-type '{' nested inside '<>' -- skip it via
    // angle-bracket depth, not brace depth, so it is never mistaken for
    // the body's own opening brace).
    let angleDepth = 0;
    let openBrace = -1;
    for (let i = p + 1; i < src.length; i++) {
      if (src[i] === "<") angleDepth++;
      else if (src[i] === ">") angleDepth = Math.max(0, angleDepth - 1);
      else if (src[i] === "{" && angleDepth === 0) {
        openBrace = i;
        break;
      }
    }
    if (openBrace === -1) continue;
    let depth = 0;
    let i = openBrace;
    for (; i < src.length; i++) {
      if (src[i] === "{") depth++;
      else if (src[i] === "}") {
        depth--;
        if (depth === 0) break;
      }
    }
    bodies.set(name, src.slice(openBrace, i + 1));
  }
  return bodies;
}

/** True if `body` contains a call to `calleeName(...)` whose argument list
 * contains a standalone `true` literal (word-boundary, so it never matches
 * inside another identifier). */
function callsWithLiteralTrue(body: string, calleeName: string): boolean {
  const callRe = new RegExp(`\\b${calleeName}\\s*\\(`, "g");
  let m: RegExpExecArray | null;
  while ((m = callRe.exec(body)) !== null) {
    const openParen = body.indexOf("(", m.index);
    let depth = 0;
    let i = openParen;
    for (; i < body.length; i++) {
      if (body[i] === "(") depth++;
      else if (body[i] === ")") {
        depth--;
        if (depth === 0) break;
      }
    }
    const args = body.slice(openParen + 1, i);
    if (/(?:^|[(,\s])true(?:[,\s]|$)/.test(args)) return true;
  }
  return false;
}

/** Derives the mint-reaching identifier set per the module docblock above.
 * Never a hand list (DEC-180): the two base primitives are the only fixed
 * seed, everything else is read out of the two repo files' own bodies. */
function deriveMintReachingIdentifiers(): string[] {
  const identifiers = new Set<string>(["createClaimToken", "applyMintedPortalLinks"]);

  const remindersSrc = readFileSync(REMINDERS_FILE, "utf8");
  for (const [name, body] of extractExportedFunctionBodies(remindersSrc)) {
    if (callsWithLiteralTrue(body, "sendReminderEmails")) identifiers.add(name);
  }

  const portalLinkSrc = readFileSync(PORTAL_LINK_FILE, "utf8");
  for (const [name, body] of extractExportedFunctionBodies(portalLinkSrc)) {
    if (callsWithLiteralTrue(body, "resolvePortalLinks")) identifiers.add(name);
  }

  return [...identifiers];
}

interface RouteRegistration {
  file: string;
  method: string;
  path: string;
  text: string;
}

/** Recursively lists every file under `dir` (DEC-808: never a hand list). */
function listFilesRecursive(dir: string): string[] {
  const entries = readdirSync(dir, { recursive: true, withFileTypes: false }) as string[];
  return entries
    .map((e) => join(dir, e))
    .filter((p) => p.endsWith(".ts") || p.endsWith(".tsx"));
}

/** Finds every `.post(`, `.patch(`, `.delete(` registration in `src` and
 * captures each one's full call text (middleware chain + handler body) via
 * paren-depth matching from the registration's own opening `(`. */
function extractRouteRegistrations(file: string, src: string): RouteRegistration[] {
  const out: RouteRegistration[] = [];
  const regRe = /\b[A-Za-z0-9_]+\.(post|patch|delete)\(\s*(["'`])((?:[^\\]|\\.)*?)\2/g;
  let m: RegExpExecArray | null;
  while ((m = regRe.exec(src)) !== null) {
    const method = m[1];
    const path = m[3];
    if (method === undefined || path === undefined) continue;
    // The '(' immediately after the method name -- m[0] already spans
    // "<receiver>.<method>(" up to the opening quote, so the call's own
    // opening paren is the first '(' at or after m.index + the dot.
    const dotIndex = src.indexOf(".", m.index);
    const callOpenParen = src.indexOf("(", dotIndex);
    let depth = 0;
    let i = callOpenParen;
    for (; i < src.length; i++) {
      if (src[i] === "(") depth++;
      else if (src[i] === ")") {
        depth--;
        if (depth === 0) break;
      }
    }
    out.push({ file, method, path, text: src.slice(callOpenParen, i + 1) });
  }
  return out;
}

function registrationHasIdentifier(text: string, name: string): boolean {
  return new RegExp(`\\b${name}\\b`).test(text);
}

function registrationHasRoleGuard(text: string): boolean {
  return ROLE_GUARDS.some((g) => registrationHasIdentifier(text, g));
}

describe("DEC-027: claim-mint guard population is derived, not hand-listed", () => {
  const mintReachingIdentifiers = deriveMintReachingIdentifiers();

  it("derives at least the known mint-reaching identifiers", () => {
    // Sanity floor: the two base primitives plus the four named entry
    // points known at authoring time. If reminders.ts/portal-link.ts are
    // refactored this list may grow, but it must never shrink below this.
    for (const name of [
      "createClaimToken",
      "applyMintedPortalLinks",
      "mintPortalLinks",
      "remindNow",
      "sendDueRemindersForEvent",
    ]) {
      expect(mintReachingIdentifiers).toContain(name);
    }
  });

  const routeFiles = listFilesRecursive(ROUTES_DIR);

  const allRegistrations: RouteRegistration[] = [];
  for (const file of routeFiles) {
    const src = readFileSync(file, "utf8");
    allRegistrations.push(...extractRouteRegistrations(file, src));
  }

  const mintReachers = allRegistrations.filter((r) =>
    mintReachingIdentifiers.some((id) => registrationHasIdentifier(r.text, id)),
  );

  it("finds at least the five known mint-reaching registrations", () => {
    expect(routeFiles.length).toBeGreaterThan(10);
    expect(mintReachers.length).toBeGreaterThanOrEqual(5);
  });

  it("every mint-reaching registration with a role guard also requires a cookie session", () => {
    const offenders: string[] = [];
    for (const r of mintReachers) {
      if (!registrationHasRoleGuard(r.text)) continue; // unauthenticated public route: no session to require
      if (!registrationHasIdentifier(r.text, "requireCookieSession")) {
        offenders.push(`${r.file.replace(REPO_ROOT + "/", "")}: ${r.method.toUpperCase()} ${r.path}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("excludes src/routes/public/submit-post.tsx by the stated principle (no role guard), not by name", () => {
    const submitPost = mintReachers.filter((r) => r.file.endsWith("public/submit-post.tsx"));
    expect(submitPost.length).toBeGreaterThan(0);
    for (const r of submitPost) {
      expect(registrationHasRoleGuard(r.text)).toBe(false);
    }
  });

  it("negative control: a synthetic mint-reaching route source without the guard IS flagged", () => {
    const synthetic = `
      import { requireOrganizer, csrfJson } from "../server/middleware";
      import { createClaimToken } from "../auth/claim";
      syntheticRoutes.post("/events/:eventId/synthetic-mint", requireOrganizer, csrfJson, async (c) => {
        await createClaimToken(kv, { contactId, eventId });
        return c.json({});
      });
    `;
    const regs = extractRouteRegistrations("synthetic.ts", synthetic);
    const flagged = regs.filter((r) => registrationHasIdentifier(r.text, "createClaimToken"));
    expect(flagged.length).toBe(1);
    const only = flagged[0]!;
    expect(registrationHasRoleGuard(only.text)).toBe(true);
    expect(registrationHasIdentifier(only.text, "requireCookieSession")).toBe(false);
  });

  it("the onboarding/remind route is in the derived mint-reaching population", () => {
    const remind = mintReachers.find(
      (r) => r.file.endsWith("routes/tasks.ts") && r.path === "/events/:eventId/onboarding/remind",
    );
    expect(remind).toBeDefined();
    expect(registrationHasIdentifier(remind!.text, "requireCookieSession")).toBe(true);
  });

  it("the onboarding/remind/preview route is NOT in the derived mint-reaching population", () => {
    const preview = allRegistrations.find(
      (r) => r.file.endsWith("routes/tasks.ts") && r.path === "/events/:eventId/onboarding/remind/preview",
    );
    expect(preview).toBeDefined();
    const isMintReacher = mintReachingIdentifiers.some((id) => registrationHasIdentifier(preview!.text, id));
    expect(isMintReacher).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Request-level: a bearer-authenticated call is refused; a cookie session
// gets through. Harness copied from test/users-bearer-containment.test.ts.
// ---------------------------------------------------------------------------

const ORG_A = "org-a";

vi.mock("../src/server/repo/tasks", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/tasks")>("../src/server/repo/tasks");
  return {
    ...actual,
    getEventOrgId: vi.fn(async () => ORG_A),
    remindNow: vi.fn(async () => ({ sent: 0, failed: [], skipped: 0, remaining: 0 })),
  };
});

vi.mock("../src/server/context", async () => {
  const actual = await vi.importActual<typeof import("../src/server/context")>("../src/server/context");
  return {
    ...actual,
    makeMailer: vi.fn(() => ({ send: vi.fn(async () => {}) })),
  };
});

afterEach(() => {
  vi.clearAllMocks();
});

async function buildTasksApp(auth: AuthInfo | undefined) {
  const { taskRoutes } = await import("../src/routes/tasks");
  const app = new Hono<AppEnv>();
  registerErrorHandler(app);
  app.use("*", async (c, next) => {
    if (auth) c.set("auth", auth);
    c.set("db", {} as never);
    c.env = {
      KV: { get: async () => null, put: async () => {}, delete: async () => {} },
      PUBLIC_BASE_URL: "https://events.example.com",
    } as never;
    await next();
  });
  app.route("/api/v1", taskRoutes);
  return app;
}

const bearerOrganizer: AuthInfo = { userId: "u1", role: "organizer", orgId: ORG_A, viaBearer: true };
const cookieOrganizer: AuthInfo = { userId: "u1", role: "organizer", orgId: ORG_A };

describe("DEC-027: request-level containment on POST /events/:eventId/onboarding/remind", () => {
  it("403 forbidden, exact message, for a bearer-authenticated organizer", async () => {
    const app = await buildTasksApp(bearerOrganizer);
    const res = await app.request("/api/v1/events/event-1/onboarding/remind", {
      method: "POST",
      headers: { "content-type": "application/json", "x-chq-csrf": "1" },
      body: "{}",
    });
    expect(res.status).toBe(403);
    const body = (await res.json()) as { error: { code: string; message: string } };
    expect(body.error.code).toBe("forbidden");
    expect(body.error.message).toBe("This action requires a signed-in session, not an API token");
  });

  it("is not refused by this guard for a cookie-session organizer", async () => {
    const app = await buildTasksApp(cookieOrganizer);
    const res = await app.request("/api/v1/events/event-1/onboarding/remind", {
      method: "POST",
      headers: { "content-type": "application/json", "x-chq-csrf": "1" },
      body: "{}",
    });
    expect(res.status).toBe(200);
  });
});
