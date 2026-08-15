// DEC-124 (wave 48 amendment): the auth surface family adopts the shared
// no-red error vocabulary (src/views/error-states.css.ts) instead of
// re-inventing its own `.chq-auth-error` rule. A rejected sign-in renders
// the shared `.chq-error-summary` block (one non-enumerating message, no
// anchor list) and marks BOTH credential fields `.chq-field-invalid` --
// never naming which one failed (DEC-004 oracle rule).

import { describe, expect, it } from "vitest";
import { Hono } from "hono";
import * as schema from "../src/db/schema";
import { hashPassword } from "../src/auth/password";
import { authRoutes } from "../src/routes/auth";
import { registerErrorHandler } from "../src/server/http";
import { CSRF_COOKIE_NAME } from "../src/auth/cookies";
import { AUTH_CSS } from "../src/routes/auth.css";
import { ERROR_STATES_CSS } from "../src/views/error-states.css";
import type { AppEnv } from "../src/server/env";
import type { KVStore } from "../src/auth/claim";

describe("AUTH_CSS composes the shared no-red error vocabulary", () => {
  it("contains the ERROR_STATES_CSS body (chq-field-invalid selector)", () => {
    expect(AUTH_CSS).toContain(".chq-field-invalid");
    expect(AUTH_CSS).toContain(ERROR_STATES_CSS.trim());
  });

  it("no longer declares a bespoke .chq-auth-error rule", () => {
    expect(AUTH_CSS).not.toContain(".chq-auth-error");
  });
});

type Row = Record<string, unknown>;

function chunkLiteral(chunk: unknown): string | null {
  if (chunk && typeof chunk === "object" && "value" in (chunk as object)) {
    const v = (chunk as { value: unknown }).value;
    if (Array.isArray(v) && typeof v[0] === "string") return v[0];
  }
  return null;
}

function columnName(col: unknown): string | undefined {
  if (col && typeof col === "object" && "name" in (col as object)) {
    return (col as { name: string }).name;
  }
  return undefined;
}

function matches(cond: unknown, row: Row): boolean {
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
  const column = columnName(chunks[1]);
  const rawValue = chunks[3];
  const value =
    rawValue && typeof rawValue === "object" && "value" in (rawValue as object) ? (rawValue as { value: unknown }).value : rawValue;
  const actual = column ? row[column] : undefined;
  return actual === value;
}

class InMemoryKV implements KVStore {
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

const EMAIL = "error-vocab-user@example.test";
const PASSWORD = "correct-password-123";

async function buildApp() {
  const passwordHash = await hashPassword(PASSWORD);
  const users: Row[] = [{ id: "u_1", orgId: "org_1", email: EMAIL, passwordHash, role: "organizer", contactId: null }];
  const rateLimits: Row[] = [];

  const db = {
    select() {
      return {
        from(table: unknown) {
          return {
            where(cond: unknown) {
              const rows = table === schema.user ? users : table === schema.rateLimit ? rateLimits : [];
              return { limit: (n: number) => Promise.resolve(rows.filter((r) => matches(cond, r)).slice(0, n)) };
            },
            orderBy: () => ({ limit: () => Promise.resolve([]) }),
          };
        },
      };
    },
    insert(table: unknown) {
      return {
        values(row: Row) {
          if (table === schema.rateLimit) {
            const existing = rateLimits.find((r) => r.key === row.key);
            const upsert = () => {
              if (existing) existing.count = (existing.count as number) + 1;
              else rateLimits.push({ ...row });
              return (existing ? existing.count : (rateLimits.find((r) => r.key === row.key) as Row).count) as number;
            };
            return {
              onConflictDoUpdate: () => ({
                returning: async () => [{ count: upsert() }],
              }),
            };
          }
          return Promise.resolve();
        },
      };
    },
    update() {
      return { set: () => ({ where: () => Promise.resolve() }) };
    },
    delete() {
      return { where: () => Promise.resolve() };
    },
  } as unknown as AppEnv["Variables"]["db"];

  const kv = new InMemoryKV();
  const app = new Hono<AppEnv>();
  registerErrorHandler(app);
  app.use("*", async (c, next) => {
    c.set("db", db);
    await next();
  });
  app.route("/", authRoutes);
  const env = { KV: kv as unknown as AppEnv["Bindings"]["KV"] };
  return { app, env };
}

async function getCsrf(app: Hono<AppEnv>, env: { KV: AppEnv["Bindings"]["KV"] }) {
  const res = await app.request("/login", {}, env);
  const setCookie = res.headers.get("set-cookie") ?? "";
  const match = setCookie.match(new RegExp(`${CSRF_COOKIE_NAME}=([^;]+)`));
  if (!match) throw new Error(`no ${CSRF_COOKIE_NAME} cookie set on /login`);
  return { csrf: match[1]!, cookie: `${CSRF_COOKIE_NAME}=${match[1]}` };
}

describe("rejected LoginPage marks both credential fields, names neither", () => {
  it("renders exactly one chq-error-summary message and marks email+password chq-field-invalid", async () => {
    const { app, env } = await buildApp();
    const { csrf, cookie } = await getCsrf(app, env);
    const form = new URLSearchParams({ [CSRF_COOKIE_NAME]: csrf, email: EMAIL, password: "wrong-password" });
    const res = await app.request(
      "/login",
      { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded", cookie }, body: form.toString() },
      env,
    );
    expect(res.status).toBe(401);
    const html = await res.text();

    // Exactly one error-summary block in the markup (CSS rules in <style>
    // legitimately mention the class name multiple times, so count only
    // the rendered element).
    expect((html.match(/class="chq-error-summary"/g) ?? []).length).toBe(1);
    const body = html.slice(html.indexOf("<body>"));
    expect(body).toContain('role="alert"');
    expect(body).not.toContain("chq-error-summary-link");
    expect(body).not.toContain("<ul");

    // The message never names email or password specifically.
    const h2Match = html.match(/<h2>([^<]*)<\/h2>/);
    expect(h2Match).not.toBeNull();
    const message = h2Match![1]!.toLowerCase();
    expect(message).not.toContain("password is wrong");
    expect(message).not.toContain("email not found");

    // Both credential inputs carry chq-field-invalid.
    const emailInputMatch = html.match(/<input[^>]*name="email"[^>]*>/);
    const passwordInputMatch = html.match(/<input[^>]*name="password"[^>]*>/);
    expect(emailInputMatch).not.toBeNull();
    expect(passwordInputMatch).not.toBeNull();
    expect(emailInputMatch![0]).toContain("chq-field-invalid");
    expect(passwordInputMatch![0]).toContain("chq-field-invalid");

    // No bespoke .chq-auth-error class survives on the response.
    expect(html).not.toContain(".chq-auth-error");
    expect(body).not.toContain("chq-auth-error");
  });
});
