// DEC-778 coverage: PATCH /api/v1/users/:id (role change). Same fake-db
// harness as test/users-reset-password.test.ts (dispatches by table
// identity, evaluates real drizzle eq()/and() condition trees).

import { afterEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { registerErrorHandler } from "../src/server/http";
import { usersRoutes } from "../src/routes/api/users";
import { hashPassword } from "../src/auth/password";
import * as schema from "../src/db/schema";
import type { AppEnv, AuthInfo } from "../src/server/env";

type Row = Record<string, unknown>;

function buildColumnMap(table: Record<string, unknown>): Map<unknown, string> {
  const map = new Map<unknown, string>();
  for (const [key, col] of Object.entries(table)) {
    if (col && typeof col === "object" && "name" in (col as object)) {
      map.set(col, key);
    }
  }
  return map;
}

const COLUMN_KEYS = new Map<unknown, string>([...buildColumnMap(schema.user as unknown as Record<string, unknown>)]);

function colKey(col: unknown): string {
  const key = COLUMN_KEYS.get(col);
  if (!key) throw new Error("unmapped column in fake db test helper");
  return key;
}

function unwrap(rawValue: unknown): unknown {
  return rawValue && typeof rawValue === "object" && "value" in (rawValue as object)
    ? (rawValue as { value: unknown }).value
    : rawValue;
}

function chunkText(chunk: unknown): string | undefined {
  return chunk && typeof chunk === "object" && Array.isArray((chunk as { value?: unknown }).value)
    ? ((chunk as { value: unknown[] }).value[0] as string | undefined)
    : undefined;
}

// evalCond takes `allRows` so the raw-sql last-organizer guard built by
// updateUserRole (DEC-100 amendment, wave 65) can be evaluated: it is a
// correlated `count(*) > 1` subquery over the WHOLE table, not a per-row
// column comparison, so it can't be answered from `row` alone.
function evalCond(cond: unknown, row: Row, allRows: Row[]): boolean {
  const chunks = (cond as { queryChunks: unknown[] }).queryChunks;

  // sql`1 = 1` -- the no-op guard used when the new role IS 'organizer'.
  if (chunks.length === 1 && chunkText(chunks[0]) === "1 = 1") {
    return true;
  }

  if (COLUMN_KEYS.has(chunks[1])) {
    // updateUserRole's last-organizer guard: `(role <> 'organizer' OR
    // (select count(*) from "user" where "org_id" = ? and "role" =
    // 'organizer') > 1)`. Recognized by the raw SQL text at chunks[2];
    // the org id param sits at chunks[3] same as a plain eq().
    const guardText = chunkText(chunks[2]);
    if (typeof guardText === "string" && guardText.includes("select count(*)")) {
      const orgId = unwrap(chunks[3]);
      const organizerCount = allRows.filter((r) => r.orgId === orgId && r.role === "organizer").length;
      return row[colKey(chunks[1])] !== "organizer" || organizerCount > 1;
    }
    // inArray()'s chunks[3] is an array of Param values (DEC-865:
    // getOrgUserById now scopes by inArray(role, ORG_USER_ROLES)); eq()'s
    // chunks[3] is a single Param.
    if (Array.isArray(chunks[3])) {
      const values = (chunks[3] as unknown[]).map(unwrap);
      return values.includes(row[colKey(chunks[1])]);
    }
    return row[colKey(chunks[1])] === unwrap(chunks[3]);
  }
  let any = false;
  let result = true;
  for (const chunk of chunks) {
    if (chunk && typeof chunk === "object" && Array.isArray((chunk as { queryChunks?: unknown }).queryChunks)) {
      any = true;
      result = result && evalCond(chunk, row, allRows);
    }
  }
  if (!any) throw new Error("evalCond: no matchable condition found in fake db test helper");
  return result;
}

function project(row: Row, fields?: Record<string, unknown>): Row {
  if (!fields) return { ...row };
  const out: Row = {};
  for (const [key, col] of Object.entries(fields)) out[key] = row[colKey(col)];
  return out;
}

function makeFakeDb() {
  const state: { users: Row[] } = { users: [] };
  // Tracks every db.select({ count: ... }) aggregate call so tests can
  // assert the happy path issues no separate count SELECT (the guard now
  // lives inside the update's own WHERE, not a pre-check).
  const aggregateSelectCalls: unknown[] = [];
  function rowsFor(table: unknown): Row[] {
    if (table === schema.user) return state.users;
    throw new Error("unexpected table in fake db test helper");
  }
  const db = {
    select(fields?: Record<string, unknown>) {
      return {
        from(table: unknown) {
          return {
            where(cond: unknown) {
              const allRows = rowsFor(table);
              const matched = allRows.filter((r) => evalCond(cond, r, allRows));
              // countOrgUsers selects { count: sql`count(*)` } -- an
              // aggregate, not a column reference, so it can't go through
              // project()'s per-row column lookup. Detect that shape and
              // return a single aggregate row instead.
              const fieldEntries = fields ? Object.entries(fields) : [];
              const isAggregate = fieldEntries.length === 1 && !COLUMN_KEYS.has(fieldEntries[0]![1]);
              if (isAggregate) aggregateSelectCalls.push(cond);
              const projected = isAggregate ? [{ [fieldEntries[0]![0]]: matched.length }] : matched.map((r) => project(r, fields));
              return Object.assign(Promise.resolve(projected), {
                limit(n: number) {
                  return Promise.resolve(projected.slice(0, n));
                },
              });
            },
          };
        },
      };
    },
    update(table: unknown) {
      return {
        set(patch: Row) {
          return {
            where(cond: unknown) {
              const allRows = rowsFor(table);
              const matched = allRows.filter((r) => evalCond(cond, r, allRows));
              for (const r of matched) Object.assign(r, patch);
              const returning = () => Promise.resolve(matched.map((r) => ({ ...r })));
              return Object.assign(Promise.resolve(matched.map((r) => ({ ...r }))), { returning });
            },
          };
        },
      };
    },
  };
  return { db: db as unknown as AppEnv["Variables"]["db"], state, aggregateSelectCalls };
}

const ORG_A = "org-a";
const ORG_B = "org-b";

async function seedUser(state: { users: Row[] }, overrides: Partial<Row> = {}) {
  const passwordHash = await hashPassword("some-password-1");
  const user: Row = {
    id: `user-${Math.random().toString(36).slice(2)}`,
    orgId: ORG_A,
    email: "person@example.test",
    passwordHash,
    role: "reviewer",
    contactId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
  state.users.push(user);
  return user;
}

function organizerApp(db: AppEnv["Variables"]["db"], auth: AuthInfo) {
  const app = new Hono<AppEnv>();
  registerErrorHandler(app);
  app.use("*", async (c, next) => {
    c.set("db", db);
    c.set("auth", auth);
    await next();
  });
  app.route("/", usersRoutes);
  return app;
}

function patchRole(app: Hono<AppEnv>, targetId: string, role: unknown, headers: Record<string, string> = { "content-type": "application/json", "x-chq-csrf": "1" }) {
  return app.request(`/api/v1/users/${targetId}`, { method: "PATCH", headers, body: JSON.stringify({ role }) });
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("PATCH /api/v1/users/:id (DEC-778)", () => {
  it("(1) organizer promotes a reviewer to organizer: 200 and the row is updated", async () => {
    const { db, state } = makeFakeDb();
    await seedUser(state, { id: "org-admin", role: "organizer" });
    const target = await seedUser(state, { id: "target-1", role: "reviewer", email: "reviewer@example.test" });
    const org = organizerApp(db, { userId: "org-admin", role: "organizer", orgId: ORG_A });

    const res = await patchRole(org, target.id as string, "organizer");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { id: string; email: string; role: string };
    expect(body.role).toBe("organizer");

    const stored = state.users.find((u) => u.id === target.id)!;
    expect(stored.role).toBe("organizer");
  });

  it("(2) 400 on an unknown role", async () => {
    const { db, state } = makeFakeDb();
    await seedUser(state, { id: "org-admin", role: "organizer" });
    const target = await seedUser(state, { id: "target-1", role: "reviewer" });
    const org = organizerApp(db, { userId: "org-admin", role: "organizer", orgId: ORG_A });

    const res = await patchRole(org, target.id as string, "superadmin");
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("invalid");
  });

  it("(3) 404 when the target is not in the caller's org", async () => {
    const { db, state } = makeFakeDb();
    await seedUser(state, { id: "org-admin", role: "organizer" });
    const target = await seedUser(state, { id: "target-1", role: "reviewer", orgId: ORG_B });
    const org = organizerApp(db, { userId: "org-admin", role: "organizer", orgId: ORG_A });

    const res = await patchRole(org, target.id as string, "organizer");
    expect(res.status).toBe(404);
  });

  it("(4) 409 when the target is the caller themselves", async () => {
    const { db, state } = makeFakeDb();
    const self = await seedUser(state, { id: "org-admin", role: "organizer" });
    await seedUser(state, { id: "target-1", role: "organizer", email: "other-organizer@example.test" });
    const org = organizerApp(db, { userId: "org-admin", role: "organizer", orgId: ORG_A });

    const res = await patchRole(org, self.id as string, "reviewer");
    expect(res.status).toBe(409);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("conflict");
  });

  it("(5) allows demoting one organizer when a second organizer row exists in the org", async () => {
    const { db, state } = makeFakeDb();
    await seedUser(state, { id: "org-admin", role: "organizer" });
    const secondOrganizer = await seedUser(state, { id: "target-1", role: "organizer", email: "second@example.test" });
    const org = organizerApp(db, { userId: "org-admin", role: "organizer", orgId: ORG_A });

    // org-admin (caller) and secondOrganizer are both organizer-role rows,
    // so demoting secondOrganizer leaves org-admin as organizer -- allowed.
    const res = await patchRole(org, secondOrganizer.id as string, "reviewer");
    expect(res.status).toBe(200);
  });

  it("(6) 409 when demoting the org's last organizer (exactly one organizer row)", async () => {
    const { db, state } = makeFakeDb();
    // Caller's own row is a reviewer so it doesn't count toward the
    // organizer total; the target is the sole organizer.
    await seedUser(state, { id: "org-admin", role: "reviewer" });
    const onlyOrganizer = await seedUser(state, { id: "target-1", role: "organizer", email: "sole@example.test" });
    const org = organizerApp(db, { userId: "org-admin", role: "organizer", orgId: ORG_A });

    const res = await patchRole(org, onlyOrganizer.id as string, "reviewer");
    expect(res.status).toBe(409);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("conflict");

    const stored = state.users.find((u) => u.id === onlyOrganizer.id)!;
    expect(stored.role).toBe("organizer");
  });

  it("(6b) issues no separate count SELECT on the happy path -- the guard lives in the update's own WHERE", async () => {
    const { db, state, aggregateSelectCalls } = makeFakeDb();
    await seedUser(state, { id: "org-admin", role: "organizer" });
    const secondOrganizer = await seedUser(state, { id: "target-1", role: "organizer", email: "second@example.test" });
    const org = organizerApp(db, { userId: "org-admin", role: "organizer", orgId: ORG_A });

    const res = await patchRole(org, secondOrganizer.id as string, "reviewer");
    expect(res.status).toBe(200);
    expect(aggregateSelectCalls.length).toBe(0);
  });

  it("(7) rejects a missing CSRF header", async () => {
    const { db, state } = makeFakeDb();
    await seedUser(state, { id: "org-admin", role: "organizer" });
    const target = await seedUser(state, { id: "target-1", role: "reviewer" });
    const org = organizerApp(db, { userId: "org-admin", role: "organizer", orgId: ORG_A });

    const res = await patchRole(org, target.id as string, "organizer", { "content-type": "application/json" });
    expect(res.status).toBe(400);
  });

  it("(8) rejects reviewer and speaker callers", async () => {
    const { db, state } = makeFakeDb();
    const target = await seedUser(state, { id: "target-1", role: "reviewer" });

    const reviewerApp = organizerApp(db, { userId: "u1", role: "reviewer", orgId: ORG_A });
    expect((await patchRole(reviewerApp, target.id as string, "organizer")).status).toBe(403);

    const speakerApp = organizerApp(db, { userId: "u2", role: "speaker", orgId: ORG_A });
    expect((await patchRole(speakerApp, target.id as string, "organizer")).status).toBe(403);
  });

  it("(9) does not revoke sessions -- no authSession table access on role change", async () => {
    const { db, state } = makeFakeDb();
    await seedUser(state, { id: "org-admin", role: "organizer" });
    const target = await seedUser(state, { id: "target-1", role: "reviewer" });
    const org = organizerApp(db, { userId: "org-admin", role: "organizer", orgId: ORG_A });

    const res = await patchRole(org, target.id as string, "organizer");
    expect(res.status).toBe(200);
    // makeFakeDb throws on any table other than schema.user, so a 200 here
    // proves no authSession delete/select was attempted.
  });
});
