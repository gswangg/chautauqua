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

// Real day-label instants (UTC midnight of the labeled calendar day, DEC-522
// — a date-only field is a DAY LABEL, not an instant). Deliberately far from
// the epoch: bare 1000/2000 values denote 1970-01-01 and would silently
// invert once close/open dates are expanded per-timezone.
const LA = "America/Los_Angeles";
const TOKYO = "Asia/Tokyo";
const MAR_1_2027 = Date.UTC(2027, 2, 1); // day label
const MAR_2_2027 = Date.UTC(2027, 2, 2);
const DST_DAY_2027 = Date.UTC(2027, 2, 14); // US spring-forward Sunday
const JUN_15_2027 = Date.UTC(2027, 5, 15);

describe("isFormClosed (CFP-04 closed-date gate)", () => {
  it("is open when close date is null", () => {
    expect(isFormClosed(null, Date.now(), LA)).toBe(false);
  });

  it("is open when close date is undefined", () => {
    expect(isFormClosed(undefined, Date.now(), LA)).toBe(false);
  });

  it("DEC-522 regression: a close day-label of 2027-03-01 in America/Los_Angeles is still OPEN at 2027-03-01T23:00Z (15:00 local)", () => {
    const now = Date.UTC(2027, 2, 1, 23, 0, 0);
    expect(isFormClosed(MAR_1_2027, now, LA)).toBe(false);
  });

  it("DEC-522 regression: the same close day-label is CLOSED at 2027-03-02T08:00:01Z (just past local end-of-day)", () => {
    const now = Date.UTC(2027, 2, 2, 8, 0, 1);
    expect(isFormClosed(MAR_1_2027, now, LA)).toBe(true);
  });

  it("is open right up to the local end-of-day instant (inclusive)", () => {
    const endInstant = Date.UTC(2027, 2, 2, 7, 59, 59, 999);
    expect(isFormClosed(MAR_1_2027, endInstant, LA)).toBe(false);
  });

  it("is closed the millisecond after the local end-of-day instant", () => {
    const justAfter = Date.UTC(2027, 2, 2, 8, 0, 0);
    expect(isFormClosed(MAR_1_2027, justAfter, LA)).toBe(true);
  });

  it("is open well before the close day-label", () => {
    expect(isFormClosed(MAR_2_2027, Date.UTC(2027, 2, 1), LA)).toBe(false);
  });

  it("DST-boundary day: local end-of-day for a 23-hour spring-forward day is still 2027-03-15T06:59:59.999Z, not 07:59:59.999Z", () => {
    expect(isFormClosed(DST_DAY_2027, Date.UTC(2027, 2, 15, 6, 59, 59, 999), LA)).toBe(false);
    expect(isFormClosed(DST_DAY_2027, Date.UTC(2027, 2, 15, 7, 0, 0), LA)).toBe(true);
  });

  it("Asia/Tokyo (east of UTC): a day-label expands to the PRECEDING UTC day's afternoon", () => {
    // Tokyo midnight of 2027-06-15 is 2027-06-14T15:00:00Z; end-of-day is
    // 2027-06-15T14:59:59.999Z.
    expect(isFormClosed(JUN_15_2027, Date.UTC(2027, 5, 15, 14, 59, 59, 999), TOKYO)).toBe(false);
    expect(isFormClosed(JUN_15_2027, Date.UTC(2027, 5, 15, 15, 0, 0), TOKYO)).toBe(true);
  });
});

describe("formWindowState (DEC-036/DEC-522 open/close gate)", () => {
  it("is open when both dates are null", () => {
    expect(formWindowState(null, null, Date.now(), LA)).toBe("open");
  });

  it("is open when both dates are undefined", () => {
    expect(formWindowState(undefined, undefined, Date.now(), LA)).toBe("open");
  });

  it("is not_yet_open strictly before the open day-label's local start-of-day", () => {
    const justBefore = Date.UTC(2027, 2, 1, 7, 59, 59, 999);
    expect(formWindowState(MAR_1_2027, null, justBefore, LA)).toBe("not_yet_open");
  });

  it("is open exactly at the open day-label's local start-of-day (inclusive)", () => {
    const startInstant = Date.UTC(2027, 2, 1, 8, 0, 0);
    expect(formWindowState(MAR_1_2027, null, startInstant, LA)).toBe("open");
  });

  it("is open just after the open day-label's local start-of-day", () => {
    const justAfter = Date.UTC(2027, 2, 1, 8, 0, 1);
    expect(formWindowState(MAR_1_2027, null, justAfter, LA)).toBe("open");
  });

  it("is closed the instant after the close day-label's local end-of-day, even past the open date", () => {
    const now = Date.UTC(2027, 2, 2, 8, 0, 0);
    expect(formWindowState(Date.UTC(2027, 1, 1), MAR_1_2027, now, LA)).toBe("closed");
  });

  it("is open exactly at the close day-label's local end-of-day (inclusive)", () => {
    const endInstant = Date.UTC(2027, 2, 2, 7, 59, 59, 999);
    expect(formWindowState(Date.UTC(2027, 1, 1), MAR_1_2027, endInstant, LA)).toBe("open");
  });

  it("not_yet_open takes priority over closed when open date is after close date (misconfigured)", () => {
    const now = Date.UTC(2027, 2, 1, 12, 0, 0);
    expect(formWindowState(MAR_2_2027, MAR_1_2027, now, LA)).toBe("not_yet_open");
  });

  it("is not_yet_open when now is before an open date with no close date", () => {
    const justBefore = Date.UTC(2027, 2, 1, 7, 59, 59, 999);
    expect(formWindowState(MAR_1_2027, null, justBefore, LA)).toBe("not_yet_open");
  });
});

describe("extractFileAnswers (DEC-040 multipart file extraction)", () => {
  const fieldNameOf = (fieldId: string) => `field__${fieldId}`;

  it("extracts a File instance for a selected file field", () => {
    const file = new File(["hello"], "slides.pdf", { type: "application/pdf" });
    const result = extractFileAnswers(["f1"], fieldNameOf, { field__f1: file });
    expect(result).toEqual({ files: { f1: file }, repeatedFieldIds: [] });
  });

  it("omits a field with no value present in the body", () => {
    const result = extractFileAnswers(["f1"], fieldNameOf, {});
    expect(result).toEqual({ files: {}, repeatedFieldIds: [] });
  });

  it("omits a browser's empty-file placeholder (no filename, zero bytes)", () => {
    const empty = new File([], "", { type: "application/octet-stream" });
    const result = extractFileAnswers(["f1"], fieldNameOf, { field__f1: empty });
    expect(result).toEqual({ files: {}, repeatedFieldIds: [] });
  });

  it("ignores non-File values (e.g. a stray string) for a file field", () => {
    const result = extractFileAnswers(["f1"], fieldNameOf, { field__f1: "not-a-file" });
    expect(result).toEqual({ files: {}, repeatedFieldIds: [] });
  });

  it("handles multiple file fields independently", () => {
    const a = new File(["a"], "a.pdf", { type: "application/pdf" });
    const b = new File(["b"], "b.png", { type: "image/png" });
    const result = extractFileAnswers(["f1", "f2"], fieldNameOf, { field__f1: a, field__f2: b });
    expect(result).toEqual({ files: { f1: a, f2: b }, repeatedFieldIds: [] });
  });

  // DEC-422/DEC-598 (wave-10 amendment): a repeated file part (a File[] from
  // parseBody({all:true})) is refused, never silently dropped as "no
  // answer" — see test/repeated-form-field-refusal.test.ts for the fuller
  // per-door coverage.
  it("collects a repeated file field id in repeatedFieldIds instead of silently dropping it", () => {
    const a = new File(["a"], "a.pdf", { type: "application/pdf" });
    const b = new File(["b"], "b.pdf", { type: "application/pdf" });
    const result = extractFileAnswers(["f1"], fieldNameOf, { field__f1: [a, b] });
    expect(result).toEqual({ files: {}, repeatedFieldIds: ["f1"] });
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

  it("DEC-301: accepts an empty selection when the form offers zero tracks", () => {
    const result = validateTrackChoice([], []);
    expect(result).toEqual({ ok: true });
  });

  it("DEC-301: still rejects an empty selection when tracks are offered", () => {
    const result = validateTrackChoice([], available);
    expect(result).toEqual({ ok: false, error: "Select a track" });
  });

  it("DEC-301: unknown-track rejection is unchanged", () => {
    const result = validateTrackChoice(["unknown"], available);
    expect(result).toEqual({ ok: false, error: "Selected track is not offered by this form." });
  });
});

describe("resolveOfferedTrackIds", () => {
  const eventTracks = ["t1", "t2", "t3"];

  it("returns all event tracks when tracksJson is null", () => {
    expect(resolveOfferedTrackIds(null, eventTracks, "form-1")).toEqual(eventTracks);
  });

  it("returns all event tracks when tracksJson is an empty array", () => {
    expect(resolveOfferedTrackIds(JSON.stringify([]), eventTracks, "form-1")).toEqual(eventTracks);
  });

  it("returns the subset named in tracksJson", () => {
    expect(resolveOfferedTrackIds(JSON.stringify(["t1", "t3"]), eventTracks, "form-1")).toEqual(["t1", "t3"]);
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
