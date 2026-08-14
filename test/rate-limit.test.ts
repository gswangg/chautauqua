// DEC-948: the rate limiter's counter moved off a KV get-then-put race to an
// atomic D1 upsert (`insert ... on conflict(key) do update set count =
// rate_limit.count + 1 returning count`). Runs against a real in-memory
// SQLite engine (same technique as test/plan-delete-cascade.test.ts) so the
// actual repo query executes, not a hand-simulated row shape -- an
// in-memory Map fake would be strongly consistent and hide exactly the race
// this migration fixes.

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { drizzle } from "drizzle-orm/sqlite-proxy";
import * as schema from "../src/db/schema";
import {
  checkAndIncrementScopedLimit,
  refundScopedLimit,
  resetScopedLimit,
} from "../src/server/repo/rate-limit";
import { requestIpFromHeaders, scopedRateLimitKey } from "../src/lib/rate-limit";
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

describe("scopedRateLimitKey", () => {
  it("formats scope:id:windowStart", () => {
    expect(scopedRateLimitKey("login", "1.2.3.4", 5000)).toBe("ratelimit:login:1.2.3.4:5000");
  });

  it("DEC-057: 'submit' scope key matches the legacy submit-core key format", () => {
    const ip = "1.2.3.4";
    const windowStart = 5000;
    expect(scopedRateLimitKey("submit", ip, windowStart)).toBe(`ratelimit:submit:${ip}:${windowStart}`);
  });
});

describe("checkAndIncrementScopedLimit (D1, DEC-948)", () => {
  const opts = { windowSeconds: 900, max: 3 };
  let db: Db;
  let sqlite: DatabaseSync;

  beforeEach(() => {
    ({ db, sqlite } = makeTestDb());
  });

  afterEach(() => {
    sqlite.close();
  });

  it("allows requests under the cap and increments the count", async () => {
    const now = 1_000_000;
    const first = await checkAndIncrementScopedLimit(db, "login", "1.1.1.1", now, opts);
    expect(first).toEqual({ ok: true, count: 1 });
    const second = await checkAndIncrementScopedLimit(db, "login", "1.1.1.1", now + 10, opts);
    expect(second).toEqual({ ok: true, count: 2 });
  });

  it("enforces the cap: rejects once max is exceeded", async () => {
    const now = 1_000_000;
    await checkAndIncrementScopedLimit(db, "login", "2.2.2.2", now, opts);
    await checkAndIncrementScopedLimit(db, "login", "2.2.2.2", now, opts);
    await checkAndIncrementScopedLimit(db, "login", "2.2.2.2", now, opts);
    const fourth = await checkAndIncrementScopedLimit(db, "login", "2.2.2.2", now, opts);
    expect(fourth).toEqual({ ok: false, count: 4 });
  });

  it("rolls over into a fresh window once windowSeconds elapses", async () => {
    const now = 1_000_000;
    await checkAndIncrementScopedLimit(db, "login", "3.3.3.3", now, opts);
    await checkAndIncrementScopedLimit(db, "login", "3.3.3.3", now, opts);
    await checkAndIncrementScopedLimit(db, "login", "3.3.3.3", now, opts);
    const capped = await checkAndIncrementScopedLimit(db, "login", "3.3.3.3", now, opts);
    expect(capped.ok).toBe(false);

    const nextWindow = now + opts.windowSeconds * 1000;
    const afterRollover = await checkAndIncrementScopedLimit(db, "login", "3.3.3.3", nextWindow, opts);
    expect(afterRollover).toEqual({ ok: true, count: 1 });
  });

  it("isolates counters across scopes for the same id", async () => {
    const now = 1_000_000;
    await checkAndIncrementScopedLimit(db, "login", "4.4.4.4", now, opts);
    await checkAndIncrementScopedLimit(db, "login", "4.4.4.4", now, opts);
    await checkAndIncrementScopedLimit(db, "login", "4.4.4.4", now, opts);
    const loginCapped = await checkAndIncrementScopedLimit(db, "login", "4.4.4.4", now, opts);
    expect(loginCapped.ok).toBe(false);

    const claimAttempt = await checkAndIncrementScopedLimit(db, "claim", "4.4.4.4", now, opts);
    expect(claimAttempt).toEqual({ ok: true, count: 1 });
  });

  it("DEC-072: 'submit' scope rejects the 61st submission within the same hour window", async () => {
    const now = 1_000_000;
    const submitOpts = { windowSeconds: 3600, max: 60 };
    for (let i = 0; i < 60; i++) {
      const result = await checkAndIncrementScopedLimit(db, "submit", "5.5.5.5", now, submitOpts);
      expect(result.ok).toBe(true);
    }
    const sixtyFirst = await checkAndIncrementScopedLimit(db, "submit", "5.5.5.5", now, submitOpts);
    expect(sixtyFirst.ok).toBe(false);
    expect(sixtyFirst.count).toBe(61);
  });

  // DEC-948's motivating case: the KV read-modify-write let N concurrent
  // callers all observe count=0 and all pass. The D1 upsert's RETURNING
  // clause makes each concurrent caller land on a distinct count, so
  // exactly `max` of N=cap+3 concurrent calls succeed.
  it("N concurrent callers past the cap: EXACTLY max succeed", async () => {
    const now = 1_000_000;
    const cap = 5;
    const n = cap + 3;
    const results = await Promise.all(
      Array.from({ length: n }, () => checkAndIncrementScopedLimit(db, "concurrent", "9.9.9.9", now, { windowSeconds: 900, max: cap })),
    );
    const okCount = results.filter((r) => r.ok).length;
    expect(okCount).toBe(cap);

    // Every returned count is distinct (1..n) -- no two concurrent callers
    // ever observed the same pre-increment value, which is exactly the
    // property a KV get-then-put race would have violated.
    const counts = results.map((r) => r.count).sort((a, b) => a - b);
    expect(counts).toEqual(Array.from({ length: n }, (_, i) => i + 1));
  });
});

describe("DEC-180 (wave-29 amendment): refundScopedLimit / resetScopedLimit (D1, DEC-948)", () => {
  const opts = { windowSeconds: 900, max: 3 };
  let db: Db;
  let sqlite: DatabaseSync;

  beforeEach(() => {
    ({ db, sqlite } = makeTestDb());
  });

  afterEach(() => {
    sqlite.close();
  });

  it("refundScopedLimit gives back one unit of a prior atomic spend", async () => {
    const now = 1_000_000;
    await checkAndIncrementScopedLimit(db, "login-user", "b@example.com", now, opts);
    await checkAndIncrementScopedLimit(db, "login-user", "b@example.com", now, opts);
    await checkAndIncrementScopedLimit(db, "login-user", "b@example.com", now, opts);
    await refundScopedLimit(db, "login-user", "b@example.com", now, { windowSeconds: opts.windowSeconds });
    const after = await checkAndIncrementScopedLimit(db, "login-user", "b@example.com", now, opts);
    expect(after).toEqual({ ok: true, count: 3 });
  });

  it("refundScopedLimit never drives the counter below zero", async () => {
    const now = 1_000_000;
    await refundScopedLimit(db, "login-user", "c@example.com", now, { windowSeconds: opts.windowSeconds });
    const row = sqlite
      .prepare("select count from rate_limit where key = ?")
      .all(scopedRateLimitKey("login-user", "c@example.com", 0));
    // No row exists yet -- the `count > 0` guard means the update matches
    // zero rows rather than inserting a negative one.
    expect(row).toHaveLength(0);
  });

  it("resetScopedLimit deletes the current window's counter row", async () => {
    const now = 1_000_000;
    await checkAndIncrementScopedLimit(db, "login-user", "d@example.com", now, opts);
    await checkAndIncrementScopedLimit(db, "login-user", "d@example.com", now, opts);
    await resetScopedLimit(db, "login-user", "d@example.com", now, opts.windowSeconds);
    const after = await checkAndIncrementScopedLimit(db, "login-user", "d@example.com", now, opts);
    expect(after).toEqual({ ok: true, count: 1 });
  });
});

describe("requestIpFromHeaders", () => {
  it("prefers cf-connecting-ip", () => {
    const headers: Record<string, string> = {
      "cf-connecting-ip": "9.9.9.9",
      "x-forwarded-for": "1.1.1.1, 2.2.2.2",
    };
    expect(requestIpFromHeaders((name) => headers[name])).toBe("9.9.9.9");
  });

  it("falls back to the first x-forwarded-for hop", () => {
    const headers: Record<string, string> = { "x-forwarded-for": "1.1.1.1, 2.2.2.2" };
    expect(requestIpFromHeaders((name) => headers[name])).toBe("1.1.1.1");
  });

  it("falls back to unknown when no headers present", () => {
    expect(requestIpFromHeaders(() => undefined)).toBe("unknown");
  });
});
