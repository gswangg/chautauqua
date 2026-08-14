// DEC-385/DEC-200 amendments (wave 13, task-w13-b): /account/password gets
// a phone action bar (Change it + Cancel) inside a fixed footer band at
// <=700px, while the desktop card keeps "Change it" + the "you stay signed
// in" hint with no Cancel. Two kinds of coverage:
//   (a) a live GET /account/password request per role, asserting the
//       Cancel href and that the desktop hint text survives.
//   (b) a source-scan (mirroring app/src/shell-geometry.test.ts) proving
//       the shared vocabulary is declared once in theme.ts and toggled on
//       inside the 700px block, never restated in auth.css.ts.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { Hono } from "hono";
import { registerErrorHandler } from "../src/server/http";
import { sessionLoader } from "../src/server/middleware";
import { authRoutes } from "../src/routes/auth";
import { accountRoutes } from "../src/routes/account";
import { hashPassword } from "../src/auth/password";
import * as schema from "../src/db/schema";
import { CSRF_COOKIE_NAME } from "../src/auth/cookies";
import type { AppEnv } from "../src/server/env";

const REPO_ROOT = join(__dirname, "..");

// -----------------------------------------------------------------------
// (a) live-request coverage — minimal fake db, same shape as
// test/account-password.test.ts's harness (single-condition eq() where
// clauses only; good enough for login + GET /account/password).
// -----------------------------------------------------------------------

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
  ...buildColumnMap(schema.rateLimit as unknown as Record<string, unknown>),
]);

function colKey(col: unknown): string {
  const key = COLUMN_KEYS.get(col);
  if (!key) throw new Error("unmapped column in fake db test helper");
  return key;
}

function buildTableMap(table: Record<string, unknown>, tableRef: unknown, into: Map<unknown, unknown>) {
  for (const col of Object.values(table)) {
    if (col && typeof col === "object" && "name" in (col as object)) into.set(col, tableRef);
  }
  return into;
}

const COLUMN_TABLES = new Map<unknown, unknown>();
for (const t of [schema.user, schema.authSession, schema.rateLimit]) {
  buildTableMap(t as unknown as Record<string, unknown>, t, COLUMN_TABLES);
}

const JOINED = Symbol("joined");
type JoinedRow = { [JOINED]: Map<unknown, Row> };

function isJoined(row: Row | JoinedRow): row is JoinedRow {
  return JOINED in row;
}

function valueOf(row: Row | JoinedRow, col: unknown): unknown {
  if (isJoined(row)) {
    const side = row[JOINED].get(COLUMN_TABLES.get(col));
    return side ? side[colKey(col)] : undefined;
  }
  return (row as Row)[colKey(col)];
}

function chunkLiteral(chunk: unknown): string | null {
  if (chunk && typeof chunk === "object" && "value" in (chunk as object)) {
    const v = (chunk as { value: unknown }).value;
    if (Array.isArray(v) && typeof v[0] === "string") return v[0];
  }
  return null;
}

function matches(cond: unknown, row: Row | JoinedRow): boolean {
  const chunks = (cond as { queryChunks: unknown[] }).queryChunks;
  if (chunkLiteral(chunks[0]) === "(") {
    const inner = (chunks[1] as { queryChunks: unknown[] }).queryChunks;
    const results: boolean[] = [];
    let joiner: "and" | "or" = "and";
    for (const part of inner) {
      const literal = chunkLiteral(part);
      if (literal === " and ") {
        joiner = "and";
        continue;
      }
      if (literal === " or ") {
        joiner = "or";
        continue;
      }
      results.push(matches(part, row));
    }
    return joiner === "and" ? results.every(Boolean) : results.some(Boolean);
  }

  const column = chunks[1];
  const operator = chunkLiteral(chunks[2]) ?? " = ";
  const rawValue = chunks[3];
  const value = COLUMN_TABLES.has(rawValue)
    ? valueOf(row, rawValue)
    : rawValue && typeof rawValue === "object" && "value" in (rawValue as object)
      ? (rawValue as { value: unknown }).value
      : rawValue;
  const actual = valueOf(row, column);
  if (operator === " <= ") return (actual as number | string | Date) <= (value as number | string | Date);
  if (operator === " >= ") return (actual as number | string | Date) >= (value as number | string | Date);
  return actual === value;
}

function project(row: Row | JoinedRow, fields?: Record<string, unknown>): Row {
  if (!fields) return { ...(row as Row) };
  const out: Row = {};
  for (const [key, col] of Object.entries(fields)) out[key] = valueOf(row, col);
  return out;
}

function makeFakeDb() {
  const state: { users: Row[]; sessions: Row[]; rateLimits: Row[] } = { users: [], sessions: [], rateLimits: [] };
  function rowsFor(table: unknown): Row[] {
    if (table === schema.user) return state.users;
    if (table === schema.authSession) return state.sessions;
    if (table === schema.rateLimit) return state.rateLimits;
    if (table === schema.org) return [];
    throw new Error("unexpected table in fake db test helper");
  }
  const db = {
    select(fields?: Record<string, unknown>) {
      return {
        from(table: unknown) {
          const limitFrom = (matched: (Row | JoinedRow)[]) => ({
            limit(n: number) {
              return Promise.resolve(matched.slice(0, n).map((r) => project(r, fields)));
            },
          });
          return {
            where(cond: unknown) {
              return limitFrom(rowsFor(table).filter((r) => matches(cond, r)));
            },
            orderBy() {
              return limitFrom(rowsFor(table));
            },
            innerJoin(joinTable: unknown, on: unknown) {
              const joined: JoinedRow[] = [];
              for (const left of rowsFor(table)) {
                for (const right of rowsFor(joinTable)) {
                  const row: JoinedRow = {
                    [JOINED]: new Map([
                      [table, left],
                      [joinTable, right],
                    ]),
                  };
                  if (matches(on, row)) joined.push(row);
                }
              }
              return {
                where(cond: unknown) {
                  return limitFrom(joined.filter((r) => matches(cond, r)));
                },
              };
            },
          };
        },
      };
    },
    insert(table: unknown) {
      return {
        values(row: Row) {
          if (table === schema.rateLimit) {
            const existing = state.rateLimits.find((r) => r.key === row.key);
            return {
              onConflictDoUpdate: () => ({
                returning: async () => {
                  if (existing) {
                    existing.count = (existing.count as number) + 1;
                    return [{ count: existing.count }];
                  }
                  const inserted = { ...row };
                  state.rateLimits.push(inserted);
                  return [{ count: inserted.count }];
                },
                then: (resolve: (v: undefined) => void) => {
                  if (existing) existing.count = (existing.count as number) + 1;
                  else state.rateLimits.push({ ...row });
                  resolve(undefined);
                },
              }),
            };
          }
          rowsFor(table).push({ ...row });
          return Promise.resolve();
        },
      };
    },
    update(table: unknown) {
      return {
        set(patch: Row) {
          return {
            where(cond: unknown) {
              for (const r of rowsFor(table)) {
                if (matches(cond, r)) Object.assign(r, patch);
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
          const remaining = rows.filter((r) => !matches(cond, r));
          rows.length = 0;
          rows.push(...remaining);
          return Promise.resolve();
        },
      };
    },
  };
  return { db: db as unknown as AppEnv["Variables"]["db"], state };
}

class InMemoryKV {
  private readonly store = new Map<string, string>();
  async get(key: string): Promise<string | null> {
    return this.store.get(key) ?? null;
  }
  async put(key: string, value: string): Promise<void> {
    this.store.set(key, value);
  }
  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }
}

const EMAIL = "phone-actionbar@example.test";
const PASSWORD = "old-password-123";

async function seedUser(state: { users: Row[] }, role: "organizer" | "reviewer" | "speaker") {
  const passwordHash = await hashPassword(PASSWORD);
  state.users.push({
    id: "u_1",
    orgId: "org_1",
    email: EMAIL,
    passwordHash,
    role,
    contactId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

function buildApp(db: AppEnv["Variables"]["db"]) {
  const app = new Hono<AppEnv>();
  registerErrorHandler(app);
  app.use("*", async (c, next) => {
    c.set("db", db);
    await next();
  });
  app.use("*", sessionLoader);
  app.route("/", authRoutes);
  app.route("/", accountRoutes);
  const env = { KV: new InMemoryKV() as unknown as AppEnv["Bindings"]["KV"] };
  return { app, env };
}

async function login(app: Hono<AppEnv>, env: { KV: AppEnv["Bindings"]["KV"] }) {
  const loginGet = await app.request("/login", {}, env);
  const setCookie = loginGet.headers.get("set-cookie") ?? "";
  const csrfMatch = setCookie.match(new RegExp(`${CSRF_COOKIE_NAME}=([^;]+)`));
  if (!csrfMatch) throw new Error("no csrf cookie on /login");
  const cookie = `${CSRF_COOKIE_NAME}=${csrfMatch[1]}`;
  const form = new URLSearchParams({ [CSRF_COOKIE_NAME]: csrfMatch[1]!, email: EMAIL, password: PASSWORD });
  const res = await app.request(
    "/login",
    {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded", cookie },
      body: form.toString(),
    },
    env,
  );
  const loginSetCookie = res.headers.get("set-cookie") ?? "";
  const sessionMatch = loginSetCookie.match(/chq_session=([^;]+)/);
  if (!sessionMatch) throw new Error("no chq_session cookie on login response");
  return `chq_session=${sessionMatch[1]}`;
}

describe("GET /account/password — phone action bar Cancel (DEC-385/DEC-200 amendments)", () => {
  it("organizer: Cancel points at /admin, desktop hint text still present", async () => {
    const { db, state } = makeFakeDb();
    await seedUser(state, "organizer");
    const { app, env } = buildApp(db);
    const sessionCookie = await login(app, env);

    const res = await app.request("/account/password", { headers: { cookie: sessionCookie } }, env);
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('class="chq-btn chq-btn-secondary chq-phone-actionbar-secondary chq-auth-cancel" href="/admin"');
    expect(html).toContain("You stay signed in on this device");
  });

  it("speaker: Cancel points at /portal, desktop hint text still present", async () => {
    const { db, state } = makeFakeDb();
    await seedUser(state, "speaker");
    const { app, env } = buildApp(db);
    const sessionCookie = await login(app, env);

    const res = await app.request("/account/password", { headers: { cookie: sessionCookie } }, env);
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('class="chq-btn chq-btn-secondary chq-phone-actionbar-secondary chq-auth-cancel" href="/portal"');
    expect(html).toContain("You stay signed in on this device");
  });
});

// -----------------------------------------------------------------------
// (b) source-scan coverage, mirroring app/src/shell-geometry.test.ts:
// jsdom never evaluates @media rules, so assert on the stylesheet text
// directly rather than on computed style.
// -----------------------------------------------------------------------

const THEME_TS = readFileSync(join(REPO_ROOT, "src/views/theme.ts"), "utf-8");
const AUTH_CSS_TS = readFileSync(join(REPO_ROOT, "src/routes/auth.css.ts"), "utf-8");

/** Strips every @media {...} block (single level of nested rule braces). */
function withoutMedia(css: string): string {
  return css.replace(/@media[^{]*\{(?:[^{}]*\{[^{}]*\}[^{}]*)*\}/g, "");
}

/** Extracts the contents of every `@media (max-width: 700px) { ... }` block via balanced-brace scanning. */
function extract700Blocks(src: string): string[] {
  const blocks: string[] = [];
  const marker = "@media (max-width: 700px)";
  let searchFrom = 0;
  for (;;) {
    const idx = src.indexOf(marker, searchFrom);
    if (idx === -1) break;
    const openBrace = src.indexOf("{", idx);
    let depth = 0;
    let i = openBrace;
    for (; i < src.length; i++) {
      if (src[i] === "{") depth++;
      else if (src[i] === "}") {
        depth--;
        if (depth === 0) break;
      }
    }
    blocks.push(src.slice(openBrace + 1, i));
    searchFrom = i + 1;
  }
  return blocks;
}

/** Extracts a top-level (not inside an @media block) rule's declaration body by selector. */
function topLevelRuleBody(css: string, selector: string): string {
  const stripped = withoutMedia(css);
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = stripped.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`));
  const body = match?.[1];
  if (body === undefined) throw new Error(`no top-level rule found for ${selector}`);
  return body;
}

describe("account/password phone action bar CSS source-scan (DEC-385)", () => {
  it(".chq-auth-cancel is display:none at top level, switched on inside auth.css.ts's 700px block", () => {
    const topLevel = topLevelRuleBody(AUTH_CSS_TS, ".chq-auth-cancel");
    expect(topLevel).toMatch(/display:\s*none/);

    const blocks = extract700Blocks(AUTH_CSS_TS);
    expect(blocks.some((b) => /\.chq-auth-cancel\s*\{[^}]*display:\s*inline-flex/.test(b))).toBe(true);
  });

  it(".chq-phone-actionbar is display:none at top level in theme.ts, switched on inside theme.ts's 700px block", () => {
    const topLevel = topLevelRuleBody(THEME_TS, ".chq-phone-actionbar");
    expect(topLevel).toMatch(/display:\s*none/);

    const blocks = extract700Blocks(THEME_TS);
    expect(blocks.some((b) => /\.chq-phone-actionbar\s*\{[^}]*display:\s*flex/.test(b))).toBe(true);
  });

  it(".chq-phone-actionbar's band rules (border-top/background/padding) live only in theme.ts, never restated in auth.css.ts", () => {
    const themeBlocks = extract700Blocks(THEME_TS);
    const actionbarRuleInTheme = themeBlocks
      .map((b) => b.match(/\.chq-phone-actionbar\s*\{([^}]*)\}/))
      .find((m) => m)?.[1];
    expect(actionbarRuleInTheme).toBeDefined();
    expect(actionbarRuleInTheme).toMatch(/border-top:\s*1px solid var\(--chq-ink\)/);
    expect(actionbarRuleInTheme).toMatch(/background:\s*var\(--chq-surface-sunk\)/);
    expect(actionbarRuleInTheme).toMatch(/padding:\s*12px 16px 16px/);

    // Never restated anywhere in auth.css.ts, media or otherwise.
    expect(AUTH_CSS_TS).not.toMatch(/\.chq-phone-actionbar\s*\{/);
  });
});
