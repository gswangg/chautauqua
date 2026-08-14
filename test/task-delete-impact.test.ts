// DEC-933 amendment (wave 63): the remove-task confirmation must state an
// event-wide count, not a count of the paginated/filtered grid page.
// countTaskDeleteImpact must tally assigned/completed/responses/files with
// one grouped query over task_assignment (never a per-row scan), scoped to
// the task regardless of any list filter or page -- there is no filter/page
// concept at the repo layer at all, which is the point. The route-level
// block below exercises GET /api/v1/tasks/:id/delete-preview's org-scoped
// 404, mirroring test/tasks-assign-org-scope.test.ts's mocked-repo pattern.

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { drizzle } from "drizzle-orm/sqlite-proxy";
import { Hono } from "hono";
import * as schema from "../src/db/schema";
import { countTaskDeleteImpact } from "../src/server/repo/tasks/crud";
import { newId } from "../src/domain/ids";
import type { Db } from "../src/server/context";
import { registerErrorHandler } from "../src/server/http";
import type { AppEnv, AuthInfo } from "../src/server/env";

const DDL = `
create table task_assignment (
  id text primary key,
  task_id text,
  contact_id text,
  status text,
  completed_at integer,
  completed_by text,
  response_json text,
  file_id text,
  last_reminded_at integer,
  created_at integer,
  updated_at integer
);
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

describe("countTaskDeleteImpact (DEC-933 amendment)", () => {
  let db: Db;
  let sqlite: DatabaseSync;
  const taskId = "task-1";
  const otherTaskId = "task-2";

  beforeEach(() => {
    ({ db, sqlite } = makeTestDb());
    const now = Date.now();

    // task-1: 3 assignments -- one pending, one complete-no-response-no-file,
    // one complete-with-response-and-file.
    sqlite.exec(`insert into task_assignment
      (id, task_id, contact_id, status, response_json, file_id, created_at, updated_at)
      values
      ('${newId()}', '${taskId}', 'c1', 'pending', NULL, NULL, ${now}, ${now}),
      ('${newId()}', '${taskId}', 'c2', 'complete', NULL, NULL, ${now}, ${now}),
      ('${newId()}', '${taskId}', 'c3', 'complete', '{"q1":"a"}', 'file-1', ${now}, ${now})`);

    // A different task's assignments must never leak into task-1's counts --
    // this stands in for "event-wide, unaffected by any list filter/page":
    // the repo query has no filter/page concept at all, only a taskId scope.
    sqlite.exec(`insert into task_assignment
      (id, task_id, contact_id, status, response_json, file_id, created_at, updated_at)
      values ('${newId()}', '${otherTaskId}', 'c9', 'complete', '{"q1":"z"}', 'file-9', ${now}, ${now})`);
  });

  afterEach(() => {
    sqlite.close();
  });

  it("tallies assigned/completed/responses/files scoped to one task, regardless of any client-side filter/page", async () => {
    const impact = await countTaskDeleteImpact(db, taskId);
    expect(impact).toEqual({ assigned: 3, completed: 2, responses: 1, files: 1 });
  });

  it("counts a completed assignment with a response and a file in all four columns", async () => {
    const impact = await countTaskDeleteImpact(db, taskId);
    // c3 alone contributes to completed, responses, and files -- confirm the
    // one row that satisfies every predicate isn't double- or under-counted
    // relative to c1 (satisfies none) and c2 (satisfies only 'assigned' +
    // 'completed').
    expect(impact.completed).toBeGreaterThanOrEqual(1);
    expect(impact.responses).toBe(1);
    expect(impact.files).toBe(1);
  });

  it("returns zeroes for a task with no assignments", async () => {
    const impact = await countTaskDeleteImpact(db, "no-such-task");
    expect(impact).toEqual({ assigned: 0, completed: 0, responses: 0, files: 0 });
  });
});

// ---------------------------------------------------------------------------
// GET /api/v1/tasks/:id/delete-preview -- route-level org-scope test, mocked
// repo (same pattern as test/tasks-assign-org-scope.test.ts).
// ---------------------------------------------------------------------------

const ORG_A = "org-a";
const ORG_B = "org-b";
const TASK_ID = "task-1";
const EVENT_ID = "event-1";

vi.mock("../src/server/repo/tasks", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/tasks")>("../src/server/repo/tasks");
  return {
    ...actual,
    getTaskOwnership: vi.fn(async (_db: unknown, taskId: string) =>
      taskId === TASK_ID ? { orgId: ORG_A, eventId: EVENT_ID, kind: "general", title: "Submit W-9" } : null,
    ),
    countTaskDeleteImpact: vi.fn(async () => ({ assigned: 5, completed: 2, responses: 1, files: 1 })),
  };
});

beforeAll(async () => {
  await import("../src/routes/tasks");
}, 60_000);

afterEach(() => {
  vi.clearAllMocks();
});

async function buildApp(auth: AuthInfo) {
  const { taskRoutes } = await import("../src/routes/tasks");
  const app = new Hono<AppEnv>();
  registerErrorHandler(app);
  app.use("*", async (c, next) => {
    c.set("auth", auth);
    c.set("db", {} as never);
    await next();
  });
  app.route("/api/v1", taskRoutes);
  return app;
}

const ORGANIZER_A: AuthInfo = { userId: "u1", role: "organizer", orgId: ORG_A };
const ORGANIZER_B: AuthInfo = { userId: "u2", role: "organizer", orgId: ORG_B };

describe("GET /tasks/:id/delete-preview (DEC-933 amendment)", () => {
  it("returns the server-side tally for the caller's own task", async () => {
    const app = await buildApp(ORGANIZER_A);
    const res = await app.request(`http://test/api/v1/tasks/${TASK_ID}/delete-preview`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({
      taskId: TASK_ID,
      title: "Submit W-9",
      counts: { assigned: 5, completed: 2, responses: 1, files: 1 },
    });
  });

  it("404s for another org's task", async () => {
    const app = await buildApp(ORGANIZER_B);
    const res = await app.request(`http://test/api/v1/tasks/${TASK_ID}/delete-preview`);
    expect(res.status).toBe(403);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("forbidden");
  });

  it("404s for a task id that does not exist at all", async () => {
    const app = await buildApp(ORGANIZER_A);
    const res = await app.request(`http://test/api/v1/tasks/does-not-exist/delete-preview`);
    expect(res.status).toBe(404);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("not_found");
  });
});
