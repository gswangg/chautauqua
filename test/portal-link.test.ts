// DEC-530 wave-42/wave-46 amendments: resolvePortalLinks batches claim-token
// minting for a whole recipient set through one Promise.all instead of N
// sequential awaits — minting for a userless recipient set actually runs
// concurrently (max in-flight KV puts > 1). Wave 46 deleted the singular
// resolvePortalLink wrapper (every caller now batches, even a single
// recipient), so this file exercises resolvePortalLinks only.

import { describe, expect, it } from "vitest";
import type { KVStore } from "../src/auth/claim";
import { resolvePortalLinks } from "../src/server/repo/portal-link";
import { PREVIEW_CLAIM_TOKEN } from "../src/domain/compose";

const EVENT_ID = "evt-1";
const ORIGIN = "https://events.example.com";

/** Fake KV that tracks how many `put` calls are simultaneously in flight,
 * yielding once per call so concurrent callers actually interleave — a
 * sequential-await implementation would never see maxInFlight > 1. */
class ConcurrencyTrackingKV implements KVStore {
  private readonly store = new Map<string, string>();
  puts: string[] = [];
  inFlight = 0;
  maxInFlight = 0;

  async get(key: string): Promise<string | null> {
    return this.store.get(key) ?? null;
  }

  async put(key: string, value: string): Promise<void> {
    this.inFlight += 1;
    this.maxInFlight = Math.max(this.maxInFlight, this.inFlight);
    // Yield to the microtask queue so other in-flight puts get a chance to
    // start before this one finishes — makes concurrency observable.
    await new Promise((resolve) => setTimeout(resolve, 0));
    this.store.set(key, value);
    this.puts.push(key);
    this.inFlight -= 1;
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }
}

function recipients(n: number): { contactId: string; userId: string | null }[] {
  return Array.from({ length: n }, (_, i) => ({ contactId: `ct-${i}`, userId: null }));
}

describe("resolvePortalLinks", () => {
  it("mints all 20 account-less recipients' claim tokens concurrently (>1 in-flight put)", async () => {
    const kv = new ConcurrencyTrackingKV();
    const rs = recipients(20);

    const map = await resolvePortalLinks(kv, rs, EVENT_ID, ORIGIN, true);

    expect(map.size).toBe(20);
    // createClaimToken does 2 puts per mint (claim:<hash> + claim-for index).
    expect(kv.puts.length).toBe(40);
    expect(kv.maxInFlight).toBeGreaterThan(1);
    for (const r of rs) {
      expect(map.get(r.contactId)).toMatch(new RegExp(`^${ORIGIN}/claim/[A-Za-z0-9_-]+$`));
    }
  });

  it("dedupes by contactId — a co-speaker on multiple submissions mints once", async () => {
    const kv = new ConcurrencyTrackingKV();
    const dup = [
      { contactId: "ct-shared", userId: null },
      { contactId: "ct-shared", userId: null },
    ];

    const map = await resolvePortalLinks(kv, dup, EVENT_ID, ORIGIN, true);

    expect(map.size).toBe(1);
    expect(kv.puts.length).toBe(2); // one mint's worth of puts, not two
  });

  it("never touches KV for account holders or when mintClaimTokens is false", async () => {
    const kv = new ConcurrencyTrackingKV();
    const rs = [
      { contactId: "ct-account", userId: "user-1" },
      { contactId: "ct-preview", userId: null },
    ];

    const map = await resolvePortalLinks(kv, rs, EVENT_ID, ORIGIN, false);

    expect(map.get("ct-account")).toBe(`${ORIGIN}/portal`);
    expect(map.get("ct-preview")).toBe(`${ORIGIN}/claim/${PREVIEW_CLAIM_TOKEN}`);
    expect(kv.puts.length).toBe(0);
  });
});

describe("resolvePortalLinks — single-recipient array (no singular wrapper exists)", () => {
  it("resolves the /portal branch for an existing account", async () => {
    const kv = new ConcurrencyTrackingKV();
    const batch = await resolvePortalLinks(kv, [{ contactId: "ct-1", userId: "user-1" }], EVENT_ID, ORIGIN, true);
    expect(batch.get("ct-1")).toBe(`${ORIGIN}/portal`);
    expect(kv.puts.length).toBe(0);
  });

  it("resolves the preview placeholder branch (mintClaimTokens=false) with zero KV writes", async () => {
    const kv = new ConcurrencyTrackingKV();
    const batch = await resolvePortalLinks(kv, [{ contactId: "ct-2", userId: null }], EVENT_ID, ORIGIN, false);
    expect(batch.get("ct-2")).toBe(`${ORIGIN}/claim/${PREVIEW_CLAIM_TOKEN}`);
    expect(kv.puts.length).toBe(0);
  });

  it("mints a real, valid claim token for a userless recipient with minting enabled", async () => {
    const kv = new ConcurrencyTrackingKV();
    const batch = await resolvePortalLinks(kv, [{ contactId: "ct-3", userId: null }], EVENT_ID, ORIGIN, true);
    expect(batch.get("ct-3")).toMatch(new RegExp(`^${ORIGIN}/claim/[A-Za-z0-9_-]+$`));
    expect(kv.puts.length).toBe(2);
  });
});
