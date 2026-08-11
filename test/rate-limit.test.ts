import { describe, expect, it } from "vitest";
import {
  checkAndIncrementScopedLimit,
  incrementScopedLimit,
  peekScopedLimit,
  requestIpFromHeaders,
  resetScopedLimit,
  scopedRateLimitKey,
} from "../src/lib/rate-limit";
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

  has(key: string): boolean {
    return this.store.has(key);
  }
}

describe("scopedRateLimitKey", () => {
  it("formats scope:id:windowStart", () => {
    expect(scopedRateLimitKey("login", "1.2.3.4", 5000)).toBe(
      "ratelimit:login:1.2.3.4:5000",
    );
  });

  it("DEC-057: 'submit' scope key matches the legacy submit-core key format", () => {
    const ip = "1.2.3.4";
    const windowStart = 5000;
    expect(scopedRateLimitKey("submit", ip, windowStart)).toBe(
      `ratelimit:submit:${ip}:${windowStart}`,
    );
  });
});

describe("checkAndIncrementScopedLimit", () => {
  const opts = { windowSeconds: 900, max: 3 };

  it("allows requests under the cap and increments the count", async () => {
    const kv = new InMemoryKV();
    const now = 1_000_000;
    const first = await checkAndIncrementScopedLimit(kv, "login", "1.1.1.1", now, opts);
    expect(first).toEqual({ ok: true, count: 1 });
    const second = await checkAndIncrementScopedLimit(kv, "login", "1.1.1.1", now + 10, opts);
    expect(second).toEqual({ ok: true, count: 2 });
  });

  it("enforces the cap: rejects once max is reached", async () => {
    const kv = new InMemoryKV();
    const now = 1_000_000;
    await checkAndIncrementScopedLimit(kv, "login", "2.2.2.2", now, opts);
    await checkAndIncrementScopedLimit(kv, "login", "2.2.2.2", now, opts);
    await checkAndIncrementScopedLimit(kv, "login", "2.2.2.2", now, opts);
    const fourth = await checkAndIncrementScopedLimit(kv, "login", "2.2.2.2", now, opts);
    expect(fourth).toEqual({ ok: false, count: 3 });
  });

  it("rolls over into a fresh window once windowSeconds elapses", async () => {
    const kv = new InMemoryKV();
    const now = 1_000_000;
    await checkAndIncrementScopedLimit(kv, "login", "3.3.3.3", now, opts);
    await checkAndIncrementScopedLimit(kv, "login", "3.3.3.3", now, opts);
    await checkAndIncrementScopedLimit(kv, "login", "3.3.3.3", now, opts);
    const capped = await checkAndIncrementScopedLimit(kv, "login", "3.3.3.3", now, opts);
    expect(capped.ok).toBe(false);

    const nextWindow = now + opts.windowSeconds * 1000;
    const afterRollover = await checkAndIncrementScopedLimit(
      kv,
      "login",
      "3.3.3.3",
      nextWindow,
      opts,
    );
    expect(afterRollover).toEqual({ ok: true, count: 1 });
  });

  it("isolates counters across scopes for the same id", async () => {
    const kv = new InMemoryKV();
    const now = 1_000_000;
    await checkAndIncrementScopedLimit(kv, "login", "4.4.4.4", now, opts);
    await checkAndIncrementScopedLimit(kv, "login", "4.4.4.4", now, opts);
    await checkAndIncrementScopedLimit(kv, "login", "4.4.4.4", now, opts);
    const loginCapped = await checkAndIncrementScopedLimit(kv, "login", "4.4.4.4", now, opts);
    expect(loginCapped.ok).toBe(false);

    const claimAttempt = await checkAndIncrementScopedLimit(kv, "claim", "4.4.4.4", now, opts);
    expect(claimAttempt).toEqual({ ok: true, count: 1 });
  });

  it("DEC-072: 'submit' scope rejects the 61st submission within the same hour window", async () => {
    const kv = new InMemoryKV();
    const now = 1_000_000;
    const submitOpts = { windowSeconds: 3600, max: 60 };
    for (let i = 0; i < 60; i++) {
      const result = await checkAndIncrementScopedLimit(kv, "submit", "5.5.5.5", now, submitOpts);
      expect(result.ok).toBe(true);
    }
    const sixtyFirst = await checkAndIncrementScopedLimit(kv, "submit", "5.5.5.5", now, submitOpts);
    expect(sixtyFirst.ok).toBe(false);
    expect(sixtyFirst.count).toBe(60);
  });
});

describe("DEC-180: peekScopedLimit / incrementScopedLimit / resetScopedLimit", () => {
  const opts = { windowSeconds: 900, max: 3 };

  it("peekScopedLimit never writes and reports ok while under the cap", async () => {
    const kv = new InMemoryKV();
    const now = 1_000_000;
    const peek1 = await peekScopedLimit(kv, "login-user", "a@example.com", now, opts);
    expect(peek1).toEqual({ ok: true, count: 0 });
    const peek2 = await peekScopedLimit(kv, "login-user", "a@example.com", now, opts);
    expect(peek2).toEqual({ ok: true, count: 0 });
    expect(kv.has(scopedRateLimitKey("login-user", "a@example.com", 0))).toBe(false);
  });

  it("peekScopedLimit reflects counts written by incrementScopedLimit and rejects at the cap", async () => {
    const kv = new InMemoryKV();
    const now = 1_000_000;
    await incrementScopedLimit(kv, "login-user", "b@example.com", now, opts);
    await incrementScopedLimit(kv, "login-user", "b@example.com", now, opts);
    await incrementScopedLimit(kv, "login-user", "b@example.com", now, opts);
    const peek = await peekScopedLimit(kv, "login-user", "b@example.com", now, opts);
    expect(peek).toEqual({ ok: false, count: 3 });
  });

  it("incrementScopedLimit unconditionally increments even past the cap", async () => {
    const kv = new InMemoryKV();
    const now = 1_000_000;
    for (let i = 0; i < 5; i++) {
      await incrementScopedLimit(kv, "login-user", "c@example.com", now, opts);
    }
    const peek = await peekScopedLimit(kv, "login-user", "c@example.com", now, opts);
    expect(peek).toEqual({ ok: false, count: 5 });
  });

  it("resetScopedLimit deletes the current window's counter", async () => {
    const kv = new InMemoryKV();
    const now = 1_000_000;
    await incrementScopedLimit(kv, "login-user", "d@example.com", now, opts);
    await incrementScopedLimit(kv, "login-user", "d@example.com", now, opts);
    await resetScopedLimit(kv, "login-user", "d@example.com", now, opts.windowSeconds);
    const peek = await peekScopedLimit(kv, "login-user", "d@example.com", now, opts);
    expect(peek).toEqual({ ok: true, count: 0 });
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
