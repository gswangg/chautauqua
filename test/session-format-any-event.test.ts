// DEC-592/DEC-755 (wave 10, task w10-b): role, not the seeded literal id, is
// the ONE matcher for the session-format field. This exercises the whole
// loop end to end against a real SQLite harness (migrated through every
// migrations/*.sql file, mirroring test/form-field-role.test.ts's
// technique) on a freshly created event that the seed script never touched
// — proving the read/write/filter/duration paths all work for arbitrary
// per-event data, not just the seeded demo (the no-eval-gaming rule).

import { beforeEach, describe, expect, it } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { drizzle } from "drizzle-orm/sqlite-proxy";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Hono } from "hono";
import * as schema from "../src/db/schema";
import { registerErrorHandler } from "../src/server/http";
import type { AppEnv, AuthInfo } from "../src/server/env";
import type { Db } from "../src/server/context";
import { submissionsRoutes } from "../src/routes/api/submissions";
import { getOrCreateForm } from "../src/server/repo/forms";
import { getPublicSessions } from "../src/server/repo/public/sessions";
import type { PublicEvent } from "../src/server/repo/public/event";
import { loadDurationMinBySubmission } from "../src/server/repo/agenda/rows";

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
const EVENT_SLUG = "event-1";

function seedEvent(sqlite: DatabaseSync, eventId: string, slug: string) {
  const now = Date.now();
  sqlite.prepare(`insert into org (id, name, created_at, updated_at) values (?, 'Org', ?, ?)`).run(ORG_ID, now, now);
  sqlite
    .prepare(
      `insert into event (id, org_id, name, slug, start_date, end_date, timezone, created_at, updated_at)
       values (?, ?, 'Event', ?, '2026-01-01', '2026-01-02', 'America/New_York', ?, ?)`,
    )
    .run(eventId, ORG_ID, slug, now, now);
}

function buildApp(db: Db, auth: AuthInfo) {
  const app = new Hono<AppEnv>();
  registerErrorHandler(app);
  app.use("*", async (c, next) => {
    c.set("db", db);
    c.set("auth", auth);
    await next();
  });
  app.route("/api/v1", submissionsRoutes);
  return app;
}

function postRequest(path: string, body: unknown) {
  return new Request(`http://local${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-chq-csrf": "1" },
    body: JSON.stringify(body),
  });
}

function patchRequest(path: string, body: unknown) {
  return new Request(`http://local${path}`, {
    method: "PATCH",
    headers: { "content-type": "application/json", "x-chq-csrf": "1" },
    body: JSON.stringify(body),
  });
}

describe("session-format is resolved by role on a fresh, never-seeded event (DEC-592/DEC-755)", () => {
  let db: Db;
  let sqlite: DatabaseSync;

  beforeEach(() => {
    ({ db, sqlite } = makeTestDb());
    seedEvent(sqlite, EVENT_ID, EVENT_SLUG);
  });

  it("POST create writes the role-tagged answer, the public read/format-filter/duration all resolve it, and PATCH {format:null} clears it", async () => {
    // createDefaultForm mints the role-tagged field — never a seed-script
    // literal id (this event was never touched by scripts/seed.ts).
    const { fields } = await getOrCreateForm(db, EVENT_ID);
    const formatField = fields.find((f) => f.role === "session_format");
    expect(formatField).toBeDefined();
    expect(formatField!.id).not.toBe("field_session_format"); // per-form PK, not the seed's literal
    expect(formatField!.options).toContain("Talk (30 min)");

    const auth: AuthInfo = { userId: "u1", role: "organizer", orgId: ORG_ID };
    const app = buildApp(db, auth);

    // POST create with a format value.
    const createRes = await app.request(
      postRequest(`/api/v1/events/${EVENT_ID}/submissions`, { title: "New Talk", format: "Talk (30 min)" }),
    );
    expect(createRes.status).toBe(201);
    const created = (await createRes.json()) as { id: string; answers: Record<string, unknown> };
    expect(created.answers[formatField!.id]).toBe("Talk (30 min)");
    const submissionId = created.id;

    // Publicly visible per DEC-274's session gate (status=accepted,
    // content_status=approved) — set directly, acceptance flow is out of
    // this task's scope.
    sqlite.prepare(`update submission set status = 'accepted', content_status = 'approved' where id = ?`).run(submissionId);

    const publicEvent: PublicEvent = {
      id: EVENT_ID,
      orgId: ORG_ID,
      name: "Event",
      slug: EVENT_SLUG,
      startDate: "2026-01-01",
      endDate: "2026-01-02",
      location: null,
      timezone: "America/New_York",
      recordPrefix: "SES",
      brandingJson: null,
    };

    // Public sessions read shows the format.
    const page = await getPublicSessions(db, publicEvent, { trackId: null, page: 1, perPage: 20 });
    expect(page.items.find((i) => i.id === submissionId)?.format).toBe("Talk (30 min)");

    // ?format= filter matches on the exact value, excludes a non-matching one.
    const matching = await getPublicSessions(db, publicEvent, {
      trackId: null,
      page: 1,
      perPage: 20,
      format: "Talk (30 min)",
    });
    expect(matching.items.map((i) => i.id)).toContain(submissionId);
    const nonMatching = await getPublicSessions(db, publicEvent, {
      trackId: null,
      page: 1,
      perPage: 20,
      format: "Keynote (45 min)",
    });
    expect(nonMatching.items.map((i) => i.id)).not.toContain(submissionId);

    // loadDurationMinBySubmission derives the duration from the "(N min)"
    // suffix rather than falling back to the passed-in default.
    const durationMap = await loadDurationMinBySubmission(db, EVENT_ID, [submissionId], 15);
    expect(durationMap.get(submissionId)).toBe(30);

    // PATCH {format:null} clears the answer rather than 400ing.
    const patchRes = await app.request(patchRequest(`/api/v1/submissions/${submissionId}`, { format: null }));
    expect(patchRes.status).toBe(200);
    const patched = (await patchRes.json()) as { answers: Record<string, unknown> };
    expect(patched.answers[formatField!.id]).toBeUndefined();

    const pageAfterClear = await getPublicSessions(db, publicEvent, { trackId: null, page: 1, perPage: 20 });
    expect(pageAfterClear.items.find((i) => i.id === submissionId)?.format).toBeNull();

    const durationAfterClear = await loadDurationMinBySubmission(db, EVENT_ID, [submissionId], 15);
    expect(durationAfterClear.get(submissionId)).toBe(15); // falls back to the caller's default
  });
});
