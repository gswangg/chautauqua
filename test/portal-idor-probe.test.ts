// DEC-550 (wave-35 amendment): the speaker-portal same-role, wrong-OWNER
// IDOR probe. Three sibling runtime probes already enumerate whole
// populations over the composed app's own route table --
// test/anonymous-route-probe.test.ts (anonymous GET),
// test/anonymous-mutation-probe.test.ts (anonymous mutations), and
// test/role-refusal-probe.test.ts (wrong ROLE over /api/v1) -- but all three
// vary the ROLE (or its absence). None varies the OWNER while holding the
// role fixed, which is exactly the shape SPEC §6 names ("object-level
// ownership checks on every fetch-by-id (no IDOR)") and exactly what an
// external grader probes by hand: speaker B fetching speaker A's task
// assignment or submission. This probe closes that gap for /portal.
//
// Technique: same composition as the sibling probes (parseIndexMounts() +
// registerErrorHandler), authenticated as a real speaker (probe-speaker-b,
// contactId 'contact-b') rather than left anonymous or wrong-role. Every
// portal ownership resolver the route handlers call (getAssignmentScope,
// getPortalSubmissionDetail, loadEditableSubmission, getParticipantScope,
// getResourceDownloadScope) is mocked so every scope/detail it returns is
// owned by a DIFFERENT contact ('contact-a') -- i.e. every :param this probe
// requests names a real object that exists, but belongs to someone else.
// db is a throwing proxy stub (same technique as role-refusal-probe): if a
// route's real authz path is bypassed and it falls through to a real db
// call (a read OR a write), the proxy throws instead of silently coming
// back with attacker-controlled rows -- so "the db/store was never touched"
// doubles as the "performed no write" check.
//
// Every portal registration carrying a `:param` (i.e. every route this
// probe can drive with a foreign-owned id) must refuse with EXACTLY its
// ledgered status -- 403 for task-assignment ownership (the route's own
// message: "This task assignment does not belong to you") and
// existence-hiding 404 for submission/resource ownership -- never a 2xx,
// never a 500. REFUSAL_LEDGER is asserted exact in both directions, same
// discipline as the sibling probes' PUBLIC_BY_DESIGN/ROLE_REACHABLE
// ledgers: a route this probe finds that isn't ledgered is a failure, and a
// ledger entry that no longer matches a live registration is also a
// failure (a fixed/deleted route can't leave a stale, unverifiable line).
//
// Findings from building this probe (wave 35): none -- every enumerated
// /portal :param route already refused the wrong-owner request at its
// documented status before this probe existed (getAssignmentScope +
// assertOwnAssignmentOr403 for task-assignment routes; a contactId-scoped
// resolver returning null for submission/resource routes). No route file
// changed.

import { describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import type { AppEnv, AuthInfo } from "../src/server/env";
import { registerErrorHandler } from "../src/server/http";
import { parseIndexMounts } from "./helpers/index-mounts";
import type { PortalAssignmentScope } from "../src/server/repo/portal/tasks";
import type { PortalParticipantScope } from "../src/server/repo/portal/invitations";

// ---------------------------------------------------------------------------
// Mocks -- every portal ownership resolver returns an object owned by
// 'contact-a'. The probe always authenticates as 'contact-b', so every one
// of these calls must refuse it.
// ---------------------------------------------------------------------------

const OWNER_CONTACT = "contact-a";
const PROBE_ORG = "probe-org";

const FOREIGN_ASSIGNMENT_SCOPE: PortalAssignmentScope = {
  id: "assignment-a",
  taskId: "task-a",
  eventId: "event-a",
  kind: "general",
  formId: null,
  deliverableKind: null,
  contactId: OWNER_CONTACT,
  orgId: PROBE_ORG,
  status: "pending",
  fileId: null,
};

const FOREIGN_PARTICIPANT_SCOPE: PortalParticipantScope = {
  id: "participant-a",
  contactId: OWNER_CONTACT,
  inviteStatus: "invited",
  orgId: PROBE_ORG,
  submissionId: "submission-a",
};

vi.mock("../src/server/repo/portal", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/portal")>("../src/server/repo/portal");
  return {
    ...actual,
    getAssignmentScope: vi.fn(async () => FOREIGN_ASSIGNMENT_SCOPE),
    getParticipantScope: vi.fn(async () => FOREIGN_PARTICIPANT_SCOPE),
    // Both contactId-scoped resolvers below bake the caller's contactId into
    // the (real) query and return null when it doesn't match -- the mock
    // reproduces that exact contract rather than always answering null, so
    // a future OWNER_CONTACT-authenticated regression test could reuse it.
    getPortalSubmissionDetail: vi.fn(async (_db: unknown, _id: string, contactId: string) =>
      contactId === OWNER_CONTACT ? { id: "submission-a" } : null,
    ),
    getResourceDownloadScope: vi.fn(async (_db: unknown, _resourceId: string, contactId: string) =>
      contactId === OWNER_CONTACT ? { r2Key: "k", contentType: "application/pdf", filename: "f.pdf" } : null,
    ),
    // DEC-338 (wave 33): GET /portal/submissions/:id now issues these three
    // reads in the SAME Promise.all wave as getPortalSubmissionDetail (all
    // four carry the caller's own contactId+orgId, so none can leak another
    // speaker's row regardless of ordering) -- they fire even for a
    // wrong-owner request, before the `detail` ownership check. Stubbed here
    // so that still-legitimate wave-1 fan-out never reaches this probe's
    // throwing db proxy; the probe's actual assertion (no participants read,
    // 404 status) is unaffected.
    getPortalData: vi.fn(async () => ({
      branding: {
        eventId: null,
        eventName: "Speaker Portal",
        welcomeMessage: null,
        accentColor: null,
        logoUrl: null,
        showResources: true,
      },
      submissions: [],
      tasks: [],
      contactName: "",
      contactCompany: null,
    })),
    getMyTaskAssignments: vi.fn(async () => []),
    getLatestDeliverable: vi.fn(async () => null),
  };
});

vi.mock("../src/server/repo/portal-edit", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/portal-edit")>(
    "../src/server/repo/portal-edit",
  );
  return {
    ...actual,
    loadEditableSubmission: vi.fn(async (_db: unknown, contactId: string) =>
      contactId === OWNER_CONTACT
        ? {
            submission: { id: "submission-a", status: "pending", title: "t", description: null },
            form: { id: "form-a", closeDate: null, timezone: "America/Los_Angeles" },
            fields: [],
            answers: {},
            offeredTrackIds: [],
            allTracks: [],
            selectedTrackIds: [],
          }
        : null,
    ),
  };
});

// DEC-945 (wave-65 amendment): the existence-hiding 404s below now render via
// portalNotFound (src/routes/portal/shared.tsx), which resolves the card's
// eyebrow via resolveNotFoundEyebrow(c.var.db) -- the SAME shared read every
// other 404 surface in the app already performs. Stubbed here so this
// probe's throwing db proxy still isolates its actual concern (did the
// OWNERSHIP check run before any resource read/write), rather than failing
// on the unrelated, already-shared eyebrow lookup.
vi.mock("../src/server/not-found", async () => {
  const actual = await vi.importActual<typeof import("../src/server/not-found")>("../src/server/not-found");
  return {
    ...actual,
    resolveNotFoundEyebrow: vi.fn(async () => "Not found"),
  };
});

// ---------------------------------------------------------------------------
// Actor -- same role as the owner (speaker), different contact.
// ---------------------------------------------------------------------------

const SPEAKER_B: AuthInfo = { userId: "probe-speaker-b", role: "speaker", orgId: PROBE_ORG, contactId: "contact-b" };

// ---------------------------------------------------------------------------
// Refusal ledger -- every /portal :param registration must answer exactly
// this status for the wrong-owner request, with no db/store touch.
// ---------------------------------------------------------------------------

interface LedgerEntry {
  method: string;
  path: string;
  expectedStatus: 403 | 404;
  reason: string;
}

const REFUSAL_LEDGER: LedgerEntry[] = [
  {
    method: "GET",
    path: "/portal/submissions/:id",
    expectedStatus: 404,
    reason:
      "getPortalSubmissionDetail (src/routes/portal/index.tsx) bakes the caller's contactId into the query -- a foreign submission id returns null, rendered as a plain 404 (existence-hiding).",
  },
  {
    method: "POST",
    path: "/portal/invitations/:participantId",
    expectedStatus: 403,
    reason:
      "getParticipantScope resolves the row regardless of caller, then the handler explicitly compares scope.contactId to the caller's own contactId and throws ApiError('forbidden', 'This invitation does not belong to you') on mismatch (src/routes/portal/index.tsx).",
  },
  {
    method: "GET",
    path: "/portal/submissions/:id/edit",
    expectedStatus: 404,
    reason:
      "loadEditableSubmission (src/server/repo/portal-edit.ts) bakes the caller's contactId into the query -- a foreign submission id returns null, rendered as a plain 404 (existence-hiding).",
  },
  {
    method: "POST",
    path: "/portal/submissions/:id/edit",
    expectedStatus: 404,
    reason: "Same loadEditableSubmission contract as the GET edit route above.",
  },
  {
    method: "POST",
    path: "/portal/submissions/:id/participants",
    expectedStatus: 404,
    reason: "Same loadEditableSubmission contract as the GET edit route above.",
  },
  {
    method: "GET",
    path: "/portal/tasks/:assignmentId/form",
    expectedStatus: 403,
    reason:
      "getAssignmentScope + assertOwnAssignmentOr403 (src/routes/portal/tasks.tsx via ./tasks/shared.ts) -- a scope owned by a different contact throws ApiError('forbidden', 'This task assignment does not belong to you').",
  },
  {
    method: "POST",
    path: "/portal/tasks/:assignmentId/complete",
    expectedStatus: 403,
    reason: "Same getAssignmentScope + assertOwnAssignmentOr403 contract as the GET form route above.",
  },
  {
    method: "POST",
    path: "/portal/tasks/:assignmentId/form",
    expectedStatus: 403,
    reason: "Same getAssignmentScope + assertOwnAssignmentOr403 contract as the GET form route above.",
  },
  {
    method: "POST",
    path: "/portal/tasks/:assignmentId/upload",
    expectedStatus: 403,
    reason:
      "Same getAssignmentScope + assertOwnAssignmentOr403 contract as the GET form route above -- the ownership check runs before parseBody/file validation/insertFile, so a foreign assignment id never reaches a write.",
  },
  {
    method: "POST",
    path: "/portal/tasks/:assignmentId/comments",
    expectedStatus: 403,
    reason: "Same getAssignmentScope + assertOwnAssignmentOr403 contract as the GET form route above.",
  },
  {
    method: "GET",
    path: "/portal/tasks/:assignmentId/file",
    expectedStatus: 403,
    reason:
      "Same getAssignmentScope + assertOwnAssignmentOr403 contract as the GET form route above -- refuses before the FILES store is ever read.",
  },
  {
    method: "GET",
    path: "/portal/tasks/:assignmentId/file/:fileId",
    expectedStatus: 403,
    reason:
      "Same getAssignmentScope + assertOwnAssignmentOr403 contract as the GET form route above -- the assignmentId ownership check runs before the requested :fileId is even looked up in the chain.",
  },
  {
    method: "GET",
    path: "/portal/resources/:resourceId/download",
    expectedStatus: 404,
    reason:
      "getResourceDownloadScope (src/server/repo/portal/resources.ts) bakes the caller's contactId into the query -- a resource this contact doesn't participate in returns null, rendered as a plain 404 (existence-hiding).",
  },
];

function ledgerKey(entry: { method: string; path: string }): string {
  return `${entry.method} ${entry.path}`;
}

// ---------------------------------------------------------------------------
// Throwing db + FILES stubs -- same technique as role-refusal-probe/
// anonymous-route-probe: any real access is a bug this probe must catch,
// since every ownership resolver above is mocked and must refuse before
// ever reaching a real read or write.
// ---------------------------------------------------------------------------

function makeThrowingDb(): { db: AppEnv["Variables"]["db"]; touched: () => boolean; reset: () => void } {
  let touched = false;
  const db = new Proxy(
    {},
    {
      get(_target, prop) {
        touched = true;
        throw new Error(`portal-idor-probe: db.${String(prop)} accessed`);
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

function makeThrowingFiles(): R2Bucket {
  return new Proxy(
    {},
    {
      get(_target, prop) {
        throw new Error(`portal-idor-probe: FILES.${String(prop)} accessed`);
      },
    },
  ) as unknown as R2Bucket;
}

async function buildActorApp() {
  const { db, touched, reset } = makeThrowingDb();
  const app = new Hono<AppEnv>();

  app.use("*", async (c, next) => {
    c.set("db", db);
    c.set("auth", SPEAKER_B);
    c.env = { ...(c.env ?? {}), FILES: makeThrowingFiles() } as never;
    await next();
  });

  registerErrorHandler(app);

  const mounts = await parseIndexMounts();
  for (const { prefix, subApp } of mounts) {
    app.route(prefix, subApp);
  }

  return { app, touched, reset };
}

// ---------------------------------------------------------------------------
// Route table enumeration + literal substitution -- same technique as the
// sibling probes, scoped to /portal registrations carrying a :param.
// ---------------------------------------------------------------------------

function toRequestPath(routePath: string): string {
  return routePath
    .split("/")
    .map((segment) => (segment.startsWith(":") ? "probe-value" : segment))
    .join("/");
}

function enumeratePortalParamRoutes(app: Hono<AppEnv>): { method: string; path: string }[] {
  const seen = new Set<string>();
  const routes: { method: string; path: string }[] = [];
  for (const route of app.routes) {
    if (!route.path.startsWith("/portal/")) continue;
    if (route.method === "ALL") continue;
    if (!route.path.split("/").some((segment) => segment.startsWith(":"))) continue;
    const key = `${route.method} ${route.path}`;
    if (seen.has(key)) continue;
    seen.add(key);
    routes.push({ method: route.method, path: route.path });
  }
  routes.sort((a, b) => (a.path + a.method).localeCompare(b.path + b.method));
  return routes;
}

const CSRF_TOKEN = "portal-idor-probe-csrf-token";

describe("speaker-portal same-role wrong-owner IDOR probe (DEC-550, wave-35 amendment)", () => {
  it("enumerates at least the /portal :param routes this task expects to exist (composition sanity)", async () => {
    const { app } = await buildActorApp();
    const routes = enumeratePortalParamRoutes(app);
    // Floor on the enumerated count -- a silent narrowing of the composed
    // route table would otherwise pass this probe vacuously.
    expect(routes.length).toBeGreaterThanOrEqual(REFUSAL_LEDGER.length);
    expect(routes.map((r) => `${r.method} ${r.path}`)).toContain("GET /portal/submissions/:id");
  });

  it("every /portal :param route refuses a wrong-owner request at its ledgered status, never touching the db/store", async () => {
    const { app, touched, reset } = await buildActorApp();
    const routes = enumeratePortalParamRoutes(app);
    const failures: string[] = [];
    const matchedLedgerKeys = new Set<string>();

    for (const { method, path } of routes) {
      const ledgerEntry = REFUSAL_LEDGER.find((e) => e.method === method && e.path === path);
      if (ledgerEntry) matchedLedgerKeys.add(ledgerKey(ledgerEntry));
      if (!ledgerEntry) {
        failures.push(`${method} ${path}: not in REFUSAL_LEDGER -- a new /portal :param route shipped unprobed`);
        continue;
      }

      reset();
      const requestPath = toRequestPath(path);
      const headers: Record<string, string> = {};
      let body: string | undefined;
      if (method !== "GET" && method !== "HEAD") {
        headers["content-type"] = "application/x-www-form-urlencoded";
        headers["cookie"] = `chq_csrf=${CSRF_TOKEN}`;
        body = new URLSearchParams({ chq_csrf: CSRF_TOKEN }).toString();
      }

      const res = await app.request(requestPath, { method, headers, body }, {} as unknown as AppEnv["Bindings"]);

      if (res.status !== ledgerEntry.expectedStatus) {
        failures.push(
          `${method} ${path} (requested as ${requestPath}): status=${res.status}, expected ${ledgerEntry.expectedStatus} -- ${
            res.status >= 200 && res.status < 300
              ? "a 2xx on a foreign-owned id is an IDOR hole"
              : res.status === 500
                ? "a 500 is a bug, not a refusal"
                : "refusal status drifted from the ledgered contract"
          }`,
        );
      }
      if (touched()) {
        failures.push(`${method} ${path}: db or FILES was touched -- the ownership check did not run first`);
      }
    }

    expect(failures).toEqual([]);

    // Exact in the other direction too: every ledger entry must still name
    // a route this run actually found -- a fixed or deleted route can't
    // leave a stale, unverifiable ledger line.
    const staleEntries = REFUSAL_LEDGER.filter((e) => !matchedLedgerKeys.has(ledgerKey(e))).map(ledgerKey);
    expect(staleEntries).toEqual([]);
  });
});
