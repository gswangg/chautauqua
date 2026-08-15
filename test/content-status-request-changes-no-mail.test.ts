// DEC-720 wave-32 amendment: `changes_requested` is now reachable through
// the two bare content-status doors (single: src/routes/files.ts, bulk:
// src/routes/api/submissions.ts) without going through
// POST /api/v1/submissions/:id/content-note. This test proves, decisively,
// that neither door sends any mail — the mailer spy (mirroring
// test/content-note.test.ts's makeMailer mock) is never constructed, and
// no email_log rows land, for either single or bulk writes into
// 'changes_requested'.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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

const makeMailerSpy = vi.fn();
vi.mock("../src/server/context", async () => {
  const actual = await vi.importActual<typeof import("../src/server/context")>("../src/server/context");
  return {
    ...actual,
    makeMailer: (...args: unknown[]) => {
      makeMailerSpy(...args);
      return actual.makeMailer(...(args as Parameters<typeof actual.makeMailer>));
    },
  };
});

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

function countEmailLogRows(sqlite: DatabaseSync): number {
  const row = sqlite.prepare(`select count(*) as n from email_log`).get() as { n: number };
  return row.n;
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

describe("content-status doors reach 'changes_requested' with no mail (DEC-720 wave-32)", () => {
  let db: Db;
  let sqlite: DatabaseSync;

  beforeEach(() => {
    ({ db, sqlite } = makeTestDb());
    seedCore(sqlite);
    makeMailerSpy.mockClear();
  });

  afterEach(() => {
    sqlite.close();
  });

  it("single door: 200s on changes_requested, moves the row, and sends no mail", async () => {
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
    expect(await res.json()).toEqual({ id: "sub-1", contentStatus: "changes_requested" });
    expect(readContentStatus(sqlite, "sub-1")).toBe("changes_requested");
    expect(makeMailerSpy).not.toHaveBeenCalled();
    expect(countEmailLogRows(sqlite)).toBe(0);
  });

  it("bulk door: 200s with { updated: N } over N ids, moves every row, and sends no mail", async () => {
    seedSubmission(sqlite, "sub-b1", 1, "pending");
    seedSubmission(sqlite, "sub-b2", 2, "approved");
    seedSubmission(sqlite, "sub-b3", 3, "pending");
    const app = await buildSubmissionsApp(db);
    const res = await app.request(
      new Request(`http://test.local/api/v1/events/${EVENT_ID}/submissions/content-status`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-chq-csrf": "1" },
        body: JSON.stringify({ ids: ["sub-b1", "sub-b2", "sub-b3"], contentStatus: "changes_requested" }),
      }),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ updated: 3 });
    expect(readContentStatus(sqlite, "sub-b1")).toBe("changes_requested");
    expect(readContentStatus(sqlite, "sub-b2")).toBe("changes_requested");
    expect(readContentStatus(sqlite, "sub-b3")).toBe("changes_requested");
    expect(makeMailerSpy).not.toHaveBeenCalled();
    expect(countEmailLogRows(sqlite)).toBe(0);
  });
});
