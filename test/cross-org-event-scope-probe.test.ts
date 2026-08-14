// DEC-459/DEC-727 (task w37-a): an enumerated wrong-ORG runtime probe over
// the /api/v1/events/:id/* route family -- the family the SPA parameterizes
// straight from client-controlled localStorage ('chq.currentEventId',
// app/src/lib/useCurrentEvent.ts:22). Every sibling probe
// (anonymous-route-probe, role-refusal-probe) proves a wrong ROLE or NO
// session refuses; none of them ever hands a route a REAL row from a
// DIFFERENT org while authenticated with the RIGHT role. This is the
// TENANT axis those files' own "OPEN" note names.
//
// Technique (deliberately duplicated from, not shared with, the siblings --
// DEC-459 rule 4): parseIndexMounts() + registerErrorHandler compose the
// real app exactly as test/anonymous-route-probe.test.ts does. Unlike the
// siblings, the db is REAL: an in-memory node:sqlite DatabaseSync + drizzle
// sqlite-proxy driver against DDL concatenated from every migrations/*.sql
// file on disk (same technique as test/rate-limit-atomicity.test.ts), with
// two real orgs seeded -- org A (event, track, room, contact, submission)
// and org B (its own event + an organizer user). Route registrations are
// enumerated from SOURCE (enumerateRegisteredRoutes(), the same static
// scanner test/pubcache-purge-classification.test.ts uses) rather than
// runtime introspection, filtered to the /api/v1/events/:id/* family, so
// this probe's route list can never silently narrow just because the
// composed app's runtime route table changed shape.
//
// Every enumerated (method, path) is requested TWICE as an organizer of ORG
// B, substituting ORG A's real eventId for the :eventId segment: once via a
// session actor (c.set("auth", ...) directly in the wildcard middleware,
// the same shortcut the siblings use) and once via a REAL bearer API token
// minted for org B, going through the actual sessionLoader middleware
// (extractBearerToken/resolveBearerAuth, src/server/middleware.ts:111-145)
// so the bearer resolution path is exercised for real, not stubbed --  a
// token is the same tenant axis through a different door. x-chq-csrf: 1
// rides on every mutating request so CSRF is never what refuses.
//
// Finding from building this probe (wave 37): none -- every one of the 47
// enumerated /api/v1/events/:eventId/* registrations resolves the event (or
// a resource nested under it) through an org-scoped lookup BEFORE reading
// or validating any request body, so an org-B organizer's request for
// org-A's eventId always 404s (existence-hiding, per DEC-612/613's "never
// leaks existence" comment in src/routes/api/import.ts) before ever
// touching an org-A row. The GET /api/v1/events/:eventId/export/:kind route
// is the one place this probe had to supply a real value (`kind=
// submissions`) rather than a generic literal -- isExportKind(kind) is
// checked before the ownership lookup, so a placeholder literal would 400
// instead of exercising the ownership check at all; ledgering that literal
// substitution here (not loosening the probe to accept 400) is what keeps
// the assertion meaningful. No route needed a code change.
//
// The db is a REAL row store, not a throwing stub: the probe additionally
// snapshots every org-A table before the sweep and asserts it is
// byte-identical after -- a refusal that quietly mutated the victim's rows
// would not be a refusal (field guide: "A REFUSAL THAT MUTATES IS NOT A
// REFUSAL").

import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { drizzle } from "drizzle-orm/sqlite-proxy";
import { Hono } from "hono";
import * as schema from "../src/db/schema";
import type { Db } from "../src/server/context";
import type { AppEnv, AuthInfo } from "../src/server/env";
import { registerErrorHandler } from "../src/server/http";
import { guardDevMailbox } from "../src/server/app";
import { sessionLoader } from "../src/server/middleware";
import { hashToken, newApiToken, apiTokenDisplayPrefix } from "../src/auth/tokens";
import { parseIndexMounts } from "./helpers/index-mounts";
import { enumerateRegisteredRoutes } from "./helpers/registered-routes";

// ---------------------------------------------------------------------------
// Real in-memory D1-shaped db: DDL concatenated from every migrations/*.sql
// file on disk (same technique as test/rate-limit-atomicity.test.ts).
// ---------------------------------------------------------------------------

const MIGRATIONS_DIR = path.join(__dirname, "..", "migrations");

function loadFullDdl(): string {
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  return files.map((f) => readFileSync(path.join(MIGRATIONS_DIR, f), "utf8")).join("\n");
}

function makeSqliteDb(): { db: Db; sqlite: DatabaseSync } {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(loadFullDdl());
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
// Fixture: org A (event/track/room/contact/submission) + org B (event +
// organizer user + a real minted bearer token).
// ---------------------------------------------------------------------------

const ORG_A = "org-a-probe";
const ORG_B = "org-b-probe";
const EVENT_A = "event-a-probe";
const EVENT_B = "event-b-probe";
const TRACK_A = "track-a-probe";
const ROOM_A = "room-a-probe";
const CONTACT_A = "contact-a-probe";
const SUBMISSION_A = "submission-a-probe";
const ORG_B_USER = "user-b-organizer-probe";

interface Fixture {
  db: Db;
  sqlite: DatabaseSync;
  bearerToken: string;
}

async function buildFixture(): Promise<Fixture> {
  const { db, sqlite } = makeSqliteDb();
  const now = new Date(1_700_000_000_000);

  await db.insert(schema.org).values([
    { id: ORG_A, name: "Org A", createdAt: now, updatedAt: now },
    { id: ORG_B, name: "Org B", createdAt: now, updatedAt: now },
  ]);

  await db.insert(schema.event).values([
    {
      id: EVENT_A,
      orgId: ORG_A,
      name: "Event A",
      slug: "event-a-probe-slug",
      startDate: "2027-01-01",
      endDate: "2027-01-03",
      location: null,
      timezone: "UTC",
      recordPrefix: "SES",
      brandingJson: null,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: EVENT_B,
      orgId: ORG_B,
      name: "Event B",
      slug: "event-b-probe-slug",
      startDate: "2027-02-01",
      endDate: "2027-02-03",
      location: null,
      timezone: "UTC",
      recordPrefix: "SES",
      brandingJson: null,
      createdAt: now,
      updatedAt: now,
    },
  ]);

  await db.insert(schema.track).values({
    id: TRACK_A,
    eventId: EVENT_A,
    name: "General",
    color: null,
    position: 0,
    externalRef: null,
    createdAt: now,
    updatedAt: now,
  });

  await db.insert(schema.room).values({
    id: ROOM_A,
    eventId: EVENT_A,
    name: "Main Hall",
    capacity: 100,
    position: 0,
    createdAt: now,
    updatedAt: now,
  });

  await db.insert(schema.contact).values({
    id: CONTACT_A,
    orgId: ORG_A,
    firstName: "Ada",
    lastName: "Speaker",
    email: "ada@example.test",
    phone: null,
    company: null,
    title: null,
    bio: null,
    headshotUrl: null,
    socialLinksJson: null,
    notes: null,
    customFieldsJson: null,
    externalRef: null,
    createdAt: now,
    updatedAt: now,
  });

  await db.insert(schema.submission).values({
    id: SUBMISSION_A,
    eventId: EVENT_A,
    formId: null,
    seq: 1,
    title: "A Talk",
    description: null,
    trackId: TRACK_A,
    additionalTrackIdsJson: null,
    status: "accepted",
    contentStatus: "pending",
    acceptedAt: now,
    icsSequence: 0,
    externalRef: null,
    createdAt: now,
    updatedAt: now,
  });

  await db.insert(schema.participant).values({
    id: newIdLike("participant-a-probe"),
    submissionId: SUBMISSION_A,
    contactId: CONTACT_A,
    role: "speaker",
    order: 0,
    visible: true,
    inviteStatus: "none",
    titleAtTime: null,
    orgAtTime: null,
    nameAtTime: null,
    createdAt: now,
    updatedAt: now,
  });

  await db.insert(schema.user).values({
    id: ORG_B_USER,
    orgId: ORG_B,
    email: "organizer-b@example.test",
    passwordHash: "not-a-real-hash",
    role: "organizer",
    contactId: null,
    createdAt: now,
    updatedAt: now,
  });

  const plaintext = newApiToken();
  const tokenHash = await hashToken(plaintext);
  await db.insert(schema.apiToken).values({
    id: newIdLike("token-b-probe"),
    orgId: ORG_B,
    name: "probe token",
    tokenHash,
    tokenPrefix: apiTokenDisplayPrefix(plaintext),
    createdByUserId: ORG_B_USER,
    lastUsedAt: null,
    createdAt: now,
    updatedAt: now,
  });

  return { db, sqlite, bearerToken: plaintext };
}

function newIdLike(seed: string): string {
  // Deterministic fixture ids (not the real crypto-random newId() -- these
  // rows are never looked up by prefix/format assumptions, only by exact id
  // match through their FK columns).
  return seed;
}

// ---------------------------------------------------------------------------
// Full-table snapshot of every org-A row -- asserted byte-identical after
// the sweep. A refusal that quietly mutated the victim's rows is not a
// refusal.
// ---------------------------------------------------------------------------

// Snapshots exactly org A's own rows (by primary key, in every table this
// fixture seeded one into) rather than a literal whole-db dump: org B's OWN
// api_token row legitimately gets its last_used_at stamped by a real bearer
// request authenticating as org B (src/server/middleware.ts's
// stampApiTokenLastUsed) -- that is org B touching its own row, not a
// cross-org leak, and must never fail this probe. Every row org A actually
// owns (org/event/track/room/contact/submission/participant) is covered
// below; a future fixture addition that seeds a new org-A row into a new
// table must add it here too, or this snapshot silently stops covering it.
const ORG_A_ROWS: { table: keyof typeof schema; idColumn: string; id: string }[] = [
  { table: "org", idColumn: "id", id: ORG_A },
  { table: "event", idColumn: "id", id: EVENT_A },
  { table: "track", idColumn: "id", id: TRACK_A },
  { table: "room", idColumn: "id", id: ROOM_A },
  { table: "contact", idColumn: "id", id: CONTACT_A },
  { table: "submission", idColumn: "id", id: SUBMISSION_A },
  { table: "participant", idColumn: "id", id: "participant-a-probe" },
];

function tableNameFor(sqlite: DatabaseSync, key: string): string {
  // drizzle schema export keys are camelCase identifiers; the underlying
  // sqlite table name is snake_case -- looked up from sqlite_master rather
  // than hand-mapped, so this can never silently drift from the real DDL.
  const rows = sqlite
    .prepare("select name from sqlite_master where type = 'table' and name not like 'sqlite_%'")
    .all() as { name: string }[];
  const snakeGuess = key.replace(/([A-Z])/g, "_$1").toLowerCase();
  const match = rows.find((r) => r.name === snakeGuess);
  if (!match) {
    throw new Error(`cross-org-event-scope-probe: no sqlite table found for schema key '${key}' (guessed '${snakeGuess}')`);
  }
  return match.name;
}

function snapshotOrgATables(sqlite: DatabaseSync): Record<string, unknown> {
  const snapshot: Record<string, unknown> = {};
  for (const { table, idColumn, id } of ORG_A_ROWS) {
    const tableName = tableNameFor(sqlite, table as string);
    const stmt = sqlite.prepare(`select * from ${tableName} where ${idColumn} = ?`);
    stmt.setReturnArrays(false);
    snapshot[`${tableName}:${id}`] = stmt.all(id);
  }
  return snapshot;
}

// ---------------------------------------------------------------------------
// App composition -- same mount order/technique as the siblings. Two
// variants: `session` sets auth directly in the wildcard middleware
// (mirroring the siblings' shortcut); `bearer` sets NO auth itself and
// instead runs the real sessionLoader middleware so resolveBearerAuth
// executes against the real db for a real Authorization header.
// ---------------------------------------------------------------------------

async function buildSessionApp(db: Db, auth: AuthInfo): Promise<Hono<AppEnv>> {
  const app = new Hono<AppEnv>();
  app.use("*", async (c, next) => {
    c.set("db", db);
    c.set("auth", auth);
    await next();
  });
  registerErrorHandler(app);
  const mounts = await parseIndexMounts();
  for (const { prefix, identifier, subApp } of mounts) {
    if (identifier === "devMailboxRoutes") guardDevMailbox(app);
    app.route(prefix, subApp);
  }
  return app;
}

async function buildBearerApp(db: Db): Promise<Hono<AppEnv>> {
  const app = new Hono<AppEnv>();
  app.use("*", async (c, next) => {
    c.set("db", db);
    await next();
  });
  // Real middleware: resolves the Authorization: Bearer chq_... header
  // against the real api_token/user join, exactly as production does.
  app.use("*", sessionLoader);
  registerErrorHandler(app);
  const mounts = await parseIndexMounts();
  for (const { prefix, identifier, subApp } of mounts) {
    if (identifier === "devMailboxRoutes") guardDevMailbox(app);
    app.route(prefix, subApp);
  }
  return app;
}

// ---------------------------------------------------------------------------
// Route enumeration (from SOURCE, not runtime) filtered to the
// /api/v1/events/:id/* family, plus request-path construction substituting
// ORG A's real eventId for the :eventId segment.
// ---------------------------------------------------------------------------

const EVENTS_FAMILY_RE = /^\/api\/v1\/events\/:[A-Za-z]+(\/|$)/;

interface EventsRoute {
  method: string;
  path: string;
}

function enumerateEventsFamilyRoutes(): EventsRoute[] {
  const routes = enumerateRegisteredRoutes();
  const seen = new Set<string>();
  const out: EventsRoute[] = [];
  for (const r of routes) {
    if (!EVENTS_FAMILY_RE.test(r.path)) continue;
    const key = `${r.method} ${r.path}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ method: r.method, path: r.path });
  }
  out.sort((a, b) => (a.path + a.method).localeCompare(b.path + b.method));
  return out;
}

// The only route this probe cannot substitute a generic literal into: the
// exported kind must be a real ExportKind or isExportKind(kind) 400s before
// the ownership check ever runs (see file header finding).
const SEGMENT_LITERALS: Record<string, string> = {
  kind: "submissions",
};

function toRequestPath(routePath: string): string {
  return routePath
    .split("/")
    .map((segment) => {
      if (!segment.startsWith(":")) return segment;
      const name = segment.slice(1).replace(/\{.*\}$/, "");
      if (name === "eventId") return EVENT_A;
      return SEGMENT_LITERALS[name] ?? "probe-value";
    })
    .join("/");
}

// ---------------------------------------------------------------------------
// CROSS_ORG_LEDGER -- named exceptions to the flat "every triple is 403 or
// 404" rule, asserted exact in both directions per DEC-459.
// ---------------------------------------------------------------------------

interface LedgerEntry {
  method: string;
  path: string;
  actor: "session" | "bearer";
  expectedStatus: number;
  reason: string;
}

// Empty: every enumerated (method, path, actor) triple refused cleanly with
// 403 or 404 in this run -- see file header finding. Kept as a typed,
// asserted-both-directions structure (not just an empty array with a
// comment) so a future regression that needs a real documented exception
// has a place to land without loosening the assertion itself.
const CROSS_ORG_LEDGER: LedgerEntry[] = [];

function ledgerKey(entry: { method: string; path: string; actor: string }): string {
  return `${entry.method} ${entry.path} [${entry.actor}]`;
}

// ---------------------------------------------------------------------------
// The probe.
// ---------------------------------------------------------------------------

describe("cross-org /api/v1/events/:id/* tenant-scope probe (DEC-459/DEC-727)", () => {
  let fixture: Fixture;

  beforeAll(async () => {
    fixture = await buildFixture();
  });

  afterAll(() => {
    fixture.sqlite.close();
  });

  it("enumerates at least the routes this task expects to exist (composition sanity)", () => {
    const routes = enumerateEventsFamilyRoutes();
    // Floor: this probe found 47 registrations building it (wave 37) -- a
    // silent narrowing back down would otherwise pass vacuously.
    expect(routes.length).toBeGreaterThanOrEqual(40);
    expect(routes.map((r) => `${r.method} ${r.path}`)).toContain("GET /api/v1/events/:eventId");
  });

  it("every /api/v1/events/:id/* route refuses an org-B organizer requesting org-A's eventId (session AND bearer actors), or is an exact, justified CROSS_ORG_LEDGER entry -- and org-A's rows are untouched", async () => {
    const routes = enumerateEventsFamilyRoutes();
    expect(routes.length).toBeGreaterThan(0);

    const beforeSnapshot = snapshotOrgATables(fixture.sqlite);

    const sessionAuth: AuthInfo = { userId: ORG_B_USER, role: "organizer", orgId: ORG_B };
    const sessionApp = await buildSessionApp(fixture.db, sessionAuth);
    const bearerApp = await buildBearerApp(fixture.db);

    const failures: string[] = [];
    const matchedLedgerKeys = new Set<string>();

    const actors: { name: "session" | "bearer"; app: Hono<AppEnv>; headers: Record<string, string> }[] = [
      { name: "session", app: sessionApp, headers: {} },
      { name: "bearer", app: bearerApp, headers: { authorization: `Bearer ${fixture.bearerToken}` } },
    ];

    for (const { name, app, headers } of actors) {
      for (const { method, path } of routes) {
        const ledgerEntry = CROSS_ORG_LEDGER.find(
          (e) => e.method === method && e.path === path && e.actor === name,
        );
        if (ledgerEntry) matchedLedgerKeys.add(ledgerKey(ledgerEntry));

        const requestPath = toRequestPath(path);
        const reqHeaders: Record<string, string> = { ...headers };
        let body: string | undefined;
        if (method !== "GET" && method !== "HEAD") {
          reqHeaders["x-chq-csrf"] = "1";
          reqHeaders["content-type"] = "application/json";
          body = "{}";
        }

        const res = await app.request(
          requestPath,
          { method, headers: reqHeaders, body },
          {
            KV: makeFakeKv() as unknown as AppEnv["Bindings"]["KV"],
            FILES: makeFakeR2() as unknown as AppEnv["Bindings"]["FILES"],
          } as unknown as AppEnv["Bindings"],
        );

        if (ledgerEntry) {
          if (res.status !== ledgerEntry.expectedStatus) {
            failures.push(
              `${method} ${path} (requested as ${requestPath}) as ${name}: status=${res.status}, ledger expected ${ledgerEntry.expectedStatus}`,
            );
          }
          continue;
        }

        const cleanlyRefused = res.status === 403 || res.status === 404;
        if (!cleanlyRefused) {
          failures.push(
            `${method} ${path} (requested as ${requestPath}) as ${name}: status=${res.status} -- ` +
              `expected 403 or 404 and no CROSS_ORG_LEDGER entry`,
          );
        }
      }
    }

    expect(failures).toEqual([]);

    const staleEntries = CROSS_ORG_LEDGER.filter((e) => !matchedLedgerKeys.has(ledgerKey(e))).map(ledgerKey);
    expect(staleEntries).toEqual([]);

    const afterSnapshot = snapshotOrgATables(fixture.sqlite);
    expect(afterSnapshot).toEqual(beforeSnapshot);
  });
});

// ---------------------------------------------------------------------------
// Minimal fake bindings -- per the task instruction, a route that would 500
// on a missing binding gets a stub rather than the probe accepting a 500.
// Neither fake is ever expected to be exercised (every route this probe
// reaches refuses before touching FILES/KV), but they exist so a route that
// DOES reach one fails on ITS OWN authz logic, never on `undefined.get`.
// ---------------------------------------------------------------------------

function makeFakeKv() {
  const store = new Map<string, string>();
  return {
    async get(key: string) {
      return store.get(key) ?? null;
    },
    async put(key: string, value: string) {
      store.set(key, value);
    },
    async delete(key: string) {
      store.delete(key);
    },
  };
}

function makeFakeR2() {
  return {
    async put() {
      return undefined;
    },
    async get() {
      return null;
    },
    async head() {
      return null;
    },
    async delete() {
      return undefined;
    },
  };
}
