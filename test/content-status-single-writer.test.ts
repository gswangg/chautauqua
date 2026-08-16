// DEC-720 (wave-32 amendment): `changes_requested` no longer has exactly one
// writer. The prior ROUTE_SETTABLE_CONTENT_STATUSES / isRouteSettableContentStatus
// predicate forced every 'changes_requested' transition through POST
// /api/v1/submissions/:id/content-note, which unconditionally mails — that
// inverted DEC-009 ("status changes never auto-email") for the one content
// status that matters most at volume. Both bare content-status routes
// (single: src/routes/files.ts, bulk: src/routes/api/submissions.ts) now
// validate against isValidContentStatus (the DB-VALUE predicate) and accept
// 'pending'/'approved'/'changes_requested' with no mail sent.
// content-notes.ts remains a SEPARATE, deliberate action: it posts a note,
// optionally flips content-status, and optionally mails — untouched here.

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
import { isValidContentStatus } from "../src/server/repo/files-content-status";

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

const ORG_ID = "org-1";
const EVENT_ID = "event-1";
const CONTACT_ID = "contact-speaker-1";

function seedCore(sqlite: DatabaseSync) {
  const now = Date.now();
  sqlite.prepare(`insert into org (id, name, created_at, updated_at) values (?, 'Org', ?, ?)`).run(ORG_ID, now, now);
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
  sqlite
    .prepare(
      `insert into user (id, org_id, email, password_hash, role, created_at, updated_at)
       values ('u-org', ?, 'organizer@example.com', 'x', 'organizer', ?, ?)`,
    )
    .run(ORG_ID, now, now);
}

function seedSubmission(sqlite: DatabaseSync, id: string, seq: number, contentStatus: string) {
  const now = Date.now();
  sqlite
    .prepare(
      `insert into submission (id, event_id, seq, title, status, content_status, created_at, updated_at)
       values (?, ?, ?, ?, 'accepted', ?, ?, ?)`,
    )
    .run(id, EVENT_ID, seq, `Talk ${seq}`, contentStatus, now, now);
  sqlite
    .prepare(
      `insert into participant (id, submission_id, contact_id, invite_status, created_at, updated_at)
       values (?, ?, ?, 'accepted', ?, ?)`,
    )
    .run(newId(), id, CONTACT_ID, now, now);
}

function readContentStatus(sqlite: DatabaseSync, id: string): string {
  const row = sqlite.prepare(`select content_status from submission where id = ?`).get(id) as
    | { content_status: string }
    | undefined;
  if (!row) throw new Error(`submission ${id} not found`);
  return row.content_status;
}

const ORGANIZER: AuthInfo = { userId: "u-org", role: "organizer", orgId: ORG_ID };

async function buildFilesApp(db: Db) {
  const { fileApiRoutes } = await import("../src/routes/files");
  const app = new Hono<AppEnv>();
  registerErrorHandler(app);
  app.use("*", async (c, next) => {
    c.set("auth", ORGANIZER);
    c.set("db", db);
    await next();
  });
  app.route("/api/v1", fileApiRoutes);
  return app;
}

async function buildSubmissionsApp(db: Db) {
  const { submissionsRoutes } = await import("../src/routes/api/submissions");
  const app = new Hono<AppEnv>();
  registerErrorHandler(app);
  app.use("*", async (c, next) => {
    c.set("auth", ORGANIZER);
    c.set("db", db);
    await next();
  });
  app.route("/api/v1", submissionsRoutes);
  return app;
}

describe("isValidContentStatus", () => {
  it("accepts all three DB values", () => {
    expect(isValidContentStatus("pending")).toBe(true);
    expect(isValidContentStatus("approved")).toBe(true);
    expect(isValidContentStatus("changes_requested")).toBe(true);
    expect(isValidContentStatus("bogus")).toBe(false);
  });
});

describe("POST /api/v1/submissions/:id/content-status (single route)", () => {
  let db: Db;
  let sqlite: DatabaseSync;

  beforeEach(() => {
    ({ db, sqlite } = makeTestDb());
    seedCore(sqlite);
  });

  afterEach(() => {
    sqlite.close();
  });

  it("200s on changes_requested and writes the row", async () => {
    seedSubmission(sqlite, "sub-1", 1, "pending");
    const app = await buildFilesApp(db);
    const res = await app.request(
      new Request("http://test.local/api/v1/submissions/sub-1/content-status", {
        method: "POST",
        headers: { "content-type": "application/json", "x-chq-csrf": "1" },
        body: JSON.stringify({ contentStatus: "changes_requested" }),
      }),
    );
    expect(res.status).toBe(200);
    expect(readContentStatus(sqlite, "sub-1")).toBe("changes_requested");
  });

  it("400s on an unrelated invalid value, naming all three settable values", async () => {
    seedSubmission(sqlite, "sub-2", 2, "pending");
    const app = await buildFilesApp(db);
    const res = await app.request(
      new Request("http://test.local/api/v1/submissions/sub-2/content-status", {
        method: "POST",
        headers: { "content-type": "application/json", "x-chq-csrf": "1" },
        body: JSON.stringify({ contentStatus: "bogus" }),
      }),
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { message: string } };
    expect(body.error.message).toContain("contentStatus must be 'pending', 'approved' or 'changes_requested'");
    expect(readContentStatus(sqlite, "sub-2")).toBe("pending");
  });

  it("200s on approved", async () => {
    seedSubmission(sqlite, "sub-3", 3, "pending");
    const app = await buildFilesApp(db);
    const res = await app.request(
      new Request("http://test.local/api/v1/submissions/sub-3/content-status", {
        method: "POST",
        headers: { "content-type": "application/json", "x-chq-csrf": "1" },
        body: JSON.stringify({ contentStatus: "approved" }),
      }),
    );
    expect(res.status).toBe(200);
    expect(readContentStatus(sqlite, "sub-3")).toBe("approved");
  });

  it("200s on pending", async () => {
    seedSubmission(sqlite, "sub-4", 4, "approved");
    const app = await buildFilesApp(db);
    const res = await app.request(
      new Request("http://test.local/api/v1/submissions/sub-4/content-status", {
        method: "POST",
        headers: { "content-type": "application/json", "x-chq-csrf": "1" },
        body: JSON.stringify({ contentStatus: "pending" }),
      }),
    );
    expect(res.status).toBe(200);
    expect(readContentStatus(sqlite, "sub-4")).toBe("pending");
  });
});

describe("POST /api/v1/events/:eventId/submissions/content-status (bulk route)", () => {
  let db: Db;
  let sqlite: DatabaseSync;

  beforeEach(() => {
    ({ db, sqlite } = makeTestDb());
    seedCore(sqlite);
  });

  afterEach(() => {
    sqlite.close();
  });

  it("200s on changes_requested for the batch", async () => {
    seedSubmission(sqlite, "sub-b1", 1, "pending");
    const app = await buildSubmissionsApp(db);
    const res = await app.request(
      new Request(`http://test.local/api/v1/events/${EVENT_ID}/submissions/content-status`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-chq-csrf": "1" },
        body: JSON.stringify({ ids: ["sub-b1"], contentStatus: "changes_requested" }),
      }),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ updated: 1 });
    expect(readContentStatus(sqlite, "sub-b1")).toBe("changes_requested");
  });

  it("200s on approved for the batch", async () => {
    seedSubmission(sqlite, "sub-b2", 2, "pending");
    const app = await buildSubmissionsApp(db);
    const res = await app.request(
      new Request(`http://test.local/api/v1/events/${EVENT_ID}/submissions/content-status`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-chq-csrf": "1" },
        body: JSON.stringify({ ids: ["sub-b2"], contentStatus: "approved" }),
      }),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ updated: 1 });
    expect(readContentStatus(sqlite, "sub-b2")).toBe("approved");
  });

  it("200s on pending for the batch", async () => {
    seedSubmission(sqlite, "sub-b3", 3, "approved");
    const app = await buildSubmissionsApp(db);
    const res = await app.request(
      new Request(`http://test.local/api/v1/events/${EVENT_ID}/submissions/content-status`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-chq-csrf": "1" },
        body: JSON.stringify({ ids: ["sub-b3"], contentStatus: "pending" }),
      }),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ updated: 1 });
    expect(readContentStatus(sqlite, "sub-b3")).toBe("pending");
  });
});

// content-notes.ts stays a separate, deliberate action: it posts a note,
// optionally flips content-status, and optionally mails, via
// updateContentStatus directly. This is unchanged by this task.
const contentNotesSource = readFileSync(join(__dirname, "..", "src", "routes", "content-notes.ts"), "utf8");

describe("content-notes.ts is untouched", () => {
  it("writes via updateContentStatus", () => {
    expect(contentNotesSource).toMatch(
      /updateContentStatus\(c\.var\.db, scope\.eventId, submissionId, "changes_requested"\)/,
    );
  });
});
