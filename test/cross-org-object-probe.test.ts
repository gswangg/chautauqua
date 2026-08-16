// DEC-459/DEC-727 (task-w37-b): the enumerated wrong-ORG twin for the
// ENTITY-ROOTED /api/v1 by-id population. Three sibling probes already
// enumerate whole route populations over the composed app's own route
// table -- test/anonymous-route-probe.test.ts (anonymous GET),
// test/role-refusal-probe.test.ts (wrong ROLE), test/portal-idor-probe.test.ts
// (same-role wrong-OWNER over /portal, mocked resolvers) -- but none drives
// an organizer of a DIFFERENT org against another org's REAL rows over
// every /api/v1 entity-rooted by-id route (field guide w37, OPEN item: "the
// TENANT axis is SPOT-CHECKED, NEVER ENUMERATED"). This file closes that gap
// for the population src/db/schema's own entity tables define: every
// registration whose path matches
// /^\/api\/v1\/(?!events\/)[a-z-]+\/:[A-Za-z]+/ -- i.e. every route one
// segment below /api/v1 (not /events/...) immediately followed by a :param.
// Byte-streaming routes (file/headshot GET download bodies) are OUT of
// scope here -- see EXCLUDED_BYTE_ROUTES below, covered by its sibling
// test/cross-org-file-bytes-probe.test.ts (task-w37-d) instead, so the
// two-directional ledger stays honest rather than silently short.
//
// Technique (deliberately duplicated from test/role-refusal-probe.test.ts
// and test/portal-idor-probe.test.ts, per DEC-459 rule 4 -- three
// independently-reproduced compositions are cheaper to keep correct than
// one shared helper all three could accidentally weaken together):
// parseIndexMounts() + registerErrorHandler composition, enumerateRegistered
// Routes() (test/helpers/registered-routes.ts) to derive the population
// from source (not hand-listed), and a REAL in-memory SQLite engine
// (node:sqlite DatabaseSync + drizzle-orm/sqlite-proxy) migrated through
// every concatenated migrations/*.sql file, built the same way
// test/rate-limit-atomicity.test.ts:19-64 does it -- a mocked resolver only
// proves the route calls it, not that it filters (field guide w37 shape),
// so this probe needs real rows an attacker-controlled org id could
// actually retrieve if a filter were missing.
//
// Fixture: org A holds exactly one row per entity family the population
// needs (event -> track, room, contact, submission, participant, task,
// task_assignment, file, plan (+ plan_reviewer), break, saved embed,
// resource, template, segment, saved view, form + field, user, api token,
// pipeline entry, submission revision). Org B holds one organizer user, the
// actor for every request. Every :param this probe requests names a REAL
// object that exists -- it just belongs to org A, not the caller's org B.
// Every mutating method carries x-chq-csrf: 1 (same technique as the
// sibling probes) so CSRF is never what refuses the request.
//
// CROSS_ORG_LEDGER is asserted exact in both directions (same discipline as
// PUBLIC_BY_DESIGN/ROLE_REACHABLE/REFUSAL_LEDGER): every enumerated route in
// the population must have exactly one ledger entry naming its expected
// refusal status (403 or 404 only -- SPEC §6 forbids both a 2xx leak and a
// 500 masquerading as a refusal), and every ledger entry must still match a
// live registration. Org A's rows are snapshotted before and after the full
// sweep and asserted byte-identical -- a "refusal" that still mutated the
// victim's data is not a refusal (field guide w36-w37 shape).
//
// An enumeration floor (expect(...).toBeGreaterThanOrEqual(CROSS_ORG_LEDGER.length))
// keeps this from passing vacuously if the route table were silently
// narrowed.
//
// Findings from building this probe (wave 37): no route-file change -- every
// enumerated route in this population already refuses org B's organizer at
// an existing check, before any write: most families resolve the entity
// through an org-scoped query (getEventForOrg/find*ForOrg-style, wrong org
// returns null -> 404 -- this is the shape for contacts, fields, forms,
// pipeline, plans (+ every nested plan route), segments, tasks/delete-
// preview's ownership pre-check being the exception noted below, templates,
// tokens, tracks, rooms, resources, users, views' ownership pre-check); a
// second family loads the row first (it DOES exist) and then explicitly
// compares scope.orgId to auth.orgId, refusing 403 (breaks, embeds, files/
// file-comments, submissions and everything nested under it, task-
// assignments, views' organizer-authorship gate). (Every family was
// verified against its own route source before this probe was written:
// src/routes/api/breaks.ts, contacts/crud.ts, embeds.ts, forms.ts,
// pipeline.ts, tokens.ts, users.ts, views.ts, src/routes/comms.ts,
// src/routes/content-notes.ts, src/routes/agenda.ts, src/routes/files.ts,
// src/routes/tasks.ts, src/routes/api/submissions.ts, src/routes/api/
// events.ts (tracks/rooms), src/routes/api/portal-config.ts (resources),
// src/routes/api/contacts/segments.ts, src/routes/review/shared.ts +
// plans-progress.ts + plans-distribute.ts + evaluations.ts +
// plans-reviewers.ts.)
//
// One probe-shape note, not a route bug: PATCH /api/v1/users/:id validates
// its required `role` body field BEFORE its org-ownership lookup, so this
// probe's literal wrong-org request needs a validly-shaped body ({role:
// "reviewer"}) to actually reach and exercise that lookup -- an empty body
// 400s on the precondition first (same shape as role-refusal-probe's GET
// /review/submissions/:id planId finding, wave 32). See the body-injection
// comment at this file's request-building call site.

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
// Population regex -- every entity-rooted /api/v1 by-id route, events/*
// excluded (that's a different, event-rooted population; its own org-scope
// check is exercised elsewhere, e.g. the events/:eventId family).
// ---------------------------------------------------------------------------

const ENTITY_ROOT_PARAM_RE = /^\/api\/v1\/(?!events\/)[a-z-]+\/:[A-Za-z]+/;

// Byte-streaming routes this population regex would otherwise match, but
// which are OUT of scope here -- ledgered by name, not silently dropped, so
// the two-directional accounting stays honest. Covered instead by
// test/cross-org-file-bytes-probe.test.ts (task-w37-d).
const EXCLUDED_BYTE_ROUTES = new Set<string>([
  // No entity-rooted (non-/events/) byte-streaming registration currently
  // matches ENTITY_ROOT_PARAM_RE -- GET /files/:fileId (byte body) is
  // root-mounted at "/", not "/api/v1", and headshot serving is
  // "/headshots/:fileId", also root-mounted. Nothing to exclude today; this
  // set exists so a future byte route added under this population's shape
  // has a named place to land without silently expanding either probe's
  // scope. See test/cross-org-file-bytes-probe.test.ts's own header for the
  // routes it actually owns.
]);

// ---------------------------------------------------------------------------
// Real SQLite engine, migrated through every migrations/*.sql file (same
// technique as test/rate-limit-atomicity.test.ts:19-64 / test/file-replace-versions.test.ts).
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
// Fixture -- org A holds one row per entity family; org B holds the actor.
// ---------------------------------------------------------------------------

const ORG_A = "cross-org-a";
const ORG_B = "cross-org-b";
const EVENT_A = "cross-org-event-a";

const IDS = {
  trackA: "cross-org-track-a",
  roomA: "cross-org-room-a",
  contactA: "cross-org-contact-a",
  formA: "cross-org-form-a",
  fieldA: "cross-org-field-a",
  submissionA: "cross-org-submission-a",
  participantA: "cross-org-participant-a",
  revisionA: "cross-org-revision-a",
  taskA: "cross-org-task-a",
  assignmentA: "cross-org-assignment-a",
  fileA: "cross-org-file-a",
  planA: "cross-org-plan-a",
  reviewerRowA: "cross-org-plan-reviewer-a",
  reviewerUserA: "cross-org-reviewer-user-a",
  breakA: "cross-org-break-a",
  embedA: "cross-org-embed-a",
  resourceA: "cross-org-resource-a",
  templateA: "cross-org-template-a",
  segmentA: "cross-org-segment-a",
  viewA: "cross-org-view-a",
  organizerUserA: "cross-org-organizer-user-a",
  tokenA: "cross-org-token-a",
  pipelineEntryA: "cross-org-pipeline-entry-a",
};

const ORGANIZER_B: AuthInfo = { userId: "cross-org-organizer-b", role: "organizer", orgId: ORG_B };

function seedFixture(sqlite: DatabaseSync) {
  const now = Date.now();
  const run = (sql: string, ...params: (string | number)[]) => sqlite.prepare(sql).run(...params);

  run(`insert into org (id, name, created_at, updated_at) values (?, 'Org A', ?, ?)`, ORG_A, now, now);
  run(`insert into org (id, name, created_at, updated_at) values (?, 'Org B', ?, ?)`, ORG_B, now, now);
  run(
    `insert into event (id, org_id, name, slug, start_date, end_date, timezone, created_at, updated_at)
     values (?, ?, 'Event A', 'cross-org-event-a', '2026-03-01', '2026-03-02', 'America/New_York', ?, ?)`,
    EVENT_A,
    ORG_A,
    now,
    now,
  );

  run(
    `insert into user (id, org_id, email, password_hash, role, created_at, updated_at) values (?, ?, 'organizer-a@example.test', 'x', 'organizer', ?, ?)`,
    IDS.organizerUserA,
    ORG_A,
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
    `insert into schedule_break (id, event_id, day, label, start_min, duration_min, created_at, updated_at) values (?, ?, '2026-03-01', 'Lunch', 600, 60, ?, ?)`,
    IDS.breakA,
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
    `insert into form_field (id, form_id, section, kind, label, required, position, locked, created_at, updated_at)
     values (?, ?, 'session', 'text', 'Custom field', 0, 0, 0, ?, ?)`,
    IDS.fieldA,
    IDS.formA,
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
    `insert into submission_revision (id, submission_id, editor_name, title, created_at)
     values (?, ?, 'Editor A', 'Talk A', ?)`,
    IDS.revisionA,
    IDS.submissionA,
    now,
  );
  run(
    `insert into file (id, submission_id, kind, filename, r2_key, size_bytes, content_type, uploaded_by_contact_id, created_at, updated_at)
     values (?, ?, 'presentation', 'slides.pdf', 'cross-org/slides.pdf', 100, 'application/pdf', ?, ?, ?)`,
    IDS.fileA,
    IDS.submissionA,
    IDS.contactA,
    now,
    now,
  );

  run(
    `insert into task (id, event_id, kind, title, required, created_at, updated_at) values (?, ?, 'general', 'Task A', 0, ?, ?)`,
    IDS.taskA,
    EVENT_A,
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
    `insert into evaluation_plan (id, event_id, name, scale_json, criteria_json, rounds, current_round, created_at, updated_at)
     values (?, ?, 'Plan A', '{"min":1,"max":5}', '[]', 1, 1, ?, ?)`,
    IDS.planA,
    EVENT_A,
    now,
    now,
  );
  run(
    `insert into plan_reviewer (id, plan_id, user_id, created_at, updated_at) values (?, ?, ?, ?, ?)`,
    IDS.reviewerRowA,
    IDS.planA,
    IDS.reviewerUserA,
    now,
    now,
  );

  run(
    `insert into embed (id, org_id, event_id, name, surface, format, options_json, created_at, updated_at)
     values (?, ?, ?, 'Embed A', 'sessions', 'iframe', '{}', ?, ?)`,
    IDS.embedA,
    ORG_A,
    EVENT_A,
    now,
    now,
  );
  run(
    `insert into resource (id, event_id, kind, title, position, created_at, updated_at) values (?, ?, 'wiki', 'Resource A', 0, ?, ?)`,
    IDS.resourceA,
    EVENT_A,
    now,
    now,
  );
  run(
    `insert into email_template (id, event_id, name, subject, body_text, created_at, updated_at)
     values (?, ?, 'Template A', 'Subject A', 'Body A', ?, ?)`,
    IDS.templateA,
    EVENT_A,
    now,
    now,
  );
  run(
    `insert into segment (id, org_id, name, rules_json, created_at, updated_at) values (?, ?, 'Segment A', '[]', ?, ?)`,
    IDS.segmentA,
    ORG_A,
    now,
    now,
  );
  run(
    `insert into saved_view (id, event_id, name, config_json, shared, created_at, updated_at) values (?, ?, 'View A', '{}', 1, ?, ?)`,
    IDS.viewA,
    EVENT_A,
    now,
    now,
  );
  run(
    `insert into api_token (id, org_id, name, token_hash, token_prefix, created_by_user_id, created_at, updated_at)
     values (?, ?, 'Token A', 'hash-a', 'chq_aaaaaaaa', ?, ?, ?)`,
    IDS.tokenA,
    ORG_A,
    IDS.organizerUserA,
    now,
    now,
  );
  run(
    `insert into pipeline_entry (id, org_id, contact_id, stage, created_at, updated_at) values (?, ?, ?, 'identified', ?, ?)`,
    IDS.pipelineEntryA,
    ORG_A,
    IDS.contactA,
    now,
    now,
  );
}

// Table -> id column, for the byte-identical-before/after snapshot.
const SNAPSHOT_TABLES: { table: string; idCol: string }[] = [
  { table: "org", idCol: "id" },
  { table: "event", idCol: "id" },
  { table: "user", idCol: "id" },
  { table: "contact", idCol: "id" },
  { table: "track", idCol: "id" },
  { table: "room", idCol: "id" },
  { table: "schedule_break", idCol: "id" },
  { table: "form", idCol: "id" },
  { table: "form_field", idCol: "id" },
  { table: "submission", idCol: "id" },
  { table: "participant", idCol: "id" },
  { table: "submission_revision", idCol: "id" },
  { table: "file", idCol: "id" },
  { table: "task", idCol: "id" },
  { table: "task_assignment", idCol: "id" },
  { table: "evaluation_plan", idCol: "id" },
  { table: "plan_reviewer", idCol: "id" },
  { table: "embed", idCol: "id" },
  { table: "resource", idCol: "id" },
  { table: "email_template", idCol: "id" },
  { table: "segment", idCol: "id" },
  { table: "saved_view", idCol: "id" },
  { table: "api_token", idCol: "id" },
  { table: "pipeline_entry", idCol: "id" },
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
// App composition -- same technique as role-refusal-probe/portal-idor-probe:
// a bare Hono<AppEnv> + registerErrorHandler + one middleware stamping the
// real db and a fixed AuthInfo, then every mount from parseIndexMounts().
// ---------------------------------------------------------------------------

async function buildActorApp(db: Db) {
  const app = new Hono<AppEnv>();
  app.use("*", async (c, next) => {
    c.set("db", db);
    c.set("auth", ORGANIZER_B);
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

function makeThrowingFiles(): R2Bucket {
  return new Proxy(
    {},
    {
      get(_target, prop) {
        throw new Error(`cross-org-object-probe: FILES.${String(prop)} accessed`);
      },
    },
  ) as unknown as R2Bucket;
}

// ---------------------------------------------------------------------------
// Route table enumeration (source-derived) restricted to the population
// regex, byte routes excluded.
// ---------------------------------------------------------------------------

function enumeratePopulation(): { method: string; path: string }[] {
  const seen = new Set<string>();
  const routes: { method: string; path: string }[] = [];
  for (const r of enumerateRegisteredRoutes()) {
    if (!ENTITY_ROOT_PARAM_RE.test(r.path)) continue;
    if (EXCLUDED_BYTE_ROUTES.has(`${r.method} ${r.path}`)) continue;
    const key = `${r.method} ${r.path}`;
    if (seen.has(key)) continue;
    seen.add(key);
    routes.push({ method: r.method, path: r.path });
  }
  routes.sort((a, b) => (a.path + a.method).localeCompare(b.path + b.method));
  return routes;
}

// Per-path param -> org-A fixture id. Keyed by the FULL registered path (not
// just the param name) because ":id" means a different entity depending on
// which route it appears on.
const PARAMS_BY_PATH: Record<string, Record<string, string>> = {
  "/api/v1/breaks/:id": { id: IDS.breakA },
  "/api/v1/contacts/:id": { id: IDS.contactA },
  "/api/v1/contacts/:id/add-to-event": { id: IDS.contactA },
  "/api/v1/contacts/:id/headshot": { id: IDS.contactA },
  "/api/v1/embeds/:id": { id: IDS.embedA },
  "/api/v1/fields/:fieldId": { fieldId: IDS.fieldA },
  "/api/v1/files/:fileId": { fileId: IDS.fileA },
  "/api/v1/files/:fileId/comments": { fileId: IDS.fileA },
  "/api/v1/forms/:formId": { formId: IDS.formA },
  "/api/v1/forms/:formId/fields": { formId: IDS.formA },
  "/api/v1/forms/:formId/fields/reorder": { formId: IDS.formA },
  "/api/v1/pipeline/:id": { id: IDS.pipelineEntryA },
  "/api/v1/pipeline/:id/notes": { id: IDS.pipelineEntryA },
  "/api/v1/plans/:id": { id: IDS.planA },
  "/api/v1/plans/:id/reviewers": { id: IDS.planA },
  "/api/v1/plans/:id/reviewers/:reviewerId": { id: IDS.planA, reviewerId: IDS.reviewerRowA },
  "/api/v1/plans/:id/assignments/distribute/preview": { id: IDS.planA },
  "/api/v1/plans/:id/assignments/distribute": { id: IDS.planA },
  "/api/v1/plans/:id/delete-preview": { id: IDS.planA },
  "/api/v1/plans/:id/progress": { id: IDS.planA },
  "/api/v1/plans/:id/results": { id: IDS.planA },
  "/api/v1/plans/:id/scope-preview": { id: IDS.planA },
  "/api/v1/plans/:id/advance-round": { id: IDS.planA },
  "/api/v1/plans/:id/remind": { id: IDS.planA },
  "/api/v1/plans/:id/waves": { id: IDS.planA },
  "/api/v1/resources/:resourceId": { resourceId: IDS.resourceA },
  "/api/v1/rooms/:roomId": { roomId: IDS.roomA },
  "/api/v1/segments/:id": { id: IDS.segmentA },
  "/api/v1/submissions/:id": { id: IDS.submissionA },
  "/api/v1/submissions/:id/slot": { id: IDS.submissionA },
  "/api/v1/submissions/:id/evaluations": { id: IDS.submissionA },
  "/api/v1/submissions/:id/files": { id: IDS.submissionA },
  "/api/v1/submissions/:id/history": { id: IDS.submissionA },
  "/api/v1/submissions/:id/revisions": { id: IDS.submissionA },
  "/api/v1/submissions/:id/revisions/:revisionId/restore": { id: IDS.submissionA, revisionId: IDS.revisionA },
  "/api/v1/submissions/:id/clone": { id: IDS.submissionA },
  "/api/v1/submissions/:id/content-note": { id: IDS.submissionA },
  "/api/v1/submissions/:id/content-status": { id: IDS.submissionA },
  "/api/v1/submissions/:id/participants": { id: IDS.submissionA },
  "/api/v1/submissions/:id/participants/:participantId": { id: IDS.submissionA, participantId: IDS.participantA },
  "/api/v1/task-assignments/:id": { id: IDS.assignmentA },
  "/api/v1/task-assignments/:id/response": { id: IDS.assignmentA },
  "/api/v1/tasks/:id": { id: IDS.taskA },
  "/api/v1/tasks/:id/delete-preview": { id: IDS.taskA },
  "/api/v1/tasks/:id/assign": { id: IDS.taskA },
  "/api/v1/templates/:templateId": { templateId: IDS.templateA },
  "/api/v1/tokens/:id": { id: IDS.tokenA },
  "/api/v1/tracks/:trackId": { trackId: IDS.trackA },
  "/api/v1/users/:id": { id: IDS.organizerUserA },
  "/api/v1/users/:id/reset-password": { id: IDS.organizerUserA },
  "/api/v1/views/:id": { id: IDS.viewA },
};

function toRequestPath(routePath: string): string {
  const params = PARAMS_BY_PATH[routePath];
  if (!params) {
    throw new Error(`cross-org-object-probe: no PARAMS_BY_PATH entry for ${routePath} -- add one before probing it`);
  }
  return routePath
    .split("/")
    .map((segment) => {
      if (!segment.startsWith(":")) return segment;
      const name = segment.slice(1);
      const value = params[name];
      if (!value) {
        throw new Error(`cross-org-object-probe: PARAMS_BY_PATH[${routePath}] has no value for param "${name}"`);
      }
      return value;
    })
    .join("/");
}

// ---------------------------------------------------------------------------
// CROSS_ORG_LEDGER -- exact expected refusal status per (method, path).
// Verified against each route family's own source (see file header finding
// note) before being listed here.
// ---------------------------------------------------------------------------

interface LedgerEntry {
  method: string;
  path: string;
  expectedStatus: 403 | 404;
}

const CROSS_ORG_LEDGER: LedgerEntry[] = [
  { method: "DELETE", path: "/api/v1/breaks/:id", expectedStatus: 404 },
  { method: "PATCH", path: "/api/v1/breaks/:id", expectedStatus: 404 },
  { method: "DELETE", path: "/api/v1/contacts/:id", expectedStatus: 404 },
  { method: "GET", path: "/api/v1/contacts/:id", expectedStatus: 404 },
  { method: "PATCH", path: "/api/v1/contacts/:id", expectedStatus: 404 },
  { method: "POST", path: "/api/v1/contacts/:id/add-to-event", expectedStatus: 404 },
  { method: "POST", path: "/api/v1/contacts/:id/headshot", expectedStatus: 404 },
  { method: "DELETE", path: "/api/v1/embeds/:id", expectedStatus: 404 },
  { method: "PATCH", path: "/api/v1/embeds/:id", expectedStatus: 404 },
  { method: "DELETE", path: "/api/v1/fields/:fieldId", expectedStatus: 404 },
  { method: "PATCH", path: "/api/v1/fields/:fieldId", expectedStatus: 404 },
  { method: "DELETE", path: "/api/v1/files/:fileId", expectedStatus: 404 },
  { method: "GET", path: "/api/v1/files/:fileId/comments", expectedStatus: 403 },
  { method: "POST", path: "/api/v1/files/:fileId/comments", expectedStatus: 403 },
  { method: "PATCH", path: "/api/v1/forms/:formId", expectedStatus: 404 },
  { method: "POST", path: "/api/v1/forms/:formId/fields", expectedStatus: 404 },
  { method: "POST", path: "/api/v1/forms/:formId/fields/reorder", expectedStatus: 404 },
  { method: "GET", path: "/api/v1/pipeline/:id", expectedStatus: 404 },
  { method: "PATCH", path: "/api/v1/pipeline/:id", expectedStatus: 404 },
  { method: "POST", path: "/api/v1/pipeline/:id/notes", expectedStatus: 404 },
  { method: "DELETE", path: "/api/v1/plans/:id", expectedStatus: 404 },
  { method: "GET", path: "/api/v1/plans/:id", expectedStatus: 404 },
  { method: "PATCH", path: "/api/v1/plans/:id", expectedStatus: 404 },
  { method: "GET", path: "/api/v1/plans/:id/reviewers", expectedStatus: 404 },
  { method: "POST", path: "/api/v1/plans/:id/reviewers", expectedStatus: 404 },
  { method: "DELETE", path: "/api/v1/plans/:id/reviewers/:reviewerId", expectedStatus: 404 },
  { method: "GET", path: "/api/v1/plans/:id/assignments/distribute/preview", expectedStatus: 404 },
  { method: "POST", path: "/api/v1/plans/:id/assignments/distribute", expectedStatus: 404 },
  { method: "GET", path: "/api/v1/plans/:id/delete-preview", expectedStatus: 404 },
  { method: "GET", path: "/api/v1/plans/:id/progress", expectedStatus: 404 },
  { method: "GET", path: "/api/v1/plans/:id/results", expectedStatus: 404 },
  { method: "GET", path: "/api/v1/plans/:id/scope-preview", expectedStatus: 404 },
  { method: "POST", path: "/api/v1/plans/:id/advance-round", expectedStatus: 404 },
  { method: "POST", path: "/api/v1/plans/:id/remind", expectedStatus: 404 },
  { method: "POST", path: "/api/v1/plans/:id/waves", expectedStatus: 404 },
  { method: "DELETE", path: "/api/v1/resources/:resourceId", expectedStatus: 404 },
  { method: "PATCH", path: "/api/v1/resources/:resourceId", expectedStatus: 404 },
  { method: "DELETE", path: "/api/v1/rooms/:roomId", expectedStatus: 404 },
  { method: "PATCH", path: "/api/v1/rooms/:roomId", expectedStatus: 404 },
  { method: "DELETE", path: "/api/v1/segments/:id", expectedStatus: 404 },
  { method: "PATCH", path: "/api/v1/segments/:id", expectedStatus: 404 },
  { method: "GET", path: "/api/v1/submissions/:id", expectedStatus: 404 },
  { method: "PATCH", path: "/api/v1/submissions/:id", expectedStatus: 404 },
  { method: "DELETE", path: "/api/v1/submissions/:id/slot", expectedStatus: 404 },
  { method: "PUT", path: "/api/v1/submissions/:id/slot", expectedStatus: 404 },
  { method: "GET", path: "/api/v1/submissions/:id/evaluations", expectedStatus: 404 },
  { method: "GET", path: "/api/v1/submissions/:id/files", expectedStatus: 404 },
  { method: "POST", path: "/api/v1/submissions/:id/files", expectedStatus: 404 },
  { method: "GET", path: "/api/v1/submissions/:id/history", expectedStatus: 404 },
  { method: "GET", path: "/api/v1/submissions/:id/revisions", expectedStatus: 404 },
  { method: "POST", path: "/api/v1/submissions/:id/revisions/:revisionId/restore", expectedStatus: 404 },
  { method: "POST", path: "/api/v1/submissions/:id/clone", expectedStatus: 404 },
  { method: "POST", path: "/api/v1/submissions/:id/content-note", expectedStatus: 404 },
  { method: "POST", path: "/api/v1/submissions/:id/content-status", expectedStatus: 404 },
  { method: "POST", path: "/api/v1/submissions/:id/participants", expectedStatus: 404 },
  { method: "DELETE", path: "/api/v1/submissions/:id/participants/:participantId", expectedStatus: 404 },
  { method: "PATCH", path: "/api/v1/submissions/:id/participants/:participantId", expectedStatus: 404 },
  { method: "PATCH", path: "/api/v1/task-assignments/:id", expectedStatus: 403 },
  { method: "GET", path: "/api/v1/task-assignments/:id/response", expectedStatus: 404 },
  { method: "DELETE", path: "/api/v1/tasks/:id", expectedStatus: 404 },
  { method: "PATCH", path: "/api/v1/tasks/:id", expectedStatus: 404 },
  { method: "GET", path: "/api/v1/tasks/:id/delete-preview", expectedStatus: 404 },
  { method: "POST", path: "/api/v1/tasks/:id/assign", expectedStatus: 404 },
  { method: "DELETE", path: "/api/v1/templates/:templateId", expectedStatus: 404 },
  { method: "PATCH", path: "/api/v1/templates/:templateId", expectedStatus: 404 },
  { method: "DELETE", path: "/api/v1/tokens/:id", expectedStatus: 404 },
  { method: "DELETE", path: "/api/v1/tracks/:trackId", expectedStatus: 404 },
  { method: "PATCH", path: "/api/v1/tracks/:trackId", expectedStatus: 404 },
  { method: "PATCH", path: "/api/v1/users/:id", expectedStatus: 404 },
  { method: "POST", path: "/api/v1/users/:id/reset-password", expectedStatus: 404 },
  { method: "DELETE", path: "/api/v1/views/:id", expectedStatus: 404 },
];

function ledgerKey(entry: { method: string; path: string }): string {
  return `${entry.method} ${entry.path}`;
}

describe("cross-org object-rooted by-id probe (DEC-459/DEC-727, task-w37-b)", () => {
  it("enumerates at least the CROSS_ORG_LEDGER population (composition sanity, no vacuous pass)", () => {
    const routes = enumeratePopulation();
    expect(routes.length).toBeGreaterThanOrEqual(CROSS_ORG_LEDGER.length);
    expect(routes.map((r) => `${r.method} ${r.path}`)).toContain("GET /api/v1/submissions/:id");
  });

  it("every enumerated route refuses org B's organizer at 403 or 404 (never 2xx, never 5xx), org A's rows untouched, ledger exact both directions", async () => {
    const { db, sqlite } = makeTestDb();
    seedFixture(sqlite);

    const before = snapshotAll(sqlite);
    const app = await buildActorApp(db);
    const routes = enumeratePopulation();
    const matchedLedgerKeys = new Set<string>();
    const failures: string[] = [];

    for (const { method, path } of routes) {
      const entry = CROSS_ORG_LEDGER.find((e) => e.method === method && e.path === path);
      if (!entry) {
        failures.push(`${method} ${path}: not in CROSS_ORG_LEDGER -- a new route shipped unprobed`);
        continue;
      }
      matchedLedgerKeys.add(ledgerKey(entry));

      const requestPath = toRequestPath(path);
      const headers: Record<string, string> = {};
      let body: string | undefined;
      if (method !== "GET" && method !== "HEAD") {
        headers["x-chq-csrf"] = "1";
        // PATCH /api/v1/users/:id reads+validates a required `role` field
        // BEFORE its org-ownership lookup -- an empty body 400s there
        // without ever reaching the check this probe exists to exercise.
        // A real, validly-shaped body lets the request reach that check, so
        // the probe proves the ownership refusal itself rather than a body-
        // shape precondition (same reasoning as role-refusal-probe's
        // GET /review/submissions/:id planId finding).
        if (method === "PATCH" && path === "/api/v1/users/:id") {
          headers["content-type"] = "application/json";
          body = JSON.stringify({ role: "reviewer" });
        }
      }

      const res = await app.request(requestPath, { method, headers, body }, {} as unknown as AppEnv["Bindings"]);

      if (res.status !== entry.expectedStatus) {
        const shape =
          res.status >= 200 && res.status < 300
            ? "a 2xx on a foreign-org id is a cross-tenant IDOR hole"
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

    const staleEntries = CROSS_ORG_LEDGER.filter((e) => !matchedLedgerKeys.has(ledgerKey(e))).map(ledgerKey);
    expect(staleEntries).toEqual([]);

    sqlite.close();
  });
});
