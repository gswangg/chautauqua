// DEC-072: the login route keys its rate limiter by identity, not just IP —
// a single per-IP 'login' bucket let one attacker lock out every account
// behind a shared IP, and let an attacker rotate x-forwarded-for to bypass
// a per-account cap. src/routes/auth.tsx now runs two independent scoped
// checks per POST /login: 'login-user' keyed by the submitted (trimmed,
// lowercased) email, and 'login-ip' keyed by requestIpFromHeaders(...).
// These tests exercise checkAndIncrementScopedLimit directly with those
// same scopes/params to prove the identity-keying property, without
// standing up the full Hono app + DB.

import { describe, expect, it } from "vitest";
import { checkAndIncrementScopedLimit, requestIpFromHeaders } from "../src/lib/rate-limit";
import type { KVStore } from "../src/lib/draft";

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

const LOGIN_USER_OPTS = { windowSeconds: 900, max: 20 };
const LOGIN_IP_OPTS = { windowSeconds: 900, max: 100 };

describe("DEC-072: identity-keyed login rate limiting", () => {
  it("two emails hammering login from the same IP get independent per-email budgets", async () => {
    const kv = new InMemoryKV();
    const now = 1_000_000;
    const sharedIp = "203.0.113.5";

    // alice@example.com exhausts her 20-attempt budget.
    for (let i = 0; i < 20; i++) {
      const result = await checkAndIncrementScopedLimit(
        kv,
        "login-user",
        "alice@example.com",
        now,
        LOGIN_USER_OPTS,
      );
      expect(result.ok).toBe(true);
    }
    const aliceCapped = await checkAndIncrementScopedLimit(
      kv,
      "login-user",
      "alice@example.com",
      now,
      LOGIN_USER_OPTS,
    );
    expect(aliceCapped.ok).toBe(false);

    // bob@example.com, from the same IP, still has his full budget — the
    // old shared per-IP bucket would have blocked him too.
    const bobFirst = await checkAndIncrementScopedLimit(
      kv,
      "login-user",
      "bob@example.com",
      now,
      LOGIN_USER_OPTS,
    );
    expect(bobFirst).toEqual({ ok: true, count: 1 });

    // Both share one IP bucket, which is far from capped at this volume.
    await checkAndIncrementScopedLimit(kv, "login-ip", sharedIp, now, LOGIN_IP_OPTS);
    const ipStatus = await checkAndIncrementScopedLimit(kv, "login-ip", sharedIp, now, LOGIN_IP_OPTS);
    expect(ipStatus.ok).toBe(true);
  });

  it("one email is capped at 20 regardless of rotating x-forwarded-for values", async () => {
    const kv = new InMemoryKV();
    const now = 2_000_000;
    const email = "victim@example.com";

    for (let i = 0; i < 20; i++) {
      // Simulate an attacker rotating XFF on every request to dodge an
      // IP-only limiter; the per-email scope must not care.
      const ip = requestIpFromHeaders(() => `198.51.100.${i}`);
      const result = await checkAndIncrementScopedLimit(kv, "login-user", email, now, LOGIN_USER_OPTS);
      expect(result.ok).toBe(true);
      expect(ip).toBe(`198.51.100.${i}`);
    }

    const twentyFirst = await checkAndIncrementScopedLimit(
      kv,
      "login-user",
      email,
      now,
      LOGIN_USER_OPTS,
    );
    expect(twentyFirst.ok).toBe(false);
    expect(twentyFirst.count).toBe(20);
  });
});
