// DEC-322 wave-78 amendment: event.branding_json had three parsers and two
// shapes (server/repo/events.ts's toBranding returning EventBranding | null
// with no sanitization; byte-identical hand-parses in
// routes/public/shell.tsx and routes/public/submit-views.tsx returning {}
// when absent and DOING sanitize). This file covers the one replacement
// parser (src/domain/event-branding.ts) and the read door
// (GET /api/v1/events/:id) that now always emits a present `branding`
// object instead of null.

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { drizzle } from "drizzle-orm/sqlite-proxy";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Hono } from "hono";
import * as schema from "../src/db/schema";
import { registerErrorHandler } from "../src/server/http";
import type { AppEnv, AuthInfo } from "../src/server/env";
import type { Db } from "../src/server/context";
import { newId } from "../src/domain/ids";
import { parseEventBranding } from "../src/domain/event-branding";
import { eventsRoutes } from "../src/routes/api/events";

// ---------------------------------------------------------------------------
// Pure contract: src/domain/event-branding.ts
// ---------------------------------------------------------------------------

describe("parseEventBranding", () => {
  it("returns a present empty object for null/undefined/absent-key input", () => {
    expect(parseEventBranding(null)).toEqual({});
    expect(parseEventBranding(undefined)).toEqual({});
    expect(parseEventBranding("")).toEqual({});
    expect(parseEventBranding("{}")).toEqual({});
  });

  it("drops a hostile javascript: logoUrl but keeps accentColor", () => {
    const result = parseEventBranding(JSON.stringify({ logoUrl: "javascript:alert(1)", accentColor: "#336699" }));
    expect(result.logoUrl).toBeUndefined();
    expect(result.accentColor).toBe("#336699");
    expect(result).not.toHaveProperty("logoUrl");
  });

  it("passes through a safe https logoUrl and accentColor verbatim", () => {
    const result = parseEventBranding(JSON.stringify({ logoUrl: "https://x.test/l.png", accentColor: "#123456" }));
    expect(result).toEqual({ logoUrl: "https://x.test/l.png", accentColor: "#123456" });
  });

  it("accepts a root-relative logoUrl", () => {
    const result = parseEventBranding(JSON.stringify({ logoUrl: "/files/logo.png" }));
    expect(result.logoUrl).toBe("/files/logo.png");
  });
});

// ---------------------------------------------------------------------------
// Read door: GET /api/v1/events/:id emits `branding: {}` (never null) for an
// event with no branding row.
// ---------------------------------------------------------------------------

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

describe("GET /api/v1/events/:id branding read door", () => {
  let db: Db;
  let sqlite: DatabaseSync;

  beforeEach(() => {
    ({ db, sqlite } = makeTestDb());
  });

  afterEach(() => {
    sqlite.close();
  });

  it("emits branding: {} (never null) for an event with no branding row", async () => {
    const now = new Date();
    const orgId = newId();
    const userId = newId();
    const eventId = newId();

    await db.insert(schema.org).values({ id: orgId, name: "An Org", createdAt: now, updatedAt: now });
    await db.insert(schema.user).values({
      id: userId,
      orgId,
      email: `organiser-${newId()}@example.test`,
      passwordHash: "not-a-real-hash",
      role: "organizer",
      contactId: null,
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(schema.event).values({
      id: eventId,
      orgId,
      name: "A Conference",
      slug: `event-${newId()}`,
      startDate: "2027-05-01",
      endDate: "2027-05-03",
      location: null,
      timezone: "America/Chicago",
      recordPrefix: "SES",
      brandingJson: null,
      createdAt: now,
      updatedAt: now,
    });

    const app = new Hono<AppEnv>();
    registerErrorHandler(app);
    const auth: AuthInfo = { userId, role: "organizer", orgId };
    app.use("*", async (c, next) => {
      c.set("db", db);
      c.set("auth", auth);
      await next();
    });
    app.route("/api/v1", eventsRoutes);

    const res = await app.request(new Request(`http://local/api/v1/events/${eventId}`));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { branding: unknown };
    expect(body.branding).toEqual({});
    expect(body.branding).not.toBeNull();
  });
});
