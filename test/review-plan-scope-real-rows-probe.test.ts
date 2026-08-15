// DEC-459 (wave-42 amendment): the SAME-ORG wrong-plan / out-of-scope axis
// for the REVIEWER actor. test/cross-org-reviewer-probe.test.ts proves the
// cross-ORG refusal with real rows; test/review-idor.test.ts proves the
// guards are CALLED with MOCKED resolvers. Neither exercises the realistic
// attacker at SPEC's scale (10-50 reviewers on ONE event): a genuine
// reviewer of the same org reaching another plan of the same event, or a
// track-/submission-scoped reviewer reaching a submission outside their own
// scope inside a plan they ARE assigned to. This file drives real rows
// against requireAssignedPlan (src/routes/review/shared.ts) and
// isSubmissionInReviewerScope (src/routes/review/submissions.ts, used at
// src/routes/review/reviewer.ts:254/331 and recusals.ts:29/56).
//
// Technique, deliberately duplicated (DEC-459 rule 4: no shared helper
// across sibling probes) from test/cross-org-reviewer-probe.test.ts: same
// parseIndexMounts() + registerErrorHandler composition, REAL in-memory
// SQLite engine via node:sqlite + drizzle-orm/sqlite-proxy over hand-written
// DDL mirroring the review/event/submission/track/org/user migrations
// (fast tier by construction -- DEC-727's wave-37 amendment).
//
// Fixture: ONE org, ONE event, TWO plans (A and B), THREE submissions --
// S1 (track T1), S2 (track T2), S3 (no track). Reviewer R is assigned to
// plan A ONLY, exercised across three separate scope shapes in the same
// file: (i) plan-wide (trackId null, submissionId null), (ii) track-scoped
// to T1, (iii) submission-scoped to S1. A second reviewer holds plan B
// unrestricted so plan B is genuinely live (not an empty decoy).
//
// Finding from building this probe: none -- every route already scopes
// through requireAssignedPlan (which resolves ONLY the reviewer's own
// assigned-plan-id set via repo.listPlanIdsForReviewer and 404s a plan
// outside it before any further read) and isSubmissionInReviewerScope
// (which loads only this (plan,user)'s plan_reviewer rows and, for the
// track-scoped and submission-scoped variants, refuses a submission
// outside that scope even though it shares the plan and event). No
// src/routes/review/** or src/server/repo/review/** change was required.

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { drizzle } from "drizzle-orm/sqlite-proxy";
import { Hono } from "hono";
import { eq } from "drizzle-orm";
import * as schema from "../src/db/schema";
import type { Db } from "../src/server/context";
import type { AppEnv, AuthInfo } from "../src/server/env";
import { registerErrorHandler } from "../src/server/http";
import { guardDevMailbox } from "../src/server/app";
import { parseIndexMounts } from "./helpers/index-mounts";
import { enumerateRegisteredRoutes } from "./helpers/registered-routes";

// ---------------------------------------------------------------------------
// Real in-memory SQLite engine, same technique/DDL shape as
// test/cross-org-reviewer-probe.test.ts, extended with the `track` table
// this fixture needs for its track-scoped variant.
// ---------------------------------------------------------------------------

const DDL = `
create table org (
  id text primary key,
  name text,
  created_at integer,
  updated_at integer
);
create table user (
  id text primary key,
  org_id text,
  email text,
  password_hash text,
  role text,
  name text,
  contact_id text,
  created_at integer,
  updated_at integer
);
create table event (
  id text primary key,
  org_id text,
  name text,
  slug text,
  start_date text,
  end_date text,
  location text,
  timezone text,
  record_prefix text,
  branding_json text,
  created_at integer,
  updated_at integer
);
create table track (
  id text primary key,
  event_id text,
  name text,
  color text,
  position integer,
  external_ref text,
  created_at integer,
  updated_at integer
);
create table submission (
  id text primary key,
  event_id text,
  form_id text,
  seq integer,
  title text,
  description text,
  track_id text,
  additional_track_ids_json text,
  status text,
  content_status text,
  accepted_at integer,
  ics_sequence integer,
  external_ref text,
  created_at integer,
  updated_at integer
);
create table submission_track (
  submission_id text,
  track_id text,
  created_at integer
);
create table contact (
  id text primary key,
  org_id text,
  first_name text,
  last_name text,
  email text,
  phone text,
  company text,
  title text,
  bio text,
  headshot_url text,
  headshot_file_id text,
  social_links_json text,
  notes text,
  custom_fields_json text,
  external_ref text,
  created_at integer,
  updated_at integer
);
create table participant (
  id text primary key,
  submission_id text,
  contact_id text,
  role text,
  "order" integer,
  visible integer,
  invite_status text,
  title_at_time text,
  org_at_time text,
  name_at_time text,
  created_at integer,
  updated_at integer
);
create table form_field (
  id text primary key,
  form_id text,
  section text,
  kind text,
  label text,
  help_text text,
  required integer,
  position integer,
  options_json text,
  rule_json text,
  locked integer,
  role text,
  created_at integer,
  updated_at integer
);
create table submission_answer (
  id text primary key,
  submission_id text,
  form_field_id text,
  value_json text,
  created_at integer,
  updated_at integer
);
create table evaluation_plan (
  id text primary key,
  event_id text,
  name text,
  instructions text,
  open_date integer,
  close_date integer,
  filters_json text,
  anonymized integer,
  anonymized_at integer,
  scale_json text,
  criteria_json text,
  rounds integer,
  current_round integer,
  round_criteria_json text,
  round_meta_json text,
  max_evaluations integer,
  created_at integer,
  updated_at integer
);
create table plan_reviewer (
  id text primary key,
  plan_id text,
  user_id text,
  track_id text,
  submission_id text,
  created_at integer,
  updated_at integer
);
create table evaluation (
  id text primary key,
  plan_id text,
  submission_id text,
  reviewer_id text,
  round integer,
  scores_json text,
  comment text,
  submitted_at integer,
  created_at integer,
  updated_at integer
);
create unique index evaluation_plan_submission_reviewer_round_idx on evaluation (plan_id, submission_id, reviewer_id, round);
create table review_recusal (
  id text primary key,
  plan_id text,
  submission_id text,
  user_id text,
  reason text,
  created_at integer
);
create unique index review_recusal_plan_submission_user_idx on review_recusal (plan_id, submission_id, user_id);
`;

function makeTestDb(): { db: Db; sqlite: DatabaseSync } {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(DDL);
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
// Fixture: ONE org, ONE event, two plans, three submissions across two
// tracks (plus one track-less submission). Reviewer R's OWN plan_reviewer
// row varies per describe block below; reviewer P holds plan B unrestricted
// throughout so plan B is a genuinely live, populated plan.
// ---------------------------------------------------------------------------

const NOW = new Date("2026-01-01T00:00:00Z");

const ORG = "org-same";
const EVENT = "event-same";
const TRACK_1 = "track-1";
const TRACK_2 = "track-2";
const SUBMISSION_1 = "submission-1"; // track T1
const SUBMISSION_2 = "submission-2"; // track T2
const SUBMISSION_3 = "submission-3"; // no track
const PLAN_A = "plan-a";
const PLAN_B = "plan-b";
const REVIEWER_R_USER = "user-reviewer-r";
const REVIEWER_P_USER = "user-reviewer-p"; // holds plan B, keeps it live

const SCALE_JSON = JSON.stringify({ min: 1, max: 5 });
const CRITERIA_JSON = JSON.stringify([{ id: "c1", label: "Quality", kind: "rating", weight: 1 }]);

async function seedBaseFixture(db: Db): Promise<void> {
  await db.insert(schema.org).values([{ id: ORG, name: "Org", createdAt: NOW, updatedAt: NOW }]);
  await db.insert(schema.event).values([
    {
      id: EVENT,
      orgId: ORG,
      name: "Event",
      slug: "event-same",
      startDate: "2026-06-01",
      endDate: "2026-06-02",
      timezone: "UTC",
      recordPrefix: "SES",
      createdAt: NOW,
      updatedAt: NOW,
    },
  ]);
  await db.insert(schema.track).values([
    { id: TRACK_1, eventId: EVENT, name: "Track 1", position: 0, createdAt: NOW, updatedAt: NOW },
    { id: TRACK_2, eventId: EVENT, name: "Track 2", position: 1, createdAt: NOW, updatedAt: NOW },
  ]);
  await db.insert(schema.submission).values([
    {
      id: SUBMISSION_1,
      eventId: EVENT,
      seq: 1,
      title: "Talk in Track 1",
      status: "pending",
      contentStatus: "pending",
      icsSequence: 0,
      createdAt: NOW,
      updatedAt: NOW,
    },
    {
      id: SUBMISSION_2,
      eventId: EVENT,
      seq: 2,
      title: "Talk in Track 2",
      status: "pending",
      contentStatus: "pending",
      icsSequence: 0,
      createdAt: NOW,
      updatedAt: NOW,
    },
    {
      id: SUBMISSION_3,
      eventId: EVENT,
      seq: 3,
      title: "Talk with no track",
      status: "pending",
      contentStatus: "pending",
      icsSequence: 0,
      createdAt: NOW,
      updatedAt: NOW,
    },
  ]);
  await db.insert(schema.submissionTrack).values([
    { submissionId: SUBMISSION_1, trackId: TRACK_1, createdAt: NOW },
    { submissionId: SUBMISSION_2, trackId: TRACK_2, createdAt: NOW },
  ]);
  await db.insert(schema.evaluationPlan).values([
    {
      id: PLAN_A,
      eventId: EVENT,
      name: "Plan A",
      anonymized: false,
      scaleJson: SCALE_JSON,
      criteriaJson: CRITERIA_JSON,
      rounds: 1,
      currentRound: 1,
      createdAt: NOW,
      updatedAt: NOW,
    },
    {
      id: PLAN_B,
      eventId: EVENT,
      name: "Plan B",
      anonymized: false,
      scaleJson: SCALE_JSON,
      criteriaJson: CRITERIA_JSON,
      rounds: 1,
      currentRound: 1,
      createdAt: NOW,
      updatedAt: NOW,
    },
  ]);
  await db.insert(schema.user).values([
    {
      id: REVIEWER_R_USER,
      orgId: ORG,
      email: "reviewer-r@org.test",
      passwordHash: "x",
      role: "reviewer",
      createdAt: NOW,
      updatedAt: NOW,
    },
    {
      id: REVIEWER_P_USER,
      orgId: ORG,
      email: "reviewer-p@org.test",
      passwordHash: "x",
      role: "reviewer",
      createdAt: NOW,
      updatedAt: NOW,
    },
  ]);
  // Reviewer P is genuinely, unrestrictedly assigned to plan B -- keeps
  // plan B a real, populated plan rather than an empty decoy.
  await db.insert(schema.planReviewer).values([
    {
      id: "plan-reviewer-p",
      planId: PLAN_B,
      userId: REVIEWER_P_USER,
      trackId: null,
      submissionId: null,
      createdAt: NOW,
      updatedAt: NOW,
    },
  ]);
}

const REVIEWER_R: AuthInfo = { userId: REVIEWER_R_USER, role: "reviewer", orgId: ORG };

async function buildActorApp(db: Db, auth: AuthInfo) {
  const app = new Hono<AppEnv>();
  app.use("*", async (c, next) => {
    c.set("db", db as unknown as AppEnv["Variables"]["db"]);
    c.set("auth", auth);
    await next();
  });
  registerErrorHandler(app);
  const mounts = await parseIndexMounts();
  for (const { prefix, identifier, subApp } of mounts) {
    if (identifier === "devMailboxRoutes") {
      guardDevMailbox(app);
    }
    app.route(prefix, subApp);
  }
  return { app, mountCount: mounts.length };
}

const REVIEW_ROUTES = enumerateRegisteredRoutes()
  .filter((r) => r.path.startsWith("/api/v1/review"))
  .map((r) => ({ method: r.method, path: r.path }));

function reviewRouteKeys(): Set<string> {
  return new Set(REVIEW_ROUTES.map((r) => `${r.method} ${r.path}`));
}

const CSRF_HEADERS = { "x-chq-csrf": "1" };

function headersFor(method: string): Record<string, string> {
  return method === "GET" || method === "HEAD" ? {} : CSRF_HEADERS;
}

async function snapshotState(db: Db) {
  const plans = await db.select().from(schema.evaluationPlan);
  const evaluations = await db.select().from(schema.evaluation);
  const recusals = await db.select().from(schema.reviewRecusal);
  const planReviewers = await db.select().from(schema.planReviewer);
  return { plans, evaluations, recusals, planReviewers };
}

// ---------------------------------------------------------------------------
// (1) Cross-PLAN existence hiding: driven as R (assigned only to plan A)
// with plan B's planId, and mixed A/B id pairs, over every enumerated
// /api/v1/review/* registration.
// ---------------------------------------------------------------------------

interface LedgerEntry {
  route: { method: string; path: string };
  description: string;
  request: { method: string; path: string };
  expectedStatus: number;
}

function planBLedger(): LedgerEntry[] {
  return [
    {
      route: { method: "GET", path: "/api/v1/review/plans" },
      description:
        "own-scope list: takes no id param at all -- R's own plan list must never surface plan B (verified separately, not via this ledger's status assertion)",
      request: { method: "GET", path: "/api/v1/review/plans" },
      expectedStatus: 200,
    },
    {
      route: { method: "GET", path: "/api/v1/review/plans/:id" },
      description: "R is not assigned to plan B at all",
      request: { method: "GET", path: `/api/v1/review/plans/${PLAN_B}` },
      expectedStatus: 404,
    },
    {
      route: { method: "GET", path: "/api/v1/review/plans/:id/queue" },
      description: "R is not assigned to plan B at all",
      request: { method: "GET", path: `/api/v1/review/plans/${PLAN_B}/queue` },
      expectedStatus: 404,
    },
    {
      route: { method: "GET", path: "/api/v1/review/submissions/:id" },
      description: "both foreign: plan B's own submission (S? none exist under plan B directly, use S1) + plan B's planId",
      request: { method: "GET", path: `/api/v1/review/submissions/${SUBMISSION_1}?planId=${PLAN_B}` },
      expectedStatus: 404,
    },
    {
      route: { method: "PUT", path: "/api/v1/review/plans/:planId/evaluations/:submissionId" },
      description: "R has no assignment on plan B",
      request: { method: "PUT", path: `/api/v1/review/plans/${PLAN_B}/evaluations/${SUBMISSION_1}` },
      expectedStatus: 404,
    },
    {
      route: { method: "POST", path: "/api/v1/review/plans/:planId/recusals/:submissionId" },
      description: "R has no assignment on plan B",
      request: { method: "POST", path: `/api/v1/review/plans/${PLAN_B}/recusals/${SUBMISSION_1}` },
      expectedStatus: 404,
    },
    {
      route: { method: "DELETE", path: "/api/v1/review/plans/:planId/recusals/:submissionId" },
      description: "R has no assignment on plan B",
      request: { method: "DELETE", path: `/api/v1/review/plans/${PLAN_B}/recusals/${SUBMISSION_1}` },
      expectedStatus: 404,
    },
  ];
}

describe("review plan-scope real-row probe (DEC-459 wave-42 amendment)", () => {
  let db: Db;
  let sqlite: DatabaseSync;

  afterEach(() => {
    sqlite.close();
  });

  it("enumeration floor: /api/v1/review/* registers exactly the 7 routes this probe knows about", () => {
    ({ db, sqlite } = makeTestDb());
    const keys = reviewRouteKeys();
    expect(keys.size).toBeGreaterThanOrEqual(7);
    for (const { method, path } of [
      { method: "GET", path: "/api/v1/review/plans" },
      { method: "GET", path: "/api/v1/review/plans/:id" },
      { method: "GET", path: "/api/v1/review/plans/:id/queue" },
      { method: "GET", path: "/api/v1/review/submissions/:id" },
      { method: "PUT", path: "/api/v1/review/plans/:planId/evaluations/:submissionId" },
      { method: "POST", path: "/api/v1/review/plans/:planId/recusals/:submissionId" },
      { method: "DELETE", path: "/api/v1/review/plans/:planId/recusals/:submissionId" },
    ]) {
      expect(keys.has(`${method} ${path}`)).toBe(true);
    }
  });

  it("ledger is two-directional: every entry names a currently-enumerated route, every enumerated route has >=1 entry across the ledgers used below", () => {
    ({ db, sqlite } = makeTestDb());
    const keys = reviewRouteKeys();
    const allEntries = [...planBLedger()];
    for (const entry of allEntries) {
      expect(keys.has(`${entry.route.method} ${entry.route.path}`)).toBe(true);
    }
    const coveredKeys = new Set(allEntries.map((e) => `${e.route.method} ${e.route.path}`));
    for (const { method, path } of REVIEW_ROUTES) {
      expect(coveredKeys.has(`${method} ${path}`)).toBe(true);
    }
  });

  describe("cross-plan (R assigned only to plan A, plan B is a real, populated plan held by reviewer P)", () => {
    beforeEach(async () => {
      ({ db, sqlite } = makeTestDb());
      await seedBaseFixture(db);
      await db.insert(schema.planReviewer).values([
        {
          id: "plan-reviewer-r",
          planId: PLAN_A,
          userId: REVIEWER_R_USER,
          trackId: null,
          submissionId: null,
          createdAt: NOW,
          updatedAt: NOW,
        },
      ]);
    });

    it("every plan-B-targeted request answers 404 existence-hiding, never 403, never 500, never 200, and mutates nothing", async () => {
      const { app } = await buildActorApp(db, REVIEWER_R);
      const before = await snapshotState(db);
      for (const entry of planBLedger()) {
        const res = await app.request(entry.request.path, {
          method: entry.request.method,
          headers: headersFor(entry.request.method),
        });
        expect(res.status, `${entry.request.method} ${entry.request.path} (${entry.description})`).toBe(
          entry.expectedStatus,
        );
      }
      const after = await snapshotState(db);
      expect(after).toEqual(before);
    });

    it("positive control: R's OWN plan A + in-scope submission succeeds (proves the fixture is real, not a refuse-everything stub)", async () => {
      const { app } = await buildActorApp(db, REVIEWER_R);
      const getPlan = await app.request(`/api/v1/review/plans/${PLAN_A}`);
      expect(getPlan.status).toBe(200);

      const getSub = await app.request(`/api/v1/review/submissions/${SUBMISSION_1}?planId=${PLAN_A}`);
      expect(getSub.status).toBe(200);

      const putEval = await app.request(`/api/v1/review/plans/${PLAN_A}/evaluations/${SUBMISSION_1}`, {
        method: "PUT",
        headers: { ...CSRF_HEADERS, "content-type": "application/json" },
        body: JSON.stringify({ scores: { c1: 5 } }),
      });
      expect(putEval.status).toBe(200);

      const postRecusal = await app.request(`/api/v1/review/plans/${PLAN_A}/recusals/${SUBMISSION_2}`, {
        method: "POST",
        headers: { ...CSRF_HEADERS, "content-type": "application/json" },
        body: JSON.stringify({ reason: "conflict" }),
      });
      expect([200, 201]).toContain(postRecusal.status);

      const deleteRecusal = await app.request(`/api/v1/review/plans/${PLAN_A}/recusals/${SUBMISSION_2}`, {
        method: "DELETE",
        headers: CSRF_HEADERS,
      });
      expect(deleteRecusal.status).toBe(204);
    });
  });

  // -------------------------------------------------------------------------
  // (2) In-plan out-of-scope: R IS assigned to plan A, but narrowed to
  // track T1 (variant ii) or submission S1 (variant iii). S2 (track T2) and
  // S3 (no track) share the plan and event but must still 404.
  // -------------------------------------------------------------------------

  function inScopeOutOfScopeLedger(outOfScopeSubmissionId: string): LedgerEntry[] {
    return [
      {
        route: { method: "GET", path: "/api/v1/review/submissions/:id" },
        description: "submission shares plan A/event but is outside R's own scope",
        request: { method: "GET", path: `/api/v1/review/submissions/${outOfScopeSubmissionId}?planId=${PLAN_A}` },
        expectedStatus: 404,
      },
      {
        route: { method: "PUT", path: "/api/v1/review/plans/:planId/evaluations/:submissionId" },
        description: "the write guard must match the read predicate",
        request: { method: "PUT", path: `/api/v1/review/plans/${PLAN_A}/evaluations/${outOfScopeSubmissionId}` },
        expectedStatus: 404,
      },
      {
        route: { method: "POST", path: "/api/v1/review/plans/:planId/recusals/:submissionId" },
        description: "recusal POST must refuse the same as the read/write guards",
        request: { method: "POST", path: `/api/v1/review/plans/${PLAN_A}/recusals/${outOfScopeSubmissionId}` },
        expectedStatus: 404,
      },
      {
        route: { method: "DELETE", path: "/api/v1/review/plans/:planId/recusals/:submissionId" },
        description: "recusal DELETE must refuse the same as the read/write guards",
        request: { method: "DELETE", path: `/api/v1/review/plans/${PLAN_A}/recusals/${outOfScopeSubmissionId}` },
        expectedStatus: 404,
      },
    ];
  }

  describe("track-scoped variant (R scoped to plan A, track T1 only)", () => {
    beforeEach(async () => {
      ({ db, sqlite } = makeTestDb());
      await seedBaseFixture(db);
      await db.insert(schema.planReviewer).values([
        {
          id: "plan-reviewer-r-track",
          planId: PLAN_A,
          userId: REVIEWER_R_USER,
          trackId: TRACK_1,
          submissionId: null,
          createdAt: NOW,
          updatedAt: NOW,
        },
      ]);
    });

    for (const outOfScopeId of [SUBMISSION_2, SUBMISSION_3]) {
      it(`refuses ${outOfScopeId} (in plan A / event, outside track T1 scope) on read, recusal, and evaluation write, and mutates nothing`, async () => {
        const { app } = await buildActorApp(db, REVIEWER_R);
        const before = await snapshotState(db);
        for (const entry of inScopeOutOfScopeLedger(outOfScopeId)) {
          const res = await app.request(entry.request.path, {
            method: entry.request.method,
            headers: { ...headersFor(entry.request.method), "content-type": "application/json" },
            body: entry.request.method === "GET" || entry.request.method === "DELETE"
              ? undefined
              : JSON.stringify(entry.request.method === "PUT" ? { scores: { c1: 3 } } : { reason: "x" }),
          });
          expect(res.status, `${entry.request.method} ${entry.request.path} (${entry.description})`).toBe(
            entry.expectedStatus,
          );
        }
        const after = await snapshotState(db);
        expect(after).toEqual(before);
      });
    }

    it("positive control: S1 (track T1, in scope) succeeds for read, evaluation write, and recusal round-trip", async () => {
      const { app } = await buildActorApp(db, REVIEWER_R);
      const getSub = await app.request(`/api/v1/review/submissions/${SUBMISSION_1}?planId=${PLAN_A}`);
      expect(getSub.status).toBe(200);

      const putEval = await app.request(`/api/v1/review/plans/${PLAN_A}/evaluations/${SUBMISSION_1}`, {
        method: "PUT",
        headers: { ...CSRF_HEADERS, "content-type": "application/json" },
        body: JSON.stringify({ scores: { c1: 4 } }),
      });
      expect(putEval.status).toBe(200);

      const postRecusal = await app.request(`/api/v1/review/plans/${PLAN_A}/recusals/${SUBMISSION_1}`, {
        method: "POST",
        headers: { ...CSRF_HEADERS, "content-type": "application/json" },
        body: JSON.stringify({ reason: "conflict" }),
      });
      expect([200, 201]).toContain(postRecusal.status);

      const deleteRecusal = await app.request(`/api/v1/review/plans/${PLAN_A}/recusals/${SUBMISSION_1}`, {
        method: "DELETE",
        headers: CSRF_HEADERS,
      });
      expect(deleteRecusal.status).toBe(204);
    });
  });

  describe("submission-scoped variant (R scoped to plan A, submission S1 only)", () => {
    beforeEach(async () => {
      ({ db, sqlite } = makeTestDb());
      await seedBaseFixture(db);
      await db.insert(schema.planReviewer).values([
        {
          id: "plan-reviewer-r-submission",
          planId: PLAN_A,
          userId: REVIEWER_R_USER,
          trackId: null,
          submissionId: SUBMISSION_1,
          createdAt: NOW,
          updatedAt: NOW,
        },
      ]);
    });

    for (const outOfScopeId of [SUBMISSION_2, SUBMISSION_3]) {
      it(`refuses ${outOfScopeId} (in plan A / event, outside R's single-submission scope) on read, recusal, and evaluation write, and mutates nothing`, async () => {
        const { app } = await buildActorApp(db, REVIEWER_R);
        const before = await snapshotState(db);
        for (const entry of inScopeOutOfScopeLedger(outOfScopeId)) {
          const res = await app.request(entry.request.path, {
            method: entry.request.method,
            headers: { ...headersFor(entry.request.method), "content-type": "application/json" },
            body: entry.request.method === "GET" || entry.request.method === "DELETE"
              ? undefined
              : JSON.stringify(entry.request.method === "PUT" ? { scores: { c1: 3 } } : { reason: "x" }),
          });
          expect(res.status, `${entry.request.method} ${entry.request.path} (${entry.description})`).toBe(
            entry.expectedStatus,
          );
        }
        const after = await snapshotState(db);
        expect(after).toEqual(before);
      });
    }

    it("positive control: S1 (R's own explicit submission scope) succeeds for read, evaluation write, and recusal round-trip", async () => {
      const { app } = await buildActorApp(db, REVIEWER_R);
      const getSub = await app.request(`/api/v1/review/submissions/${SUBMISSION_1}?planId=${PLAN_A}`);
      expect(getSub.status).toBe(200);

      const putEval = await app.request(`/api/v1/review/plans/${PLAN_A}/evaluations/${SUBMISSION_1}`, {
        method: "PUT",
        headers: { ...CSRF_HEADERS, "content-type": "application/json" },
        body: JSON.stringify({ scores: { c1: 5 } }),
      });
      expect(putEval.status).toBe(200);

      const postRecusal = await app.request(`/api/v1/review/plans/${PLAN_A}/recusals/${SUBMISSION_1}`, {
        method: "POST",
        headers: { ...CSRF_HEADERS, "content-type": "application/json" },
        body: JSON.stringify({ reason: "conflict" }),
      });
      expect([200, 201]).toContain(postRecusal.status);

      const deleteRecusal = await app.request(`/api/v1/review/plans/${PLAN_A}/recusals/${SUBMISSION_1}`, {
        method: "DELETE",
        headers: CSRF_HEADERS,
      });
      expect(deleteRecusal.status).toBe(204);
    });
  });

  // -------------------------------------------------------------------------
  // (4) VICTIM SNAPSHOT: dump evaluation/recusal/plan_reviewer/plan tables
  // before and after the WHOLE probe (all three variants' full sweeps, both
  // refusals and positive controls) and assert byte-identical JSON for the
  // rows that must never move as a side effect of a refusal (a refusal that
  // mutates is not a refusal) -- the positive-control writes ARE expected
  // to land, so this final check targets only the rows the refusal ledger
  // touched: plan B (never touched by R at all) and the OUT-OF-SCOPE
  // submissions' evaluation/recusal rows in plan A.
  // -------------------------------------------------------------------------

  it("victim snapshot: plan B and plan A's out-of-scope submissions carry zero evaluation/recusal rows after a full track-scoped sweep", async () => {
    ({ db, sqlite } = makeTestDb());
    await seedBaseFixture(db);
    await db.insert(schema.planReviewer).values([
      {
        id: "plan-reviewer-r-track",
        planId: PLAN_A,
        userId: REVIEWER_R_USER,
        trackId: TRACK_1,
        submissionId: null,
        createdAt: NOW,
        updatedAt: NOW,
      },
    ]);
    const { app } = await buildActorApp(db, REVIEWER_R);

    const beforePlanB = JSON.stringify(await db.select().from(schema.evaluationPlan).where(eq(schema.evaluationPlan.id, PLAN_B)));

    for (const outOfScopeId of [SUBMISSION_2, SUBMISSION_3]) {
      for (const entry of inScopeOutOfScopeLedger(outOfScopeId)) {
        await app.request(entry.request.path, {
          method: entry.request.method,
          headers: { ...headersFor(entry.request.method), "content-type": "application/json" },
          body: entry.request.method === "GET" || entry.request.method === "DELETE"
            ? undefined
            : JSON.stringify(entry.request.method === "PUT" ? { scores: { c1: 3 } } : { reason: "x" }),
        });
      }
    }
    for (const entry of planBLedger()) {
      await app.request(entry.request.path, { method: entry.request.method, headers: headersFor(entry.request.method) });
    }

    const afterPlanB = JSON.stringify(await db.select().from(schema.evaluationPlan).where(eq(schema.evaluationPlan.id, PLAN_B)));
    expect(afterPlanB).toEqual(beforePlanB);

    const strayEvaluations = await db
      .select()
      .from(schema.evaluation)
      .where(eq(schema.evaluation.reviewerId, REVIEWER_R_USER));
    expect(strayEvaluations.filter((e) => e.submissionId === SUBMISSION_2 || e.submissionId === SUBMISSION_3)).toEqual([]);
    expect(strayEvaluations.filter((e) => e.planId === PLAN_B)).toEqual([]);

    const strayRecusals = await db
      .select()
      .from(schema.reviewRecusal)
      .where(eq(schema.reviewRecusal.userId, REVIEWER_R_USER));
    expect(strayRecusals.filter((r) => r.submissionId === SUBMISSION_2 || r.submissionId === SUBMISSION_3)).toEqual([]);
    expect(strayRecusals.filter((r) => r.planId === PLAN_B)).toEqual([]);

    const planReviewerRows = await db.select().from(schema.planReviewer);
    expect(planReviewerRows.filter((r) => r.planId === PLAN_B).map((r) => r.userId)).toEqual([REVIEWER_P_USER]);
  });
});
