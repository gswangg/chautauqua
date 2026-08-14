// Token-mechanism coverage for src/auth/password-reset.ts (task-w27-a).
//
// MERGE NOTE (wave 27 integration): waves 25 and 27 independently implemented
// this same module. The surviving implementation keeps the wave-25 API names
// (createResetToken/readResetToken/consumeResetToken), because src/routes
// /auth.tsx and test/password-reset.test.ts are built on them, and the
// wave-27 index key `pwreset:user:<userId>` plus revokeResetTokenForUser,
// because DEC-949's wave-27 amendment is the later ruling. These cases are
// task-w27-a's, ported onto that reconciled surface: they are the mechanism
// tests (hard-delete-vs-supersede, revocation, cross-user isolation), where
// test/password-reset.test.ts covers the /forgot and /reset/:token routes.
import { describe, expect, it } from "vitest";
import {
  createResetToken,
  readResetToken,
  consumeResetToken,
  revokeResetTokenForUser,
  RESET_TTL_SECONDS,
} from "../src/auth/password-reset";
import type { KVStore } from "../src/auth/password-reset";

class InMemoryKV implements KVStore {
  private readonly store = new Map<string, string>();
  readonly putOpts = new Map<string, { expirationTtl?: number }>();

  async get(key: string): Promise<string | null> {
    return this.store.get(key) ?? null;
  }

  async put(key: string, value: string, opts?: { expirationTtl?: number }): Promise<void> {
    this.store.set(key, value);
    if (opts) this.putOpts.set(key, opts);
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }

  has(key: string): boolean {
    return this.store.has(key);
  }
}

describe("password-reset token flow", () => {
  it("a minted token round-trips through read", async () => {
    const kv = new InMemoryKV();
    const token = await createResetToken(kv, "u1");
    await expect(readResetToken(kv, token)).resolves.toEqual({ userId: "u1" });
  });

  it("stores the record with the 1h TTL", async () => {
    const kv = new InMemoryKV();
    await createResetToken(kv, "u1");
    expect(RESET_TTL_SECONDS).toBe(3600);
    // Every put made during mint used the 1h TTL.
    for (const opts of kv.putOpts.values()) {
      expect(opts.expirationTtl).toBe(RESET_TTL_SECONDS);
    }
  });

  // DEC-949 (wave 27 amendment): the explicit contrast with claim.ts. A
  // second claim mint for the same (contactId, eventId) SUPERSEDES — the
  // first token stays readable for a 48h grace window. A second
  // password-reset mint for the same user instead HARD-DELETES the first
  // token immediately: it dies the instant the second is minted, not merely
  // on a shorter timer.
  it("a second mint for the same user makes the FIRST token dead immediately (hard delete, not a shorter-lived grace like claim.ts)", async () => {
    const kv = new InMemoryKV();
    const first = await createResetToken(kv, "u1");
    await expect(readResetToken(kv, first)).resolves.not.toBeNull();

    const second = await createResetToken(kv, "u1");
    expect(second).not.toBe(first);

    // The first token is dead right away, with no grace-window re-put.
    await expect(readResetToken(kv, first)).resolves.toBeNull();
    await expect(readResetToken(kv, second)).resolves.toEqual({ userId: "u1" });
  });

  it("consume returns the record once and null the second time", async () => {
    const kv = new InMemoryKV();
    const token = await createResetToken(kv, "u1");
    await expect(consumeResetToken(kv, token)).resolves.toEqual({ userId: "u1" });
    await expect(consumeResetToken(kv, token)).resolves.toBeNull();
  });

  it("consume clears the per-user index", async () => {
    const kv = new InMemoryKV();
    const token = await createResetToken(kv, "u1");
    expect(kv.has("pwreset:user:u1")).toBe(true);
    await consumeResetToken(kv, token);
    expect(kv.has("pwreset:user:u1")).toBe(false);
  });

  it("revokeResetTokenForUser kills a live token", async () => {
    const kv = new InMemoryKV();
    const token = await createResetToken(kv, "u1");
    await revokeResetTokenForUser(kv, "u1");
    await expect(readResetToken(kv, token)).resolves.toBeNull();
    expect(kv.has("pwreset:user:u1")).toBe(false);
  });

  it("revokeResetTokenForUser on a user with no live token does not throw", async () => {
    const kv = new InMemoryKV();
    await expect(revokeResetTokenForUser(kv, "nobody")).resolves.toBeUndefined();
  });

  it("returns null for an unknown token", async () => {
    const kv = new InMemoryKV();
    await expect(readResetToken(kv, "nonexistent")).resolves.toBeNull();
    await expect(consumeResetToken(kv, "nonexistent")).resolves.toBeNull();
  });

  it("a token for user A never resolves to user B", async () => {
    const kv = new InMemoryKV();
    const tokenA = await createResetToken(kv, "userA");
    const tokenB = await createResetToken(kv, "userB");

    await expect(readResetToken(kv, tokenA)).resolves.toEqual({ userId: "userA" });
    await expect(readResetToken(kv, tokenB)).resolves.toEqual({ userId: "userB" });

    // Revoking user A's token must not touch user B's live token.
    await revokeResetTokenForUser(kv, "userA");
    await expect(readResetToken(kv, tokenB)).resolves.toEqual({ userId: "userB" });
  });

  it("issues distinct tokens across calls", async () => {
    const kv = new InMemoryKV();
    const a = await createResetToken(kv, "u1");
    const b = await createResetToken(kv, "u2");
    expect(a).not.toBe(b);
  });
});
