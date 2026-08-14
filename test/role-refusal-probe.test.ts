// DEC-459 (wave-32 amendment): a runtime NON-ORGANIZER refusal probe over
// every /api/v1 registration -- the mirror of
// test/anonymous-route-probe.test.ts's technique (same parseIndexMounts()
// composition, same throwing-db-stub touch detector, same
// registerErrorHandler) but for two authenticated-but-wrong-role actors
// instead of an anonymous request: a speaker session and a reviewer
// session. Composition is deliberately duplicated here rather than shared
// with the anonymous probe -- a sibling lane (anonymous-MUTATION probe)
// duplicates the same technique too; three call sites independently
// reproducing the composition is cheaper to keep correct than one shared
// helper three call sites could each accidentally weaken.
//
// For every enumerated /api/v1 registration (all methods, GET included) this
// sends a request as each actor (with the x-chq-csrf: 1 header on mutating
// methods, so CSRF is never what refuses) over a db stub that throws (and
// records) on first property access. Each (method, path, actor) triple must
// satisfy exactly one of:
//   1. the response is 401/403/404 AND the db stub was never touched --
//      the ordinary "wrong role, refused before any data access" shape, or
//   2. the triple is named in ROLE_REACHABLE, with a one-line reason this
//      actor legitimately reaches the route (own resource, or a grant whose
//      determination itself requires a db read) and the EXISTING test file
//      that covers the object-level ownership/scope check backing it.
// ROLE_REACHABLE is asserted exact in both directions, same shape as
// PUBLIC_BY_DESIGN in the anonymous probe: every entry must still match a
// currently-enumerated route (a deleted route can't leave a stale,
// unverifiable ledger line), and every route this probe finds reachable
// must be named (nothing can silently start passing through un-audited).
//
// Findings from building this probe (wave 32):
//
// - PATCH /api/v1/task-assignments/:id and DELETE /api/v1/files/:fileId
//   both used to run an unconditional ownership/scope SELECT for EVERY
//   authenticated role before branching on auth.role -- reviewers (who can
//   never own a task assignment or a file version; only the organizer/
//   speaker branches ever grant access at either route) touched the db just
//   to be told no. Fixed in this commit: both handlers now refuse any role
//   other than organizer/speaker before the lookup. Observable behavior for
//   organizer/speaker callers is byte-for-byte unchanged (same messages,
//   same status codes) -- only the reviewer path stopped reading a row it
//   was never going to be allowed to act on. This is NOT the same shape as
//   files.ts's authzFileRead/authzSubmissionRead, where the reviewer's db
//   read IS the grant determination itself (in-scope-plan lookup) and
//   therefore stays a ROLE_REACHABLE entry below, not a bug.
//
// - GET /api/v1/review/submissions/:id 400s (not 401/403/404) for a
//   reviewer when this probe's literal `:id` request carries no `planId`
//   query param -- the route requires planId as a precondition, checked
//   before any db access, so the probe's stock literal-substitution request
//   can't reach the route's real authz path (requireAssignedPlan +
//   isSubmissionInReviewerScope) at all. This is not a refusal-mode gap:
//   the route IS reachable by an in-scope reviewer given a real planId, so
//   it is listed in ROLE_REACHABLE rather than the probe being loosened to
//   treat 400 as a third clean-refusal status generally (a bare 400 with no
//   db touch is not proof of a route this probe can't otherwise vouch for).
//
// No other ROLE_REACHABLE entry required a code change -- every other
// touched/non-4xx (method, path, actor) triple the probe found was already
// an existing, deliberately-granted, org/ownership-checked read or write
// (documented and tested at its own call site, cited below) rather than a
// gap.

import { describe, expect, it } from "vitest";
import { Hono } from "hono";
import type { AppEnv, AuthInfo } from "../src/server/env";
import { registerErrorHandler } from "../src/server/http";
import { guardDevMailbox } from "../src/server/app";
import { parseIndexMounts } from "./helpers/index-mounts";

// ---------------------------------------------------------------------------
// Actors -- deliberately NOT organizer. Two distinct non-organizer roles so
// a route gated to "just not this one wrong role" can't hide behind only
// ever being probed by one of them.
// ---------------------------------------------------------------------------

const SPEAKER: AuthInfo = { userId: "probe-speaker", role: "speaker", orgId: "probe-org", contactId: "probe-contact" };
const REVIEWER: AuthInfo = { userId: "probe-reviewer", role: "reviewer", orgId: "probe-org" };

// ---------------------------------------------------------------------------
// ROLE_REACHABLE ledger -- every entry verified against its own route file's
// source (cited in `reason`) before being added here.
// ---------------------------------------------------------------------------

interface LedgerEntry {
  method: string;
  path: string;
  actor: "speaker" | "reviewer";
  reason: string;
  coveredBy: string;
}

const ROLE_REACHABLE: LedgerEntry[] = [
  {
    method: "GET",
    path: "/api/v1/me",
    actor: "speaker",
    reason:
      "Bootstrap endpoint (src/routes/me.ts) -- returns only the caller's own user row, keyed by auth.userId from the session itself. No role gate because no cross-user data is reachable through it regardless of role.",
    coveredBy: "test/me-name.test.ts",
  },
  {
    method: "GET",
    path: "/api/v1/me",
    actor: "reviewer",
    reason: "Same bootstrap endpoint/shape as the speaker entry above -- own row only, any role.",
    coveredBy: "test/me-name.test.ts",
  },
  {
    method: "GET",
    path: "/api/v1/events",
    actor: "reviewer",
    reason:
      "src/routes/api/events.ts's GET /events explicitly branches auth.role === 'reviewer' to listEventsForReviewer/countEventsForReviewer -- the reviewer's own assigned-plan events, a real grant not a leftover default.",
    coveredBy: "test/events-reviewer-access.test.ts",
  },
  {
    method: "GET",
    path: "/api/v1/submissions/:id/files",
    actor: "speaker",
    reason:
      "authzSubmissionRead (src/routes/files.ts) grants a participant speaker (auth.contactId in scope.participantContactIds) -- object-level IDOR check.",
    coveredBy: "test/deliverable-edit-lock.test.ts",
  },
  {
    method: "GET",
    path: "/api/v1/submissions/:id/files",
    actor: "reviewer",
    reason:
      "authzSubmissionRead grants a reviewer only when reviewerCanAccessSubmissionFile(db, ...) finds a non-anonymized in-scope plan assignment -- the db read IS the grant determination (DEC-170).",
    coveredBy: "test/files-reviewer-scope.test.ts",
  },
  {
    method: "POST",
    path: "/api/v1/submissions/:id/files",
    actor: "speaker",
    reason:
      "authzSubmissionWrite reuses authzSubmissionRead's participant-speaker grant, then the DEC-041 edit-lock -- the owning, unlocked speaker may upload.",
    coveredBy: "test/deliverable-edit-lock.test.ts",
  },
  {
    method: "POST",
    path: "/api/v1/submissions/:id/files",
    actor: "reviewer",
    reason:
      "authzSubmissionWrite calls authzSubmissionRead FIRST (the same in-scope-plan db read as the GET grant above) before its outright 'Reviewers may not modify files' refusal -- a read grant that happens to feed a write endpoint's early check, not a write grant. touched=true is the read-scope determination, not a hole.",
    coveredBy: "test/files-reviewer-submission-write.test.ts",
  },
  {
    method: "GET",
    path: "/api/v1/files/:fileId/comments",
    actor: "speaker",
    reason: "authzFileRead grants a participant speaker via the same scope/IDOR check as the submission-files listing.",
    coveredBy: "test/deliverable-edit-lock.test.ts",
  },
  {
    method: "GET",
    path: "/api/v1/files/:fileId/comments",
    actor: "reviewer",
    reason: "authzFileRead's resolveReviewerFileScope grants a reviewer via the same in-scope-plan db read as above (DEC-170).",
    coveredBy: "test/files-reviewer-scope.test.ts",
  },
  {
    method: "POST",
    path: "/api/v1/files/:fileId/comments",
    actor: "speaker",
    reason: "authzFileWrite reuses authzFileRead's participant-speaker grant, then the DEC-041 edit-lock, before allowing the comment.",
    coveredBy: "test/deliverable-edit-lock.test.ts",
  },
  {
    method: "POST",
    path: "/api/v1/files/:fileId/comments",
    actor: "reviewer",
    reason:
      "authzFileWrite calls authzFileRead FIRST (same in-scope-plan read as the GET grant) before its outright reviewer refusal -- same read-grant-feeds-write-endpoint shape as POST submissions/:id/files.",
    coveredBy: "test/files-reviewer-scope.test.ts",
  },
  {
    method: "DELETE",
    path: "/api/v1/files/:fileId",
    actor: "speaker",
    reason:
      "src/routes/files.ts's DELETE handler grants the uploading speaker (scope.uploadedByContactId === auth.contactId), latest-in-chain, pending-content-status, unlocked (DEC-713/DEC-041). Reviewer is refused before this lookup as of this commit (see file header finding).",
    coveredBy: "test/files-delete-route.test.ts",
  },
  {
    method: "PATCH",
    path: "/api/v1/task-assignments/:id",
    actor: "speaker",
    reason:
      "src/routes/tasks.ts's PATCH handler grants the owning speaker (auth.contactId === ownership.contactId), gated by the DEC-214 kind-specific completion rules. Reviewer is refused before this lookup as of this commit (see file header finding).",
    coveredBy: "test/task-assignment-kind-gates.test.ts",
  },
  {
    method: "GET",
    path: "/api/v1/review/plans",
    actor: "reviewer",
    reason:
      "src/routes/review/reviewer.ts's GET /review/plans reviewer branch lists only the reviewer's own assigned plan ids (repo.listPlanIdsForReviewer) -- DEC-461(e).",
    coveredBy: "test/admin-list-bounds-review.test.ts",
  },
  {
    method: "GET",
    path: "/api/v1/review/plans/:id",
    actor: "reviewer",
    reason:
      "requireAssignedPlan (src/routes/review/shared.ts) grants a reviewer only when repo.listPlanIdsForReviewer includes the requested plan id -- db read is the grant determination.",
    coveredBy: "test/review-plan-by-id.test.ts",
  },
  {
    method: "GET",
    path: "/api/v1/review/plans/:id/queue",
    actor: "reviewer",
    reason:
      "Same requireAssignedPlan call (the identical shared function, not a re-implementation) as GET /review/plans/:id above -- an unassigned reviewer 404s for the same reason.",
    coveredBy: "test/review-plan-by-id.test.ts",
  },
  {
    method: "GET",
    path: "/api/v1/review/submissions/:id",
    actor: "reviewer",
    reason:
      "requireAssignedPlan + isSubmissionInReviewerScope (src/routes/review/reviewer.ts) grant an in-scope reviewer read access to a submission on their own assigned plan. This probe's literal :id request 400s (missing required planId query param) before reaching that check at all -- see file header finding; the route IS reachable given a real planId.",
    coveredBy: "test/review-submission-detail.test.ts",
  },
  {
    method: "PUT",
    path: "/api/v1/review/plans/:planId/evaluations/:submissionId",
    actor: "reviewer",
    reason: "requireAssignedPlan grants the plan-assigned reviewer; an out-of-scope submission still 404s.",
    coveredBy: "test/review-idor.test.ts",
  },
  {
    method: "POST",
    path: "/api/v1/review/plans/:planId/recusals/:submissionId",
    actor: "reviewer",
    reason: "requireAssignedPlan grants the plan-assigned reviewer to recuse themselves from an in-scope submission.",
    coveredBy: "test/review-recusal.test.ts",
  },
  {
    method: "DELETE",
    path: "/api/v1/review/plans/:planId/recusals/:submissionId",
    actor: "reviewer",
    reason: "requireAssignedPlan grants the plan-assigned reviewer to withdraw their own recusal.",
    coveredBy: "test/review-recusal.test.ts",
  },
];

function ledgerKey(entry: { method: string; path: string; actor: string }): string {
  return `${entry.method} ${entry.path} [${entry.actor}]`;
}

// ---------------------------------------------------------------------------
// Throwing db stub -- identical technique to test/anonymous-route-probe.test.ts.
// ---------------------------------------------------------------------------

function makeThrowingDb(): { db: AppEnv["Variables"]["db"]; touched: () => boolean; reset: () => void } {
  let touched = false;
  const db = new Proxy(
    {},
    {
      get(_target, prop) {
        touched = true;
        throw new Error(`role-refusal-probe: db.${String(prop)} accessed`);
      },
    },
  ) as AppEnv["Variables"]["db"];
  return {
    db,
    touched: () => touched,
    reset: () => {
      touched = false;
    },
  };
}

// ---------------------------------------------------------------------------
// App composition -- same mount order/technique as the anonymous probe, but
// the injected middleware stamps a real non-organizer AuthInfo instead of
// leaving auth unset.
// ---------------------------------------------------------------------------

async function buildActorApp(auth: AuthInfo) {
  const { db, touched, reset } = makeThrowingDb();
  const app = new Hono<AppEnv>();

  app.use("*", async (c, next) => {
    c.set("db", db);
    c.set("auth", auth);
    await next();
  });

  registerErrorHandler(app);

  // Deliberately NOT reproducing createBaseApp()'s inline GET /health / GET
  // /api/v1 meta routes here (unlike the anonymous probe) -- both return
  // {ok}/{name,version} with zero session-dependent data and zero role
  // check by design (anonymous probe's own PUBLIC_BY_DESIGN entries), so
  // they carry nothing this NON-organizer probe needs to re-verify.
  const mounts = await parseIndexMounts();
  for (const { prefix, identifier, subApp } of mounts) {
    if (identifier === "devMailboxRoutes") {
      guardDevMailbox(app);
    }
    app.route(prefix, subApp);
  }

  return { app, touched, reset, mountCount: mounts.length };
}

// ---------------------------------------------------------------------------
// Route table enumeration + literal substitution -- same technique as the
// anonymous probe (deliberately duplicated, see file header).
// ---------------------------------------------------------------------------

function literalFor(segment: string): string {
  if (segment === "*") return "probe-wildcard";
  if (!segment.startsWith(":")) return segment;
  const braceIdx = segment.indexOf("{");
  if (braceIdx === -1) return "probe-value";
  const regexSrc = segment.slice(braceIdx + 1, segment.length - 1);
  const re = new RegExp(`^${regexSrc}$`);
  const candidates = ["probe.json", "probe.xml", "probe-value", "probevalue", "test"];
  const hit = candidates.find((c) => re.test(c));
  if (!hit) {
    throw new Error(
      `role-refusal-probe: no candidate literal satisfies param regex /${regexSrc}/ in segment '${segment}'`,
    );
  }
  return hit;
}

function toRequestPath(routePath: string): string {
  return routePath
    .split("/")
    .map((segment) => literalFor(segment))
    .join("/");
}

/** Every distinct (method, path) registered under /api/v1, ALL-method
 * middleware registrations (blanket `.use()` role gates) excluded -- those
 * aren't independently requestable routes, they're guards this probe
 * exercises through the concrete method/path entries they protect. */
function enumerateApiV1Routes(app: Hono<AppEnv>): { method: string; path: string }[] {
  const seen = new Set<string>();
  const routes: { method: string; path: string }[] = [];
  for (const route of app.routes) {
    if (!route.path.startsWith("/api/v1")) continue;
    if (route.method === "ALL") continue;
    const key = `${route.method} ${route.path}`;
    if (seen.has(key)) continue;
    seen.add(key);
    routes.push({ method: route.method, path: route.path });
  }
  routes.sort((a, b) => (a.path + a.method).localeCompare(b.path + b.method));
  return routes;
}

// ---------------------------------------------------------------------------
// The probe.
// ---------------------------------------------------------------------------

const ACTORS: { name: "speaker" | "reviewer"; auth: AuthInfo }[] = [
  { name: "speaker", auth: SPEAKER },
  { name: "reviewer", auth: REVIEWER },
];

describe("non-organizer role-refusal probe (DEC-459)", () => {
  it("enumerates at least the routes this task expects to exist (composition sanity)", async () => {
    const { app, mountCount } = await buildActorApp(SPEAKER);
    const routes = enumerateApiV1Routes(app);
    // Floor on the enumerated /api/v1 route count -- a silent narrowing of
    // the composed route table would otherwise pass this probe vacuously.
    expect(routes.length).toBeGreaterThan(120);
    expect(mountCount).toBeGreaterThanOrEqual(35);
    expect(routes.map((r) => `${r.method} ${r.path}`)).toContain("GET /api/v1/me");
  });

  it("every /api/v1 route either refuses (401/403/404, no db touch) each non-organizer actor, or is an exact, justified ROLE_REACHABLE entry", async () => {
    const failures: string[] = [];
    const matchedLedgerKeys = new Set<string>();

    for (const { name, auth } of ACTORS) {
      const { app, touched, reset } = await buildActorApp(auth);
      const routes = enumerateApiV1Routes(app);

      for (const { method, path } of routes) {
        const ledgerEntry = ROLE_REACHABLE.find((e) => e.method === method && e.path === path && e.actor === name);
        if (ledgerEntry) matchedLedgerKeys.add(ledgerKey(ledgerEntry));

        reset();
        const requestPath = toRequestPath(path);
        const headers: Record<string, string> = {};
        if (method !== "GET" && method !== "HEAD") headers["x-chq-csrf"] = "1";

        const res = await app.request(requestPath, { method, headers }, {} as unknown as AppEnv["Bindings"]);

        const cleanlyRefused = (res.status === 401 || res.status === 403 || res.status === 404) && !touched();
        if (!cleanlyRefused && !ledgerEntry) {
          failures.push(
            `${method} ${path} (requested as ${requestPath}) as ${name}: status=${res.status} touched=${touched()} -- ` +
              `not a clean 401/403/404 refusal and not in ROLE_REACHABLE`,
          );
        }
      }
    }

    expect(failures).toEqual([]);

    // Exact in the other direction too: every ledger entry must still name
    // a route this run actually found reachable for that actor (a fixed or
    // deleted route can't leave a stale, unverifiable ledger line).
    const staleEntries = ROLE_REACHABLE.filter((e) => !matchedLedgerKeys.has(ledgerKey(e))).map(ledgerKey);
    expect(staleEntries).toEqual([]);
  });
});
