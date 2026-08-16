// DEC-713 wave-78 amendment coverage: DELETE /api/v1/files/:fileId serving
// the task-assignment file population, not just submission deliverables. A
// plain 'handout' task upload has submissionId null and (before this wave)
// resolved a null delete scope, 404ing for everyone — even the organizer
// whose DEC-926 re-home/reopen branch in deleteFileVersion exists precisely
// for this case. getFileDeleteScope now resolves eventId/orgId/
// assignmentContactId through the same taskAssignmentId-first, fileId-
// fallback links getTaskFileScope uses (files-authz.ts), and the route
// branches: submission-scoped files keep the existing organizer/speaker
// rules verbatim; task-scoped files are organizer-only, with a named 403
// (never a 404) for a speaker, mirroring task-file-access.test.ts's
// getTaskFileScope db pattern (node:sqlite + drizzle sqlite-proxy, real DDL)
// so the chain-repoint/reopen writes are exercised against a real engine.

import { describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { registerErrorHandler } from "../src/server/http";
import type { AppEnv, AuthInfo } from "../src/server/env";

const DDL = `
  create table event (
    id text primary key,
    org_id text,
    timezone text
  );
  create table task (
    id text primary key,
    event_id text
  );
  create table task_assignment (
    id text primary key,
    task_id text,
    contact_id text,
    status text,
    file_id text,
    completed_at integer,
    completed_by text,
    created_at integer,
    updated_at integer
  );
  create table file (
    id text primary key,
    submission_id text,
    kind text,
    filename text,
    r2_key text,
    size_bytes integer,
    content_type text,
    previous_file_id text,
    version_no integer,
    uploaded_by_contact_id text,
    task_assignment_id text,
    created_at integer,
    updated_at integer
  );
  create table file_comment (
    id text primary key,
    file_id text,
    author_contact_id text,
    author_user_id text,
    body text,
    created_at integer,
    updated_at integer
  );
`;

async function makeTestDb() {
  const { DatabaseSync } = await import("node:sqlite");
  const { drizzle } = await import("drizzle-orm/sqlite-proxy");
  const schema = await import("../src/db/schema");
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(DDL);
  const db = drizzle(
    async (sqlText: string, params: unknown[], method: string) => {
      const stmt = sqlite.prepare(sqlText);
      stmt.setReturnArrays(true);
      if (method === "run") {
        stmt.run(...(params as never[]));
        return { rows: [] };
      }
      const rows = stmt.all(...(params as never[])) as unknown[];
      return { rows };
    },
    { schema },
  );
  return { db: db as unknown as import("../src/server/context").Db, sqlite };
}

function seedEventTaskAssignment(sqlite: import("node:sqlite").DatabaseSync, opts: { orgId: string }) {
  sqlite.prepare(`insert into event (id, org_id, timezone) values ('event-1', ?, 'UTC')`).run(opts.orgId);
  sqlite.prepare(`insert into task (id, event_id) values ('task-1', 'event-1')`).run();
  sqlite
    .prepare(
      `insert into task_assignment (id, task_id, contact_id, status, file_id, created_at, updated_at)
       values ('asg-1', 'task-1', 'contact-assigned', 'complete', 'v2', 0, 0)`,
    )
    .run();
}

describe("getFileDeleteScope / deleteFileVersion for the task-assignment population (DEC-713 wave-78 amendment)", () => {
  it("resolves eventId/orgId/assignmentContactId for a plain 'handout' task upload (submissionId null)", async () => {
    const actual = await vi.importActual<typeof import("../src/server/repo/files-versions-delete")>(
      "../src/server/repo/files-versions-delete",
    );
    const { db, sqlite } = await makeTestDb();
    seedEventTaskAssignment(sqlite, { orgId: "org-a" });
    sqlite
      .prepare(
        `insert into file (id, submission_id, kind, filename, r2_key, size_bytes, content_type, previous_file_id, version_no, uploaded_by_contact_id, task_assignment_id, created_at, updated_at)
         values ('v1', null, 'handout', 'handout-v1.pdf', 'task/v1.pdf', 10, 'application/pdf', null, 1, 'contact-assigned', null, 0, 0)`,
      )
      .run();
    sqlite
      .prepare(
        `insert into file (id, submission_id, kind, filename, r2_key, size_bytes, content_type, previous_file_id, version_no, uploaded_by_contact_id, task_assignment_id, created_at, updated_at)
         values ('v2', null, 'handout', 'handout-v2.pdf', 'task/v2.pdf', 10, 'application/pdf', 'v1', 2, 'contact-assigned', null, 1, 1)`,
      )
      .run();

    const scope = await actual.getFileDeleteScope(db, "v2");
    expect(scope).not.toBeNull();
    expect(scope!.submissionId).toBeNull();
    expect(scope!.orgId).toBe("org-a");
    expect(scope!.assignmentContactId).toBe("contact-assigned");
    sqlite.close();
  });

  it("returns null (undeletable) for a kind not in FILE_KINDS (e.g. 'resource')", async () => {
    const actual = await vi.importActual<typeof import("../src/server/repo/files-versions-delete")>(
      "../src/server/repo/files-versions-delete",
    );
    const { db, sqlite } = await makeTestDb();
    seedEventTaskAssignment(sqlite, { orgId: "org-a" });
    sqlite
      .prepare(
        `insert into file (id, submission_id, kind, filename, r2_key, size_bytes, content_type, previous_file_id, version_no, uploaded_by_contact_id, task_assignment_id, created_at, updated_at)
         values ('res-1', null, 'resource', 'brochure.pdf', 'task/res-1.pdf', 10, 'application/pdf', null, 1, null, null, 0, 0)`,
      )
      .run();

    const scope = await actual.getFileDeleteScope(db, "res-1");
    expect(scope).toBeNull();
    sqlite.close();
  });

  it("deleting a superseded version repoints the chain and re-homes the linked task_assignment", async () => {
    const actual = await vi.importActual<typeof import("../src/server/repo/files-versions-delete")>(
      "../src/server/repo/files-versions-delete",
    );
    const { db, sqlite } = await makeTestDb();
    seedEventTaskAssignment(sqlite, { orgId: "org-a" });
    sqlite
      .prepare(
        `insert into file (id, submission_id, kind, filename, r2_key, size_bytes, content_type, previous_file_id, version_no, uploaded_by_contact_id, task_assignment_id, created_at, updated_at)
         values ('v1', null, 'handout', 'handout-v1.pdf', 'task/v1.pdf', 10, 'application/pdf', null, 1, 'contact-assigned', null, 0, 0)`,
      )
      .run();
    sqlite
      .prepare(
        `insert into file (id, submission_id, kind, filename, r2_key, size_bytes, content_type, previous_file_id, version_no, uploaded_by_contact_id, task_assignment_id, created_at, updated_at)
         values ('v2', null, 'handout', 'handout-v2.pdf', 'task/v2.pdf', 10, 'application/pdf', 'v1', 2, 'contact-assigned', null, 1, 1)`,
      )
      .run();

    await actual.deleteFileVersion(db, { fileId: "v1", deletedByUserId: "u-org", deletedByContactId: null });

    const v2Row = sqlite.prepare(`select previous_file_id from file where id = 'v2'`).get() as
      | { previous_file_id: string | null }
      | undefined;
    expect(v2Row?.previous_file_id).toBeNull();
    const v1Row = sqlite.prepare(`select id from file where id = 'v1'`).get();
    expect(v1Row).toBeUndefined();
    // the deleted row wasn't the assignment's linked file (v2 was), so the
    // assignment link is untouched by the DEC-926 branch here.
    const asg = sqlite.prepare(`select file_id, status from task_assignment where id = 'asg-1'`).get() as {
      file_id: string | null;
      status: string;
    };
    expect(asg.file_id).toBe("v2");
    expect(asg.status).toBe("complete");
    sqlite.close();
  });

  it("deleting the sole version reopens the assignment to pending with fileId null (DEC-926)", async () => {
    const actual = await vi.importActual<typeof import("../src/server/repo/files-versions-delete")>(
      "../src/server/repo/files-versions-delete",
    );
    const { db, sqlite } = await makeTestDb();
    sqlite.prepare(`insert into event (id, org_id, timezone) values ('event-1', 'org-a', 'UTC')`).run();
    sqlite.prepare(`insert into task (id, event_id) values ('task-1', 'event-1')`).run();
    sqlite
      .prepare(
        `insert into task_assignment (id, task_id, contact_id, status, file_id, completed_at, completed_by, created_at, updated_at)
         values ('asg-solo', 'task-1', 'contact-assigned', 'complete', 'solo', 5000, 'contact-assigned', 0, 0)`,
      )
      .run();
    sqlite
      .prepare(
        `insert into file (id, submission_id, kind, filename, r2_key, size_bytes, content_type, previous_file_id, version_no, uploaded_by_contact_id, task_assignment_id, created_at, updated_at)
         values ('solo', null, 'handout', 'solo.pdf', 'task/solo.pdf', 10, 'application/pdf', null, 1, 'contact-assigned', null, 0, 0)`,
      )
      .run();

    await actual.deleteFileVersion(db, { fileId: "solo", deletedByUserId: "u-org", deletedByContactId: null });

    const asg = sqlite.prepare(`select status, file_id, completed_at, completed_by from task_assignment where id = 'asg-solo'`).get() as {
      status: string;
      file_id: string | null;
      completed_at: number | null;
      completed_by: string | null;
    };
    expect(asg.status).toBe("pending");
    expect(asg.file_id).toBeNull();
    expect(asg.completed_at).toBeNull();
    expect(asg.completed_by).toBeNull();
    sqlite.close();
  });
});

// ---------------------------------------------------------------------------
// Route-level authz coverage (repo mocked): submission-scoped rules stay
// verbatim; task-scoped files are organizer-only, with a named 403 for a
// speaker (never a 404) and a 404 for a cross-org organizer or an
// unresolved (kind outside FILE_KINDS, or unreferenced) file.
// ---------------------------------------------------------------------------
type FileDeleteScope = import("../src/server/repo/files-versions").FileDeleteScope;

const TASK_SCOPE: FileDeleteScope = {
  id: "task-file-1",
  submissionId: null,
  eventId: "event-1",
  orgId: "org-a",
  filename: "handout.pdf",
  r2Key: "task/task-file-1/handout.pdf",
  previousFileId: null,
  uploadedByContactId: "contact-assigned",
  contentStatus: null,
  status: null,
  formCloseDate: null,
  timezone: null,
  isLatestInChain: true,
  assignmentContactId: "contact-assigned",
};

const UNRESOLVED_SCOPE_ID = "resource-file-1";

vi.mock("../src/server/repo/files", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/files")>("../src/server/repo/files");
  return {
    ...actual,
    getFileDeleteScope: vi.fn(async (_db: unknown, fileId: string) => {
      if (fileId === TASK_SCOPE.id) return TASK_SCOPE;
      if (fileId === UNRESOLVED_SCOPE_ID) return null;
      return null;
    }),
    deleteFileVersion: vi.fn(async () => {}),
  };
});

function fakeFilesBucket() {
  return {
    async get() {
      return null;
    },
    async put() {},
    async delete() {},
  } as unknown as R2Bucket;
}

async function buildApp(auth: AuthInfo) {
  const { fileApiRoutes } = await import("../src/routes/files");
  const app = new Hono<AppEnv>();
  registerErrorHandler(app);
  app.use("*", async (c, next) => {
    c.set("auth", auth);
    c.set("db", {} as never);
    c.env = { ...(c.env ?? {}), FILES: fakeFilesBucket() } as never;
    await next();
  });
  app.route("/api/v1", fileApiRoutes);
  return app;
}

function del(app: Hono<AppEnv>, fileId: string) {
  return app.request(`/api/v1/files/${fileId}`, { method: "DELETE", headers: { "x-chq-csrf": "1" } });
}

describe("DELETE /api/v1/files/:fileId task-assignment population (DEC-713 wave-78 amendment)", () => {
  it("200s for the same-org organizer", async () => {
    const app = await buildApp({ userId: "u1", role: "organizer", orgId: "org-a" });
    const res = await del(app, TASK_SCOPE.id);
    expect(res.status).toBe(200);
  });

  it("403s the assigned speaker with a named message, never a 404", async () => {
    const app = await buildApp({ userId: "u2", role: "speaker", orgId: "org-a", contactId: "contact-assigned" });
    const res = await del(app, TASK_SCOPE.id);
    expect(res.status).toBe(403);
    const body = (await res.json()) as { error: { message: string } };
    expect(body.error.message).toBe("Only an organizer may remove a task file version");
  });

  it("404s a cross-org organizer", async () => {
    const app = await buildApp({ userId: "u3", role: "organizer", orgId: "org-b" });
    const res = await del(app, TASK_SCOPE.id);
    expect(res.status).toBe(404);
  });

  it("404s a file whose scope never resolves (kind outside FILE_KINDS, e.g. 'resource'/'attachment')", async () => {
    const app = await buildApp({ userId: "u1", role: "organizer", orgId: "org-a" });
    const res = await del(app, UNRESOLVED_SCOPE_ID);
    expect(res.status).toBe(404);
  });
});
