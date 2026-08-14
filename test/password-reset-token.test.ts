import { describe, expect, it } from "vitest";
import {
  createPasswordResetToken,
  peekPasswordResetToken,
  consumePasswordResetToken,
  revokePasswordResetTokenForUser,
  PASSWORD_RESET_TTL_SECONDS,
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
  it("a minted token round-trips through peek", async () => {
    const kv = new InMemoryKV();
    const token = await createPasswordResetToken(kv, { userId: "u1", email: "a@example.test" });
    await expect(peekPasswordResetToken(kv, token)).resolves.toEqual({
      userId: "u1",
      email: "a@example.test",
    });
  });

  it("stores the record with the 1h TTL", async () => {
    const kv = new InMemoryKV();
    const token = await createPasswordResetToken(kv, { userId: "u1", email: "a@example.test" });
    void token;
    expect(PASSWORD_RESET_TTL_SECONDS).toBe(3600);
    // Every put made during mint used the 1h TTL.
    for (const opts of kv.putOpts.values()) {
      expect(opts.expirationTtl).toBe(PASSWORD_RESET_TTL_SECONDS);
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
    const first = await createPasswordResetToken(kv, { userId: "u1", email: "a@example.test" });
    await expect(peekPasswordResetToken(kv, first)).resolves.not.toBeNull();

    const second = await createPasswordResetToken(kv, { userId: "u1", email: "a@example.test" });
    expect(second).not.toBe(first);

    // The first token is dead right away, with no grace-window re-put.
    await expect(peekPasswordResetToken(kv, first)).resolves.toBeNull();
    await expect(peekPasswordResetToken(kv, second)).resolves.toEqual({
      userId: "u1",
      email: "a@example.test",
    });
  });

  it("consume returns the record once and null the second time", async () => {
    const kv = new InMemoryKV();
    const token = await createPasswordResetToken(kv, { userId: "u1", email: "a@example.test" });
    await expect(consumePasswordResetToken(kv, token)).resolves.toEqual({
      userId: "u1",
      email: "a@example.test",
    });
    await expect(consumePasswordResetToken(kv, token)).resolves.toBeNull();
  });

  it("consume clears the per-user index", async () => {
    const kv = new InMemoryKV();
    const token = await createPasswordResetToken(kv, { userId: "u1", email: "a@example.test" });
    expect(kv.has("pwreset:user:u1")).toBe(true);
    await consumePasswordResetToken(kv, token);
    expect(kv.has("pwreset:user:u1")).toBe(false);
  });

  it("revokePasswordResetTokenForUser kills a live token", async () => {
    const kv = new InMemoryKV();
    const token = await createPasswordResetToken(kv, { userId: "u1", email: "a@example.test" });
    await revokePasswordResetTokenForUser(kv, "u1");
    await expect(peekPasswordResetToken(kv, token)).resolves.toBeNull();
    expect(kv.has("pwreset:user:u1")).toBe(false);
  });

  it("revokePasswordResetTokenForUser on a user with no live token does not throw", async () => {
    const kv = new InMemoryKV();
    await expect(revokePasswordResetTokenForUser(kv, "nobody")).resolves.toBeUndefined();
  });

  it("returns null for an unknown token", async () => {
    const kv = new InMemoryKV();
    await expect(peekPasswordResetToken(kv, "nonexistent")).resolves.toBeNull();
    await expect(consumePasswordResetToken(kv, "nonexistent")).resolves.toBeNull();
  });

  it("a token for user A never resolves to user B", async () => {
    const kv = new InMemoryKV();
    const tokenA = await createPasswordResetToken(kv, { userId: "userA", email: "a@example.test" });
    const tokenB = await createPasswordResetToken(kv, { userId: "userB", email: "b@example.test" });

    const recordA = await peekPasswordResetToken(kv, tokenA);
    expect(recordA?.userId).toBe("userA");
    const recordB = await peekPasswordResetToken(kv, tokenB);
    expect(recordB?.userId).toBe("userB");

    // Revoking user A's token must not touch user B's live token.
    await revokePasswordResetTokenForUser(kv, "userA");
    await expect(peekPasswordResetToken(kv, tokenB)).resolves.toEqual({
      userId: "userB",
      email: "b@example.test",
    });
  });

  it("issues distinct tokens across calls", async () => {
    const kv = new InMemoryKV();
    const a = await createPasswordResetToken(kv, { userId: "u1", email: "a@example.test" });
    const b = await createPasswordResetToken(kv, { userId: "u2", email: "b@example.test" });
    expect(a).not.toBe(b);
  });
});
