// DEC-550 (wave-41 amendment): test/portal-idor-probe.test.ts proves every
// /portal :param route CALLS the right ownership resolver (getAssignmentScope
// / getParticipantScope / getPortalSubmissionDetail / loadEditableSubmission
// / getResourceDownloadScope) -- it mocks every one of those resolvers to
// always return an object owned by 'contact-a', so it can never tell whether
// the resolver itself FILTERS by contactId/orgId when given a REAL row. That
// gap is exactly what test/cross-org-object-probe.test.ts's own header names
// as its reason for using real rows over the /api/v1 population (field guide
// w37: "A MOCKED RESOLVER PROVES THE CALL, NOT THE FILTER"). This file closes
// the same gap for /portal: same-role, wrong-OWNER, against a REAL in-memory
// SQLite database migrated through every migrations/*.sql file.
//
// Technique (deliberately duplicated from test/cross-org-object-probe.test.ts
// and test/portal-idor-probe.test.ts, per DEC-459 rule 4 -- independently
// reproduced compositions are cheaper to keep correct than one shared helper
// all of them could accidentally weaken together): parseIndexMounts() +
// registerErrorHandler composition, enumerateRegisteredRoutes() (test/
// helpers/registered-routes.ts) to derive the /portal :param population from
// source (not hand-listed), and a REAL node:sqlite DatabaseSync +
// drizzle-orm/sqlite-proxy engine (same technique as
// test/rate-limit-atomicity.test.ts:19-64 / test/cross-org-object-probe.test.ts).
//
// Fixture: ONE org holding speaker A (contact + accepted submission [+ form]
// + participant + task + task_assignment + uploaded file + resource) and
// speaker B (own contact + user) -- the actor for every request. Every
// mutating method carries a valid double-submit CSRF cookie/field pair (the
// same discipline portal-idor-probe.test.ts uses) so CSRF is never what
// refuses the request.
//
// REFUSAL_LEDGER is asserted exact in both directions (same discipline as
// portal-idor-probe's own REFUSAL_LEDGER / cross-org-object-probe's
// CROSS_ORG_LEDGER): every enumerated /portal :param route must have exactly
// one ledger entry naming its expected refusal status (403 or 404 only -- a
// 2xx leak and a 5xx are both failures), and every ledger entry must still
// match a live registration. An enumeration floor keeps this from passing
// vacuously if the route table were silently narrowed. Speaker A's rows are
// snapshotted before and after the whole sweep and asserted byte-identical
// -- a "refusal" that still mutated the victim's data is not a refusal
// (field guide w36-w37/w41 shape).
//
// Findings from building this probe (wave 41): no route/repo file changed --
// every enumerated /portal :param route already refuses speaker B's
// wrong-owner request against REAL rows at its documented status (the same
// ledgered statuses portal-idor-probe.test.ts already asserts against mocks):
// getAssignmentScope + assertOwnAssignmentOr403 filters task-assignment
// routes to 403 (src/routes/portal/tasks.tsx + tasks/shared.ts);
// getParticipantScope + the handler's own scope.contactId comparison filters
// the invitation route to 403 (src/routes/portal/index.tsx);
// getPortalSubmissionDetail / loadEditableSubmission bake the caller's
// contactId into their own queries and return null (existence-hiding 404)
// for the submission-detail/edit/edit-participants routes (src/server/repo/
// portal/data.ts, src/server/repo/portal-edit.ts); getResourceDownloadScope
// requires the caller to be a participant in the resource's owning event
// (src/server/repo/portal/resources.ts) and returns null (404) for a
// non-participant. This probe is a pure ADD -- it does not modify
// test/portal-idor-probe.test.ts.

import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { drizzle } from "drizzle-orm/sqlite-proxy";
import { Hono } from "hono";
import * as schema from "../src/db/schema";
import type { AppEnv, AuthInfo } from "../src/server/env";
import { registerErrorHandler } from "../src/server/http";
import type { Db } from "../src/server/context";
import { parseIndexMounts } from "./helpers/index-mounts";
import { enumerateRegisteredRoutes } from "./helpers/registered-routes";

const REPO_ROOT = join(__dirname, "..");
const MIGRATIONS_DIR = join(REPO_ROOT, "migrations");

// ---------------------------------------------------------------------------
// Real SQLite engine, migrated through every migrations/*.sql file (same
// technique as test/cross-org-object-probe.test.ts / test/rate-limit-atomicity.test.ts).
// ---------------------------------------------------------------------------

function makeTestDb(): { db: Db; sqlite: DatabaseSync } {
  const sqlite = new DatabaseSync(":memory:");
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  for (const f of files) {
    sqlite.exec(readFileSync(join(MIGRATIONS_DIR, f), "utf8"));
  }
  const db = drizzle(
    async (sqlText, params, method) => {
      const stmt = sqlite.prepare(sqlText);
      stmt.setReturnArrays(true);
      if (method === "run") {
        stmt.run(...params);
        return { rows: [] };
      }
      const rows = stmt.all(...params) as unknown[];
      return { rows };
    },
    { schema },
  );
  return { db: db as unknown as Db, sqlite };
}

// ---------------------------------------------------------------------------
// Fixture -- ONE org. Speaker A owns the objects; speaker B is the actor.
// ---------------------------------------------------------------------------

const ORG_ID = "portal-real-rows-org";
const EVENT_ID = "portal-real-rows-event";

const IDS = {
  contactA: "portal-real-rows-contact-a",
  contactB: "portal-real-rows-contact-b",
  userB: "portal-real-rows-user-b",
  formA: "portal-real-rows-form-a",
  submissionA: "portal-real-rows-submission-a",
  participantA: "portal-real-rows-participant-a",
  taskA: "portal-real-rows-task-a",
  assignmentA: "portal-real-rows-assignment-a",
  fileA: "portal-real-rows-file-a",
  resourceA: "portal-real-rows-resource-a",
};

const SPEAKER_B: AuthInfo = {
  userId: IDS.userB,
  role: "speaker",
  orgId: ORG_ID,
  contactId: IDS.contactB,
};

function seedFixture(sqlite: DatabaseSync) {
  const now = Date.now();
  const run = (sql: string, ...params: (string | number)[]) => sqlite.prepare(sql).run(...params);

  run(`insert into org (id, name, created_at, updated_at) values (?, 'Org', ?, ?)`, ORG_ID, now, now);
  run(
    `insert into event (id, org_id, name, slug, start_date, end_date, timezone, created_at, updated_at)
     values (?, ?, 'Event', 'portal-real-rows-event', '2026-03-01', '2026-03-02', 'America/New_York', ?, ?)`,
    EVENT_ID,
    ORG_ID,
    now,
    now,
  );

  run(
    `insert into contact (id, org_id, first_name, last_name, email, created_at, updated_at)
     values (?, ?, 'Speaker', 'A', 'speaker-a@example.test', ?, ?)`,
    IDS.contactA,
    ORG_ID,
    now,
    now,
  );
  run(
    `insert into contact (id, org_id, first_name, last_name, email, created_at, updated_at)
     values (?, ?, 'Speaker', 'B', 'speaker-b@example.test', ?, ?)`,
    IDS.contactB,
    ORG_ID,
    now,
    now,
  );
  run(
    `insert into user (id, org_id, email, password_hash, role, contact_id, created_at, updated_at)
     values (?, ?, 'speaker-b-user@example.test', 'x', 'speaker', ?, ?, ?)`,
    IDS.userB,
    ORG_ID,
    IDS.contactB,
    now,
    now,
  );

  run(
    `insert into form (id, event_id, title, is_default, created_at, updated_at) values (?, ?, 'Form A', 1, ?, ?)`,
    IDS.formA,
    EVENT_ID,
    now,
    now,
  );

  run(
    `insert into submission (id, event_id, form_id, seq, title, status, content_status, created_at, updated_at)
     values (?, ?, ?, 1, 'Talk A', 'accepted', 'approved', ?, ?)`,
    IDS.submissionA,
    EVENT_ID,
    IDS.formA,
    now,
    now,
  );
  run(
    `insert into participant (id, submission_id, contact_id, role, "order", visible, invite_status, created_at, updated_at)
     values (?, ?, ?, 'speaker', 0, 1, 'accepted', ?, ?)`,
    IDS.participantA,
    IDS.submissionA,
    IDS.contactA,
    now,
    now,
  );

  run(
    `insert into task (id, event_id, kind, title, required, created_at, updated_at) values (?, ?, 'general', 'Task A', 0, ?, ?)`,
    IDS.taskA,
    EVENT_ID,
    now,
    now,
  );
  run(
    `insert into task_assignment (id, task_id, contact_id, status, created_at, updated_at) values (?, ?, ?, 'pending', ?, ?)`,
    IDS.assignmentA,
    IDS.taskA,
    IDS.contactA,
    now,
    now,
  );

  run(
    `insert into file (id, submission_id, kind, filename, r2_key, size_bytes, content_type, uploaded_by_contact_id, created_at, updated_at)
     values (?, ?, 'presentation', 'slides.pdf', 'portal-real-rows/slides.pdf', 100, 'application/pdf', ?, ?, ?)`,
    IDS.fileA,
    IDS.submissionA,
    IDS.contactA,
    now,
    now,
  );

  run(
    `insert into resource (id, event_id, kind, title, file_id, position, created_at, updated_at)
     values (?, ?, 'file', 'Resource A', ?, 0, ?, ?)`,
    IDS.resourceA,
    EVENT_ID,
    IDS.fileA,
    now,
    now,
  );
}

// Table -> id column, for the byte-identical-before/after snapshot. Every
// table this fixture wrote a row A could own.
const SNAPSHOT_TABLES: { table: string; idCol: string }[] = [
  { table: "org", idCol: "id" },
  { table: "event", idCol: "id" },
  { table: "contact", idCol: "id" },
  { table: "user", idCol: "id" },
  { table: "form", idCol: "id" },
  { table: "submission", idCol: "id" },
  { table: "participant", idCol: "id" },
  { table: "task", idCol: "id" },
  { table: "task_assignment", idCol: "id" },
  { table: "file", idCol: "id" },
  { table: "resource", idCol: "id" },
];

function snapshotAll(sqlite: DatabaseSync): string {
  const parts: string[] = [];
  for (const { table, idCol } of SNAPSHOT_TABLES) {
    const rows = sqlite.prepare(`select * from ${table} order by ${idCol} asc`).all();
    parts.push(`${table}:${JSON.stringify(rows)}`);
  }
  return parts.join("\n");
}

// ---------------------------------------------------------------------------
// App composition -- same technique as cross-org-object-probe/portal-idor-probe.
// FILES stays a throwing proxy: every enumerated route's ownership check must
// refuse before ever reaching a real byte read.
// ---------------------------------------------------------------------------

function makeThrowingFiles(): R2Bucket {
  return new Proxy(
    {},
    {
      get(_target, prop) {
        throw new Error(`portal-idor-real-rows-probe: FILES.${String(prop)} accessed`);
      },
    },
  ) as unknown as R2Bucket;
}

async function buildActorApp(db: Db) {
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
  return app;
}

// ---------------------------------------------------------------------------
// Route table enumeration -- every /portal registration carrying a :param,
// derived from source via enumerateRegisteredRoutes() (never hand-listed).
// ---------------------------------------------------------------------------

function enumeratePortalParamRoutes(): { method: string; path: string }[] {
  const seen = new Set<string>();
  const routes: { method: string; path: string }[] = [];
  for (const r of enumerateRegisteredRoutes()) {
    if (!r.path.startsWith("/portal/")) continue;
    if (!r.path.split("/").some((segment) => segment.startsWith(":"))) continue;
    const key = `${r.method} ${r.path}`;
    if (seen.has(key)) continue;
    seen.add(key);
    routes.push({ method: r.method, path: r.path });
  }
  routes.sort((a, b) => (a.path + a.method).localeCompare(b.path + b.method));
  return routes;
}

// Per-path param -> speaker A's real fixture id. Keyed by the FULL registered
// path (not just the param name), same discipline as cross-org-object-probe's
// PARAMS_BY_PATH -- ":id"/":assignmentId" mean a different entity depending
// on which route it appears on.
const PARAMS_BY_PATH: Record<string, Record<string, string>> = {
  "/portal/submissions/:id": { id: IDS.submissionA },
  "/portal/submissions/:id/edit": { id: IDS.submissionA },
  "/portal/submissions/:id/participants": { id: IDS.submissionA },
  "/portal/invitations/:participantId": { participantId: IDS.participantA },
  "/portal/tasks/:assignmentId/form": { assignmentId: IDS.assignmentA },
  "/portal/tasks/:assignmentId/complete": { assignmentId: IDS.assignmentA },
  "/portal/tasks/:assignmentId/upload": { assignmentId: IDS.assignmentA },
  "/portal/tasks/:assignmentId/comments": { assignmentId: IDS.assignmentA },
  "/portal/tasks/:assignmentId/file": { assignmentId: IDS.assignmentA },
  "/portal/tasks/:assignmentId/file/:fileId": { assignmentId: IDS.assignmentA, fileId: IDS.fileA },
  "/portal/resources/:resourceId/download": { resourceId: IDS.resourceA },
};

function toRequestPath(routePath: string): string {
  const params = PARAMS_BY_PATH[routePath];
  if (!params) {
    throw new Error(
      `portal-idor-real-rows-probe: no PARAMS_BY_PATH entry for ${routePath} -- add one before probing it`,
    );
  }
  return routePath
    .split("/")
    .map((segment) => {
      if (!segment.startsWith(":")) return segment;
      const name = segment.slice(1);
      const value = params[name];
      if (!value) {
        throw new Error(
          `portal-idor-real-rows-probe: PARAMS_BY_PATH[${routePath}] has no value for param "${name}"`,
        );
      }
      return value;
    })
    .join("/");
}

// ---------------------------------------------------------------------------
// REFUSAL_LEDGER -- same 13-route population and same expected statuses as
// test/portal-idor-probe.test.ts's own ledger, now proven against REAL rows.
// ---------------------------------------------------------------------------

interface LedgerEntry {
  method: string;
  path: string;
  expectedStatus: 403 | 404;
}

const REFUSAL_LEDGER: LedgerEntry[] = [
  { method: "GET", path: "/portal/submissions/:id", expectedStatus: 404 },
  { method: "POST", path: "/portal/invitations/:participantId", expectedStatus: 403 },
  { method: "GET", path: "/portal/submissions/:id/edit", expectedStatus: 404 },
  { method: "POST", path: "/portal/submissions/:id/edit", expectedStatus: 404 },
  { method: "POST", path: "/portal/submissions/:id/participants", expectedStatus: 404 },
  { method: "GET", path: "/portal/tasks/:assignmentId/form", expectedStatus: 403 },
  { method: "POST", path: "/portal/tasks/:assignmentId/complete", expectedStatus: 403 },
  { method: "POST", path: "/portal/tasks/:assignmentId/form", expectedStatus: 403 },
  { method: "POST", path: "/portal/tasks/:assignmentId/upload", expectedStatus: 403 },
  { method: "POST", path: "/portal/tasks/:assignmentId/comments", expectedStatus: 403 },
  { method: "GET", path: "/portal/tasks/:assignmentId/file", expectedStatus: 403 },
  { method: "GET", path: "/portal/tasks/:assignmentId/file/:fileId", expectedStatus: 403 },
  { method: "GET", path: "/portal/resources/:resourceId/download", expectedStatus: 404 },
];

function ledgerKey(entry: { method: string; path: string }): string {
  return `${entry.method} ${entry.path}`;
}

const CSRF_TOKEN = "portal-idor-real-rows-probe-csrf-token";

describe("speaker-portal same-role wrong-owner IDOR probe -- REAL rows (DEC-550, wave-41 amendment)", () => {
  it("enumerates at least the REFUSAL_LEDGER population (composition sanity, no vacuous pass)", () => {
    const routes = enumeratePortalParamRoutes();
    expect(routes.length).toBeGreaterThanOrEqual(REFUSAL_LEDGER.length);
    expect(routes.map((r) => `${r.method} ${r.path}`)).toContain("GET /portal/submissions/:id");
  });

  it("every /portal :param route refuses a wrong-owner request against REAL rows at its ledgered status (never 2xx, never 5xx), speaker A's rows untouched, ledger exact both directions", async () => {
    const { db, sqlite } = makeTestDb();
    seedFixture(sqlite);

    const before = snapshotAll(sqlite);
    const app = await buildActorApp(db);
    const routes = enumeratePortalParamRoutes();
    const matchedLedgerKeys = new Set<string>();
    const failures: string[] = [];

    for (const { method, path } of routes) {
      const entry = REFUSAL_LEDGER.find((e) => e.method === method && e.path === path);
      if (!entry) {
        failures.push(`${method} ${path}: not in REFUSAL_LEDGER -- a new /portal :param route shipped unprobed`);
        continue;
      }
      matchedLedgerKeys.add(ledgerKey(entry));

      const requestPath = toRequestPath(path);
      const headers: Record<string, string> = {};
      let body: string | undefined;
      if (method !== "GET" && method !== "HEAD") {
        headers["content-type"] = "application/x-www-form-urlencoded";
        headers["cookie"] = `chq_csrf=${CSRF_TOKEN}`;
        body = new URLSearchParams({ chq_csrf: CSRF_TOKEN }).toString();
      }

      const res = await app.request(requestPath, { method, headers, body }, {} as unknown as AppEnv["Bindings"]);

      if (res.status !== entry.expectedStatus) {
        const shape =
          res.status >= 200 && res.status < 300
            ? "a 2xx on a foreign-owned id is an IDOR hole"
            : res.status >= 500
              ? "a 5xx is not a refusal"
              : "refusal status drifted from the ledgered contract";
        failures.push(
          `${method} ${path} (requested as ${requestPath}): status=${res.status}, expected ${entry.expectedStatus} -- ${shape}`,
        );
      }
    }

    expect(failures).toEqual([]);

    const after = snapshotAll(sqlite);
    expect(after).toBe(before);

    const staleEntries = REFUSAL_LEDGER.filter((e) => !matchedLedgerKeys.has(ledgerKey(e))).map(ledgerKey);
    expect(staleEntries).toEqual([]);

    sqlite.close();
  });
});
