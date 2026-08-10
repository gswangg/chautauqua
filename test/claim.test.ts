import { describe, expect, it } from "vitest";
import {
  createClaimToken,
  readClaimToken,
  consumeClaimToken,
  hashClaimToken,
  claimKvKey,
} from "../src/auth/claim";
import type { KVStore } from "../src/auth/claim";

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

describe("claim token flow", () => {
  it("creates a token that reads back the stored record", async () => {
    const kv = new InMemoryKV();
    const token = await createClaimToken(kv, { contactId: "c1", eventId: "e1" });
    await expect(readClaimToken(kv, token)).resolves.toEqual({ contactId: "c1", eventId: "e1" });
  });

  it("stores under claim:<sha256(token)>, never the raw token", async () => {
    const kv = new InMemoryKV();
    const token = await createClaimToken(kv, { contactId: "c1", eventId: "e1" });
    const hash = await hashClaimToken(token);
    expect(kv.has(claimKvKey(hash))).toBe(true);
    expect(kv.has(`claim:${token}`)).toBe(false);
  });

  it("readClaimToken does not consume the record", async () => {
    const kv = new InMemoryKV();
    const token = await createClaimToken(kv, { contactId: "c1", eventId: "e1" });
    await readClaimToken(kv, token);
    await expect(readClaimToken(kv, token)).resolves.toEqual({ contactId: "c1", eventId: "e1" });
  });

  it("consumeClaimToken deletes the record after reading it", async () => {
    const kv = new InMemoryKV();
    const token = await createClaimToken(kv, { contactId: "c1", eventId: "e1" });
    await expect(consumeClaimToken(kv, token)).resolves.toEqual({ contactId: "c1", eventId: "e1" });
    await expect(readClaimToken(kv, token)).resolves.toBeNull();
    await expect(consumeClaimToken(kv, token)).resolves.toBeNull();
  });

  it("returns null for an unknown token", async () => {
    const kv = new InMemoryKV();
    await expect(readClaimToken(kv, "nonexistent")).resolves.toBeNull();
    await expect(consumeClaimToken(kv, "nonexistent")).resolves.toBeNull();
  });

  it("issues distinct tokens across calls", async () => {
    const kv = new InMemoryKV();
    const a = await createClaimToken(kv, { contactId: "c1", eventId: "e1" });
    const b = await createClaimToken(kv, { contactId: "c2", eventId: "e1" });
    expect(a).not.toBe(b);
  });
});
