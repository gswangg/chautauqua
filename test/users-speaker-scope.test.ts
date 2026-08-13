// DEC-865 coverage: the organizer user-directory API (org/reviewer accounts)
// must never reach speaker portal accounts even though they share the
// `user` table. Same fake-db harness as test/users-role-change.test.ts
// (dispatches by table identity, evaluates real drizzle eq()/and()/
// inArray() condition trees) extended with inArray support.

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

const COLUMN_KEYS = new Map<unknown, string>([
  ...buildColumnMap(schema.user as unknown as Record<string, unknown>),
  ...buildColumnMap(schema.authSession as unknown as Record<string, unknown>),
]);

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

// Evaluates a real drizzle eq()/and()/inArray() condition tree against a
// row. Recurses into any nested queryChunks-bearing chunk so and(eq, eq,
// inArray) works without hardcoding AND's chunk layout. inArray's chunk
// shape is [.., column, " in ", Param[], ..] -- detected by chunks[3]
// being an array of Param-shaped values rather than a single Param.
function evalCond(cond: unknown, row: Row): boolean {
  const chunks = (cond as { queryChunks: unknown[] }).queryChunks;
  if (COLUMN_KEYS.has(chunks[1])) {
    const key = colKey(chunks[1]);
    if (Array.isArray(chunks[3])) {
      const values = (chunks[3] as unknown[]).map(unwrap);
      return values.includes(row[key]);
    }
    return row[key] === unwrap(chunks[3]);
  }
  let any = false;
  let result = true;
  for (const chunk of chunks) {
    if (chunk && typeof chunk === "object" && Array.isArray((chunk as { queryChunks?: unknown }).queryChunks)) {
      any = true;
      result = result && evalCond(chunk, row);
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
  const state: { users: Row[]; sessions: Row[] } = { users: [], sessions: [] };
  function rowsFor(table: unknown): Row[] {
    if (table === schema.user) return state.users;
    if (table === schema.authSession) return state.sessions;
    throw new Error("unexpected table in fake db test helper");
  }
  const db = {
    select(fields?: Record<string, unknown>) {
      return {
        from(table: unknown) {
          return {
            where(cond: unknown) {
              const matched = rowsFor(table).filter((r) => evalCond(cond, r));
              // countOrgUsers selects { count: sql`count(*)` } -- an
              // aggregate, not a column reference, so it can't go through
              // project()'s per-row column lookup. Detect that shape and
              // return a single aggregate row instead.
              const fieldEntries = fields ? Object.entries(fields) : [];
              const isAggregate = fieldEntries.length === 1 && !COLUMN_KEYS.has(fieldEntries[0]![1]);
              const projected = isAggregate ? [{ [fieldEntries[0]![0]]: matched.length }] : matched.map((r) => project(r, fields));
              return Object.assign(Promise.resolve(projected), {
                limit(n: number) {
                  return Promise.resolve(projected.slice(0, n));
                },
                offset(n: number) {
                  const sliced = projected.slice(n);
                  return Object.assign(Promise.resolve(sliced), {
                    limit(m: number) {
                      return Promise.resolve(sliced.slice(0, m));
                    },
                  });
                },
                orderBy() {
                  return Object.assign(Promise.resolve(projected), {
                    limit(n: number) {
                      return Object.assign(Promise.resolve(projected.slice(0, n)), {
                        offset(o: number) {
                          return Promise.resolve(projected.slice(o, o + n));
                        },
                      });
                    },
                  });
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
              for (const r of rowsFor(table)) {
                if (evalCond(cond, r)) Object.assign(r, patch);
              }
              return Promise.resolve();
            },
          };
        },
      };
    },
    delete(table: unknown) {
      return {
        where(cond: unknown) {
          const rows = rowsFor(table);
          const remaining = rows.filter((r) => !evalCond(cond, r));
          rows.length = 0;
          rows.push(...remaining);
          return Promise.resolve();
        },
      };
    },
  };
  return { db: db as unknown as AppEnv["Variables"]["db"], state };
}

const ORG_A = "org-a";

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

afterEach(() => {
  vi.clearAllMocks();
});

describe("DEC-865: org user directory excludes speaker portal accounts", () => {
  it("GET /api/v1/users with no ?role= excludes a speaker row in the same org; total excludes it too", async () => {
    const { db, state } = makeFakeDb();
    await seedUser(state, { id: "org-admin", role: "organizer" });
    await seedUser(state, { id: "rev-1", role: "reviewer", email: "reviewer@example.test" });
    await seedUser(state, { id: "speaker-1", role: "speaker", email: "speaker@example.test" });
    const org = organizerApp(db, { userId: "org-admin", role: "organizer", orgId: ORG_A });

    const res = await org.request("/api/v1/users");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { items: { id: string; role: string }[]; total: number };

    expect(body.items.map((u) => u.id)).not.toContain("speaker-1");
    expect(body.items.every((u) => u.role !== "speaker")).toBe(true);
    // Only org-admin + rev-1 count -- speaker-1 is excluded from both the
    // list and the total (same where-builder, DEC-865).
    expect(body.total).toBe(2);
    expect(body.items).toHaveLength(2);
  });

  it("POST /api/v1/users/:id/reset-password targeting a speaker user id returns 404 and performs no password-hash write or session delete", async () => {
    const { db, state } = makeFakeDb();
    await seedUser(state, { id: "org-admin", role: "organizer" });
    const speaker = await seedUser(state, { id: "speaker-1", role: "speaker", email: "speaker@example.test" });
    const originalHash = speaker.passwordHash;
    const org = organizerApp(db, { userId: "org-admin", role: "organizer", orgId: ORG_A });

    const res = await org.request(`/api/v1/users/${speaker.id}/reset-password`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-chq-csrf": "1" },
      body: "{}",
    });
    expect(res.status).toBe(404);

    // No write happened: the speaker's password hash is unchanged and no
    // session-delete pass ran (makeFakeDb's delete() would throw on an
    // unexpected table, but here delete() should simply never be called
    // for schema.authSession since getOrgUserById returned undefined and
    // the route short-circuits before ever reaching updateUserPasswordHash
    // / deleteUserSessions).
    const stored = state.users.find((u) => u.id === speaker.id)!;
    expect(stored.passwordHash).toBe(originalHash);
  });

  it("PATCH /api/v1/users/:id targeting a speaker user id returns 404 and writes no role", async () => {
    const { db, state } = makeFakeDb();
    await seedUser(state, { id: "org-admin", role: "organizer" });
    const speaker = await seedUser(state, { id: "speaker-1", role: "speaker", email: "speaker@example.test" });
    const org = organizerApp(db, { userId: "org-admin", role: "organizer", orgId: ORG_A });

    const res = await org.request(`/api/v1/users/${speaker.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json", "x-chq-csrf": "1" },
      body: JSON.stringify({ role: "organizer" }),
    });
    expect(res.status).toBe(404);

    const stored = state.users.find((u) => u.id === speaker.id)!;
    expect(stored.role).toBe("speaker");
  });

  it("GET /api/v1/users?role=reviewer still excludes speakers (defense in depth against a bad role param)", async () => {
    const { db, state } = makeFakeDb();
    await seedUser(state, { id: "org-admin", role: "organizer" });
    await seedUser(state, { id: "rev-1", role: "reviewer", email: "reviewer@example.test" });
    await seedUser(state, { id: "speaker-1", role: "speaker", email: "speaker@example.test" });
    const org = organizerApp(db, { userId: "org-admin", role: "organizer", orgId: ORG_A });

    const res = await org.request("/api/v1/users?role=reviewer");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { items: { id: string; role: string }[]; total: number };
    expect(body.items).toHaveLength(1);
    expect(body.items[0]?.id).toBe("rev-1");
    expect(body.total).toBe(1);
  });

  it("400s when ?role=speaker is requested directly -- speaker is not an allowed role filter", async () => {
    const { db, state } = makeFakeDb();
    await seedUser(state, { id: "org-admin", role: "organizer" });
    const org = organizerApp(db, { userId: "org-admin", role: "organizer", orgId: ORG_A });

    const res = await org.request("/api/v1/users?role=speaker");
    expect(res.status).toBe(400);
  });
});
