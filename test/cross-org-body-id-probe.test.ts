// DEC-459 wave-40 amendment: the tenant axis for ids supplied OUTSIDE the
// path -- JSON body and query string. The four wave-37 probes
// (test/cross-org-event-scope-probe.test.ts, test/cross-org-object-probe.test.ts,
// test/cross-org-file-bytes-probe.test.ts, test/cross-org-portal-probe.test.ts --
// see each file's own header) derive their populations from PATH shape and
// are blind to a foreign id arriving in a request body or query string, e.g.
// POST /contacts/duplicates/dismiss {contactIds}, POST /contacts/merge
// {keepId, mergeIds}, POST /pipeline {contactId}, POST /plans/:id/reviewers
// {userId, submissionIds}. This file closes that gap.
//
// Technique (deliberately duplicated from test/cross-org-object-probe.test.ts
// and the other wave-37 siblings, per DEC-459 rule 4 -- independently
// reproduced compositions are cheaper to keep correct than one shared helper
// all of them could accidentally weaken together): parseIndexMounts() +
// registerErrorHandler composition, a REAL in-memory SQLite engine (node:sqlite
// DatabaseSync + drizzle-orm/sqlite-proxy) migrated through every concatenated
// migrations/*.sql file (same technique as test/rate-limit-atomicity.test.ts).
//
// Population is derived at test time, never hand-listed: every /api/v1
// registration (enumerateRegisteredRoutes(), test/helpers/registered-routes.ts)
// whose OWN handler source (the source slice from its registration call to
// the next registration in the same file) reads an entity-id key off `body.`
// or `c.req.query("...")`, matching the two regexes DEC-459's wave-40
// amendment names. A route registered more than once in the population (none
// today) is deduped by method+path.
//
// Fixture: org B holds the actor (an organizer) and every object its PATH
// params name (event, track, room, contact, submission (accepted, so the
// slot route's body validation is reachable), task, plan). Org A holds one
// real row per entity family a body/query key could name (event, track,
// room, contact, submission, user, file, plan) -- every enumerated route's
// PATH points at org B's own object; only the body/query carries org A's
// real id, so a path-level check can never be what refuses the request.
//
// CROSS_ORG_BODY_LEDGER is exact in both directions (same discipline as the
// wave-37 probes' CROSS_ORG_LEDGER): every enumerated registration has
// exactly one ledger entry, either naming its expected refusal status (400,
// 403 or 404 -- SPEC/DEC-459 forbid both a 2xx leak and a 5xx masquerading as
// a refusal) or, for a route this probe determined does not actually
// dereference the foreign value as an object reference, a one-line reason
// instead of an exercise. Org A's fixture rows are snapshotted before and
// after the full sweep and asserted byte-identical.
//
// Findings from building this probe (wave 40): no route-file change needed --
// every enumerated route that DEREFERENCES a body/query id as an object
// reference already resolves it through an org-scoped lookup (getEventForOrg,
// findContactForOrg, requireOwnedContact(s), requireOrgUser, getPlanForOrg,
// trackExistsInEvent/parseTrackIdsField, roomBelongsToEvent, getFileScope,
// findContactsForOrg) and refuses 400 or 404 before any write, verified
// against each route's own source before being ledgered below. Five
// registrations were EXCLUDED with a one-line reason rather than exercised,
// because the matched key is read but never used as an object reference an
// attacker could leverage:
//   - GET /api/v1/events/:eventId/email-log (?contactId=, ?batchId=): both
//     are AND-combined WHERE-clause narrowing filters over a query already
//     scoped to the caller's own (org-checked) eventId -- a foreign value can
//     only narrow the result toward empty, never toward another org's rows
//     (src/routes/api/email-log.ts:36-52, src/server/repo/email.ts).
//   - POST /api/v1/events/:eventId/compose/send (body.templateId): stored
//     verbatim as an opaque label on the email_log row for the Comms history
//     tab (src/routes/comms/send.ts:95,145) -- never read back to resolve or
//     render an email_template row, so there is nothing to dereference.
//   - POST /api/v1/events/:eventId/onboarding/remind and its /preview
//     sibling (body.taskIds, body.contactIds): both are optional AND-combined
//     narrowing filters over listRemindableContactIds/listOutstandingForEvent,
//     already scoped to the caller's own eventId (src/server/repo/tasks/
//     reminders.ts:72-107,177-199) -- same shape as the email-log filters.
//   - POST /api/v1/events/:eventId/submissions/delete (body.ids): DEC-921's
//     guarded-cascade design is an explicit PER-ITEM refusal that never
//     mutates a foreign id -- an id planSubmissionDelete's own event-scoped
//     query can't find lands in the response's `refused` array (never
//     `eligible`, so commitSubmissionDelete never touches it), and the route
//     replies 200 with that array rather than throwing for the batch (unlike
//     its ids-bearing siblings /status and /content-status, which DO throw
//     400 for the whole batch on an unrecognized id -- src/server/repo/
//     submission-delete.ts:130-158 vs. src/server/repo/submissions/
//     status.ts:508-515 and src/server/repo/files-content-status.ts:63-70).
//     A 200 here is a refusal that doesn't mutate, not a leak -- ledgered
//     with a reason rather than forced into the binary 400/403/404 shape the
//     other two already satisfy.
//
// Wave 41: DEC-027's wave-41 amendment gave the email-log and evaluations
// export kinds their own surface's narrowing filter, so GET /api/v1/events/
// :eventId/export/:kind reads ?contactId=/?planId= and JOINED this
// population. It is EXERCISED (not excluded): the evaluations kind resolves
// ?planId= against this event's own plans and throws before any row query
// when it isn't one, so a foreign plan id is refused 400 rather than
// silently narrowing the CSV to empty.

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
import { enumerateRegisteredRoutes, type RegisteredRoute } from "./helpers/registered-routes";

const REPO_ROOT = join(__dirname, "..");
const MIGRATIONS_DIR = join(REPO_ROOT, "migrations");

// ---------------------------------------------------------------------------
// Population -- every /api/v1 registration whose OWN handler source (the
// slice from its registration call to the next registration in the same
// file) reads a known entity-id key off `body.` or `c.req.query(...)`.
// ---------------------------------------------------------------------------

const BODY_ID_RE =
  /body\.(contactId|contactIds|userId|userIds|submissionId|submissionIds|ids|keepId|mergeIds|taskId|taskIds|trackId|trackIds|roomId|planId|templateId|segmentId|viewId|fileId|resourceId|eventId|replacesFileId)\b/;
const QUERY_ID_RE = /c\.req\.query\("(planId|segmentId|viewId|trackId|contactId|templateId|eventId|batchId)"\)/;

/** Per-file, line-sorted handler-source slices: each registration's own text
 * runs from its registration line to the NEXT registration's line in the
 * same file (or EOF), the same boundary enumerateRegisteredRoutes() itself
 * resolves registrations against. */
function handlerSourceByRoute(routes: RegisteredRoute[]): Map<RegisteredRoute, string> {
  const byFile = new Map<string, RegisteredRoute[]>();
  for (const r of routes) {
    if (!byFile.has(r.file)) byFile.set(r.file, []);
    byFile.get(r.file)!.push(r);
  }
  const result = new Map<RegisteredRoute, string>();
  for (const [file, fileRoutes] of byFile) {
    const lines = readFileSync(file, "utf8").split("\n");
    const sorted = [...fileRoutes].sort((a, b) => a.line - b.line);
    for (let i = 0; i < sorted.length; i++) {
      const start = sorted[i]!.line - 1;
      const end = i + 1 < sorted.length ? sorted[i + 1]!.line - 1 : lines.length;
      result.set(sorted[i]!, lines.slice(start, end).join("\n"));
    }
  }
  return result;
}

function enumeratePopulation(): { method: string; path: string }[] {
  const all = enumerateRegisteredRoutes().filter((r) => r.path.startsWith("/api/v1/"));
  const sourceByRoute = handlerSourceByRoute(all);
  const seen = new Set<string>();
  const routes: { method: string; path: string }[] = [];
  for (const r of all) {
    const src = sourceByRoute.get(r) ?? "";
    if (!BODY_ID_RE.test(src) && !QUERY_ID_RE.test(src)) continue;
    const key = `${r.method} ${r.path}`;
    if (seen.has(key)) continue;
    seen.add(key);
    routes.push({ method: r.method, path: r.path });
  }
  routes.sort((a, b) => (a.path + a.method).localeCompare(b.path + b.method));
  return routes;
}

// ---------------------------------------------------------------------------
// Real SQLite engine, migrated through every migrations/*.sql file (same
// technique as test/rate-limit-atomicity.test.ts / test/cross-org-object-probe.test.ts).
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
// Fixture -- org B holds the actor + every PATH object; org A holds one real
// row per entity family a body/query key could name.
// ---------------------------------------------------------------------------

const ORG_A = "cross-org-body-a";
const ORG_B = "cross-org-body-b";
const EVENT_A = "cross-org-body-event-a";
const EVENT_B = "cross-org-body-event-b";

const IDS = {
  // org A -- referenced only from body/query, never from a PATH param.
  trackA: "cross-org-body-track-a",
  roomA: "cross-org-body-room-a",
  contactA: "cross-org-body-contact-a",
  formA: "cross-org-body-form-a",
  submissionA: "cross-org-body-submission-a",
  reviewerUserA: "cross-org-body-reviewer-user-a",
  fileA: "cross-org-body-file-a",
  planA: "cross-org-body-plan-a",
  // org B -- every PATH param this probe requests names one of these.
  organizerUserB: "cross-org-body-organizer-b",
  contactB: "cross-org-body-contact-b",
  formB: "cross-org-body-form-b",
  submissionB: "cross-org-body-submission-b",
  taskB: "cross-org-body-task-b",
  planB: "cross-org-body-plan-b",
};

const ORGANIZER_B: AuthInfo = { userId: IDS.organizerUserB, role: "organizer", orgId: ORG_B };

function seedFixture(sqlite: DatabaseSync) {
  const now = Date.now();
  const run = (sql: string, ...params: (string | number)[]) => sqlite.prepare(sql).run(...params);

  run(`insert into org (id, name, created_at, updated_at) values (?, 'Org A', ?, ?)`, ORG_A, now, now);
  run(`insert into org (id, name, created_at, updated_at) values (?, 'Org B', ?, ?)`, ORG_B, now, now);

  run(
    `insert into event (id, org_id, name, slug, start_date, end_date, timezone, created_at, updated_at)
     values (?, ?, 'Event A', 'cross-org-body-event-a', '2026-03-01', '2026-03-02', 'America/New_York', ?, ?)`,
    EVENT_A,
    ORG_A,
    now,
    now,
  );
  run(
    `insert into event (id, org_id, name, slug, start_date, end_date, timezone, created_at, updated_at)
     values (?, ?, 'Event B', 'cross-org-body-event-b', '2026-03-01', '2026-03-02', 'America/New_York', ?, ?)`,
    EVENT_B,
    ORG_B,
    now,
    now,
  );

  run(
    `insert into user (id, org_id, email, password_hash, role, created_at, updated_at) values (?, ?, 'organizer-b@example.test', 'x', 'organizer', ?, ?)`,
    IDS.organizerUserB,
    ORG_B,
    now,
    now,
  );
  run(
    `insert into user (id, org_id, email, password_hash, role, created_at, updated_at) values (?, ?, 'reviewer-a@example.test', 'x', 'reviewer', ?, ?)`,
    IDS.reviewerUserA,
    ORG_A,
    now,
    now,
  );

  run(
    `insert into contact (id, org_id, first_name, last_name, email, created_at, updated_at) values (?, ?, 'Speaker', 'A', 'speaker-a@example.test', ?, ?)`,
    IDS.contactA,
    ORG_A,
    now,
    now,
  );
  run(
    `insert into contact (id, org_id, first_name, last_name, email, created_at, updated_at) values (?, ?, 'Speaker', 'B', 'speaker-b@example.test', ?, ?)`,
    IDS.contactB,
    ORG_B,
    now,
    now,
  );

  run(
    `insert into track (id, event_id, name, position, created_at, updated_at) values (?, ?, 'Track A', 0, ?, ?)`,
    IDS.trackA,
    EVENT_A,
    now,
    now,
  );
  run(
    `insert into room (id, event_id, name, position, created_at, updated_at) values (?, ?, 'Room A', 0, ?, ?)`,
    IDS.roomA,
    EVENT_A,
    now,
    now,
  );

  run(
    `insert into form (id, event_id, title, is_default, created_at, updated_at) values (?, ?, 'Form A', 1, ?, ?)`,
    IDS.formA,
    EVENT_A,
    now,
    now,
  );
  run(
    `insert into form (id, event_id, title, is_default, created_at, updated_at) values (?, ?, 'Form B', 1, ?, ?)`,
    IDS.formB,
    EVENT_B,
    now,
    now,
  );

  run(
    `insert into submission (id, event_id, form_id, seq, title, status, content_status, created_at, updated_at)
     values (?, ?, ?, 1, 'Talk A', 'pending', 'pending', ?, ?)`,
    IDS.submissionA,
    EVENT_A,
    IDS.formA,
    now,
    now,
  );
  // org B's own submission: 'accepted' so PUT .../slot's status precondition
  // is satisfied and the route reaches the body.roomId cross-org check.
  run(
    `insert into submission (id, event_id, form_id, seq, title, status, content_status, accepted_at, created_at, updated_at)
     values (?, ?, ?, 1, 'Talk B', 'accepted', 'pending', ?, ?, ?)`,
    IDS.submissionB,
    EVENT_B,
    IDS.formB,
    now,
    now,
    now,
  );

  run(
    `insert into file (id, submission_id, kind, filename, r2_key, size_bytes, content_type, uploaded_by_contact_id, created_at, updated_at)
     values (?, ?, 'presentation', 'slides.pdf', 'cross-org-body/slides.pdf', 100, 'application/pdf', ?, ?, ?)`,
    IDS.fileA,
    IDS.submissionA,
    IDS.contactA,
    now,
    now,
  );

  run(
    `insert into task (id, event_id, kind, title, required, created_at, updated_at) values (?, ?, 'general', 'Task B', 0, ?, ?)`,
    IDS.taskB,
    EVENT_B,
    now,
    now,
  );

  run(
    `insert into evaluation_plan (id, event_id, name, scale_json, criteria_json, rounds, current_round, created_at, updated_at)
     values (?, ?, 'Plan A', '{}', '[]', 1, 1, ?, ?)`,
    IDS.planA,
    EVENT_A,
    now,
    now,
  );
  run(
    `insert into evaluation_plan (id, event_id, name, scale_json, criteria_json, rounds, current_round, created_at, updated_at)
     values (?, ?, 'Plan B', '{}', '[]', 1, 1, ?, ?)`,
    IDS.planB,
    EVENT_B,
    now,
    now,
  );
}

// Table -> id column, for the byte-identical-before/after snapshot of org A's
// fixture rows.
const SNAPSHOT_TABLES: { table: string; idCol: string }[] = [
  { table: "org", idCol: "id" },
  { table: "event", idCol: "id" },
  { table: "user", idCol: "id" },
  { table: "contact", idCol: "id" },
  { table: "track", idCol: "id" },
  { table: "room", idCol: "id" },
  { table: "form", idCol: "id" },
  { table: "submission", idCol: "id" },
  { table: "file", idCol: "id" },
  { table: "task", idCol: "id" },
  { table: "evaluation_plan", idCol: "id" },
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
// App composition -- duplicated from the wave-37 siblings, per DEC-459 rule 4.
// ---------------------------------------------------------------------------

async function buildActorApp(db: Db) {
  const app = new Hono<AppEnv>();
  app.use("*", async (c, next) => {
    c.set("db", db);
    c.set("auth", ORGANIZER_B);
    c.env = { ...(c.env ?? {}), FILES: makeThrowingFiles(), KV: makeThrowingKv() } as never;
    await next();
  });
  registerErrorHandler(app);
  const mounts = await parseIndexMounts();
  for (const { prefix, subApp } of mounts) {
    app.route(prefix, subApp);
  }
  return app;
}

function makeThrowingFiles(): R2Bucket {
  return new Proxy(
    {},
    {
      get(_target, prop) {
        throw new Error(`cross-org-body-id-probe: FILES.${String(prop)} accessed`);
      },
    },
  ) as unknown as R2Bucket;
}

function makeThrowingKv(): unknown {
  return new Proxy(
    {},
    {
      get(_target, prop) {
        throw new Error(`cross-org-body-id-probe: KV.${String(prop)} accessed`);
      },
    },
  );
}

// ---------------------------------------------------------------------------
// Per-route request shape: PATH params always name an org-B object; body/
// query carries org A's real id under the matched key(s). Every route below
// is populated (present in enumeratePopulation()) and has exactly one
// CROSS_ORG_BODY_LEDGER entry.
// ---------------------------------------------------------------------------

interface RouteCase {
  method: string;
  path: string;
  requestPath: string;
  body?: Record<string, unknown>;
  query?: Record<string, string>;
}

const CASES: RouteCase[] = [
  {
    method: "PUT",
    path: "/api/v1/submissions/:id/slot",
    requestPath: `/api/v1/submissions/${IDS.submissionB}/slot`,
    body: { day: "2026-03-01", startMin: 60, endMin: 120, roomId: IDS.roomA },
  },
  {
    method: "POST",
    path: "/api/v1/contacts",
    requestPath: "/api/v1/contacts",
    body: {
      firstName: "New",
      lastName: "Contact",
      email: "new-contact@example.test",
      eventId: EVENT_A,
      sessionTitle: "A session",
    },
  },
  {
    method: "POST",
    path: "/api/v1/contacts/:id/add-to-event",
    requestPath: `/api/v1/contacts/${IDS.contactB}/add-to-event`,
    body: { eventId: EVENT_A, title: "A session" },
  },
  {
    method: "POST",
    path: "/api/v1/contacts/duplicates/dismiss",
    requestPath: "/api/v1/contacts/duplicates/dismiss",
    body: { contactIds: [IDS.contactB, IDS.contactA] },
  },
  {
    method: "POST",
    path: "/api/v1/contacts/import",
    requestPath: "/api/v1/contacts/import",
    body: {
      csvText: "firstName,lastName,email\nA,B,a-b@example.test\n",
      mapping: { firstName: "firstName", lastName: "lastName", email: "email" },
      eventId: EVENT_A,
      sessionTitle: "A session",
    },
  },
  {
    method: "POST",
    path: "/api/v1/contacts/merge",
    requestPath: "/api/v1/contacts/merge",
    body: { keepId: IDS.contactA, mergeIds: [IDS.contactB] },
  },
  {
    method: "POST",
    path: "/api/v1/pipeline",
    requestPath: "/api/v1/pipeline",
    body: { contactId: IDS.contactA },
  },
  {
    method: "POST",
    path: "/api/v1/events/:eventId/submissions",
    requestPath: `/api/v1/events/${EVENT_B}/submissions`,
    body: { title: "New submission", trackIds: [IDS.trackA] },
  },
  {
    method: "PATCH",
    path: "/api/v1/submissions/:id",
    requestPath: `/api/v1/submissions/${IDS.submissionB}`,
    body: { trackIds: [IDS.trackA] },
  },
  {
    method: "POST",
    path: "/api/v1/submissions/:id/participants",
    requestPath: `/api/v1/submissions/${IDS.submissionB}/participants`,
    body: { contactId: IDS.contactA },
  },
  {
    method: "POST",
    path: "/api/v1/events/:eventId/submissions/status",
    requestPath: `/api/v1/events/${EVENT_B}/submissions/status`,
    body: { ids: [IDS.submissionA], status: "pending" },
  },
  {
    method: "POST",
    path: "/api/v1/events/:eventId/submissions/content-status",
    requestPath: `/api/v1/events/${EVENT_B}/submissions/content-status`,
    body: { ids: [IDS.submissionA], contentStatus: "approved" },
  },
  {
    method: "POST",
    path: "/api/v1/submissions/:id/content-note",
    requestPath: `/api/v1/submissions/${IDS.submissionB}/content-note`,
    body: { fileId: IDS.fileA, body: "Please revise", requestChanges: false },
  },
  {
    method: "GET",
    path: "/api/v1/submissions/:id/evaluations",
    requestPath: `/api/v1/submissions/${IDS.submissionB}/evaluations`,
    query: { planId: IDS.planA },
  },
  {
    method: "POST",
    path: "/api/v1/plans/:id/reviewers",
    requestPath: `/api/v1/plans/${IDS.planB}/reviewers`,
    body: { userId: IDS.reviewerUserA },
  },
  {
    method: "GET",
    path: "/api/v1/plans/:id/scope-preview",
    requestPath: `/api/v1/plans/${IDS.planB}/scope-preview`,
    query: { trackId: IDS.trackA },
  },
  {
    method: "GET",
    path: "/api/v1/review/plans",
    requestPath: "/api/v1/review/plans",
    query: { eventId: EVENT_A },
  },
  {
    method: "GET",
    path: "/api/v1/review/submissions/:id",
    requestPath: `/api/v1/review/submissions/${IDS.submissionB}`,
    query: { planId: IDS.planA },
  },
  {
    method: "POST",
    path: "/api/v1/tasks/:id/assign",
    requestPath: `/api/v1/tasks/${IDS.taskB}/assign`,
    body: { contactIds: [IDS.contactA] },
  },
  // Joined the population in wave 59 (DEC-746 amendment made createTask
  // accept an optional contactIds subset, so the registration now reads a
  // body id). Path names org B's event; the body carries org A's real
  // contact, which filterRosterContactIds refuses before createTask runs.
  {
    method: "POST",
    path: "/api/v1/events/:eventId/tasks",
    requestPath: `/api/v1/events/${EVENT_B}/tasks`,
    body: {
      kind: "general",
      title: "A task",
      description: null,
      required: true,
      contactIds: [IDS.contactA],
    },
  },
  // Joined the population in wave 41 (DEC-027 wave-41 amendment gave the
  // email-log and evaluations export kinds their own surface's filter, so
  // this registration now reads ?contactId=/?planId=). Exercised on the
  // evaluations kind, the one matched key exportEvaluations actually
  // DEREFERENCES as an object reference.
  {
    method: "GET",
    path: "/api/v1/events/:eventId/export/:kind",
    requestPath: `/api/v1/events/${EVENT_B}/export/evaluations`,
    query: { planId: IDS.planA },
  },
];

// ---------------------------------------------------------------------------
// CROSS_ORG_BODY_LEDGER -- exact expected refusal status per (method, path),
// OR a one-line reason for a registration this probe determined never
// dereferences the matched key as an object reference (see file header).
// ---------------------------------------------------------------------------

type LedgerEntry =
  | { method: string; path: string; expectedStatus: 400 | 403 | 404 }
  | { method: string; path: string; reason: string };

const CROSS_ORG_BODY_LEDGER: LedgerEntry[] = [
  { method: "PUT", path: "/api/v1/submissions/:id/slot", expectedStatus: 400 },
  { method: "POST", path: "/api/v1/contacts", expectedStatus: 404 },
  { method: "POST", path: "/api/v1/contacts/:id/add-to-event", expectedStatus: 404 },
  { method: "POST", path: "/api/v1/contacts/duplicates/dismiss", expectedStatus: 404 },
  { method: "POST", path: "/api/v1/contacts/import", expectedStatus: 404 },
  { method: "POST", path: "/api/v1/contacts/merge", expectedStatus: 404 },
  {
    method: "GET",
    path: "/api/v1/events/:eventId/email-log",
    reason:
      "?contactId=/?batchId= are AND-combined narrowing filters over a query already scoped to the caller's own eventId -- a foreign value only narrows toward empty, never toward another org's rows (email-log.ts:36-52)",
  },
  { method: "POST", path: "/api/v1/pipeline", expectedStatus: 404 },
  { method: "POST", path: "/api/v1/events/:eventId/submissions", expectedStatus: 400 },
  { method: "PATCH", path: "/api/v1/submissions/:id", expectedStatus: 400 },
  { method: "POST", path: "/api/v1/submissions/:id/participants", expectedStatus: 400 },
  { method: "POST", path: "/api/v1/events/:eventId/submissions/status", expectedStatus: 400 },
  {
    method: "POST",
    path: "/api/v1/events/:eventId/submissions/delete",
    reason:
      "DEC-921 guarded cascade: an id planSubmissionDelete can't find in this event lands in the response's `refused` array, never `eligible` -- commitSubmissionDelete never touches it, so the 200 is a per-item refusal that mutates nothing, not a leak (submission-delete.ts:130-158)",
  },
  { method: "POST", path: "/api/v1/events/:eventId/submissions/content-status", expectedStatus: 400 },
  {
    method: "POST",
    path: "/api/v1/events/:eventId/compose/send",
    reason:
      "body.templateId is stored verbatim as an opaque email_log label (send.ts:95,145) -- never read back to resolve or render an email_template row, so there is nothing to dereference",
  },
  { method: "POST", path: "/api/v1/submissions/:id/content-note", expectedStatus: 400 },
  { method: "GET", path: "/api/v1/submissions/:id/evaluations", expectedStatus: 404 },
  { method: "POST", path: "/api/v1/plans/:id/reviewers", expectedStatus: 404 },
  { method: "GET", path: "/api/v1/plans/:id/scope-preview", expectedStatus: 400 },
  { method: "GET", path: "/api/v1/review/plans", expectedStatus: 404 },
  { method: "GET", path: "/api/v1/review/submissions/:id", expectedStatus: 404 },
  { method: "POST", path: "/api/v1/tasks/:id/assign", expectedStatus: 400 },
  { method: "POST", path: "/api/v1/events/:eventId/tasks", expectedStatus: 400 },
  {
    method: "POST",
    path: "/api/v1/events/:eventId/onboarding/remind",
    reason:
      "optional body.taskIds/body.contactIds are AND-combined narrowing filters over listRemindableContactIds/listOutstandingForEvent, already scoped to the caller's own eventId -- same shape as email-log's filters (reminders.ts:72-107,177-199)",
  },
  {
    method: "POST",
    path: "/api/v1/events/:eventId/onboarding/remind/preview",
    reason: "same narrowing-filter shape as its /remind sibling immediately above (reminders.ts:535-575)",
  },
  // wave 41: exportEvaluations resolves ?planId= against THIS event's plans
  // and throws ApiError('invalid') before any row query when it isn't one
  // (exports/evaluations.ts:135-144), so the foreign id is refused 400, not
  // silently narrowed to an empty CSV. (The email-log kind's ?contactId= on
  // the same registration is the narrowing-filter shape already ledgered for
  // GET /events/:eventId/email-log above; the stronger planId contract is
  // what this registration is exercised on.)
  { method: "GET", path: "/api/v1/events/:eventId/export/:kind", expectedStatus: 400 },
];

function ledgerKey(entry: { method: string; path: string }): string {
  return `${entry.method} ${entry.path}`;
}

describe("cross-org body/query-id probe (DEC-459 wave-40 amendment)", () => {
  it("enumerates at least the CROSS_ORG_BODY_LEDGER population (composition sanity, no vacuous pass)", () => {
    const routes = enumeratePopulation();
    expect(routes.length).toBeGreaterThan(0);
    expect(routes.length).toBeGreaterThanOrEqual(CROSS_ORG_BODY_LEDGER.length);
    expect(routes.map((r) => `${r.method} ${r.path}`)).toContain("POST /api/v1/plans/:id/reviewers");
  });

  it("ledger is exact in both directions against the derived population", () => {
    const routes = enumeratePopulation();
    const routeKeys = new Set(routes.map((r) => `${r.method} ${r.path}`));
    const ledgerKeys = new Set(CROSS_ORG_BODY_LEDGER.map(ledgerKey));

    const unledgered = routes.filter((r) => !ledgerKeys.has(`${r.method} ${r.path}`));
    expect(unledgered).toEqual([]);

    const stale = CROSS_ORG_BODY_LEDGER.filter((e) => !routeKeys.has(ledgerKey(e)));
    expect(stale).toEqual([]);
  });

  it("every exercised route refuses org B's organizer at 400/403/404 (never 2xx, never 5xx), org A's rows untouched", async () => {
    const { db, sqlite } = makeTestDb();
    seedFixture(sqlite);

    const before = snapshotAll(sqlite);
    const app = await buildActorApp(db);
    const failures: string[] = [];
    const exercisedKeys = new Set<string>();

    for (const testCase of CASES) {
      const entry = CROSS_ORG_BODY_LEDGER.find(
        (e): e is Extract<LedgerEntry, { expectedStatus: 400 | 403 | 404 }> =>
          "expectedStatus" in e && e.method === testCase.method && e.path === testCase.path,
      );
      if (!entry) {
        failures.push(`${testCase.method} ${testCase.path}: no expectedStatus ledger entry for this test case`);
        continue;
      }
      exercisedKeys.add(ledgerKey(entry));

      const headers: Record<string, string> = {};
      let body: string | undefined;
      if (testCase.method !== "GET" && testCase.method !== "HEAD") {
        headers["x-chq-csrf"] = "1";
        headers["content-type"] = "application/json";
        body = JSON.stringify(testCase.body ?? {});
      }
      const search = testCase.query ? `?${new URLSearchParams(testCase.query).toString()}` : "";
      const res = await app.request(
        testCase.requestPath + search,
        { method: testCase.method, headers, body },
        {} as unknown as AppEnv["Bindings"],
      );

      if (res.status !== entry.expectedStatus) {
        const shape =
          res.status >= 200 && res.status < 300
            ? "a 2xx on a foreign-org id is a cross-tenant IDOR hole"
            : res.status >= 500
              ? "a 5xx is not a refusal"
              : "refusal status drifted from the ledgered contract";
        failures.push(
          `${testCase.method} ${testCase.path}: status=${res.status}, expected ${entry.expectedStatus} -- ${shape}`,
        );
      }
    }

    expect(failures).toEqual([]);

    // Every expectedStatus ledger entry must have a covering CASES test case
    // (the reason-carrying entries are deliberately not exercised).
    const expectedStatusKeys = new Set(
      CROSS_ORG_BODY_LEDGER.filter((e): e is Extract<LedgerEntry, { expectedStatus: 400 | 403 | 404 }> => "expectedStatus" in e).map(
        ledgerKey,
      ),
    );
    const missingCases = [...expectedStatusKeys].filter((k) => !exercisedKeys.has(k));
    expect(missingCases).toEqual([]);

    const after = snapshotAll(sqlite);
    expect(after).toBe(before);

    sqlite.close();
  });
});
