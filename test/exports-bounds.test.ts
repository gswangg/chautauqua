// DEC-027 amendment (wave 50): every export kind's driving row query is
// bounded on the QUERY (a LIMIT clause), not by a length check after the
// rows are already in the isolate. This file:
//  (1) asserts EXPORT_MAX_ROWS is the single source of the cap — no literal
//      duplicated in a kind file or the route file;
//  (2) enumerates EXPORT_KINDS + the separate DEC-055 showflow surface and
//      asserts EVERY one refuses (truncated: true) when its driving query
//      comes back with EXPORT_MAX_ROWS + 1 rows, never returning cap+1 rows
//      to the caller;
//  (3) asserts the route's 400 envelope names the cap for every kind, and
//      that an under-cap export is unchanged.

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { Hono } from "hono";
import { registerErrorHandler } from "../src/server/http";
import { exportsRoutes } from "../src/routes/api/exports";
import { EXPORT_KINDS, EXPORT_MAX_ROWS, buildExport, buildShowflowExport } from "../src/server/repo/exports";
import type { AppEnv, AuthInfo } from "../src/server/env";

const EXPORTS_DIR = join(__dirname, "..", "src", "server", "repo", "exports");
const ROUTE_FILE = join(__dirname, "..", "src", "routes", "api", "exports.ts");
const CRUD_FILE = join(__dirname, "..", "src", "server", "repo", "contacts", "crud.ts");

describe("EXPORT_MAX_ROWS is the single named source of the export row cap", () => {
  it("no other exports-directory file (or the route file, or contacts/crud.ts) hardcodes the literal cap value", () => {
    const capLiteral = String(EXPORT_MAX_ROWS);
    const filesToCheck = [
      ...readdirSync(EXPORTS_DIR)
        .filter((f) => f.endsWith(".ts") && f !== "table.ts")
        .map((f) => join(EXPORTS_DIR, f)),
      ROUTE_FILE,
      CRUD_FILE,
    ];
    for (const file of filesToCheck) {
      const src = readFileSync(file, "utf8");
      // A bare occurrence of the digits (not part of a longer number, e.g.
      // 200000) would indicate a hand-copied literal instead of importing
      // EXPORT_MAX_ROWS.
      const re = new RegExp(`(?<![0-9])${capLiteral}(?![0-9])`);
      expect(re.test(src), `${file} must reference EXPORT_MAX_ROWS, never the literal ${capLiteral}`).toBe(false);
    }
  });

  it("table.ts is the sole definition site", () => {
    const src = readFileSync(join(EXPORTS_DIR, "table.ts"), "utf8");
    expect(src).toMatch(/export const EXPORT_MAX_ROWS = \d+;/);
  });
});

// Generic select()-queue fake db (same technique as test/exports-order.test.ts):
// each queued row-array is returned, in call order, by the next db.select()
// chain, whether that chain resolves via a trailing .limit(n) call or via
// awaiting the chain directly.
function fakeDb(selectQueue: unknown[][]) {
  let call = 0;
  function makeChain(rows: unknown[]) {
    const chain: any = {
      from: () => chain,
      innerJoin: () => chain,
      leftJoin: () => chain,
      where: () => chain,
      orderBy: () => chain,
      limit: async () => rows,
      then: (resolve: (v: unknown) => void) => resolve(rows),
    };
    return chain;
  }
  const db = {
    select: () => {
      const rows = selectQueue[call] ?? [];
      call += 1;
      return makeChain(rows);
    },
  };
  return db as unknown as AppEnv["Variables"]["db"];
}

const OVERFLOW_ROWS = Array.from({ length: EXPORT_MAX_ROWS + 1 }, () => ({}));

// contacts' filtered (DEC-671) row-selection path (selectFilteredContactRows
// -> toRow) eagerly maps every returned row's createdAt/updatedAt.getTime()
// BEFORE exportContacts' own overflow check runs, so the overflow fixture
// for that kind needs valid Date fields, unlike every other kind's opaque
// stub rows.
const OVERFLOW_CONTACT_ROWS = Array.from({ length: EXPORT_MAX_ROWS + 1 }, (_, i) => ({
  id: `c${i}`,
  orgId: "org-1",
  firstName: "First",
  lastName: "Last",
  email: `c${i}@example.com`,
  phone: null,
  company: null,
  title: null,
  bio: null,
  headshotUrl: null,
  socialLinksJson: null,
  notes: null,
  customFieldsJson: null,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
}));

// Per-kind select() call queue, ending with an overflow-sized row set at the
// position of that kind's driving query (see each src/server/repo/exports/*
// file's own select() call order). Every kind must refuse here without
// ever handing cap+1 rows back to the caller.
function overflowQueueFor(kind: (typeof EXPORT_KINDS)[number] | "showflow"): unknown[][] {
  switch (kind) {
    case "submissions":
    case "speakers":
    case "agenda":
    case "showflow":
    case "evaluations":
      return [[{ recordPrefix: "SES" }], OVERFLOW_ROWS];
    case "email-log":
      return [OVERFLOW_ROWS];
    case "contacts":
      return [OVERFLOW_CONTACT_ROWS];
  }
}

describe("every export kind refuses (truncated: true, zero rows) when its driving query hits cap+1", () => {
  for (const kind of EXPORT_KINDS) {
    it(`kind '${kind}'`, async () => {
      const db = fakeDb(overflowQueueFor(kind));
      const table = await buildExport(db, "event-1", kind, "org-1");
      expect(table.truncated, `${kind}: truncated flag`).toBe(true);
      expect(table.rows, `${kind}: rows must stay empty on refusal, never cap+1`).toEqual([]);
    });
  }

  it("contacts, with list params supplied (DEC-671 filtered path)", async () => {
    const db = fakeDb(overflowQueueFor("contacts"));
    const table = await buildExport(db, "event-1", "contacts", "org-1", undefined, {
      page: 1,
      perPage: 50,
      q: null,
      segmentId: null,
      sort: "name",
      rules: [],
    });
    expect(table.truncated).toBe(true);
    expect(table.rows).toEqual([]);
  });

  it("showflow (DEC-055, separate surface)", async () => {
    const db = fakeDb(overflowQueueFor("showflow"));
    const table = await buildShowflowExport(db, "event-1");
    expect(table.truncated).toBe(true);
    expect(table.rows).toEqual([]);
  });

  it("no kind's driving query ever returns MORE than cap+1 rows to the caller (sanity on the fixture itself)", () => {
    expect(OVERFLOW_ROWS.length).toBe(EXPORT_MAX_ROWS + 1);
  });
});

function appWithDbAndAuth(db: AppEnv["Variables"]["db"], auth: AuthInfo) {
  const app = new Hono<AppEnv>();
  registerErrorHandler(app);
  app.use("*", async (c, next) => {
    c.set("db", db);
    c.set("auth", auth);
    await next();
  });
  app.route("/", exportsRoutes);
  return app;
}

const ORGANIZER: AuthInfo = { userId: "u1", role: "organizer", orgId: "org-1" };
const EVENT_ROW = { id: "event-1", orgId: "org-1" };

// Ownership-check response (requireOwnedEvent's own select), prepended to
// each kind's overflow queue for a full route-level 400 test.
function ownedDb(kind: (typeof EXPORT_KINDS)[number]) {
  return fakeDb([[EVENT_ROW], ...overflowQueueFor(kind)]);
}

describe("GET /api/v1/events/:eventId/export/:kind — 400s naming the cap on overflow (DEC-027 amendment)", () => {
  for (const kind of EXPORT_KINDS) {
    it(`kind '${kind}' refuses with a 400 naming the ${EXPORT_MAX_ROWS}-row cap`, async () => {
      const app = appWithDbAndAuth(ownedDb(kind), ORGANIZER);
      const res = await app.request(`/api/v1/events/event-1/export/${kind}?format=csv`);
      expect(res.status).toBe(400);
      const body = (await res.json()) as { error: { code: string; message: string } };
      expect(body.error.code).toBe("invalid");
      expect(body.error.message).toContain(String(EXPORT_MAX_ROWS));
    });
  }

  it("submissions overflow message points at the list's own filter to narrow with (DEC-649)", async () => {
    const app = appWithDbAndAuth(ownedDb("submissions"), ORGANIZER);
    const res = await app.request(`/api/v1/events/event-1/export/submissions?format=csv`);
    const body = (await res.json()) as { error: { message: string } };
    expect(body.error.message).toMatch(/status|trackId|q\b/i);
  });

  it("contacts overflow message points at the directory's own filter to narrow with (DEC-671)", async () => {
    const app = appWithDbAndAuth(ownedDb("contacts"), ORGANIZER);
    const res = await app.request(`/api/v1/events/event-1/export/contacts?format=csv`);
    const body = (await res.json()) as { error: { message: string } };
    expect(body.error.message).toMatch(/segmentId|rules|q\b/i);
  });

  it("GET .../exports/showflow.csv also 400s naming the cap", async () => {
    const app = appWithDbAndAuth(fakeDb([[EVENT_ROW], ...overflowQueueFor("showflow")]), ORGANIZER);
    const res = await app.request(`/api/v1/events/event-1/exports/showflow.csv`);
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string; message: string } };
    expect(body.error.code).toBe("invalid");
    expect(body.error.message).toContain(String(EXPORT_MAX_ROWS));
  });
});

describe("under the cap, export bytes are unchanged (DEC-027 amendment: only the overflow path is new)", () => {
  it("email-log: a handful of rows, well under the cap, exports exactly as before", async () => {
    const db = fakeDb([
      [
        {
          sentAt: new Date("2026-01-01T00:00:00.000Z"),
          toEmail: "a@example.com",
          subject: "Hello",
          status: "sent",
          templateId: "tpl-1",
          id: "log-1",
        },
      ],
    ]);
    const table = await buildExport(db, "event-1", "email-log", "org-1");
    expect(table.truncated).toBe(false);
    expect(table.rows).toEqual([["2026-01-01T00:00:00.000Z", "a@example.com", "Hello", "sent", "tpl-1"]]);
  });

  it("email-log via the route: under-cap CSV response is byte-identical to the unbounded shape", async () => {
    const db = fakeDb([
      [EVENT_ROW],
      [
        {
          sentAt: new Date("2026-01-01T00:00:00.000Z"),
          toEmail: "a@example.com",
          subject: "Hello",
          status: "sent",
          templateId: "tpl-1",
          id: "log-1",
        },
      ],
    ]);
    const app = appWithDbAndAuth(db, ORGANIZER);
    const res = await app.request(`/api/v1/events/event-1/export/email-log?format=csv`);
    expect(res.status).toBe(200);
    const csv = await res.text();
    expect(csv).toBe(
      ["sentAt,toEmail,subject,status,templateId", "2026-01-01T00:00:00.000Z,a@example.com,Hello,sent,tpl-1"].join(
        "\r\n",
      ),
    );
  });
});
