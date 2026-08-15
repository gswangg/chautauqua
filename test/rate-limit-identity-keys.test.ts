// DEC-072: the login route keys its rate limiter by identity, not just IP —
// a single per-IP 'login' bucket let one attacker lock out every account
// behind a shared IP, and let an attacker rotate x-forwarded-for to bypass
// a per-account cap. src/routes/auth-login.tsx now runs two independent
// scoped checks per POST /login: 'login-user' keyed by
// loginIdentityKey(email, ip) (email|ip, src/routes/auth-helpers.ts —
// DEC-072 wave-54 amendment: a bare-email key let a stranger who merely
// knows a valid organizer address lock the real owner out from ANY IP,
// with no unlock path), and 'login-ip' keyed by requestIpFromHeaders(...).
// These tests exercise checkAndIncrementScopedLimit directly with those
// same scopes/params to prove the identity-keying property, without
// standing up the full Hono app.
//
// DEC-948: the counter moved from KV to a D1 upsert (src/server/repo/rate-limit.ts)
// — same harness technique as test/rate-limit.test.ts (real in-memory SQLite
// via node:sqlite + drizzle-orm/sqlite-proxy).

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { drizzle } from "drizzle-orm/sqlite-proxy";
import * as schema from "../src/db/schema";
import { checkAndIncrementScopedLimit } from "../src/server/repo/rate-limit";
import { requestIpFromHeaders } from "../src/lib/rate-limit";
import { loginIdentityKey } from "../src/routes/auth-helpers";
import type { Db } from "../src/server/context";

const DDL = `
create table rate_limit (
  key text primary key,
  count integer not null,
  expires_at integer not null
);
`;

function makeTestDb(): { db: Db; sqlite: DatabaseSync } {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(DDL);
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

const LOGIN_USER_OPTS = { windowSeconds: 900, max: 20 };
const LOGIN_IP_OPTS = { windowSeconds: 900, max: 100 };

describe("DEC-072: identity-keyed login rate limiting (D1, DEC-948)", () => {
  let db: Db;
  let sqlite: DatabaseSync;

  beforeEach(() => {
    ({ db, sqlite } = makeTestDb());
  });

  afterEach(() => {
    sqlite.close();
  });

  it("two emails hammering login from the same IP get independent per-email budgets", async () => {
    const now = 1_000_000;
    const sharedIp = "203.0.113.5";

    // alice@example.com exhausts her 20-attempt budget from this IP.
    for (let i = 0; i < 20; i++) {
      const result = await checkAndIncrementScopedLimit(
        db,
        "login-user",
        loginIdentityKey("alice@example.com", sharedIp),
        now,
        LOGIN_USER_OPTS,
      );
      expect(result.ok).toBe(true);
    }
    const aliceCapped = await checkAndIncrementScopedLimit(
      db,
      "login-user",
      loginIdentityKey("alice@example.com", sharedIp),
      now,
      LOGIN_USER_OPTS,
    );
    expect(aliceCapped.ok).toBe(false);

    // bob@example.com, from the same IP, still has his full budget — the
    // old shared per-IP bucket would have blocked him too.
    const bobFirst = await checkAndIncrementScopedLimit(
      db,
      "login-user",
      loginIdentityKey("bob@example.com", sharedIp),
      now,
      LOGIN_USER_OPTS,
    );
    expect(bobFirst).toEqual({ ok: true, count: 1 });

    // Both share one IP bucket, which is far from capped at this volume.
    await checkAndIncrementScopedLimit(db, "login-ip", sharedIp, now, LOGIN_IP_OPTS);
    const ipStatus = await checkAndIncrementScopedLimit(db, "login-ip", sharedIp, now, LOGIN_IP_OPTS);
    expect(ipStatus.ok).toBe(true);
  });

  it("DEC-072 wave-54: rotating x-forwarded-for values give the same victim email a fresh budget per IP", async () => {
    // The old bare-email key meant an attacker who merely knew a victim's
    // email could spend the victim's ENTIRE shared budget from any IP,
    // permanently locking the real owner out (no unlock path). Keying on
    // email|ip means each source IP gets its own bucket against that
    // email — the attacker only ever exhausts their own IP's slice.
    const now = 2_000_000;
    const email = "victim@example.com";

    for (let i = 0; i < 20; i++) {
      const ip = requestIpFromHeaders(() => `198.51.100.${i}`);
      const result = await checkAndIncrementScopedLimit(
        db,
        "login-user",
        loginIdentityKey(email, ip),
        now,
        LOGIN_USER_OPTS,
      );
      // Each rotated IP is a fresh bucket for this email — none of these
      // twenty single attempts get capped.
      expect(result).toEqual({ ok: true, count: 1 });
    }

    // But hammering the SAME email from the SAME IP twenty-one times still
    // caps at 20 — the per-identity budget still bites the attacker who
    // doesn't rotate.
    const fixedIp = "198.51.100.200";
    for (let i = 0; i < 20; i++) {
      const result = await checkAndIncrementScopedLimit(
        db,
        "login-user",
        loginIdentityKey(email, fixedIp),
        now,
        LOGIN_USER_OPTS,
      );
      expect(result.ok).toBe(true);
    }
    const twentyFirst = await checkAndIncrementScopedLimit(
      db,
      "login-user",
      loginIdentityKey(email, fixedIp),
      now,
      LOGIN_USER_OPTS,
    );
    expect(twentyFirst.ok).toBe(false);
    expect(twentyFirst.count).toBe(21);
  });
});
