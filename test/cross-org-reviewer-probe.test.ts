// DEC-459 (wave-37 amendment)/DEC-039/DEC-727: the enumerated wrong-ORG probe
// for the REVIEWER actor over every /api/v1/review/* registration, driven
// against REAL rows instead of the mocked resolvers test/review-idor.test.ts
// uses. test/review-idor.test.ts and test/role-refusal-probe.test.ts prove
// the reviewer-surface guard is called and called in the right ORDER (via
// mocked repo functions); this file proves the PREDICATE those guards
// evaluate actually refuses a genuinely-assigned, real reviewer who is
// simply attached to the WRONG org's plan/submission. Both stay; neither
// covers the other (field guide w37: "a mocked resolver proves the route
// calls it, not that it filters").
//
// Technique, deliberately duplicated from test/anonymous-route-probe.test.ts
// and test/role-refusal-probe.test.ts rather than shared (DEC-459 rule 4):
// same parseIndexMounts() + registerErrorHandler composition. Route
// population is enumerateRegisteredRoutes() (test/helpers/registered-routes.ts)
// filtered to paths starting "/api/v1/review". The db is a REAL in-memory
// SQLite engine via node:sqlite + drizzle-orm/sqlite-proxy over hand-written
// DDL mirroring the review/event/submission/org/user migrations (same
// technique as test/rate-limit-atomicity.test.ts:19-64 and
// test/file-version-identity.test.ts) -- DEC-727's wave-37 amendment keeps
// this file in the FAST tier (no wrangler/jsdom/miniflare import) by
// construction.
//
// Fixture: org A owns event A (submission A, plan A). Org B owns event B
// (submission B, plan B) and a REVIEWER user genuinely, unrestrictedly
// assigned to plan B (plan_reviewer row with trackId=null, submissionId=null)
// -- so refusals below come from the tenant/scope check, never from having
// no reviewer scope at all (the actor is a real, working reviewer for their
// OWN org).
//
// Every enumerated /api/v1/review/* route is driven with org A's
// planId/submissionId substituted for the reviewer's own org-B ids,
// including the mixed cases (an org-B id paired with an org-A id in the same
// request) -- GET /api/v1/review/submissions/:id additionally needs its
// required ?planId= query param supplied with a foreign value to even reach
// its real authz path (test/role-refusal-probe.test.ts:46-55 had to ledger
// this route because its own stock literal-substitution request 400s before
// reaching authz at all).
//
// Finding from building this probe: none -- every route already scopes
// through requireAssignedPlan (src/routes/review/shared.ts), which resolves
// the reviewer's OWN assigned-plan-id set (repo.listPlanIdsForReviewer) and
// 404s a foreign planId before any further read, and getSubmissionSummaryInEvent
// (DEC-211 existence-hiding), which requires the submission's event_id to
// equal the (already org-scoped) plan's event_id. No src/routes/review/**
// change was required.

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
// Real in-memory SQLite engine, same technique as
// test/rate-limit-atomicity.test.ts:19-64 / test/file-version-identity.test.ts.
// DDL mirrors the columns migrations/0000_secret_matthew_murdock.sql,
// migrations/0004_wave3.sql, migrations/0009_review_rounds.sql,
// migrations/0010_round_criteria.sql, migrations/0017_review_recusal.sql and
// migrations/0024_review_anonymized_at.sql define for these tables.
// DEC-370 (wave-61 amendment): GET /review/submissions/:id now issues its
// eight reads as ONE wave regardless of which one ultimately refuses, so
// contact/participant/form_field/submission_answer must exist even on the
// refusal paths this file drives -- a discarded read still touches its
// table.
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
// Fixture: two orgs, each with an event/submission/plan; org B's reviewer is
// genuinely, unrestrictedly assigned to org B's own plan.
// ---------------------------------------------------------------------------

const NOW = new Date("2026-01-01T00:00:00Z");

const ORG_A = "org-a";
const ORG_B = "org-b";
const EVENT_A = "event-a";
const EVENT_B = "event-b";
const SUBMISSION_A = "submission-a";
const SUBMISSION_B = "submission-b";
const PLAN_A = "plan-a";
const PLAN_B = "plan-b";
const REVIEWER_B_USER = "user-reviewer-b";

const SCALE_JSON = JSON.stringify({ min: 1, max: 5 });
const CRITERIA_JSON = JSON.stringify([{ id: "c1", label: "Quality", kind: "rating", weight: 1 }]);

async function seedFixture(db: Db): Promise<void> {
  await db.insert(schema.org).values([
    { id: ORG_A, name: "Org A", createdAt: NOW, updatedAt: NOW },
    { id: ORG_B, name: "Org B", createdAt: NOW, updatedAt: NOW },
  ]);
  await db.insert(schema.event).values([
    {
      id: EVENT_A,
      orgId: ORG_A,
      name: "Event A",
      slug: "event-a",
      startDate: "2026-06-01",
      endDate: "2026-06-02",
      timezone: "UTC",
      recordPrefix: "SES",
      createdAt: NOW,
      updatedAt: NOW,
    },
    {
      id: EVENT_B,
      orgId: ORG_B,
      name: "Event B",
      slug: "event-b",
      startDate: "2026-07-01",
      endDate: "2026-07-02",
      timezone: "UTC",
      recordPrefix: "SES",
      createdAt: NOW,
      updatedAt: NOW,
    },
  ]);
  await db.insert(schema.submission).values([
    {
      id: SUBMISSION_A,
      eventId: EVENT_A,
      seq: 1,
      title: "Org A talk",
      status: "pending",
      contentStatus: "pending",
      icsSequence: 0,
      createdAt: NOW,
      updatedAt: NOW,
    },
    {
      id: SUBMISSION_B,
      eventId: EVENT_B,
      seq: 1,
      title: "Org B talk",
      status: "pending",
      contentStatus: "pending",
      icsSequence: 0,
      createdAt: NOW,
      updatedAt: NOW,
    },
  ]);
  await db.insert(schema.evaluationPlan).values([
    {
      id: PLAN_A,
      eventId: EVENT_A,
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
      eventId: EVENT_B,
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
      id: REVIEWER_B_USER,
      orgId: ORG_B,
      email: "reviewer-b@org-b.test",
      passwordHash: "x",
      role: "reviewer",
      createdAt: NOW,
      updatedAt: NOW,
    },
  ]);
  // Genuine, unrestricted assignment to org B's OWN plan (trackId/submissionId
  // both null -- reviews everything in scope for plan B).
  await db.insert(schema.planReviewer).values([
    {
      id: "plan-reviewer-b",
      planId: PLAN_B,
      userId: REVIEWER_B_USER,
      trackId: null,
      submissionId: null,
      createdAt: NOW,
      updatedAt: NOW,
    },
  ]);
}

const REVIEWER_B: AuthInfo = { userId: REVIEWER_B_USER, role: "reviewer", orgId: ORG_B };

// ---------------------------------------------------------------------------
// App composition -- same mount order/technique as the anonymous and
// role-refusal probes, but wired to the REAL db above instead of a throwing
// stub, since this probe proves the PREDICATE, not just guard order.
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Population: enumerateRegisteredRoutes() filtered to /api/v1/review, the
// same route-source scanner test/pubcache-purge-classification.test.ts
// extracted registered-routes.ts from (field guide w31: reuse the existing
// enumerator, never re-parse).
// ---------------------------------------------------------------------------

const REVIEW_ROUTES = enumerateRegisteredRoutes()
  .filter((r) => r.path.startsWith("/api/v1/review"))
  .map((r) => ({ method: r.method, path: r.path }));

function reviewRouteKeys(): Set<string> {
  return new Set(REVIEW_ROUTES.map((r) => `${r.method} ${r.path}`));
}

// ---------------------------------------------------------------------------
// CROSS_ORG_REVIEWER_LEDGER -- the two-directional manifest of every request
// this probe drives, keyed to the route it exercises, with the exact
// expected status. Each entry's `route` must name a currently-enumerated
// /api/v1/review/* (method, path) pair (checked below); every enumerated
// route must be named by at least one entry (checked below) -- a deleted or
// added route can't leave a stale or uncovered ledger line.
// ---------------------------------------------------------------------------

interface LedgerEntry {
  route: { method: string; path: string };
  description: string;
  request: { method: string; path: string };
  expectedStatus: number;
}

const CROSS_ORG_REVIEWER_LEDGER: LedgerEntry[] = [
  {
    route: { method: "GET", path: "/api/v1/review/plans" },
    description:
      "own-scope list: takes no id param at all, so nothing to attack -- reviewer B's own plan list must never surface org A's plan (verified separately below, not via this status table)",
    request: { method: "GET", path: "/api/v1/review/plans" },
    expectedStatus: 200,
  },
  {
    route: { method: "GET", path: "/api/v1/review/plans/:id" },
    description: "foreign planId (org A's own plan, reviewer B has no assignment on it)",
    request: { method: "GET", path: `/api/v1/review/plans/${PLAN_A}` },
    expectedStatus: 404,
  },
  {
    route: { method: "GET", path: "/api/v1/review/plans/:id/queue" },
    description: "foreign planId, same requireAssignedPlan guard as above",
    request: { method: "GET", path: `/api/v1/review/plans/${PLAN_A}/queue` },
    expectedStatus: 404,
  },
  {
    route: { method: "GET", path: "/api/v1/review/submissions/:id" },
    description: "both foreign: org A submission id + org A planId query param",
    request: { method: "GET", path: `/api/v1/review/submissions/${SUBMISSION_A}?planId=${PLAN_A}` },
    expectedStatus: 404,
  },
  {
    route: { method: "GET", path: "/api/v1/review/submissions/:id" },
    description: "mixed: org A submission id + reviewer B's OWN (org B) planId -- requireAssignedPlan grants, isSubmissionInReviewerScope must still refuse",
    request: { method: "GET", path: `/api/v1/review/submissions/${SUBMISSION_A}?planId=${PLAN_B}` },
    expectedStatus: 404,
  },
  {
    route: { method: "GET", path: "/api/v1/review/submissions/:id" },
    description: "mixed: org B's OWN submission id + org A's foreign planId -- requireAssignedPlan must refuse before the submission is ever looked at",
    request: { method: "GET", path: `/api/v1/review/submissions/${SUBMISSION_B}?planId=${PLAN_A}` },
    expectedStatus: 404,
  },
  {
    route: { method: "PUT", path: "/api/v1/review/plans/:planId/evaluations/:submissionId" },
    description: "both foreign: org A planId + org A submissionId",
    request: { method: "PUT", path: `/api/v1/review/plans/${PLAN_A}/evaluations/${SUBMISSION_A}` },
    expectedStatus: 404,
  },
  {
    route: { method: "PUT", path: "/api/v1/review/plans/:planId/evaluations/:submissionId" },
    description: "mixed: reviewer B's OWN (org B) planId + org A's foreign submissionId -- DEC-211 existence-hiding must refuse",
    request: { method: "PUT", path: `/api/v1/review/plans/${PLAN_B}/evaluations/${SUBMISSION_A}` },
    expectedStatus: 404,
  },
  {
    route: { method: "PUT", path: "/api/v1/review/plans/:planId/evaluations/:submissionId" },
    description: "mixed: org A's foreign planId + org B's OWN submissionId -- requireAssignedPlan must refuse first",
    request: { method: "PUT", path: `/api/v1/review/plans/${PLAN_A}/evaluations/${SUBMISSION_B}` },
    expectedStatus: 404,
  },
  {
    route: { method: "POST", path: "/api/v1/review/plans/:planId/recusals/:submissionId" },
    description: "both foreign: org A planId + org A submissionId",
    request: { method: "POST", path: `/api/v1/review/plans/${PLAN_A}/recusals/${SUBMISSION_A}` },
    expectedStatus: 404,
  },
  {
    route: { method: "POST", path: "/api/v1/review/plans/:planId/recusals/:submissionId" },
    description: "mixed: reviewer B's OWN planId + org A's foreign submissionId",
    request: { method: "POST", path: `/api/v1/review/plans/${PLAN_B}/recusals/${SUBMISSION_A}` },
    expectedStatus: 404,
  },
  {
    route: { method: "POST", path: "/api/v1/review/plans/:planId/recusals/:submissionId" },
    description: "mixed: org A's foreign planId + org B's OWN submissionId",
    request: { method: "POST", path: `/api/v1/review/plans/${PLAN_A}/recusals/${SUBMISSION_B}` },
    expectedStatus: 404,
  },
  {
    route: { method: "DELETE", path: "/api/v1/review/plans/:planId/recusals/:submissionId" },
    description: "both foreign: org A planId + org A submissionId",
    request: { method: "DELETE", path: `/api/v1/review/plans/${PLAN_A}/recusals/${SUBMISSION_A}` },
    expectedStatus: 404,
  },
  {
    route: { method: "DELETE", path: "/api/v1/review/plans/:planId/recusals/:submissionId" },
    description: "mixed: reviewer B's OWN planId + org A's foreign submissionId",
    request: { method: "DELETE", path: `/api/v1/review/plans/${PLAN_B}/recusals/${SUBMISSION_A}` },
    expectedStatus: 404,
  },
  {
    route: { method: "DELETE", path: "/api/v1/review/plans/:planId/recusals/:submissionId" },
    description: "mixed: org A's foreign planId + org B's OWN submissionId",
    request: { method: "DELETE", path: `/api/v1/review/plans/${PLAN_A}/recusals/${SUBMISSION_B}` },
    expectedStatus: 404,
  },
];

describe("cross-org reviewer probe (DEC-459/DEC-039/DEC-727)", () => {
  let db: Db;
  let sqlite: DatabaseSync;

  beforeEach(async () => {
    ({ db, sqlite } = makeTestDb());
    await seedFixture(db);
  });

  afterEach(() => {
    sqlite.close();
  });

  it("enumeration floor: /api/v1/review/* registers exactly the 7 routes this probe knows about", () => {
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

  it("ledger is two-directional: every entry names a currently-enumerated route, every enumerated route has >=1 entry", () => {
    const keys = reviewRouteKeys();
    for (const entry of CROSS_ORG_REVIEWER_LEDGER) {
      expect(keys.has(`${entry.route.method} ${entry.route.path}`)).toBe(true);
    }
    const coveredKeys = new Set(CROSS_ORG_REVIEWER_LEDGER.map((e) => `${e.route.method} ${e.route.path}`));
    for (const { method, path } of REVIEW_ROUTES) {
      expect(coveredKeys.has(`${method} ${path}`)).toBe(true);
    }
  });

  it("every foreign-id ledger entry refuses 403/404 (never 2xx, never 5xx) and mutates nothing", async () => {
    const { app } = await buildActorApp(db, REVIEWER_B);

    // Snapshot org A's rows (and the reviewer-B-authored slices of the
    // shared tables) before the sweep.
    const before = await snapshotOrgAState(db);

    for (const entry of CROSS_ORG_REVIEWER_LEDGER) {
      if (entry.expectedStatus === 200) continue; // GET /review/plans -- own-scope, checked separately below.
      const headers: Record<string, string> = {};
      if (entry.request.method !== "GET" && entry.request.method !== "HEAD") {
        headers["x-chq-csrf"] = "1";
      }
      const res = await app.request(entry.request.path, { method: entry.request.method, headers });
      expect(res.status, `${entry.request.method} ${entry.request.path} (${entry.description})`).toBe(
        entry.expectedStatus,
      );
      expect([403, 404]).toContain(res.status);
    }

    const after = await snapshotOrgAState(db);
    expect(after).toEqual(before);
  });

  it("GET /api/v1/review/plans for reviewer B never surfaces org A's plan (own-scope route, no injectable id)", async () => {
    const { app } = await buildActorApp(db, REVIEWER_B);
    const res = await app.request("/api/v1/review/plans");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { items: Array<{ id: string }> };
    expect(body.items.map((p) => p.id)).not.toContain(PLAN_A);
    expect(body.items.map((p) => p.id)).toEqual([PLAN_B]);
  });

  it("no evaluation or recusal row is ever created for reviewer B against org A's submission after the full sweep", async () => {
    const { app } = await buildActorApp(db, REVIEWER_B);
    for (const entry of CROSS_ORG_REVIEWER_LEDGER) {
      if (entry.expectedStatus === 200) continue;
      const headers: Record<string, string> = {};
      if (entry.request.method !== "GET" && entry.request.method !== "HEAD") {
        headers["x-chq-csrf"] = "1";
      }
      await app.request(entry.request.path, { method: entry.request.method, headers });
    }
    const stray = await db
      .select()
      .from(schema.evaluation)
      .where(eq(schema.evaluation.reviewerId, REVIEWER_B_USER));
    expect(stray.filter((e) => e.submissionId === SUBMISSION_A)).toEqual([]);

    const strayRecusals = await db
      .select()
      .from(schema.reviewRecusal)
      .where(eq(schema.reviewRecusal.userId, REVIEWER_B_USER));
    expect(strayRecusals.filter((r) => r.submissionId === SUBMISSION_A)).toEqual([]);

    // Org A's own plan should also have zero evaluations/recusals at all --
    // reviewer B was never granted a legitimate path to write against it.
    const planAEvaluations = await db.select().from(schema.evaluation).where(eq(schema.evaluation.planId, PLAN_A));
    expect(planAEvaluations).toEqual([]);
    const planARecusals = await db.select().from(schema.reviewRecusal).where(eq(schema.reviewRecusal.planId, PLAN_A));
    expect(planARecusals).toEqual([]);
  });
});

async function snapshotOrgAState(db: Db) {
  const [plan] = await db.select().from(schema.evaluationPlan).where(eq(schema.evaluationPlan.id, PLAN_A));
  const [submission] = await db.select().from(schema.submission).where(eq(schema.submission.id, SUBMISSION_A));
  const evaluations = await db.select().from(schema.evaluation).where(eq(schema.evaluation.planId, PLAN_A));
  const recusals = await db.select().from(schema.reviewRecusal).where(eq(schema.reviewRecusal.planId, PLAN_A));
  return { plan, submission, evaluations, recusals };
}
