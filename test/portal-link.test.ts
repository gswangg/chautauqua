// DEC-530 wave-42 amendment: resolvePortalLinks batches claim-token minting
// for a whole recipient set through one Promise.all instead of N sequential
// awaits. Two contracts covered here: (1) minting for a userless recipient
// set actually runs concurrently (max in-flight KV puts > 1), and (2) the
// batch reader and the single-recipient reader agree on the SAME link for
// the same input — DEC-530's own standing both-directions rule.

import { describe, expect, it } from "vitest";
import type { KVStore } from "../src/auth/claim";
import { resolvePortalLink, resolvePortalLinks } from "../src/server/repo/portal-link";
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

describe("resolvePortalLink / resolvePortalLinks — both-directions contract (DEC-530)", () => {
  it("agree on the /portal branch for an existing account", async () => {
    const singleKv = new ConcurrencyTrackingKV();
    const batchKv = new ConcurrencyTrackingKV();

    const single = await resolvePortalLink(singleKv, "ct-1", EVENT_ID, "user-1", ORIGIN, true);
    const batch = await resolvePortalLinks(batchKv, [{ contactId: "ct-1", userId: "user-1" }], EVENT_ID, ORIGIN, true);

    expect(batch.get("ct-1")).toBe(single);
    expect(single).toBe(`${ORIGIN}/portal`);
  });

  it("agree on the preview placeholder branch (mintClaimTokens=false)", async () => {
    const singleKv = new ConcurrencyTrackingKV();
    const batchKv = new ConcurrencyTrackingKV();

    const single = await resolvePortalLink(singleKv, "ct-2", EVENT_ID, null, ORIGIN, false);
    const batch = await resolvePortalLinks(batchKv, [{ contactId: "ct-2", userId: null }], EVENT_ID, ORIGIN, false);

    expect(batch.get("ct-2")).toBe(single);
    expect(single).toBe(`${ORIGIN}/claim/${PREVIEW_CLAIM_TOKEN}`);
    expect(singleKv.puts.length).toBe(0);
    expect(batchKv.puts.length).toBe(0);
  });

  it("both mint a real, valid claim token for a userless recipient with minting enabled", async () => {
    const singleKv = new ConcurrencyTrackingKV();
    const batchKv = new ConcurrencyTrackingKV();

    const single = await resolvePortalLink(singleKv, "ct-3", EVENT_ID, null, ORIGIN, true);
    const batch = await resolvePortalLinks(batchKv, [{ contactId: "ct-3", userId: null }], EVENT_ID, ORIGIN, true);

    const pattern = new RegExp(`^${ORIGIN}/claim/[A-Za-z0-9_-]+$`);
    expect(single).toMatch(pattern);
    expect(batch.get("ct-3")).toMatch(pattern);
    // Tokens are randomly minted per call, so the two links themselves
    // differ — the CONTRACT under test is that both take the same shape
    // and both actually performed exactly one mint's worth of KV writes.
    expect(singleKv.puts.length).toBe(2);
    expect(batchKv.puts.length).toBe(2);
  });
});
