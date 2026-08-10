import { describe, expect, it } from "vitest";
import {
  isFormClosed,
  validateTrackChoice,
  resolveOfferedTrackIds,
  nextSeqRef,
  checkAndIncrementRateLimit,
  rateLimitKey,
} from "../src/lib/submit-core";
import { saveDraft, readDraft, deleteDraft, draftCookieName, type KVStore } from "../src/lib/draft";

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

describe("isFormClosed (CFP-04 closed-date gate)", () => {
  it("is open when close date is null", () => {
    expect(isFormClosed(null, Date.now())).toBe(false);
  });

  it("is open when close date is undefined", () => {
    expect(isFormClosed(undefined, Date.now())).toBe(false);
  });

  it("is open right up to the close instant (inclusive)", () => {
    expect(isFormClosed(1000, 1000)).toBe(false);
  });

  it("is closed the instant after close date", () => {
    expect(isFormClosed(1000, 1001)).toBe(true);
  });

  it("is open before the close date", () => {
    expect(isFormClosed(2000, 1000)).toBe(false);
  });
});

describe("validateTrackChoice", () => {
  const available = ["t1", "t2", "t3"];

  it("rejects an empty selection", () => {
    const result = validateTrackChoice([], available);
    expect(result.ok).toBe(false);
  });

  it("accepts a selection within the offered set", () => {
    const result = validateTrackChoice(["t2"], available);
    expect(result).toEqual({ ok: true });
  });

  it("accepts multiple tracks", () => {
    const result = validateTrackChoice(["t1", "t3"], available);
    expect(result).toEqual({ ok: true });
  });

  it("rejects a track not offered by the form", () => {
    const result = validateTrackChoice(["t1", "unknown"], available);
    expect(result.ok).toBe(false);
  });
});

describe("resolveOfferedTrackIds", () => {
  const eventTracks = ["t1", "t2", "t3"];

  it("returns all event tracks when tracksJson is null", () => {
    expect(resolveOfferedTrackIds(null, eventTracks)).toEqual(eventTracks);
  });

  it("returns all event tracks when tracksJson is an empty array", () => {
    expect(resolveOfferedTrackIds(JSON.stringify([]), eventTracks)).toEqual(eventTracks);
  });

  it("returns the subset named in tracksJson", () => {
    expect(resolveOfferedTrackIds(JSON.stringify(["t1", "t3"]), eventTracks)).toEqual(["t1", "t3"]);
  });
});

describe("nextSeqRef (DEC-003 display ref)", () => {
  it("formats the next seq after the current max", () => {
    expect(nextSeqRef("SES", 13)).toBe("SES-014");
  });

  it("formats SES-001 for the first submission in an event (max 0)", () => {
    expect(nextSeqRef("SES", 0)).toBe("SES-001");
  });
});

describe("draft round-trip against an in-memory KV fake", () => {
  it("saves and reads back a draft without consuming it", async () => {
    const kv = new InMemoryKV();
    const token = "tok-1";
    await saveDraft(kv, token, { formId: "form1", answers: { title: "My talk" }, savedAt: 123 });
    const draft = await readDraft(kv, token);
    expect(draft).toEqual({ formId: "form1", answers: { title: "My talk" }, savedAt: 123 });
    // still there after a second read
    await expect(readDraft(kv, token)).resolves.toEqual(draft);
  });

  it("never stores the raw token as the KV key", async () => {
    const kv = new InMemoryKV();
    const token = "tok-2";
    await saveDraft(kv, token, { formId: "form1", answers: {}, savedAt: 1 });
    expect(kv.has(`draft:${token}`)).toBe(false);
  });

  it("deleteDraft removes the record", async () => {
    const kv = new InMemoryKV();
    const token = "tok-3";
    await saveDraft(kv, token, { formId: "form1", answers: { a: 1 }, savedAt: 1 });
    await deleteDraft(kv, token);
    await expect(readDraft(kv, token)).resolves.toBeNull();
  });

  it("returns null for an unknown draft token", async () => {
    const kv = new InMemoryKV();
    await expect(readDraft(kv, "nonexistent")).resolves.toBeNull();
  });

  it("draftCookieName is namespaced per form id (DEC-014)", () => {
    expect(draftCookieName("form1")).toBe("chq_draft_form1");
    expect(draftCookieName("form2")).toBe("chq_draft_form2");
  });
});

describe("checkAndIncrementRateLimit", () => {
  it("allows up to the cap within a window", async () => {
    const kv = new InMemoryKV();
    const now = Date.now();
    for (let i = 0; i < 10; i++) {
      const result = await checkAndIncrementRateLimit(kv, "1.2.3.4", now, 3600, 10);
      expect(result.ok).toBe(true);
    }
  });

  it("rejects the 11th submission within the same hour window", async () => {
    const kv = new InMemoryKV();
    const now = Date.now();
    for (let i = 0; i < 10; i++) {
      await checkAndIncrementRateLimit(kv, "1.2.3.4", now, 3600, 10);
    }
    const eleventh = await checkAndIncrementRateLimit(kv, "1.2.3.4", now, 3600, 10);
    expect(eleventh.ok).toBe(false);
    expect(eleventh.count).toBe(10);
  });

  it("tracks separate IPs independently", async () => {
    const kv = new InMemoryKV();
    const now = Date.now();
    for (let i = 0; i < 10; i++) {
      await checkAndIncrementRateLimit(kv, "1.1.1.1", now, 3600, 10);
    }
    const other = await checkAndIncrementRateLimit(kv, "2.2.2.2", now, 3600, 10);
    expect(other.ok).toBe(true);
  });

  it("rateLimitKey is deterministic for the same ip/window", () => {
    expect(rateLimitKey("1.2.3.4", 1000)).toBe(rateLimitKey("1.2.3.4", 1000));
    expect(rateLimitKey("1.2.3.4", 1000)).not.toBe(rateLimitKey("5.6.7.8", 1000));
  });
});
