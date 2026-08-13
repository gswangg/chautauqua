// w43-f (DEC-020 amendment, wave 43): a replace must keep every version and
// its thread, on BOTH upload surfaces. This runs the REAL routes
// (src/routes/files.ts's fileApiRoutes, src/routes/portal/tasks.tsx's
// portalTasksRoutes) against a REAL SQLite engine migrated through every
// migrations/*.sql file (same technique as test/file-version-identity.test.ts
// and test/plan-delete-cascade.test.ts, extended to run the actual migration
// set instead of a hand-written DDL subset) -- so both the pure core
// (files-versions.ts) AND the route wiring around it (authz scope lookups,
// replacesFileId plumbing, the DEC-922 portal chain guard) are exercised
// end to end, not mocked away. Verdict: both paths already hold — see the
// commit message for the file:line evidence this test freezes as a P0
// regression guard.

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { drizzle } from "drizzle-orm/sqlite-proxy";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Hono } from "hono";
import * as schema from "../src/db/schema";
import { registerErrorHandler } from "../src/server/http";
import type { AppEnv, AuthInfo } from "../src/server/env";
import { newId } from "../src/domain/ids";
import type { Db } from "../src/server/context";

const MIGRATIONS_DIR = join(__dirname, "..", "migrations");

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

function fakeFilesBucket() {
  const store = new Map<string, Uint8Array>();
  return {
    bucket: {
      async put(key: string, data: unknown) {
        store.set(key, new Uint8Array([1, 2, 3]));
        void data;
      },
      async get(key: string) {
        const buf = store.get(key);
        if (!buf) return null;
        const copy = new Uint8Array(buf.length);
        copy.set(buf);
        return { body: new Response(copy).body, size: buf.length };
      },
      async delete(key: string) {
        store.delete(key);
      },
    } as unknown as R2Bucket,
  };
}

const ORG_ID = "org-1";
const EVENT_ID = "event-1";
const CONTACT_ID = "contact-speaker-1";

function seedCore(sqlite: DatabaseSync) {
  const now = Date.now();
  sqlite
    .prepare(`insert into org (id, name, created_at, updated_at) values (?, 'Org', ?, ?)`)
    .run(ORG_ID, now, now);
  sqlite
    .prepare(
      `insert into event (id, org_id, name, slug, start_date, end_date, timezone, created_at, updated_at)
       values (?, ?, 'Event', 'event-1', '2026-01-01', '2026-01-02', 'America/New_York', ?, ?)`,
    )
    .run(EVENT_ID, ORG_ID, now, now);
  sqlite
    .prepare(
      `insert into contact (id, org_id, first_name, last_name, email, created_at, updated_at)
       values (?, ?, 'Speaker', 'One', 'speaker@example.com', ?, ?)`,
    )
    .run(CONTACT_ID, ORG_ID, now, now);
  // author_user_id on a file_comment row joins back to `user` — listFileComments
  // throws loudly on an unresolvable author, so the organizer actor needs a row.
  sqlite
    .prepare(
      `insert into user (id, org_id, email, password_hash, role, created_at, updated_at)
       values ('u-org', ?, 'organizer@example.com', 'x', 'organizer', ?, ?)`,
    )
    .run(ORG_ID, now, now);
}

function seedSubmission(sqlite: DatabaseSync, id: string, seq: number, opts?: { status?: string }) {
  const now = Date.now();
  sqlite
    .prepare(
      `insert into submission (id, event_id, seq, title, status, content_status, created_at, updated_at)
       values (?, ?, ?, ?, ?, 'pending', ?, ?)`,
    )
    .run(id, EVENT_ID, seq, `Talk ${seq}`, opts?.status ?? "accepted", now, now);
  sqlite
    .prepare(
      `insert into participant (id, submission_id, contact_id, invite_status, created_at, updated_at)
       values (?, ?, ?, 'accepted', ?, ?)`,
    )
    .run(newId(), id, CONTACT_ID, now, now);
}

async function buildOrganizerApp(db: Db) {
  const { fileApiRoutes } = await import("../src/routes/files");
  const { bucket } = fakeFilesBucket();
  const app = new Hono<AppEnv>();
  registerErrorHandler(app);
  const auth: AuthInfo = { userId: "u-org", role: "organizer", orgId: ORG_ID };
  app.use("*", async (c, next) => {
    c.set("auth", auth);
    c.set("db", db);
    c.env = { ...(c.env ?? {}), FILES: bucket } as never;
    await next();
  });
  app.route("/api/v1", fileApiRoutes);
  return app;
}

async function buildPortalApp(db: Db) {
  const { portalTasksRoutes } = await import("../src/routes/portal/tasks");
  const { bucket } = fakeFilesBucket();
  const app = new Hono<AppEnv>();
  registerErrorHandler(app);
  const auth: AuthInfo = { userId: "u-speaker", role: "speaker", orgId: ORG_ID, contactId: CONTACT_ID };
  app.use("*", async (c, next) => {
    c.set("auth", auth);
    c.set("db", db);
    c.env = { ...(c.env ?? {}), FILES: bucket } as never;
    await next();
  });
  app.route("/portal", portalTasksRoutes);
  return app;
}

describe("a replace keeps every version and its thread (DEC-020, w43-f)", () => {
  let db: Db;
  let sqlite: DatabaseSync;

  beforeEach(() => {
    ({ db, sqlite } = makeTestDb());
    seedCore(sqlite);
  });

  afterEach(() => {
    sqlite.close();
  });

  // -------------------------------------------------------------------
  // Organizer surface: POST /api/v1/submissions/:id/files
  // -------------------------------------------------------------------
  it("organizer path: replacesFileId chains onto v1, the v1 thread survives, GET lists v1+v2", async () => {
    const submissionId = "sub-org-1";
    seedSubmission(sqlite, submissionId, 1);
    const app = await buildOrganizerApp(db);

    // 1) upload v1.
    const form1 = new FormData();
    form1.set("file", new File([new Uint8Array([1, 2, 3])], "slides-v1.pdf", { type: "application/pdf" }));
    form1.set("kind", "presentation");
    const res1 = await app.request(
      new Request(`http://test.local/api/v1/submissions/${submissionId}/files`, {
        method: "POST",
        headers: { "x-chq-csrf": "1" },
        body: form1,
      }),
    );
    expect(res1.status).toBe(201);
    const { id: v1Id } = (await res1.json()) as { id: string };

    // 2) post a comment on v1 while it's still the head.
    const commentRes = await app.request(
      new Request(`http://test.local/api/v1/files/${v1Id}/comments`, {
        method: "POST",
        headers: { "x-chq-csrf": "1", "content-type": "application/json" },
        body: JSON.stringify({ body: "please tighten slide 4" }),
      }),
    );
    expect(commentRes.status).toBe(201);

    // 3) replace with v2, naming replacesFileId = v1.
    const form2 = new FormData();
    form2.set("file", new File([new Uint8Array([4, 5, 6])], "slides-v2.pdf", { type: "application/pdf" }));
    form2.set("kind", "presentation");
    form2.set("replacesFileId", v1Id);
    const res2 = await app.request(
      new Request(`http://test.local/api/v1/submissions/${submissionId}/files`, {
        method: "POST",
        headers: { "x-chq-csrf": "1" },
        body: form2,
      }),
    );
    expect(res2.status).toBe(201);
    const { id: v2Id } = (await res2.json()) as { id: string };
    expect(v2Id).not.toBe(v1Id);

    // 4) GET the submission's files: exactly TWO rows for 'presentation',
    // versionNo 1 and 2, v2.previousFileId === v1Id — not a collapsed
    // single row, not two independent v1 chains.
    const listRes = await app.request(new Request(`http://test.local/api/v1/submissions/${submissionId}/files`));
    expect(listRes.status).toBe(200);
    const listBody = (await listRes.json()) as { items: { id: string; kind: string; versionNo: number; previousFileId: string | null }[] };
    const presentationRows = listBody.items.filter((it) => it.kind === "presentation");
    expect(presentationRows).toHaveLength(2);
    const byVersion = new Map(presentationRows.map((r) => [r.versionNo, r]));
    expect(byVersion.get(1)?.id).toBe(v1Id);
    expect(byVersion.get(2)?.id).toBe(v2Id);
    expect(byVersion.get(2)?.previousFileId).toBe(v1Id);

    // 5) the v1 comment is still reachable on the deliverable thread when
    // queried through EITHER end of the chain (listFileComments walks the
    // whole chain, not just the literal fileId passed in).
    const commentsViaV2 = await app.request(new Request(`http://test.local/api/v1/files/${v2Id}/comments`));
    const commentsViaV2Body = (await commentsViaV2.json()) as { items: { body: string }[] };
    expect(commentsViaV2Body.items.map((c) => c.body)).toContain("please tighten slide 4");

    const commentsViaV1 = await app.request(new Request(`http://test.local/api/v1/files/${v1Id}/comments`));
    const commentsViaV1Body = (await commentsViaV1.json()) as { items: { body: string }[] };
    expect(commentsViaV1Body.items.map((c) => c.body)).toContain("please tighten slide 4");
  });

  // -------------------------------------------------------------------
  // Portal surface: POST /portal/tasks/:assignmentId/upload
  // -------------------------------------------------------------------
  it("portal path: two uploads on the same submission chain v1+v2, task_assignment.file_id follows to the head", async () => {
    const submissionId = "sub-portal-1";
    seedSubmission(sqlite, submissionId, 1);
    const now = Date.now();
    const taskId = "task-1";
    const assignmentId = "assignment-1";
    sqlite
      .prepare(
        `insert into task (id, event_id, kind, title, deliverable_kind, created_at, updated_at)
         values (?, ?, 'file_request', 'Upload slides', 'presentation', ?, ?)`,
      )
      .run(taskId, EVENT_ID, now, now);
    sqlite
      .prepare(
        `insert into task_assignment (id, task_id, contact_id, status, created_at, updated_at)
         values (?, ?, ?, 'pending', ?, ?)`,
      )
      .run(assignmentId, taskId, CONTACT_ID, now, now);

    const app = await buildPortalApp(db);

    async function upload(filename: string) {
      const form = new FormData();
      form.set("chq_csrf", "tok-1");
      form.set("file", new File([new Uint8Array([1, 2, 3])], filename, { type: "application/pdf" }));
      form.set("submissionId", submissionId);
      return app.request(
        new Request(`http://test.local/portal/tasks/${assignmentId}/upload`, {
          method: "POST",
          headers: { cookie: "chq_csrf=tok-1" },
          body: form,
        }),
      );
    }

    const res1 = await upload("slides-v1.pdf");
    expect(res1.status).toBe(302);
    const afterFirst = sqlite.prepare(`select file_id from task_assignment where id = ?`).get(assignmentId) as {
      file_id: string;
    };
    const v1Id = afterFirst.file_id;
    expect(v1Id).toBeTruthy();

    const res2 = await upload("slides-v2.pdf");
    expect(res2.status).toBe(302);
    const afterSecond = sqlite.prepare(`select file_id from task_assignment where id = ?`).get(assignmentId) as {
      file_id: string;
    };
    const v2Id = afterSecond.file_id;
    expect(v2Id).not.toBe(v1Id);

    // task_assignment.file_id follows to the head (v2), never two
    // independent v1 chains.
    const rows = sqlite
      .prepare(`select id, version_no, previous_file_id from file where submission_id = ? and kind = 'presentation'`)
      .all(submissionId) as { id: string; version_no: number; previous_file_id: string | null }[];
    expect(rows).toHaveLength(2);
    const byVersion = new Map(rows.map((r) => [r.version_no, r]));
    expect(byVersion.get(1)?.id).toBe(v1Id);
    expect(byVersion.get(2)?.id).toBe(v2Id);
    expect(byVersion.get(2)?.previous_file_id).toBe(v1Id);

    // GET /tasks/:id/file streams the CHAIN-LATEST (v2), not v1.
    const fileRes = await app.request(new Request(`http://test.local/portal/tasks/${assignmentId}/file`));
    expect(fileRes.status).toBe(200);
    expect(fileRes.headers.get("content-disposition")).toContain("slides-v2.pdf");
  });

  it("portal path: DEC-891 picker left on the SAME submission across re-uploads still chains (not two v1 chains)", async () => {
    const submissionA = "sub-portal-a";
    const submissionB = "sub-portal-b";
    seedSubmission(sqlite, submissionA, 1);
    seedSubmission(sqlite, submissionB, 2);
    const now = Date.now();
    const taskId = "task-2";
    const assignmentId = "assignment-2";
    sqlite
      .prepare(
        `insert into task (id, event_id, kind, title, deliverable_kind, created_at, updated_at)
         values (?, ?, 'file_request', 'Upload slides', 'presentation', ?, ?)`,
      )
      .run(taskId, EVENT_ID, now, now);
    sqlite
      .prepare(
        `insert into task_assignment (id, task_id, contact_id, status, created_at, updated_at)
         values (?, ?, ?, 'pending', ?, ?)`,
      )
      .run(assignmentId, taskId, CONTACT_ID, now, now);

    const app = await buildPortalApp(db);

    async function upload(filename: string, submissionId: string) {
      const form = new FormData();
      form.set("chq_csrf", "tok-1");
      form.set("file", new File([new Uint8Array([1, 2, 3])], filename, { type: "application/pdf" }));
      form.set("submissionId", submissionId);
      return app.request(
        new Request(`http://test.local/portal/tasks/${assignmentId}/upload`, {
          method: "POST",
          headers: { cookie: "chq_csrf=tok-1" },
          body: form,
        }),
      );
    }

    // Two candidates exist (submissionA, submissionB); the speaker names
    // submissionA both times (DEC-891 picker "left on the same submission").
    await upload("v1.pdf", submissionA);
    await upload("v2.pdf", submissionA);

    const rowsA = sqlite
      .prepare(`select id, version_no, previous_file_id from file where submission_id = ? and kind = 'presentation'`)
      .all(submissionA) as { id: string; version_no: number; previous_file_id: string | null }[];
    expect(rowsA).toHaveLength(2);
    const byVersion = new Map(rowsA.map((r) => [r.version_no, r]));
    expect(byVersion.get(2)?.previous_file_id).toBe(byVersion.get(1)?.id);

    const rowsB = sqlite
      .prepare(`select id from file where submission_id = ?`)
      .all(submissionB) as { id: string }[];
    expect(rowsB).toHaveLength(0);
  });
});
