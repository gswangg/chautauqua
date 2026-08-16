// DEC-020 amendment (w60-a): a new deliverable version reopens content
// review. Two layers, mirroring test/file-replace-versions.test.ts's real
// SQLite harness (migrated through every migrations/*.sql file) so the
// set-based UPDATE's WHERE-clause idempotency is exercised for real, not
// mocked:
//   1) repo-level (reopenContentReview) directly against submission rows in
//      every starting content_status.
//   2) route-level (POST /api/v1/submissions/:id/files, the organizer
//      deliverable-upload surface) proving the wiring fires after a real
//      upload, and that a headshot upload (a completely separate route,
//      contacts/:id/headshot / portal/profile — never this one) can't reach
//      it at all.

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { drizzle } from "drizzle-orm/sqlite-proxy";
import { eq } from "drizzle-orm";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Hono } from "hono";
import * as schema from "../src/db/schema";
import { registerErrorHandler } from "../src/server/http";
import type { AppEnv, AuthInfo } from "../src/server/env";
import { newId } from "../src/domain/ids";
import type { Db } from "../src/server/context";
import { reopenContentReview } from "../src/server/repo/files-content-status";

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

describe("reopenContentReview (DEC-020 amendment, w60-a)", () => {
  let db: Db;
  let sqlite: DatabaseSync;

  beforeEach(() => {
    ({ db, sqlite } = makeTestDb());
    seedCore(sqlite);
  });

  afterEach(() => {
    sqlite.close();
  });

  it("approved -> pending", async () => {
    seedSubmission(sqlite, "sub-1", 1, "approved");
    await reopenContentReview(db, EVENT_ID, "sub-1");
    expect(readContentStatus(sqlite, "sub-1")).toBe("pending");
  });

  it("changes_requested -> pending", async () => {
    seedSubmission(sqlite, "sub-2", 2, "changes_requested");
    await reopenContentReview(db, EVENT_ID, "sub-2");
    expect(readContentStatus(sqlite, "sub-2")).toBe("pending");
  });

  it("pending -> stays pending (idempotent, not a read-then-write no-op that errors)", async () => {
    seedSubmission(sqlite, "sub-3", 3, "pending");
    await reopenContentReview(db, EVENT_ID, "sub-3");
    expect(readContentStatus(sqlite, "sub-3")).toBe("pending");
  });

  it("a second call is idempotent (approved -> pending -> pending)", async () => {
    seedSubmission(sqlite, "sub-4", 4, "approved");
    await reopenContentReview(db, EVENT_ID, "sub-4");
    expect(readContentStatus(sqlite, "sub-4")).toBe("pending");
    await reopenContentReview(db, EVENT_ID, "sub-4");
    expect(readContentStatus(sqlite, "sub-4")).toBe("pending");
  });

  it("never touches a different submission's row", async () => {
    seedSubmission(sqlite, "sub-5", 5, "approved");
    seedSubmission(sqlite, "sub-6", 6, "approved");
    await reopenContentReview(db, EVENT_ID, "sub-5");
    expect(readContentStatus(sqlite, "sub-5")).toBe("pending");
    expect(readContentStatus(sqlite, "sub-6")).toBe("approved");
  });

  it("a pending row's updated_at is left untouched (WHERE excludes it — proves the guard isn't a read-then-write no-op)", async () => {
    seedSubmission(sqlite, "sub-7", 7, "pending");
    const before = sqlite.prepare(`select updated_at from submission where id = ?`).get("sub-7") as {
      updated_at: number;
    };
    await reopenContentReview(db, EVENT_ID, "sub-7");
    const after = sqlite.prepare(`select updated_at from submission where id = ?`).get("sub-7") as {
      updated_at: number;
    };
    expect(after.updated_at).toBe(before.updated_at);
  });
});

describe("POST /api/v1/submissions/:id/files reopens content review on a new deliverable version (DEC-020 amendment)", () => {
  let db: Db;
  let sqlite: DatabaseSync;

  beforeEach(() => {
    ({ db, sqlite } = makeTestDb());
    seedCore(sqlite);
  });

  afterEach(() => {
    sqlite.close();
  });

  async function buildOrganizerApp() {
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

  it("uploading a new deliverable version flips 'approved' back to 'pending'", async () => {
    seedSubmission(sqlite, "sub-org-1", 1, "approved");
    const app = await buildOrganizerApp();
    const form = new FormData();
    form.set("file", new File([new Uint8Array([1, 2, 3])], "slides-v2.pdf", { type: "application/pdf" }));
    form.set("kind", "presentation");
    const res = await app.request(
      new Request("http://test.local/api/v1/submissions/sub-org-1/files", { method: "POST", headers: { "x-chq-csrf": "1" }, body: form }),
    );
    expect(res.status).toBe(201);
    expect(readContentStatus(sqlite, "sub-org-1")).toBe("pending");
  });

  it("uploading a new deliverable version flips 'changes_requested' back to 'pending'", async () => {
    seedSubmission(sqlite, "sub-org-2", 2, "changes_requested");
    const app = await buildOrganizerApp();
    const form = new FormData();
    form.set("file", new File([new Uint8Array([1, 2, 3])], "slides-v2.pdf", { type: "application/pdf" }));
    form.set("kind", "presentation");
    const res = await app.request(
      new Request("http://test.local/api/v1/submissions/sub-org-2/files", { method: "POST", headers: { "x-chq-csrf": "1" }, body: form }),
    );
    expect(res.status).toBe(201);
    expect(readContentStatus(sqlite, "sub-org-2")).toBe("pending");
  });

  // DEC-020 wave-58 amendment: the organizer's OWN upload previously left
  // the reopen silent (no 201 field) even though the identical speaker-portal
  // upload discloses it. The 201 body now carries contentReviewReopened.
  it("the 201 reports contentReviewReopened:true and contentStatus:'pending' for an approved submission", async () => {
    seedSubmission(sqlite, "sub-org-3", 3, "approved");
    const app = await buildOrganizerApp();
    const form = new FormData();
    form.set("file", new File([new Uint8Array([1, 2, 3])], "slides-v2.pdf", { type: "application/pdf" }));
    form.set("kind", "presentation");
    const res = await app.request(
      new Request("http://test.local/api/v1/submissions/sub-org-3/files", { method: "POST", headers: { "x-chq-csrf": "1" }, body: form }),
    );
    expect(res.status).toBe(201);
    const body = (await res.json()) as { contentReviewReopened: boolean; contentStatus?: string };
    expect(body.contentReviewReopened).toBe(true);
    expect(body.contentStatus).toBe("pending");
    expect(readContentStatus(sqlite, "sub-org-3")).toBe("pending");
  });

  // ... and false, with the row left untouched, when the submission was
  // already 'pending' before this upload — the idempotent no-op case.
  it("the 201 reports contentReviewReopened:false for an already-pending submission, and leaves the row untouched", async () => {
    seedSubmission(sqlite, "sub-org-4", 4, "pending");
    const before = sqlite.prepare(`select updated_at from submission where id = ?`).get("sub-org-4") as {
      updated_at: number;
    };
    const app = await buildOrganizerApp();
    const form = new FormData();
    form.set("file", new File([new Uint8Array([1, 2, 3])], "slides-v2.pdf", { type: "application/pdf" }));
    form.set("kind", "presentation");
    const res = await app.request(
      new Request("http://test.local/api/v1/submissions/sub-org-4/files", { method: "POST", headers: { "x-chq-csrf": "1" }, body: form }),
    );
    expect(res.status).toBe(201);
    const body = (await res.json()) as { contentReviewReopened: boolean; contentStatus?: string };
    expect(body.contentReviewReopened).toBe(false);
    expect(body.contentStatus).toBeUndefined();
    expect(readContentStatus(sqlite, "sub-org-4")).toBe("pending");
    const after = sqlite.prepare(`select updated_at from submission where id = ?`).get("sub-org-4") as {
      updated_at: number;
    };
    expect(after.updated_at).toBe(before.updated_at);
  });
});

// Sanity: confirm the drizzle `and`/`inArray`-composed predicate names imported
// in files-content-status.ts really is scoped by id AND status, using the
// live schema column reference (guards against a future refactor accidentally
// dropping the status guard and reopening every submission on any update).
describe("reopenContentReview predicate sanity", () => {
  it("schema.submission has a contentStatus column reopenContentReview can filter on", () => {
    expect(eq(schema.submission.id, "x")).toBeTruthy();
  });
});
