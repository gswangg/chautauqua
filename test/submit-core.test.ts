import { describe, expect, it } from "vitest";
import {
  isFormClosed,
  formWindowState,
  validateTrackChoice,
  resolveOfferedTrackIds,
  nextSeqRef,
  extractFileAnswers,
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

describe("formWindowState (DEC-036 open/close gate)", () => {
  it("is open when both dates are null", () => {
    expect(formWindowState(null, null, 1000)).toBe("open");
  });

  it("is open when both dates are undefined", () => {
    expect(formWindowState(undefined, undefined, 1000)).toBe("open");
  });

  it("is not_yet_open strictly before the open date", () => {
    expect(formWindowState(2000, null, 1000)).toBe("not_yet_open");
  });

  it("is open exactly at the open date (inclusive)", () => {
    expect(formWindowState(2000, null, 2000)).toBe("open");
  });

  it("is open just after the open date", () => {
    expect(formWindowState(2000, null, 2001)).toBe("open");
  });

  it("is closed the instant after the close date, even past the open date", () => {
    expect(formWindowState(1000, 2000, 2001)).toBe("closed");
  });

  it("is open exactly at the close date (inclusive)", () => {
    expect(formWindowState(1000, 2000, 2000)).toBe("open");
  });

  it("not_yet_open takes priority over closed when open date is after close date (misconfigured)", () => {
    expect(formWindowState(3000, 2000, 2500)).toBe("not_yet_open");
  });

  it("is not_yet_open when now is before an open date with no close date", () => {
    expect(formWindowState(5000, null, 4999)).toBe("not_yet_open");
  });
});

describe("extractFileAnswers (DEC-040 multipart file extraction)", () => {
  const fieldNameOf = (fieldId: string) => `field__${fieldId}`;

  it("extracts a File instance for a selected file field", () => {
    const file = new File(["hello"], "slides.pdf", { type: "application/pdf" });
    const result = extractFileAnswers(["f1"], fieldNameOf, { field__f1: file });
    expect(result).toEqual({ f1: file });
  });

  it("omits a field with no value present in the body", () => {
    const result = extractFileAnswers(["f1"], fieldNameOf, {});
    expect(result).toEqual({});
  });

  it("omits a browser's empty-file placeholder (no filename, zero bytes)", () => {
    const empty = new File([], "", { type: "application/octet-stream" });
    const result = extractFileAnswers(["f1"], fieldNameOf, { field__f1: empty });
    expect(result).toEqual({});
  });

  it("ignores non-File values (e.g. a stray string) for a file field", () => {
    const result = extractFileAnswers(["f1"], fieldNameOf, { field__f1: "not-a-file" });
    expect(result).toEqual({});
  });

  it("handles multiple file fields independently", () => {
    const a = new File(["a"], "a.pdf", { type: "application/pdf" });
    const b = new File(["b"], "b.png", { type: "image/png" });
    const result = extractFileAnswers(["f1", "f2"], fieldNameOf, { field__f1: a, field__f2: b });
    expect(result).toEqual({ f1: a, f2: b });
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
