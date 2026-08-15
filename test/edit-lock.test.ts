import { describe, expect, it } from "vitest";
import { canEditSubmission, canEditTracks } from "../src/domain/edit-lock";

// Real day-label instants (UTC midnight of the labeled calendar day, DEC-522
// — closeDate is a DAY LABEL, not an instant, and must be expanded per the
// event's timezone before comparison). Bare 1000/2000 values denote
// 1970-01-01 and would silently invert once that expansion happens.
const LA = "America/Los_Angeles";
const NOW = Date.UTC(2027, 2, 15); // 2027-03-15 (arbitrary "today")
const PAST_CLOSE = Date.UTC(2027, 0, 1); // 2027-01-01 — well closed by NOW
const FUTURE_CLOSE = Date.UTC(2027, 5, 1); // 2027-06-01 — well open at NOW

describe("canEditSubmission (DEC-041 server-side edit lock)", () => {
  it("pending + open form is editable", () => {
    expect(canEditSubmission("pending", FUTURE_CLOSE, NOW, LA)).toBe(true);
  });

  it("pending + closed form is not editable", () => {
    expect(canEditSubmission("pending", PAST_CLOSE, NOW, LA)).toBe(false);
  });

  it("accepted + closed form is STILL editable (DEC-041 amendment, wave 6: accepted speakers keep editing title/abstract after close)", () => {
    expect(canEditSubmission("accepted", PAST_CLOSE, NOW, LA)).toBe(true);
  });

  it("accepted + open form is still editable", () => {
    expect(canEditSubmission("accepted", FUTURE_CLOSE, NOW, LA)).toBe(true);
  });

  it("pending stays locked after close", () => {
    expect(canEditSubmission("pending", PAST_CLOSE, NOW, LA)).toBe(false);
  });

  it("decline_queue + closed form is not editable", () => {
    expect(canEditSubmission("decline_queue", PAST_CLOSE, NOW, LA)).toBe(false);
  });

  it("decline_queue + open form is editable", () => {
    expect(canEditSubmission("decline_queue", FUTURE_CLOSE, NOW, LA)).toBe(true);
  });

  it("null close date never closes the form", () => {
    expect(canEditSubmission("pending", null, NOW, LA)).toBe(true);
  });

  it("DEC-522 regression: a close day-label of 2027-03-01 in America/Los_Angeles still allows edits at 2027-03-01T23:00Z (15:00 local)", () => {
    const closeDate = Date.UTC(2027, 2, 1);
    const now = Date.UTC(2027, 2, 1, 23, 0, 0);
    expect(canEditSubmission("pending", closeDate, now, LA)).toBe(true);
  });

  it("DEC-522 regression: the same close day-label locks out edits at 2027-03-02T08:00:01Z", () => {
    const closeDate = Date.UTC(2027, 2, 1);
    const now = Date.UTC(2027, 2, 2, 8, 0, 1);
    expect(canEditSubmission("pending", closeDate, now, LA)).toBe(false);
  });

  it("Asia/Tokyo (east of UTC): a day-label expands to the preceding UTC day's afternoon", () => {
    const closeDate = Date.UTC(2027, 5, 15); // 2027-06-15 day label
    const stillOpen = Date.UTC(2027, 5, 15, 14, 59, 59, 999); // 23:59:59.999 Tokyo
    const closed = Date.UTC(2027, 5, 15, 15, 0, 0); // 2027-06-16T00:00 Tokyo
    expect(canEditSubmission("pending", closeDate, stillOpen, "Asia/Tokyo")).toBe(true);
    expect(canEditSubmission("pending", closeDate, closed, "Asia/Tokyo")).toBe(false);
  });
});

describe("canEditTracks (DEC-041)", () => {
  it("open form allows track edits", () => {
    expect(canEditTracks(FUTURE_CLOSE, NOW, LA)).toBe(true);
  });

  it("closed form disallows track edits, even if accepted", () => {
    expect(canEditTracks(PAST_CLOSE, NOW, LA)).toBe(false);
  });

  it("null close date never closes track edits", () => {
    expect(canEditTracks(null, NOW, LA)).toBe(true);
  });

  it("DST-boundary day (23-hour spring-forward day): end-of-day is 06:59:59.999Z next UTC day, not 07:59:59.999Z", () => {
    const closeDate = Date.UTC(2027, 2, 14); // US spring-forward Sunday
    const stillOpen = Date.UTC(2027, 2, 15, 6, 59, 59, 999);
    const closed = Date.UTC(2027, 2, 15, 7, 0, 0);
    expect(canEditTracks(closeDate, stillOpen, LA)).toBe(true);
    expect(canEditTracks(closeDate, closed, LA)).toBe(false);
  });
});
