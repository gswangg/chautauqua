// DEC-180 (wave-36 amendment): POST /forgot spent exactly one bucket keyed
// on the normalised EMAIL. An attacker sending one request per distinct
// unknown address never hit the same email bucket twice, so a single IP
// could mint unlimited reset tokens and unlimited reset mail. This test
// proves the new "forgot-ip" bucket (mirroring /login's "login-ip" bucket)
// actually closes that gap: it caps request volume by IP regardless of how
// many distinct email addresses are tried, without becoming a new
// enumeration oracle and without ever touching the per-email budget on an
// IP denial.
//
// Harness borrowed from test/rate-limit-atomicity.test.ts's POST /forgot
// section: a fake db that evaluates real drizzle eq()/and()/gt() condition
// trees so the atomic upsert/refund statements run for real, not stubbed.

import { describe, expect, it } from "vitest";
import { Hono } from "hono";
import * as schema from "../src/db/schema";
import { hashPassword } from "../src/auth/password";
import { authRoutes } from "../src/routes/auth";
import { registerErrorHandler } from "../src/server/http";
import { CSRF_COOKIE_NAME } from "../src/auth/cookies";
import type { AppEnv } from "../src/server/env";
import type { KVStore } from "../src/auth/claim";

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
  const operator = chunkLiteral(chunks[2]) ?? " = ";
  const rawValue = chunks[3];
  const value = rawValue && typeof rawValue === "object" && "value" in (rawValue as object) ? (rawValue as { value: unknown }).value : rawValue;
  const actual = column ? row[column] : undefined;
  if (operator === " > ") return (actual as number) > (value as number);
  if (operator === " <= ") return (actual as number) <= (value as number);
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

const KNOWN_EMAIL = "known-forgot@example.test";
const PASSWORD = "correct-password-123";

async function buildForgotApp() {
  const passwordHash = await hashPassword(PASSWORD);
  const users: Row[] = [{ id: "u_1", orgId: "org_1", email: KNOWN_EMAIL, passwordHash, role: "organizer", contactId: null }];
  const rateLimits: Row[] = [];
  const events: Row[] = [];

  const db = {
    select() {
      return {
        from(table: unknown) {
          const rows = table === schema.user ? users : table === schema.rateLimit ? rateLimits : table === schema.event ? events : [];
          return {
            where(cond: unknown) {
              const filtered = rows.filter((r) => matches(cond, r));
              return {
                limit: (n: number) => Promise.resolve(filtered.slice(0, n)),
                orderBy: () => ({
                  limit: (n: number) => Promise.resolve(filtered.slice(0, n)),
                  then: (resolve: (v: Row[]) => void) => resolve(filtered),
                }),
              };
            },
            orderBy: () => ({
              limit: (n: number) => Promise.resolve(rows.slice(0, n)),
              then: (resolve: (v: Row[]) => void) => resolve(rows),
            }),
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
            return { onConflictDoUpdate: () => ({ returning: async () => [{ count: upsert() }] }) };
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
  const env = { KV: kv as unknown as AppEnv["Bindings"]["KV"], PUBLIC_BASE_URL: "http://127.0.0.1:8787" };
  return { app, env, rateLimits };
}

async function getForgotCsrf(app: Hono<AppEnv>, env: { KV: AppEnv["Bindings"]["KV"] }, ip?: string) {
  const headers: Record<string, string> = {};
  if (ip) headers["cf-connecting-ip"] = ip;
  const res = await app.request("/forgot", { headers }, env);
  const setCookie = res.headers.get("set-cookie") ?? "";
  const match = setCookie.match(new RegExp(`${CSRF_COOKIE_NAME}=([^;]+)`));
  if (!match) throw new Error(`no ${CSRF_COOKIE_NAME} cookie set on /forgot`);
  return { csrf: match[1]!, cookie: `${CSRF_COOKIE_NAME}=${match[1]}` };
}

async function postForgot(app: Hono<AppEnv>, env: { KV: AppEnv["Bindings"]["KV"] }, email: string, ip?: string) {
  const { csrf, cookie } = await getForgotCsrf(app, env, ip);
  const form = new URLSearchParams({ [CSRF_COOKIE_NAME]: csrf, email });
  const headers: Record<string, string> = { "content-type": "application/x-www-form-urlencoded", cookie };
  if (ip) headers["cf-connecting-ip"] = ip;
  return app.request("/forgot", { method: "POST", headers, body: form.toString() }, env);
}

describe("POST /forgot: per-IP bucket closes the address-spraying gap", () => {
  it("(1) 100 posts from one IP across 100 distinct unknown addresses all admit; the 101st is 429", async () => {
    const { app, env } = await buildForgotApp();
    const ip = "203.0.113.7";
    for (let i = 0; i < 100; i++) {
      const res = await postForgot(app, env, `spray-${i}@example.test`, ip);
      expect(res.status).toBe(200);
    }
    const res = await postForgot(app, env, "spray-100@example.test", ip);
    expect(res.status).toBe(429);
  });

  it("(2) at the same request count, a known and an unknown address produce identical status and body", async () => {
    // Stay within the per-email cap (AUTH_RATE_LIMIT_MAX = 20) so the
    // per-email bucket does not itself deny either branch — this isolates
    // the comparison to what the IP bucket alone contributes.
    const ip = "203.0.113.55";

    const knownApp = await buildForgotApp();
    let knownRes!: Response;
    for (let i = 0; i < 20; i++) {
      knownRes = await postForgot(knownApp.app, knownApp.env, KNOWN_EMAIL, ip);
    }
    expect(knownRes.status).toBe(200);

    const unknownApp = await buildForgotApp();
    let unknownRes!: Response;
    for (let i = 0; i < 20; i++) {
      unknownRes = await postForgot(unknownApp.app, unknownApp.env, "nobody-at-all@example.test", ip);
    }
    expect(unknownRes.status).toBe(200);

    expect(unknownRes.status).toBe(knownRes.status);
    const knownBody = await knownRes.text();
    const unknownBody = await unknownRes.text();
    expect(unknownBody).toBe(knownBody);
  });

  it("(3) after an IP-denied request, the same address from a different IP still gets a 200 CheckEmailPage", async () => {
    const { app, env } = await buildForgotApp();
    const deniedIp = "198.51.100.9";
    for (let i = 0; i < 100; i++) {
      await postForgot(app, env, `burn-${i}@example.test`, deniedIp);
    }
    const denied = await postForgot(app, env, KNOWN_EMAIL, deniedIp);
    expect(denied.status).toBe(429);

    const otherIp = "198.51.100.10";
    const admitted = await postForgot(app, env, KNOWN_EMAIL, otherIp);
    expect(admitted.status).toBe(200);
    const body = await admitted.text();
    expect(body).toMatch(/check your email/i);
  });

  it("(4) the per-email bucket still denies at max+1 even when every request comes from a different IP", async () => {
    const { app, env } = await buildForgotApp();
    for (let i = 0; i < 20; i++) {
      const res = await postForgot(app, env, KNOWN_EMAIL, `10.0.0.${i}`);
      expect(res.status).toBe(200);
    }
    const res = await postForgot(app, env, KNOWN_EMAIL, "10.0.0.21");
    expect(res.status).toBe(429);
  });
});
