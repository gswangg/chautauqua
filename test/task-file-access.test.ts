// DEC-065/DEC-248 regression coverage: GET /files/:fileId for task-assignment
// uploads. Organizer org-match or the assigned speaker (assignment contact or
// uploader) may download; every other speaker and cross-org organizer get
// denied. Repo calls are mocked so these are pure route-level
// access-decision tests (no D1/wrangler dependency in stage 1) — same
// pattern as test/review-idor.test.ts.
//
// DEC-248 widened getTaskFileScope's population from kind='handout'-only to
// ANY kind (still submissionId-null + referenced by task_assignment.fileId);
// submission-linked task uploads remain a disjoint population served
// through getFileScope. The "getTaskFileScope against a fake db" describe
// block below exercises the real (non-mocked) repo function directly to pin
// that population rule.

import { afterEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { registerErrorHandler } from "../src/server/http";
import type { AppEnv, AuthInfo } from "../src/server/env";
import { canAccessTaskFile } from "../src/server/repo/files";

const ORG_A = "org-a";
const ORG_B = "org-b";

const taskFileScope = {
  fileId: "file-task-1",
  orgId: ORG_A,
  assignmentContactId: "contact-assigned",
  uploadedByContactId: null as string | null,
  filename: "handout.pdf",
  contentType: "application/pdf",
  r2Key: "task/file-task-1/handout.pdf",
};

// DEC-248: a non-'handout' kind file (e.g. 'presentation') that is
// submissionId-null and referenced by a task_assignment is still in the
// getTaskFileScope population — the kind gate was dropped.
const presentationTaskFileScope = {
  fileId: "file-task-presentation",
  orgId: ORG_A,
  assignmentContactId: "contact-assigned",
  uploadedByContactId: null as string | null,
  filename: "slides.pptx",
  contentType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  r2Key: "task/file-task-presentation/slides.pptx",
};

vi.mock("../src/server/repo/files", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/files")>("../src/server/repo/files");
  return {
    ...actual,
    getFileScope: vi.fn(async () => null),
    getResourceFileScope: vi.fn(async () => null),
    getTaskFileScope: vi.fn(async (_db: unknown, fileId: string) => {
      if (fileId === taskFileScope.fileId) return taskFileScope;
      if (fileId === presentationTaskFileScope.fileId) return presentationTaskFileScope;
      return null;
    }),
  };
});

afterEach(() => {
  vi.clearAllMocks();
});

function fakeFilesBucket() {
  return {
    async get() {
      return {
        body: new ReadableStream(),
        httpMetadata: { contentType: taskFileScope.contentType },
        size: 10,
      };
    },
    async put() {},
    async delete() {},
  } as unknown as R2Bucket;
}

async function buildApp(auth: AuthInfo) {
  const { fileServeRoutes } = await import("../src/routes/files");
  const app = new Hono<AppEnv>();
  registerErrorHandler(app);
  app.use("*", async (c, next) => {
    c.set("auth", auth);
    c.set("db", {} as never);
    c.env = { ...(c.env ?? {}), FILES: fakeFilesBucket() } as never;
    await next();
  });
  app.route("/", fileServeRoutes);
  return app;
}

describe("canAccessTaskFile (pure DEC-065 authz check)", () => {
  it("allows the same-org organizer", () => {
    expect(canAccessTaskFile({ role: "organizer", orgId: ORG_A }, taskFileScope)).toBe(true);
  });

  it("denies a cross-org organizer", () => {
    expect(canAccessTaskFile({ role: "organizer", orgId: ORG_B }, taskFileScope)).toBe(false);
  });

  it("allows the assigned speaker", () => {
    expect(canAccessTaskFile({ role: "speaker", orgId: ORG_A, contactId: "contact-assigned" }, taskFileScope)).toBe(
      true,
    );
  });

  it("allows the uploader speaker even if not the assignment contact", () => {
    const scope = { ...taskFileScope, uploadedByContactId: "contact-uploader" };
    expect(canAccessTaskFile({ role: "speaker", orgId: ORG_A, contactId: "contact-uploader" }, scope)).toBe(true);
  });

  it("denies another speaker (IDOR)", () => {
    expect(canAccessTaskFile({ role: "speaker", orgId: ORG_A, contactId: "someone-else" }, taskFileScope)).toBe(
      false,
    );
  });

  it("denies reviewers", () => {
    expect(canAccessTaskFile({ role: "reviewer", orgId: ORG_A, contactId: "contact-assigned" }, taskFileScope)).toBe(
      false,
    );
  });
});

describe("DEC-065: GET /files/:fileId for task-assignment handout uploads", () => {
  it("200s for the same-org organizer", async () => {
    const app = await buildApp({ userId: "u1", role: "organizer", orgId: ORG_A });
    const res = await app.request(`/files/${taskFileScope.fileId}`);
    expect(res.status).toBe(200);
  });

  it("200s for the assigned speaker", async () => {
    const app = await buildApp({ userId: "u2", role: "speaker", orgId: ORG_A, contactId: "contact-assigned" });
    const res = await app.request(`/files/${taskFileScope.fileId}`);
    expect(res.status).toBe(200);
  });

  it("403s for another speaker (IDOR)", async () => {
    const app = await buildApp({ userId: "u3", role: "speaker", orgId: ORG_A, contactId: "contact-other" });
    const res = await app.request(`/files/${taskFileScope.fileId}`);
    expect(res.status).toBe(403);
  });

  it("403s for a cross-org organizer", async () => {
    const app = await buildApp({ userId: "u4", role: "organizer", orgId: ORG_B });
    const res = await app.request(`/files/${taskFileScope.fileId}`);
    expect(res.status).toBe(403);
  });

  it("404s when no task_assignment references the file", async () => {
    const app = await buildApp({ userId: "u1", role: "organizer", orgId: ORG_A });
    const res = await app.request(`/files/unknown-file`);
    expect(res.status).toBe(404);
  });

  // DEC-248: kind='presentation' (non-'handout') submissionId-null file
  // referenced by a task_assignment is still served through this same
  // fileServeRoutes/authzServeFile -> getTaskFileScope path.
  it("200s for the same-org organizer on a non-'handout'-kind task upload (DEC-248)", async () => {
    const app = await buildApp({ userId: "u1", role: "organizer", orgId: ORG_A });
    const res = await app.request(`/files/${presentationTaskFileScope.fileId}`);
    expect(res.status).toBe(200);
  });

  it("200s for the assigned speaker on a non-'handout'-kind task upload (DEC-248)", async () => {
    const app = await buildApp({ userId: "u2", role: "speaker", orgId: ORG_A, contactId: "contact-assigned" });
    const res = await app.request(`/files/${presentationTaskFileScope.fileId}`);
    expect(res.status).toBe(200);
  });
});

describe("getTaskFileScope against a fake db (DEC-248 population rule, real implementation)", () => {
  // Minimal fake drizzle-chain query object: from/innerJoin/where are no-ops
  // that return `this`, limit resolves the canned rows. Mirrors the two
  // sequential db.select(...) calls inside getTaskFileScope.
  function makeQuery(rows: unknown[]) {
    const query = {
      from: () => query,
      innerJoin: () => query,
      where: () => query,
      limit: () => Promise.resolve(rows),
    };
    return query;
  }

  function makeFakeDb(fileRows: unknown[], assignmentRows: unknown[]) {
    let call = 0;
    return {
      select: () => {
        call += 1;
        return call === 1 ? makeQuery(fileRows) : makeQuery(assignmentRows);
      },
    } as unknown as import("../src/server/context").Db;
  }

  it("returns null for a submission-linked task upload (disjoint from getFileScope's population)", async () => {
    const actual = await vi.importActual<typeof import("../src/server/repo/files")>("../src/server/repo/files");
    const fakeDb = makeFakeDb(
      [
        {
          id: "file-linked",
          kind: "handout",
          submissionId: "submission-1",
          filename: "f.pdf",
          contentType: "application/pdf",
          r2Key: "k",
          uploadedByContactId: null,
        },
      ],
      [],
    );
    const scope = await actual.getTaskFileScope(fakeDb, "file-linked");
    expect(scope).toBeNull();
  });

  it("returns a scope for a kind='presentation' submissionId-null file referenced by an assignment (DEC-248)", async () => {
    const actual = await vi.importActual<typeof import("../src/server/repo/files")>("../src/server/repo/files");
    const fakeDb = makeFakeDb(
      [
        {
          id: "file-presentation",
          kind: "presentation",
          submissionId: null,
          filename: "slides.pptx",
          contentType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
          r2Key: "k",
          uploadedByContactId: null,
        },
      ],
      [{ assignmentContactId: "contact-assigned", orgId: ORG_A }],
    );
    const scope = await actual.getTaskFileScope(fakeDb, "file-presentation");
    expect(scope).not.toBeNull();
    expect(scope?.orgId).toBe(ORG_A);
    expect(scope?.assignmentContactId).toBe("contact-assigned");
  });

  it("DEC-248 amendment (wave 10): resolves via the file's own task_assignment_id when task_assignment.fileId was never written (kind='form' upload path)", async () => {
    const actual = await vi.importActual<typeof import("../src/server/repo/files")>("../src/server/repo/files");
    const fakeDb = makeFakeDb(
      [
        {
          id: "file-form-task",
          kind: "handout",
          submissionId: null,
          filename: "receipt.pdf",
          contentType: "application/pdf",
          r2Key: "k",
          uploadedByContactId: "contact-uploader",
          taskAssignmentId: "assignment-1",
        },
      ],
      [{ assignmentContactId: "contact-assigned", orgId: ORG_A }],
    );
    const scope = await actual.getTaskFileScope(fakeDb, "file-form-task");
    expect(scope).not.toBeNull();
    expect(scope?.orgId).toBe(ORG_A);
    expect(scope?.assignmentContactId).toBe("contact-assigned");
  });

  it("returns null for an unreferenced submissionId-null file (no population leak)", async () => {
    const actual = await vi.importActual<typeof import("../src/server/repo/files")>("../src/server/repo/files");
    const fakeDb = makeFakeDb(
      [
        {
          id: "file-orphan",
          kind: "presentation",
          submissionId: null,
          filename: "orphan.pptx",
          contentType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
          r2Key: "k",
          uploadedByContactId: null,
        },
      ],
      [],
    );
    const scope = await actual.getTaskFileScope(fakeDb, "file-orphan");
    expect(scope).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// DEC-248 wave-70 amendment: the file's OWN task_assignment_id must be
// authoritative over the reverse task_assignment.fileId link when the two
// links name DIFFERENT assignments (different speakers). Exercised against a
// real (in-memory) SQLite engine via node:sqlite + drizzle-orm's sqlite-proxy
// driver -- same technique as test/file-version-identity.test.ts -- so
// "physical row order" is a real, independent variable a fake row-array
// mock can't represent: the two assignment rows are inserted in each
// possible order across two test cases, and both must resolve to the SAME
// speaker (the file's own link), proving the old or()+limit(1)-with-no-
// orderBy query (whose winner SQLite alone decided) is gone.
// ---------------------------------------------------------------------------
describe("getTaskFileScope precedence: own task_assignment_id beats the reverse fileId link (DEC-248, real db)", () => {
  const DDL = `
    create table event (
      id text primary key,
      org_id text
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
      uploaded_by_contact_id text,
      task_assignment_id text,
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

  // Seeds the shared fixture: event/task/file rows are identical across both
  // orderings; only the INSERT ORDER of the two conflicting task_assignment
  // rows (A = the file's own link, B = a second assignment whose fileId also
  // points at the file) differs between the two test cases.
  function seedShared(sqlite: import("node:sqlite").DatabaseSync) {
    sqlite.prepare(`insert into event (id, org_id) values ('event-1', 'org-a')`).run();
    sqlite.prepare(`insert into task (id, event_id) values ('task-1', 'event-1')`).run();
    // The file's OWN link names assignment-A.
    sqlite
      .prepare(
        `insert into file (id, submission_id, kind, filename, r2_key, size_bytes, content_type, uploaded_by_contact_id, task_assignment_id, created_at, updated_at)
         values ('file-1', null, 'presentation', 'slides.pptx', 'k', 10, 'application/pdf', null, 'assignment-A', 0, 0)`,
      )
      .run();
  }

  it("resolves to speaker A (the file's own link) when B is inserted BEFORE A", async () => {
    const actual = await vi.importActual<typeof import("../src/server/repo/files-authz")>(
      "../src/server/repo/files-authz",
    );
    const { db, sqlite } = await makeTestDb();
    seedShared(sqlite);
    // B first: a second assignment whose reverse fileId link also names this file.
    sqlite
      .prepare(
        `insert into task_assignment (id, task_id, contact_id, status, file_id, created_at, updated_at)
         values ('assignment-B', 'task-1', 'contact-B', 'complete', 'file-1', 0, 0)`,
      )
      .run();
    sqlite
      .prepare(
        `insert into task_assignment (id, task_id, contact_id, status, file_id, created_at, updated_at)
         values ('assignment-A', 'task-1', 'contact-A', 'complete', null, 1, 1)`,
      )
      .run();

    const scope = await actual.getTaskFileScope(db, "file-1");
    expect(scope).not.toBeNull();
    expect(scope?.assignmentContactId).toBe("contact-A");
    expect(actual.canAccessTaskFile({ role: "speaker", orgId: "org-a", contactId: "contact-A" }, scope!)).toBe(true);
    expect(actual.canAccessTaskFile({ role: "speaker", orgId: "org-a", contactId: "contact-B" }, scope!)).toBe(false);
    sqlite.close();
  });

  it("resolves to speaker A (the file's own link) when A is inserted BEFORE B", async () => {
    const actual = await vi.importActual<typeof import("../src/server/repo/files-authz")>(
      "../src/server/repo/files-authz",
    );
    const { db, sqlite } = await makeTestDb();
    seedShared(sqlite);
    // A first this time -- physical order flipped; the outcome must not change.
    sqlite
      .prepare(
        `insert into task_assignment (id, task_id, contact_id, status, file_id, created_at, updated_at)
         values ('assignment-A', 'task-1', 'contact-A', 'complete', null, 0, 0)`,
      )
      .run();
    sqlite
      .prepare(
        `insert into task_assignment (id, task_id, contact_id, status, file_id, created_at, updated_at)
         values ('assignment-B', 'task-1', 'contact-B', 'complete', 'file-1', 1, 1)`,
      )
      .run();

    const scope = await actual.getTaskFileScope(db, "file-1");
    expect(scope).not.toBeNull();
    expect(scope?.assignmentContactId).toBe("contact-A");
    expect(actual.canAccessTaskFile({ role: "speaker", orgId: "org-a", contactId: "contact-A" }, scope!)).toBe(true);
    expect(actual.canAccessTaskFile({ role: "speaker", orgId: "org-a", contactId: "contact-B" }, scope!)).toBe(false);
    sqlite.close();
  });
});
